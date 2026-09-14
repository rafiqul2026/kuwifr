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
    paymentProof: {
      // Base64 UPI/bank-transfer screenshot the member uploads at submission
      // time. The controller has always written this field, but it was
      // missing from the schema so Mongoose silently dropped it on save —
      // the admin "View Proof" button had nothing to show.
      type: String,
      default: ''
    },
    // Distinguishes a fresh activation from a tier upgrade on an already-ACTIVE
    // member. Upgrades reuse this same pending-verification/admin-approval
    // pipeline, but `packagePrice` holds the AMOUNT PAYABLE (the price
    // difference), not the target package's full price — see
    // `targetPackagePrice` for that.
    purchaseType: {
      type: String,
      enum: ['NEW', 'UPGRADE'],
      default: 'NEW'
    },
    previousPackageId: { type: String },
    previousPackageName: { type: String },
    previousPackagePrice: { type: Number },
    targetPackagePrice: { type: Number },
    activationDate: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PackagePurchase', packagePurchaseSchema);