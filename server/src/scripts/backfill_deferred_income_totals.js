// server/src/scripts/backfill_deferred_income_totals.js
//
// One-time backfill for the "Total Income" undercount bug (Abbas 5 /
// KFR166821 and every other member with unsettled Matching/Leadership
// income): before this fix, Wallet.totalIncome (and the binaryIncome/
// leadershipIncome breakdown counters, and User.lifetimeIncome) were only
// incremented for MATCHING_INCOME / LEADERSHIP_INCOME_L1/2/3 at day-close
// settlement (settleDailyMatchingAndLeadershipIncome), even though the
// Income Overview breakdown cards already counted them as earned the
// instant the IncomeTransaction was CREDITED. Going forward,
// IncomeService#creditIncome recognizes these into the wallet counters
// immediately (see WalletService#recognizeDeferredIncome) — this script
// catches up every transaction that was created BEFORE that fix shipped and
// is still sitting unsettled (walletSettledAt: null), so it never got
// counted by either the old code (deferred) or the new code (only runs at
// creation time).
//
// Uses the raw MongoDB driver (not the Mongoose model) for the
// IncomeTransaction reads/writes — `metadata` is a Mongoose Map field, and
// querying/setting a dotted sub-path through Model.find/updateMany on a Map
// schema type is unreliable; the raw collection sees exactly the plain BSON
// object it's actually stored as, same as the dotted-path metadata queries
// already used elsewhere in this codebase (income.controller.js).
//
// Idempotent: only touches transactions that don't yet carry
// metadata.totalIncomeRecognizedAt, and stamps that marker on every row it
// processes — safe to re-run (e.g. if interrupted) with no double-counting.
// Does NOT touch walletSettledAt or incomeBalance — the actual cash credit
// still only happens once, at real settlement.
require('dotenv').config();
const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const User = require('../models/User');

const DEFERRED_SETTLEMENT_TYPES = ['MATCHING_INCOME', 'LEADERSHIP_INCOME_L1', 'LEADERSHIP_INCOME_L2', 'LEADERSHIP_INCOME_L3'];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected. Finding unsettled, unrecognized Matching/Leadership income...');
  const col = mongoose.connection.db.collection('incometransactions');

  const unrecognized = await col.find({
    type: { $in: DEFERRED_SETTLEMENT_TYPES },
    status: 'CREDITED',
    walletSettledAt: null,
    'metadata.totalIncomeRecognizedAt': { $exists: false }
  }, { projection: { _id: 1, userId: 1, type: 1, creditedAmount: 1 } }).toArray();

  console.log(`Found ${unrecognized.length} unrecognized transaction(s).`);
  if (unrecognized.length === 0) {
    console.log('Nothing to backfill.');
    await mongoose.disconnect();
    return;
  }

  const byUser = new Map();
  for (const txn of unrecognized) {
    const uid = String(txn.userId);
    if (!byUser.has(uid)) byUser.set(uid, { matching: 0, leadership: 0, ids: [] });
    const bucket = byUser.get(uid);
    if (txn.type === 'MATCHING_INCOME') bucket.matching += Number(txn.creditedAmount || 0);
    else bucket.leadership += Number(txn.creditedAmount || 0);
    bucket.ids.push(txn._id);
  }

  let membersFixed = 0;
  let totalRecognized = 0;
  const now = new Date();

  for (const [userId, bucket] of byUser.entries()) {
    const total = bucket.matching + bucket.leadership;
    if (total <= 0) {
      await col.updateMany({ _id: { $in: bucket.ids } }, { $set: { 'metadata.totalIncomeRecognizedAt': now } });
      continue;
    }

    const inc = { totalIncome: total };
    if (bucket.matching > 0) inc.binaryIncome = bucket.matching;
    if (bucket.leadership > 0) inc.leadershipIncome = bucket.leadership;

    await Wallet.findOneAndUpdate({ userId }, { $inc: inc });
    await User.findByIdAndUpdate(userId, { $inc: { lifetimeIncome: total } });
    await col.updateMany({ _id: { $in: bucket.ids } }, { $set: { 'metadata.totalIncomeRecognizedAt': now } });

    membersFixed += 1;
    totalRecognized += total;
    console.log(`  user ${userId}: +₹${total} (matching ₹${bucket.matching}, leadership ₹${bucket.leadership}) across ${bucket.ids.length} txn(s)`);
  }

  console.log(`\nDone. ${membersFixed} member(s) fixed, ₹${totalRecognized} total recognized.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
