// server/src/services/repurchase.service.js
const User = require('../models/User');
const IncomeTransaction = require('../models/IncomeTransaction');
const WalletService = require('./wallet.service');
const SettingsService = require('./settings.service');
const mongoose = require('mongoose');

class RepurchaseService {
  /**
   * Helper: Calculate the maximum open levels based on active direct referrals,
   * using the admin-configured unlock table (default: business plan rule —
   * 1 direct unlocks levels 1-2, 2 directs unlocks 1-4, ... 8+ directs
   * unlocks all 15).
   */
  static async getMaxUnlockedLevel(directCount) {
    if (!directCount || directCount <= 0) return 0;
    const { unlockLevelsByDirects } = await SettingsService.getRepurchase();
    const table = Array.isArray(unlockLevelsByDirects) && unlockLevelsByDirects.length
      ? unlockLevelsByDirects
      : [2, 4, 6, 8, 10, 12, 14, 15];
    const idx = Math.min(directCount, table.length) - 1;
    return table[idx];
  }

  /**
   * Generate a unique income transaction id (mirrors IncomeService's format).
   */
  static generateTransactionId(prefix = 'REP') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 6);
    return `${prefix}-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Process Repurchase Order Distribution:
   * 1. Self Cashback (admin-configurable %, default 20%) to Buyer's Repurchase Wallet.
   * 2. Traverse 15-Level Uplink: Credit commissions only if the upline has the required direct referrals.
   *
   * Both legs are credited through WalletService.credit() — atomic per-wallet
   * balance updates into the correct repurchaseBalance bucket (NOT
   * incomeBalance), with a full WalletTransaction audit trail — wrapped in a
   * single Mongo session/transaction so a mid-way failure can't leave some
   * legs credited and others not. Each credit also gets an IncomeTransaction
   * record so it shows up in income history/admin reports the same way
   * referral/matching/leadership income does.
   */
  static async processRepurchaseDistribution(buyerId, totalKBP, orderRef = '') {
    if (!totalKBP || totalKBP <= 0) return { selfIncomeAmount: 0, distributedDownline: [] };

    const { selfRate, levelRates } = await SettingsService.getRepurchase();
    const rates = Array.isArray(levelRates) && levelRates.length
      ? levelRates
      : [0.15, 0.10, 0.07, 0.06, 0.05, 0.04, 0.03, 0.02, 0.015, 0.01, 0.005, 0.005, 0.005, 0.005, 0.005];

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const buyer = await User.findById(buyerId).session(session);
      if (!buyer) throw new Error('Buyer account not found');

      // 1. Calculate & Credit Self Repurchase Cashback (into repurchaseBalance)
      const selfIncomeAmount = Math.round(totalKBP * selfRate * 100) / 100;
      if (selfIncomeAmount > 0) {
        const creditResult = await WalletService.credit(
          buyer._id,
          selfIncomeAmount,
          'REPURCHASE_SELF',
          orderRef || null,
          { description: `Self Repurchase Cashback (${(selfRate * 100).toFixed(0)}%)`, orderRef },
          session
        );

        await IncomeTransaction.create([{
          userId: buyer._id,
          transactionId: this.generateTransactionId('REPSELF'),
          type: 'REPURCHASE_SELF',
          sourceId: buyer._id,
          sourceModel: 'User',
          kbp: totalKBP,
          rate: selfRate,
          grossAmount: selfIncomeAmount,
          capAdjustment: 0,
          creditedAmount: selfIncomeAmount,
          walletType: 'REPURCHASE',
          walletId: creditResult?.transaction?.walletId || null,
          status: 'CREDITED',
          processedAt: new Date(),
          metadata: { orderRef }
        }], { session });

        await User.findByIdAndUpdate(
          buyer._id,
          { $inc: { totalKBP } },
          { session }
        );
      }

      // 2. Traverse 10-Level Downline Matrix Uplink
      let currentMember = buyer;
      const distributedDownline = [];

      for (let level = 1; level <= rates.length; level++) {
        if (!currentMember.sponsorId) break;

        const sponsor = await User.findById(currentMember.sponsorId).session(session);
        if (!sponsor) break;

        const rate = rates[level - 1] || 0;
        const commission = Math.round(totalKBP * rate * 100) / 100;

        // Check active direct sponsor count for this upline member
        const directActiveCount = await User.countDocuments({
          sponsorId: sponsor._id,
          status: 'ACTIVE'
        }).session(session);

        const maxUnlockedLevel = await this.getMaxUnlockedLevel(directActiveCount);

        // Commission credits only if this level is unlocked for the sponsor
        if (commission > 0 && sponsor.status === 'ACTIVE' && level <= maxUnlockedLevel) {
          const creditResult = await WalletService.credit(
            sponsor._id,
            commission,
            'REPURCHASE_DOWNLINE',
            orderRef || null,
            { description: `Downline Repurchase Income (Level ${level})`, sourceUserId: buyer._id, level, orderRef },
            session
          );

          await IncomeTransaction.create([{
            userId: sponsor._id,
            transactionId: this.generateTransactionId('REPDL'),
            type: 'REPURCHASE_DOWNLINE',
            sourceId: buyer._id,
            sourceModel: 'User',
            kbp: totalKBP,
            rate,
            grossAmount: commission,
            capAdjustment: 0,
            creditedAmount: commission,
            walletType: 'REPURCHASE',
            walletId: creditResult?.transaction?.walletId || null,
            status: 'CREDITED',
            processedAt: new Date(),
            metadata: { sourceUserId: buyer._id, level, orderRef }
          }], { session });

          distributedDownline.push({
            level,
            uplineId: sponsor._id,
            memberId: sponsor.memberId,
            commission,
            status: 'CREDITED'
          });
        } else {
          distributedDownline.push({
            level,
            uplineId: sponsor._id,
            memberId: sponsor.memberId,
            commission: 0,
            status: 'LOCKED_INSUFFICIENT_DIRECTS'
          });
        }

        currentMember = sponsor;
      }

      await session.commitTransaction();
      session.endSession();
      return { success: true, selfIncomeAmount, distributedDownline };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  /**
   * Generate 15-Level Downline Matrix Statistics with Unlock Tracking
   *
   * Member lists/counts per level used to come from the `Referral`
   * collection, a best-effort mirror of User.sponsorId that can silently
   * miss rows (see referral.service.js) — a member with a genuinely large
   * downline could see this matrix understate (or entirely zero out) lower
   * levels even though the actual commission engine
   * (processRepurchaseDistribution, above) is unaffected — that one always
   * walked the live User.sponsorId chain directly. This now sources the
   * same authoritative full downline via DownlineService (one $graphLookup
   * query), so the matrix display matches reality and matches what the
   * commission engine actually pays against.
   */
  static async get10LevelStats(userId) {
    const DownlineService = require('./downline.service');
    const { levelRates } = await SettingsService.getRepurchase();
    const rates = Array.isArray(levelRates) && levelRates.length
      ? levelRates
      : [0.15, 0.10, 0.07, 0.06, 0.05, 0.04, 0.03, 0.02, 0.015, 0.01, 0.005, 0.005, 0.005, 0.005, 0.005];

    const directCount = await User.countDocuments({
      sponsorId: userId,
      status: 'ACTIVE'
    });

    const maxUnlockedLevel = await this.getMaxUnlockedLevel(directCount);

    const fullDownline = await DownlineService.getFullDownline(userId);
    const byLevel = new Map();
    for (const member of fullDownline) {
      const level = (member.depth || 0) + 1;
      if (!byLevel.has(level)) byLevel.set(level, []);
      byLevel.get(level).push({
        _id: member._id,
        memberId: member.memberId,
        fullName: member.fullName,
        email: member.email,
        phoneNumber: member.phoneNumber,
        joinedDate: member.createdAt,
        status: member.status,
        totalKBP: member.totalKBP || 0
      });
    }

    const levelsData = [];

    for (let level = 1; level <= rates.length; level++) {
      const isUnlocked = level <= maxUnlockedLevel;
      const requiredDirects = Math.ceil(level / 2);

      const members = byLevel.get(level) || [];
      const levelRatePercent = Math.round((rates[level - 1] || 0) * 100);
      const totalLevelKBP = members.reduce((sum, m) => sum + (m.totalKBP || 0), 0);
      const estimatedIncome = isUnlocked ? Math.round(totalLevelKBP * (rates[level - 1] || 0) * 100) / 100 : 0;

      levelsData.push({
        level,
        percentage: levelRatePercent,
        isUnlocked,
        requiredDirects,
        currentDirects: directCount,
        directsNeeded: Math.max(0, requiredDirects - directCount),
        memberCount: members.length,
        totalLevelKBP,
        estimatedIncome,
        members
      });
    }

    return {
      directCount,
      maxUnlockedLevel,
      levels: levelsData
    };
  }
}

module.exports = RepurchaseService;
