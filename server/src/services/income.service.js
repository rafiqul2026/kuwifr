const IncomeTransaction = require('../models/IncomeTransaction');
const User = require('../models/User');
const Package = require('../models/Package');
const BinaryNode = require('../models/BinaryNode');
const Referral = require('../models/Referral');
const Order = require('../models/Order');
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

    // 1b. Process Franchise territory overrides (Franchise system) — a
    // no-op for buyers whose upline has no APPROVED franchise, so this is
    // safe to run unconditionally on every order.
    const franchiseResult = await this.processFranchiseOverrides(userId, order, kbp);
    if (franchiseResult) results.push(franchiseResult);

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

    // KBP Resolution — use the order's OWN recorded kbpGenerated first.
    //
    // CRITICAL FIX: this used to always re-fetch Package.findById(order.packageId)
    // and trust THAT document's CURRENT `kbp` field as "authoritative" —
    // meaning if a package's KBP value is ever edited in Admin > Packages
    // AFTER some member's order was already placed under the old value,
    // every future call to processReferralIncome for that OLD order (e.g.
    // an admin reconciliation run today) would silently use TODAY's catalog
    // number instead of what the order was actually worth when placed. This
    // is exactly what produced a real, confirmed mismatch: a member's order
    // recorded kbpGenerated: 3500 (paying his sponsor ₹350, correct for that
    // order), but the package catalog was later changed so every OTHER
    // screen that looks up the package fresh (e.g. the Team page's member
    // detail modal, which resolves activePackageId -> live Package.kbp)
    // shows 10000 KBP for the "same" package today — making the ₹350
    // referral credit look wrong when it was actually computed correctly
    // for a package definition that no longer exists in its original form.
    // order.kbpGenerated is written once, at order-creation time, from
    // whatever the catalog said AT THAT MOMENT (see admin.controller.js,
    // order.controller.js, package.controller.js, packagePurchase.controller.js
    // — all four set it the same way) — exactly the same immutable snapshot
    // BinaryService.updateVolumes/matching income already correctly relies
    // on via processOrderIncome's `const kbp = order.kbpGenerated || 1000`.
    // Referral income now uses that same trustworthy source, falling back
    // to a live Package lookup only for legacy orders missing the field.
    let effectiveKbp = 1000; // Default Starter KBP fallback
    if (order.kbpGenerated) {
      effectiveKbp = Number(order.kbpGenerated);
    } else if (order.packageId) {
      const pkg = await Package.findById(order.packageId);
      if (pkg && typeof pkg.kbp === 'number') {
        effectiveKbp = pkg.kbp;
      }
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
    //
    // TRANSACTION HISTORY DETAIL: per the user's explicit request ("ADMIN
    // SHOULD KNOW WHICH MEMBER GET REFERRAL INCOME FROM WHICH MEMBER WITH
    // DATE AND TIME"), this metadata is what both the member-facing Income
    // Stream history and the Admin Income History view read to show WHO
    // generated this credit, on WHICH package, at WHAT KBP value — sourced
    // from `order.packageName`/`order.orderNumber`, the same kind of
    // immutable order-time snapshot as `order.kbpGenerated` above (never a
    // live/mutable lookup, for the same reason effectiveKbp isn't one).
    // `createdAt` (when this credit happened) is already a standard
    // IncomeTransaction timestamp field — no separate date/time field needed.
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
        sponsoredMemberId: user.memberId,
        sponsoredFullName: user.fullName,
        orderId: order._id,
        orderNumber: order.orderNumber,
        packageId: order.packageId,
        packageName: order.packageName
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

  /**
   * TRANSACTION HISTORY DETAIL — shared enrichment for both the
   * member-facing Income Stream history (income.controller.js#getIncomeStreamHistory)
   * and the Admin panel's income history view (admin.routes.js GET
   * /income/history). Per the user's explicit request ("ADMIN SHOULD KNOW
   * WHICH MEMBER GET REFERRAL INCOME FROM WHICH MEMBER WITH DATE AND TIME"),
   * this attaches, for every REFERRAL_INCOME / MATCHING_INCOME transaction:
   *   - sourceMemberId / sourceMemberName / sourceMemberEmail — WHICH member
   *     generated this credit (the sponsored downline for referral income;
   *     the immediate contributing downline for matching income — see
   *     binary.service.js#calculateMatching's trigger comment for why that's
   *     "which activity caused this," not a claim of sole authorship of 100%
   *     of a matched pair's pooled volume).
   *   - packageName / orderNumber — WHICH package (referral income only;
   *     matching income isn't tied to one single order).
   *   - kbp / rate / creditedAmount / createdAt — already plain top-level
   *     IncomeTransaction fields (kbp value, date & time), untouched here.
   *
   * New transactions (created after this fix shipped) already carry all of
   * this directly in their own `metadata` — see processReferralIncome above
   * and calculateMatching's `triggerMeta`. For OLDER transactions credited
   * before this fix, metadata is missing these fields; this method fills in
   * what it safely still CAN via a batched live lookup (who the sponsored
   * member / source order actually is) for referral income. Matching income
   * has no such fallback — which downline contributed a pre-fix match was
   * simply never recorded at the time, so those older rows are marked with
   * `sourceAttributionNote` instead of a guess.
   *
   * Accepts and returns plain (lean) transaction objects; never mutates the
   * database, and batches its lookups so displaying a page of history never
   * costs more than 2 extra queries regardless of page size.
   */
  async enrichTransactionHistory(transactions) {
    if (!transactions || transactions.length === 0) return [];

    const missingReferralUserIds = new Set();
    const missingOrderIds = new Set();

    for (const tx of transactions) {
      const meta = tx.metadata || {};
      if (tx.type === 'REFERRAL_INCOME') {
        if ((!meta.sponsoredMemberId || !meta.sponsoredFullName) && meta.sponsoredUserId) {
          missingReferralUserIds.add(String(meta.sponsoredUserId));
        }
        if (!meta.packageName) {
          const orderId = meta.orderId || tx.sourceId;
          if (orderId) missingOrderIds.add(String(orderId));
        }
      }
    }

    const [userDocs, orderDocs] = await Promise.all([
      missingReferralUserIds.size
        ? User.find({ _id: { $in: [...missingReferralUserIds] } }).select('memberId fullName email').lean()
        : Promise.resolve([]),
      missingOrderIds.size
        ? Order.find({ _id: { $in: [...missingOrderIds] } }).select('packageName orderNumber').lean()
        : Promise.resolve([])
    ]);
    const userMap = new Map(userDocs.map((u) => [String(u._id), u]));
    const orderMap = new Map(orderDocs.map((o) => [String(o._id), o]));

    return transactions.map((tx) => {
      const meta = tx.metadata || {};
      const enriched = { ...tx };

      if (tx.type === 'REFERRAL_INCOME') {
        const fallbackUser = meta.sponsoredUserId ? userMap.get(String(meta.sponsoredUserId)) : null;
        const fallbackOrderId = meta.orderId || tx.sourceId;
        const fallbackOrder = fallbackOrderId ? orderMap.get(String(fallbackOrderId)) : null;

        enriched.sourceMemberId = meta.sponsoredMemberId || fallbackUser?.memberId || null;
        enriched.sourceMemberName = meta.sponsoredFullName || fallbackUser?.fullName || null;
        enriched.sourceMemberEmail = meta.sponsoredEmail || fallbackUser?.email || null;
        enriched.packageName = meta.packageName || fallbackOrder?.packageName || null;
        enriched.orderNumber = meta.orderNumber || fallbackOrder?.orderNumber || null;
      } else if (tx.type === 'MATCHING_INCOME') {
        enriched.sourceMemberId = meta.triggeredByMemberId || null;
        enriched.sourceMemberName = meta.triggeredByFullName || null;
        enriched.sourceMemberEmail = meta.triggeredByEmail || null;
        enriched.triggeredByLeg = meta.triggeredByLeg || null;
        if (!enriched.sourceMemberId) {
          enriched.sourceAttributionNote = 'Matched before per-member attribution was tracked for this transaction — source member not recorded.';
        }
      }

      return enriched;
    });
  }

  // ============ FRANCHISE OVERRIDES ============

  /**
   * Franchise territory overrides (Franchise system). A Franchise's
   * "territory" is their own full downline (any depth) — the same
   * authoritative sponsor-chain relationship DownlineService already uses
   * elsewhere, not a separately-tracked assignment. Walking UP from the
   * buyer, the NEAREST ancestor holding an APPROVED Franchise record is the
   * one governing franchise for this order (only one franchise is ever
   * credited per order, even if there happen to be several franchises
   * further up the same chain, to avoid stacking overrides on top of each
   * other for a single sale).
   *
   * Two rates, both from Setting.compensation.franchise (admin-configurable,
   * AdminSettingsPage → Franchise Commissions):
   *   - kspRate: a ONE-TIME override, paid the first time a territory member
   *     ever generates a real order (their "activation"), mirroring how
   *     REFERRAL_INCOME is a one-time reward for a sponsor.
   *   - kbpLifetimeRate: an ONGOING override paid on every real order from a
   *     territory member for as long as the franchise stays approved —
   *     "lifetime" because it accumulates across the member's whole
   *     purchase history, not just their first order.
   */
  async processFranchiseOverrides(userId, order, kbp) {
    try {
      const Franchise = require('../models/Franchise');
      const SettingsService = require('./settings.service');

      // Walk up the sponsor chain from the buyer to find the nearest
      // APPROVED franchise ancestor (bounded depth — sponsor chains in this
      // codebase are never meaningfully deeper than a few dozen levels).
      let franchise = null;
      let currentId = userId;
      for (let depth = 0; depth < 25 && !franchise; depth++) {
        const current = await User.findById(currentId).select('sponsorId').lean();
        if (!current || !current.sponsorId) break;
        franchise = await Franchise.findOne({ userId: current.sponsorId, status: 'APPROVED' }).lean();
        currentId = current.sponsorId;
      }

      if (!franchise) return null;
      // A franchise never earns an override on their own personal orders.
      if (String(franchise.userId) === String(userId)) return null;

      const rates = await SettingsService.getFranchise();
      const results = [];

      // One-time activation override — same idempotency pattern as referral
      // income (per source user, not per order, so repeat/duplicate order
      // documents for the same activation event can never double-pay it).
      const alreadyActivated = await IncomeTransaction.findOne({
        userId: franchise.userId,
        type: 'FRANCHISE_ACTIVATION_OVERRIDE',
        'metadata.territoryUserId': userId
      });

      if (!alreadyActivated && rates.kspRate > 0) {
        const grossActivation = kbp * rates.kspRate;
        const cappedActivation = await this.applyCaps(franchise.userId, grossActivation);
        const activationCredit = await this.creditIncome(
          franchise.userId,
          cappedActivation.allowedAmount,
          'FRANCHISE_ACTIVATION_OVERRIDE',
          order._id,
          'Order',
          kbp,
          rates.kspRate,
          { territoryUserId: userId, orderId: order._id }
        );
        if (activationCredit) results.push({ type: 'FRANCHISE_ACTIVATION_OVERRIDE', franchiseId: franchise.userId, grossAmount: grossActivation, allowedAmount: cappedActivation.allowedAmount });
      }

      // Ongoing per-order KBP override — guarded against the same order
      // document being processed twice (a retried webhook, an admin
      // re-trigger), same as every other income type here.
      const alreadyCreditedForOrder = await IncomeTransaction.findOne({
        userId: franchise.userId,
        sourceId: order._id,
        type: 'FRANCHISE_KBP_OVERRIDE'
      });

      if (!alreadyCreditedForOrder && rates.kbpLifetimeRate > 0) {
        const grossKbp = kbp * rates.kbpLifetimeRate;
        const cappedKbp = await this.applyCaps(franchise.userId, grossKbp);
        const kbpCredit = await this.creditIncome(
          franchise.userId,
          cappedKbp.allowedAmount,
          'FRANCHISE_KBP_OVERRIDE',
          order._id,
          'Order',
          kbp,
          rates.kbpLifetimeRate,
          { territoryUserId: userId, orderId: order._id }
        );
        if (kbpCredit) results.push({ type: 'FRANCHISE_KBP_OVERRIDE', franchiseId: franchise.userId, grossAmount: grossKbp, allowedAmount: cappedKbp.allowedAmount });
      }

      return results.length > 0 ? { type: 'FRANCHISE_OVERRIDE', franchiseId: franchise.userId, entries: results } : null;
    } catch (err) {
      console.error('   Franchise override processing failed:', err.message);
      return null;
    }
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

    const walletType = ['REFERRAL_INCOME', 'MATCHING_INCOME', 'LEADERSHIP_INCOME_L1', 'LEADERSHIP_INCOME_L2', 'LEADERSHIP_INCOME_L3', 'FRANCHISE_ACTIVATION_OVERRIDE', 'FRANCHISE_KBP_OVERRIDE'].includes(type) ? 'INCOME' : 'REPURCHASE';

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

  // ============ ADMIN REPAIR: MISSING REFERRAL INCOME ============

  /**
   * Backfills the one-time 10% Direct Referral Bonus for any ACTIVE,
   * sponsored member whose activation never actually triggered
   * processReferralIncome().
   *
   * Real-world case this fixes: RAFIQUL Test (KFR441197) has 5 real,
   * ACTIVE direct referrals — but only 3 of them ever generated a
   * REFERRAL_INCOME transaction for him (₹1,500 credited instead of the
   * correct ₹2,650). Root cause: this codebase has FIVE separate activation
   * endpoints that each create an Order and call processOrderIncome
   * (admin.controller.js#activateMemberWithPackage,
   * order.controller.js#activateCashPackage,
   * package.controller.js#purchasePackage,
   * packagePurchase.controller.js#approvePackagePurchase,
   * packageActivation.service.js#activateCashPackage). One of them —
   * order.controller.js#activateCashPackage — called processOrderIncome()
   * BEFORE committing its own MongoDB transaction, so processReferralIncome's
   * plain (non-session) User.findById() read never saw the member's
   * just-written 'ACTIVE' status and silently skipped every referral bonus
   * it should have paid (fixed separately in that controller). This method
   * repairs the DATA left behind by that bug (and any future gap of the
   * same shape) without needing to know which endpoint caused it.
   *
   * Safe to run any time, repeatedly: processReferralIncome() already
   * refuses to double-credit (a per-order guard AND a per-sponsored-member
   * guard), so re-running this only ever fills in a genuinely missing
   * credit — it can never duplicate one that already exists.
   */
  async reconcileMissingReferralIncome() {
    // Same "counts as a real completed order" rule used everywhere else in
    // this codebase (user.controller.js's REAL_ORDER_MATCH, fund.service.js's
    // TTO aggregation) — orders can be marked COMPLETED via either the
    // legacy `status` field or the newer `orderStatus`/`DELIVERED` field
    // depending on which activation endpoint created them.
    const REAL_ORDER_MATCH = {
      $or: [
        { orderStatus: { $in: ['COMPLETED', 'DELIVERED'] } },
        { status: 'COMPLETED' }
      ]
    };

    const activeMembers = await User.find({
      status: 'ACTIVE',
      sponsorId: { $ne: null, $exists: true }
    }).select('_id sponsorId memberId fullName').lean();

    let checked = 0;
    let alreadyCredited = 0;
    let credited = 0;
    let noQualifyingOrder = 0;
    let failed = 0;
    const repaired = [];

    for (const member of activeMembers) {
      checked++;

      const alreadyHasCredit = await IncomeTransaction.findOne({
        type: 'REFERRAL_INCOME',
        'metadata.sponsoredUserId': member._id
      }).select('_id').lean();

      if (alreadyHasCredit) {
        alreadyCredited++;
        continue;
      }

      // The earliest real PACKAGE order is this member's actual activation
      // event — the one that should have paid their sponsor.
      const order = await Order.findOne({
        userId: member._id,
        orderType: 'PACKAGE',
        ...REAL_ORDER_MATCH
      }).sort({ createdAt: 1 });

      if (!order) {
        noQualifyingOrder++;
        continue;
      }

      try {
        const result = await this.processReferralIncome(member._id, order);
        if (result) {
          credited++;
          repaired.push({
            memberId: member.memberId,
            memberName: member.fullName,
            sponsorId: result.sponsorId,
            allowedAmount: result.allowedAmount
          });
        } else {
          // processReferralIncome returned null for a reason other than
          // "already credited" (e.g. sponsor suspended, member not ACTIVE
          // at the moment of the re-check) — not an error, just not payable.
          noQualifyingOrder++;
        }
      } catch (err) {
        failed++;
        console.error(`Reconcile referral income failed for ${member.memberId}:`, err.message);
      }
    }

    return { checked, alreadyCredited, credited, noQualifyingOrder, failed, repaired };
  }

  /**
   * Backfills the SHORTFALL on a REFERRAL_INCOME transaction that was
   * credited using the wrong KBP amount — not "missing" (that's
   * reconcileMissingReferralIncome above), but "paid, and for the correct
   * order, but for less than it should have been."
   *
   * Root cause (now fixed in processReferralIncome, see that function's
   * comment): the referral engine used to always re-fetch
   * Package.findById(order.packageId).kbp — the package's CURRENT, mutable
   * catalog value — instead of the order's own `kbpGenerated`, which is
   * written once at order-creation time and never changes. So a member
   * activated when a package was, say, 3500 KBP correctly got credited 10%
   * of 3500 (₹350) — but if that package's KBP was LATER edited in
   * Admin > Packages (e.g. to 10000), every other screen that looks the
   * package up fresh (the Team page's member-detail modal, which resolves
   * activePackageId -> live Package.kbp) shows the NEW number, making the
   * old ₹350 credit look wrong even though it was correctly computed for
   * what the package was worth at the time. This was a REAL, confirmed
   * case: RAFIQUL Test's (KFR441197) direct referral Kalim (KFR916989).
   *
   * This method finds every such case using ONLY the order's own immutable
   * kbpGenerated — never a live catalog value — and tops up the exact
   * shortfall as a separate, clearly-labeled correction transaction. It
   * never edits or deletes the original transaction (append-only ledger),
   * and is idempotent: it records which original transaction each
   * correction resolves and skips any it's already corrected, so running
   * it again finds nothing left to do.
   */
  async reconcileUnderpaidReferralIncome() {
    const referralTxns = await IncomeTransaction.find({
      type: 'REFERRAL_INCOME',
      status: 'CREDITED',
      sourceModel: 'Order'
    }).lean();

    let checked = 0;
    let alreadyCorrect = 0;
    let alreadyCorrected = 0;
    let corrected = 0;
    let noSourceOrder = 0;
    let failed = 0;
    const corrections = [];

    for (const tx of referralTxns) {
      checked++;

      try {
        // Skip correction entries themselves — only ever re-check the
        // ORIGINAL referral credit for a given order/sponsored-member.
        if (tx.metadata?.correctionForTransactionId) continue;

        const order = await Order.findById(tx.sourceId).select('kbpGenerated').lean();
        if (!order || !order.kbpGenerated) {
          noSourceOrder++;
          continue;
        }

        const correctKbp = Number(order.kbpGenerated);
        const correctGross = correctKbp * tx.rate;
        const shortfall = correctGross - (tx.grossAmount || 0);

        if (shortfall <= 0) {
          alreadyCorrect++;
          continue;
        }

        const alreadyCorrectedTx = await IncomeTransaction.findOne({
          type: 'REFERRAL_INCOME',
          'metadata.correctionForTransactionId': tx.transactionId
        }).select('_id').lean();

        if (alreadyCorrectedTx) {
          alreadyCorrected++;
          continue;
        }

        const cappedResult = await this.applyCaps(tx.userId, shortfall);
        if (cappedResult.allowedAmount <= 0) {
          // Genuinely nothing payable right now (cap exhausted) — not an
          // error, just not payable today. Leave it for a future run.
          continue;
        }

        const creditResult = await this.creditIncome(
          tx.userId,
          cappedResult.allowedAmount,
          'REFERRAL_INCOME',
          order._id,
          'Order',
          correctKbp,
          tx.rate,
          {
            ...tx.metadata,
            correctionForTransactionId: tx.transactionId,
            correctionReason: 'kbp_resolution_fix',
            originalGrossAmount: tx.grossAmount,
            originalKbp: tx.kbp,
            correctKbp
          }
        );

        if (creditResult) {
          corrected++;
          corrections.push({
            userId: String(tx.userId),
            originalTransactionId: tx.transactionId,
            originalAmount: tx.grossAmount,
            correctAmount: correctGross,
            topUpCredited: cappedResult.allowedAmount
          });
        }
      } catch (err) {
        failed++;
        console.error(`Reconcile underpaid referral income failed for transaction ${tx.transactionId}:`, err.message);
      }
    }

    return { checked, alreadyCorrect, alreadyCorrected, corrected, noSourceOrder, failed, corrections };
  }
}

module.exports = new IncomeService();