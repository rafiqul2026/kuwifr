// server/src/routes/repurchase.routes.js
const express = require('express');
const router = express.Router();

const {
  getRepurchaseProducts,
  submitRepurchasePurchase,
  approveRepurchasePurchase,
  rejectRepurchasePurchase,
  getAdminRepurchaseAnalytics,
  get10LevelRepurchase
} = require('../controllers/repurchase.controller');

// Import auth middleware (support both named and default exports)
const authModule = require('../middleware/auth');
const auth = typeof authModule === 'function' ? authModule : authModule.auth || authModule.protect;
const adminAuth =
  authModule.adminAuth ||
  ((req, res, next) => {
    const role = (req.user?.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return next();
    return res.status(403).json({ success: false, message: 'Administrator credentials required' });
  });

// Protected Repurchase Routes
router.use(auth);

router.get('/products', getRepurchaseProducts);
router.post('/submit', submitRepurchasePurchase);
router.get('/10-level-stats', get10LevelRepurchase);

// Admin Management & Analytics — pending manual-UPI payment verification
router.get('/admin-analytics', adminAuth, getAdminRepurchaseAnalytics);
router.patch('/approve/:purchaseId', adminAuth, approveRepurchasePurchase);
router.patch('/reject/:purchaseId', adminAuth, rejectRepurchasePurchase);

module.exports = router;
