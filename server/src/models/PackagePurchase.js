// server/src/models/PackagePurchase.js
const mongoose = require('mongoose');

const packagePurchaseSchema = new mongoose.Schema(
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
    packageId: {
      type: String,
      required: true
    },
    packageName: {
      type: String,
      required: true
    },
    packagePrice: {
      type: Number,
      required: true
    },
    kbpPoints: {
      type: Number,
      default: 0
    },
    dailyBinaryCap: {
      type: Number,
      default: 0
    },
    selectedProduct: {
      productId: String,
      name: String,
      category: String,
      price: Number,
      image: String
    },
    paymentMethod: {
      type: String,
      default: 'CASH'
    },
    transactionId: {
      type: String,
      required: true,
      unique: true
    },
    paymentStatus: {
      // 'PENDING_VERIFICATION' is the status packagePurchase.controller.js
      // actually writes when a member submits a purchase (awaiting admin
      // approval of their UPI/gateway transaction reference) — it was
      // missing from this enum, so every member purchase submission was
      // rejected by Mongoose validation before it could ever be created.
      type: String,
      enum: ['COMPLETED', 'PENDING', 'PENDING_VERIFICATION', 'FAILED'],
      default: 'PENDING_VERIFICATION'
    },
    adminRemarks: {
      type: String
    },
    sponsorId: {
      type: String
    },
    kbp: {
      type: Number
    },
    receiptNumber: {
      type: String
    },
    activationDate: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PackagePurchase', packagePurchaseSchema);