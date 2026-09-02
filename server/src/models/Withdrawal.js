const mongoose = require('mongoose');

/**
 * Withdrawal Schema - Tracks all withdrawal requests
 * Complete audit trail with TDS and admin charges
 */
const WithdrawalSchema = new mongoose.Schema({
  // Member Information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true  // ← This creates an index
  },

  // Withdrawal Details
  withdrawalNumber: {
    type: String,
    required: true,
    unique: true  // ← This automatically creates an index
  },
  grossAmount: {
    type: Number,
    required: true,
    min: [100, 'Minimum withdrawal amount is ₹100']
  },

  // Deductions
  adminCharge: {
    type: Number,
    required: true,
    default: 0,
    comment: '5% admin charge'
  },
  adminChargeRate: {
    type: Number,
    default: 0.05,
    comment: '5% admin charge rate'
  },
  tdsAmount: {
    type: Number,
    required: true,
    default: 0,
    comment: '5% TDS'
  },
  tdsRate: {
    type: Number,
    default: 0.05,
    comment: '5% TDS rate'
  },
  serviceCharge: {
    type: Number,
    default: 0,
    comment: 'No service charge (cancelled)'
  },
  netAmount: {
    type: Number,
    required: true,
    comment: 'Amount payable after deductions'
  },

  // Bank Details
  bankDetails: {
    accountName: {
      type: String,
      required: true
    },
    accountNumber: {
      type: String,
      required: true
    },
    bankName: {
      type: String,
      required: true
    },
    ifscCode: {
      type: String,
      required: true
    },
    upiId: {
      type: String,
      default: ''
    },
    panNumber: {
      type: String,
      required: true
    }
  },

  // TDS Reconciliation
  tdsReconciliation: {
    status: {
      type: String,
      enum: ['PENDING', 'RECONCILED', 'REFUNDED', 'FAILED'],
      default: 'PENDING'
    },
    referenceNumber: {
      type: String,
      default: null
    },
    refundDate: {
      type: Date,
      default: null
    },
    refundAmount: {
      type: Number,
      default: 0
    },
    notes: {
      type: String,
      default: ''
    },
    reconciledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reconciledAt: {
      type: Date,
      default: null
    }
  },

  // Status Workflow
  status: {
    type: String,
    enum: [
      'PENDING',
      'APPROVED',
      'REJECTED',
      'PROCESSING',
      'PROCESSED',
      'FAILED',
      'CANCELLED'
    ],
    default: 'PENDING',
    index: true
  },

  // Approval Details
  approval: {
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    },
    rejectionReason: {
      type: String,
      default: null
    },
    notes: {
      type: String,
      default: ''
    }
  },

  // Payment Details
  payment: {
    transactionId: {
      type: String,
      default: null,
      comment: 'Bank/UPI transaction ID'
    },
    processedAt: {
      type: Date,
      default: null
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    utrNumber: {
      type: String,
      default: null,
      comment: 'UTR number for bank transfer'
    },
    paymentMethod: {
      type: String,
      enum: ['BANK_TRANSFER', 'UPI', 'CHEQUE', 'CASH'],
      default: null
    }
  },

  // Status History
  statusHistory: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: {
      type: String,
      default: ''
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Audit
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },

  // Timestamps
  requestedAt: {
    type: Date,
    default: Date.now
  },
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

// Generate withdrawal number before saving
WithdrawalSchema.pre('save', function(next) {
  if (!this.withdrawalNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.withdrawalNumber = `WIT${year}${month}${day}${random}`;
  }
  next();
});

// ============ INDEXES ============
// ✅ REMOVED: withdrawalNumber index (already has unique:true)
// ✅ KEPT: userId + createdAt compound index (for fast queries)
// ✅ KEPT: status + createdAt compound index (for admin queries)
WithdrawalSchema.index({ userId: 1, createdAt: -1 });
WithdrawalSchema.index({ status: 1, createdAt: 1 });

const Withdrawal = mongoose.model('Withdrawal', WithdrawalSchema);
module.exports = Withdrawal;