// server/src/controllers/admin.controller.js
const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');
const Wallet = require('../models/Wallet');
const Rank = require('../models/Rank');
const Package = require('../models/Package');
const Fund = require('../models/Fund');
const IncomeService = require('../services/income.service');
const BinaryService = require('../services/binary.service');
const BinaryNode = require('../models/BinaryNode');
const { getFullDownline } = require('../services/downline.service');
const { logAdminAction } = require('../utils/auditLogger');

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
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // The admin very often gets this value by copy-pasting the Member ID
    // badge straight out of the Members list table. That round-trip through
    // the clipboard can carry along characters that never show on screen —
    // a stray zero-width space, a non-breaking space, etc. Those are
    // invisible, but they are real characters, and a query that was
    // previously anchored ("must literally start with exactly what was
    // typed") would silently fail to match a member who is plainly correct
    // and visible on screen. Strip anything outside normal printable ASCII
    // before building the identifier candidate so a clean paste of a real
    // Member ID/email/phone always matches.
    const rawTrimmed = query.trim();
    const cleaned = rawTrimmed.replace(/[^\x20-\x7E]/g, '').trim();

    const rawEscaped = escapeRegex(rawTrimmed);
    const cleanedEscaped = cleaned ? escapeRegex(cleaned) : null;

    // Unanchored (contains) match — not a strict "starts with" — so a
    // partial ID, or an ID copy-pasted with incidental surrounding
    // whitespace, still resolves. This mirrors the identical, already
    // proven-working search used by the main Admin Members list
    // (getAllUsers above), which never anchors its memberId match either.
    const identifierOr = [rawEscaped, cleanedEscaped]
      .filter((v, idx, arr) => v && arr.indexOf(v) === idx)
      .map((val) => ({ memberId: { $regex: new RegExp(val, 'i') } }));

    const members = await User.find({
      role: { $nin: adminRoles },
      $or: [
        ...identifierOr,
        { email: { $regex: new RegExp(rawEscaped, 'i') } },
        { fullName: { $regex: new RegExp(rawEscaped, 'i') } },
        { phoneNumber: { $regex: new RegExp(rawEscaped, 'i') } }
      ]
    })
      .select('memberId fullName email phoneNumber status sponsorId kyc activePackageId')
      .limit(10)
      .lean();

    // Exact Member ID match (once cleaned/uppercased) always wins the top
    // slot, since the modal auto-selects members[0] — an admin who pasted
    // an exact ID should never have a looser name/email substring match
    // pushed in front of the member they actually asked for.
    if (cleaned) {
      const target = cleaned.toUpperCase();
      members.sort((a, b) => {
        const aExact = (a.memberId || '').toUpperCase() === target ? 1 : 0;
        const bExact = (b.memberId || '').toUpperCase() === target ? 1 : 0;
        return bExact - aExact;
      });
    }

    res.set('Cache-Control', 'no-store');
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

    // Guarantee binary-tree placement before any income is processed below.
    // If this member's registration-time placement never happened (the
    // exact "Growth Generation tree is empty / Total Downline Left-Right
    // shows 0" bug reported against the live site), IncomeService's
    // matching-income step silently finds no BinaryNode for them and
    // returns without crediting anyone — the admin sees a success message
    // ("Commissions distributed...") while the member's upline gets no
    // matching income at all. Checking and fixing placement here, right
    // before processOrderIncome runs, closes that gap for every future
    // admin-driven activation regardless of what happened at registration.
    if (member.sponsorId) {
      const ownNode = await BinaryNode.findOne({ userId: member._id });
      const parentNode = ownNode?.parentId ? await BinaryNode.findOne({ userId: ownNode.parentId }) : null;
      const alreadyLinked =
        parentNode &&
        (String(parentNode.leftChildId) === String(member._id) || String(parentNode.rightChildId) === String(member._id));

      if (!alreadyLinked) {
        await BinaryService.placeMember(member._id, member.sponsorId, member.binarySide || 'left').catch((err) => {
          console.error(
            `\n🚨 BINARY PLACEMENT FAILED during admin activation of ${member.memberId} (${member._id}): ${err.message}\n` +
            `   Activation will continue, but matching income for this purchase may not propagate correctly.\n` +
            `   Fix with: POST /api/admin/binary/repair (safe, non-destructive, can be run any time).\n`
          );
        });
      }
    }

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

/**
 * Full detail view for a single member — backs the Admin Dashboard's
 * "Recent Registrations" row click and Admin Members page detail link.
 * GET /api/admin/members/:id  (also mounted as /api/admin/users/:id)
 */
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select('-password -resetPasswordToken -resetPasswordExpire')
      .populate('sponsorId', 'fullName memberId email phoneNumber')
      .populate('activePackageId', 'name price kbpValue kbp dailyCap weeklyCap monthlyCap')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const IncomeTransaction = require('../models/IncomeTransaction');
    const [wallet, binaryNode, directReferralCount, recentOrders, recentIncome] = await Promise.all([
      Wallet.findOne({ userId: id }).lean(),
      BinaryNode.findOne({ userId: id }).lean(),
      User.countDocuments({ sponsorId: id }),
      Order.find({ userId: id }).sort({ createdAt: -1 }).limit(5).select('orderNumber status totalAmount kbpGenerated createdAt orderType').lean(),
      IncomeTransaction.find({ userId: id }).sort({ createdAt: -1 }).limit(5).lean()
    ]);

    let downlineCount = 0;
    try {
      const DownlineService = require('../services/downline.service');
      const fullDownline = await DownlineService.getFullDownline(id);
      downlineCount = fullDownline.length;
    } catch (err) {
      console.error('[getUserById] downline count failed:', err.message);
    }

    res.json({
      success: true,
      data: {
        user,
        wallet: wallet || null,
        binaryNode: binaryNode || null,
        directReferralCount,
        downlineCount,
        recentOrders: recentOrders || [],
        recentIncome: recentIncome || []
      }
    });
  } catch (error) {
    next(error);
  }
};

// A member-scoped collection to permanently wipe when a single member is
// deleted, mirrored from the factory-reset route's MEMBER_SCOPED_COLLECTIONS
// list (server/src/routes/admin.routes.js) — the same set of collections,
// keyed by the field that actually points at the User being deleted.
// PackagePurchase is the one exception that uses `user` instead of `userId`.
const MEMBER_SCOPED_MODEL_FIELDS = {
  BinaryNode: 'userId',
  Franchise: 'userId',
  FundQualification: 'userId',
  IncomeTransaction: 'userId',
  KuwiStar: 'userId',
  Notification: 'userId',
  Order: 'userId',
  PackagePurchase: 'user',
  RankAchievement: 'userId',
  Referral: 'userId',
  SalaryLog: 'userId',
  TTORecord: 'userId',
  Ticket: 'userId',
  Wallet: 'userId',
  WalletTransaction: 'userId',
  Withdrawal: 'userId'
};

/**
 * DELETE /api/admin/members/:id  (also mounted as /api/admin/users/:id)
 *
 * Permanently deletes a member and every collection scoped to them (wallet,
 * income history, orders, package purchases, KYC — embedded in the User doc
 * itself — withdrawals, notifications, tickets, franchise/rank/fund/KuwiStar/
 * salary/TTO records, and their own binary-tree node). This is IRREVERSIBLE.
 *
 * Deliberately refuses to run if the member has ANY downline — a direct
 * referral (someone whose sponsorId points at them), a deeper sponsor-chain
 * descendant (per downline.service.js#getFullDownline, the same authoritative
 * check the Inspect panel already shows as "downlineCount"), or a left/right
 * child in the binary tree. No "promote a child to replace a deleted parent"
 * logic exists anywhere in this codebase (binary.service.js has repair/
 * misplacement-fix tools, but nothing that safely removes a live node with
 * descendants) — allowing that here would silently orphan other members'
 * binary-tree pointers and corrupt their accumulated matching-income volume.
 * The admin must reassign/clear the downline first, or use Deactivate/Block
 * instead for a member who still has an active downline business under them.
 *
 * Also requires the request body to include `confirmMemberId` matching the
 * target's exact memberId (e.g. "KFR471341") — a deliberate typed
 * confirmation (same pattern as /system/factory-reset's typed phrase) so a
 * stray click or retried request can never fire this by accident.
 */
const deleteMember = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { confirmMemberId } = req.body;

    const user = await User.findById(id).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    if (user.role !== 'MEMBER') {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ success: false, message: 'Admin/Super Admin accounts cannot be deleted from this panel.' });
    }

    if (user.isSystemRoot) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: 'The system root account cannot be deleted — every member\'s tree ultimately traces back to it.'
      });
    }

    if (!confirmMemberId || confirmMemberId.trim().toUpperCase() !== String(user.memberId || '').toUpperCase()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Refusing to delete: type the member's exact ID ("${user.memberId}") to confirm.`
      });
    }

    // Downline guard — checked three ways for defense in depth: the
    // authoritative sponsor-chain graph (same computation the Inspect panel
    // shows), direct referrals by sponsorId, and binary-tree children.
    const [fullDownline, directReferralCount, ownBinaryNode] = await Promise.all([
      getFullDownline(user._id),
      User.countDocuments({ sponsorId: user._id }).session(session),
      BinaryNode.findOne({ userId: user._id }).session(session)
    ]);

    const hasBinaryChildren = !!(ownBinaryNode && (ownBinaryNode.leftChildId || ownBinaryNode.rightChildId));

    if (fullDownline.length > 0 || directReferralCount > 0 || hasBinaryChildren) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `${user.memberId} has ${fullDownline.length} member(s) in their downline` +
          (hasBinaryChildren ? ' and a binary-tree child' : '') +
          '. Deleting a member with an active downline would corrupt other members\' tree placement and income history — this has been blocked. ' +
          'Reassign or remove their downline first, or use Deactivate/Block instead if the account just needs to be disabled.'
      });
    }

    const previousData = {
      memberId: user.memberId,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      status: user.status,
      sponsorId: user.sponsorId ? String(user.sponsorId) : null
    };

    const deletedCounts = {};
    for (const [modelName, field] of Object.entries(MEMBER_SCOPED_MODEL_FIELDS)) {
      const Model = require(`../models/${modelName}`);
      const result = await Model.deleteMany({ [field]: user._id }).session(session);
      deletedCounts[modelName] = result.deletedCount || 0;
    }

    // Reopen this member's slot on their binary parent (so a future member
    // can be placed there) — never touch the parent's accumulated
    // left/rightVolume, that reflects real, already-credited historical
    // income and must not be retroactively rewritten.
    if (user.binaryParentId) {
      const parentNode = await BinaryNode.findOne({ userId: user.binaryParentId }).session(session);
      if (parentNode) {
        const updates = {};
        if (String(parentNode.leftChildId) === String(user._id)) updates.leftChildId = null;
        if (String(parentNode.rightChildId) === String(user._id)) updates.rightChildId = null;
        if (Object.keys(updates).length) {
          await BinaryNode.updateOne({ _id: parentNode._id }, { $set: updates }).session(session);
        }
      }
    }

    // Decrement the sponsor's denormalized direct-referral count.
    if (user.sponsorId) {
      await User.updateOne(
        { _id: user.sponsorId, directReferrals: { $gt: 0 } },
        { $inc: { directReferrals: -1 } }
      ).session(session);
    }

    await User.deleteOne({ _id: user._id }).session(session);

    await session.commitTransaction();
    session.endSession();

    logAdminAction({
      req,
      action: 'DELETE_MEMBER',
      module: 'Members',
      targetId: user._id,
      previousData,
      newData: { deletedCounts },
      status: 'SUCCESS'
    }).catch((err) => console.error('Audit log failed for member delete:', err.message));

    res.json({
      success: true,
      message: `Member ${previousData.memberId} and all related data have been permanently deleted.`,
      data: { deletedCounts }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
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
  getUserById,
  searchMembersForActivation,
  updateUserStatus,
  deleteMember,
  activateMemberWithPackage,
  getPendingKYC,
  reviewKYC,
  adjustWallet,
  initializeSystem
};