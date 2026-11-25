// server/src/services/franchiseStock.service.js
//
// Franchise stock & sales — one place for the rules, shared by the admin
// Franchise Inventory page and the franchise's own dashboard.
//
//   LIFT      admin assigns stock from the company to a franchise
//   DISPATCH  franchise hands a product to a member (no commission)
//   SALE      franchise sells a product -> earns FRANCHISE_SALE_COMMISSION
//   RETURN    franchise sends unsold stock back to the company
//
// Balance per product = LIFT - DISPATCH - SALE - RETURN (non-voided rows).
// Sale commission = KSP x qty x Settings.compensation.franchise.saleCommissionRate,
// credited to the franchise's Income wallet the moment the sale is recorded.
// Voiding a sale reverses that commission from the wallet.
const mongoose = require('mongoose');
const FranchiseStockEntry = require('../models/FranchiseStockEntry');
const RepurchaseProduct = require('../models/RepurchaseProduct');
const IncomeTransaction = require('../models/IncomeTransaction');
const Notification = require('../models/Notification');
const SettingsService = require('./settings.service');
const IncomeService = require('./income.service');
const WalletService = require('./wallet.service');
const { findByMemberId } = require('./sponsorChange.service');

const TYPES = ['LIFT', 'DISPATCH', 'SALE', 'RETURN'];
const OUTFLOW = ['DISPATCH', 'SALE', 'RETURN'];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const fail = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const sumIf = (type, field) => ({ $sum: { $cond: [{ $eq: ['$type', type] }, field, 0] } });

/** Product-wise balances, optionally limited to some franchises. */
const stockBalancesFor = async (franchiseIds = null) => {
  const match = { voided: false };
  if (franchiseIds) match.franchiseId = { $in: franchiseIds.map((id) => new mongoose.Types.ObjectId(String(id))) };
  return FranchiseStockEntry.aggregate([
    { $match: match },
    {
      $group: {
        _id: { franchiseId: '$franchiseId', productId: '$productId' },
        productName: { $last: '$productName' },
        liftedQty: sumIf('LIFT', '$qty'),
        dispatchedQty: sumIf('DISPATCH', '$qty'),
        soldQty: sumIf('SALE', '$qty'),
        returnedQty: sumIf('RETURN', '$qty'),
        liftedKBP: sumIf('LIFT', '$totalKBP'),
        dispatchedKBP: sumIf('DISPATCH', '$totalKBP'),
        soldKBP: sumIf('SALE', '$totalKBP'),
        returnedKBP: sumIf('RETURN', '$totalKBP'),
        liftedKSP: sumIf('LIFT', '$totalKSP'),
        dispatchedKSP: sumIf('DISPATCH', '$totalKSP'),
        soldKSP: sumIf('SALE', '$totalKSP'),
        returnedKSP: sumIf('RETURN', '$totalKSP'),
        commission: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'SALE'] }, { $eq: ['$commissionStatus', 'CREDITED'] }] }, '$commissionAmount', 0] } }
      }
    },
    {
      $addFields: {
        balanceQty: { $subtract: ['$liftedQty', { $add: ['$dispatchedQty', '$soldQty', '$returnedQty'] }] },
        balanceKBP: { $subtract: ['$liftedKBP', { $add: ['$dispatchedKBP', '$soldKBP', '$returnedKBP'] }] },
        balanceKSP: { $subtract: ['$liftedKSP', { $add: ['$dispatchedKSP', '$soldKSP', '$returnedKSP'] }] }
      }
    },
    { $sort: { '_id.productId': 1 } }
  ]);
};

const STOCK_TOTAL_KEYS = [
  'liftedQty', 'dispatchedQty', 'soldQty', 'returnedQty', 'balanceQty',
  'liftedKBP', 'dispatchedKBP', 'soldKBP', 'returnedKBP', 'balanceKBP',
  'liftedKSP', 'dispatchedKSP', 'soldKSP', 'balanceKSP', 'commission'
];

const sumStock = (rows) => rows.reduce((t, r) => {
  for (const k of STOCK_TOTAL_KEYS) t[k] = round2((t[k] || 0) + (r[k] || 0));
  return t;
}, {});

const productBalance = async (franchiseId, productId) => {
  const rows = await stockBalancesFor([franchiseId]);
  const row = rows.find((r) => r._id.productId === productId);
  return row ? row.balanceQty : 0;
};

const creditSaleCommission = async (entry, franchise) => {
  if (!(entry.commissionAmount > 0)) return entry;
  const result = await IncomeService.creditIncome(
    franchise.userId,
    entry.commissionAmount,
    'FRANCHISE_SALE_COMMISSION',
    entry._id,
    'FranchiseStockEntry',
    entry.totalKBP,
    entry.commissionRate,
    {
      productId: entry.productId,
      qty: entry.qty,
      saleValue: entry.totalKSP,
      buyerMemberId: entry.memberId || null,
      description: `Franchise sale commission — ${entry.qty} × ${entry.productName}`
    }
  );
  if (result?.transaction) {
    entry.commissionStatus = 'CREDITED';
    entry.incomeTransactionId = result.transaction._id;
  } else {
    entry.commissionStatus = 'FAILED';
  }
  await FranchiseStockEntry.updateOne(
    { _id: entry._id },
    { $set: { commissionStatus: entry.commissionStatus, incomeTransactionId: entry.incomeTransactionId } }
  );

  if (entry.commissionStatus === 'CREDITED') {
    Notification.create({
      userId: franchise.userId,
      type: 'FINANCIAL',
      priority: 'MEDIUM',
      title: 'Franchise sale commission credited',
      message: `₹${entry.commissionAmount.toLocaleString('en-IN')} commission for selling ${entry.qty} × ${entry.productName} was added to your Income wallet.`,
      icon: '💰',
      color: '#16a34a',
      action: '/member/franchise',
      actionLabel: 'View Franchise'
    }).catch((err) => console.error('Sale commission notification failed:', err.message));
  }
  return entry;
};

/**
 * Records a stock movement. Returns the saved entry.
 * @param {object} p
 * @param {object} p.franchise        Franchise document (lean is fine)
 * @param {string} p.type             LIFT | DISPATCH | SALE | RETURN
 * @param {string} p.recordedByRole   ADMIN | FRANCHISE | ADMIN_AS_FRANCHISE
 */
const createEntry = async ({
  franchise, type, productId, qty, memberRef, customerName, customerPhone,
  reference, note, entryDate, createdBy, recordedByRole = 'ADMIN'
}) => {
  const cleanType = String(type || '').toUpperCase();
  const cleanProductId = String(productId || '').trim();
  const cleanQty = Number(qty);

  if (!TYPES.includes(cleanType)) throw fail(400, 'Type must be Assign, Dispatch, Sale or Return.');
  if (recordedByRole !== 'ADMIN' && cleanType !== 'SALE') throw fail(403, 'Franchises can only record sales.');
  if (!cleanProductId) throw fail(400, 'Choose a product.');
  if (!Number.isInteger(cleanQty) || cleanQty < 1 || cleanQty > 100000) throw fail(400, 'Quantity must be a whole number from 1 to 100000.');
  if (franchise.status !== 'APPROVED' && ['LIFT', 'SALE'].includes(cleanType)) {
    throw fail(400, 'Only an approved franchise can receive stock or record sales.');
  }

  const product = await RepurchaseProduct.findOne({ id: cleanProductId }).lean();
  if (!product) throw fail(404, `Product ${cleanProductId} not found.`);

  let member = null;
  const ref = String(memberRef || '').trim();
  if (cleanType === 'DISPATCH' && !ref) throw fail(400, 'Enter the Member ID the product was dispatched to.');
  if (ref) {
    member = await findByMemberId(ref);
    if (!member) throw fail(404, `Member ${ref} not found.`);
  }
  const cleanCustomerName = String(customerName || '').trim().slice(0, 120);
  const cleanCustomerPhone = String(customerPhone || '').trim().slice(0, 20);
  if (cleanType === 'SALE' && !member && !cleanCustomerName) {
    throw fail(400, 'Enter the buyer: a Member ID, or the customer\'s name.');
  }
  if (cleanCustomerPhone && !/^[0-9+\-\s]{6,20}$/.test(cleanCustomerPhone)) throw fail(400, 'Enter a valid customer phone number.');

  let when = new Date();
  if (entryDate) {
    const d = new Date(entryDate);
    if (Number.isNaN(d.getTime()) || d > new Date(Date.now() + 86400000)) throw fail(400, 'Invalid entry date.');
    // Franchises can't back-date sales by more than 7 days (admins can).
    if (recordedByRole !== 'ADMIN' && d < new Date(Date.now() - 8 * 86400000)) throw fail(400, 'Sales can only be dated within the last 7 days.');
    when = d;
  }

  // Company warehouse stock moves out on LIFT, when tracked.
  let companyStockAdjusted = false;
  if (cleanType === 'LIFT' && product.stock !== null && product.stock !== undefined) {
    const updated = await RepurchaseProduct.findOneAndUpdate(
      { _id: product._id, stock: { $gte: cleanQty } },
      { $inc: { stock: -cleanQty } },
      { new: true }
    );
    if (!updated) throw fail(400, `Only ${product.stock} unit(s) of ${product.name} left in company stock.`);
    companyStockAdjusted = true;
  }

  let commissionRate = 0;
  if (cleanType === 'SALE') {
    const rates = await SettingsService.getFranchise();
    commissionRate = Number(rates.saleCommissionRate) || 0;
  }
  const totalKSP = round2((product.ksp || 0) * cleanQty);

  const entry = await FranchiseStockEntry.create({
    franchiseId: franchise._id,
    franchiseUserId: franchise.userId?._id || franchise.userId,
    type: cleanType,
    productId: product.id,
    productName: product.name,
    qty: cleanQty,
    kbpPerUnit: product.kbp || 0,
    kspPerUnit: product.ksp || 0,
    totalKBP: round2((product.kbp || 0) * cleanQty),
    totalKSP,
    memberUserId: member?._id || null,
    memberId: member?.memberId || null,
    memberName: member?.fullName || null,
    customerName: cleanType === 'SALE' ? cleanCustomerName : '',
    customerPhone: cleanType === 'SALE' ? cleanCustomerPhone : '',
    commissionRate,
    commissionAmount: cleanType === 'SALE' ? round2(totalKSP * commissionRate) : 0,
    commissionStatus: 'NONE',
    recordedByRole,
    reference: String(reference || '').trim().slice(0, 120),
    note: String(note || '').trim().slice(0, 500),
    entryDate: when,
    companyStockAdjusted,
    createdBy
  });

  // Outflows can't take a franchise below zero. Checked after the write so
  // two simultaneous entries can never both slip through.
  if (OUTFLOW.includes(cleanType)) {
    const balance = await productBalance(franchise._id, product.id);
    if (balance < 0) {
      await FranchiseStockEntry.deleteOne({ _id: entry._id });
      throw fail(400, `Not enough ${product.name} in stock. Available: ${Math.max(0, balance + cleanQty)} unit(s).`);
    }
    if (cleanType === 'RETURN' && product.stock !== null && product.stock !== undefined) {
      await RepurchaseProduct.updateOne({ _id: product._id }, { $inc: { stock: cleanQty } });
      await FranchiseStockEntry.updateOne({ _id: entry._id }, { $set: { companyStockAdjusted: true } });
      entry.companyStockAdjusted = true;
    }
  }

  if (cleanType === 'SALE') {
    await creditSaleCommission(entry, { userId: franchise.userId?._id || franchise.userId });
  }

  return entry;
};

/** Voids an entry (kept for audit, excluded from balances). Reverses company stock / sale commission. */
const voidEntry = async ({ entryId, reason, voidedBy }) => {
  if (!mongoose.isValidObjectId(entryId)) throw fail(400, 'Invalid entry id.');
  const cleanReason = String(reason || '').trim();
  if (cleanReason.length < 3) throw fail(400, 'Give a reason for voiding this entry.');

  const entry = await FranchiseStockEntry.findOneAndUpdate(
    { _id: entryId, voided: false },
    { $set: { voided: true, voidedAt: new Date(), voidedBy, voidReason: cleanReason.slice(0, 300) } },
    { new: true }
  );
  if (!entry) throw fail(404, 'Entry not found or already voided.');

  const unvoid = () => FranchiseStockEntry.updateOne(
    { _id: entry._id },
    { $set: { voided: false, voidedAt: null, voidedBy: null, voidReason: '' } }
  );

  // Voiding a LIFT removes stock from the franchise — refuse if it has already gone out.
  if (entry.type === 'LIFT') {
    const balance = await productBalance(entry.franchiseId, entry.productId);
    if (balance < 0) {
      await unvoid();
      throw fail(400, 'This stock has already been partly sold or dispatched. Void those entries first, or record a Return instead.');
    }
  }

  // Take back the commission paid on a voided sale.
  if (entry.type === 'SALE' && entry.commissionStatus === 'CREDITED' && entry.commissionAmount > 0) {
    try {
      await WalletService.debit(entry.franchiseUserId, entry.commissionAmount, 'ADMIN_ADJUSTMENT', entry.incomeTransactionId, {
        description: `Reversal of franchise sale commission — ${entry.qty} × ${entry.productName} (sale voided)`
      }, 'INCOME');
    } catch (err) {
      await unvoid();
      throw fail(400, `Can't void this sale: the ₹${entry.commissionAmount} commission couldn't be taken back from the franchise's Income wallet (${err.message}).`);
    }
    if (entry.incomeTransactionId) {
      await IncomeTransaction.updateOne(
        { _id: entry.incomeTransactionId },
        { $set: { status: 'REVERSED', reversalReason: `Sale voided: ${cleanReason.slice(0, 200)}` } }
      );
    }
    entry.commissionStatus = 'REVERSED';
    await FranchiseStockEntry.updateOne({ _id: entry._id }, { $set: { commissionStatus: 'REVERSED' } });
  }

  // Undo the company-stock movement this entry made.
  if (entry.companyStockAdjusted) {
    if (entry.type === 'LIFT') {
      await RepurchaseProduct.updateOne({ id: entry.productId, stock: { $ne: null } }, { $inc: { stock: entry.qty } });
    } else if (entry.type === 'RETURN') {
      await RepurchaseProduct.updateOne({ id: entry.productId, stock: { $gte: entry.qty } }, { $inc: { stock: -entry.qty } });
    }
  }

  return entry;
};

/**
 * Bill number for a SALE entry, e.g. FS-261124-3F09A2. Derived from the entry's
 * own creation date and id, so every sale (including ones recorded before bill
 * numbers existed) has a stable, unique number without a migration.
 */
const billNumberFor = (entry) => {
  const d = new Date(entry.createdAt || entry.entryDate || Date.now());
  const ist = new Date(d.getTime() + 330 * 60000);
  const yymmdd = ist.toISOString().slice(2, 10).replace(/-/g, '');
  return `FS-${yymmdd}-${String(entry._id).slice(-6).toUpperCase()}`;
};

module.exports = { stockBalancesFor, sumStock, productBalance, createEntry, voidEntry, billNumberFor, TYPES };
