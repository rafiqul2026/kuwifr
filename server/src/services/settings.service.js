// server/src/services/settings.service.js
// Central read access to the admin-configurable Compensation Plan (Setting.compensation).
// Every commission/level-income calculation in the app should read its rates through
// this service instead of hardcoding them, so an admin change on the Commission &
// Level Income Setup screen takes effect immediately, everywhere, with no deploy.
const Setting = require('../models/Setting');

// Defaults mirror the schema defaults in Setting.js exactly (kept here too so the
// engine still works correctly even before the Setting document has ever been saved).
const DEFAULT_COMPENSATION = {
  referral: { rate: 0.10 },
  matching: { rate: 0.10, unitValue: 1000, firstPairSmallUnits: 1, firstPairLargeUnits: 2, firstPairMinDirects: 2 },
  leadership: { levelRates: [0.50, 0.30, 0.20], minRankCode: 'KUWI_STAR' },
  repurchase: {
    selfRate: 0.25,
    levelRates: [0.17, 0.13, 0.09, 0.05, 0.03, 0.02, 0.01, 0.01, 0.01, 0.01],
    unlockLevelsByDirects: [2, 4, 6, 8, 10]
  },
  withdrawal: { minAmount: 100, adminChargeRate: 0.05, serviceChargeRate: 0.05, tdsRate: 0.05 },
  franchise: { kspRate: 0.10, kbpLifetimeRate: 0.01 }
};

const CACHE_TTL_MS = 15000; // short TTL: cheap enough to re-read often, but avoids a
// DB round trip on every single income calculation inside a hot loop (e.g. walking a
// 10-level upline during a repurchase order).

let cache = { value: null, expiresAt: 0 };

/** Deep-merge admin-saved values over the defaults so a partially-filled document
 * (or one saved before a new field existed) never produces `undefined` rates. */
function mergeCompensation(saved) {
  const merged = JSON.parse(JSON.stringify(DEFAULT_COMPENSATION));
  if (!saved) return merged;

  for (const section of Object.keys(DEFAULT_COMPENSATION)) {
    if (!saved[section]) continue;
    merged[section] = { ...merged[section], ...JSON.parse(JSON.stringify(saved[section])) };
  }
  return merged;
}

class SettingsService {
  /** Invalidate the in-process cache (call after any settings write). */
  invalidateCache() {
    cache = { value: null, expiresAt: 0 };
  }

  /** Returns the full, defaults-merged compensation plan config. */
  async getCompensation() {
    if (cache.value && cache.expiresAt > Date.now()) {
      return cache.value;
    }

    let doc = null;
    try {
      doc = await Setting.findOne().select('compensation').lean();
    } catch (err) {
      console.error('[SettingsService] Failed to load compensation settings, using defaults:', err.message);
    }

    const merged = mergeCompensation(doc?.compensation);
    cache = { value: merged, expiresAt: Date.now() + CACHE_TTL_MS };
    return merged;
  }

  async getReferralRate() {
    const c = await this.getCompensation();
    return c.referral.rate;
  }

  async getMatching() {
    const c = await this.getCompensation();
    return c.matching;
  }

  async getLeadership() {
    const c = await this.getCompensation();
    return c.leadership;
  }

  async getRepurchase() {
    const c = await this.getCompensation();
    return c.repurchase;
  }

  async getWithdrawal() {
    const c = await this.getCompensation();
    return c.withdrawal;
  }

  async getFranchise() {
    const c = await this.getCompensation();
    return c.franchise;
  }
}

module.exports = new SettingsService();
module.exports.DEFAULT_COMPENSATION = DEFAULT_COMPENSATION;
