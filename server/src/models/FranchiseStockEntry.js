// server/src/models/FranchiseStockEntry.js
//
// Franchise inventory ledger. Every movement of product stock between the
// company and a franchise (or from a franchise out to a member) is one row:
//
//   LIFT      company  -> franchise   (franchise picks up / buys stock)
//   DISPATCH  franchise -> member     (franchise hands a product to a member)
//   RETURN    franchise -> company    (unsold stock sent back)
//
// A franchise's balance of any product is LIFT - DISPATCH - RETURN over its
// non-voided rows, in units and in KBP. Rows are never edited or deleted;
// a mistake is corrected by voiding the row (kept for the audit trail).
//
// Product prices/KBP are copied onto the row at entry time so later catalog
// price changes never rewrite stock history.
const mongoose = require('mongoose');

const FranchiseStockEntrySchema = new mongoose.Schema(
  {
    franchiseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Franchise', required: true, index: true },
    franchiseUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // SALE: franchise sells a product (to a member or a walk-in customer) and
    // earns FRANCHISE_SALE_COMMISSION on it. Reduces stock like DISPATCH.
    type: { type: String, enum: ['LIFT', 'DISPATCH', 'SALE', 'RETURN'], required: true, index: true },

    // RepurchaseProduct.id (the stable slug, e.g. "kfr-p01") — the product ID
    // shown everywhere in the admin panel.
    productId: { type: String, required: true, trim: true, index: true },
    productName: { type: String, required: true, trim: true },

    qty: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      validate: { validator: Number.isInteger, message: 'Quantity must be a whole number' }
    },
    kbpPerUnit: { type: Number, default: 0, min: 0 },
    kspPerUnit: { type: Number, default: 0, min: 0 },
    totalKBP: { type: Number, default: 0, min: 0 },
    totalKSP: { type: Number, default: 0, min: 0 },

    // DISPATCH only: the member who received the product.
    memberUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    memberId: { type: String, default: null, trim: true },
    memberName: { type: String, default: null, trim: true },

    // SALE only: walk-in customer (when the buyer isn't a member).
    customerName: { type: String, default: '', trim: true, maxlength: 120 },
    customerPhone: { type: String, default: '', trim: true, maxlength: 20 },

    // SALE only: commission credited to the franchise for this sale.
    commissionRate: { type: Number, default: 0, min: 0, max: 1 },
    commissionAmount: { type: Number, default: 0, min: 0 },
    commissionStatus: { type: String, enum: ['NONE', 'CREDITED', 'FAILED', 'REVERSED'], default: 'NONE' },
    incomeTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'IncomeTransaction', default: null },

    // Who entered the row: an admin, the franchise itself, or an admin
    // using "Login as Member" on the franchise's account.
    recordedByRole: { type: String, enum: ['ADMIN', 'FRANCHISE', 'ADMIN_AS_FRANCHISE'], default: 'ADMIN' },

    reference: { type: String, default: '', trim: true, maxlength: 120 },
    note: { type: String, default: '', trim: true, maxlength: 500 },
    entryDate: { type: Date, default: Date.now, index: true },

    // Whether a LIFT/RETURN moved the company's tracked product stock, so a
    // void can reverse exactly what was done.
    companyStockAdjusted: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    voided: { type: Boolean, default: false, index: true },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    voidReason: { type: String, default: '', trim: true, maxlength: 300 }
  },
  { timestamps: true }
);

FranchiseStockEntrySchema.index({ franchiseId: 1, productId: 1, voided: 1 });
FranchiseStockEntrySchema.index({ franchiseId: 1, entryDate: -1 });

module.exports = mongoose.model('FranchiseStockEntry', FranchiseStockEntrySchema);
