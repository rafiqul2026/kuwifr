// server/src/routes/rank.routes.js
const express = require('express');
const router = express.Router();
const rankController = require('../controllers/rank.controller');
const authModule = require('../middleware/auth');

// Flexible auth extraction
const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);
const adminAuth =
  authModule.adminAuth ||
  ((req, res, next) => {
    const role = (req.user?.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return next();
    return res.status(403).json({ success: false, message: 'Administrator credentials required' });
  });

// ============ PUBLIC & MEMBER ROUTES ============
router.get('/', rankController.getAllRanks);
router.get('/all', rankController.getAllRanks);
router.get('/current', auth, rankController.getCurrentRank);
router.get('/user', auth, rankController.getUserRanks);
router.get('/stars', auth, rankController.getKuwiStars);
router.get('/progression', auth, rankController.getRankProgression);
router.post('/initialize', auth, adminAuth, rankController.initializeRanks);

// ============ ADMIN MANAGEMENT ROUTES ============
// Handles /api/admin/ranks and /api/ranks/admin/*
router.get('/admin/all', auth, adminAuth, rankController.getAllRanks);
router.post('/', auth, adminAuth, rankController.createRank);
router.put('/:id', auth, adminAuth, rankController.updateRank);
router.delete('/:id', auth, adminAuth, rankController.deleteRank);

module.exports = router;