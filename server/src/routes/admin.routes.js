// server/src/routes/adminRoutes.js
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
const adminAuth = authModule.adminAuth || ((req, res, next) => {
  const role = (req.user?.role || '').toUpperCase();
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return next();
  return res.status(403).json({ success: false, message: 'Admin access required' });
});

// Guard all admin routes
if (auth) {
  router.use(auth);
}
if (adminAuth) {
  router.use(adminAuth);
}

// ============ DASHBOARD ============
router.get('/dashboard', adminController.getDashboardStats);

// ============ MEMBERS & USERS (Dual Support) ============
router.get('/users', adminController.getAllUsers);
router.get('/members', adminController.getAllUsers);

router.put('/users/:id/status', adminController.updateUserStatus);
router.put('/members/:id/status', adminController.updateUserStatus);

// Soft-deactivation for members
router.delete('/members/:id', async (req, res, next) => {
  try {
    const User = require('../models/User');
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'DEACTIVATED' },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Member account deactivated successfully',
      data: { user }
    });
  } catch (err) {
    next(err);
  }
});

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