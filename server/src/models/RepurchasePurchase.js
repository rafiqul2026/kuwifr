// server/src/models/RepurchasePurchase.js
const mongoose = require('mongoose');

/**
 * Pending manual-UPI Repurchase Store checkout awaiting admin payment
 * verification — mirrors PackagePurchase.js's role for package activations
 * (member submits UTR + screenshot here; RepurchaseService.
 * processRepurchaseDistribution / FundService.processRepurchaseKBPForFunds
 * only run once an admin approves, via repurchase.controller.js's
 * approveRepurchasePurchase).
 */
const repurchasePurchaseSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    memberId: {
      type: String,
      required: true
    },
    memberName: {
      type: String,
      required: true
    },
    items: [
      {
        productId: String,
        name: String,
        category: String,
        qty: Number,
        ksp: Number,
        kbp: Number,
        subtotalKSP: Number,
        subtotalKBP: Number
      }
    ],
    totalKSP: {
      type: Number,
      required: true
    },
    totalKBP: {
      type: Number,
      required: true
    },
    paymentMethod: {
      type: String,
      default: 'UPI_GATEWAY'
    },
    transactionId: {
      type: String,
      required: true,
      unique: true
    },
    paymentProof: {
      type: String,
      default: ''
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING_VERIFICATION', 'COMPLETED', 'FAILED'],
      default: 'PENDING_VERIFICATION'
    },
    adminRemarks: {
      type: String
    },
    // Set once approved — the real Order created for this repurchase.
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('RepurchasePurchase', repurchasePurchaseSchema);
