// server/src/routes/franchise.routes.js
const express = require('express');
const router = express.Router();
const franchiseController = require('../controllers/franchise.controller');
const authModule = require('../middleware/auth');

const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);
const adminAuth =
  authModule.adminAuth ||
  ((req, res, next) => {
    const role = (req.user?.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return next();
    return res.status(403).json({ success: false, message: 'Administrator credentials required' });
  });

// ============ MEMBER ROUTES ============
router.post('/apply', auth, franchiseController.applyForFranchise);
router.get('/status', auth, franchiseController.getMyFranchiseStatus);
router.get('/dashboard', auth, franchiseController.getMyFranchiseDashboard);
router.get('/territory', auth, franchiseController.getMyFranchiseTerritory);

// ============ ADMIN ROUTES (mounted at /api/admin/franchise) ============
router.get('/admin', auth, adminAuth, franchiseController.getFranchiseApplicationsAdmin);
router.post('/admin/grant', auth, adminAuth, franchiseController.grantFranchiseAdmin);
router.get('/admin/:id/overview', auth, adminAuth, franchiseController.getFranchiseOverviewAdmin);
router.post('/admin/:id/approve', auth, adminAuth, franchiseController.approveFranchiseAdmin);
router.post('/admin/:id/reject', auth, adminAuth, franchiseController.rejectFranchiseAdmin);
router.post('/admin/:id/revoke', auth, adminAuth, franchiseController.revokeFranchiseAdmin);

module.exports = router;