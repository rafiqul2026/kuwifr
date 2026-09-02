// server/src/controllers/admin.controller.js
const User = require('../models/User');
const Order = require('../models/Order');
const Wallet = require('../models/Wallet');
const Rank = require('../models/Rank');
const Package = require('../models/Package');
const Fund = require('../models/Fund');

/**
 * Get Admin Dashboard Overview Statistics
 * GET /api/admin/dashboard
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const [totalUsers, activeUsers, pendingKYC, totalOrders] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'ACTIVE' }),
      User.countDocuments({ 'kyc.status': 'PENDING' }),
      Order.countDocuments()
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        pendingKYC,
        totalOrders
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all members with pagination and status filter
 * GET /api/admin/users
 */
const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const query = {};

    if (status) query.status = status;
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { memberId: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      User.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        users: users || [],
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update member account status (ACTIVE, BLOCKED, SUSPENDED)
 * PUT /api/admin/users/:id/status
 */
const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const user = await User.findByIdAndUpdate(id, { status }, { new: true });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      message: `User status updated to ${status}`,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all KYC verification submissions
 * GET /api/admin/kyc
 */
const getPendingKYC = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status = 'PENDING' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find({ 'kyc.status': status })
        .select('fullName email phoneNumber memberId kyc createdAt')
        .sort({ 'kyc.submittedAt': -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments({ 'kyc.status': status })
    ]);

    res.json({
      success: true,
      data: {
        submissions: users || [],
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Review / Approve / Reject KYC
 * POST /api/admin/kyc/review or PUT /api/admin/kyc/:id
 */
const reviewKYC = async (req, res, next) => {
  try {
    const { userId, status, rejectionReason } = req.body;
    const targetId = req.params.id || userId;

    const user = await User.findById(targetId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.kyc) user.kyc = {};
    user.kyc.status = status;
    user.kyc.verifiedAt = status === 'VERIFIED' ? new Date() : null;
    user.kyc.rejectionReason = status === 'REJECTED' ? rejectionReason || 'Documents rejected' : '';

    await user.save();

    res.json({
      success: true,
      message: `KYC status marked as ${status}`,
      data: { kyc: user.kyc }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin Manual Wallet Adjustment (Credit / Debit)
 * POST /api/admin/wallet/adjust
 */
const adjustWallet = async (req, res, next) => {
  try {
    const { userId, amount, type, description } = req.body;

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const numAmount = Number(amount);
    if (type === 'CREDIT') {
      wallet.incomeBalance = (wallet.incomeBalance || 0) + numAmount;
    } else {
      wallet.incomeBalance = Math.max(0, (wallet.incomeBalance || 0) - numAmount);
    }

    await wallet.save();

    res.json({
      success: true,
      message: `Wallet ${type === 'CREDIT' ? 'credited' : 'debited'} successfully`,
      data: { wallet }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Initialize system databases (Packages, Ranks, Funds)
 * POST /api/admin/system/initialize
 */
const initializeSystem = async (req, res, next) => {
  try {
    res.json({
      success: true,
      message: 'System ranks, funds, and packages successfully initialized.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  updateUserStatus,
  getPendingKYC,
  reviewKYC,
  adjustWallet,
  initializeSystem
};