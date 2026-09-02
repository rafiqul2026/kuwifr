const mongoose = require('mongoose');

/**
 * Kuwi Star Schema - Tracks individual star earnings
 * Stars are cumulative and never reset
 */
const KuwiStarSchema = new mongoose.Schema({
  // Member
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true  // ← This creates an index
  },

  // Star Details
  count: {
    type: Number,
    required: true,
    min: 1,
    comment: 'Number of stars earned in this transaction'
  },

  // Source
  source: {
    type: String,
    required: true,
    enum: [
      'DIRECT_SPONSOR',
      'DOWNLINE_JOIN',
      'PACKAGE_PURCHASE',
      'KBP_ACHIEVED',
      'RANK_BONUS',
      'CAMPAIGN_BONUS',
      'ADMIN_ADJUSTMENT'
    ]
  },
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'sourceModel',
    default: null
  },
  sourceModel: {
    type: String,
    enum: ['User', 'Order', 'Campaign', 'RankAchievement'],
    default: null
  },

  // Reason
  reason: {
    type: String,
    default: ''
  },

  // Running Total
  runningTotal: {
    type: Number,
    required: true,
    comment: 'Total stars after this addition'
  },

  // Status
  status: {
    type: String,
    enum: ['PENDING', 'ACTIVE', 'REVERSED'],
    default: 'ACTIVE'
  },

  // For reversals
  reversedTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'KuwiStar',
    default: null
  },

  // Audit
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// ============ INDEXES ============
// ✅ KEPT: userId index (for fast lookups)
// ✅ ADDED: compound index for userId + createdAt (for history)
// ✅ ADDED: source + sourceId index (for finding related stars)
KuwiStarSchema.index({ userId: 1, createdAt: -1 });
KuwiStarSchema.index({ source: 1, sourceId: 1 });

const KuwiStar = mongoose.model('KuwiStar', KuwiStarSchema);
module.exports = KuwiStar;