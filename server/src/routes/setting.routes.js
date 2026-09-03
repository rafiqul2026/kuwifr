// server/src/routes/setting.routes.js
const express = require('express');
const router = express.Router();
const settingController = require('../controllers/setting.controller');
const authModule = require('../middleware/auth');

const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);
const adminAuth =
  authModule.adminAuth ||
  ((req, res, next) => {
    const role = (req.user?.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return next();
    return res.status(403).json({ success: false, message: 'Administrator credentials required' });
  });

// Public / Member Read Settings (Company profile, maintenance flag)
router.get('/', settingController.getSettings);
router.get('/all', settingController.getSettings);

// Admin Mutation Routes (Supports both /api/settings and /api/admin/settings)
router.get('/admin', auth, adminAuth, settingController.getSettings);
router.put('/', auth, adminAuth, settingController.updateSettings);
router.put('/admin', auth, adminAuth, settingController.updateSettings);
router.post('/reset', auth, adminAuth, settingController.resetSettings);
router.post('/admin/reset', auth, adminAuth, settingController.resetSettings);

module.exports = router;