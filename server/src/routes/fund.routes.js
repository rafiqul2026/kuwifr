// server/src/routes/fund.routes.js
const express = require('express');
const router = express.Router();
const fundController = require('../controllers/fund.controller');

// Support flexible auth middleware
const authModule = require('../middleware/auth');
const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);
const adminAuth =
  authModule.adminAuth ||
  ((req, res, next) => {
    const role = (req.user?.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return next();
    return res.status(403).json({ success: false, message: 'Administrator credentials required' });
  });

// ============ PUBLIC & MEMBER ENDPOINTS ============
router.get('/', fundController.getAllFunds);
router.get('/all', fundController.getAllFunds);
router.get('/stats', fundController.getAdminFundStats);
router.get('/status', auth, fundController.getFundStatus);
router.post('/process-qualification', auth, fundController.processFundQualification);
router.get('/benefits', auth, fundController.getFundBenefits);
router.post('/calculate-tto', auth, fundController.calculateTTO);
router.get('/tto-history', auth, fundController.getTTORecords);
router.get('/current-tto', auth, fundController.getCurrentTTO);

// ============ ADMIN MANAGEMENT ENDPOINTS ============
// Handles /api/funds/* and /api/admin/funds/*
router.post('/initialize', auth, adminAuth, fundController.initializeFunds);
router.post('/admin/initialize', auth, adminAuth, fundController.initializeFunds);
router.get('/admin/stats', auth, adminAuth, fundController.getAdminFundStats);
router.put('/:id', auth, adminAuth, fundController.updateFund);
router.put('/admin/:id', auth, adminAuth, fundController.updateFund);

module.exports = router;