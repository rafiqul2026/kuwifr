// server/src/controllers/franchise.controller.js
const Franchise = require('../models/Franchise');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Withdrawal = require('../models/Withdrawal');
const IncomeTransaction = require('../models/IncomeTransaction');
const Notification = require('../models/Notification');
const DownlineService = require('../services/downline.service');
const SettingsService = require('../services/settings.service');

// ============ MEMBER-SIDE ============

/**
 * POST /api/franchise/apply
 * A member applies to become an official Franchise. Re-applying after a
 * REJECTED decision is allowed (resets to PENDING); applying again while
 * already PENDING/APPROVED just returns the current record.
 */
const applyForFranchise = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const { note } = req.body;

    let franchise = await Franchise.findOne({ userId });

    if (franchise && ['PENDING', 'APPROVED'].includes(franchise.status)) {
      return res.status(200).json({
        success: true,
        message: `You already have a ${franchise.status === 'PENDING' ? 'pending' : 'approved'} franchise application.`,
        data: { franchise }
      });
    }

    if (franchise) {
      franchise.status = 'PENDING';
      franchise.applicationNote = note || '';
      franchise.appliedAt = new Date();
      franchise.decidedAt = null;
      franchise.decidedBy = null;
      franchise.rejectionReason = '';
      await franchise.save();
    } else {
      franchise = await Franchise.create({ userId, applicationNote: note || '' });
    }

    res.status(201).json({
      success: true,
      message: 'Franchise application submitted. You will be notified once the admin reviews it.',
      data: { franchise }
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/franchise/status */
const getMyFranchiseStatus = async (req, res, next) => {
  try {
    const franchise = await Franchise.findOne({ userId: req.userId || req.user?.id || req.user?._id }).lean();
    res.json({ success: true, data: { franchise: franchise || null } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/franchise/dashboard
 * APPROVED franchises only — territory stats + franchise-specific income.
 * Franchise income is credited into the member's normal income wallet (see
 * income.service.js#processFranchiseOverrides / wallet.service.js), so the
 * "withdrawal" side of this is the member's regular Withdrawals flow; this
 * endpoint surfaces the franchise-attributable slice of it for visibility.
 */
const getMyFranchiseDashboard = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const franchise = await Franchise.findOne({ userId, status: 'APPROVED' }).lean();
    if (!franchise) {
      return res.status(403).json({ success: false, message: 'You are not an approved franchise.' });
    }

    const [territory, wallet, rates] = await Promise.all([
      DownlineService.getFullDownline(userId),
      Wallet.findOne({ userId }).lean(),
      SettingsService.getFranchise()
    ]);

    const territoryActive = territory.filter((m) => String(m.status).toUpperCase() === 'ACTIVE').length;
    const territoryKbp = territory.reduce((sum, m) => sum + (Number(m.totalKBP) || 0), 0);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayAgg, totalAgg] = await Promise.all([
      IncomeTransaction.aggregate([
        { $match: { userId: franchise.userId, type: { $in: ['FRANCHISE_ACTIVATION_OVERRIDE', 'FRANCHISE_KBP_OVERRIDE'] }, status: 'CREDITED', createdAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: '$creditedAmount' } } }
      ]),
      IncomeTransaction.aggregate([
        { $match: { userId: franchise.userId, type: { $in: ['FRANCHISE_ACTIVATION_OVERRIDE', 'FRANCHISE_KBP_OVERRIDE'] }, status: 'CREDITED' } },
        { $group: { _id: null, total: { $sum: '$creditedAmount' } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        franchise,
        territoryStats: {
          totalMembers: territory.length,
          activeMembers: territoryActive,
          totalKbp: territoryKbp
        },
        franchiseIncome: {
          today: todayAgg[0]?.total || 0,
          total: totalAgg[0]?.total || wallet?.franchiseIncome || 0,
          lifetimeWalletTotal: wallet?.franchiseIncome || 0
        },
        rates
      }
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/franchise/territory — paginated read-only list of the members in this franchise's territory. */
const getMyFranchiseTerritory = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const franchise = await Franchise.findOne({ userId, status: 'APPROVED' }).lean();
    if (!franchise) {
      return res.status(403).json({ success: false, message: 'You are not an approved franchise.' });
    }

    const { search, page = 1, limit = 25 } = req.query;
    let territory = await DownlineService.getFullDownline(userId);

    if (search && search.trim()) {
      const re = new RegExp(search.trim(), 'i');
      territory = territory.filter((m) => re.test(m.fullName || '') || re.test(m.memberId || '') || re.test(m.email || ''));
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, parseInt(limit, 10) || 25);
    const total = territory.length;
    const paged = territory
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice((currentPage - 1) * pageLimit, currentPage * pageLimit);

    res.json({
      success: true,
      data: {
        members: paged,
        pagination: { total, page: currentPage, limit: pageLimit, pages: Math.ceil(total / pageLimit) || 1 }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============ ADMIN-SIDE ============

/** GET /api/admin/franchise?status=PENDING|APPROVED|REJECTED|ALL */
const getFranchiseApplicationsAdmin = async (req, res, next) => {
  try {
    const { status = 'ALL', search, page = 1, limit = 20 } = req.query;
    const match = {};
    if (status && status !== 'ALL') match.status = status;

    let userIdFilter = null;
    if (search && search.trim()) {
      const re = new RegExp(search.trim(), 'i');
      const matchingUsers = await User.find({ $or: [{ fullName: re }, { memberId: re }, { email: re }] }).select('_id').lean();
      userIdFilter = matchingUsers.map((u) => u._id);
      match.userId = { $in: userIdFilter };
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, parseInt(limit, 10) || 20);

    const [total, applications] = await Promise.all([
      Franchise.countDocuments(match),
      Franchise.find(match)
        .populate('userId', 'fullName memberId email phoneNumber status sponsorId')
        .populate('decidedBy', 'fullName memberId')
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * pageLimit)
        .limit(pageLimit)
        .lean()
    ]);

    res.json({
      success: true,
      data: { applications, pagination: { total, page: currentPage, limit: pageLimit, pages: Math.ceil(total / pageLimit) || 1 } }
    });
  } catch (error) {
    next(error);
  }
};

/** POST /api/admin/franchise/:id/approve */
const approveFranchiseAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const franchise = await Franchise.findById(id);
    if (!franchise) {
      return res.status(404).json({ success: false, message: 'Franchise application not found.' });
    }

    const rates = await SettingsService.getFranchise();
    franchise.status = 'APPROVED';
    franchise.decidedAt = new Date();
    franchise.decidedBy = req.userId || req.user?.id || req.user?._id;
    franchise.rejectionReason = '';
    franchise.approvedRatesSnapshot = { kspRate: rates.kspRate, kbpLifetimeRate: rates.kbpLifetimeRate };
    await franchise.save();

    await Notification.create({
      userId: franchise.userId,
      type: 'ACHIEVEMENT',
      priority: 'HIGH',
      title: 'You are now an official Franchise! 🎉',
      message: 'Your Franchise application has been approved. Your Franchise dashboard is now live under "Franchise" in your sidebar.',
      icon: '🏢',
      color: '#16a34a',
      action: '/member/franchise',
      actionLabel: 'View Franchise Dashboard'
    });

    res.json({ success: true, message: 'Franchise application approved.', data: { franchise } });
  } catch (error) {
    next(error);
  }
};

/** POST /api/admin/franchise/:id/reject  { reason } */
const rejectFranchiseAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const franchise = await Franchise.findById(id);
    if (!franchise) {
      return res.status(404).json({ success: false, message: 'Franchise application not found.' });
    }

    franchise.status = 'REJECTED';
    franchise.decidedAt = new Date();
    franchise.decidedBy = req.userId || req.user?.id || req.user?._id;
    franchise.rejectionReason = reason || 'Not specified.';
    await franchise.save();

    await Notification.create({
      userId: franchise.userId,
      type: 'ADMIN',
      priority: 'MEDIUM',
      title: 'Franchise application update',
      message: `Your Franchise application was not approved.${reason ? ` Reason: ${reason}` : ''}`,
      icon: '📋',
      color: '#dc2626'
    });

    res.json({ success: true, message: 'Franchise application rejected.', data: { franchise } });
  } catch (error) {
    next(error);
  }
};

/** POST /api/admin/franchise/:id/revoke — admin can pull back an already-approved franchise. */
const revokeFranchiseAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const franchise = await Franchise.findById(id);
    if (!franchise) {
      return res.status(404).json({ success: false, message: 'Franchise application not found.' });
    }

    franchise.status = 'REVOKED';
    franchise.decidedAt = new Date();
    franchise.decidedBy = req.userId || req.user?.id || req.user?._id;
    franchise.rejectionReason = reason || '';
    await franchise.save();

    await Notification.create({
      userId: franchise.userId,
      type: 'ADMIN',
      priority: 'HIGH',
      title: 'Franchise status revoked',
      message: `Your Franchise status has been revoked by the admin.${reason ? ` Reason: ${reason}` : ''}`,
      icon: '⚠️',
      color: '#dc2626'
    });

    res.json({ success: true, message: 'Franchise revoked.', data: { franchise } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/franchise/grant  { memberId, note }
 * "From the all member list, which member we want to give franchise, we
 * will select them for Franchise. After that member will get a
 * notification for getting the Franchise." — this is the admin-initiated
 * direct-selection flow: the admin picks ANY member from the full member
 * list (not only members who submitted an application) and grants them
 * Franchise status immediately (skips PENDING entirely, goes straight to
 * APPROVED), same as clicking Approve on an application.
 */
const grantFranchiseAdmin = async (req, res, next) => {
  try {
    const { memberId, note } = req.body;
    if (!memberId || !memberId.trim()) {
      return res.status(400).json({ success: false, message: 'A member must be selected.' });
    }

    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const member = await User.findOne({
      memberId: { $regex: new RegExp(`^${escapeRegex(memberId.trim())}$`, 'i') }
    });

    if (!member) {
      return res.status(404).json({ success: false, message: `No member found with ID "${memberId}".` });
    }

    let franchise = await Franchise.findOne({ userId: member._id });

    if (franchise && franchise.status === 'APPROVED') {
      return res.status(200).json({
        success: true,
        message: `${member.fullName} (${member.memberId}) is already an approved Franchise.`,
        data: { franchise }
      });
    }

    const rates = await SettingsService.getFranchise();
    const adminId = req.userId || req.user?.id || req.user?._id;

    if (!franchise) {
      franchise = new Franchise({ userId: member._id });
    }

    franchise.status = 'APPROVED';
    franchise.applicationNote = franchise.applicationNote || note || 'Directly selected by Admin.';
    franchise.appliedAt = franchise.appliedAt || new Date();
    franchise.decidedAt = new Date();
    franchise.decidedBy = adminId;
    franchise.rejectionReason = '';
    franchise.approvedRatesSnapshot = { kspRate: rates.kspRate, kbpLifetimeRate: rates.kbpLifetimeRate };
    await franchise.save();

    await Notification.create({
      userId: franchise.userId,
      type: 'ACHIEVEMENT',
      priority: 'HIGH',
      title: 'You have been selected as an official Franchise! 🎉',
      message: 'The Admin has directly selected you to become an official Franchise. Your Franchise dashboard is now live under "Franchise" in your sidebar.',
      icon: '🏢',
      color: '#16a34a',
      action: '/member/franchise',
      actionLabel: 'View Franchise Dashboard'
    });

    res.status(200).json({
      success: true,
      message: `${member.fullName} (${member.memberId}) has been granted Franchise status. They have been notified.`,
      data: { franchise }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/franchise/:id/overview
 * "Admin can see franchise income/withdrawal/everything" — full picture of
 * one franchise: territory stats, lifetime + today franchise income, and
 * their withdrawal history.
 */
const getFranchiseOverviewAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const franchise = await Franchise.findById(id).populate('userId', 'fullName memberId email phoneNumber status').lean();
    if (!franchise) {
      return res.status(404).json({ success: false, message: 'Franchise application not found.' });
    }

    const targetUserId = franchise.userId._id;

    const [territory, wallet, withdrawals, totalAgg, todayAgg] = await Promise.all([
      DownlineService.getFullDownline(targetUserId),
      Wallet.findOne({ userId: targetUserId }).lean(),
      Withdrawal.find({ userId: targetUserId }).sort({ createdAt: -1 }).limit(50).lean(),
      IncomeTransaction.aggregate([
        { $match: { userId: targetUserId, type: { $in: ['FRANCHISE_ACTIVATION_OVERRIDE', 'FRANCHISE_KBP_OVERRIDE'] }, status: 'CREDITED' } },
        { $group: { _id: null, total: { $sum: '$creditedAmount' } } }
      ]),
      IncomeTransaction.aggregate([
        { $match: { userId: targetUserId, type: { $in: ['FRANCHISE_ACTIVATION_OVERRIDE', 'FRANCHISE_KBP_OVERRIDE'] }, status: 'CREDITED', createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } } },
        { $group: { _id: null, total: { $sum: '$creditedAmount' } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        franchise,
        territoryStats: {
          totalMembers: territory.length,
          activeMembers: territory.filter((m) => String(m.status).toUpperCase() === 'ACTIVE').length,
          totalKbp: territory.reduce((sum, m) => sum + (Number(m.totalKBP) || 0), 0)
        },
        franchiseIncome: {
          today: todayAgg[0]?.total || 0,
          total: totalAgg[0]?.total || wallet?.franchiseIncome || 0
        },
        withdrawals
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  applyForFranchise,
  getMyFranchiseStatus,
  getMyFranchiseDashboard,
  getMyFranchiseTerritory,
  getFranchiseApplicationsAdmin,
  approveFranchiseAdmin,
  rejectFranchiseAdmin,
  revokeFranchiseAdmin,
  grantFranchiseAdmin,
  getFranchiseOverviewAdmin
};