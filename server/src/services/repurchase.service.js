// server/src/services/repurchase.service.js
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Referral = require('../models/Referral');
const mongoose = require('mongoose');

// Standard 10-Level Downline Matrix Commission Percentages
const LEVEL_RATES = {
  1: 0.17, // Level 1: 17%
  2: 0.13, // Level 2: 13%
  3: 0.09, // Level 3: 9%
  4: 0.05, // Level 4: 5%
  5: 0.03, // Level 5: 3%
  6: 0.02, // Level 6: 2%
  7: 0.01, // Level 7: 1%
  8: 0.01, // Level 8: 1%
  9: 0.01, // Level 9: 1%
  10: 0.01 // Level 10: 1%
};

const SELF_RATE = 0.25; // 25% Self Repurchase Instant Cashback

class RepurchaseService {
  /**
   * Helper: Calculate the maximum open levels based on active direct referrals.
   * Rule:
   * 0 Directs -> 0 Levels Unlocked
   * 1 Direct  -> Levels 1 & 2 Unlocked
   * 2 Directs -> Levels 1, 2, 3, 4 Unlocked
   * 3 Directs -> Levels 1 through 6 Unlocked
   * 4 Directs -> Levels 1 through 8 Unlocked
   * 5+ Directs-> All 10 Levels Unlocked
   */
  static getMaxUnlockedLevel(directCount) {
    if (!directCount || directCount <= 0) return 0;
    if (directCount === 1) return 2;
    if (directCount === 2) return 4;
    if (directCount === 3) return 6;
    if (directCount === 4) return 8;
    return 10; // 5 or more unlocks all 10 levels
  }

  /**
   * Process Repurchase Order Distribution:
   * 1. 25% Self Cashback to Buyer's Repurchase Wallet.
   * 2. Traverse 10-Level Uplink: Credit commissions only if the upline has the required direct referrals.
   */
  static async processRepurchaseDistribution(buyerId, totalKBP, orderRef = '') {
    if (!totalKBP || totalKBP <= 0) return { selfIncomeAmount: 0, distributedDownline: [] };

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const buyer = await User.findById(buyerId).session(session);
      if (!buyer) throw new Error('Buyer account not found');

      // 1. Calculate & Credit 25% Self Repurchase Cashback
      const selfIncomeAmount = Math.round(totalKBP * SELF_RATE * 100) / 100;
      if (selfIncomeAmount > 0) {
        await Wallet.findOneAndUpdate(
          { userId: buyer._id },
          {
            $inc: {
              selfRepurchaseIncome: selfIncomeAmount,
              totalRepurchaseWallet: selfIncomeAmount,
              totalIncome: selfIncomeAmount,
              incomeBalance: selfIncomeAmount
            }
          },
          { session, upsert: true }
        );

        await User.findByIdAndUpdate(
          buyer._id,
          {
            $inc: {
              lifetimeIncome: selfIncomeAmount,
              totalKBP: totalKBP
            }
          },
          { session }
        );
      }

      // 2. Traverse 10-Level Downline Matrix Uplink
      let currentMember = buyer;
      const distributedDownline = [];

      for (let level = 1; level <= 10; level++) {
        if (!currentMember.sponsorId) break;

        const sponsor = await User.findById(currentMember.sponsorId).session(session);
        if (!sponsor) break;

        const rate = LEVEL_RATES[level] || 0;
        const commission = Math.round(totalKBP * rate * 100) / 100;

        // Check active direct sponsor count for this upline member
        const directActiveCount = await User.countDocuments({
          sponsorId: sponsor._id,
          status: 'ACTIVE'
        }).session(session);

        const maxUnlockedLevel = this.getMaxUnlockedLevel(directActiveCount);

        // Commission credits only if this level is unlocked for the sponsor
        if (commission > 0 && sponsor.status === 'ACTIVE' && level <= maxUnlockedLevel) {
          await Wallet.findOneAndUpdate(
            { userId: sponsor._id },
            {
              $inc: {
                downlineRepurchaseIncome: commission,
                totalRepurchaseWallet: commission,
                totalIncome: commission,
                incomeBalance: commission
              }
            },
            { session, upsert: true }
          );

          await User.findByIdAndUpdate(
            sponsor._id,
            {
              $inc: { lifetimeIncome: commission }
            },
            { session }
          );

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
   * Generate 10-Level Downline Matrix Statistics with Unlock Tracking
   */
  static async get10LevelStats(userId) {
    const directCount = await User.countDocuments({
      sponsorId: userId,
      status: 'ACTIVE'
    });

    const maxUnlockedLevel = this.getMaxUnlockedLevel(directCount);
    const levelsData = [];

    for (let level = 1; level <= 10; level++) {
      const isUnlocked = level <= maxUnlockedLevel;
      const requiredDirects = Math.ceil(level / 2);

      const referrals = await Referral.find({
        sponsorId: userId,
        level: level,
        isActive: true
      }).populate('userId', 'memberId fullName email phoneNumber joinedDate status totalKBP').lean();

      const members = referrals.map((r) => r.userId).filter(Boolean);
      const levelRatePercent = Math.round((LEVEL_RATES[level] || 0) * 100);
      const totalLevelKBP = members.reduce((sum, m) => sum + (m.totalKBP || 0), 0);
      const estimatedIncome = isUnlocked ? Math.round(totalLevelKBP * (LEVEL_RATES[level] || 0) * 100) / 100 : 0;

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