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
// Stock the admin assigned to this franchise, and recording sales from it
// (each sale credits FRANCHISE_SALE_COMMISSION to the franchise).
router.get('/stock', auth, franchiseController.getMyFranchiseStock);
router.post('/sales', auth, franchiseController.recordMyFranchiseSale);

// Franchise Panel reports (own franchise only) — see franchisePanel.controller.js
const panel = require('../controllers/franchisePanel.controller');
router.get('/panel/received', auth, panel.getReceived);
router.get('/panel/sales', auth, panel.getSales);
router.get('/panel/deliveries', auth, panel.getDeliveries);
router.get('/panel/bills', auth, panel.getBills);
router.get('/panel/bills/:id', auth, panel.getBill);
router.get('/panel/catalog', auth, panel.getCatalog);

// ============ ADMIN ROUTES (mounted at /api/admin/franchise) ============
router.get('/admin', auth, adminAuth, franchiseController.getFranchiseApplicationsAdmin);
router.post('/admin/grant', auth, adminAuth, franchiseController.grantFranchiseAdmin);
// Alias so POST /api/admin/franchise/grant (this router is also mounted at
// /api/admin/franchise) works too — the Grant modal used that path and got
// "Route not found".
router.post('/grant', auth, adminAuth, franchiseController.grantFranchiseAdmin);
router.get('/admin/:id/overview', auth, adminAuth, franchiseController.getFranchiseOverviewAdmin);
router.post('/admin/:id/approve', auth, adminAuth, franchiseController.approveFranchiseAdmin);
router.post('/admin/:id/reject', auth, adminAuth, franchiseController.rejectFranchiseAdmin);
router.post('/admin/:id/revoke', auth, adminAuth, franchiseController.revokeFranchiseAdmin);

module.exports = router;