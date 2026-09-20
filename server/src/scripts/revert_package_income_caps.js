// server/src/scripts/revert_package_income_caps.js
//
// Reverts update_package_income_caps_10x.js — the member clarified that the
// Rupee capping value (dailyCap/weeklyCap/monthlyCap) was already correct
// and must NOT change. What they actually want is a separate, purely
// informational "Daily/Weekly/Monthly Maximum KBP" figure (= capping value x
// 10, since the matching rate is 10% -- see compensation.matching.rate in
// settings.service.js -- so 15,000 KBP matched x 10% = Rs.1,500, the
// original Starter Package daily cap), shown to members alongside the
// existing Rs. cap. See package.controller.js's DEFAULT_PACKAGES for the
// restored values and PackagesPage.jsx/UpgradePackagePage.jsx for the new
// KBP display (computed client-side as cap x 10, not a stored field).
require('dotenv').config();
const mongoose = require('mongoose');
const Package = require('../models/Package');

const ORIGINAL_CAPS = {
  STARTER: { dailyCap: 1500, weeklyCap: 10500, monthlyCap: 45000 },
  GROWTH: { dailyCap: 7000, weeklyCap: 49000, monthlyCap: 210000 },
  LIFE_SAFE: { dailyCap: 15000, weeklyCap: 105000, monthlyCap: 450000 },
  LIFE_SAFE_ELITE: { dailyCap: 20000, weeklyCap: 140000, monthlyCap: 600000 },
  TITANIUM: { dailyCap: 50000, weeklyCap: 350000, monthlyCap: 1500000 }
};

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected. Reverting package income caps to their original values...');

  let updated = 0;
  for (const [type, caps] of Object.entries(ORIGINAL_CAPS)) {
    const before = await Package.findOne({ type }).lean();
    if (!before) {
      console.log(`  ${type}: NOT FOUND — skipped`);
      continue;
    }
    await Package.updateOne({ type }, { $set: caps });
    console.log(`  ${type} (${before.name}): dailyCap ${before.dailyCap} -> ${caps.dailyCap}, weeklyCap ${before.weeklyCap} -> ${caps.weeklyCap}, monthlyCap ${before.monthlyCap} -> ${caps.monthlyCap}`);
    updated += 1;
  }

  console.log(`\nDone. ${updated}/${Object.keys(ORIGINAL_CAPS).length} packages reverted.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Revert failed:', err);
  process.exit(1);
});
