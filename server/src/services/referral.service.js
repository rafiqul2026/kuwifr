// server/src/services/referral.service.js
//
// The Referral collection is a DERIVED, best-effort mirror of the real
// sponsor relationship that lives on User.sponsorId. It's written once, at
// registration time, inside a try/catch block (see
// auth.controller.js#register) that deliberately swallows any error there
// so a genealogy-write failure never blocks account creation:
//
//   try {
//     ...creates one Referral row per ancestor (up to 10 levels)...
//   } catch (genealogyErr) {
//     console.error('Genealogy linking notice:', genealogyErr.message);
//   }
//
// That's the right call for registration itself, but it means a transient
// failure (a slow query, a duplicate-key race, anything) can leave a real,
// active member with a correct User.sponsorId but NO matching Referral row
// — and every "My Team" style view that groups members by Referral.level
// will simply never show that member, even though they are genuinely part
// of the sponsor's downline. This is the exact same failure shape as the
// BinaryNode placement gap fixed by BinaryService.repairAllPlacements, just
// for the unilevel/sponsor-chain data instead of the binary-tree data.
//
// repairAllReferrals() below is the non-destructive backfill for it: never
// deletes anything, only inserts a Referral row where one should exist but
// doesn't, so it's safe to run any number of times.
const User = require('../models/User');
const Referral = require('../models/Referral');

const MAX_LEVEL = 10;

class ReferralService {
  /**
   * Walk up from a member's own sponsor to their up-to-10th ancestor.
   * Mirrors auth.controller.js#getReferralChainForUser exactly, so a
   * backfilled row is indistinguishable from one written at registration.
   */
  async getSponsorChain(startSponsorId) {
    const chain = [];
    let currentId = startSponsorId;
    let steps = 0;
    while (currentId && steps < MAX_LEVEL) {
      const sponsor = await User.findById(currentId).select('_id sponsorId').lean();
      if (!sponsor) break;
      chain.push(sponsor);
      currentId = sponsor.sponsorId;
      steps += 1;
    }
    return chain;
  }

  /**
   * For every user with a sponsor, ensure a Referral row exists for each of
   * their real ancestors (level 1 = their direct sponsor, up to level 10).
   * Only ever inserts missing rows — an existing row, correct or not, is
   * left untouched, so this cannot overwrite anything a human or another
   * process already set.
   *
   * Returns a summary so the admin action that triggers this can report
   * exactly what changed.
   */
  async repairAllReferrals() {
    const users = await User.find({ sponsorId: { $ne: null } })
      .select('_id sponsorId status createdAt')
      .sort({ createdAt: 1 })
      .lean();

    const summary = {
      totalUsersWithSponsor: users.length,
      rowsCreated: 0,
      usersAffected: 0,
      alreadyComplete: 0,
      errors: []
    };

    for (const user of users) {
      try {
        const chain = await this.getSponsorChain(user.sponsorId);
        let createdForThisUser = 0;

        for (let i = 0; i < chain.length; i += 1) {
          const level = i + 1;
          const sponsor = chain[i];

          const existing = await Referral.findOne({ sponsorId: sponsor._id, userId: user._id })
            .select('_id')
            .lean();
          if (existing) continue;

          await Referral.findOneAndUpdate(
            { sponsorId: sponsor._id, userId: user._id },
            {
              $setOnInsert: {
                level,
                parentId: i === 0 ? user.sponsorId : chain[i - 1]._id,
                path: chain.slice(0, i + 1).map((s) => String(s._id)).join('-'),
                // Mirrors the flag package.controller.js flips on activation
                // (Referral.updateMany({ userId }, { isActive: true })) — a
                // backfilled row for an already-ACTIVE member should read the
                // same as one written live at their activation.
                isActive: user.status === 'ACTIVE',
                joinedAt: user.createdAt || new Date()
              }
            },
            { upsert: true, setDefaultsOnInsert: true }
          );
          createdForThisUser += 1;
        }

        if (createdForThisUser > 0) {
          summary.rowsCreated += createdForThisUser;
          summary.usersAffected += 1;
        } else {
          summary.alreadyComplete += 1;
        }
      } catch (err) {
        summary.errors.push({ userId: String(user._id), message: err.message });
      }
    }

    return summary;
  }
}

module.exports = new ReferralService();