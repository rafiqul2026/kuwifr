// server/src/services/fund.service.js
const Fund = require('../models/Fund');
const FundQualification = require('../models/FundQualification');
const BinaryNode = require('../models/BinaryNode');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Order = require('../models/Order');

const FUND_PLANS = [
  {
    code: 'SCHOOL',
    name: 'School Fund',
    requiredLeftKBP: 25000,
    requiredRightKBP: 25000,
    benefitPercentage: 0.02, // 2% on TTO Monthly
    maintenanceLeftKBP: 2500,
    maintenanceRightKBP: 2500,
    order: 1
  },
  {
    code: 'FAMILY',
    name: 'Family Fund',
    requiredLeftKBP: 100000,
    requiredRightKBP: 100000,
    benefitPercentage: 0.02, // 2% on TTO Monthly
    maintenanceLeftKBP: 10000,
    maintenanceRightKBP: 10000,
    order: 2
  },
  {
    code: 'TRAVELLING',
    name: 'Travelling Fund',
    requiredLeftKBP: 250000,
    requiredRightKBP: 250000,
    benefitPercentage: 0.02, // 2% on TTO Monthly
    maintenanceLeftKBP: 25000,
    maintenanceRightKBP: 25000,
    order: 3
  },
  {
    code: 'LIFESTYLE',
    name: 'Lifestyle Fund',
    requiredLeftKBP: 500000,
    requiredRightKBP: 500000,
    benefitPercentage: 0.02, // 2% on TTO Monthly
    maintenanceLeftKBP: 50000,
    maintenanceRightKBP: 50000,
    order: 4
  },
  {
    code: 'FOREIGN_TRIP',
    name: 'Foreign Trip Fund',
    requiredLeftKBP: 1000000,
    requiredRightKBP: 1000000,
    benefitPercentage: 0.02, // 2% on TTO Monthly
    maintenanceLeftKBP: 100000,
    maintenanceRightKBP: 100000,
    order: 5
  },
  {
    code: 'PENSION',
    name: 'Pension Fund',
    requiredLeftKBP: 1000000,
    requiredRightKBP: 1000000,
    benefitPercentage: 0.01, // 1% Lifetime on TTO
    maintenanceLeftKBP: 0,
    maintenanceRightKBP: 0,
    order: 6
  }
];

class FundService {
  /**
   * Seed all 6 Fund Definitions in Database
   */
  static async initializeFunds() {
    for (const item of FUND_PLANS) {
      await Fund.findOneAndUpdate(
        { code: item.code },
        { ...item, isActive: true },
        { upsert: true, new: true }
      );
    }
    return { success: true };
  }

  /**
   * Called whenever a user places a Repurchase Order.
   * Passes the KBP up the tree and checks qualification.
   */
  static async processRepurchaseKBPForFunds(userId, totalOrderKBP) {
    if (!totalOrderKBP || totalOrderKBP <= 0) return;

    let currentNode = await BinaryNode.findOne({ userId });
    if (!currentNode || !currentNode.parentId) return;

    let currentUserId = currentNode.userId;
    let parentId = currentNode.parentId;

    // Traverse upwards and credit Left/Right repurchase KBP
    while (parentId) {
      const parentNode = await BinaryNode.findById(parentId);
      if (!parentNode) break;

      const isLeft = String(parentNode.leftChild) === String(currentUserId);
      if (isLeft) {
        parentNode.leftRepurchaseKBP = (parentNode.leftRepurchaseKBP || 0) + totalOrderKBP;
      } else {
        parentNode.rightRepurchaseKBP = (parentNode.rightRepurchaseKBP || 0) + totalOrderKBP;
      }
      await parentNode.save();

      // Check if this parent now qualifies for a new fund
      await this.evaluateFundQualification(parentNode.userId);

      currentUserId = parentNode.userId;
      parentId = parentNode.parentId;
    }
  }

  /**
   * Check if a member qualifies for any of the 6 Funds
   */
  static async evaluateFundQualification(userId) {
    const binaryNode = await BinaryNode.findOne({ userId });
    if (!binaryNode) return;

    // Use Repurchase matching points (or fallback to binary volume)
    const leftKBP = binaryNode.leftRepurchaseKBP || binaryNode.leftVolume || 0;
    const rightKBP = binaryNode.rightRepurchaseKBP || binaryNode.rightVolume || 0;

    let allFoundationAchieved = true;

    for (const plan of FUND_PLANS) {
      const isPension = plan.code === 'PENSION';
      const meetsTarget = leftKBP >= plan.requiredLeftKBP && rightKBP >= plan.requiredRightKBP;

      if (!isPension) {
        if (meetsTarget) {
          await FundQualification.findOneAndUpdate(
            { userId, fundCode: plan.code },
            {
              userId,
              fundCode: plan.code,
              matchedLeftKBP: leftKBP,
              matchedRightKBP: rightKBP,
              status: 'ACTIVE'
            },
            { upsert: true, new: true }
          );
        } else {
          allFoundationAchieved = false;
        }
      } else {
        // Pension activates only after achieving all previous 5 targeted funds
        if (allFoundationAchieved && meetsTarget) {
          await FundQualification.findOneAndUpdate(
            { userId, fundCode: 'PENSION' },
            {
              userId,
              fundCode: 'PENSION',
              matchedLeftKBP: leftKBP,
              matchedRightKBP: rightKBP,
              status: 'ACTIVE'
            },
            { upsert: true, new: true }
          );
        }
      }
    }
  }

  /**
   * Get Live Fund Status for the Logged-in User
   */
  static async getFundStatus(userId) {
    await this.initializeFunds();
    await this.evaluateFundQualification(userId);

    const binaryNode = await BinaryNode.findOne({ userId });
    const leftKBP = binaryNode?.leftRepurchaseKBP || binaryNode?.leftVolume || 0;
    const rightKBP = binaryNode?.rightRepurchaseKBP || binaryNode?.rightVolume || 0;

    const qualifications = await FundQualification.find({ userId, status: 'ACTIVE' }).lean();
    const qualifiedCodes = new Set(qualifications.map(q => q.fundCode));

    const funds = FUND_PLANS.map(fund => {
      const isQualified = qualifiedCodes.has(fund.code);
      return {
        fund,
        qualified: isQualified,
        current: {
          leftKBP,
          rightKBP
        }
      };
    });

    const allFundsAchieved = ['SCHOOL', 'FAMILY', 'TRAVELLING', 'LIFESTYLE', 'FOREIGN_TRIP'].every(c => qualifiedCodes.has(c));
    const pensionActive = qualifiedCodes.has('PENSION');

    return {
      funds,
      allFundsAchieved,
      pensionActive
    };
  }

  /**
   * Calculate and Distribute Monthly TTO Royalty to Qualified Members
   * (Run at the end of each month via Cron / Admin)
   */
  static async distributeMonthlyTTO(period = null) {
    const now = new Date();
    const currentPeriod = period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 1. Calculate Total Turnover (TTO) in KBP from all repurchase orders this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const monthlyOrders = await Order.aggregate([
      { $match: { createdAt: { $gte: startOfMonth, $lte: endOfMonth }, status: { $ne: 'CANCELLED' } } },
      { $group: { _id: null, totalTTO: { $sum: '$totalKBP' }, totalSales: { $sum: '$totalAmount' } } }
    ]);

    const totalCompanyTTO = monthlyOrders[0]?.totalTTO || 0;
    if (totalCompanyTTO <= 0) {
      return { message: 'No company repurchase volume this month to distribute.' };
    }

    // 2. Distribute Royalty for each Fund Tier
    for (const plan of FUND_PLANS) {
      const qualifiedMembers = await FundQualification.find({
        fundCode: plan.code,
        status: 'ACTIVE',
        lastPayoutPeriod: { $ne: currentPeriod }
      });

      if (qualifiedMembers.length === 0) continue;

      // Pool for this fund = TTO * benefitPercentage (e.g. 2% or 1%)
      const poolAmountInRupees = (totalCompanyTTO * plan.benefitPercentage);
      const perMemberPayout = Math.round((poolAmountInRupees / qualifiedMembers.length) * 100) / 100;

      for (const qual of qualifiedMembers) {
        // Credit to member's Repurchase Wallet
        const wallet = await Wallet.findOne({ userId: qual.userId });
        if (wallet) {
          wallet.repurchaseWallet = (wallet.repurchaseWallet || 0) + perMemberPayout;
          wallet.totalIncome = (wallet.totalIncome || 0) + perMemberPayout;
          await wallet.save();
        }

        qual.lastPayoutPeriod = currentPeriod;
        await qual.save();
      }
    }

    return { success: true, message: `TTO distributed for period ${currentPeriod}` };
  }
}

module.exports = FundService;