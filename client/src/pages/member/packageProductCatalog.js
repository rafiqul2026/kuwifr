// client/src/pages/member/packageProductCatalog.js
//
// "Included product" choices per package tier — per business rule, the
// Repurchase Store and Buy Package's included products are the SAME
// catalog (RepurchaseProduct, admin-managed at /admin/products,
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
  STANDARD: 'ONE',
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

export const withQty = (name, qty) => (Number(qty) > 1 ? `${name} × ${qty}` : name);

const describeItems = (items) => items.map((i) => withQty(i.name, i.quantity)).join(' + ');

/**
 * The package's explicit product choices — [{ key, kind: 'PRODUCT'|'GROUP',
 * name, items: [{ productId, quantity }] }] — or null when the package uses
 * the automatic default. Mirrors getPackageOptions in
 * server/src/utils/packageOptions.js (packages saved before product groups
 * existed only have includedProductIds: single products, quantity 1).
 */
export const getPackageOptions = (pkg) => {
  if (Array.isArray(pkg?.productOptions)) {
    return pkg.productOptions.map((o) => ({
      key: o.key,
      kind: o.kind === 'GROUP' ? 'GROUP' : 'PRODUCT',
      name: o.name || '',
      items: (o.items || []).map((i) => ({ productId: i.productId, quantity: Number(i.quantity) || 1 }))
    }));
  }
  if (Array.isArray(pkg?.includedProductIds)) {
    return pkg.includedProductIds.map((id) => ({
      key: `p:${id}`,
      kind: 'PRODUCT',
      name: '',
      items: [{ productId: id, quantity: 1 }]
    }));
  }
  return null;
};

/**
 * Turns the member's chosen option(s) into the `selectedProducts` lines the
 * purchase / upgrade APIs expect — a product group expands into one line
 * per product. The server re-derives names, prices and quantities from the
 * package's options; optionKey tells it which choice was picked.
 */
export const toPurchaseLines = (chosen = []) =>
  chosen.flatMap((p) => {
    if (p.isGroup) {
      return p.items.map((i) => ({
        productId: i.id,
        name: i.name,
        category: i.category,
        price: i.ksp,
        image: i.image,
        quantity: i.quantity,
        optionKey: p.optionKey,
        groupName: p.name
      }));
    }
    return [{
      productId: p.id,
      name: p.baseName || p.name,
      category: p.category,
      price: p.quantity > 1 ? Number(p.ksp) / p.quantity : p.ksp,
      image: p.image,
      quantity: p.quantity || 1,
      ...(p.optionKey ? { optionKey: p.optionKey } : {})
    }];
  });

/**
 * Human-readable summary of stored purchase lines, e.g.
 * "Hair Combo (Shampoo × 2 + Turmeric Powder)" or "Sugar Care × 2".
 */
export const describePurchaseLines = (lines = []) => {
  const parts = [];
  const groups = new Map();
  lines.forEach((l) => {
    if (l?.groupName) {
      const key = l.optionKey || l.groupName;
      if (!groups.has(key)) {
        groups.set(key, { name: l.groupName, items: [] });
        parts.push(groups.get(key));
      }
      groups.get(key).items.push(l);
    } else if (l) {
      parts.push(l);
    }
  });
  return parts
    .map((p) => (p.items
      ? (p.items.map((i) => i.name).join(' + ') === p.name
          ? describeItems(p.items)
          : `${p.name} (${describeItems(p.items)})`)
      : withQty(p.name, p.quantity)))
    .join(' + ');
};

/**
 * Real, admin-managed products whose price matches this package's tier.
 * `repurchaseProducts` is the array from GET /api/repurchase/products
 * (already isActive-filtered server-side) — pass it in from the page's own
 * fetch so this stays a pure function with no network calls of its own.
 */
export const getProductsForPackage = (pkg, repurchaseProducts = []) => {
  // The package's insurance plan (sent by the API as pkg.insurancePlan, see
  // server/src/constants/insurancePlans.js) is always offered as one more
  // choice after the physical products.
  const insurance = pkg?.insurancePlan ? [{ ...pkg.insurancePlan, image: '' }] : [];

  // Admin's explicit choice (Admin > Packages > Products) wins when one has
  // been set — including an empty list, meaning "offer nothing". Order
  // follows the order the admin arranged them in. Each choice is a single
  // product (with a quantity) or a product group picked as one unit.
  const options = getPackageOptions(pkg);
  if (options) {
    const byId = new Map(repurchaseProducts.map((p) => [p.id, p]));
    return options
      .map((opt) => {
        const items = opt.items.map((i) => {
          const p = byId.get(i.productId);
          // Not enough admin-managed stock for this quantity -> unavailable.
          if (p && typeof p.stock === 'number' && p.stock < i.quantity) return null;
          return p ? { ...normalizeProduct(p), quantity: i.quantity } : null;
        });
        // A choice with an inactive/deleted product can't be fulfilled —
        // hide it (the server would reject it anyway).
        if (items.length === 0 || items.some((x) => !x)) return null;

        if (opt.kind === 'GROUP') {
          return {
            id: opt.key,
            optionKey: opt.key,
            isGroup: true,
            name: opt.name || items.map((i) => i.name).join(' + '),
            category: 'Product Group',
            image: items.find((i) => i.image)?.image || '',
            ksp: items.reduce((s, i) => s + Number(i.ksp || 0) * i.quantity, 0),
            mrp: items.reduce((s, i) => s + Number(i.mrp || 0) * i.quantity, 0) || undefined,
            items,
            contents: describeItems(items)
          };
        }

        const [item] = items;
        return {
          ...item,
          optionKey: opt.key,
          name: withQty(item.name, item.quantity),
          baseName: item.name,
          ksp: Number(item.ksp || 0) * item.quantity,
          mrp: item.mrp ? Number(item.mrp) * item.quantity : item.mrp,
          contents: item.quantity > 1 ? `${item.quantity} units` : ''
        };
      })
      .filter(Boolean)
      .concat(insurance);
  }

  // Otherwise the automatic default: same-KSP products.
  const price = Number(pkg?.price || 0);
  return repurchaseProducts
    .filter((p) => Number(p.ksp) === price && !(typeof p.stock === 'number' && p.stock <= 0))
    .map(normalizeProduct)
    .concat(insurance);
};

/**
 * What the member pays: the insurance installment if they picked the
 * insurance plan, otherwise the package price. Mirrors getAmountPayable in
 * server/src/constants/insurancePlans.js (the server recomputes it).
 */
export const getAmountPayable = (pkg, selectedProducts = []) => {
  const insurance = selectedProducts.find((p) => p?.isInsurance);
  return insurance ? Number(insurance.installment || 0) : Number(pkg?.price || 0);
};
