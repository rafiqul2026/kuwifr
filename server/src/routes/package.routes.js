// server/src/routes/package.routes.js
const express = require('express');
const router = express.Router();
const packageController = require('../controllers/package.controller');
const authModule = require('../middleware/auth');

// Flexible auth middleware extraction
const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);
const adminAuth =
  authModule.adminAuth ||
  ((req, res, next) => {
    const role = (req.user?.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return next();
    return res.status(403).json({ success: false, message: 'Administrator credentials required' });
  });

// ============ PUBLIC / MEMBER ROUTES ============
router.get('/', packageController.getAllPackages);
router.get('/all', packageController.getAllPackages);
router.get('/:id', packageController.getPackageById);
router.post('/purchase', auth, packageController.purchasePackage);

// ============ ADMIN MANAGEMENT ROUTES ============
router.get('/admin/all', auth, adminAuth, packageController.adminGetAllPackages);
router.post('/', auth, adminAuth, packageController.createPackage);
router.put('/:id', auth, adminAuth, packageController.updatePackage);
router.put('/:id/toggle', auth, adminAuth, packageController.togglePackageStatus);
router.delete('/:id', auth, adminAuth, packageController.deletePackage);

module.exports = router;