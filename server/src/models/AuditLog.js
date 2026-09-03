// server/src/models/AuditLog.js
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true
    },
    module: {
      type: String,
      enum: ['AUTH', 'ORDERS', 'WITHDRAWALS', 'PRODUCTS', 'RANKS', 'FUNDS', 'RULES', 'CAMPAIGNS', 'NOTIFICATIONS', 'SETTINGS', 'MEMBERS'],
      default: 'SETTINGS'
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    adminEmail: {
      type: String,
      default: 'admin@kuwifr.com'
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1'
    },
    severity: {
      type: String,
      enum: ['INFO', 'WARNING', 'CRITICAL'],
      default: 'INFO'
    },
    details: {
      type: String,
      default: ''
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);