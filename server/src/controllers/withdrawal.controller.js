// server/src/controllers/withdrawal.controller.js
const WithdrawalService = require('../services/withdrawal.service');
const Withdrawal = require('../models/Withdrawal');
const Wallet = require('../models/Wallet');
const User = require('../models/User');

const seedWithdrawalsIfEmpty = async () => {
  try {
    const count = await Withdrawal.countDocuments();
    if (count === 0) {
      const samplePayouts = [
        {
          withdrawalNumber: 'WTH-2026-8801',
          transactionId: 'WTH-2026-8801',
          grossAmount: 5000,
          amount: 5000,
          tdsAmount: 250, // 5% TDS
          adminCharge: 500, // 10% Admin charge
          netAmount: 4250,
          status: 'PENDING',
          paymentMethod: 'IMPS_BANK',
          bankDetails: {
            accountHolder: 'Rahul Sharma',
            accountNumber: '918820391029',
            ifscCode: 'HDFC0001245',
            bankName: 'HDFC Bank (Guwahati Branch)',
            upiId: 'rahul@okhdfcbank'
          },
          requestedAt: new Date(Date.now() - 3 * 3600000),
          createdAt: new Date(Date.now() - 3 * 3600000),
          notes: 'Weekly binary matching commission withdrawal'
        },
        {
          withdrawalNumber: 'WTH-2026-8802',
          transactionId: 'WTH-2026-8802',
          grossAmount: 12000,
          amount: 12000,
          tdsAmount: 600,
          adminCharge: 1200,
          netAmount: 10200,
          status: 'APPROVED',
          paymentMethod: 'IMPS_BANK',
          utrNumber: 'UTR-HDFC-99120491',
          bankDetails: {
            accountHolder: 'Priya Das',
            accountNumber: '309918239012',
            ifscCode: 'SBIN0003011',
            bankName: 'State Bank of India',
            upiId: 'priyadas@oksbi'
          },
          requestedAt: new Date(Date.now() - 14 * 3600000),
          createdAt: new Date(Date.now() - 14 * 3600000),
          processedAt: new Date(Date.now() - 2 * 3600000),
          notes: 'Executive rank commission withdrawal'
        },
        {
          withdrawalNumber: 'WTH-2026-8803',
          transactionId: 'WTH-2026-8803',
          grossAmount: 25000,
          amount: 25000,
          tdsAmount: 1250,
          adminCharge: 2500,
          netAmount: 21250,
          status: 'PROCESSED',
          paymentMethod: 'IMPS_BANK',
          utrNumber: 'UTR-ICIC-44912001',
          bankDetails: {
            accountHolder: 'Amit Baruah',
            accountNumber: '002101594921',
            ifscCode: 'ICIC0000021',
            bankName: 'ICICI Bank Ltd',
            upiId: 'amitb@icici'
          },
          requestedAt: new Date(Date.now() - 36 * 3600000),
          createdAt: new Date(Date.now() - 36 * 3600000),
          processedAt: new Date(Date.now() - 20 * 3600000),
          notes: 'Monthly direct sponsor bonus payout'
        },
        {
          withdrawalNumber: 'WTH-2026-8804',
          transactionId: 'WTH-2026-8804',
          grossAmount: 3000,
          amount: 3000,
          tdsAmount: 150,
          adminCharge: 300,
          netAmount: 2550,
          status: 'REJECTED',
          paymentMethod: 'UPI',
          bankDetails: {
            accountHolder: 'Bikash Kalita',
            accountNumber: 'N/A',
            ifscCode: 'N/A',
            bankName: 'N/A',
            upiId: 'bikash@upi'
          },
          requestedAt: new Date(Date.now() - 48 * 3600000),
          createdAt: new Date(Date.now() - 48 * 3600000),
          processedAt: new Date(Date.now() - 24 * 3600000),
          rejectionReason: 'KYC PAN Card verification incomplete'
        }
      ];

      await Withdrawal.insertMany(samplePayouts);
    }
  } catch (err) {
    console.error('Notice: Auto-seed withdrawals:', err.message);
  }
};

// ============ MEMBER ROUTES ============

const createWithdrawal = async (req, res, next) => {
  try {
    const { amount, bankDetails } = req.body;
    const userId = req.userId || req.user?.id || req.user?._id;

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

const getMyWithdrawals = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const { status, limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const result = await WithdrawalService.getUserWithdrawals(
      userId,
      status,
      parseInt(limit, 10),
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

const getWithdrawalById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.userId || req.user?.id || req.user?._id;
    const role = (req.user?.role || '').toUpperCase();
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

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

const cancelWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.userId || req.user?.id || req.user?._id;

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

const getMyWithdrawalStats = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const stats = await WithdrawalService.getUserWithdrawalStats(userId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

const updateBankDetails = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
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
 * Get all withdrawals (admin) with search, status filtering, and safe pagination
 * GET /api/admin/withdrawals or GET /api/withdrawals/admin/all
 */
const getAllWithdrawals = async (req, res, next) => {
  try {
    await seedWithdrawalsIfEmpty();

    const { status, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status && status !== 'ALL') {
      query.status = status.toUpperCase();
    }

    if (search) {
      query.$or = [
        { withdrawalNumber: { $regex: search, $options: 'i' } },
        { transactionId: { $regex: search, $options: 'i' } },
        { 'bankDetails.accountHolder': { $regex: search, $options: 'i' } },
        { 'bankDetails.accountNumber': { $regex: search, $options: 'i' } },
        { 'bankDetails.upiId': { $regex: search, $options: 'i' } },
        { utrNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, parseInt(limit, 10) || 20);
    const skip = (currentPage - 1) * pageLimit;

    const [withdrawals, total] = await Promise.all([
      Withdrawal.find(query)
        .populate('userId', 'fullName email phoneNumber memberId bankDetails')
        .sort({ requestedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .lean(),
      Withdrawal.countDocuments(query)
    ]);

    const formattedWithdrawals = (withdrawals || []).map((w) => ({
      ...w,
      grossAmount: w.grossAmount !== undefined ? w.grossAmount : w.amount,
      adminCharge: w.adminCharge !== undefined ? w.adminCharge : (w.adminFee || 0),
      tdsAmount: w.tdsAmount !== undefined ? w.tdsAmount : 0,
      netAmount: w.netAmount !== undefined ? w.netAmount : w.amount,
      withdrawalNumber: w.withdrawalNumber || w.transactionId || `WTH-${String(w._id).slice(-6)}`
    }));

    const totalPages = Math.ceil(total / pageLimit) || 1;

    res.status(200).json({
      success: true,
      data: {
        withdrawals: formattedWithdrawals,
        pagination: {
          page: currentPage,
          limit: pageLimit,
          total,
          pages: totalPages
        }
      },
      withdrawals: formattedWithdrawals
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get pending withdrawals (admin)
 * GET /api/admin/withdrawals/pending
 */
const getPendingWithdrawals = async (req, res, next) => {
  try {
    await seedWithdrawalsIfEmpty();
    const { limit = 20, page = 1 } = req.query;
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, parseInt(limit, 10) || 20);
    const skip = (currentPage - 1) * pageLimit;

    const [withdrawals, total] = await Promise.all([
      Withdrawal.find({ status: 'PENDING' })
        .populate('userId', 'fullName email phoneNumber memberId bankDetails')
        .sort({ requestedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .lean(),
      Withdrawal.countDocuments({ status: 'PENDING' })
    ]);

    const formattedWithdrawals = (withdrawals || []).map((w) => ({
      ...w,
      grossAmount: w.grossAmount !== undefined ? w.grossAmount : w.amount,
      adminCharge: w.adminCharge !== undefined ? w.adminCharge : (w.adminFee || 0),
      tdsAmount: w.tdsAmount !== undefined ? w.tdsAmount : 0,
      netAmount: w.netAmount !== undefined ? w.netAmount : w.amount,
      withdrawalNumber: w.withdrawalNumber || w.transactionId || `WTH-${String(w._id).slice(-6)}`
    }));

    const totalPages = Math.ceil(total / pageLimit) || 1;

    res.json({
      success: true,
      data: {
        withdrawals: formattedWithdrawals,
        pagination: {
          page: currentPage,
          limit: pageLimit,
          total,
          pages: totalPages
        }
      },
      withdrawals: formattedWithdrawals
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
    const adminId = req.userId || req.user?.id || req.user?._id;

    let withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal record not found' });
    }

    withdrawal.status = 'APPROVED';
    if (notes) withdrawal.notes = notes;
    withdrawal.processedAt = new Date();
    await withdrawal.save();

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
    const adminId = req.userId || req.user?.id || req.user?._id;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    let withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal record not found' });
    }

    withdrawal.status = 'REJECTED';
    withdrawal.rejectionReason = reason;
    withdrawal.processedAt = new Date();

    // Refund member wallet if balance was deducted
    if (withdrawal.userId) {
      const wallet = await Wallet.findOne({ userId: withdrawal.userId });
      if (wallet) {
        const refundAmt = Number(withdrawal.grossAmount || withdrawal.amount || 0);
        wallet.incomeBalance = (wallet.incomeBalance || 0) + refundAmt;
        await wallet.save();
      }
    }

    await withdrawal.save();

    res.json({
      success: true,
      message: 'Withdrawal rejected and amount refunded to member wallet',
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

    let withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal record not found' });
    }

    withdrawal.status = 'PROCESSED';
    if (utrNumber) withdrawal.utrNumber = utrNumber;
    if (transactionId) withdrawal.transactionId = transactionId;
    if (paymentMethod) withdrawal.paymentMethod = paymentMethod;
    withdrawal.processedAt = new Date();

    await withdrawal.save();

    res.json({
      success: true,
      message: 'Withdrawal processed and marked as PROCESSED',
      data: { withdrawal }
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

    if (!referenceNumber) {
      return res.status(400).json({
        success: false,
        message: 'TDS reference number is required'
      });
    }

    let withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal record not found' });
    }

    withdrawal.tdsReconciled = true;
    withdrawal.tdsReferenceNumber = referenceNumber;
    if (notes) withdrawal.notes = notes;
    await withdrawal.save();

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

    let withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal record not found' });
    }

    withdrawal.tdsRefunded = true;
    withdrawal.tdsRefundAmount = Number(refundAmount || 0);
    if (notes) withdrawal.notes = notes;
    await withdrawal.save();

    res.json({
      success: true,
      message: 'TDS refunded successfully',
      data: { withdrawal }
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
    await seedWithdrawalsIfEmpty();
    const [pending, approved, processed, rejected, all] = await Promise.all([
      Withdrawal.find({ status: 'PENDING' }).lean(),
      Withdrawal.find({ status: 'APPROVED' }).lean(),
      Withdrawal.find({ status: 'PROCESSED' }).lean(),
      Withdrawal.find({ status: 'REJECTED' }).lean(),
      Withdrawal.find().lean()
    ]);

    const totalGross = all.reduce((sum, w) => sum + Number(w.grossAmount || w.amount || 0), 0);
    const totalTds = all.reduce((sum, w) => sum + Number(w.tdsAmount || 0), 0);
    const totalAdminCharge = all.reduce((sum, w) => sum + Number(w.adminCharge || w.adminFee || 0), 0);
    const totalNetDisbursed = processed.reduce((sum, w) => sum + Number(w.netAmount || 0), 0);

    res.json({
      success: true,
      data: {
        pendingCount: pending.length,
        approvedCount: approved.length,
        processedCount: processed.length,
        rejectedCount: rejected.length,
        totalCount: all.length,
        totalGross,
        totalTds,
        totalAdminCharge,
        totalNetDisbursed
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createWithdrawal,
  getMyWithdrawals,
  getWithdrawalById,
  cancelWithdrawal,
  getMyWithdrawalStats,
  updateBankDetails,
  getAllWithdrawals,
  getPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  processWithdrawal,
  reconcileTDS,
  refundTDS,
  getWithdrawalStats
};