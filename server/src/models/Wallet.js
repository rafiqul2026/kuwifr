// server/src/models/Wallet.js
const mongoose = require('mongoose');

/**
 * Wallet Schema - Tracks member balances
 * Supports Income, Repurchase, and Monthly Salary Wallets
 */
const WalletSchema = new mongoose.Schema(
  {
    // Reference to user (unique creates index automatically)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },

    // ============ INCOME WALLET ============
    incomeBalance: {
      type: Number,
      default: 0,
      min: [0, 'Income balance cannot be negative'],
      comment: 'Balance in income wallet (referral, matching, leadership)'
    },

    // ============ REPURCHASE WALLET ============
    repurchaseBalance: {
      type: Number,
      default: 0,
      min: [0, 'Repurchase balance cannot be negative'],
      comment: 'Balance in repurchase wallet (from repurchase income)'
    },

    // ============ SALARY INCOME WALLET ============
    salaryBalance: {
      type: Number,
      default: 0,
      min: [0, 'Salary balance cannot be negative'],
      comment: 'Balance from 1% Team Turn Over (TTO) monthly salary'
    },
    totalSalaryEarned: {
      type: Number,
      default: 0,
      min: [0, 'Total salary earned cannot be negative'],
      comment: 'Lifetime accumulated salary payouts'
    },

    // ============ TOTALS ============
    totalIncome: {
      type: Number,
      default: 0,
      comment: 'Lifetime total income earned'
    },
    totalWithdrawn: {
      type: Number,
      default: 0,
      comment: 'Lifetime total withdrawn'
    },
    totalRepurchased: {
      type: Number,
      default: 0,
      comment: 'Lifetime total repurchased'
    },

    // ============ TRANSACTION COUNTS ============
    totalTransactions: {
      type: Number,
      default: 0
    },
    lastTransactionAt: {
      type: Date,
      default: null
    },

    // ============ VERIFICATION ============
    isVerified: {
      type: Boolean,
      default: true,
      comment: 'If false, wallet is locked for transactions'
    },
    verificationRemarks: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// ============ VIRTUAL FIELDS ============

// Total balance across all wallets
WalletSchema.virtual('totalBalance').get(function () {
  return (this.incomeBalance || 0) + (this.repurchaseBalance || 0) + (this.salaryBalance || 0);
});

// ============ METHODS ============

/**
 * Update wallet balance and record transaction safely
 */
WalletSchema.methods.updateBalance = async function (amount, type, transactionData = {}) {
  const WalletTransaction = require('./WalletTransaction');

  let updateField;
  let newBalance;

  if (type === 'INCOME') {
    updateField = 'incomeBalance';
    newBalance = this.incomeBalance + amount;
    if (newBalance < 0) throw new Error('Insufficient income balance');
  } else if (type === 'REPURCHASE') {
    updateField = 'repurchaseBalance';
    newBalance = this.repurchaseBalance + amount;
    if (newBalance < 0) throw new Error('Insufficient repurchase balance');
  } else if (type === 'SALARY') {
    updateField = 'salaryBalance';
    newBalance = this.salaryBalance + amount;
    if (newBalance < 0) throw new Error('Insufficient salary balance');
    if (amount > 0) {
      this.totalSalaryEarned = (this.totalSalaryEarned || 0) + amount;
    }
  } else {
    throw new Error('Invalid wallet type specified');
  }

  // Update chosen balance
  this[updateField] = newBalance;
  this.totalTransactions += 1;
  this.lastTransactionAt = new Date();
  await this.save();

  // Create audit transaction record
  const transaction = new WalletTransaction({
    walletId: this._id,
    userId: this.userId,
    walletType: type,
    transactionId: transactionData.transactionId || this.generateTransactionId(),
    type: transactionData.type || (amount >= 0 ? 'CREDIT' : 'DEBIT'),
    amount: Math.abs(amount),
    balance: newBalance,
    description: transactionData.description || 'Wallet balance adjustment',
    source: transactionData.source || 'SYSTEM',
    reference: transactionData.reference || null,
    status: 'COMPLETED',
    metadata: transactionData.metadata || {},
    ipAddress: transactionData.ipAddress || null,
    userAgent: transactionData.userAgent || null
  });

  await transaction.save();
  return transaction;
};

/**
 * Generate unique transaction ID
 */
WalletSchema.methods.generateTransactionId = function () {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `TXN-${timestamp}-${random}`.toUpperCase();
};

/**
 * Get transaction history with pagination
 */
WalletSchema.methods.getTransactionHistory = async function (limit = 50, skip = 0) {
  const WalletTransaction = require('./WalletTransaction');

  const transactions = await WalletTransaction.find({ walletId: this._id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await WalletTransaction.countDocuments({ walletId: this._id });

  return {
    transactions,
    pagination: {
      total,
      limit,
      skip,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get balance summary
 */
WalletSchema.methods.getBalanceSummary = function () {
  return {
    incomeBalance: this.incomeBalance,
    repurchaseBalance: this.repurchaseBalance,
    salaryBalance: this.salaryBalance || 0,
    totalSalaryEarned: this.totalSalaryEarned || 0,
    totalBalance: this.totalBalance,
    totalIncome: this.totalIncome,
    totalWithdrawn: this.totalWithdrawn,
    totalRepurchased: this.totalRepurchased
  };
};

// ============ INDEXES ============
WalletSchema.index({ updatedAt: -1 });

const Wallet = mongoose.model('Wallet', WalletSchema);
module.exports = Wallet;