// server/src/models/Offer.js
//
// Admin-controlled "offer" image slider shown on the Member Dashboard
// ("in the same location a slider showing admin-controlled offer images
// that can be changed whenever admin adds a new offer" — docx Section 2.4).
// Purely a lightweight image + optional link entity, distinct from the
// Campaign model (which carries targets/participants/rewards for
// milestone-style incentive campaigns) and from Notification (per-user
// broadcast messages) — an Offer is just a banner image in a carousel.
const mongoose = require('mongoose');

const OfferSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true },
    publicId: { type: String, default: null }, // Cloudinary public_id, for cleanup on delete/replace
    linkUrl: { type: String, default: '', trim: true }, // optional — where tapping the offer navigates
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 }, // lower = shown first in the slider
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

OfferSchema.index({ isActive: 1, order: 1 });

module.exports = mongoose.model('Offer', OfferSchema);