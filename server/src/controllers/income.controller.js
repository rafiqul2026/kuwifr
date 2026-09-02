const IncomeService = require('../services/income.service');
const Order = require('../models/Order');
const User = require('../models/User');
const BinaryNode = require('../models/BinaryNode');
const IncomeTransaction = require('../models/IncomeTransaction');

/**
 * Process income for an order (Called after payment)
 * POST /api/income/process-order/:orderId
 */
const processOrderIncome = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.userId.toString() !== userId.toString() && 
        req.user.role !== 'ADMIN' && 
        req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    if (order.orderStatus === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Income already processed for this order'
      });
    }

    const result = await IncomeService.processOrderIncome(order);

    order.orderStatus = 'COMPLETED';
    await order.save();

    res.json({
      success: true,
      message: 'Income processed successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get income summary
 * GET /api/income/summary
 */
const getIncomeSummary = async (req, res, next) => {
  try {
    const userId = req.userId;
    const summary = await IncomeService.getIncomeSummary(userId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get income transactions
 * GET /api/income/transactions
 */
const getIncomeTransactions = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const result = await IncomeService.getIncomeTransactions(
      userId,
      parseInt(limit),
      skip
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get income by type
 * GET /api/income/type/:type
 */
const getIncomeByType = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { type } = req.params;
    const { limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const result = await IncomeService.getIncomeByType(
      userId,
      type,
      parseInt(limit),
      skip
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get cap status
 * GET /api/income/cap-status
 */
const getCapStatus = async (req, res, next) => {
  try {
    const userId = req.userId;
    const status = await IncomeService.getCapStatus(userId);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get today's income
 * GET /api/income/today
 */
const getTodayIncome = async (req, res, next) => {
  try {
    const userId = req.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    const result = await IncomeTransaction.aggregate([
      {
        $match: {
          userId: userId,
          status: 'CREDITED',
          createdAt: { $gte: today, $lte: now }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$creditedAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        today: today.toISOString().split('T')[0],
        total: result.length > 0 ? result[0].total : 0,
        count: result.length > 0 ? result[0].count : 0
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============ LEADERSHIP ============

/**
 * Get leadership status
 * GET /api/income/leadership-status
 */
const getLeadershipStatus = async (req, res, next) => {
  try {
    const userId = req.userId;
    
    const isQualified = await IncomeService.isLeadershipQualified(userId);
    
    const directSponsors = await User.countDocuments({ sponsorId: userId });
    
    const node = await BinaryNode.findOne({ userId });
    const binaryData = node ? {
      leftVolume: node.leftVolume,
      rightVolume: node.rightVolume,
      ratio: node.leftVolume >= node.rightVolume * 2 ? '2:1' : 
             node.rightVolume >= node.leftVolume * 2 ? '1:2' : 'Not qualified'
    } : null;

    res.json({
      success: true,
      data: {
        isQualified,
        requirements: {
          directSponsors: {
            required: 3,
            current: directSponsors,
            met: directSponsors >= 3
          },
          binaryStructure: {
            required: '2:1 or 1:2',
            current: binaryData ? binaryData.ratio : 'No binary data',
            met: isQualified
          }
        },
        binary: binaryData
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============ REPURCHASE ============

/**
 * Get repurchase income summary
 * GET /api/income/repurchase-summary
 */
const getRepurchaseSummary = async (req, res, next) => {
  try {
    const userId = req.userId;
    
    const selfRepurchase = await IncomeTransaction.aggregate([
      {
        $match: {
          userId: userId,
          type: 'REPURCHASE_SELF',
          status: 'CREDITED'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$creditedAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const downlineRepurchase = await IncomeTransaction.aggregate([
      {
        $match: {
          userId: userId,
          type: 'REPURCHASE_DOWNLINE',
          status: 'CREDITED'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$creditedAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        self: {
          total: selfRepurchase.length > 0 ? selfRepurchase[0].total : 0,
          count: selfRepurchase.length > 0 ? selfRepurchase[0].count : 0
        },
        downline: {
          total: downlineRepurchase.length > 0 ? downlineRepurchase[0].total : 0,
          count: downlineRepurchase.length > 0 ? downlineRepurchase[0].count : 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============ RANK SALARY ============

/**
 * Get rank salary status
 * GET /api/income/rank-salary
 */
const getRankSalaryStatus = async (req, res, next) => {
  try {
    const userId = req.userId;
    const RankService = require('../services/rank.service');
    
    // Get user's current rank
    const rank = await RankService.getCurrentRank(userId);
    
    // Get user's TTO
    const tto = await RankService.getUserTTO(userId);
    
    // Calculate potential salary
    let potentialSalary = 0;
    let salaryPercentage = 0;
    let isEligible = false;
    
    if (rank && rank.salaryPercentage > 0) {
      salaryPercentage = rank.salaryPercentage;
      potentialSalary = tto * salaryPercentage;
      isEligible = true;
    }

    // Get salary history
    const salaryHistory = await IncomeTransaction.find({
      userId: userId,
      type: 'RANK_SALARY',
      status: 'CREDITED'
    })
    .sort({ createdAt: -1 })
    .limit(12);

    res.json({
      success: true,
      data: {
        currentRank: rank ? {
          name: rank.name,
          level: rank.level,
          salaryPercentage: rank.salaryPercentage,
          reward: rank.reward
        } : null,
        eligibility: {
          isEligible,
          salaryPercentage: salaryPercentage * 100,
          currentTTO: tto,
          potentialSalary: potentialSalary
        },
        history: salaryHistory.map(s => ({
          amount: s.creditedAmount,
          period: s.metadata?.period || s.createdAt.toISOString().slice(0, 7),
          rankName: s.metadata?.rankName || 'Rank Salary',
          percentage: s.metadata?.salaryPercentage || s.rate,
          ttoAmount: s.metadata?.ttoAmount || s.kbp,
          createdAt: s.createdAt
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Process rank salary for current user (Admin or Cron)
 * POST /api/income/process-rank-salary
 */
const processRankSalary = async (req, res, next) => {
  try {
    const { userId, period } = req.body;
    const adminId = req.userId;

    const targetUserId = userId || req.userId;
    
    const RankService = require('../services/rank.service');
    const result = await RankService.calculateAndCreditRankSalary(
      targetUserId,
      null,
      period
    );

    res.json({
      success: true,
      message: result.success ? 'Rank salary processed successfully' : 'No salary processed',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Process all rank salaries (Admin only)
 * POST /api/income/process-all-rank-salaries
 */
const processAllRankSalaries = async (req, res, next) => {
  try {
    const { period } = req.body;
    const RankService = require('../services/rank.service');
    
    const results = await RankService.processAllRankSalaries(period);

    res.json({
      success: true,
      message: `Processed ${results.length} rank salaries`,
      data: results
    });
  } catch (error) {
    next(error);
  }
};

// ============ EXPORT ============

module.exports = {
  processOrderIncome,
  getIncomeSummary,
  getIncomeTransactions,
  getIncomeByType,
  getCapStatus,
  getTodayIncome,
  getLeadershipStatus,
  getRepurchaseSummary,
  getRankSalaryStatus,        // ← ADD THIS
  processRankSalary,           // ← ADD THIS
  processAllRankSalaries      // ← ADD THIS
};