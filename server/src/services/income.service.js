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

    // 3. Process Leadership Income (if qualified)
    const leadershipResult = await this.processLeadershipIncome(userId, kbp, orderId);
    if (leadershipResult) results.push(leadershipResult);

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

    // Authoritative KBP Resolution from Package Master Data
    let effectiveKbp = 1000; // Default Starter KBP fallback
    if (order.packageId) {
      const pkg = await Package.findById(order.packageId);
      if (pkg && typeof pkg.kbpValue === 'number') {
        effectiveKbp = pkg.kbpValue;
      }
    } else if (order.kbpGenerated) {
      effectiveKbp = Number(order.kbpGenerated);
    }

    const rate = 0.10; // Exactly 10%
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

  // ============ LEADERSHIP INCOME ============

  async processLeadershipIncome(userId, kbp, orderId) {
    const isQualified = await this.isLeadershipQualified(userId);
    if (!isQualified) return null;

    const leaders = await this.getDownlineLeaders(userId, 3);
    if (!leaders || Object.keys(leaders).length === 0) return null;

    const rates = { 1: 0.50, 2: 0.30, 3: 0.20 };
    const results = [];

    for (const level in leaders) {
      const levelLeaders = leaders[level];
      const rate = rates[level];

      for (const leader of levelLeaders) {
        const grossAmount = kbp * rate;
        const cappedResult = await this.applyCaps(leader._id, grossAmount);

        const creditResult = await this.creditIncome(
          leader._id,
          cappedResult.allowedAmount,
          `LEADERSHIP_INCOME_L${level}`,
          orderId,
          'Order',
          kbp,
          rate,
          { sourceUserId: userId, level: parseInt(level), orderId }
        );

        if (creditResult && creditResult.transaction) {
          await IncomeTransaction.findByIdAndUpdate(
            creditResult.transaction._id,
            { capBreakdown: cappedResult.capBreakdown, grossAmount, capAdjustment: grossAmount - cappedResult.allowedAmount }
          );
        }

        results.push({ type: `LEADERSHIP_INCOME_L${level}`, userId: leader._id, grossAmount, allowedAmount: cappedResult.allowedAmount });
      }
    }
    return results.length > 0 ? results : null;
  }

  async getDownlineLeaders(userId, maxLevel = 3) {
    const leaders = {};
    const level1Downline = await User.find({ sponsorId: userId, status: 'ACTIVE' });
    
    for (const member of level1Downline) {
      const isValid = await this.isLeadershipQualified(member._id);
      if (isValid) {
        if (!leaders[1]) leaders[1] = [];
        leaders[1].push(member);
      }
      if (maxLevel >= 2) {
        const level2Downline = await User.find({ sponsorId: member._id, status: 'ACTIVE' });
        for (const member2 of level2Downline) {
          if (await this.isLeadershipQualified(member2._id)) {
            if (!leaders[2]) leaders[2] = [];
            leaders[2].push(member2);
          }
        }
      }
    }
    return leaders;
  }

  // ============ REPURCHASE INCOME ============

  async processRepurchaseIncome(userId, kbp, orderId) {
    const selfResult = await this.processSelfRepurchase(userId, kbp, orderId);
    const downlineResult = await this.processDownlineRepurchase(userId, kbp, orderId);
    return [selfResult, ...downlineResult].filter(Boolean);
  }

  async processSelfRepurchase(userId, kbp, orderId) {
    const rate = 0.30;
    const grossAmount = kbp * rate;
    const cappedResult = await this.applyCaps(userId, grossAmount);
    
    const creditResult = await this.creditIncome(userId, cappedResult.allowedAmount, 'REPURCHASE_SELF', orderId, 'Order', kbp, rate, { orderId });
    if (creditResult?.transaction) {
      await IncomeTransaction.findByIdAndUpdate(creditResult.transaction._id, { grossAmount, capAdjustment: grossAmount - cappedResult.allowedAmount });
    }
    return { type: 'REPURCHASE_SELF', userId, grossAmount, allowedAmount: cappedResult.allowedAmount };
  }

  async processDownlineRepurchase(userId, kbp, orderId) {
    const upline = await this.getUpline(userId, 10);
    const rates = { 1: 0.20, 2: 0.15, 3: 0.10, 4: 0.05, 5: 0.03, 6: 0.02, 7: 0.01, 8: 0.01, 9: 0.01, 10: 0.01 };
    const results = [];

    for (let i = 0; i < upline.length && i < 10; i++) {
      const ancestor = upline[i];
      const level = i + 1;
      const rate = rates[level] || 0;
      if (rate === 0) continue;

      const grossAmount = kbp * rate;
      const cappedResult = await this.applyCaps(ancestor._id, grossAmount);
      const creditResult = await this.creditIncome(ancestor._id, cappedResult.allowedAmount, 'REPURCHASE_DOWNLINE', orderId, 'Order', kbp, rate, { sourceUserId: userId, level, orderId });
      
      if (creditResult?.transaction) {
        await IncomeTransaction.findByIdAndUpdate(creditResult.transaction._id, { grossAmount, capAdjustment: grossAmount - cappedResult.allowedAmount });
      }
      results.push({ type: 'REPURCHASE_DOWNLINE', userId: ancestor._id, level, grossAmount, allowedAmount: cappedResult.allowedAmount });
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

  async isLeadershipQualified(userId) {
    const directSponsors = await User.countDocuments({ sponsorId: userId, status: 'ACTIVE' });
    if (directSponsors < 3) return false;
    const node = await BinaryNode.findOne({ userId });
    if (!node) return false;
    const left = node.leftVolume || 0;
    const right = node.rightVolume || 0;
    return (left >= right * 2 || right >= left * 2);
  }

  async updateMatchingVolume(userId, amount) {
    const node = await BinaryNode.findOne({ userId });
    if (!node) return;
    const matchedLeft = Math.min(node.availableLeftVolume, amount);
    const matchedRight = Math.min(node.availableRightVolume, amount);
    node.availableLeftVolume -= matchedLeft;
    node.availableRightVolume -= matchedRight;
    node.matchingVolume += Math.min(matchedLeft, matchedRight);
    await node.save();
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