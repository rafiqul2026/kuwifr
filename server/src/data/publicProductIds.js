// server/src/data/publicProductIds.js
//
// Mirrors the `id` + `category` of every entry in
// client/src/constants/productsData.js (KUWIFR_PRODUCTS) — the static
// catalog the live public storefront (/shop, /product/:id) actually renders
// from. The sitemap generator (seo.controller.js) needs this list to emit
// real /product/:id URLs, but the client and server are separate deployable
// packages with no shared import path between them, so this is a deliberate
// mirror rather than a shared module.
//
// IMPORTANT: if a product is added/removed/renamed in
// client/src/constants/productsData.js, update this file to match, or the
// sitemap will list a stale/missing product URL. See the SEO implementation
// report for why this duplication exists and the recommended long-term fix
// (moving the public storefront onto the database-backed Product model,
// which already has an admin-manageable catalog with no such
// synchronization problem).
const PUBLIC_PRODUCT_IDS = [
  'prod-001',
  'prod-002',
  'prod-003',
  'prod-004',
  'prod-005',
  'prod-006',
  'prod-007',
  'prod-008',
  'prod-009',
  'prod-010',
  'prod-011',
  'prod-012',
  'prod-013',
  'prod-014',
  'prod-015'
];

module.exports = { PUBLIC_PRODUCT_IDS };
