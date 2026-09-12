// server/src/services/downline.service.js
//
// Authoritative full unilevel (sponsor-chain) downline computation — the
// single source of truth that replaces dependence on the `Referral`
// collection wherever it was previously used to count or list a member's
// downline beyond their own direct referrals.
//
// WHY THIS EXISTS
// ----------------
// `Referral` is a DERIVED, best-effort mirror of a relationship that already
// lives, authoritatively, on every User document (`User.sponsorId`). It is
// written once, at registration, inside a try/catch that logs and continues
// on failure (see the registration flow in auth.controller.js) — so for any
// given member it can silently end up incomplete, or entirely empty, while
// the real relationship on `User.sponsorId` is always correct (Mongoose
// requires a user to have it set correctly to be saved in the first place).
//
// This was confirmed, in this codebase, to be the exact root cause of:
//   - "My Team" page showing 0 members on every generation below Direct
//     Referral for a member who genuinely has 50+ people in their downline
//     (the Growth Generation / binary tree page, which reads BinaryNode
//     instead of Referral, showed the real, populated tree).
//   - Dashboard "Active Members" / "Total Members" only reflecting DIRECT
//     referrals instead of the full downline the card's own label promised.
//   - Today/Monthly/Total "Star" cards under-counting because the
//     Kuwi-Star-holder search only looked inside the (incomplete) Referral
//     set.
//   - Gold Star monthly salary qualification (salary.service.js) under-
//     counting star-qualified downline members — a genuine, real-money bug,
//     not merely a display one.
//
// getFullDownline() below computes the same information directly from the
// live, always-correct User.sponsorId graph using MongoDB's $graphLookup, in
// a single query, to any depth — so there is no separate, driftable
// collection left in the loop for any of these consumers ever again.
// `Referral` itself (and referral.service.js's repair tool) are left in
// place since other, lower-traffic code paths may still read it, but every
// call site this file's callers used to hit is now backed by this instead.
const mongoose = require('mongoose');
const User = require('../models/User');

// Matches the 15-level repurchase compensation plan (levelRates has 15
// entries as of the Sept 2026 plan update — previously 10): $graphLookup
// depth 0..14 = generation/level 1..15 (depth + 1 = level number). Also
// used by "My Team" / Growth-Generation genealogy (buildGenerationGroups in
// user.controller.js), which now shows up to 15 generations as a side
// effect — a strict improvement (more real data visible), not a behavior
// change to any payout logic.
const MAX_DEPTH = 14;
const MAX_LEVEL = MAX_DEPTH + 1;

/**
 * Returns every downline member of `userId`, at any depth up to the 15-level
 * cap, computed directly from User.sponsorId. Each entry carries a `depth`
 * field (0 = direct referral, so level = depth + 1) and only the fields
 * callers actually need — deliberately excludes password/otp/kyc/etc, even
 * though $graphLookup would otherwise copy each raw User document in full.
 */
const getFullDownline = async (userId) => {
  if (!userId) return [];
  const rootId = new mongoose.Types.ObjectId(userId);

  const [result] = await User.aggregate([
    { $match: { _id: rootId } },
    {
      $graphLookup: {
        from: 'users',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'sponsorId',
        as: 'downline',
        maxDepth: MAX_DEPTH,
        depthField: 'depth'
      }
    },
    {
      $project: {
        _id: 0,
        downline: {
          $map: {
            input: '$downline',
            as: 'd',
            in: {
              _id: '$$d._id',
              fullName: '$$d.fullName',
              email: '$$d.email',
              phoneNumber: '$$d.phoneNumber',
              memberId: '$$d.memberId',
              referralCode: '$$d.referralCode',
              status: '$$d.status',
              binarySide: '$$d.binarySide',
              activePackageId: '$$d.activePackageId',
              currentPackage: '$$d.currentPackage',
              activationDate: '$$d.activationDate',
              totalKBP: '$$d.totalKBP',
              createdAt: '$$d.createdAt',
              sponsorId: '$$d.sponsorId',
              depth: '$$d.depth'
            }
          }
        }
      }
    }
  ]);

  return result?.downline || [];
};

/** Lightweight variant for callers that only need ids/status/side (counts, filters). */
const getFullDownlineIds = async (userId) => {
  const downline = await getFullDownline(userId);
  return downline.map((m) => ({ _id: m._id, status: m.status, binarySide: m.binarySide, depth: m.depth }));
};

module.exports = { getFullDownline, getFullDownlineIds, MAX_DEPTH, MAX_LEVEL };
