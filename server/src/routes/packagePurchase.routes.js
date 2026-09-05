// server/src/routes/packagePurchase.routes.js
const express = require('express');
const router = express.Router();
const authModule = require('../middleware/auth');
const packagePurchaseController = require('../controllers/packagePurchase.controller');

// Resolve authentication middleware matching your project convention
const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);
const adminAuth =
  authModule.adminAuth ||
  ((req, res, next) => {
    const role = (req.user?.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return next();
    return res.status(403).json({ success: false, message: 'Administrator credentials required' });
  });

// ============ MEMBER ACTIVATION ROUTE ============
router.post('/activate', auth, packagePurchaseController.completePackagePurchase);

// ============ ADMIN ANALYTICS ROUTE ============
router.get('/admin-analytics', auth, adminAuth, packagePurchaseController.getAdminPackageAnalytics);

module.exports = router;