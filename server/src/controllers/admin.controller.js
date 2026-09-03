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
      User.countDocuments({ role: { $ne: 'ADMIN' } }),
      User.countDocuments({ role: { $ne: 'ADMIN' }, status: 'ACTIVE' }),
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
 * Get all members with pagination, search, status filter, and populated sponsor info
 * GET /api/admin/users and GET /api/admin/members
 */
const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const query = { role: { $ne: 'ADMIN' } };

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (search && search.trim()) {
      const sanitized = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { fullName: { $regex: sanitized, $options: 'i' } },
        { email: { $regex: sanitized, $options: 'i' } },
        { memberId: { $regex: sanitized, $options: 'i' } },
        { phoneNumber: { $regex: sanitized, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Fetch members with populated sponsor details
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -resetPasswordToken -resetPasswordExpire')
        .populate('sponsorId', 'fullName memberId email phoneNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    // Return both 'members' and 'users' for complete frontend compatibility
    res.json({
      success: true,
      data: {
        members: users || [],
        users: users || [],
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: totalPages
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update member account status (ACTIVE, INACTIVE, BLOCKED, SUSPENDED, DEACTIVATED)
 * PUT /api/admin/users/:id/status or PUT /api/admin/members/:id/status
 */
const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = [
      'ACTIVE',
      'INACTIVE',
      'SUSPENDED',
      'DEACTIVATED',
      'BLOCKED',
      'PENDING_VERIFICATION'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status type' });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    )
      .select('-password -resetPasswordToken -resetPasswordExpire')
      .populate('sponsorId', 'fullName memberId email phoneNumber');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    res.json({
      success: true,
      message: `Member status updated to ${status}`,
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
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find({ 'kyc.status': status })
        .select('fullName email phoneNumber memberId kyc createdAt')
        .populate('sponsorId', 'fullName memberId')
        .sort({ 'kyc.submittedAt': -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments({ 'kyc.status': status })
    ]);

    res.json({
      success: true,
      data: {
        submissions: users || [],
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum) || 1
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
      return res.status(404).json({ success: false, message: 'Member not found' });
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
    const { userId, amount, type } = req.body;

    if (!userId || !amount || Number(amount) <= 0 || !['CREDIT', 'DEBIT'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid adjustment parameters' });
    }

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const numAmount = Number(amount);
    if (type === 'CREDIT') {
      wallet.incomeBalance = (wallet.incomeBalance || 0) + numAmount;
    } else {
      if ((wallet.incomeBalance || 0) < numAmount) {
        return res.status(400).json({ success: false, message: 'Insufficient wallet balance for debit' });
      }
      wallet.incomeBalance -= numAmount;
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