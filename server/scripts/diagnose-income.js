// server/scripts/diagnose-income.js
//
// READ-ONLY diagnostic. Does not change any data.
//
// Prints every REFERRAL_INCOME and MATCHING_INCOME transaction credited to
// a given sponsor, so you can see exactly how many times each downline
// member's activation was credited and when — this is how you confirm
// whether a member was accidentally activated more than once (which is
// what inflates the Income Overview numbers).
//
// Usage:
//   node scripts/diagnose-income.js KFR847667
//
// (pass the sponsor's Member ID — e.g. Priya Das's KFR847667)

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const IncomeTransaction = require('../src/models/IncomeTransaction');

async function main() {
  const memberId = process.argv[2];
  if (!memberId) {
    console.error('Usage: node scripts/diagnose-income.js <MEMBER_ID>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected. Looking up ${memberId}...\n`);

  const sponsor = await User.findOne({ memberId: memberId.trim().toUpperCase() }).lean();
  if (!sponsor) {
    console.error(`No user found with memberId ${memberId}`);
    process.exit(1);
  }

  console.log(`Sponsor: ${sponsor.fullName} (${sponsor.memberId})`);
  console.log('='.repeat(90));

  const txns = await IncomeTransaction.find({
    userId: sponsor._id,
    type: { $in: ['REFERRAL_INCOME', 'MATCHING_INCOME'] }
  }).sort({ createdAt: 1 }).lean();

  if (txns.length === 0) {
    console.log('No REFERRAL_INCOME or MATCHING_INCOME transactions found for this sponsor.');
  }

  let referralTotal = 0;
  let matchingTotal = 0;
  const byDownlineMember = {};

  for (const tx of txns) {
    const amount = tx.creditedAmount || 0;
    if (tx.type === 'REFERRAL_INCOME') referralTotal += amount;
    if (tx.type === 'MATCHING_INCOME') matchingTotal += amount;

    const sponsoredUserId = tx.metadata?.sponsoredUserId
      ? String(tx.metadata.sponsoredUserId)
      : (tx.sourceId ? String(tx.sourceId) : 'unknown');

    if (!byDownlineMember[sponsoredUserId]) byDownlineMember[sponsoredUserId] = [];
    byDownlineMember[sponsoredUserId].push(tx);

    console.log(
      `${tx.createdAt.toISOString()}  ${tx.type.padEnd(16)}  ₹${String(amount).padStart(8)}  ` +
      `kbp=${tx.kbp ?? '-'}  rate=${tx.rate ?? '-'}  txnId=${tx.transactionId}  sourceId=${tx.sourceId}  ` +
      `sponsoredUserId=${tx.metadata?.sponsoredUserId || '-'}`
    );
  }

  console.log('='.repeat(90));
  console.log(`Total REFERRAL_INCOME:  ₹${referralTotal}`);
  console.log(`Total MATCHING_INCOME:  ₹${matchingTotal}`);
  console.log(`Total (sum):            ₹${referralTotal + matchingTotal}`);
  console.log('');

  console.log('--- Referral credits grouped by downline member (>1 entry = likely duplicate activation) ---');
  for (const [key, list] of Object.entries(byDownlineMember)) {
    const referralEntries = list.filter((t) => t.type === 'REFERRAL_INCOME');
    if (referralEntries.length > 1) {
      const user = await User.findById(key).select('memberId fullName').lean().catch(() => null);
      console.log(
        `⚠️  ${user ? `${user.fullName} (${user.memberId})` : key} was credited REFERRAL_INCOME ${referralEntries.length} times ` +
        `(total ₹${referralEntries.reduce((s, t) => s + (t.creditedAmount || 0), 0)}) — this member was very likely activated more than once.`
      );
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
