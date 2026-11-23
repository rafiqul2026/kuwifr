// server/src/controllers/adminInsights.controller.js
//
// Admin reporting & operations added together:
//   1. KBP Report            — every member's KBP (own, left/right, carry, repurchase)
//   2. Income & Payouts      — income stream totals per member, paid vs pending payouts
//   3. Franchise Inventory   — stock lifted / dispatched (by product ID) / balance per franchise
//   4. Sponsor Change        — move a member and their whole team to a new sponsor
//   5. Franchise Reports     — per-franchise territory, sales, income, payouts and stock
//
// All routes are mounted under /api/admin (behind auth + adminAuth).
const mongoose = require('mongoose');
const User = require('../models/User');
const BinaryNode = require('../models/BinaryNode');
const IncomeTransaction = require('../models/IncomeTransaction');
const Withdrawal = require('../models/Withdrawal');
const Wallet = require('../models/Wallet');
const Order = require('../models/Order');
const RepurchasePurchase = require('../models/RepurchasePurchase');
const RepurchaseProduct = require('../models/RepurchaseProduct');
const Franchise = require('../models/Franchise');
const FranchiseStockEntry = require('../models/FranchiseStockEntry');
const AuditLog = require('../models/AuditLog');
const DownlineService = require('../services/downline.service');
const SponsorChangeService = require('../services/sponsorChange.service');
const { logAdminAction } = require('../utils/auditLogger');

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'admin', 'super_admin'];
const CSV_ROW_LIMIT = 20000;

// ---------------------------------------------------------------- helpers

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const pageParams = (query, defaultLimit = 25) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

const memberSearchMatch = (q) => {
  const match = { role: { $nin: ADMIN_ROLES } };
  const clean = String(q || '').trim();
  if (clean) {
    const rx = new RegExp(escapeRegex(clean), 'i');
    match.$or = [{ memberId: rx }, { fullName: rx }, { email: rx }, { phoneNumber: rx }, { referralCode: rx }];
  }
  return match;
};

const parseDateRange = (query) => {
  const range = {};
  if (query.from) {
    const d = new Date(query.from);
    if (!Number.isNaN(d.getTime())) range.$gte = d;
  }
  if (query.to) {
    const d = new Date(query.to);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      range.$lte = d;
    }
  }
  return Object.keys(range).length ? range : null;
};

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const sendCsv = (res, filename, columns, rows) => {
  const lines = [columns.map((c) => csvCell(c.label)).join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvCell(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`﻿${lines.join('\r\n')}`);
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Income streams shown in the admin panel, each mapped to IncomeTransaction types.
const INCOME_STREAMS = [
  { key: 'referral', label: 'Direct Referral', types: ['REFERRAL_INCOME'] },
  { key: 'matching', label: 'Binary Matching', types: ['MATCHING_INCOME'] },
  { key: 'leadership', label: 'Leadership', types: ['LEADERSHIP_INCOME_L1', 'LEADERSHIP_INCOME_L2', 'LEADERSHIP_INCOME_L3'] },
  { key: 'selfRepurchase', label: 'Self Repurchase', types: ['REPURCHASE_SELF'] },
  { key: 'downlineRepurchase', label: 'Downline Repurchase', types: ['REPURCHASE_DOWNLINE'] },
  { key: 'rankSalary', label: 'Rank Salary', types: ['RANK_SALARY'] },
  { key: 'fund', label: 'Fund', types: ['FUND_SALARY', 'FUND_INCOME'] },
  { key: 'franchise', label: 'Franchise', types: ['FRANCHISE_ACTIVATION_OVERRIDE', 'FRANCHISE_KBP_OVERRIDE'] }
];

const PAID_WITHDRAWAL = ['PROCESSED'];
const PENDING_WITHDRAWAL = ['PENDING', 'APPROVED', 'PROCESSING'];

const REAL_ORDER_MATCH = {
  $or: [{ orderStatus: { $in: ['COMPLETED', 'DELIVERED'] } }, { status: 'COMPLETED' }]
};

// ============================================================ 1. KBP REPORT

const KBP_SORTS = {
  team: { teamKBP: -1 },
  own: { ownKBP: -1 },
  left: { leftKBP: -1 },
  right: { rightKBP: -1 },
  matched: { matchedKBP: -1 },
  repurchase: { ownRepurchaseKBP: -1 },
  newest: { createdAt: -1 },
  memberId: { memberId: 1 }
};

const kbpPipeline = (match) => [
  { $match: match },
  { $lookup: { from: BinaryNode.collection.name, localField: '_id', foreignField: 'userId', as: 'node' } },
  { $unwind: { path: '$node', preserveNullAndEmptyArrays: true } },
  {
    $lookup: {
      from: RepurchasePurchase.collection.name,
      let: { uid: '$_id' },
      pipeline: [
        { $match: { $expr: { $eq: ['$user', '$$uid'] }, paymentStatus: 'COMPLETED' } },
        { $group: { _id: null, kbp: { $sum: '$totalKBP' } } }
      ],
      as: 'rep'
    }
  },
  {
    $addFields: {
      leftKBP: { $ifNull: ['$node.leftVolume', 0] },
      rightKBP: { $ifNull: ['$node.rightVolume', 0] },
      matchedKBP: { $ifNull: ['$node.matchingVolume', 0] },
      carryLeftKBP: { $ifNull: ['$node.availableLeftVolume', 0] },
      carryRightKBP: { $ifNull: ['$node.availableRightVolume', 0] },
      leftRepurchaseKBP: { $ifNull: ['$node.leftRepurchaseKBP', 0] },
      rightRepurchaseKBP: { $ifNull: ['$node.rightRepurchaseKBP', 0] },
      pairCount: { $ifNull: ['$node.pairCount', 0] },
      ownRepurchaseKBP: { $ifNull: [{ $arrayElemAt: ['$rep.kbp', 0] }, 0] }
    }
  },
  {
    $addFields: {
      teamKBP: { $add: ['$leftKBP', '$rightKBP'] },
      // BinaryNode.totalKBP = own package KBP + everything below (both legs).
      ownKBP: {
        $max: [0, { $subtract: [{ $ifNull: ['$node.totalKBP', 0] }, { $add: ['$leftKBP', '$rightKBP'] }] }]
      }
    }
  }
];

const KBP_PROJECT = {
  _id: 1, memberId: 1, fullName: 1, status: 1, phoneNumber: 1, createdAt: 1, binarySide: 1, currentPackage: 1,
  ownKBP: 1, leftKBP: 1, rightKBP: 1, teamKBP: 1, matchedKBP: 1, carryLeftKBP: 1, carryRightKBP: 1,
  pairCount: 1, leftRepurchaseKBP: 1, rightRepurchaseKBP: 1, ownRepurchaseKBP: 1
};

const getKbpReport = async (req, res, next) => {
  try {
    const match = memberSearchMatch(req.query.q);
    if (req.query.status) match.status = String(req.query.status).toUpperCase();
    const sort = { ...(KBP_SORTS[req.query.sort] || KBP_SORTS.team), _id: 1 };

    if (req.query.format === 'csv') {
      const rows = await User.aggregate([...kbpPipeline(match), { $sort: sort }, { $limit: CSV_ROW_LIMIT }, { $project: KBP_PROJECT }]);
      return sendCsv(res, `kbp-report-${new Date().toISOString().slice(0, 10)}.csv`, [
        { label: 'Member ID', key: 'memberId' },
        { label: 'Name', key: 'fullName' },
        { label: 'Status', key: 'status' },
        { label: 'Package', key: 'currentPackage' },
        { label: 'Own KBP', key: 'ownKBP' },
        { label: 'Left KBP', key: 'leftKBP' },
        { label: 'Right KBP', key: 'rightKBP' },
        { label: 'Team KBP', key: 'teamKBP' },
        { label: 'Matched KBP', key: 'matchedKBP' },
        { label: 'Carry Left', key: 'carryLeftKBP' },
        { label: 'Carry Right', key: 'carryRightKBP' },
        { label: 'Own Repurchase KBP', key: 'ownRepurchaseKBP' },
        { label: 'Left Repurchase KBP', key: 'leftRepurchaseKBP' },
        { label: 'Right Repurchase KBP', key: 'rightRepurchaseKBP' },
        { label: 'Joined', get: (r) => (r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '') }
      ], rows);
    }

    const { page, limit, skip } = pageParams(req.query);
    const [result] = await User.aggregate([
      ...kbpPipeline(match),
      {
        $facet: {
          rows: [{ $sort: sort }, { $skip: skip }, { $limit: limit }, { $project: KBP_PROJECT }],
          meta: [{ $count: 'total' }],
          totals: [{
            $group: {
              _id: null,
              ownKBP: { $sum: '$ownKBP' },
              ownRepurchaseKBP: { $sum: '$ownRepurchaseKBP' },
              withKBP: { $sum: { $cond: [{ $gt: ['$ownKBP', 0] }, 1, 0] } }
            }
          }]
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        rows: result.rows,
        total: result.meta[0]?.total || 0,
        page,
        limit,
        totals: {
          ownKBP: result.totals[0]?.ownKBP || 0,
          ownRepurchaseKBP: result.totals[0]?.ownRepurchaseKBP || 0,
          membersWithKBP: result.totals[0]?.withKBP || 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ===================================================== 2. INCOME & PAYOUTS

const streamSumExpr = (types) => ({
  $sum: {
    $map: {
      input: { $filter: { input: '$inc', as: 'i', cond: { $in: ['$$i._id', types] } } },
      as: 'i',
      in: '$$i.total'
    }
  }
});

const wdSumExpr = (statuses, field) => ({
  $sum: {
    $map: {
      input: { $filter: { input: '$wd', as: 'w', cond: { $in: ['$$w._id', statuses] } } },
      as: 'w',
      in: `$$w.${field}`
    }
  }
});

const incomePipeline = (match) => {
  const streamFields = {};
  for (const s of INCOME_STREAMS) streamFields[s.key] = streamSumExpr(s.types);
  return [
    { $match: match },
    {
      $lookup: {
        from: IncomeTransaction.collection.name,
        let: { uid: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$userId', '$$uid'] }, status: 'CREDITED' } },
          { $group: { _id: '$type', total: { $sum: '$creditedAmount' } } }
        ],
        as: 'inc'
      }
    },
    {
      $lookup: {
        from: Withdrawal.collection.name,
        let: { uid: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$userId', '$$uid'] } } },
          { $group: { _id: '$status', gross: { $sum: { $ifNull: ['$grossAmount', '$amount'] } }, net: { $sum: '$netAmount' }, count: { $sum: 1 } } }
        ],
        as: 'wd'
      }
    },
    { $lookup: { from: Wallet.collection.name, localField: '_id', foreignField: 'userId', as: 'wallet' } },
    { $unwind: { path: '$wallet', preserveNullAndEmptyArrays: true } },
    { $addFields: { streams: streamFields } },
    {
      $addFields: {
        totalEarned: { $sum: { $map: { input: '$inc', as: 'i', in: '$$i.total' } } },
        paidOut: wdSumExpr(PAID_WITHDRAWAL, 'gross'),
        paidOutNet: wdSumExpr(PAID_WITHDRAWAL, 'net'),
        pendingPayout: wdSumExpr(PENDING_WITHDRAWAL, 'gross'),
        pendingCount: wdSumExpr(PENDING_WITHDRAWAL, 'count'),
        walletBalance: {
          $add: [
            { $ifNull: ['$wallet.incomeBalance', 0] },
            { $ifNull: ['$wallet.repurchaseBalance', 0] },
            { $ifNull: ['$wallet.salaryBalance', 0] }
          ]
        }
      }
    }
  ];
};

const INCOME_SORTS = {
  earned: { totalEarned: -1 },
  paid: { paidOut: -1 },
  pending: { pendingPayout: -1 },
  balance: { walletBalance: -1 },
  newest: { createdAt: -1 },
  memberId: { memberId: 1 }
};

const INCOME_PROJECT = {
  _id: 1, memberId: 1, fullName: 1, status: 1, createdAt: 1, streams: 1,
  totalEarned: 1, paidOut: 1, paidOutNet: 1, pendingPayout: 1, pendingCount: 1, walletBalance: 1
};

const getIncomePayoutsReport = async (req, res, next) => {
  try {
    const match = memberSearchMatch(req.query.q);
    const sort = { ...(INCOME_SORTS[req.query.sort] || INCOME_SORTS.earned), _id: 1 };
    const view = String(req.query.view || '');
    const viewMatch = view === 'pending' ? [{ $match: { pendingPayout: { $gt: 0 } } }]
      : view === 'earners' ? [{ $match: { totalEarned: { $gt: 0 } } }]
        : view === 'balance' ? [{ $match: { walletBalance: { $gt: 0 } } }]
          : [];

    if (req.query.format === 'csv') {
      const rows = await User.aggregate([...incomePipeline(match), ...viewMatch, { $sort: sort }, { $limit: CSV_ROW_LIMIT }, { $project: INCOME_PROJECT }]);
      return sendCsv(res, `income-payouts-${new Date().toISOString().slice(0, 10)}.csv`, [
        { label: 'Member ID', key: 'memberId' },
        { label: 'Name', key: 'fullName' },
        { label: 'Status', key: 'status' },
        ...INCOME_STREAMS.map((s) => ({ label: s.label, get: (r) => round2(r.streams?.[s.key]) })),
        { label: 'Total Earned', get: (r) => round2(r.totalEarned) },
        { label: 'Paid Out (gross)', get: (r) => round2(r.paidOut) },
        { label: 'Paid Out (net to bank)', get: (r) => round2(r.paidOutNet) },
        { label: 'Pending Payout', get: (r) => round2(r.pendingPayout) },
        { label: 'Wallet Balance', get: (r) => round2(r.walletBalance) }
      ], rows);
    }

    const { page, limit, skip } = pageParams(req.query);
    const [result] = await User.aggregate([
      ...incomePipeline(match),
      ...viewMatch,
      {
        $facet: {
          rows: [{ $sort: sort }, { $skip: skip }, { $limit: limit }, { $project: INCOME_PROJECT }],
          meta: [{ $count: 'total' }]
        }
      }
    ]);

    res.json({
      success: true,
      data: { rows: result.rows, total: result.meta[0]?.total || 0, page, limit, streams: INCOME_STREAMS.map(({ key, label }) => ({ key, label })) }
    });
  } catch (error) {
    next(error);
  }
};

/** Platform-wide totals for the Income & Payouts summary cards. */
const getIncomePayoutsSummary = async (req, res, next) => {
  try {
    const range = parseDateRange(req.query);
    const incMatch = { status: 'CREDITED', ...(range ? { createdAt: range } : {}) };
    const wdMatch = range ? { createdAt: range } : {};

    const [byType, wdByStatus, walletAgg] = await Promise.all([
      IncomeTransaction.aggregate([{ $match: incMatch }, { $group: { _id: '$type', total: { $sum: '$creditedAmount' }, count: { $sum: 1 } } }]),
      Withdrawal.aggregate([
        { $match: wdMatch },
        { $group: { _id: '$status', gross: { $sum: { $ifNull: ['$grossAmount', '$amount'] } }, net: { $sum: '$netAmount' }, count: { $sum: 1 } } }
      ]),
      Wallet.aggregate([{ $group: { _id: null, income: { $sum: '$incomeBalance' }, repurchase: { $sum: '$repurchaseBalance' }, salary: { $sum: '$salaryBalance' } } }])
    ]);

    const typeTotal = new Map(byType.map((t) => [t._id, t]));
    const streams = INCOME_STREAMS.map((s) => ({
      key: s.key,
      label: s.label,
      total: round2(s.types.reduce((sum, t) => sum + (typeTotal.get(t)?.total || 0), 0)),
      count: s.types.reduce((sum, t) => sum + (typeTotal.get(t)?.count || 0), 0)
    }));
    const pick = (statuses, field) => round2(wdByStatus.filter((w) => statuses.includes(w._id)).reduce((s, w) => s + (w[field] || 0), 0));

    res.json({
      success: true,
      data: {
        streams,
        totalEarned: round2(streams.reduce((s, x) => s + x.total, 0)),
        payouts: {
          paidGross: pick(PAID_WITHDRAWAL, 'gross'),
          paidNet: pick(PAID_WITHDRAWAL, 'net'),
          paidCount: pick(PAID_WITHDRAWAL, 'count'),
          pendingGross: pick(PENDING_WITHDRAWAL, 'gross'),
          pendingCount: pick(PENDING_WITHDRAWAL, 'count'),
          rejectedGross: pick(['REJECTED', 'FAILED', 'CANCELLED'], 'gross')
        },
        walletBalances: {
          income: round2(walletAgg[0]?.income),
          repurchase: round2(walletAgg[0]?.repurchase),
          salary: round2(walletAgg[0]?.salary)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/** One member's full income & payout history. */
const getMemberIncomeHistory = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ success: false, message: 'Invalid member id.' });

    const user = await User.findById(userId).select('memberId fullName email phoneNumber status createdAt').lean();
    if (!user) return res.status(404).json({ success: false, message: 'Member not found.' });

    const uid = new mongoose.Types.ObjectId(userId);
    const [byType, transactions, withdrawals, wallet] = await Promise.all([
      IncomeTransaction.aggregate([
        { $match: { userId: uid, status: 'CREDITED' } },
        { $group: { _id: '$type', total: { $sum: '$creditedAmount' }, count: { $sum: 1 } } }
      ]),
      IncomeTransaction.find({ userId: uid })
        .sort({ createdAt: -1 })
        .limit(100)
        .select('type creditedAmount grossAmount kbp status createdAt transactionId walletType')
        .lean(),
      Withdrawal.find({ userId: uid })
        .sort({ createdAt: -1 })
        .limit(100)
        .select('withdrawalNumber grossAmount amount netAmount tdsAmount adminCharge serviceCharge status createdAt payment.processedAt payment.utrNumber payment.transactionId approval.rejectionReason')
        .lean(),
      Wallet.findOne({ userId: uid }).select('incomeBalance repurchaseBalance salaryBalance totalWithdrawn').lean()
    ]);

    const typeTotal = new Map(byType.map((t) => [t._id, t]));
    const streams = INCOME_STREAMS.map((s) => ({
      key: s.key,
      label: s.label,
      total: round2(s.types.reduce((sum, t) => sum + (typeTotal.get(t)?.total || 0), 0)),
      count: s.types.reduce((sum, t) => sum + (typeTotal.get(t)?.count || 0), 0)
    }));
    const sumW = (statuses) => round2(withdrawals.filter((w) => statuses.includes(w.status)).reduce((s, w) => s + (w.grossAmount ?? w.amount ?? 0), 0));

    res.json({
      success: true,
      data: {
        user,
        streams,
        totalEarned: round2(streams.reduce((s, x) => s + x.total, 0)),
        paidOut: sumW(PAID_WITHDRAWAL),
        pendingPayout: sumW(PENDING_WITHDRAWAL),
        wallet: wallet || { incomeBalance: 0, repurchaseBalance: 0, salaryBalance: 0 },
        transactions,
        withdrawals
      }
    });
  } catch (error) {
    next(error);
  }
};

// ================================================ 3. FRANCHISE INVENTORY

const stockBalancesFor = async (franchiseIds = null) => {
  const match = { voided: false };
  if (franchiseIds) match.franchiseId = { $in: franchiseIds };
  return FranchiseStockEntry.aggregate([
    { $match: match },
    {
      $group: {
        _id: { franchiseId: '$franchiseId', productId: '$productId' },
        productName: { $last: '$productName' },
        liftedQty: { $sum: { $cond: [{ $eq: ['$type', 'LIFT'] }, '$qty', 0] } },
        dispatchedQty: { $sum: { $cond: [{ $eq: ['$type', 'DISPATCH'] }, '$qty', 0] } },
        returnedQty: { $sum: { $cond: [{ $eq: ['$type', 'RETURN'] }, '$qty', 0] } },
        liftedKBP: { $sum: { $cond: [{ $eq: ['$type', 'LIFT'] }, '$totalKBP', 0] } },
        dispatchedKBP: { $sum: { $cond: [{ $eq: ['$type', 'DISPATCH'] }, '$totalKBP', 0] } },
        returnedKBP: { $sum: { $cond: [{ $eq: ['$type', 'RETURN'] }, '$totalKBP', 0] } },
        liftedKSP: { $sum: { $cond: [{ $eq: ['$type', 'LIFT'] }, '$totalKSP', 0] } },
        dispatchedKSP: { $sum: { $cond: [{ $eq: ['$type', 'DISPATCH'] }, '$totalKSP', 0] } },
        returnedKSP: { $sum: { $cond: [{ $eq: ['$type', 'RETURN'] }, '$totalKSP', 0] } }
      }
    },
    {
      $addFields: {
        balanceQty: { $subtract: ['$liftedQty', { $add: ['$dispatchedQty', '$returnedQty'] }] },
        balanceKBP: { $subtract: ['$liftedKBP', { $add: ['$dispatchedKBP', '$returnedKBP'] }] },
        balanceKSP: { $subtract: ['$liftedKSP', { $add: ['$dispatchedKSP', '$returnedKSP'] }] }
      }
    },
    { $sort: { '_id.productId': 1 } }
  ]);
};

const sumStock = (rows) => rows.reduce((t, r) => {
  for (const k of ['liftedQty', 'dispatchedQty', 'returnedQty', 'balanceQty', 'liftedKBP', 'dispatchedKBP', 'returnedKBP', 'balanceKBP', 'liftedKSP', 'dispatchedKSP', 'balanceKSP']) {
    t[k] = (t[k] || 0) + (r[k] || 0);
  }
  return t;
}, {});

/** Franchise list with stock totals — the Inventory page's left column. */
const getFranchiseInventoryOverview = async (req, res, next) => {
  try {
    const franchises = await Franchise.find({ status: { $in: ['APPROVED', 'REVOKED'] } })
      .populate('userId', 'memberId fullName phoneNumber status')
      .sort({ status: 1, decidedAt: -1 })
      .lean();
    const balances = await stockBalancesFor();
    const byFranchise = new Map();
    for (const b of balances) {
      const key = String(b._id.franchiseId);
      if (!byFranchise.has(key)) byFranchise.set(key, []);
      byFranchise.get(key).push(b);
    }
    const rows = franchises.map((f) => ({
      _id: f._id,
      status: f.status,
      member: f.userId,
      totals: sumStock(byFranchise.get(String(f._id)) || [])
    }));
    res.json({ success: true, data: { franchises: rows, totals: sumStock(balances) } });
  } catch (error) {
    next(error);
  }
};

/** One franchise's product-wise balance + ledger entries. */
const getFranchiseInventory = async (req, res, next) => {
  try {
    const { franchiseId } = req.params;
    if (!mongoose.isValidObjectId(franchiseId)) return res.status(400).json({ success: false, message: 'Invalid franchise id.' });
    const franchise = await Franchise.findById(franchiseId).populate('userId', 'memberId fullName phoneNumber status').lean();
    if (!franchise) return res.status(404).json({ success: false, message: 'Franchise not found.' });

    const entryMatch = { franchiseId: franchise._id };
    if (['LIFT', 'DISPATCH', 'RETURN'].includes(req.query.type)) entryMatch.type = req.query.type;
    if (req.query.productId) entryMatch.productId = String(req.query.productId).trim();
    const range = parseDateRange(req.query);
    if (range) entryMatch.entryDate = range;
    if (req.query.includeVoided !== 'true') entryMatch.voided = false;

    const { page, limit, skip } = pageParams(req.query, 50);
    const [products, entries, total] = await Promise.all([
      stockBalancesFor([franchise._id]),
      FranchiseStockEntry.find(entryMatch).sort({ entryDate: -1, createdAt: -1 }).skip(skip).limit(limit)
        .populate('createdBy', 'fullName email').lean(),
      FranchiseStockEntry.countDocuments(entryMatch)
    ]);

    res.json({ success: true, data: { franchise, products, totals: sumStock(products), entries, total, page, limit } });
  } catch (error) {
    next(error);
  }
};

const productBalance = async (franchiseId, productId) => {
  const [row] = await stockBalancesFor([franchiseId]).then((rows) => rows.filter((r) => r._id.productId === productId));
  return row ? row.balanceQty : 0;
};

/** POST — record a LIFT, DISPATCH or RETURN. */
const createFranchiseStockEntry = async (req, res, next) => {
  try {
    const { franchiseId } = req.params;
    const type = String(req.body.type || '').toUpperCase();
    const productId = String(req.body.productId || '').trim();
    const qty = Number(req.body.qty);

    if (!mongoose.isValidObjectId(franchiseId)) return res.status(400).json({ success: false, message: 'Invalid franchise id.' });
    if (!['LIFT', 'DISPATCH', 'RETURN'].includes(type)) return res.status(400).json({ success: false, message: 'Type must be Lift, Dispatch or Return.' });
    if (!productId) return res.status(400).json({ success: false, message: 'Choose a product.' });
    if (!Number.isInteger(qty) || qty < 1 || qty > 100000) return res.status(400).json({ success: false, message: 'Quantity must be a whole number from 1 to 100000.' });

    const franchise = await Franchise.findById(franchiseId).lean();
    if (!franchise) return res.status(404).json({ success: false, message: 'Franchise not found.' });
    if (franchise.status !== 'APPROVED' && type === 'LIFT') {
      return res.status(400).json({ success: false, message: 'Stock can only be lifted by an approved franchise.' });
    }

    const product = await RepurchaseProduct.findOne({ id: productId }).lean();
    if (!product) return res.status(404).json({ success: false, message: `Product ${productId} not found.` });

    let member = null;
    if (type === 'DISPATCH') {
      const ref = String(req.body.memberId || '').trim();
      if (!ref) return res.status(400).json({ success: false, message: 'Enter the Member ID the product was dispatched to.' });
      member = await SponsorChangeService.findByMemberId(ref);
      if (!member) return res.status(404).json({ success: false, message: `Member ${ref} not found.` });
    }

    let entryDate = new Date();
    if (req.body.entryDate) {
      const d = new Date(req.body.entryDate);
      if (Number.isNaN(d.getTime()) || d > new Date(Date.now() + 86400000)) {
        return res.status(400).json({ success: false, message: 'Invalid entry date.' });
      }
      entryDate = d;
    }

    // Company warehouse stock moves with LIFT (out) / RETURN (back in), when tracked.
    let companyStockAdjusted = false;
    if (type === 'LIFT' && product.stock !== null && product.stock !== undefined) {
      const updated = await RepurchaseProduct.findOneAndUpdate(
        { _id: product._id, stock: { $gte: qty } },
        { $inc: { stock: -qty } },
        { new: true }
      );
      if (!updated) {
        return res.status(400).json({ success: false, message: `Only ${product.stock} unit(s) of ${product.name} left in company stock.` });
      }
      companyStockAdjusted = true;
    }

    const entry = await FranchiseStockEntry.create({
      franchiseId: franchise._id,
      franchiseUserId: franchise.userId,
      type,
      productId: product.id,
      productName: product.name,
      qty,
      kbpPerUnit: product.kbp || 0,
      kspPerUnit: product.ksp || 0,
      totalKBP: round2((product.kbp || 0) * qty),
      totalKSP: round2((product.ksp || 0) * qty),
      memberUserId: member?._id || null,
      memberId: member?.memberId || null,
      memberName: member?.fullName || null,
      reference: String(req.body.reference || '').trim().slice(0, 120),
      note: String(req.body.note || '').trim().slice(0, 500),
      entryDate,
      companyStockAdjusted,
      createdBy: req.user._id
    });

    // DISPATCH / RETURN can't take a franchise below zero. Checked after the
    // write so two simultaneous entries can never both slip through.
    if (type !== 'LIFT') {
      const balance = await productBalance(franchise._id, product.id);
      if (balance < 0) {
        await FranchiseStockEntry.deleteOne({ _id: entry._id });
        return res.status(400).json({
          success: false,
          message: `Not enough ${product.name} with this franchise. Available: ${balance + qty} unit(s).`
        });
      }
      if (type === 'RETURN' && product.stock !== null && product.stock !== undefined) {
        await RepurchaseProduct.updateOne({ _id: product._id }, { $inc: { stock: qty } });
        await FranchiseStockEntry.updateOne({ _id: entry._id }, { $set: { companyStockAdjusted: true } });
      }
    }

    await logAdminAction({
      req,
      action: `FRANCHISE_STOCK_${type}`,
      module: 'PRODUCTS',
      targetId: entry._id,
      newData: { franchiseId: String(franchise._id), productId: product.id, qty, memberId: member?.memberId || null }
    });

    res.status(201).json({ success: true, message: `${type.charAt(0)}${type.slice(1).toLowerCase()} of ${qty} × ${product.name} recorded.`, data: entry });
  } catch (error) {
    next(error);
  }
};

/** POST — void a stock entry (kept for the audit trail, excluded from balances). */
const voidFranchiseStockEntry = async (req, res, next) => {
  try {
    const { entryId } = req.params;
    if (!mongoose.isValidObjectId(entryId)) return res.status(400).json({ success: false, message: 'Invalid entry id.' });
    const reason = String(req.body.reason || '').trim();
    if (reason.length < 3) return res.status(400).json({ success: false, message: 'Give a reason for voiding this entry.' });

    const entry = await FranchiseStockEntry.findOneAndUpdate(
      { _id: entryId, voided: false },
      { $set: { voided: true, voidedAt: new Date(), voidedBy: req.user._id, voidReason: reason.slice(0, 300) } },
      { new: true }
    );
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found or already voided.' });

    // Voiding a LIFT removes stock from the franchise — refuse if it's already been dispatched.
    if (entry.type === 'LIFT') {
      const balance = await productBalance(entry.franchiseId, entry.productId);
      if (balance < 0) {
        await FranchiseStockEntry.updateOne({ _id: entry._id }, { $set: { voided: false, voidedAt: null, voidedBy: null, voidReason: '' } });
        return res.status(400).json({
          success: false,
          message: 'This lift has already been partly dispatched. Void the dispatches first, or record a Return instead.'
        });
      }
    }

    // Undo the company-stock movement this entry made.
    if (entry.companyStockAdjusted) {
      const delta = entry.type === 'LIFT' ? entry.qty : entry.type === 'RETURN' ? -entry.qty : 0;
      if (delta) {
        await RepurchaseProduct.updateOne(
          { id: entry.productId, stock: { $ne: null }, ...(delta < 0 ? { stock: { $gte: -delta } } : {}) },
          { $inc: { stock: delta } }
        );
      }
    }

    await logAdminAction({
      req,
      action: 'FRANCHISE_STOCK_VOID',
      module: 'PRODUCTS',
      targetId: entry._id,
      previousData: { type: entry.type, productId: entry.productId, qty: entry.qty },
      newData: { reason }
    });

    res.json({ success: true, message: 'Entry voided.', data: entry });
  } catch (error) {
    next(error);
  }
};

// ================================================== 4. SPONSOR CHANGE

const previewSponsorChange = async (req, res, next) => {
  try {
    const data = await SponsorChangeService.preview({
      memberRef: req.body.member,
      newSponsorMemberId: req.body.newSponsor,
      side: req.body.side
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const executeSponsorChange = async (req, res, next) => {
  try {
    const reason = String(req.body.reason || '').trim();
    if (reason.length < 5) {
      return res.status(400).json({ success: false, message: 'Enter a reason for the sponsor change (at least 5 characters).' });
    }
    if (String(req.body.confirm || '').trim().toUpperCase() !== 'CHANGE') {
      return res.status(400).json({ success: false, message: 'Type CHANGE to confirm.' });
    }

    const result = await SponsorChangeService.execute({
      memberRef: req.body.member,
      newSponsorMemberId: req.body.newSponsor,
      side: req.body.side,
      reason
    });

    await logAdminAction({
      req,
      action: 'SPONSOR_CHANGE',
      module: 'MEMBERS',
      targetId: result.member._id,
      previousData: {
        sponsor: result.oldSponsor ? `${result.oldSponsor.fullName} (${result.oldSponsor.memberId})` : null,
        binaryParent: result.oldBinaryParent ? `${result.oldBinaryParent.fullName} (${result.oldBinaryParent.memberId})` : null
      },
      newData: {
        memberId: result.member.memberId,
        memberName: result.member.fullName,
        sponsor: `${result.newSponsor.fullName} (${result.newSponsor.memberId})`,
        binaryParent: result.newBinaryParent ? `${result.newBinaryParent.fullName} (${result.newBinaryParent.memberId}) · ${result.newBinaryParent.side}` : null,
        movedTeamSize: result.movedTeamSize,
        reason
      }
    });

    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        userId: result.member._id,
        type: 'SYSTEM',
        priority: 'HIGH',
        title: 'Your sponsor was changed',
        message: `Your team has been moved under ${result.newSponsor.fullName} (${result.newSponsor.memberId}) by KUWIFR admin.`,
        icon: '🔀',
        color: '#0f766e',
        action: '/member/team',
        actionLabel: 'View Team'
      });
    } catch (notifErr) {
      console.error('Sponsor-change notification failed:', notifErr.message);
    }

    res.json({
      success: true,
      message: `${result.member.fullName} (${result.member.memberId}) and ${result.movedTeamSize} team member(s) moved under ${result.newSponsor.fullName} (${result.newSponsor.memberId}).`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getSponsorChangeHistory = async (req, res, next) => {
  try {
    const { page, limit, skip } = pageParams(req.query, 20);
    const match = { action: 'SPONSOR_CHANGE' };
    const [rows, total] = await Promise.all([
      AuditLog.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(match)
    ]);
    res.json({ success: true, data: { rows, total, page, limit } });
  } catch (error) {
    next(error);
  }
};

// ================================================= 5. FRANCHISE REPORTS

const buildFranchiseReportRow = async (franchise, range, stockByFranchise) => {
  const userId = franchise.userId?._id || franchise.userId;
  const territory = await DownlineService.getFullDownline(userId);
  const territoryIds = territory.map((m) => m._id);
  const createdInRange = range ? { createdAt: range } : {};

  const [nodes, orderAgg, repAgg, incomeAgg, incomeAllTime, wdAgg] = await Promise.all([
    BinaryNode.find({ userId: { $in: territoryIds } }).select('totalKBP leftVolume rightVolume').lean(),
    Order.aggregate([
      { $match: { userId: { $in: territoryIds }, ...REAL_ORDER_MATCH, ...createdInRange } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$totalAmount' }, kbp: { $sum: '$kbpGenerated' } } }
    ]),
    RepurchasePurchase.aggregate([
      { $match: { user: { $in: territoryIds }, paymentStatus: 'COMPLETED', ...createdInRange } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$totalKSP' }, kbp: { $sum: '$totalKBP' } } }
    ]),
    IncomeTransaction.aggregate([
      { $match: { userId, status: 'CREDITED', type: { $in: ['FRANCHISE_ACTIVATION_OVERRIDE', 'FRANCHISE_KBP_OVERRIDE'] }, ...createdInRange } },
      { $group: { _id: '$type', total: { $sum: '$creditedAmount' } } }
    ]),
    IncomeTransaction.aggregate([
      { $match: { userId, status: 'CREDITED' } },
      { $group: { _id: null, total: { $sum: '$creditedAmount' } } }
    ]),
    Withdrawal.aggregate([
      { $match: { userId, ...createdInRange } },
      { $group: { _id: '$status', gross: { $sum: { $ifNull: ['$grossAmount', '$amount'] } } } }
    ])
  ]);

  const ownKbp = (n) => Math.max(0, (n.totalKBP || 0) - (n.leftVolume || 0) - (n.rightVolume || 0));
  const inc = new Map(incomeAgg.map((i) => [i._id, i.total]));
  const wd = (statuses) => round2(wdAgg.filter((w) => statuses.includes(w._id)).reduce((s, w) => s + w.gross, 0));
  const stock = stockByFranchise.get(String(franchise._id)) || {};

  return {
    _id: franchise._id,
    status: franchise.status,
    approvedAt: franchise.decidedAt,
    member: franchise.userId,
    territory: {
      members: territory.length,
      active: territory.filter((m) => m.status === 'ACTIVE').length,
      newInRange: range ? territory.filter((m) => m.createdAt && (!range.$gte || m.createdAt >= range.$gte) && (!range.$lte || m.createdAt <= range.$lte)).length : null,
      kbp: nodes.reduce((s, n) => s + ownKbp(n), 0)
    },
    sales: {
      packageOrders: orderAgg[0]?.count || 0,
      packageAmount: round2(orderAgg[0]?.amount),
      packageKBP: orderAgg[0]?.kbp || 0,
      repurchaseOrders: repAgg[0]?.count || 0,
      repurchaseAmount: round2(repAgg[0]?.amount),
      repurchaseKBP: repAgg[0]?.kbp || 0
    },
    income: {
      activationOverride: round2(inc.get('FRANCHISE_ACTIVATION_OVERRIDE')),
      kbpOverride: round2(inc.get('FRANCHISE_KBP_OVERRIDE')),
      franchiseTotal: round2((inc.get('FRANCHISE_ACTIVATION_OVERRIDE') || 0) + (inc.get('FRANCHISE_KBP_OVERRIDE') || 0)),
      allIncomeLifetime: round2(incomeAllTime[0]?.total)
    },
    payouts: { paid: wd(PAID_WITHDRAWAL), pending: wd(PENDING_WITHDRAWAL) },
    stock: {
      liftedQty: stock.liftedQty || 0,
      dispatchedQty: stock.dispatchedQty || 0,
      returnedQty: stock.returnedQty || 0,
      balanceQty: stock.balanceQty || 0,
      liftedKBP: stock.liftedKBP || 0,
      dispatchedKBP: stock.dispatchedKBP || 0,
      balanceKBP: stock.balanceKBP || 0,
      balanceKSP: round2(stock.balanceKSP)
    }
  };
};

const getFranchiseReports = async (req, res, next) => {
  try {
    const range = parseDateRange(req.query);
    const statusFilter = req.query.status === 'all' ? { status: { $in: ['APPROVED', 'REVOKED'] } } : { status: 'APPROVED' };
    const franchises = await Franchise.find(statusFilter).populate('userId', 'memberId fullName phoneNumber status').lean();

    // Stock in the date range (lifted/dispatched within it); balance is always as of today.
    const stockMatch = { voided: false, ...(range ? { entryDate: range } : {}) };
    const [stockRange, stockNow] = await Promise.all([
      FranchiseStockEntry.aggregate([
        { $match: stockMatch },
        {
          $group: {
            _id: '$franchiseId',
            liftedQty: { $sum: { $cond: [{ $eq: ['$type', 'LIFT'] }, '$qty', 0] } },
            dispatchedQty: { $sum: { $cond: [{ $eq: ['$type', 'DISPATCH'] }, '$qty', 0] } },
            returnedQty: { $sum: { $cond: [{ $eq: ['$type', 'RETURN'] }, '$qty', 0] } },
            liftedKBP: { $sum: { $cond: [{ $eq: ['$type', 'LIFT'] }, '$totalKBP', 0] } },
            dispatchedKBP: { $sum: { $cond: [{ $eq: ['$type', 'DISPATCH'] }, '$totalKBP', 0] } }
          }
        }
      ]),
      stockBalancesFor()
    ]);
    const stockByFranchise = new Map();
    for (const s of stockRange) stockByFranchise.set(String(s._id), { ...s });
    for (const b of stockNow) {
      const key = String(b._id.franchiseId);
      const cur = stockByFranchise.get(key) || {};
      cur.balanceQty = (cur.balanceQty || 0) + b.balanceQty;
      cur.balanceKBP = (cur.balanceKBP || 0) + b.balanceKBP;
      cur.balanceKSP = (cur.balanceKSP || 0) + b.balanceKSP;
      stockByFranchise.set(key, cur);
    }

    const rows = [];
    for (const f of franchises) {
      if (!f.userId) continue;
      rows.push(await buildFranchiseReportRow(f, range, stockByFranchise));
    }
    rows.sort((a, b) => b.sales.packageAmount + b.sales.repurchaseAmount - (a.sales.packageAmount + a.sales.repurchaseAmount));

    if (req.query.format === 'csv') {
      return sendCsv(res, `franchise-report-${new Date().toISOString().slice(0, 10)}.csv`, [
        { label: 'Franchise Member ID', get: (r) => r.member?.memberId },
        { label: 'Name', get: (r) => r.member?.fullName },
        { label: 'Status', key: 'status' },
        { label: 'Territory Members', get: (r) => r.territory.members },
        { label: 'Active Members', get: (r) => r.territory.active },
        { label: 'New Members (range)', get: (r) => r.territory.newInRange ?? '' },
        { label: 'Territory Own KBP', get: (r) => r.territory.kbp },
        { label: 'Package Orders', get: (r) => r.sales.packageOrders },
        { label: 'Package Sales (₹)', get: (r) => r.sales.packageAmount },
        { label: 'Package KBP', get: (r) => r.sales.packageKBP },
        { label: 'Repurchase Orders', get: (r) => r.sales.repurchaseOrders },
        { label: 'Repurchase Sales (₹)', get: (r) => r.sales.repurchaseAmount },
        { label: 'Repurchase KBP', get: (r) => r.sales.repurchaseKBP },
        { label: 'Franchise Income (₹)', get: (r) => r.income.franchiseTotal },
        { label: 'Paid Out (₹)', get: (r) => r.payouts.paid },
        { label: 'Pending Payout (₹)', get: (r) => r.payouts.pending },
        { label: 'Stock Lifted (units)', get: (r) => r.stock.liftedQty },
        { label: 'Stock Dispatched (units)', get: (r) => r.stock.dispatchedQty },
        { label: 'Stock Balance (units)', get: (r) => r.stock.balanceQty },
        { label: 'Stock Balance (KBP)', get: (r) => r.stock.balanceKBP }
      ], rows);
    }

    const totals = rows.reduce((t, r) => {
      t.territoryMembers += r.territory.members;
      t.salesAmount += r.sales.packageAmount + r.sales.repurchaseAmount;
      t.franchiseIncome += r.income.franchiseTotal;
      t.stockBalanceQty += r.stock.balanceQty;
      t.stockBalanceKBP += r.stock.balanceKBP;
      return t;
    }, { territoryMembers: 0, salesAmount: 0, franchiseIncome: 0, stockBalanceQty: 0, stockBalanceKBP: 0 });

    res.json({ success: true, data: { rows, totals: { ...totals, franchises: rows.length } } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getKbpReport,
  getIncomePayoutsReport,
  getIncomePayoutsSummary,
  getMemberIncomeHistory,
  getFranchiseInventoryOverview,
  getFranchiseInventory,
  createFranchiseStockEntry,
  voidFranchiseStockEntry,
  previewSponsorChange,
  executeSponsorChange,
  getSponsorChangeHistory,
  getFranchiseReports
};
