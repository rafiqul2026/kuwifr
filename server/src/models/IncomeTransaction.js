const mongoose = require('mongoose');

/**
 * Income Transaction Schema - Records all income events
 * Complete audit trail for every income credit
 */
const IncomeTransactionSchema = new mongoose.Schema({
  // Relationships
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Income Identification
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Income Type
  type: {
    type: String,
    enum: [
      'REFERRAL_INCOME',
      'MATCHING_INCOME',
      'LEADERSHIP_INCOME_L1',
      'LEADERSHIP_INCOME_L2',
      'LEADERSHIP_INCOME_L3',
      'REPURCHASE_SELF',
      'REPURCHASE_DOWNLINE',
      'RANK_SALARY',
      'FUND_INCOME'
    ],
    required: true,
    index: true
  },

  // Source Reference
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'sourceModel',
    required: true,
    index: true
  },
  sourceModel: {
    type: String,
    enum: ['Order', 'User', 'Referral', 'BinaryNode', 'Withdrawal'],
    required: true
  },

  // KBP Details
  kbp: {
    type: Number,
    required: true,
    min: [0, 'KBP cannot be negative']
  },
  rate: {
    type: Number,
    required: true,
    min: [0, 'Rate cannot be negative'],
    max: [1, 'Rate cannot exceed 1']
  },

  // Income Calculation
  grossAmount: {
    type: Number,
    required: true,
    min: [0, 'Gross amount cannot be negative'],
    comment: 'Income before cap application'
  },
  capAdjustment: {
    type: Number,
    default: 0,
    comment: 'Amount reduced due to caps'
  },
  creditedAmount: {
    type: Number,
    required: true,
    min: [0, 'Credited amount cannot be negative'],
    comment: 'Final amount credited after caps'
  },

  // Wallet Information
  walletType: {
    type: String,
    enum: ['INCOME', 'REPURCHASE'],
    required: true
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true
  },

  // Cap Breakdown
  capBreakdown: {
    daily: {
      consumed: { type: Number, default: 0 },
      remaining: { type: Number, default: 0 },
      cap: { type: Number, default: 0 }
    },
    weekly: {
      consumed: { type: Number, default: 0 },
      remaining: { type: Number, default: 0 },
      cap: { type: Number, default: 0 }
    },
    monthly: {
      consumed: { type: Number, default: 0 },
      remaining: { type: Number, default: 0 },
      cap: { type: Number, default: 0 }
    }
  },

  // Additional Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Status
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'CREDITED', 'FAILED', 'REVERSED'],
    default: 'PENDING',
    index: true
  },

  // For reversals
  reversedTransactionId: {
    type: String,
    default: null
  },
  reversalReason: {
    type: String,
    default: null
  },

  // Audit
  processedAt: {
    type: Date,
    default: null
  },
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

// ============ METHODS ============

/**
 * Format income for display
 */
IncomeTransactionSchema.methods.format = function() {
  return {
    transactionId: this.transactionId,
    type: this.type,
    amount: this.creditedAmount,
    grossAmount: this.grossAmount,
    capAdjustment: this.capAdjustment,
    kbp: this.kbp,
    rate: this.rate,
    status: this.status,
    createdAt: this.createdAt,
    metadata: this.metadata
  };
};

/**
 * Reverse this transaction
 */
IncomeTransactionSchema.methods.reverse = async function(reason, userId) {
  // Check if already reversed
  if (this.status === 'REVERSED') {
    throw new Error('Transaction already reversed');
  }

  // Create reverse transaction (will be handled by income service)
  this.status = 'REVERSED';
  this.reversedTransactionId = `REV-${this.transactionId}`;
  this.reversalReason = reason;
  await this.save();

  return this;
};

// ============ INDEXES ============
IncomeTransactionSchema.index({ userId: 1, type: 1 });
IncomeTransactionSchema.index({ userId: 1, createdAt: -1 });
IncomeTransactionSchema.index({ sourceId: 1, sourceModel: 1 });
IncomeTransactionSchema.index({ status: 1, createdAt: 1 });

const IncomeTransaction = mongoose.model('IncomeTransaction', IncomeTransactionSchema);
module.exports = IncomeTransaction;