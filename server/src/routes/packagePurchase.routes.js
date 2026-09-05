// server/src/routes/packagePurchase.routes.js
const express = require('express');
const router = express.Router();
const authModule = require('../middleware/auth');
const packagePurchaseController = require('../controllers/packagePurchase.controller');

const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);
const adminAuth =
  authModule.adminAuth ||
  ((req, res, next) => {
    const role = (req.user?.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return next();
    return res.status(403).json({ success: false, message: 'Administrator credentials required' });
  });

// Member Purchase Request
router.post('/activate', auth, packagePurchaseController.completePackagePurchase);

// Admin Management & Analytics
router.get('/admin-analytics', auth, adminAuth, packagePurchaseController.getAdminPackageAnalytics);
router.patch('/approve/:purchaseId', auth, adminAuth, packagePurchaseController.approvePackagePurchase);
router.patch('/reject/:purchaseId', auth, adminAuth, packagePurchaseController.rejectPackagePurchase);

module.exports = router;