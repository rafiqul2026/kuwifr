const mongoose = require('mongoose');

/**
 * Package Schema - Defines the structure of packages/products
 */
const PackageSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Package name is required'],
    unique: true,  // ← This automatically creates an index
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['STARTER', 'GROWTH', 'LIFE_SAFE', 'LIFE_SAFE_ELITE', 'TITANIUM'],
    required: true,
    unique: true  // ← This automatically creates an index
  },

  // Pricing
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  kbp: {
    type: Number,
    required: true,
    min: [0, 'KBP cannot be negative']
  },

  // Income Caps
  dailyCap: {
    type: Number,
    required: true,
    min: [0, 'Daily cap cannot be negative']
  },
  weeklyCap: {
    type: Number,
    required: true,
    min: [0, 'Weekly cap cannot be negative']
  },
  monthlyCap: {
    type: Number,
    required: true,
    min: [0, 'Monthly cap cannot be negative']
  },

  // Products included in a package are NOT stored here — per business rule,
  // Buy Package's "included product" choices are the same catalog as the
  // Repurchase Store (RepurchaseProduct, admin-managed at
  // /admin/products), resolved dynamically by matching a package's `price`
  // against that catalog's `ksp` (see
  // client/src/pages/member/packageProductCatalog.js). This field used to
  // exist but was never actually read or written by any controller/admin
  // UI — always empty on every real document.

  // Features and Benefits
  features: [String],
  benefits: [String],

  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },

  // Display
  imageUrl: String,
  badge: String,

  // SEO
  metaTitle: String,
  metaDescription: String
}, {
  timestamps: true
});

// ============ INDEXES ============
// Only add indexes for fields that don't have unique:true
PackageSchema.index({ isActive: 1 });    // For filtering active packages
PackageSchema.index({ price: 1 });        // For sorting by price

const Package = mongoose.model('Package', PackageSchema);
module.exports = Package;