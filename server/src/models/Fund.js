// server/src/models/Fund.js
const mongoose = require('mongoose');

const FundSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true // Automatically creates index
  },
  order: {
    type: Number,
    required: true // Do NOT add index: true here
  },
  leftVolumeRequired: {
    type: Number,
    required: true,
    default: 0
  },
  rightVolumeRequired: {
    type: Number,
    required: true,
    default: 0
  },
  maintenanceLeftVolume: {
    type: Number,
    default: 0
  },
  maintenanceRightVolume: {
    type: Number,
    default: 0
  },
  ttoPercentage: {
    type: Number,
    required: true,
    default: 0.02 // 2% of TTO
  },
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Non-duplicate queries
FundSchema.index({ isActive: 1 });

module.exports = mongoose.models.Fund || mongoose.model('Fund', FundSchema);