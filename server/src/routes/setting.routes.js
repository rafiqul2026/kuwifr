// server/src/routes/setting.routes.js
const express = require('express');
const router = express.Router();
const adminRouter = express.Router();
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

// ============================================================
// PUBLIC router — mounted at /api/settings in app.js.
// Returns only the PUBLIC-SAFE subset (company profile, maintenance flag,
// compensation rates) — never payment/SMTP secrets. See toPublicSettings()
// in setting.controller.js for the exact allow-list.
// ============================================================
router.get('/', settingController.getSettings);
router.get('/all', settingController.getSettings);

// Admin can also reach the full document/mutations through this same mount
// for convenience (some older frontend code paths call /api/settings/admin).
router.get('/admin', auth, adminAuth, settingController.getFullSettings);
router.put('/', auth, adminAuth, settingController.updateSettings);
router.put('/admin', auth, adminAuth, settingController.updateSettings);
router.post('/reset', auth, adminAuth, settingController.resetSettings);
router.post('/admin/reset', auth, adminAuth, settingController.resetSettings);

// ============================================================
// ADMIN-ONLY router — mounted at /api/admin/settings in app.js.
// EVERY route here requires auth+adminAuth, including the root GET, so
// visiting /api/admin/settings always returns the FULL document (secrets
// included) rather than silently falling back to the public-safe subset.
// This is a separate router (not the same object as `router` above) so its
// root path can behave differently depending on which prefix reached it.
// ============================================================
adminRouter.use(auth, adminAuth);
adminRouter.get('/', settingController.getFullSettings);
adminRouter.get('/admin', settingController.getFullSettings);
adminRouter.put('/', settingController.updateSettings);
adminRouter.put('/admin', settingController.updateSettings);
adminRouter.post('/reset', settingController.resetSettings);
adminRouter.post('/admin/reset', settingController.resetSettings);

module.exports = router;
module.exports.adminRouter = adminRouter;
