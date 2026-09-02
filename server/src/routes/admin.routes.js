// server/src/routes/admin.routes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');

// Import controllers for delegated admin actions
const rankController = require('../controllers/rank.controller');
const fundController = require('../controllers/fund.controller');
const orderController = require('../controllers/order.controller');

// Safe auth middleware import
const authModule = require('../middleware/auth');
const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);

// Guard all admin routes
if (auth) {
  router.use(auth);
}

// ============ DASHBOARD & USERS ============
router.get('/dashboard', adminController.getDashboardStats);
router.get('/users', adminController.getAllUsers);
router.put('/users/:id/status', adminController.updateUserStatus);

// ============ KYC MANAGEMENT ============
router.get('/kyc', adminController.getPendingKYC);
router.post('/kyc/review', adminController.reviewKYC);
router.put('/kyc/:id', adminController.reviewKYC);

// ============ WALLET ADJUSTMENTS ============
router.post('/wallet/adjust', adminController.adjustWallet);

// ============ ORDERS MANAGEMENT ============
router.get('/orders', orderController.getAllOrders);
router.put('/orders/:id/status', orderController.updateOrderStatus);

// ============ RANKS MANAGEMENT ============
router.post('/ranks/initialize', rankController.initializeRanks);

// ============ FUNDS MANAGEMENT ============
router.post('/funds/initialize', fundController.initializeFunds);
router.post('/funds/process-maintenance', fundController.processFundMaintenance);
router.post('/funds/process-all-tto', fundController.processAllTTO);

// ============ SYSTEM INITIALIZATION ============
router.post('/system/initialize', adminController.initializeSystem);

module.exports = router;