// server/src/routes/offer.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const offerController = require('../controllers/offer.controller');
const authModule = require('../middleware/auth');

const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);
const adminAuth =
  authModule.adminAuth ||
  ((req, res, next) => {
    const role = (req.user?.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return next();
    return res.status(403).json({ success: false, message: 'Administrator credentials required' });
  });

// Same multer shape as user.routes.js's avatarUpload/kycUploadFields —
// buffer straight into memory, then streamed to Cloudinary in the controller.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 } // 3 MB
});

// ============ MEMBER / PUBLIC ROUTES ============
router.get('/', offerController.getActiveOffers);

// ============ ADMIN ROUTES (mounted at /api/admin/offers) ============
router.get('/admin', auth, adminAuth, offerController.getAllOffersAdmin);
router.post('/admin', auth, adminAuth, upload.single('image'), offerController.createOffer);
router.put('/admin/:id', auth, adminAuth, upload.single('image'), offerController.updateOffer);
router.delete('/admin/:id', auth, adminAuth, offerController.deleteOffer);

module.exports = router;