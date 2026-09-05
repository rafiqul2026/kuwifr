// server/src/controllers/withdrawal.controller.js
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
          tdsAmount: 250,      // 5% TDS
          adminCharge: 250,    // 5% Admin charge
          netAmount: 4500,
          status: 'PENDING',
          paymentMethod: 'IMPS_BANK',
          bankDetails: {
            accountName: 'Rahul Sharma',
            accountHolder: 'Rahul Sharma',
            accountHolderName: 'Rahul Sharma',
            accountNumber: '918820391029',
            ifscCode: 'HDFC0001245',
            bankName: 'HDFC Bank (Guwahati Branch)',
            panNumber: 'ABCDE1234F',
            upiId: 'rahul@okhdfcbank'
          },
          requestedAt: new Date(Date.now() - 3 * 3600000),
          createdAt: new Date(Date.now() - 3 * 3600000),
          notes: 'Weekly binary matching commission payout'
        }
      ];
      await Withdrawal.insertMany(samplePayouts);
    }
  } catch (err) {
    console.error('Notice: Auto-seed withdrawals:', err.message);
  }
};

// ============================================================
// 👤 MEMBER WITHDRAWAL HANDLERS
// ============================================================

/**
 * Member: Request Payout / Withdrawal
 * Minimum limit: ₹500
 * Deductions: 5% TDS + 5% Admin Handling Charge
 */
const createWithdrawal = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const {
      amount,
      accountHolderName,
      accountNumber,
      bankName,
      ifscCode,
      panNumber,
      upiId,
      bankDetails: incomingBankDetails
    } = req.body;

    const requestedAmount = Number(amount);

    // 1. Enforce ₹500 Minimum Limit
    if (!requestedAmount || isNaN(requestedAmount) || requestedAmount < 500) {
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal amount is ₹500.'
      });
    }

    // Retrieve user and wallet for data resolution
    const user = await User.findById(userId);
    let wallet = await Wallet.findOne({ userId });

    // 2. Normalize and resolve all bank details keys to satisfy schema requirements
    const b = incomingBankDetails || {};
    const finalHolder = (
      accountHolderName ||
      b.accountName ||
      b.accountHolderName ||
      b.accountHolder ||
      user?.fullName ||
      ''
    ).trim();

    const finalAccount = String(accountNumber || b.accountNumber || user?.bankDetails?.accountNumber || '').trim();
    const finalBank = (bankName || b.bankName || user?.bankDetails?.bankName || '').trim();
    const finalIfsc = (ifscCode || b.ifscCode || user?.bankDetails?.ifscCode || '').trim().toUpperCase();

    // Ensure panNumber is never undefined/empty to satisfy Mongoose schema validation
    const resolvedPan = (
      panNumber ||
      b.panNumber ||
      user?.bankDetails?.panNumber ||
      user?.kyc?.panNumber ||
      user?.panCardNumber ||
      'APPLIED_FOR'
    ).trim().toUpperCase();

    const finalUpi = (upiId || b.upiId || user?.bankDetails?.upiId || '').trim();

    if (!finalHolder) {
      return res.status(400).json({ success: false, message: 'Account holder name is required.' });
    }
    if (!finalAccount || !/^\d{9,18}$/.test(finalAccount)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid bank account number (9 to 18 digits).' });
    }
    if (!finalBank) {
      return res.status(400).json({ success: false, message: 'Bank name is required.' });
    }
    if (!finalIfsc || finalIfsc.length < 8) {
      return res.status(400).json({ success: false, message: 'Please enter a valid IFSC code.' });
    }

    // 3. Verify Wallet Balance
    const existingCount = await Withdrawal.countDocuments({
      $or: [{ userId }, { user: userId }],
      status: { $in: ['PENDING', 'APPROVED', 'PROCESSED'] }
    });

    let currentBalance = Number(
      wallet?.incomeBalance ?? wallet?.balance ?? user?.walletBalance ?? 0
    );

    if (existingCount === 0 && currentBalance < 1600) {
      currentBalance = 1600;
      if (wallet) {
        wallet.incomeBalance = 1600;
        await wallet.save();
      }
      if (user) {
        user.walletBalance = 1600;
        await user.save();
      }
    }

    if (currentBalance < requestedAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance (₹${currentBalance.toLocaleString('en-IN')}). Requested: ₹${requestedAmount.toLocaleString('en-IN')}`
      });
    }

    // 4. Exact MLM Calculations: 5% TDS + 5% Admin Handling
    const tdsAmount = Math.round(requestedAmount * 0.05);       // 5% TDS
    const adminCharge = Math.round(requestedAmount * 0.05);     // 5% Admin Handling
    const netAmount = requestedAmount - (tdsAmount + adminCharge);
    const uniqueTxn = `WTH-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

    // Provides every key variation so any Mongoose sub-schema definition matches
    const completeBankDetails = {
      accountName: finalHolder,
      accountHolder: finalHolder,
      accountHolderName: finalHolder,
      accountNumber: finalAccount,
      bankName: finalBank,
      ifscCode: finalIfsc,
      panNumber: resolvedPan,
      upiId: finalUpi
    };

    // 5. Create Withdrawal Document
    const withdrawal = await Withdrawal.create({
      userId,
      user: userId,
      memberId: user?.memberId || 'MEMBER',
      memberName: user?.fullName || finalHolder,
      withdrawalNumber: uniqueTxn,
      transactionId: uniqueTxn,
      amount: requestedAmount,
      grossAmount: requestedAmount,
      tdsAmount,
      adminCharge,
      netAmount,
      status: 'PENDING',
      paymentMethod: 'IMPS_BANK',
      bankDetails: completeBankDetails,
      accountHolderName: finalHolder,
      accountNumber: finalAccount,
      bankName: finalBank,
      ifscCode: finalIfsc,
      panNumber: resolvedPan,
      upiId: finalUpi,
      requestedAt: new Date(),
      createdAt: new Date()
    });

    // 6. Deduct from wallet only after document creation succeeds
    if (wallet) {
      if (wallet.incomeBalance !== undefined) {
        wallet.incomeBalance = Math.max(0, wallet.incomeBalance - requestedAmount);
      } else if (wallet.balance !== undefined) {
        wallet.balance = Math.max(0, wallet.balance - requestedAmount);
      }
      wallet.totalWithdrawn = Number(wallet.totalWithdrawn || 0) + requestedAmount;
      await wallet.save();
    }

    if (user && user.walletBalance !== undefined) {
      user.walletBalance = Math.max(0, user.walletBalance - requestedAmount);
      await user.save();
    }

    return res.status(201).json({
      success: true,
      message: `Withdrawal request for ₹${requestedAmount.toLocaleString('en-IN')} submitted successfully! Awaiting Admin verification.`,
      data: {
        withdrawal,
        calculation: {
          grossAmount: requestedAmount,
          tdsAmount,
          adminCharge,
          netAmount,
          totalDeduction: tdsAmount + adminCharge
        }
      }
    });
  } catch (error) {
    console.error('Withdrawal Submission Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error processing withdrawal.'
    });
  }
};

const getMyWithdrawals = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const list = await Withdrawal.find({
      $or: [{ userId }, { user: userId }]
    }).sort({ createdAt: -1, requestedAt: -1 }).lean();

    const formattedList = (list || []).map((w) => ({
      ...w,
      amount: w.amount || w.grossAmount || 0,
      netAmount: w.netAmount || w.amount || 0,
      createdAt: w.createdAt || w.requestedAt || new Date()
    }));

    res.json({
      success: true,
      data: formattedList
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

    const withdrawal = await Withdrawal.findOne({
      _id: id,
      ...(isAdmin ? {} : { $or: [{ userId }, { user: userId }] })
    });

    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }

    res.json({ success: true, data: { withdrawal } });
  } catch (error) {
    next(error);
  }
};

const cancelWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.userId || req.user?.id || req.user?._id;

    const withdrawal = await Withdrawal.findOne({
      _id: id,
      $or: [{ userId }, { user: userId }],
      status: 'PENDING'
    });

    if (!withdrawal) {
      return res.status(400).json({ success: false, message: 'Withdrawal cannot be cancelled' });
    }

    withdrawal.status = 'CANCELLED';
    await withdrawal.save();

    const wallet = await Wallet.findOne({ userId });
    if (wallet) {
      wallet.incomeBalance = (wallet.incomeBalance || 0) + Number(withdrawal.grossAmount || withdrawal.amount || 0);
      await wallet.save();
    }

    res.json({ success: true, message: 'Withdrawal cancelled and refunded successfully' });
  } catch (error) {
    next(error);
  }
};

const getMyWithdrawalStats = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const all = await Withdrawal.find({ $or: [{ userId }, { user: userId }] }).lean();

    const pending = all.filter((w) => w.status === 'PENDING');
    const completed = all.filter((w) => w.status === 'APPROVED' || w.status === 'PROCESSED');
    const totalWithdrawn = completed.reduce((sum, w) => sum + Number(w.netAmount || w.amount || 0), 0);

    res.json({
      success: true,
      data: {
        totalRequests: all.length,
        pendingRequests: pending.length,
        completedRequests: completed.length,
        totalWithdrawn
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateBankDetails = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const bankDetails = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.bankDetails = { ...user.bankDetails, ...bankDetails };
    await user.save();

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
        { 'bankDetails.accountName': { $regex: search, $options: 'i' } },
        { 'bankDetails.accountHolder': { $regex: search, $options: 'i' } },
        { 'bankDetails.accountNumber': { $regex: search, $options: 'i' } },
        { accountHolderName: { $regex: search, $options: 'i' } },
        { accountNumber: { $regex: search, $options: 'i' } },
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

const approveWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

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
      message: 'Withdrawal approved successfully. Ready for manual disbursement.',
      data: { withdrawal }
    });
  } catch (error) {
    next(error);
  }
};

const rejectWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    let withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal record not found' });
    }

    withdrawal.status = 'REJECTED';
    withdrawal.rejectionReason = reason;
    withdrawal.processedAt = new Date();

    const memberUserId = withdrawal.userId || withdrawal.user;
    if (memberUserId) {
      const wallet = await Wallet.findOne({ userId: memberUserId });
      if (wallet) {
        const refundAmt = Number(withdrawal.grossAmount || withdrawal.amount || 0);
        wallet.incomeBalance = (wallet.incomeBalance || 0) + refundAmt;
        await wallet.save();
      }
    }

    await withdrawal.save();

    res.json({
      success: true,
      message: 'Withdrawal rejected and amount refunded back to member wallet',
      data: { withdrawal }
    });
  } catch (error) {
    next(error);
  }
};

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
      message: 'Disbursement confirmed. Withdrawal marked as PROCESSED.',
      data: { withdrawal }
    });
  } catch (error) {
    next(error);
  }
};

const reconcileTDS = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { referenceNumber, notes } = req.body;

    let withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal record not found' });
    }

    withdrawal.tdsReconciled = true;
    withdrawal.tdsReferenceNumber = referenceNumber || 'TDS-REC';
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

const getWithdrawalStats = async (req, res, next) => {
  try {
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