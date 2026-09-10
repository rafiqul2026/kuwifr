// server/scripts/reset-test-financials.js
//
// Resets all TEST financial/activation state so you can re-run clean
// activations and verify the referral/matching math (10% + 10% of KBP)
// now that the duplicate-activation bug is fixed.
//
// WHAT THIS DOES:
//   - Deletes: WalletTransaction, IncomeTransaction, Order, PackagePurchase,
//              RankAchievement, KuwiStar, FundQualification, TTORecord
//   - Deletes: Wallet documents (they are auto-recreated at zero balance
//     the next time any credit happens — no need to touch every field)
//   - Resets, for MEMBER accounts only: status -> INACTIVE, activePackageId,
//     currentPackage, packagePrice, dailyBinaryCap, activationDate,
//     currentRankId -> null/0, totalKBP, lifetimeIncome, directIncome,
//     matchingIncome -> 0
//   - Resets BinaryNode volume/matching fields (leftVolume, rightVolume,
//     availableLeftVolume, availableRightVolume, matchingVolume, pairCount,
//     totalKBP, leftRepurchaseKBP, rightRepurchaseKBP) to 0
//
// WHAT THIS DELIBERATELY DOES NOT TOUCH (so nobody has to re-register):
//   - User accounts, credentials, emails, phone numbers
//   - sponsorId / referralCode / directReferrals (registration-time data,
//     unrelated to activation/income)
//   - BinaryNode placement — parentId, leftChildId, rightChildId, position,
//     level are left exactly as they are (this is the tree structure the
//     repairAllPlacements tool fixed; this script only zeroes the NUMBERS
//     sitting on top of that structure, never the structure itself)
//   - Referral (sponsor-chain) records
//   - ADMIN / SUPER_ADMIN accounts are left completely untouched
//
// SAFETY:
//   - Refuses to run at all when NODE_ENV=production, no override — this
//     script is for pre-launch testing only and should never touch a real
//     member's real money.
//   - Runs as a DRY RUN by default: it only prints what it WOULD delete/
//     reset and changes nothing. You must pass --confirm to actually apply it.
//
// USAGE:
//   node scripts/reset-test-financials.js                 (dry run — safe, prints counts only)
//   node scripts/reset-test-financials.js --confirm        (actually applies the reset)

require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../src/models/User');
const Wallet = require('../src/models/Wallet');
const WalletTransaction = require('../src/models/WalletTransaction');
const IncomeTransaction = require('../src/models/IncomeTransaction');
const Order = require('../src/models/Order');
const PackagePurchase = require('../src/models/PackagePurchase');
const BinaryNode = require('../src/models/BinaryNode');
const RankAchievement = require('../src/models/RankAchievement');
const KuwiStar = require('../src/models/KuwiStar');
const FundQualification = require('../src/models/FundQualification');
const TTORecord = require('../src/models/TTORecord');

const DRY_RUN = !process.argv.includes('--confirm');

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Refusing to run: NODE_ENV=production. This script is for pre-launch test data only.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to database.`);
  console.log(DRY_RUN
    ? '🔍 DRY RUN — nothing will be changed. Re-run with --confirm to actually apply this.\n'
    : '⚠️  LIVE RUN — the changes listed below are being applied now.\n');

  // ---- Counts / preview ----
  const [
    walletCount,
    walletTxnCount,
    incomeTxnCount,
    orderCount,
    purchaseCount,
    rankAchCount,
    starCount,
    fundQualCount,
    ttoCount,
    memberCount,
    activeMemberCount,
    binaryNodeCount
  ] = await Promise.all([
    Wallet.countDocuments(),
    WalletTransaction.countDocuments(),
    IncomeTransaction.countDocuments(),
    Order.countDocuments(),
    PackagePurchase.countDocuments(),
    RankAchievement.countDocuments(),
    KuwiStar.countDocuments(),
    FundQualification.countDocuments(),
    TTORecord.countDocuments(),
    User.countDocuments({ role: 'MEMBER' }),
    User.countDocuments({ role: 'MEMBER', status: 'ACTIVE' }),
    BinaryNode.countDocuments()
  ]);

  console.log('Current state:');
  console.log(`  Wallets:                ${walletCount} (will be deleted, auto-recreated at ₹0 on next credit)`);
  console.log(`  WalletTransactions:      ${walletTxnCount} (will be deleted)`);
  console.log(`  IncomeTransactions:      ${incomeTxnCount} (will be deleted)`);
  console.log(`  Orders:                  ${orderCount} (will be deleted)`);
  console.log(`  PackagePurchases:        ${purchaseCount} (will be deleted)`);
  console.log(`  RankAchievements:        ${rankAchCount} (will be deleted)`);
  console.log(`  KuwiStars:               ${starCount} (will be deleted)`);
  console.log(`  FundQualifications:      ${fundQualCount} (will be deleted)`);
  console.log(`  TTORecords:              ${ttoCount} (will be deleted)`);
  console.log(`  Member accounts:         ${memberCount} total, ${activeMemberCount} currently ACTIVE (status/package/income fields will reset; account itself is kept)`);
  console.log(`  BinaryNode records:      ${binaryNodeCount} (placement links kept; volume/matching numbers reset to 0)`);
  console.log('');

  if (DRY_RUN) {
    console.log('Nothing was changed. Re-run with --confirm to apply the reset.');
    await mongoose.disconnect();
    return;
  }

  // ---- Apply ----
  const results = {};

  results.wallets = await Wallet.deleteMany({});
  results.walletTxns = await WalletTransaction.deleteMany({});
  results.incomeTxns = await IncomeTransaction.deleteMany({});
  results.orders = await Order.deleteMany({});
  results.purchases = await PackagePurchase.deleteMany({});
  results.rankAchievements = await RankAchievement.deleteMany({});
  results.kuwiStars = await KuwiStar.deleteMany({});
  results.fundQualifications = await FundQualification.deleteMany({});
  results.ttoRecords = await TTORecord.deleteMany({});

  results.members = await User.updateMany(
    { role: 'MEMBER' },
    {
      $set: {
        status: 'INACTIVE',
        activePackageId: null,
        currentPackage: null,
        packagePrice: 0,
        dailyBinaryCap: 0,
        activationDate: null,
        currentRankId: null,
        totalKBP: 0,
        lifetimeIncome: 0,
        directIncome: 0,
        matchingIncome: 0
      }
    }
  );

  results.binaryNodes = await BinaryNode.updateMany(
    {},
    {
      $set: {
        leftVolume: 0,
        rightVolume: 0,
        availableLeftVolume: 0,
        availableRightVolume: 0,
        matchingVolume: 0,
        pairCount: 0,
        totalKBP: 0,
        leftRepurchaseKBP: 0,
        rightRepurchaseKBP: 0
      }
      // Deliberately NOT touching parentId / leftChildId / rightChildId /
      // position / level — that's tree placement, not a financial number.
    }
  );

  console.log('✅ Reset complete:');
  console.log(`  Wallets deleted:              ${results.wallets.deletedCount}`);
  console.log(`  WalletTransactions deleted:   ${results.walletTxns.deletedCount}`);
  console.log(`  IncomeTransactions deleted:   ${results.incomeTxns.deletedCount}`);
  console.log(`  Orders deleted:               ${results.orders.deletedCount}`);
  console.log(`  PackagePurchases deleted:     ${results.purchases.deletedCount}`);
  console.log(`  RankAchievements deleted:     ${results.rankAchievements.deletedCount}`);
  console.log(`  KuwiStars deleted:            ${results.kuwiStars.deletedCount}`);
  console.log(`  FundQualifications deleted:   ${results.fundQualifications.deletedCount}`);
  console.log(`  TTORecords deleted:           ${results.ttoRecords.deletedCount}`);
  console.log(`  Members reset:                ${results.members.modifiedCount}`);
  console.log(`  BinaryNode volumes reset:     ${results.binaryNodes.modifiedCount}`);
  console.log('');
  console.log('All member accounts, credentials, sponsor relationships, and binary tree');
  console.log('PLACEMENT (who is under whom, left/right) are untouched. Every member is');
  console.log('now INACTIVE with no package — re-activate them through the normal flow');
  console.log('to generate a fresh, clean income trail.');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Reset failed:', err);
  process.exit(1);
});
