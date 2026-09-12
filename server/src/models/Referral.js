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
  //
  // CRITICAL SCHEMA FIX: `unique: true` here used to put a single-field
  // unique index on userId ALONE — meaning MongoDB physically could not
  // store more than ONE Referral row per sponsored member, EVER, no matter
  // how many ancestor levels referral.service.js#repairAllReferrals (or the
  // original registration-time write) tried to create for them. Since this
  // collection is explicitly designed to hold up to 10 rows per member (one
  // per ancestor level 1-10 — see MAX_LEVEL in referral.service.js), every
  // member with 2+ ancestors could only ever get their LEVEL 1 row written;
  // every attempt to insert their level-2+ rows silently hit a duplicate-key
  // error. This is exactly what surfaced as "95 errors" when
  // repairAllReferrals was run for the first time — nearly every member
  // beyond the first sponsor level failed. The real uniqueness rule needed
  // is "one row per (sponsor, member) PAIR" — enforced below via a compound
  // unique index on {userId, sponsorId} instead, which still prevents a true
  // duplicate row while allowing the up-to-10 real ancestor rows a member is
  // supposed to have.
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
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
// The real uniqueness rule for this collection: one row per (member,
// sponsor) pair, not one row per member overall. See userId's field comment
// above for why this replaced a single-field `unique: true` on userId.
ReferralSchema.index({ userId: 1, sponsorId: 1 }, { unique: true });
ReferralSchema.index({ path: 1 });

const Referral = mongoose.model('Referral', ReferralSchema);
module.exports = Referral;