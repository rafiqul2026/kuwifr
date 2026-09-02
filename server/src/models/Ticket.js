// server/src/models/Ticket.js
const mongoose = require('mongoose');

const ticketReplySchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderRole: {
    type: String,
    enum: ['MEMBER', 'ADMIN', 'SUPPORT'],
    default: 'MEMBER'
  },
  message: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const ticketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    unique: true,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: ['WITHDRAWAL_PAYOUT', 'REPURCHASE_KBP', 'KYC_VERIFICATION', 'BINARY_TREE', 'PACKAGE_ACTIVATION', 'GENERAL'],
    default: 'GENERAL'
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    default: 'MEDIUM'
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    default: 'OPEN'
  },
  replies: [ticketReplySchema],
  resolvedAt: {
    type: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);