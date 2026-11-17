// server/src/utils/stock.js
//
// Product stock (RepurchaseProduct.stock) — set by admins in Admin >
// Products. `stock: null` means the product's stock is not tracked
// (unlimited), which is how every product behaves until an admin turns
// tracking on, so nothing changes for products nobody has stocked.
//
// - checkStock(): at checkout — refuses quantities above what's available.
// - deductStock(): when an admin approves the order, inside the approval's
//   transaction. Each decrement is conditional (stock >= qty), so two
//   approvals racing for the last units can't take stock below zero; if
//   any line can't be covered the caller aborts the whole transaction,
//   which also rolls back the decrements already made.
const RepurchaseProduct = require('../models/RepurchaseProduct');

const isTracked = (p) => p && typeof p.stock === 'number';

/** lines: [{ productId, qty }] -> Map(productId -> total qty) */
const totalsByProduct = (lines = []) => {
  const totals = new Map();
  for (const l of lines) {
    const id = l && (l.productId || l.id);
    if (!id) continue;
    const qty = Math.max(1, parseInt(l.qty ?? l.quantity, 10) || 1);
    totals.set(id, (totals.get(id) || 0) + qty);
  }
  return totals;
};

const shortageMessage = (p, wanted) =>
  p.stock <= 0
    ? `${p.name} is out of stock.`
    : `Only ${p.stock} of ${p.name} ${p.stock === 1 ? 'is' : 'are'} in stock (you asked for ${wanted}).`;

/** Returns null when every tracked product has enough stock, else a message. */
const checkStock = async (lines) => {
  const totals = totalsByProduct(lines);
  if (!totals.size) return null;
  const products = await RepurchaseProduct.find({ id: { $in: [...totals.keys()] } })
    .select('id name stock')
    .lean();
  for (const p of products) {
    const wanted = totals.get(p.id);
    if (isTracked(p) && p.stock < wanted) return shortageMessage(p, wanted);
  }
  return null;
};

/**
 * Deducts stock for tracked products. Returns { error } (caller must abort
 * its transaction) or { deducted: [{ productId, qty, remaining }] }.
 */
const deductStock = async (lines, session) => {
  const totals = totalsByProduct(lines);
  if (!totals.size) return { deducted: [] };

  const products = await RepurchaseProduct.find({ id: { $in: [...totals.keys()] } })
    .select('id name stock')
    .session(session || null)
    .lean();

  const deducted = [];
  for (const p of products) {
    if (!isTracked(p)) continue;
    const qty = totals.get(p.id);
    const updated = await RepurchaseProduct.findOneAndUpdate(
      { _id: p._id, stock: { $gte: qty } },
      { $inc: { stock: -qty } },
      { new: true, session: session || undefined, projection: { stock: 1 } }
    ).lean();
    if (!updated) {
      const fresh = await RepurchaseProduct.findById(p._id).select('name stock').session(session || null).lean();
      return {
        error: `Not enough stock to approve: ${shortageMessage(fresh || p, qty)} Restock it in Admin > Products, or reject this order.`
      };
    }
    deducted.push({ productId: p.id, qty, remaining: updated.stock });
  }
  return { deducted };
};

module.exports = { checkStock, deductStock, totalsByProduct };
