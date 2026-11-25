// server/src/controllers/franchisePanel.controller.js
//
// Franchise Panel reports — everything an approved franchise sees about its
// own stock, sales, deliveries and bills. Every endpoint is scoped to the
// logged-in member's own APPROVED franchise; a franchise can never read
// another franchise's data.
//
//   GET /api/franchise/panel/received     stock procured (assignments), with KSP/KBP
//   GET /api/franchise/panel/sales        sales history + product-wise breakdown
//   GET /api/franchise/panel/deliveries   products delivered, with recipients
//   GET /api/franchise/panel/bills        complete billing record
//   GET /api/franchise/panel/bills/:id    one bill (for viewing / printing)
//   GET /api/franchise/panel/catalog      all products with MRP / KSP / KBP
//
// List endpoints accept from, to (YYYY-MM-DD), q (search), page, and
// format=csv for a download of the full filtered list.
const mongoose = require('mongoose');
const Franchise = require('../models/Franchise');
const FranchiseStockEntry = require('../models/FranchiseStockEntry');
const RepurchaseProduct = require('../models/RepurchaseProduct');
const FranchiseStock = require('../services/franchiseStock.service');
const { sendCsv } = require('../utils/csv');

const PAGE_SIZE = 25;
const CSV_LIMIT = 20000;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isoDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const today = () => new Date().toISOString().slice(0, 10);

const loadFranchise = async (req, res) => {
  const userId = req.userId || req.user?._id;
  const franchise = await Franchise.findOne({ userId, status: 'APPROVED' })
    .populate('userId', 'memberId fullName phoneNumber email address')
    .lean();
  if (!franchise) {
    res.status(403).json({ success: false, message: 'You are not an approved franchise.' });
    return null;
  }
  return franchise;
};

const parseRange = (query) => {
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

/** Base filter for this franchise's ledger rows. */
const buildMatch = (franchise, query, types, { includeVoided = false } = {}) => {
  const match = { franchiseId: franchise._id, type: { $in: types } };
  if (!includeVoided) match.voided = false;
  const range = parseRange(query);
  if (range) match.entryDate = range;
  if (query.productId) match.productId = String(query.productId).trim();

  const q = String(query.q || '').trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    const or = [
      { productId: rx }, { productName: rx }, { memberId: rx }, { memberName: rx },
      { customerName: rx }, { customerPhone: rx }, { reference: rx }
    ];
    // Bill numbers are FS-YYMMDD-XXXXXX where XXXXXX is the end of the entry id.
    const bill = q.toUpperCase().match(/([0-9A-F]{6})$/);
    if (bill && /^FS-?\d{0,6}-?[0-9A-F]{6}$/i.test(q)) {
      or.push({ $expr: { $regexMatch: { input: { $toUpper: { $toString: '$_id' } }, regex: `${bill[1]}$` } } });
    }
    match.$or = or;
  }
  return match;
};

const pageOf = (query) => Math.max(1, parseInt(query.page, 10) || 1);

const recipientOf = (e) => (e.memberId ? `${e.memberName || ''} (${e.memberId})` : e.customerName || '');

const serialize = (e) => ({
  _id: e._id,
  type: e.type,
  billNumber: e.type === 'SALE' ? FranchiseStock.billNumberFor(e) : null,
  entryDate: e.entryDate,
  createdAt: e.createdAt,
  productId: e.productId,
  productName: e.productName,
  qty: e.qty,
  kspPerUnit: e.kspPerUnit,
  kbpPerUnit: e.kbpPerUnit,
  totalKSP: e.totalKSP,
  totalKBP: e.totalKBP,
  memberId: e.memberId,
  memberName: e.memberName,
  customerName: e.customerName,
  customerPhone: e.customerPhone,
  commissionRate: e.commissionRate,
  commissionAmount: e.commissionAmount,
  commissionStatus: e.commissionStatus,
  reference: e.reference,
  note: e.note,
  recordedByRole: e.recordedByRole,
  voided: e.voided,
  voidReason: e.voided ? e.voidReason : ''
});

/** Shared list runner: totals over the whole filtered set + one page (or CSV). */
const runList = async ({ req, res, match, csv }) => {
  if (req.query.format === 'csv') {
    const rows = await FranchiseStockEntry.find(match).sort({ entryDate: -1, createdAt: -1 }).limit(CSV_LIMIT).lean();
    return sendCsv(res, `${csv.name}-${today()}.csv`, csv.columns, rows.map(serialize));
  }

  const page = pageOf(req.query);
  const [rows, total, agg] = await Promise.all([
    FranchiseStockEntry.find(match).sort({ entryDate: -1, createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    FranchiseStockEntry.countDocuments(match),
    FranchiseStockEntry.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          qty: { $sum: { $cond: ['$voided', 0, '$qty'] } },
          ksp: { $sum: { $cond: ['$voided', 0, '$totalKSP'] } },
          kbp: { $sum: { $cond: ['$voided', 0, '$totalKBP'] } },
          commission: { $sum: { $cond: [{ $eq: ['$commissionStatus', 'CREDITED'] }, '$commissionAmount', 0] } },
          active: { $sum: { $cond: ['$voided', 0, 1] } },
          cancelled: { $sum: { $cond: ['$voided', 1, 0] } }
        }
      }
    ])
  ]);

  const t = agg[0] || {};
  return res.json({
    success: true,
    data: {
      rows: rows.map(serialize),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      totals: {
        entries: t.active || 0,
        cancelled: t.cancelled || 0,
        qty: t.qty || 0,
        ksp: round2(t.ksp),
        kbp: round2(t.kbp),
        commission: round2(t.commission)
      }
    }
  });
};

// ------------------------------------------------------------- 1. received

const getReceived = async (req, res, next) => {
  try {
    const franchise = await loadFranchise(req, res);
    if (!franchise) return;
    const match = buildMatch(franchise, req.query, ['LIFT']);
    return runList({
      req, res, match,
      csv: {
        name: 'stock-received',
        columns: [
          { label: 'Date', get: (r) => isoDate(r.entryDate) },
          { label: 'Product ID', key: 'productId' },
          { label: 'Product', key: 'productName' },
          { label: 'Quantity', key: 'qty' },
          { label: 'KSP per unit (₹)', key: 'kspPerUnit' },
          { label: 'KBP per unit', key: 'kbpPerUnit' },
          { label: 'Total KSP (₹)', key: 'totalKSP' },
          { label: 'Total KBP', key: 'totalKBP' },
          { label: 'Reference', key: 'reference' }
        ]
      }
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------- 2. sales

const getSales = async (req, res, next) => {
  try {
    const franchise = await loadFranchise(req, res);
    if (!franchise) return;
    const match = buildMatch(franchise, req.query, ['SALE']);

    if (req.query.format !== 'csv' && req.query.breakdown === 'product') {
      const byProduct = await FranchiseStockEntry.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$productId',
            productName: { $last: '$productName' },
            bills: { $sum: 1 },
            qty: { $sum: '$qty' },
            ksp: { $sum: '$totalKSP' },
            kbp: { $sum: '$totalKBP' },
            commission: { $sum: { $cond: [{ $eq: ['$commissionStatus', 'CREDITED'] }, '$commissionAmount', 0] } },
            lastSold: { $max: '$entryDate' }
          }
        },
        { $sort: { ksp: -1 } }
      ]);
      return res.json({
        success: true,
        data: {
          products: byProduct.map((p) => ({
            productId: p._id,
            productName: p.productName,
            bills: p.bills,
            qty: p.qty,
            ksp: round2(p.ksp),
            kbp: round2(p.kbp),
            commission: round2(p.commission),
            lastSold: p.lastSold
          }))
        }
      });
    }

    return runList({
      req, res, match,
      csv: {
        name: 'sales-history',
        columns: [
          { label: 'Date', get: (r) => isoDate(r.entryDate) },
          { label: 'Bill No.', key: 'billNumber' },
          { label: 'Product ID', key: 'productId' },
          { label: 'Product', key: 'productName' },
          { label: 'Quantity', key: 'qty' },
          { label: 'KSP per unit (₹)', key: 'kspPerUnit' },
          { label: 'Sale value (₹)', key: 'totalKSP' },
          { label: 'KBP', key: 'totalKBP' },
          { label: 'Buyer', get: recipientOf },
          { label: 'Buyer phone', key: 'customerPhone' },
          { label: 'Commission (₹)', get: (r) => (r.commissionStatus === 'CREDITED' ? r.commissionAmount : 0) },
          { label: 'Your ref.', key: 'reference' }
        ]
      }
    });
  } catch (error) {
    next(error);
  }
};

// ----------------------------------------------------------- 5. deliveries

const getDeliveries = async (req, res, next) => {
  try {
    const franchise = await loadFranchise(req, res);
    if (!franchise) return;
    const types = req.query.kind === 'SALE' ? ['SALE'] : req.query.kind === 'DISPATCH' ? ['DISPATCH'] : ['SALE', 'DISPATCH'];
    const match = buildMatch(franchise, req.query, types);
    return runList({
      req, res, match,
      csv: {
        name: 'deliveries',
        columns: [
          { label: 'Date', get: (r) => isoDate(r.entryDate) },
          { label: 'Type', get: (r) => (r.type === 'SALE' ? 'Sale' : 'Dispatch') },
          { label: 'Bill No.', key: 'billNumber' },
          { label: 'Recipient', get: recipientOf },
          { label: 'Recipient Member ID', key: 'memberId' },
          { label: 'Recipient phone', key: 'customerPhone' },
          { label: 'Product ID', key: 'productId' },
          { label: 'Product', key: 'productName' },
          { label: 'Quantity', key: 'qty' },
          { label: 'KBP', key: 'totalKBP' }
        ]
      }
    });
  } catch (error) {
    next(error);
  }
};

// --------------------------------------------------------------- 6. bills

const getBills = async (req, res, next) => {
  try {
    const franchise = await loadFranchise(req, res);
    if (!franchise) return;
    const status = String(req.query.status || '').toUpperCase();
    const match = buildMatch(franchise, req.query, ['SALE'], { includeVoided: status !== 'ACTIVE' });
    if (status === 'CANCELLED') match.voided = true;
    return runList({
      req, res, match,
      csv: {
        name: 'billing-record',
        columns: [
          { label: 'Bill No.', key: 'billNumber' },
          { label: 'Date', get: (r) => isoDate(r.entryDate) },
          { label: 'Status', get: (r) => (r.voided ? 'Cancelled' : 'Valid') },
          { label: 'Buyer', get: recipientOf },
          { label: 'Buyer phone', key: 'customerPhone' },
          { label: 'Product ID', key: 'productId' },
          { label: 'Product', key: 'productName' },
          { label: 'Quantity', key: 'qty' },
          { label: 'Rate (KSP ₹)', key: 'kspPerUnit' },
          { label: 'Amount (₹)', key: 'totalKSP' },
          { label: 'KBP', key: 'totalKBP' },
          { label: 'Commission (₹)', get: (r) => (r.commissionStatus === 'CREDITED' ? r.commissionAmount : 0) },
          { label: 'Your ref.', key: 'reference' },
          { label: 'Cancel reason', key: 'voidReason' }
        ]
      }
    });
  } catch (error) {
    next(error);
  }
};

const getBill = async (req, res, next) => {
  try {
    const franchise = await loadFranchise(req, res);
    if (!franchise) return;
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid bill.' });
    const entry = await FranchiseStockEntry.findOne({ _id: req.params.id, franchiseId: franchise._id, type: 'SALE' }).lean();
    if (!entry) return res.status(404).json({ success: false, message: 'Bill not found.' });
    const product = await RepurchaseProduct.findOne({ id: entry.productId }).select('mrp category').lean();
    const owner = franchise.userId || {};
    res.json({
      success: true,
      data: {
        bill: { ...serialize(entry), mrpPerUnit: product?.mrp ?? null, category: product?.category || '' },
        franchise: {
          name: owner.fullName,
          memberId: owner.memberId,
          phone: owner.phoneNumber,
          email: owner.email,
          address: owner.address || null
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ------------------------------------------------------------- 4. catalog

const getCatalog = async (req, res, next) => {
  try {
    const franchise = await loadFranchise(req, res);
    if (!franchise) return;
    const q = String(req.query.q || '').trim();
    const filter = { isActive: { $ne: false } };
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ id: rx }, { name: rx }, { category: rx }];
    }
    const [products, balances] = await Promise.all([
      RepurchaseProduct.find(filter).sort({ sortOrder: 1, name: 1 }).select('id name category mrp ksp kbp images tag').lean(),
      FranchiseStock.stockBalancesFor([franchise._id])
    ]);
    const held = new Map(balances.map((b) => [b._id.productId, b.balanceQty]));

    if (req.query.format === 'csv') {
      return sendCsv(res, `product-list-${today()}.csv`, [
        { label: 'Product ID', key: 'id' },
        { label: 'Product', key: 'name' },
        { label: 'Category', key: 'category' },
        { label: 'MRP (₹)', key: 'mrp' },
        { label: 'KSP (₹)', key: 'ksp' },
        { label: 'KBP', key: 'kbp' },
        { label: 'In your stock', get: (p) => held.get(p.id) || 0 }
      ], products);
    }

    res.json({
      success: true,
      data: {
        products: products.map((p) => ({
          productId: p.id,
          name: p.name,
          category: p.category,
          tag: p.tag || '',
          image: p.images?.[0]?.url || null,
          mrp: p.mrp,
          ksp: p.ksp,
          kbp: p.kbp,
          saving: round2((p.mrp || 0) - (p.ksp || 0)),
          inStock: held.get(p.id) || 0
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getReceived, getSales, getDeliveries, getBills, getBill, getCatalog };
