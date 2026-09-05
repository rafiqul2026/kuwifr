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
      default: 'UPI_GATEWAY'
    },
    transactionId: {
      type: String,
      required: true,
      unique: true
    },
    paymentStatus: {
      type: String,
      enum: ['COMPLETED', 'PENDING', 'FAILED'],
      default: 'COMPLETED'
    },
    activationDate: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PackagePurchase', packagePurchaseSchema);