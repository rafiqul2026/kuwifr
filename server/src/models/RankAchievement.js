const mongoose = require('mongoose');

/**
 * Rank Achievement Schema - Tracks member rank achievements
 * Once achieved, ranks are permanent
 */
const RankAchievementSchema = new mongoose.Schema({
  // Member
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true  // ← This creates an index
  },

  // Rank
  rankId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Rank',
    required: true
  },
  rankName: {
    type: String,
    required: true
  },
  rankLevel: {
    type: Number,
    required: true
  },

  // Achievement Details
  starsAtAchievement: {
    type: Number,
    required: true,
    comment: 'Total Kuwi Stars when rank was achieved'
  },
  achievedAt: {
    type: Date,
    default: Date.now
  },

  // Reward
  reward: {
    type: String,
    default: ''
  },
  rewardStatus: {
    type: String,
    enum: ['PENDING', 'PROCESSED', 'DELIVERED', 'NOT_APPLICABLE'],
    default: 'PENDING'
  },
  rewardDeliveredAt: {
    type: Date,
    default: null
  },

  // Status
  status: {
    type: String,
    enum: ['ACHIEVED', 'ACTIVE', 'EXPIRED', 'REVOKED'],
    default: 'ACHIEVED'
  },

  // Audit
  notes: {
    type: String,
    default: ''
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Timestamps
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
// ✅ ADDED: compound index for userId + rankLevel (for sorting)
// ✅ ADDED: unique compound index for userId + rankId (prevents duplicates)
RankAchievementSchema.index({ userId: 1, rankLevel: -1 });
RankAchievementSchema.index({ userId: 1, rankId: 1 }, { unique: true });

const RankAchievement = mongoose.model('RankAchievement', RankAchievementSchema);
module.exports = RankAchievement;