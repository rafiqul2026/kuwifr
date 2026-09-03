// server/src/models/AuditLog.js
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    adminEmail: {
      type: String,
      required: true
    },
    action: {
      type: String,
      required: true,
      trim: true
    },
    module: {
      type: String,
      required: true,
      enum: [
        'AUTH',
        'MEMBERS',
        'PACKAGES',
        'PRODUCTS',
        'ORDERS',
        'WITHDRAWALS',
        'RANKS',
        'FUNDS',
        'RULES',
        'CAMPAIGNS',
        'SETTINGS'
      ]
    },
    targetId: {
      type: String,
      default: null
    },
    previousData: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    newData: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    ipAddress: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILURE'],
      default: 'SUCCESS'
    }
  },
  {
    timestamps: true
  }
);

auditLogSchema.index({ module: 1, createdAt: -1 });
auditLogSchema.index({ adminId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);