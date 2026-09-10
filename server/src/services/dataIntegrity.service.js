// server/src/services/dataIntegrity.service.js
//
// Business rule (stated explicitly by the product owner): a member's ID is
// ACTIVE only if they have actually purchased a real package. With no
// verified package on file, the account must show INACTIVE. That has now
// been made structurally impossible to violate going forward — see the
// pre-save hook on models/User.js and the fixes in
// package.controller.js#purchasePackage and
// packagePurchase.controller.js#approvePackagePurchase — but none of that
// retroactively fixes member records that were already written into the
// bad state before those guards existed (e.g. via the old
// purchasePackage's DEFAULT_PACKAGES fallback, which could flip a member
// to ACTIVE without ever setting activePackageId).
//
// This service finds and fixes exactly that: MEMBER accounts sitting in
// the impossible "ACTIVE with no package" state.
const User = require('../models/User');

class DataIntegrityService {
  /**
   * Read-only: list every MEMBER currently in the impossible state.
   */
  async findOrphanedActiveMembers() {
    return User.find({
      role: 'MEMBER',
      status: 'ACTIVE',
      activePackageId: null
    })
      .select('_id memberId fullName email phoneNumber status activationDate currentPackage createdAt')
      .sort({ createdAt: 1 })
      .lean();
  }

  /**
   * Revert every orphaned member back to INACTIVE.
   *
   * There is no reliable way to know which package such a member actually
   * intended/paid for after the fact — the broken code path never created
   * an Order or PackagePurchase record for them, so there is nothing on
   * file to recover their real intent from. The only safe, business-rule-
   * correct fix is to put them back to INACTIVE (exactly what "no verified
   * package on file" means) so they — or an admin — can activate them
   * properly through the real, payment-verified flow.
   *
   * Also zeroes totalKBP for these members: the buggy path incremented it
   * directly (`user.totalKBP += packageKBP`) with no real package or Order
   * behind it, so it isn't real business volume either.
   *
   * NEVER touches ADMIN/SUPER_ADMIN accounts, and never touches a member
   * who has a valid activePackageId — this can only move a member INTO the
   * business-rule-correct state, never out of a correct one.
   *
   * @param {boolean} dryRun - when true (default), makes no changes and
   *   only reports what would happen.
   */
  async fixOrphanedActiveMembers({ dryRun = true } = {}) {
    const orphans = await this.findOrphanedActiveMembers();

    if (dryRun || orphans.length === 0) {
      return { dryRun, affectedCount: orphans.length, modifiedCount: 0, members: orphans };
    }

    const ids = orphans.map((m) => m._id);
    const result = await User.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          status: 'INACTIVE',
          activationDate: null,
          currentPackage: null,
          packagePrice: 0,
          dailyBinaryCap: 0,
          totalKBP: 0
        }
      }
    );

    return {
      dryRun: false,
      affectedCount: orphans.length,
      modifiedCount: result.modifiedCount,
      members: orphans
    };
  }
}

module.exports = new DataIntegrityService();