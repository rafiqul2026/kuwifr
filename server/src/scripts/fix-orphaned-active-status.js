// server/scripts/fix-orphaned-active-status.js
//
// Finds MEMBER accounts that are ACTIVE with NO real package on file
// (activePackageId is null) — an impossible state under the business rule
// "a member is only ACTIVE once they've bought a real package" — and
// reverts them to INACTIVE. This was possible before this fix because
// package.controller.js#purchasePackage could flip status to ACTIVE via a
// hardcoded fallback package that never resolved to a real database
// Package document. That code path (and a related gap in
// packagePurchase.controller.js#approvePackagePurchase) is now fixed, and
// the User model itself refuses to save a MEMBER as ACTIVE without a valid
// activePackageId — but neither of those fixes retroactively repairs
// accounts that were already written into the bad state.
//
// There is no reliable way to know which package such a member actually
// intended/paid for — the broken path never created an Order or
// PackagePurchase record for them — so the only safe fix is to put them
// back to INACTIVE, matching the business rule exactly, so they (or an
// admin) can activate them properly through the real, payment-verified
// flow afterward.
//
// SAFETY:
//   - Dry run by default: prints exactly which members would change and
//     changes nothing. Pass --confirm to actually apply it.
//   - Refuses to run at all when NODE_ENV=production, no override.
//   - Only ever touches MEMBER accounts that are ACTIVE with NO
//     activePackageId — never an ADMIN/SUPER_ADMIN account, and never a
//     member who already has a valid package on file.
//
// USAGE:
//   node scripts/fix-orphaned-active-status.js              (dry run)
//   node scripts/fix-orphaned-active-status.js --confirm     (applies it)

require('dotenv').config();
const mongoose = require('mongoose');
const DataIntegrityService = require('../src/services/dataIntegrity.service');

const DRY_RUN = !process.argv.includes('--confirm');

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Refusing to run: NODE_ENV=production. Review and fix these members from the admin panel instead.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to database.');
  console.log(DRY_RUN
    ? '🔍 DRY RUN — nothing will be changed. Re-run with --confirm to actually apply this.\n'
    : '⚠️  LIVE RUN — the changes listed below are being applied now.\n');

  const result = await DataIntegrityService.fixOrphanedActiveMembers({ dryRun: DRY_RUN });

  if (result.affectedCount === 0) {
    console.log('✅ No orphaned members found — every ACTIVE member has a real package on file.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${result.affectedCount} member(s) marked ACTIVE with NO package on file:\n`);
  for (const m of result.members) {
    console.log(`  - ${m.memberId}  ${m.fullName}  <${m.email}>  (currentPackage: ${m.currentPackage || 'none'})`);
  }
  console.log('');

  if (DRY_RUN) {
    console.log('These would be reverted to INACTIVE (activationDate, currentPackage, packagePrice, dailyBinaryCap, totalKBP all cleared).');
    console.log('Nothing was changed. Re-run with --confirm to apply the fix.');
  } else {
    console.log(`✅ Reverted ${result.modifiedCount} member(s) to INACTIVE.`);
    console.log('They can now be activated correctly through the real payment-verified flow (or an admin quick-activation with a real package selected).');
    console.log('');
    console.log('Note: the old buggy activation path credited a direct-referral bonus straight into the sponsor\'s');
    console.log('Wallet WITHOUT creating an IncomeTransaction ledger entry, so diagnose-income.js would not have');
    console.log('flagged it. If you suspect a sponsor\'s wallet balance was inflated by one of these orphaned');
    console.log('activations, the cleanest fix is still reset-test-financials.js --confirm before your next clean retest.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Fix failed:', err);
  process.exit(1);
});