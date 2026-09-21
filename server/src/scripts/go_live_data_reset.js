// server/src/scripts/go_live_data_reset.js
//
// One-time GO-LIVE data reset. Backs up every collection to a local JSON
// file, then removes all test member/transactional data ahead of launch:
//
//   KEPT (identity only):
//     - KFR000001 "System Administrator" (SUPER_ADMIN login) — untouched.
//     - KFR268945 "Kuwifr Admin Member" (binary tree root, isSystemRoot) —
//       profile/login kept, but reset to a fresh, unactivated root: no
//       package, no wallet, no KBP volume, no children, no income history.
//
//   KEPT (catalog/content, not member data):
//     packages, ranks, repurchaseproducts, funds, settings, campaigns,
//     offers, products, bonanzas, rules, newslettersubscribers.
//
//   DELETED (all of it — every remaining document belongs either to a
//   removed test member or to the admin root account being reset):
//     users (all except the 2 above), binarynodes, incometransactions,
//     notifications, orders, packagepurchases, rankachievements, referrals,
//     repurchasekbpledgers, repurchasepurchases, ttorecords, wallets,
//     wallettransactions, auditlogs, tickets, franchises, withdrawals,
//     dashboardstats, fundqualifications, kuwistars, salarylogs.
//
// Run: node src/scripts/go_live_data_reset.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const BACKUP_DIR = path.join(
  'C:', 'Users', 'RUBUL', 'AppData', 'Local', 'Temp', 'claude',
  'e--PRODUCTION-REDAY-PROJECT-kuwifr', 'b0cee6a5-e8e7-4609-ae13-d5f350ed55c0',
  'scratchpad', 'db_backup_pre_golive'
);

const KEEP_MEMBER_IDS = ['KFR000001', 'KFR268945'];

const COLLECTIONS_TO_WIPE = [
  'binarynodes', 'incometransactions', 'notifications', 'orders',
  'packagepurchases', 'rankachievements', 'referrals', 'repurchasekbpledgers',
  'repurchasepurchases', 'ttorecords', 'wallets', 'wallettransactions',
  'auditlogs', 'tickets', 'franchises', 'withdrawals', 'dashboardstats',
  'fundqualifications', 'kuwistars', 'salarylogs'
];

async function backupAllCollections(db) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const collections = await db.listCollections().toArray();
  console.log(`\nBacking up ${collections.length} collections to ${BACKUP_DIR} ...`);
  for (const { name } of collections) {
    const docs = await db.collection(name).find({}).toArray();
    fs.writeFileSync(path.join(BACKUP_DIR, `${name}.json`), JSON.stringify(docs, null, 1));
    console.log(`  backed up ${name}: ${docs.length} doc(s)`);
  }
  console.log('Backup complete.\n');
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  await backupAllCollections(db);

  const keepUsers = await db.collection('users').find({ memberId: { $in: KEEP_MEMBER_IDS } }).toArray();
  const superAdmin = keepUsers.find((u) => u.memberId === 'KFR000001');
  const rootMember = keepUsers.find((u) => u.memberId === 'KFR268945');
  if (!superAdmin || !rootMember) {
    throw new Error(`Expected accounts not found (superAdmin=${!!superAdmin}, rootMember=${!!rootMember}) — aborting, nothing was deleted.`);
  }
  console.log(`Keeping: ${superAdmin.memberId} (${superAdmin.fullName}), ${rootMember.memberId} (${rootMember.fullName})`);

  const keepIds = keepUsers.map((u) => u._id);

  const userDel = await db.collection('users').deleteMany({ _id: { $nin: keepIds } });
  console.log(`\nDeleted ${userDel.deletedCount} user(s).`);

  for (const name of COLLECTIONS_TO_WIPE) {
    const result = await db.collection(name).deleteMany({});
    console.log(`  wiped ${name}: ${result.deletedCount} doc(s)`);
  }

  // Reset the root member's own business/profile state to "fresh, unactivated".
  await db.collection('users').updateOne(
    { _id: rootMember._id },
    {
      $set: {
        status: 'INACTIVE',
        activePackageId: null,
        currentPackage: null,
        packagePrice: 0,
        dailyBinaryCap: 0,
        currentRankId: null,
        activationDate: null,
        totalKBP: 0,
        lifetimeIncome: 0,
        directIncome: 0,
        matchingIncome: 0,
        directReferrals: 0
      }
    }
  );

  // Recreate a fresh, empty root BinaryNode (its old one was wiped above with
  // every other binarynodes document).
  await db.collection('binarynodes').insertOne({
    userId: rootMember._id,
    parentId: null,
    position: 'root',
    leftChildId: null,
    rightChildId: null,
    leftVolume: 0,
    rightVolume: 0,
    availableLeftVolume: 0,
    availableRightVolume: 0,
    leftRepurchaseKBP: 0,
    rightRepurchaseKBP: 0,
    matchingVolume: 0,
    pairCount: 0,
    totalKBP: 0,
    level: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  console.log('\nRoot member reset to a fresh, unactivated state (no package, no wallet, no volume).');

  console.log('\n=== FINAL COUNTS ===');
  const collections = await db.listCollections().toArray();
  for (const c of collections.sort((a, b) => a.name.localeCompare(b.name))) {
    const count = await db.collection(c.name).countDocuments();
    console.log(' ', c.name, ':', count);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Go-live reset failed:', err);
  process.exit(1);
});
