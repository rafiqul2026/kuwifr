const mongoose = require('mongoose');

/**
 * Referral Schema - Tracks all referral relationships
 * Stores the complete referral chain (levels 1-10)
 */
const ReferralSchema = new mongoose.Schema({
  // Who sponsored
  sponsorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Who was sponsored
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },

  // Level in the referral chain (1-10)
  level: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },

  // Direct parent (the person directly above)
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // The path from root to this user
  path: {
    type: String,
    required: true
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  },

  // KBP contributed by this referral
  kbpContribution: {
    type: Number,
    default: 0
  },

  // Income generated for sponsor
  incomeGenerated: {
    type: Number,
    default: 0
  },

  // Timestamps
  joinedAt: {
    type: Date,
    default: Date.now
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

// Compound indexes for faster queries
ReferralSchema.index({ sponsorId: 1, level: 1 });
ReferralSchema.index({ userId: 1, sponsorId: 1 });
ReferralSchema.index({ path: 1 });

const Referral = mongoose.model('Referral', ReferralSchema);
module.exports = Referral;