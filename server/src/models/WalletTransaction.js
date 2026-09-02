const mongoose = require('mongoose');

/**
 * Wallet Transaction Schema - Complete audit trail
 * Every financial transaction is recorded here permanently
 */
const WalletTransactionSchema = new mongoose.Schema({
  // Relationships
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Transaction Identification
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Transaction Details
  walletType: {
    type: String,
    enum: ['INCOME', 'REPURCHASE'],
    required: true
  },
  type: {
    type: String,
    enum: ['CREDIT', 'DEBIT'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0.01, 'Amount must be greater than 0']
  },
  balance: {
    type: Number,
    required: true,
    comment: 'Running balance after this transaction'
  },

  // Transaction Description
  description: {
    type: String,
    required: true
  },
  source: {
    type: String,
    required: true,
    enum: [
      'REFERRAL_INCOME',
      'MATCHING_INCOME',
      'LEADERSHIP_INCOME',
      'REPURCHASE_SELF',
      'REPURCHASE_DOWNLINE',
      'WITHDRAWAL',
      'PURCHASE',
      'RANK_REWARD',
      'FUND_REWARD',
      'ADMIN_ADJUSTMENT',
      'SYSTEM'
    ]
  },
  reference: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'referenceModel',
    default: null
  },
  referenceModel: {
    type: String,
    enum: ['Order', 'IncomeTransaction', 'Withdrawal', 'User'],
    default: null
  },

  // Additional Data
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Status
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED', 'REVERSED', 'CANCELLED'],
    default: 'COMPLETED'
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

  // Audit Information
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
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

// ============ METHODS ============

/**
 * Reverse this transaction
 */
WalletTransactionSchema.methods.reverse = async function(reason) {
  // Check if already reversed
  if (this.status === 'REVERSED') {
    throw new Error('Transaction already reversed');
  }

  // Create reverse transaction
  const Wallet = require('./Wallet');
  const wallet = await Wallet.findById(this.walletId);
  
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  const reverseAmount = this.type === 'CREDIT' ? -this.amount : this.amount;
  const reverseType = this.type === 'CREDIT' ? 'DEBIT' : 'CREDIT';

  // Update wallet balance
  const updateField = this.walletType === 'INCOME' ? 'incomeBalance' : 'repurchaseBalance';
  const newBalance = wallet[updateField] + reverseAmount;
  
  if (newBalance < 0) {
    throw new Error('Insufficient balance for reversal');
  }

  wallet[updateField] = newBalance;
  wallet.totalTransactions += 1;
  wallet.lastTransactionAt = new Date();
  await wallet.save();

  // Create reversal transaction
  const reversedTransaction = new WalletTransaction({
    walletId: this.walletId,
    userId: this.userId,
    walletType: this.walletType,
    transactionId: wallet.generateTransactionId(),
    type: reverseType,
    amount: Math.abs(this.amount),
    balance: newBalance,
    description: `REVERSAL: ${this.description}`,
    source: 'SYSTEM',
    reference: this._id,
    referenceModel: 'WalletTransaction',
    status: 'COMPLETED',
    metadata: {
      originalTransactionId: this.transactionId,
      reversalReason: reason
    }
  });
  await reversedTransaction.save();

  // Update original transaction
  this.status = 'REVERSED';
  this.reversedTransactionId = reversedTransaction.transactionId;
  this.reversalReason = reason;
  await this.save();

  return reversedTransaction;
};

// ============ INDEXES ============
WalletTransactionSchema.index({ walletId: 1, createdAt: -1 });
WalletTransactionSchema.index({ userId: 1, createdAt: -1 });
WalletTransactionSchema.index({ source: 1 });
WalletTransactionSchema.index({ reference: 1 });
WalletTransactionSchema.index({ status: 1 });

const WalletTransaction = mongoose.model('WalletTransaction', WalletTransactionSchema);
module.exports = WalletTransaction;