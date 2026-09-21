// server/src/scripts/rename_admin_and_root_ids.js
//
// Two renames requested for go-live:
//   1. SUPER_ADMIN login (was KFR000001) -> User ID "Admin" (stored as
//      "ADMIN" — the schema forces memberId uppercase), password reset to
//      the member's own chosen "Admin#&2021K".
//   2. Company-root MEMBER account (isSystemRoot, was KFR000002) ->
//      KFR000786, SAME password as before (not changed this time).
//      referralCode renamed alongside memberId, same as the previous
//      KFR268945 -> KFR000002 rename, so
//      https://kuwifr.in/register?ref=KFR000786 keeps working.
//
// Both use the Mongoose model (not the raw driver) so the SUPER_ADMIN's new
// password goes through the same pre('save') bcrypt hook every other login
// on this platform uses.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  // --- 1. SUPER_ADMIN: KFR000001 -> Admin ---
  const admin = await User.findOne({ memberId: 'KFR000001' });
  if (!admin) throw new Error('KFR000001 not found — aborting.');
  if (admin.role !== 'SUPER_ADMIN') throw new Error(`KFR000001 has role ${admin.role}, not SUPER_ADMIN — aborting to avoid renaming the wrong account.`);

  const clash = await User.findOne({ memberId: 'ADMIN', _id: { $ne: admin._id } });
  if (clash) throw new Error(`"ADMIN" is already in use by another account (${clash.fullName}) — aborting.`);

  admin.memberId = 'Admin'; // schema uppercases this to "ADMIN" on save
  admin.password = 'Admin#&2021K';
  await admin.save();
  console.log(`SUPER_ADMIN renamed: KFR000001 -> ${admin.memberId} (password updated).`);

  // --- 2. Root MEMBER: KFR000002 -> KFR000786 (same password) ---
  const clash2 = await User.findOne({ memberId: 'KFR000786' });
  if (clash2) throw new Error(`KFR000786 is already in use by another account (${clash2.fullName}) — aborting.`);

  const root = await User.findOne({ memberId: 'KFR000002' });
  if (!root) throw new Error('KFR000002 not found — aborting.');
  if (!root.isSystemRoot) throw new Error('KFR000002 is not flagged isSystemRoot — aborting to avoid renaming the wrong account.');

  root.memberId = 'KFR000786';
  root.referralCode = 'KFR000786';
  await root.save(); // password untouched — isModified('password') is false, hook is a no-op
  console.log(`Root member renamed: KFR000002 -> ${root.memberId} (password unchanged).`);
  console.log(`Join/referral link: https://kuwifr.in/register?ref=${root.memberId}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Rename failed:', err.message);
  process.exit(1);
});
