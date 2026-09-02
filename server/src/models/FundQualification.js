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
  }
}, { timestamps: true });

fundQualificationSchema.index({ userId: 1, fundCode: 1 }, { unique: true });

module.exports = mongoose.model('FundQualification', fundQualificationSchema);