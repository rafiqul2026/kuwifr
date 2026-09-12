// server/src/routes/admin.routes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');

const rankController = require('../controllers/rank.controller');
const fundController = require('../controllers/fund.controller');
const orderController = require('../controllers/order.controller');
const packageController = require('../controllers/package.controller');
const adminAlertsController = require('../controllers/adminAlerts.controller');

const authModule = require('../middleware/auth');
const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);
const adminAuth = authModule.adminAuth || ((req, res, next) => {
  const role = (req.user?.role || '').toUpperCase();
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return next();
  return res.status(403).json({ success: false, message: 'Admin access required' });
});

if (auth) router.use(auth);
if (adminAuth) router.use(adminAuth);

router.get('/dashboard', adminController.getDashboardStats);
router.get('/users', adminController.getAllUsers);
router.get('/members', adminController.getAllUsers);
router.get('/members/search', adminController.searchMembersForActivation);

router.put('/users/:id/status', adminController.updateUserStatus);
router.put('/members/:id/status', adminController.updateUserStatus);

router.post('/members/:id/activate-package', adminController.activateMemberWithPackage);
router.post('/package-activations', orderController.activateCashPackage);

// Non-destructive binary tree repair — fills in any missing BinaryNode
// placement (leftChildId/rightChildId links) from existing sponsor data,
// for every user. Never deletes anything; safe to run more than once.
// See BinaryService.repairAllPlacements for why this is needed.
router.post('/binary/repair', async (req, res, next) => {
  try {
    const BinaryService = require('../services/binary.service');
    const summary = await BinaryService.repairAllPlacements();
    res.json({
      success: true,
      message: `Binary tree repair complete. ${summary.placementsFixed.length} member(s) re-linked, ${summary.rootsEnsured} root node(s) ensured, ${summary.alreadyCorrect} already correct.`,
      data: summary
    });
  } catch (error) {
    next(error);
  }
});

// Non-destructive unilevel/sponsor-chain repair — fills in any missing
// Referral rows (the data "My Team" groups members by generation with)
// from the real User.sponsorId relationships, for every user. Never
// deletes or overwrites an existing row; safe to run more than once.
// See ReferralService.repairAllReferrals for why this is needed — same
// root cause shape as the binary repair above, different collection.
router.post('/referrals/repair', async (req, res, next) => {
  try {
    const ReferralService = require('../services/referral.service');
    const summary = await ReferralService.repairAllReferrals();
    res.json({
      success: true,
      message: `Referral genealogy repair complete. ${summary.rowsCreated} row(s) created across ${summary.usersAffected} member(s), ${summary.alreadyComplete} already complete.`,
      data: summary
    });
  } catch (error) {
    next(error);
  }
});

// One-time index migration: the Referral collection used to have a
// single-field unique index on `userId` alone, which made it physically
// impossible for MongoDB to store more than the level-1 row for any member
// with 2+ ancestors — see models/Referral.js's comment on the userId field
// for the full story. Changing the Mongoose schema (already done) does NOT
// retroactively drop that old index from an already-running database —
// Mongoose only creates new indexes on startup, it doesn't remove ones no
// longer declared. This endpoint does that one-time cleanup: drops the old
// `userId_1` unique index if present (no-op if it's already gone) and syncs
// the collection's indexes to exactly what the schema now declares
// (recreating the correct compound-unique {userId,sponsorId} index and
// leaving all data untouched — this only touches indexes, never documents).
// Run this ONCE, then run /referrals/repair — before that, every level-2+
// referral row will keep failing with the same duplicate-key error.
router.post('/referrals/fix-index', async (req, res, next) => {
  try {
    const Referral = require('../models/Referral');
    let droppedOldIndex = false;
    try {
      await Referral.collection.dropIndex('userId_1');
      droppedOldIndex = true;
    } catch (dropErr) {
      // IndexNotFound (code 27) means it's already gone — fine. Anything
      // else is worth surfacing.
      if (dropErr.codeName !== 'IndexNotFound' && dropErr.code !== 27) {
        throw dropErr;
      }
    }
    const syncResult = await Referral.syncIndexes();
    res.json({
      success: true,
      message: droppedOldIndex
        ? 'Old single-field unique index on userId dropped and indexes re-synced. Run "Repair Referral Chains" next.'
        : 'Old index was already gone (nothing to drop). Indexes re-synced. Run "Repair Referral Chains" next.',
      data: { droppedOldIndex, syncResult }
    });
  } catch (error) {
    next(error);
  }
});

// Non-destructive backfill for Direct Referral Income that a member's
// activation should have paid their sponsor but never did — e.g. any
// activation that went through order.controller.js#activateCashPackage
// before its transaction-commit-ordering bug was fixed. Only ever fills in
// a genuinely missing credit (processReferralIncome's own duplicate guards
// make this safe to run repeatedly); never re-pays a credit that already
// exists. See IncomeService.reconcileMissingReferralIncome for the full
// real-world case (RAFIQUL Test / KFR441197) that exposed this.
router.post('/income/reconcile-referral', async (req, res, next) => {
  try {
    const IncomeService = require('../services/income.service');
    const summary = await IncomeService.reconcileMissingReferralIncome();
    res.json({
      success: true,
      message: `Referral income reconciliation complete. ${summary.credited} missing credit(s) paid across ${summary.checked} active member(s) checked, ${summary.alreadyCredited} already correct.`,
      data: summary
    });
  } catch (error) {
    next(error);
  }
});

// Non-destructive top-up for a REFERRAL_INCOME credit that exists but is for
// LESS than it should be — different from the "missing" case above. Root
// cause: processReferralIncome used to re-derive KBP from the package's
// CURRENT catalog value instead of the order's own immutable kbpGenerated
// (fixed — see that function's comment), so any order processed after its
// package's KBP was edited in Admin > Packages got a stale, lower credit.
// Uses ONLY each transaction's own source Order's kbpGenerated (never a
// live catalog lookup) to find the correct amount, and tops up exactly the
// shortfall as a separate, clearly-labeled correction transaction — the
// original transaction is never edited or deleted. Idempotent: safe to run
// any time, repeatedly.
router.post('/income/reconcile-referral-underpaid', async (req, res, next) => {
  try {
    const IncomeService = require('../services/income.service');
    const summary = await IncomeService.reconcileUnderpaidReferralIncome();
    res.json({
      success: true,
      message: `Underpaid referral income reconciliation complete. ${summary.corrected} correction(s) credited across ${summary.checked} transaction(s) checked, ${summary.alreadyCorrect} already correct.`,
      data: summary
    });
  } catch (error) {
    next(error);
  }
});

// Non-destructive backfill for Matching Income / Left-vs-Right leg KBP that
// was never propagated up the binary tree because the original activation
// never called BinaryService.updateVolumes() correctly for that member (see
// updateVolumes()'s doc comment for the five separate activation paths that
// could each independently skip this). Compares each member's real
// completed-order KBP total against what actually reached their own
// BinaryNode.totalKBP and replays exactly the shortfall through the real
// matching engine — so first-pair 2:1 rules, caps, leadership bonus, and
// rank re-evaluation all fire normally. Safe to run repeatedly: a second run
// always finds a shortfall of 0 for anyone already reconciled.
router.post('/income/reconcile-matching', async (req, res, next) => {
  try {
    const BinaryService = require('../services/binary.service');
    const summary = await BinaryService.reconcileMissingVolume();
    res.json({
      success: true,
      message: `Matching income reconciliation complete. ${summary.reconciled.length} member(s) had missing KBP replayed through the matching engine, ${summary.alreadyCorrect} already correct.`,
      data: summary
    });
  } catch (error) {
    next(error);
  }
});

// Full, filterable income transaction history for the Admin panel — per the
// user's explicit request: "PLEASE ADD ALL THE TRANSCTION HISTORY IN ADMIN
// PANEL. ADMIN SHOULD KNOW WHICH MEMBER GET REFERRAL INCOME FROM WHICH
// MEMBER WITH DATE AND TIME. AND ADD THE ALL OTHER HISTORY IN ADMIN PANEL."
// Returns every IncomeTransaction (any type, not just referral/matching),
// each enriched with WHO received it, and — for REFERRAL_INCOME/
// MATCHING_INCOME specifically — WHICH member generated it, on WHICH
// package, at WHAT KBP, with date/time (createdAt, already on every
// transaction). See IncomeService.enrichTransactionHistory for exactly what
// it fills in and why matching income before this fix can't be
// retroactively attributed to a source member.
//
// Query params (all optional): type=REFERRAL_INCOME|MATCHING_INCOME|... ,
// memberId=<memberId, email, or referral code of the RECIPIENT>,
// status=CREDITED|FAILED|... (default: CREDITED + FAILED, so capped-to-zero
// matching attempts stay visible for audit), page, limit (default 50).
router.get('/income/history', async (req, res, next) => {
  try {
    const IncomeTransaction = require('../models/IncomeTransaction');
    const User = require('../models/User');
    const IncomeService = require('../services/income.service');

    const { type, memberId, status, page = 1, limit = 50 } = req.query;
    const match = {};
    if (type) match.type = type;
    match.status = status ? status : { $in: ['CREDITED', 'FAILED'] };

    if (memberId) {
      const recipient = await User.findOne({
        $or: [{ memberId }, { email: memberId }, { referralCode: memberId }]
      }).select('_id');
      if (!recipient) {
        return res.json({
          success: true,
          data: { transactions: [], totalCount: 0, page: parseInt(page, 10), limit: parseInt(limit, 10) }
        });
      }
      match.userId = recipient._id;
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [transactions, totalCount] = await Promise.all([
      IncomeTransaction.find(match).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      IncomeTransaction.countDocuments(match)
    ]);

    // WHO received each credit (the recipient) — batched, same pattern as
    // enrichTransactionHistory's own batched lookups for WHO generated it.
    const recipientIds = [...new Set(transactions.map((t) => String(t.userId)))];
    const recipients = recipientIds.length
      ? await User.find({ _id: { $in: recipientIds } }).select('memberId fullName email').lean()
      : [];
    const recipientMap = new Map(recipients.map((r) => [String(r._id), r]));

    const enriched = await IncomeService.enrichTransactionHistory(transactions);
    const rows = enriched.map((tx) => {
      const recipient = recipientMap.get(String(tx.userId));
      return {
        ...tx,
        recipientMemberId: recipient?.memberId || null,
        recipientFullName: recipient?.fullName || null,
        recipientEmail: recipient?.email || null
      };
    });

    res.json({
      success: true,
      data: { transactions: rows, totalCount, page: pageNum, limit: limitNum }
    });
  } catch (error) {
    next(error);
  }
});

// Business rule: a member is ACTIVE only if they hold a real, verified
// package. GET previews which MEMBER accounts are currently ACTIVE with NO
// package on file (an impossible state, previously reachable via a bug in
// package.controller.js#purchasePackage — see DataIntegrityService for the
// full story); POST reverts exactly those accounts to INACTIVE. Never
// touches a member who already has a valid activePackageId, and never
// touches ADMIN/SUPER_ADMIN accounts.
router.get('/members/orphaned-active-status', async (req, res, next) => {
  try {
    const DataIntegrityService = require('../services/dataIntegrity.service');
    const members = await DataIntegrityService.findOrphanedActiveMembers();
    res.json({
      success: true,
      message: `${members.length} member(s) found ACTIVE with no package on file.`,
      data: { count: members.length, members }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/members/fix-orphaned-active-status', async (req, res, next) => {
  try {
    const DataIntegrityService = require('../services/dataIntegrity.service');
    const summary = await DataIntegrityService.fixOrphanedActiveMembers({ dryRun: false });
    res.json({
      success: true,
      message: `${summary.modifiedCount} member(s) reverted to INACTIVE (were ACTIVE with no package on file).`,
      data: summary
    });
  } catch (error) {
    next(error);
  }
});

// Personal admin alert inbox (distinct from the broadcast-composer
// Notifications page) — real system events for the logged-in admin.
// See services/adminAlerts.service.js for what it synthesizes.
router.get('/alerts', adminAlertsController.getAlerts);
router.post('/alerts/mark-all-read', adminAlertsController.markAllRead);
router.post('/alerts/clear-all', adminAlertsController.clearAll);
router.post('/alerts/:id/dismiss', adminAlertsController.dismissAlert);

router.get('/kyc', adminController.getPendingKYC);
router.post('/kyc/review', adminController.reviewKYC);
router.put('/kyc/:id', adminController.reviewKYC);

router.post('/wallet/adjust', adminController.adjustWallet);

router.get('/orders', orderController.getAllOrders);
router.put('/orders/:id/status', orderController.updateOrderStatus);
router.get('/package-sales-report', orderController.getPackageSalesReport);

if (packageController && packageController.getAllPackages) {
  router.get('/packages', packageController.getAllPackages);
}

router.post('/ranks/initialize', rankController.initializeRanks);
router.post('/funds/initialize', fundController.initializeFunds);
router.post('/funds/process-maintenance', fundController.processFundMaintenance);
router.post('/funds/process-all-tto', fundController.processAllTTO);
router.post('/system/initialize', adminController.initializeSystem);

module.exports = router;