// server/src/controllers/wallet.controller.js
const WalletService = require('../services/wallet.service');
const SalaryService = require('../services/salary.service');
const SalaryLog = require('../models/SalaryLog');
const Wallet = require('../models/Wallet');

/**
 * Get Wallet Balance
 * GET /api/wallet/balance
 */
const getBalance = async (req, res, next) => {
  try {
    const userId = req.userId;
    const summary = await WalletService.getBalanceSummary(userId);

    res.json({
      success: true,
      data: { balance: summary }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Wallet with Transactions
 * GET /api/wallet
 */
const getWallet = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const walletData = await WalletService.getWallet(
      userId,
      parseInt(limit, 10),
      skip
    );

    res.json({
      success: true,
      data: walletData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Transaction History
 * GET /api/wallet/transactions
 */
const getTransactions = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { limit = 50, page = 1, type = 'ALL' } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const wallet = await WalletService.getOrCreateWallet(userId);
    const result = await wallet.getTransactionHistory(
      parseInt(limit, 10),
      skip
    );

    // Filter by type if specified
    let transactions = result.transactions;
    if (type !== 'ALL') {
      transactions = transactions.filter((t) => t.walletType === type);
    }

    res.json({
      success: true,
      data: {
        transactions,
        pagination: result.pagination
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Transfer to Repurchase Wallet
 * POST /api/wallet/transfer-to-repurchase
 */
const transferToRepurchase = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    // Check sufficient balance
    const hasBalance = await WalletService.hasSufficientBalance(
      userId,
      amount,
      'INCOME'
    );

    if (!hasBalance) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient income balance'
      });
    }

    const result = await WalletService.transferToRepurchase(userId, amount, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Transfer successful',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Transaction Statistics
 * GET /api/wallet/stats
 */
const getStats = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { days = 30 } = req.query;

    const stats = await WalletService.getTransactionStats(
      userId,
      parseInt(days, 10)
    );

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reconcile Wallet (Admin)
 * POST /api/wallet/reconcile/:userId
 */
const reconcile = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const adminId = req.userId;

    // Check if admin
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const result = await WalletService.reconcile(userId);

    res.json({
      success: true,
      data: {
        ...result,
        reconciledBy: adminId,
        reconciledAt: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Wallet Verification Status
 * GET /api/wallet/verification-status
 */
const getVerificationStatus = async (req, res, next) => {
  try {
    const userId = req.userId;
    const status = await WalletService.getVerificationStatus(userId);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Wallet (Admin)
 * PUT /api/admin/wallets/:userId/verify
 */
const verifyWallet = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { verified, remarks } = req.body;

    const wallet = await WalletService.verifyWallet(
      userId,
      verified,
      remarks
    );

    res.json({
      success: true,
      message: `Wallet ${verified ? 'verified' : 'unverified'} successfully`,
      data: { wallet }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin Adjustment (Add/Remove funds)
 * POST /api/admin/wallets/:userId/adjust
 */
const adminAdjustment = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { amount, reason } = req.body;

    if (!amount || amount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be non-zero'
      });
    }

    let result;
    if (amount > 0) {
      // Credit
      result = await WalletService.credit(
        userId,
        amount,
        'ADMIN_ADJUSTMENT',
        null,
        {
          description: `Admin adjustment: ${reason}`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          adjustedBy: req.userId
        }
      );
    } else {
      // Debit
      result = await WalletService.debit(
        userId,
        Math.abs(amount),
        'ADMIN_ADJUSTMENT',
        null,
        {
          description: `Admin adjustment: ${reason}`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          adjustedBy: req.userId
        }
      );
    }

    res.json({
      success: true,
      message: `Admin adjustment of ${amount} completed`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Salary Income Wallet Details & Live 50:50 Growth Qualification
 * GET /api/wallet/salary
 */
const getSalaryWalletDetails = async (req, res, next) => {
  try {
    const userId = req.userId;

    const [wallet, progress, history] = await Promise.all([
      Wallet.findOne({ userId }).lean(),
      SalaryService.getLiveSalaryProgress(userId),
      SalaryLog.find({ userId }).sort({ month: -1 }).limit(12).lean()
    ]);

    res.json({
      success: true,
      data: {
        salaryBalance: wallet?.salaryBalance || 0,
        totalSalaryEarned: wallet?.totalSalaryEarned || 0,
        qualificationStatus: {
          isGoldStarRank: progress.isGoldStarAchieved,
          currentTotalStars: progress.currentTotalStar,
          requiredRankStars: progress.requiredMinStar, // 200 Stars
          startingMonthStars: progress.startingTotalStar,
          monthlyGrowthTarget: progress.requiredTotalGrowth, // 10%
          leftGrowthAchieved: progress.leftGrowth,
          rightGrowthAchieved: progress.rightGrowth,
          requiredPerLegGrowth: progress.requiredPerLegGrowth, // 50:50 distribution
          is5050Balanced: progress.has5050Balance,
          is10PercentGrowthMet: progress.has10PercentGrowth,
          isQualifiedThisMonth: progress.isCurrentlyQualified,
          teamTurnoverThisMonth: progress.currentMonthTTO,
          projected1PercentSalary: progress.estimatedSalary
        },
        salaryHistory: history
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Process/Settle Monthly Salary (1% TTO Distribution)
 * POST /api/wallet/salary/process
 */
const processMonthlySalary = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { targetMonth } = req.body; // format "YYYY-MM"

    const result = await SalaryService.processMonthlySalaryPayout(userId, targetMonth);

    res.json({
      success: result.success,
      message: result.message || (result.qualified ? 'Monthly salary evaluated and credited successfully!' : 'Evaluation complete. Salary criteria not met for this month.'),
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBalance,
  getWallet,
  getTransactions,
  transferToRepurchase,
  getStats,
  reconcile,
  getVerificationStatus,
  verifyWallet,
  adminAdjustment,
  getSalaryWalletDetails,
  processMonthlySalary
};