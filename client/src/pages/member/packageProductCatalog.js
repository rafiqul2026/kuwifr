// client/src/pages/member/packageProductCatalog.js
//
// "Included product" choices per package tier — per business rule, the
// Repurchase Store and Buy Package's included products are the SAME
// catalog (RepurchaseProduct, admin-managed at /admin/repurchase-products,
// fetched via GET /api/repurchase/products). This file previously held a
// hardcoded array of fabricated demo products with Unsplash stock photos
// and invented names/prices with no database backing at all.
//
// A real repurchase product is offered as the "included product" for a
// package when its KSP exactly matches that package's price — the member
// pays the package price and picks which real, admin-managed product (of
// equal value) they receive. This mapping requires no new schema: it's
// exactly how the previous demo tiers lined up (Starter ₹1,500 → 1,500 KSP
// items, Growth ₹5,000 → 5,000 KSP items, etc.), just backed by real data.
export const SELECTION_MODE = {
  STARTER: 'ONE',
  GROWTH: 'ONE',
  LIFE_SAFE: 'ONE',
  LIFE_SAFE_ELITE: 'ONE',
  TITANIUM: 'ONE'
};

export const getSelectionMode = (type) => SELECTION_MODE[(type || '').toUpperCase()] || 'ONE';

// Normalizes a RepurchaseProduct document (images: [{url,publicId}]) into
// the flat {id, name, mrp, ksp, category, image} shape every package-page
// render call site and the /api/package-purchases/activate payload already
// expect — keeping those call sites unchanged.
const normalizeProduct = (p) => ({
  id: p.id,
  name: p.name,
  mrp: p.mrp,
  ksp: p.ksp,
  category: p.category,
  image: p.images?.[0]?.url || ''
});

/**
 * Real, admin-managed products whose price matches this package's tier.
 * `repurchaseProducts` is the array from GET /api/repurchase/products
 * (already isActive-filtered server-side) — pass it in from the page's own
 * fetch so this stays a pure function with no network calls of its own.
 */
export const getProductsForPackage = (pkg, repurchaseProducts = []) => {
  const price = Number(pkg?.price || 0);
  return repurchaseProducts
    .filter((p) => Number(p.ksp) === price)
    .map(normalizeProduct);
};
