const mongoose = require('mongoose');

/**
 * Order Schema - Tracks all member orders
 */
const OrderSchema = new mongoose.Schema({
  // Order Identification
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Package Information
  packageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package',
    required: true
  },
  packageName: {
    type: String,
    required: true
  },
  packageType: {
    type: String,
    required: true
  },

  // Products in Order
  products: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    name: {
      type: String,
      required: true
    },
    sku: String,
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    price: {
      type: Number,
      required: true
    },
    kbp: {
      type: Number,
      required: true
    }
  }],

  // Pricing
  subtotal: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    default: 0
  },
  deliveryCharge: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },

  // KBP Generated
  kbpGenerated: {
    type: Number,
    default: 0
  },
  kbpBreakdown: {
    type: Map,
    of: Number
  },

  // Payment Information
  paymentType: {
    type: String,
    enum: ['ONLINE', 'OFFLINE'],
    required: true
  },

  // Online Payment (Razorpay)
  razorpayOrderId: {
    type: String
  },
  razorpayPaymentId: {
    type: String
  },
  razorpaySignature: {
    type: String
  },

  // Offline Payment (UPI/QR)
  offlinePayment: {
    upiId: String,
    qrCodeUrl: String,
    screenshot: {
      url: String,
      publicId: String,
      uploadedAt: Date
    },
    transactionId: String,
    paymentDate: Date,
    remarks: String
  },

  // Payment Status
  paymentStatus: {
    type: String,
    enum: [
      'PENDING',
      'PAYMENT_INITIATED',
      'PAYMENT_COMPLETED',
      'PAYMENT_FAILED',
      'AWAITING_VERIFICATION',
      'VERIFICATION_PENDING',
      'VERIFIED',
      'REJECTED',
      'REFUNDED'
    ],
    default: 'PENDING'
  },

  // Verification (for offline payments)
  verification: {
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedAt: Date,
    verificationRemarks: String,
    rejectionReason: String,
    verificationAttempts: {
      type: Number,
      default: 0
    }
  },

  // Order Status
  orderStatus: {
    type: String,
    enum: [
      'PENDING',
      'PAID',
      'PROCESSING',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
      'REFUNDED',
      'PROCESSING_FAILED'
    ],
    default: 'PENDING'
  },

  // Delivery Information
  deliveryAddress: {
    fullName: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    pincode: String,
    phoneNumber: String,
    landmark: String
  },

  // Tracking
  trackingNumber: String,
  shippingDate: Date,
  deliveredDate: Date,

  // Status History
  statusHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

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

// Generate Order Number before saving
OrderSchema.pre('save', function(next) {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.orderNumber = `ORD${year}${month}${day}${random}`;
  }
  next();
});

// Compound Indexes for fast queries
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ paymentStatus: 1, orderStatus: 1 });
OrderSchema.index({ 'offlinePayment.transactionId': 1 }, { sparse: true });

module.exports = mongoose.models.Order || mongoose.model('Order', OrderSchema);