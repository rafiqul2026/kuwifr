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

// ============ ADMIN MANAGEMENT ROUTES ============
// Moved from a member-reachable route to admin-only: it activates a
// member's ID with ZERO payment verification (no transaction ID, no proof,
// no approval step), which is fine for an admin doing a manual/offline
// activation but is a real self-activation bypass if any authenticated
// member can call it directly. See the long comment on
// package.controller.js#purchasePackage for the full story — members
// activate through PackagesPage.jsx's payment-proof submission
// (POST /api/package-purchases/activate) instead, which an admin then
// approves.
router.post('/purchase', auth, adminAuth, packageController.purchasePackage);
router.get('/admin/all', auth, adminAuth, packageController.adminGetAllPackages);
router.post('/', auth, adminAuth, packageController.createPackage);
router.put('/:id', auth, adminAuth, packageController.updatePackage);
router.put('/:id/toggle', auth, adminAuth, packageController.togglePackageStatus);
router.delete('/:id', auth, adminAuth, packageController.deletePackage);

module.exports = router;