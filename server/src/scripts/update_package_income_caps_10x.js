// server/src/scripts/update_package_income_caps_10x.js
//
// One-time migration: business rule update — every package's income cap
// (dailyCap/weeklyCap/monthlyCap) is now 10x what it was (e.g. Starter Package:
// daily cap ₹1,500 -> ₹15,000). See package.controller.js's DEFAULT_PACKAGES
// for the full new table and rationale.
//
// seedPackagesIfEmpty() only ever seeds an EMPTY collection, so updating that
// constant alone never touches the 5 Package documents already live in
// production — this script updates exactly those documents, matched by
// `type`, and ONLY the three cap fields (price/kbp/directBonus/description/
// badge/etc. — including anything an admin may have customized — are left
// untouched).
require('dotenv').config();
const mongoose = require('mongoose');
const Package = require('../models/Package');

const NEW_CAPS = {
  STARTER: { dailyCap: 15000, weeklyCap: 105000, monthlyCap: 450000 },
  GROWTH: { dailyCap: 70000, weeklyCap: 490000, monthlyCap: 2100000 },
  LIFE_SAFE: { dailyCap: 150000, weeklyCap: 1050000, monthlyCap: 4500000 },
  LIFE_SAFE_ELITE: { dailyCap: 200000, weeklyCap: 1400000, monthlyCap: 6000000 },
  TITANIUM: { dailyCap: 500000, weeklyCap: 3500000, monthlyCap: 15000000 }
};

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected. Updating package income caps (10x)...');

  let updated = 0;
  for (const [type, caps] of Object.entries(NEW_CAPS)) {
    const before = await Package.findOne({ type }).lean();
    if (!before) {
      console.log(`  ${type}: NOT FOUND — skipped`);
      continue;
    }
    await Package.updateOne({ type }, { $set: caps });
    console.log(`  ${type} (${before.name}): dailyCap ${before.dailyCap} -> ${caps.dailyCap}, weeklyCap ${before.weeklyCap} -> ${caps.weeklyCap}, monthlyCap ${before.monthlyCap} -> ${caps.monthlyCap}`);
    updated += 1;
  }

  console.log(`\nDone. ${updated}/${Object.keys(NEW_CAPS).length} packages updated.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
