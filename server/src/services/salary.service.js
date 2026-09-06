// server/src/services/salary.service.js
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const BinaryNode = require('../models/BinaryNode');
const Referral = require('../models/Referral');
const Order = require('../models/Order');
const SalaryLog = require('../models/SalaryLog');

class SalaryService {
  /**
   * Helper: Formats Date into YYYY-MM
   */
  static getMonthString(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  /**
   * Get previous month string in YYYY-MM
   */
  static getPreviousMonthString(date = new Date()) {
    const prevDate = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    return this.getMonthString(prevDate);
  }

  /**
   * Evaluates live month-to-date salary qualification progress for a member
   * @param {String|ObjectId} userId
   */
  static async getLiveSalaryProgress(userId) {
    const currentMonth = this.getMonthString(new Date());
    const prevMonth = this.getPreviousMonthString(new Date());

    const [user, binaryNode, prevMonthLog] = await Promise.all([
      User.findById(userId).populate({ path: 'currentRankId', strictPopulate: false }).lean(),
      BinaryNode.findOne({ userId }).lean(),
      SalaryLog.findOne({ userId, month: prevMonth }).lean()
    ]);

    if (!user) throw new Error('Member not found');

    // 1. Convert raw KBP volume to genuine Star Units (1 Star = 1,000 KBP)
    const rawLeftKbp = Number(binaryNode?.leftVolume || 0);
    const rawRightKbp = Number(binaryNode?.rightVolume || 0);

    const currentLeftStar = Math.floor(rawLeftKbp / 1000);
    const currentRightStar = Math.floor(rawRightKbp / 1000);
    const currentMatchedStars = Math.min(currentLeftStar, currentRightStar);
    const currentTotalStar = currentLeftStar + currentRightStar;

    // 2. Official Rank Condition: Gold Star Rank (Level 5 = 200 Matched Stars)
    const isGoldStarAchieved =
      user.currentRankId?.name === 'Gold Star' ||
      user.currentRankId?.code === 'GOLD_STAR' ||
      currentMatchedStars >= 200;

    // 3. Baseline for Gold Star monthly maintenance
    const startingLeftStar = prevMonthLog?.currentLeftStar || (isGoldStarAchieved ? Math.max(100, Math.floor(currentLeftStar * 0.9)) : 0);
    const startingRightStar = prevMonthLog?.currentRightStar || (isGoldStarAchieved ? Math.max(100, Math.floor(currentRightStar * 0.9)) : 0);
    const startingTotalStar = startingLeftStar + startingRightStar;

    // 4. Current month Star increases
    const leftGrowth = Math.max(0, currentLeftStar - startingLeftStar);
    const rightGrowth = Math.max(0, currentRightStar - startingRightStar);
    const totalGrowth = leftGrowth + rightGrowth;

    // 5. Growth Requirement: 10% monthly growth (split 50:50 across Left and Right legs)
    const requiredTotalGrowth = isGoldStarAchieved
      ? Math.max(20, Math.round(startingTotalStar * 0.10))
      : 20;
    const requiredPerLegGrowth = Math.ceil(requiredTotalGrowth / 2);

    const has10PercentGrowth = totalGrowth >= requiredTotalGrowth;
    const has5050Balance = leftGrowth >= requiredPerLegGrowth && rightGrowth >= requiredPerLegGrowth;
    const isCurrentlyQualified = isGoldStarAchieved && has10PercentGrowth && has5050Balance;

    // 6. Downline Team Turn Over (TTO) month-to-date
    const downlineRefs = await Referral.find({ sponsorId: userId }).select('userId').lean();
    const teamUserIds = downlineRefs.map((r) => r.userId);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    let currentMonthTTO = 0;
    if (teamUserIds.length > 0) {
      const ttoResult = await Order.aggregate([
        {
          $match: {
            userId: { $in: teamUserIds },
            status: { $in: ['COMPLETED', 'PAID', 'DELIVERED'] },
            createdAt: { $gte: startOfMonth, $lte: endOfMonth }
          }
        },
        {
          $group: {
            _id: null,
            totalTurnover: { $sum: '$totalAmount' }
          }
        }
      ]);
      currentMonthTTO = ttoResult[0]?.totalTurnover || 0;
    }

    const estimatedSalary = isCurrentlyQualified ? Number((currentMonthTTO * 0.01).toFixed(2)) : 0;

    return {
      currentMonth,
      isGoldStarRank: isGoldStarAchieved,
      isGoldStarAchieved,
      currentMatchedStars,
      currentTotalStars: currentMatchedStars, // Matched stars required for rank milestone
      currentTotalStar,
      requiredMinStar: 200,
      startingTotalStar,
      startingLeftStar,
      startingRightStar,
      currentLeftStar,
      currentRightStar,
      leftGrowthAchieved: leftGrowth,
      rightGrowthAchieved: rightGrowth,
      leftGrowth,
      rightGrowth,
      totalGrowth,
      requiredTotalGrowth,
      requiredPerLegGrowth,
      has10PercentGrowth,
      has5050Balance,
      isQualifiedThisMonth: isCurrentlyQualified,
      isCurrentlyQualified,
      teamTurnoverThisMonth: currentMonthTTO,
      currentMonthTTO,
      projected1PercentSalary: estimatedSalary,
      estimatedSalary,
      salaryPercentage: 1
    };
  }

  /**
   * Final Monthly Settlement Processor (Executed on monthly cron/scheduler)
   */
  static async processMonthlySalaryPayout(userId, targetMonth) {
    if (!targetMonth) {
      targetMonth = this.getPreviousMonthString(new Date());
    }

    const [yearStr, monthStr] = targetMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const [user, binaryNode, existingLog] = await Promise.all([
      User.findById(userId).populate({ path: 'currentRankId', strictPopulate: false }),
      BinaryNode.findOne({ userId }),
      SalaryLog.findOne({ userId, month: targetMonth })
    ]);

    if (!user || !binaryNode) {
      return { success: false, message: 'User or Binary tree not found' };
    }

    if (existingLog && existingLog.status === 'PROCESSED') {
      return { success: false, message: `Salary for ${targetMonth} has already been settled.` };
    }

    const currentLeftStar = Math.floor((binaryNode.leftVolume || 0) / 1000);
    const currentRightStar = Math.floor((binaryNode.rightVolume || 0) / 1000);
    const currentMatchedStars = Math.min(currentLeftStar, currentRightStar);

    // Condition 1: Gold Star Rank (Level 5 = 200 Matched Stars)
    if (currentMatchedStars < 200 && user.currentRankId?.name !== 'Gold Star') {
      await SalaryLog.findOneAndUpdate(
        { userId, month: targetMonth },
        {
          userId,
          month: targetMonth,
          rankAtEvaluation: user.currentRankId?.name || 'Below Gold Star',
          totalStarAtEvaluation: currentMatchedStars,
          isQualified: false,
          disqualificationReason: 'Total matched star volume is below 200 Stars (Gold Star requirement not met)',
          status: 'DISQUALIFIED'
        },
        { upsert: true, new: true }
      );
      return { success: false, message: 'Disqualified: Minimum 200 Matched Star Gold Star requirement not met.' };
    }

    // Baseline from previous month
    const prevMonthDate = new Date(year, month - 2, 1);
    const prevMonthStr = this.getMonthString(prevMonthDate);
    const prevMonthLog = await SalaryLog.findOne({ userId, month: prevMonthStr });

    const startingLeftStar = prevMonthLog?.currentLeftStar || Math.max(100, Math.floor(currentLeftStar * 0.9));
    const startingRightStar = prevMonthLog?.currentRightStar || Math.max(100, Math.floor(currentRightStar * 0.9));
    const startingTotalStar = startingLeftStar + startingRightStar;

    const leftGrowth = Math.max(0, currentLeftStar - startingLeftStar);
    const rightGrowth = Math.max(0, currentRightStar - startingRightStar);
    const totalGrowth = leftGrowth + rightGrowth;

    const requiredTotalGrowth = Math.max(20, Math.round(startingTotalStar * 0.10));
    const requiredPerLeg = Math.ceil(requiredTotalGrowth / 2);

    const has10Percent = totalGrowth >= requiredTotalGrowth;
    const is5050Balanced = leftGrowth >= requiredPerLeg && rightGrowth >= requiredPerLeg;
    const isQualified = has10Percent && is5050Balanced;

    // Downline Team Turn Over (TTO)
    const downlineRefs = await Referral.find({ sponsorId: userId }).select('userId').lean();
    const teamUserIds = downlineRefs.map((r) => r.userId);

    let tto = 0;
    if (teamUserIds.length > 0) {
      const orderAgg = await Order.aggregate([
        {
          $match: {
            userId: { $in: teamUserIds },
            status: { $in: ['COMPLETED', 'PAID', 'DELIVERED'] },
            createdAt: { $gte: startOfMonth, $lte: endOfMonth }
          }
        },
        {
          $group: {
            _id: null,
            totalTurnover: { $sum: '$totalAmount' }
          }
        }
      ]);
      tto = orderAgg[0]?.totalTurnover || 0;
    }

    const salaryAmount = isQualified ? Number((tto * 0.01).toFixed(2)) : 0;

    let disqualificationReason = '';
    if (!has10Percent) {
      disqualificationReason = `Monthly Star growth was less than 10% (Required: +${requiredTotalGrowth} Stars, Achieved: +${totalGrowth} Stars)`;
    } else if (!is5050Balanced) {
      disqualificationReason = `Star growth was not balanced 50:50 across Left and Right legs (Required per leg: +${requiredPerLeg} Stars. Left: +${leftGrowth}, Right: +${rightGrowth})`;
    }

    const log = await SalaryLog.findOneAndUpdate(
      { userId, month: targetMonth },
      {
        userId,
        month: targetMonth,
        rankAtEvaluation: user.currentRankId?.name || 'Gold Star',
        totalStarAtEvaluation: currentMatchedStars,
        startingLeftStar,
        startingRightStar,
        currentLeftStar,
        currentRightStar,
        leftGrowth,
        rightGrowth,
        totalGrowth,
        growthPercentageAchieved: startingTotalStar > 0 ? (totalGrowth / startingTotalStar) * 100 : 0,
        isRatioBalanced: is5050Balanced,
        isQualified,
        disqualificationReason,
        teamTurnoverAmount: tto,
        salaryPercentage: 1,
        salaryAmount,
        status: isQualified ? 'PROCESSED' : 'DISQUALIFIED',
        processedAt: isQualified ? new Date() : null
      },
      { upsert: true, new: true }
    );

    if (isQualified && salaryAmount > 0) {
      let wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        wallet = await Wallet.create({ userId });
      }

      await wallet.updateBalance(salaryAmount, 'SALARY', {
        description: `1% TTO Monthly Salary for ${targetMonth} (Turnover: ₹${tto.toLocaleString()})`,
        source: 'MONTHLY_SALARY',
        reference: log._id.toString()
      });
    }

    return {
      success: true,
      qualified: isQualified,
      salaryAmount,
      log
    };
  }
}

module.exports = SalaryService;