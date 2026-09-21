// server/src/scripts/rename_root_member_id.js
//
// Renames the company/system-root account's memberId from KFR268945 to
// KFR000002 (paired with the SUPER_ADMIN login KFR000001), so every future
// member ultimately traces back to this clean, memorable root ID. Also
// resets its login password (the old one is bcrypt-hashed and cannot be
// recovered) and prints the new plaintext password once.
//
// referralCode is renamed alongside memberId — this codebase always sets
// referralCode = memberId at registration (auth.controller.js) and accepts
// EITHER field as a sponsor code at signup, so the two must stay in sync
// for https://kuwifr.in/register?ref=KFR000002 to work.
//
// Uses the Mongoose model (not the raw driver) specifically so its
// pre('save') hook hashes the new password the same way every other login
// on this platform is hashed.
require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');

const OLD_MEMBER_ID = 'KFR268945';
const NEW_MEMBER_ID = 'KFR000002';

function generatePassword() {
  // 12 chars: readable but strong — upper/lower/digit/symbol guaranteed.
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@#$%';
  const all = upper + lower + digits + symbols;
  const pick = (set) => set[crypto.randomInt(set.length)];
  let pwd = pick(upper) + pick(lower) + pick(digits) + pick(symbols);
  for (let i = 0; i < 8; i++) pwd += pick(all);
  // Shuffle so the guaranteed chars aren't always in the same 4 positions.
  return pwd.split('').sort(() => crypto.randomInt(3) - 1).join('');
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const existing = await User.findOne({ memberId: NEW_MEMBER_ID });
  if (existing) {
    throw new Error(`${NEW_MEMBER_ID} is already in use by another account (${existing.fullName}, ${existing.email}) — aborting.`);
  }

  const user = await User.findOne({ memberId: OLD_MEMBER_ID });
  if (!user) {
    throw new Error(`${OLD_MEMBER_ID} not found — aborting.`);
  }
  if (!user.isSystemRoot) {
    throw new Error(`${OLD_MEMBER_ID} is not flagged isSystemRoot — aborting to avoid renaming the wrong account.`);
  }

  const newPassword = generatePassword();

  user.memberId = NEW_MEMBER_ID;
  user.referralCode = NEW_MEMBER_ID;
  user.password = newPassword; // pre('save') hook hashes this
  await user.save();

  console.log(`Renamed ${OLD_MEMBER_ID} -> ${NEW_MEMBER_ID} (${user.fullName}, ${user.email}).`);
  console.log(`New login password: ${newPassword}`);
  console.log(`Join/referral link: https://kuwifr.in/register?ref=${NEW_MEMBER_ID}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Rename failed:', err.message);
  process.exit(1);
});
