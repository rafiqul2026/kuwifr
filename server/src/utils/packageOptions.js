// server/src/utils/packageOptions.js
//
// A package's "product options" are what a member chooses ONE of when they
// buy or upgrade to that package (Admin > Packages > Products). Each option
// is either:
//   - PRODUCT: one catalog product, with a quantity (e.g. Sugar Care x 2)
//   - GROUP:   a bundle of several catalog products, each with its own
//              quantity (e.g. Hair Color Shampoo x1 + Turmeric Powder x2 +
//              Alkaline Water x1), picked as a single choice.
//
// Products are RepurchaseProduct.id slugs. Mirrors the client helper in
// client/src/pages/member/packageProductCatalog.js.

const MAX_OPTIONS = 50;
const MAX_GROUP_ITEMS = 20;
const MIN_QTY = 1;
const MAX_QTY = 99;
const MAX_GROUP_NAME = 80;

const productKey = (productId) => `p:${productId}`;
const randomGroupKey = () => `g:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * The package's explicit options, or null when the package still uses the
 * automatic default (every active product priced at the package price).
 * Packages saved before groups existed only have includedProductIds —
 * those read back as single-product options with quantity 1.
 */
const getPackageOptions = (pkg) => {
  if (!pkg) return null;
  if (Array.isArray(pkg.productOptions)) {
    return pkg.productOptions.map((o) => ({
      key: o.key,
      kind: o.kind === 'GROUP' ? 'GROUP' : 'PRODUCT',
      name: o.name || '',
      items: (o.items || []).map((i) => ({ productId: i.productId, quantity: Number(i.quantity) || 1 }))
    }));
  }
  if (Array.isArray(pkg.includedProductIds)) {
    return pkg.includedProductIds.map((id) => ({
      key: productKey(id),
      kind: 'PRODUCT',
      name: '',
      items: [{ productId: id, quantity: 1 }]
    }));
  }
  return null;
};

const parseQty = (raw) => {
  const n = Number(raw === undefined || raw === null || raw === '' ? 1 : raw);
  return Number.isInteger(n) && n >= MIN_QTY && n <= MAX_QTY ? n : null;
};

/**
 * Validates and normalizes the options an admin submitted. Returns
 * { error } or { options } (product existence is checked by the caller).
 */
const normalizeOptionsInput = (input) => {
  if (!Array.isArray(input)) return { error: 'options must be an array.' };
  if (input.length > MAX_OPTIONS) return { error: `A package can have at most ${MAX_OPTIONS} product choices.` };

  const options = [];
  const usedKeys = new Set();
  const singleProducts = new Set();

  for (let idx = 0; idx < input.length; idx += 1) {
    const raw = input[idx] || {};
    const label = `Choice ${idx + 1}`;
    const kind = raw.kind === 'GROUP' ? 'GROUP' : raw.kind === 'PRODUCT' ? 'PRODUCT' : null;
    if (!kind) return { error: `${label}: kind must be PRODUCT or GROUP.` };
    if (!Array.isArray(raw.items) || raw.items.length === 0) return { error: `${label} has no products.` };

    const items = [];
    const seen = new Set();
    for (const it of raw.items) {
      const productId = typeof it?.productId === 'string' ? it.productId.trim() : '';
      if (!productId) return { error: `${label}: every product needs a product id.` };
      if (seen.has(productId)) return { error: `${label}: ${productId} is listed twice — change its quantity instead.` };
      const quantity = parseQty(it.quantity);
      if (quantity === null) return { error: `${label}: quantity for ${productId} must be a whole number from ${MIN_QTY} to ${MAX_QTY}.` };
      seen.add(productId);
      items.push({ productId, quantity });
    }

    if (kind === 'PRODUCT') {
      if (items.length !== 1) return { error: `${label}: a single-product choice must have exactly one product.` };
      const pid = items[0].productId;
      if (singleProducts.has(pid)) return { error: `${pid} is added more than once as a single product.` };
      singleProducts.add(pid);
      const key = productKey(pid);
      usedKeys.add(key);
      options.push({ key, kind, name: '', items });
    } else {
      if (items.length < 2) return { error: `${label}: a product group needs at least 2 different products.` };
      if (items.length > MAX_GROUP_ITEMS) return { error: `${label}: a product group can have at most ${MAX_GROUP_ITEMS} products.` };
      const name = String(raw.name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_GROUP_NAME);
      // Keep an existing group's key stable (so in-flight member selections
      // still resolve after an admin edit); otherwise mint a new one.
      let key = typeof raw.key === 'string' && /^g:[a-z0-9]{4,40}$/.test(raw.key) ? raw.key : randomGroupKey();
      while (usedKeys.has(key)) key = randomGroupKey();
      usedKeys.add(key);
      options.push({ key, kind, name, items });
    }
  }

  return { options };
};

const allProductIds = (options) => [...new Set(options.flatMap((o) => o.items.map((i) => i.productId)))];

const sameItemSet = (option, ids) => {
  const optIds = option.items.map((i) => i.productId);
  return optIds.length === ids.length && optIds.every((id) => ids.includes(id));
};

/**
 * Purchase/upgrade time: checks the member's selection against the
 * package's options and returns the authoritative product lines to store
 * (names, prices and quantities come from the database, never the client).
 *
 * Returns { error } or { products }.
 * `insurancePlan` is the package's insurance plan (always a valid choice).
 */
const resolveSelectedProducts = async (pkg, selected, insurancePlan) => {
  const lines = Array.isArray(selected) ? selected : [];
  const options = getPackageOptions(pkg);

  // Automatic packages: no admin list to enforce (legacy behaviour).
  if (!options) {
    return { products: lines.map((p) => ({ ...p, quantity: parseQty(p?.quantity) || 1 })) };
  }

  const ids = lines.map((p) => p?.productId || p?.id).filter(Boolean);
  if (insurancePlan && ids.length === 1 && ids[0] === insurancePlan.id) {
    return { products: lines.map((p) => ({ ...p, quantity: 1 })) };
  }

  const wantedKey = lines.find((p) => p?.optionKey)?.optionKey;
  let option = wantedKey ? options.find((o) => o.key === wantedKey) : null;
  // Older client builds don't send optionKey — match on the product set.
  if (!option) option = options.find((o) => sameItemSet(o, ids));
  if (!option || !sameItemSet(option, ids)) {
    const names = lines.map((p) => p?.name || p?.productId || 'That product').join(' + ');
    return { error: `${names} is not available with ${pkg.name}. Please refresh the page and choose one of the listed products.` };
  }

  const RepurchaseProduct = require('../models/RepurchaseProduct');
  const docs = await RepurchaseProduct.find({ id: { $in: option.items.map((i) => i.productId) } })
    .select('id name category ksp images isActive')
    .lean();
  const byId = new Map(docs.map((d) => [d.id, d]));
  const unavailable = option.items.filter((i) => !byId.get(i.productId) || byId.get(i.productId).isActive === false);
  if (unavailable.length) {
    return { error: 'One of the products in your selection is no longer available. Please refresh the page and choose again.' };
  }

  const groupName = option.kind === 'GROUP'
    ? (option.name || option.items.map((i) => byId.get(i.productId).name).join(' + '))
    : '';

  return {
    products: option.items.map((i) => {
      const d = byId.get(i.productId);
      return {
        productId: d.id,
        name: d.name,
        category: d.category,
        price: d.ksp,
        image: d.images?.[0]?.url || '',
        quantity: i.quantity,
        optionKey: option.key,
        groupName
      };
    })
  };
};

module.exports = {
  MIN_QTY,
  MAX_QTY,
  getPackageOptions,
  normalizeOptionsInput,
  allProductIds,
  resolveSelectedProducts
};
