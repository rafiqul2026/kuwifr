// server/src/models/SalaryLog.js
const mongoose = require('mongoose');

const SalaryLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    month: {
      type: String, // Format: "YYYY-MM" (e.g., "2026-09")
      required: true,
      index: true
    },
    // Rank Verification
    rankAtEvaluation: {
      type: String,
      default: 'Gold Star'
    },
    totalStarAtEvaluation: {
      type: Number,
      default: 0
    },
    // Baseline starting values (from prior month end)
    startingLeftStar: {
      type: Number,
      default: 0
    },
    startingRightStar: {
      type: Number,
      default: 0
    },
    // Current evaluated star volumes
    currentLeftStar: {
      type: Number,
      default: 0
    },
    currentRightStar: {
      type: Number,
      default: 0
    },
    // Net growth values during the month
    leftGrowth: {
      type: Number,
      default: 0
    },
    rightGrowth: {
      type: Number,
      default: 0
    },
    totalGrowth: {
      type: Number,
      default: 0
    },
    growthPercentageAchieved: {
      type: Number,
      default: 0
    },
    // 50:50 ratio condition verified
    isRatioBalanced: {
      type: Boolean,
      default: false
    },
    // Final Qualification Flag
    isQualified: {
      type: Boolean,
      default: false
    },
    disqualificationReason: {
      type: String,
      default: ''
    },
    // Financial Payout
    teamTurnoverAmount: {
      type: Number,
      default: 0,
      comment: 'Total Team Turn Over (TTO) in Rupees for evaluated month'
    },
    salaryPercentage: {
      type: Number,
      default: 1 // 1%
    },
    salaryAmount: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSED', 'DISQUALIFIED'],
      default: 'PENDING'
    },
    processedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

// One audit log per member per month
SalaryLogSchema.index({ userId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('SalaryLog', SalaryLogSchema);