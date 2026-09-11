// server/src/models/Franchise.js
//
// Franchise system: a member applies to become an official Franchise; an
// admin approves or rejects that application. Once APPROVED, the member's
// own full downline (any depth, via User.sponsorId — the same authoritative
// relationship DownlineService.getFullDownline already computes elsewhere)
// becomes their "territory": they get a dedicated Franchise dashboard
// showing territory stats and franchise-specific income, and they can view
// (not edit — see FranchisePage.jsx) the members inside that territory.
// income.service.js#processFranchiseOverrides credits the two admin-
// configurable franchise rates (Setting.compensation.franchise) to whichever
// APPROVED franchise is nearest above a buyer in the sponsor chain.
const mongoose = require('mongoose');

const FranchiseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },

    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'REVOKED'],
      default: 'PENDING',
      index: true
    },

    // Freeform note the applicant can submit with their application
    // (e.g. "I have 40 active members in my downline in Assam").
    applicationNote: { type: String, default: '', trim: true },

    appliedAt: { type: Date, default: Date.now },
    decidedAt: { type: Date, default: null },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectionReason: { type: String, default: '', trim: true },

    // Snapshot of the rates in effect at approval time, purely for audit
    // display — the LIVE rates always come from SettingsService at the
    // moment an order is actually processed, these are never read back into
    // the income calculation.
    approvedRatesSnapshot: {
      kspRate: { type: Number, default: null },
      kbpLifetimeRate: { type: Number, default: null }
    }
  },
  { timestamps: true }
);

FranchiseSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Franchise', FranchiseSchema);