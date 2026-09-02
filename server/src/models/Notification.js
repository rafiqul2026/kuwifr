const mongoose = require('mongoose');

/**
 * Notification Schema - Tracks all notifications
 * Supports in-app and email notifications
 */
const NotificationSchema = new mongoose.Schema({
  // Recipient
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Notification Type
  type: {
    type: String,
    required: true,
    enum: [
      'SYSTEM',
      'FINANCIAL',
      'ACHIEVEMENT',
      'CAMPAIGN',
      'ADMIN',
      'SECURITY',
      'REMINDER'
    ],
    index: true
  },

  // Priority
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    default: 'MEDIUM'
  },

  // Content
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  body: {
    type: String,
    default: ''
  },

  // Action/Link
  action: {
    type: String,
    default: null
  },
  actionLabel: {
    type: String,
    default: null
  },
  actionData: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Icon and Color
  icon: {
    type: String,
    default: '📢'
  },
  color: {
    type: String,
    default: '#2563eb'
  },

  // Status
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  },
  delivered: {
    type: Boolean,
    default: false
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: {
    type: Date,
    default: null
  },

  // Expiry
  expiresAt: {
    type: Date,
    default: null
  },

  // Source
  source: {
    type: String,
    enum: ['SYSTEM', 'ADMIN', 'AUTOMATED', 'CAMPAIGN'],
    default: 'SYSTEM'
  },
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'sourceModel',
    default: null
  },
  sourceModel: {
    type: String,
    enum: ['Order', 'Withdrawal', 'RankAchievement', 'FundQualification', 'Campaign', 'User'],
    default: null
  },

  // Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Status
  status: {
    type: String,
    enum: ['PENDING', 'SENT', 'READ', 'EXPIRED', 'FAILED'],
    default: 'PENDING'
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ type: 1, createdAt: -1 });
NotificationSchema.index({ expiresAt: 1 });

const Notification = mongoose.model('Notification', NotificationSchema);
module.exports = Notification;