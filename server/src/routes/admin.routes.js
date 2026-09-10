// server/src/routes/admin.routes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');

const rankController = require('../controllers/rank.controller');
const fundController = require('../controllers/fund.controller');
const orderController = require('../controllers/order.controller');
const packageController = require('../controllers/package.controller');

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