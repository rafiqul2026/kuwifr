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