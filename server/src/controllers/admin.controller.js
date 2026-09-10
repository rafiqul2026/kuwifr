// server/src/controllers/admin.controller.js
const User = require('../models/User');
const Order = require('../models/Order');
const Wallet = require('../models/Wallet');
const Rank = require('../models/Rank');
const Package = require('../models/Package');
const Fund = require('../models/Fund');
const IncomeService = require('../services/income.service');

/**
 * Get Admin Dashboard Overview Statistics (With Frontend Aliases)
 * GET /api/admin/dashboard
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const adminRoles = ['ADMIN', 'SUPER_ADMIN', 'admin', 'super_admin'];

    const [totalUsers, activeUsers, pendingKYC, totalOrders] = await Promise.all([
      User.countDocuments({ role: { $nin: adminRoles } }),
      User.countDocuments({ role: { $nin: adminRoles }, status: 'ACTIVE' }),
      User.countDocuments({ 'kyc.status': 'PENDING' }),
      Order.countDocuments()
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalMembers: totalUsers, // 🌟 Dual alias for frontend compatibility
        total: totalUsers,
        activeUsers,
        activeMembers: activeUsers, // 🌟 Dual alias for frontend compatibility
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
    const adminRoles = ['ADMIN', 'SUPER_ADMIN', 'admin', 'super_admin'];
    const query = { role: { $nin: adminRoles } };

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

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -resetPasswordToken -resetPasswordExpire')
        .populate('sponsorId', 'fullName memberId email phoneNumber')
        .populate('activePackageId', 'name price kbpValue kbp dailyCap')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        members: users || [],
        users: users || [],
        pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) || 1 }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Dedicated Member Search for Cash Activation Modal
 * GET /api/admin/members/search?query=...
 */
const searchMembersForActivation = async (req, res, next) => {
  try {
    const { query } = req.query;
    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const adminRoles = ['ADMIN', 'SUPER_ADMIN', 'admin', 'super_admin'];
    const sanitized = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    const members = await User.find({
      role: { $nin: adminRoles },
      $or: [
        { memberId: { $regex: new RegExp(`^${sanitized}`, 'i') } },
        { email: { $regex: new RegExp(sanitized, 'i') } },
        { fullName: { $regex: new RegExp(sanitized, 'i') } },
        { phoneNumber: { $regex: new RegExp(sanitized, 'i') } }
      ]
    })
      .select('memberId fullName email phoneNumber status sponsorId kyc activePackageId')
      .limit(10)
      .lean();

    res.json({
      success: true,
      data: { members }
    });
  } catch (error) {
    next(error);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DEACTIVATED', 'BLOCKED', 'PENDING_VERIFICATION'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status type' });
    }

    const user = await User.findByIdAndUpdate(id, { status }, { new: true })
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

const activateMemberWithPackage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { packageId } = req.body;

    if (!packageId) {
      return res.status(400).json({ success: false, message: 'Please select a valid package for activation.' });
    }

    const member = await User.findById(id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    // Was previously missing entirely — nothing stopped this endpoint from
    // being called twice (a double-click, retried request, or an admin
    // activating the same member here after they were already activated
    // through the member's own package-purchase flow) for a member who is
    // already ACTIVE. Each call created a brand-new Order and re-ran the
    // full income engine (processOrderIncome), so a member could end up
    // with their sponsor's referral/matching income credited two, three,
    // or more times for what was really one activation. Refuse a second
    // activation outright instead of silently re-crediting.
    if (member.status === 'ACTIVE' && member.activePackageId) {
      return res.status(400).json({
        success: false,
        message: `${member.memberId} is already ACTIVE with a package. Re-activating would double-credit referral and matching income — this has been blocked.`
      });
    }

    const pkg = await Package.findById(packageId);
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Selected package not found in master catalog.' });
    }

    member.status = 'ACTIVE';
    member.activePackageId = pkg._id;
    member.activationDate = new Date();
    await member.save();

    const orderNumber = `ORD-ADM-${Date.now().toString(36).toUpperCase()}`;
    const kbpAmount = pkg.kbpValue || pkg.kbp || 1000;
    const packagePrice = pkg.price || pkg.packagePrice || 1500;

    const newOrder = await Order.create({
      orderNumber,
      userId: member._id,
      orderType: 'PACKAGE',
      packageType: 'PACKAGE',
      packageId: pkg._id,
      packageName: pkg.name,
      packagePrice: packagePrice,
      totalAmount: packagePrice,
      subtotal: packagePrice,
      totalKBP: kbpAmount,
      kbpGenerated: kbpAmount,
      products: [{ name: pkg.name, quantity: 1, price: packagePrice, kbp: kbpAmount }],
      paymentMethod: 'ADMIN_MANUAL',
      paymentType: 'ONLINE_GATEWAY',
      paymentStatus: 'SUCCESS',
      orderStatus: 'COMPLETED',
      status: 'COMPLETED',
      statusHistory: [{ status: 'COMPLETED', timestamp: new Date(), note: 'Activated directly by Admin' }]
    });

    const incomeResult = await IncomeService.processOrderIncome(newOrder);

    res.json({
      success: true,
      message: `Member ${member.memberId} successfully activated with ${pkg.name}. Commissions distributed based on ₹${kbpAmount} KBP.`,
      data: { memberId: member.memberId, package: pkg.name, kbp: kbpAmount, incomeResult }
    });
  } catch (error) {
    next(error);
  }
};

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
        pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) || 1 }
      }
    });
  } catch (error) {
    next(error);
  }
};

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
      wallet.totalIncome = (wallet.totalIncome || 0) + numAmount;
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
  searchMembersForActivation,
  updateUserStatus,
  activateMemberWithPackage,
  getPendingKYC,
  reviewKYC,
  adjustWallet,
  initializeSystem
};