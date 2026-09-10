// server/src/models/FundQualification.js
const mongoose = require('mongoose');

const fundQualificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  fundCode: {
    type: String,
    enum: ['SCHOOL', 'FAMILY', 'TRAVELLING', 'LIFESTYLE', 'FOREIGN_TRIP', 'PENSION'],
    required: true
  },
  qualifiedAt: {
    type: Date,
    default: Date.now
  },
  matchedLeftKBP: {
    type: Number,
    default: 0
  },
  matchedRightKBP: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'SUSPENDED'],
    default: 'ACTIVE'
  },
  lastPayoutPeriod: {
    type: String // Format: "YYYY-MM"
  },
  // ============ MONTHLY MAINTENANCE TRACKING ============
  // Business plan: each Fund requires a smaller "New Business Matching" amount
  // on both legs EVERY month to keep receiving that fund's salary (e.g. School
  // Fund: 25K:25K to qualify, then 2.5K:2.5K new business every month to keep
  // getting paid). These counters accumulate NEW repurchase KBP seen during
  // `maintenancePeriod` (format "YYYY-MM") and are implicitly reset whenever a
  // new period is observed (see fund.service.js).
  maintenancePeriod: {
    type: String,
    default: null
  },
  maintenancePeriodLeftKBP: {
    type: Number,
    default: 0
  },
  maintenancePeriodRightKBP: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

fundQualificationSchema.index({ userId: 1, fundCode: 1 }, { unique: true });

module.exports = mongoose.model('FundQualification', fundQualificationSchema);