// client/src/utils/repurchasePrefill.js
//
// Hands products from the public storefront (Buy Now / the bag) to the
// member Repurchase Store, which is where real orders are placed and paid
// for. Uses sessionStorage so it survives the login redirect in between.
const KEY = 'kuwifr_repurchase_prefill';
export const REPURCHASE_PATH = '/member/repurchase';

/** items: [{ id, quantity }] */
export const setRepurchasePrefill = (items = []) => {
  try {
    const clean = items
      .filter((i) => i && typeof i.id === 'string' && i.id)
      .map((i) => ({ id: i.id, quantity: Math.min(99, Math.max(1, Math.round(Number(i.quantity) || 1))) }));
    if (clean.length) sessionStorage.setItem(KEY, JSON.stringify({ items: clean, at: Date.now() }));
  } catch {
    /* storage unavailable (private mode) — the member just adds items by hand */
  }
};

/** Returns and clears the pending items (ignored after 1 hour). */
export const takeRepurchasePrefill = () => {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - Number(parsed.at || 0) > 60 * 60 * 1000) return [];
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
};
