const WithdrawalService = require('../services/withdrawal.service');
const Withdrawal = require('../models/Withdrawal');

// ============ MEMBER ROUTES ============

/**
 * Create withdrawal request
 * POST /api/withdrawals
 */
const createWithdrawal = async (req, res, next) => {
  try {
    const { amount, bankDetails } = req.body;
    const userId = req.userId;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    const withdrawal = await WithdrawalService.createWithdrawal(
      userId,
      amount,
      bankDetails,
      req.ip,
      req.headers['user-agent']
    );

    res.status(201).json({
      success: true,
      message: 'Withdrawal request created successfully',
      data: {
        withdrawal,
        calculation: {
          grossAmount: withdrawal.grossAmount,
          adminCharge: withdrawal.adminCharge,
          tdsAmount: withdrawal.tdsAmount,
          netAmount: withdrawal.netAmount,
          totalDeduction: withdrawal.adminCharge + withdrawal.tdsAmount
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get my withdrawals
 * GET /api/withdrawals
 */
const getMyWithdrawals = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { status, limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const result = await WithdrawalService.getUserWithdrawals(
      userId,
      status,
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
 * Get withdrawal by ID
 * GET /api/withdrawals/:id
 */
const getWithdrawalById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';

    const withdrawal = await WithdrawalService.getWithdrawalById(
      id,
      userId,
      isAdmin
    );

    res.json({
      success: true,
      data: { withdrawal }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel withdrawal
 * PUT /api/withdrawals/:id/cancel
 */
const cancelWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const withdrawal = await WithdrawalService.cancelWithdrawal(id, userId);

    res.json({
      success: true,
      message: 'Withdrawal cancelled successfully',
      data: { withdrawal }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get withdrawal stats for user
 * GET /api/withdrawals/stats
 */
const getMyWithdrawalStats = async (req, res, next) => {
  try {
    const userId = req.userId;
    const stats = await WithdrawalService.getUserWithdrawalStats(userId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update bank details
 * PUT /api/withdrawals/bank-details
 */
const updateBankDetails = async (req, res, next) => {
  try {
    const userId = req.userId;
    const bankDetails = req.body;

    const user = await WithdrawalService.updateBankDetails(userId, bankDetails);

    res.json({
      success: true,
      message: 'Bank details updated successfully',
      data: { bankDetails: user.bankDetails }
    });
  } catch (error) {
    next(error);
  }
};

// ============ ADMIN ROUTES ============

/**
 * Get pending withdrawals (admin)
 * GET /api/admin/withdrawals/pending
 */
const getPendingWithdrawals = async (req, res, next) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const result = await WithdrawalService.getPendingWithdrawals(
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
 * Approve withdrawal (admin)
 * PUT /api/admin/withdrawals/:id/approve
 */
const approveWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const adminId = req.userId;

    const withdrawal = await WithdrawalService.approveWithdrawal(
      id,
      adminId,
      notes
    );

    res.json({
      success: true,
      message: 'Withdrawal approved successfully',
      data: { withdrawal }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject withdrawal (admin)
 * PUT /api/admin/withdrawals/:id/reject
 */
const rejectWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.userId;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const withdrawal = await WithdrawalService.rejectWithdrawal(
      id,
      adminId,
      reason
    );

    res.json({
      success: true,
      message: 'Withdrawal rejected',
      data: { withdrawal }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Process withdrawal (admin)
 * PUT /api/admin/withdrawals/:id/process
 */
const processWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { transactionId, utrNumber, paymentMethod } = req.body;
    const adminId = req.userId;

    const result = await WithdrawalService.processWithdrawal(
      id,
      adminId,
      { transactionId, utrNumber, paymentMethod }
    );

    res.json({
      success: true,
      message: 'Withdrawal processed successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reconcile TDS (admin)
 * PUT /api/admin/withdrawals/:id/reconcile-tds
 */
const reconcileTDS = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { referenceNumber, notes } = req.body;
    const adminId = req.userId;

    if (!referenceNumber) {
      return res.status(400).json({
        success: false,
        message: 'Reference number is required'
      });
    }

    const withdrawal = await WithdrawalService.reconcileTDS(
      id,
      adminId,
      referenceNumber,
      notes
    );

    res.json({
      success: true,
      message: 'TDS reconciled successfully',
      data: { withdrawal }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refund TDS (admin)
 * PUT /api/admin/withdrawals/:id/refund-tds
 */
const refundTDS = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { refundAmount, notes } = req.body;
    const adminId = req.userId;

    const result = await WithdrawalService.refundTDS(
      id,
      adminId,
      refundAmount,
      notes
    );

    res.json({
      success: true,
      message: 'TDS refunded successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get withdrawal stats (admin)
 * GET /api/admin/withdrawals/stats
 */
const getWithdrawalStats = async (req, res, next) => {
  try {
    const stats = await WithdrawalService.getWithdrawalStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  // Member routes
  createWithdrawal,
  getMyWithdrawals,
  getWithdrawalById,
  cancelWithdrawal,
  getMyWithdrawalStats,
  updateBankDetails,

  // Admin routes
  getPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  processWithdrawal,
  reconcileTDS,
  refundTDS,
  getWithdrawalStats
};