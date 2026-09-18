// server/src/models/RepurchaseKbpLedger.js
const mongoose = require('mongoose');

/**
 * Dated, per-leg record of repurchase KBP credited to a member's binary
 * tree — one row per (ancestor, order). BinaryNode.leftRepurchaseKBP/
 * rightRepurchaseKBP (see fund.service.js#processRepurchaseKBPForFunds)
 * are plain running counters with no history, so there was previously no
 * way to answer "how much repurchase KBP landed on my left/right leg
 * today / this week" — only the lifetime total. This ledger exists purely
 * to answer that, the same way IncomeTransaction already backs "today's
 * income" elsewhere (see income.service.js#getConsumedIncome) — written
 * once at credit time, then aggregated by date range + side.
 */
const repurchaseKbpLedgerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    side: {
      type: String,
      enum: ['LEFT', 'RIGHT'],
      required: true
    },
    kbp: {
      type: Number,
      required: true
    },
    // The repurchasing member whose order generated this credit — purely
    // for traceability/support lookups, not read by the aggregation.
    sourceUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

repurchaseKbpLedgerSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('RepurchaseKbpLedger', repurchaseKbpLedgerSchema);
