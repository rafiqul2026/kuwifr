const mongoose = require('mongoose');

/**
 * TTO Record Schema - Tracks Team Turn Over calculations
 * TTO is calculated monthly for rank salaries and fund benefits
 */
const TTORecordSchema = new mongoose.Schema({
  // Member
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Period
  period: {
    type: String,
    required: true,
    comment: 'Format: YYYY-MM (e.g., 2026-08)'
  },
  periodStart: {
    type: Date,
    required: true
  },
  periodEnd: {
    type: Date,
    required: true
  },

  // TTO Details
  totalKBP: {
    type: Number,
    required: true,
    min: 0,
    comment: 'Total team KBP for this period'
  },
  leftTeamKBP: {
    type: Number,
    default: 0,
    comment: 'Left side team KBP'
  },
  rightTeamKBP: {
    type: Number,
    default: 0,
    comment: 'Right side team KBP'
  },
  activeMembers: {
    type: Number,
    default: 0,
    comment: 'Number of active members in team'
  },

  // Source Transactions
  sourceTransactions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],

  // Team Members
  teamMembers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    kbp: Number,
    side: {
      type: String,
      enum: ['left', 'right']
    }
  }],

  // Status
  status: {
    type: String,
    enum: ['PENDING', 'CALCULATED', 'APPROVED', 'FAILED'],
    default: 'PENDING'
  },

  // Audit
  calculatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  calculatedAt: {
    type: Date,
    default: null
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    default: ''
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

// Indexes
TTORecordSchema.index({ userId: 1, period: 1 }, { unique: true });
TTORecordSchema.index({ userId: 1, createdAt: -1 });
TTORecordSchema.index({ period: 1 });

const TTORecord = mongoose.model('TTORecord', TTORecordSchema);
module.exports = TTORecord;