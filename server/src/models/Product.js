const mongoose = require('mongoose');

/**
 * Product Schema - Defines products available for purchase
 */
const ProductSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  sku: {
    type: String,
    required: true,
    unique: true,  // ← This automatically creates an index
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  shortDescription: {
    type: String,
    default: ''
  },

  // Pricing
  mrp: {
    type: Number,
    required: true,
    min: [0, 'MRP cannot be negative']
  },
  ksp: {
    type: Number,
    required: true,
    min: [0, 'KSP cannot be negative']
  },
  kbp: {
    type: Number,
    required: true,
    min: [0, 'KBP cannot be negative'],
    comment: 'Kuwi Business Point - Used for all income calculations'
  },

  // Category and Tags
  category: {
    type: String,
    required: true,
    enum: [
      'HAIR_CARE',
      'SKIN_CARE',
      'HEALTH_SUPPLEMENT',
      'CLOTHING',
      'WATER_PURIFIER',
      'ELECTRONICS',
      'VEHICLE',
      'FOOD',
      'OTHER'
    ]
  },
  subCategory: {
    type: String,
    default: ''
  },
  tags: [{
    type: String,
    trim: true
  }],

  // Inventory
  stock: {
    type: Number,
    default: 0,
    min: [0, 'Stock cannot be negative']
  },
  isInStock: {
    type: Boolean,
    default: true
  },
  lowStockThreshold: {
    type: Number,
    default: 10
  },

  // Images
  images: [{
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String
    },
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],

  // Specifications
  specifications: {
    type: Map,
    of: String,
    default: {}
  },

  // Delivery and Warranty
  weight: {
    type: Number,
    default: 0
  },
  dimensions: {
    length: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 }
  },
  warranty: {
    type: String,
    default: ''
  },
  returnPolicy: {
    type: String,
    default: ''
  },

  // Legal
  countryOfOrigin: {
    type: String,
    default: 'India'
  },
  legalDeclarations: {
    type: String,
    default: ''
  },
  healthClaims: {
    type: String,
    default: ''
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },

  // SEO
  metaTitle: {
    type: String,
    default: ''
  },
  metaDescription: {
    type: String,
    default: ''
  },
  slug: {
    type: String,
    unique: true,  // ← This automatically creates an index
    lowercase: true,
    trim: true
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

// Generate slug from product name
ProductSchema.pre('save', function(next) {
  if (!this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

// Check if product is in stock
ProductSchema.virtual('inStock').get(function() {
  return this.isInStock && this.stock > 0;
});

// ============ INDEXES ============
// ✅ REMOVED: sku index (already has unique:true)
// ✅ REMOVED: slug index (already has unique:true)
// ✅ KEPT: category index for filtering
// ✅ KEPT: isActive + isInStock compound index
// ✅ KEPT: kbp index for sorting
ProductSchema.index({ category: 1 });
ProductSchema.index({ isActive: 1, isInStock: 1 });
ProductSchema.index({ kbp: 1 });

const Product = mongoose.model('Product', ProductSchema);
module.exports = Product;