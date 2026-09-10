const IncomeTransaction = require('../models/IncomeTransaction');
const User = require('../models/User');
const Package = require('../models/Package');
const BinaryNode = require('../models/BinaryNode');
const Referral = require('../models/Referral');
const WalletService = require('./wallet.service');
const BinaryService = require('./binary.service');

/**
 * Income Service - Handles all income calculations
 * Authoritative Compensation Plan Engine (KBP-Based)
 */
class IncomeService {
  /**
   * Generate unique transaction ID
   */
  generateTransactionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 6);
    return `INC-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Process all income from an order
   * Called when an order is completed
   */
  async processOrderIncome(order) {
    const userId = order.userId;
    const orderId = order._id;
    const kbp = order.kbpGenerated || 1000;

    console.log(`📊 Processing income for order ${order.orderNumber}`);
    console.log(`   User: ${userId}`);

    const results = [];

    // 1. Process Referral Income (Strictly 10% of authoritative KBP)
    const referralResult = await this.processReferralIncome(userId, order);
    if (referralResult) results.push(referralResult);

    // 2. Process Matching Income
    // NOTE: Matching is now handled exclusively by BinaryService, which walks the
    // actual binary tree (BinaryNode.parentId), applies the real 2:1 / 1:2 first-pair
    // rule, then 1:1 for subsequent pairs, and deducts matched volume so it can't be
    // reused. This replaces the old processMatchingIncome() below, which incorrectly
    // walked the sponsor chain (User.sponsorId) instead of the binary tree, never
    // added this order's own KBP into leftVolume/rightVolume before matching against
    // it, and applied no 2:1/1:2 rule at all — producing incorrect payouts. Do not
    // reintroduce processMatchingIncome() into this flow.
    let matchingResult = null;
    try {
      await BinaryService.updateVolumes(userId, kbp);
      matchingResult = { type: 'MATCHING_INCOME', engine: 'BinaryService.updateVolumes', kbp };
    } catch (matchErr) {
      console.error('   Binary matching volume propagation failed:', matchErr.message);
    }
    if (matchingResult) results.push(matchingResult);

    // 3. Leadership / Cheque Match Bonus is NOT computed here. Per the
    // business plan it is "50%/30%/20% on matching income of 1st/2nd/3rd
    // level's Leaders" — i.e. a % of the ACTUAL matching-income payout a
    // leader earns, not a % of raw order KBP. It is triggered from
    // BinaryService.calculateMatching() (via
    // IncomeService.processLeadershipBonusForMatch) at the moment matching
    // income is actually credited, using the real capped amount. See that
    // function for the current implementation; do not reintroduce a
    // per-order leadership calculation here.

    console.log(`✅ Income processing complete. ${results.length} transaction batches created`);

    return {
      success: true,
      transactions: results
    };
  }

  // ============ REFERRAL INCOME ============

  /**
   * Process Referral Income (10% of authoritative KBP)
   * Rule: Only active direct referrals generate referral income.
   * Income goes to the sponsor (upline level 1).
   */
  async processReferralIncome(userId, order) {
    const user = await User.findById(userId);
    if (!user || !user.sponsorId) {
      console.log('   No sponsor found for referral income');
      return null;
    }

    // Verify downline user is ACTIVE
    if (user.status !== 'ACTIVE') {
      console.log('   Downline user is not active. Referral income skipped.');
      return null;
    }

    const sponsor = await User.findById(user.sponsorId);
    if (!sponsor || ['SUSPENDED', 'BLOCKED', 'DEACTIVATED'].includes(sponsor.status)) {
      console.log('   Sponsor not active or suspended');
      return null;
    }

    // Authoritative KBP Resolution from Package Master Data.
    // NOTE: Package.js's schema field is `kbp`, not `kbpValue` — the previous
    // `pkg.kbpValue` check always read `undefined` and silently fell through
    // to the order.kbpGenerated fallback below (which happened to still be
    // correct for normal package orders, but meant this "authoritative"
    // resolution path never actually ran).
    let effectiveKbp = 1000; // Default Starter KBP fallback
    if (order.packageId) {
      const pkg = await Package.findById(order.packageId);
      if (pkg && typeof pkg.kbp === 'number') {
        effectiveKbp = pkg.kbp;
      }
    } else if (order.kbpGenerated) {
      effectiveKbp = Number(order.kbpGenerated);
    }

    const SettingsService = require('./settings.service');
    const rate = await SettingsService.getReferralRate(); // admin-configurable, default 10%
    const grossAmount = effectiveKbp * rate; // e.g., ₹1,000 KBP * 0.10 = ₹100

    console.log(`   Referral Income: ₹${grossAmount} for sponsor ${sponsor.email} (Based on KBP: ₹${effectiveKbp})`);

    // Strict Idempotency Check: Prevent duplicate referral commission for the same order/source user
    const existingTx = await IncomeTransaction.findOne({
      userId: sponsor._id,
      sourceId: order._id,
      type: 'REFERRAL_INCOME'
    });

    if (existingTx) {
      console.log('   Referral income already credited for this order. Skipping duplicate.');
      return null;
    }

    // Second, broader guard: there are multiple admin/member code paths that
    // can each create their own Order document for what is really the same
    // real-world activation of this downline member (member self-submit +
    // approve, admin cash activation, direct admin activation). The check
    // above only catches a repeat of the exact same order._id — it would
    // not catch a SECOND order created for the same member by a different
    // path. Referral income is a one-time reward for a member's activation,
    // not a per-order-document reward, so also refuse if this sponsor has
    // ANY prior referral credit tied to this specific downline member.
    const existingForMember = await IncomeTransaction.findOne({
      userId: sponsor._id,
      type: 'REFERRAL_INCOME',
      'metadata.sponsoredUserId': userId
    });

    if (existingForMember) {
      console.log('   Referral income already credited for this member (via a different order). Skipping duplicate.');
      return null;
    }

    // Apply caps
    const cappedResult = await this.applyCaps(sponsor._id, grossAmount);

    // Credit to wallet
    const creditResult = await this.creditIncome(
      sponsor._id,
      cappedResult.allowedAmount,
      'REFERRAL_INCOME',
      order._id,
      'Order',
      effectiveKbp,
      rate,
      {
        sponsoredUserId: userId,
        sponsoredEmail: user.email,
        orderId: order._id
      }
    );

    // Store cap breakdown & correct gross amounts
    if (creditResult && creditResult.transaction) {
      await IncomeTransaction.findByIdAndUpdate(
        creditResult.transaction._id,
        { 
          capBreakdown: cappedResult.capBreakdown,
          grossAmount: grossAmount,
          capAdjustment: grossAmount - cappedResult.allowedAmount
        }
      );
    }

    return {
      type: 'REFERRAL_INCOME',
      sponsorId: sponsor._id,
      grossAmount,
      allowedAmount: cappedResult.allowedAmount,
      excess: cappedResult.excess
    };
  }

  // ============ MATCHING INCOME ============

  /**
   * @deprecated DO NOT CALL. Superseded by BinaryService.updateVolumes() +
   * BinaryService.calculateMatching(), which is now the single source of truth
   * for binary matching income (see processOrderIncome above for why). This
   * function is kept only for historical/audit reference and is intentionally
   * disconnected from processOrderIncome. It incorrectly walked the sponsor
   * chain instead of the binary tree and had no 2:1/1:2 first-pair rule.
   */
  async processMatchingIncome(userId, kbp, orderId) {
    console.warn('[DEPRECATED] IncomeService.processMatchingIncome() was called directly. ' +
      'Matching income must go through BinaryService.updateVolumes() instead. Ignoring call.');
    return null;
  }

  // ============ LEADERSHIP / CHEQUE MATCH BONUS ============

  /**
   * Leadership / Cheque Match Bonus (business plan section 3): "100% within
   * 3rd levels — 1st Level = 50% on matching income of 1st level's Leaders,
   * 2nd Level = 30%, 3rd Level = 20%". Called by BinaryService right after it
   * actually credits a MATCHING_INCOME payout to `leaderUserId`, with the
   * exact (already capped) amount that was credited.
   *
   * Walks the SPONSOR tree (not the binary tree — "level" here means sponsor
   * levels, the classic leadership-override structure) starting from the
   * leader who just earned the match, up to 3 levels. Both the earner and
   * each recipient must hold at least the configured minimum rank (business
   * plan condition h: "associate will must qualify into KUWI STAR Rank" to
   * receive Leadership Bonus).
   *
   * Replaces the old processLeadershipIncome()/getDownlineLeaders(), which
   * were triggered off the PURCHASER's own downline on every order (backwards
   * — it should flow to the earner's UPLINE), paid a % of raw order KBP
   * instead of actual matching income, and never implemented level 3 at all
   * despite IncomeTransaction.type already reserving LEADERSHIP_INCOME_L3.
   */
  async processLeadershipBonusForMatch(leaderUserId, matchingAmount, sourceNodeId) {
    if (!matchingAmount || matchingAmount <= 0) return null;

    const SettingsService = require('./settings.service');
    const Rank = require('../models/Rank');
    const RankService = require('./rank.service');

    const leadershipCfg = await SettingsService.getLeadership();
    const levelRates = Array.isArray(leadershipCfg.levelRates) && leadershipCfg.levelRates.length
      ? leadershipCfg.levelRates
      : [0.50, 0.30, 0.20];

    const minRank = await Rank.findOne({ code: leadershipCfg.minRankCode || 'KUWI_STAR' });
    if (!minRank) return null;

    const leaderRank = await RankService.getCurrentRank(leaderUserId);
    if (!leaderRank || leaderRank.level < minRank.level) return null;

    const results = [];
    let currentUserId = leaderUserId;

    for (let level = 1; level <= levelRates.length; level++) {
      const currentUser = await User.findById(currentUserId).select('sponsorId');
      if (!currentUser || !currentUser.sponsorId) break;

      const sponsor = await User.findById(currentUser.sponsorId);
      if (!sponsor) break;

      const rate = levelRates[level - 1] || 0;
      if (rate > 0 && sponsor.status === 'ACTIVE') {
        const sponsorRank = await RankService.getCurrentRank(sponsor._id);
        if (sponsorRank && sponsorRank.level >= minRank.level) {
          const grossAmount = matchingAmount * rate;
          const cappedResult = await this.applyCaps(sponsor._id, grossAmount);

          if (cappedResult.allowedAmount > 0) {
            const creditResult = await this.creditIncome(
              sponsor._id,
              cappedResult.allowedAmount,
              `LEADERSHIP_INCOME_L${level}`,
              sourceNodeId,
              'BinaryNode',
              matchingAmount,
              rate,
              { sourceUserId: leaderUserId, level }
            );

            if (creditResult && creditResult.transaction) {
              await IncomeTransaction.findByIdAndUpdate(
                creditResult.transaction._id,
                { capBreakdown: cappedResult.capBreakdown, grossAmount, capAdjustment: grossAmount - cappedResult.allowedAmount }
              );
            }

            results.push({ type: `LEADERSHIP_INCOME_L${level}`, userId: sponsor._id, level, grossAmount, allowedAmount: cappedResult.allowedAmount });
          }
        }
      }

      currentUserId = sponsor._id;
    }

    return results.length > 0 ? results : null;
  }

  // ============ REPURCHASE INCOME ============

  /**
   * Thin delegation to RepurchaseService — the single source of truth for
   * repurchase commission math (self cashback %, 10-level downline rates,
   * and the "N direct referrals unlocks levels" gating rule). This used to
   * duplicate that logic here with DIFFERENT (wrong) rates — 30% self
   * instead of 25%, 20/15/10/5/3/2/1×4 instead of 17/13/9/5/3/2/1×4 — and
   * with no direct-referral level-unlock gating at all, while crediting
   * straight into incomeBalance instead of the dedicated repurchaseBalance.
   * Kept under the same name/signature so existing callers (product.service.js)
   * don't need to change, and also propagates the repurchase KBP into the
   * Life Tension Free Funds, matching what the dedicated repurchase-store
   * checkout flow already does (repurchase.controller.js).
   */
  async processRepurchaseIncome(userId, kbp, orderId) {
    const RepurchaseService = require('./repurchase.service');
    const FundService = require('./fund.service');

    const distribution = await RepurchaseService.processRepurchaseDistribution(userId, kbp, String(orderId));

    await FundService.processRepurchaseKBPForFunds(userId, kbp).catch((err) => {
      console.error('   Fund KBP propagation failed:', err.message);
    });

    const results = [];
    if (distribution.selfIncomeAmount > 0) {
      results.push({ type: 'REPURCHASE_SELF', userId, allowedAmount: distribution.selfIncomeAmount });
    }
    for (const entry of distribution.distributedDownline || []) {
      if (entry.status === 'CREDITED') {
        results.push({ type: 'REPURCHASE_DOWNLINE', userId: entry.uplineId, level: entry.level, allowedAmount: entry.commission });
      }
    }
    return results;
  }

  // ============ CAPPING ENGINE ============

  async applyCaps(userId, income) {
    const user = await User.findById(userId);
    if (!user || !user.activePackageId) {
      return { allowedAmount: income, excess: 0, capBreakdown: { daily: { consumed: 0, remaining: Infinity, cap: Infinity }, weekly: { consumed: 0, remaining: Infinity, cap: Infinity }, monthly: { consumed: 0, remaining: Infinity, cap: Infinity } } };
    }

    const pkg = await Package.findById(user.activePackageId);
    if (!pkg) {
      return { allowedAmount: income, excess: 0, capBreakdown: { daily: { consumed: 0, remaining: Infinity, cap: Infinity }, weekly: { consumed: 0, remaining: Infinity, cap: Infinity }, monthly: { consumed: 0, remaining: Infinity, cap: Infinity } } };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = this.getWeekStart(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const dailyConsumed = await this.getConsumedIncome(userId, today, now);
    const weeklyConsumed = await this.getConsumedIncome(userId, weekStart, now);
    const monthlyConsumed = await this.getConsumedIncome(userId, monthStart, now);

    const dailyRemaining = Math.max(0, pkg.dailyCap - dailyConsumed);
    const weeklyRemaining = Math.max(0, pkg.weeklyCap - weeklyConsumed);
    const monthlyRemaining = Math.max(0, pkg.monthlyCap - monthlyConsumed);

    let allowedAmount = Math.min(income, dailyRemaining, weeklyRemaining, monthlyRemaining);
    allowedAmount = Math.max(0, allowedAmount);

    return {
      allowedAmount,
      excess: income - allowedAmount,
      capBreakdown: {
        daily: { consumed: dailyConsumed, remaining: dailyRemaining, cap: pkg.dailyCap },
        weekly: { consumed: weeklyConsumed, remaining: weeklyRemaining, cap: pkg.weeklyCap },
        monthly: { consumed: monthlyConsumed, remaining: monthlyRemaining, cap: pkg.monthlyCap }
      }
    };
  }

  async getConsumedIncome(userId, startDate, endDate) {
    const result = await IncomeTransaction.aggregate([
      { $match: { userId: userId, status: 'CREDITED', createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: null, total: { $sum: '$creditedAmount' } } }
    ]);
    return result.length > 0 ? result[0].total : 0;
  }

  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  // ============ INCOME CREDITING ============

  async creditIncome(userId, amount, type, sourceId, sourceModel, kbp, rate, metadata = {}) {
    if (amount <= 0) return null;

    const walletType = ['REFERRAL_INCOME', 'MATCHING_INCOME', 'LEADERSHIP_INCOME_L1', 'LEADERSHIP_INCOME_L2', 'LEADERSHIP_INCOME_L3'].includes(type) ? 'INCOME' : 'REPURCHASE';

    try {
      const creditResult = await WalletService.credit(userId, amount, type, sourceId, { sourceModel, kbp, rate, ...metadata });
      if (!creditResult || !creditResult.transaction) throw new Error('Failed to credit wallet');

      const incomeTransaction = new IncomeTransaction({
        userId: userId,
        transactionId: this.generateTransactionId(),
        type: type,
        sourceId: sourceId,
        sourceModel: sourceModel,
        kbp: kbp,
        rate: rate,
        grossAmount: amount,
        capAdjustment: 0,
        creditedAmount: amount,
        walletType: walletType,
        walletId: creditResult.transaction.walletId,
        status: 'CREDITED',
        processedAt: new Date(),
        metadata: { ...metadata, walletTransactionId: creditResult.transaction._id }
      });

      await incomeTransaction.save();
      console.log(`   ✅ Credited ₹${amount} to ${walletType} wallet of user ${userId}`);

      return { success: true, transaction: incomeTransaction, walletTransaction: creditResult.transaction };
    } catch (error) {
      console.error(`   ❌ Failed to credit income: ${error.message}`);

      // NOTE: this used to just console.error and return null — a real
      // matching/referral/leadership event could fail to pay out with
      // ABSOLUTELY NO trace anywhere (BinaryNode volume/pairCount had
      // already been saved by the caller, so the dashboard could show real
      // team activity while the member's income silently stayed ₹0
      // forever, and no admin report could ever explain why). Persist a
      // FAILED IncomeTransaction (the schema already declares this status,
      // it was simply never written) so this is now auditable instead of
      // invisible. Best-effort: if even this write fails, we still return
      // null rather than throwing, since a logging failure must never take
      // down the compensation pipeline that called us.
      try {
        // walletId is a required field on IncomeTransaction — fetch/create
        // the wallet (idempotent, does not touch its balance) purely to
        // get a valid id to attach this FAILED record to.
        const fallbackWallet = await WalletService.getOrCreateWallet(userId);
        await IncomeTransaction.create({
          userId,
          transactionId: this.generateTransactionId(),
          type,
          sourceId,
          sourceModel,
          kbp,
          rate,
          grossAmount: amount,
          capAdjustment: amount,
          creditedAmount: 0,
          walletType,
          walletId: fallbackWallet._id,
          status: 'FAILED',
          processedAt: new Date(),
          metadata: { ...metadata, failureReason: error.message }
        });
      } catch (logError) {
        console.error(`   ❌ Additionally failed to record the FAILED income transaction: ${logError.message}`);
      }

      return null;
    }
  }

  async getUserEmail(userId) {
    const user = await User.findById(userId).select('email');
    return user ? user.email : 'Unknown';
  }

  async getUpline(userId, maxDepth = 20) {
    const upline = [];
    let currentId = userId;
    let depth = 0;

    while (depth < maxDepth) {
      const user = await User.findById(currentId);
      if (!user || !user.sponsorId) break;
      const sponsor = await User.findById(user.sponsorId);
      if (!sponsor) break;
      upline.push(sponsor);
      currentId = sponsor._id;
      depth++;
    }
    return upline;
  }

  /**
   * Whether `userId` currently qualifies to EARN Leadership/Cheque Match
   * Bonus — business plan condition h: "associate will must qualify into
   * KUWI STAR Rank" (or whatever rank the admin configures as the minimum).
   * Delegates to the single official rank engine instead of re-deriving
   * qualification from raw direct-sponsor counts and binary volume ratios.
   */
  async isLeadershipQualified(userId) {
    const SettingsService = require('./settings.service');
    const Rank = require('../models/Rank');
    const RankService = require('./rank.service');

    const leadershipCfg = await SettingsService.getLeadership();
    const minRank = await Rank.findOne({ code: leadershipCfg.minRankCode || 'KUWI_STAR' });
    if (!minRank) return false;

    const currentRank = await RankService.getCurrentRank(userId);
    return !!currentRank && currentRank.level >= minRank.level;
  }


  async getIncomeSummary(userId) {
    const totalResult = await IncomeTransaction.aggregate([
      { $match: { userId: userId, status: 'CREDITED' } },
      { $group: { _id: null, totalIncome: { $sum: '$creditedAmount' }, totalCount: { $sum: 1 } } }
    ]);
    const totals = totalResult.length > 0 ? { totalIncome: totalResult[0].totalIncome, totalCount: totalResult[0].totalCount } : { totalIncome: 0, totalCount: 0 };

    const lastIncome = await IncomeTransaction.findOne({ userId: userId, status: 'CREDITED' }).sort({ createdAt: -1 }).limit(1);

    return {
      total: totals,
      lastIncome: lastIncome ? lastIncome.format() : null
    };
  }

  async getIncomeTransactions(userId, limit = 50, skip = 0) {
    const transactions = await IncomeTransaction.find({ userId: userId, status: 'CREDITED' }).sort({ createdAt: -1 }).skip(skip).limit(limit);
    const total = await IncomeTransaction.countDocuments({ userId: userId, status: 'CREDITED' });
    return { transactions: transactions.map(t => t.format()), pagination: { total, limit, skip, pages: Math.ceil(total / limit) } };
  }

  async getIncomeByType(userId, type, limit = 50, skip = 0) {
    const transactions = await IncomeTransaction.find({ userId: userId, type: type, status: 'CREDITED' }).sort({ createdAt: -1 }).skip(skip).limit(limit);
    const total = await IncomeTransaction.countDocuments({ userId: userId, type: type, status: 'CREDITED' });
    return { transactions: transactions.map(t => t.format()), pagination: { total, limit, skip, pages: Math.ceil(total / limit) } };
  }

  async getCapStatus(userId) {
    const user = await User.findById(userId);
    if (!user || !user.activePackageId) return { hasPackage: false, message: 'No active package found' };
    const pkg = await Package.findById(user.activePackageId);
    if (!pkg) return { hasPackage: false, message: 'Package not found' };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = this.getWeekStart(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const dailyConsumed = await this.getConsumedIncome(userId, today, now);
    const weeklyConsumed = await this.getConsumedIncome(userId, weekStart, now);
    const monthlyConsumed = await this.getConsumedIncome(userId, monthStart, now);

    return {
      package: { name: pkg.name, type: pkg.type },
      caps: {
        daily: { cap: pkg.dailyCap, consumed: dailyConsumed, remaining: Math.max(0, pkg.dailyCap - dailyConsumed), percentage: Math.round((dailyConsumed / pkg.dailyCap) * 100) },
        weekly: { cap: pkg.weeklyCap, consumed: weeklyConsumed, remaining: Math.max(0, pkg.weeklyCap - weeklyConsumed), percentage: Math.round((weeklyConsumed / pkg.weeklyCap) * 100) },
        monthly: { cap: pkg.monthlyCap, consumed: monthlyConsumed, remaining: Math.max(0, pkg.monthlyCap - monthlyConsumed), percentage: Math.round((monthlyConsumed / pkg.monthlyCap) * 100) }
      }
    };
  }
}

module.exports = new IncomeService();