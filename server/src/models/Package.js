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
  // Optional — an empty description used to fail the whole save with a bare
  // "Validation Error" from Admin > Packages > Create.
  description: {
    type: String,
    trim: true,
    default: ''
  },
  // Stable tier code (STANDARD, STARTER, GROWTH, LIFE_SAFE, LIFE_SAFE_ELITE,
  // TITANIUM, ...). Was a fixed enum of the original tiers, which made it
  // impossible to create any new package from the admin panel; now any
  // well-formed code is accepted (package.controller.js normalizes input).
  type: {
    type: String,
    required: [true, 'Package type code is required'],
    trim: true,
    uppercase: true,
    match: [/^[A-Z][A-Z0-9_]{1,39}$/, 'Package type code must start with a letter and use only letters, numbers and underscores (e.g. LIFE_SAFE_ELITE).'],
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

  // Products a member can choose from when buying/upgrading to this package.
  // Per business rule these come from the same catalog as the Repurchase
  // Store (RepurchaseProduct, admin-managed at /admin/products).
  //
  // includedProductIds holds RepurchaseProduct.id slugs (e.g. 'kfr-p01') the
  // admin has explicitly assigned to this package from Admin > Packages.
  //   - undefined / never set: legacy automatic behaviour — every active
  //     product whose KSP equals this package's price is offered (see
  //     client/src/pages/member/packageProductCatalog.js).
  //   - an array (even an empty one): the admin's explicit choice wins and
  //     ONLY those products are offered.
  // `default: undefined` is deliberate — Mongoose otherwise defaults arrays
  // to [], which would make every existing package look "explicitly empty".
  includedProductIds: {
    type: [String],
    default: undefined
  },

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