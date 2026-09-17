// server/src/models/RepurchaseProduct.js
const mongoose = require('mongoose');

/**
 * Repurchase Store catalog — previously a hardcoded array inside
 * repurchase.controller.js (REPURCHASE_PRODUCTS) with no way to attach real
 * product photos. Now a real collection so admin can manage products and
 * upload up to 4 original photos per product from the Admin Panel, the same
 * way an e-commerce platform would.
 *
 * `id` is the stable, human-readable slug (e.g. 'kfr-p01') that
 * RepurchasePurchase.items[].productId, cart state on the client, and
 * priceCart() in repurchase.controller.js all key off — kept distinct from
 * Mongo's own `_id` so existing purchase history / cart references never
 * break even though the catalog is now DB-backed.
 */
const repurchaseProductSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      trim: true
    },
    mrp: {
      type: Number,
      required: true
    },
    ksp: {
      type: Number,
      required: true
    },
    kbp: {
      type: Number,
      required: true
    },
    // Up to 4 original product photos, admin-uploaded via Cloudinary — see
    // repurchase.controller.js's createRepurchaseProduct/updateRepurchaseProduct.
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true }
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    },
    // Controls display order on the member-facing Repurchase Store grid.
    sortOrder: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('RepurchaseProduct', repurchaseProductSchema);
