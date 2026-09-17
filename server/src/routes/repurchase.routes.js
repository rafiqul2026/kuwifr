// server/src/routes/repurchase.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');

const {
  getRepurchaseProducts,
  submitRepurchasePurchase,
  approveRepurchasePurchase,
  rejectRepurchasePurchase,
  getAdminRepurchaseAnalytics,
  get10LevelRepurchase,
  getAdminRepurchaseProducts,
  createRepurchaseProduct,
  updateRepurchaseProduct,
  deleteRepurchaseProduct
} = require('../controllers/repurchase.controller');

// Same multer shape as offer.routes.js / user.routes.js's KYC upload —
// buffer straight into memory, then streamed to Cloudinary in the controller.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 } // 3 MB per image
});

// Import auth middleware (support both named and default exports)
const authModule = require('../middleware/auth');
const auth = typeof authModule === 'function' ? authModule : authModule.auth || authModule.protect;
const adminAuth =
  authModule.adminAuth ||
  ((req, res, next) => {
    const role = (req.user?.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return next();
    return res.status(403).json({ success: false, message: 'Administrator credentials required' });
  });

// Protected Repurchase Routes
router.use(auth);

router.get('/products', getRepurchaseProducts);
router.post('/submit', submitRepurchasePurchase);
router.get('/10-level-stats', get10LevelRepurchase);

// Admin Management & Analytics — pending manual-UPI payment verification
router.get('/admin-analytics', adminAuth, getAdminRepurchaseAnalytics);
router.patch('/approve/:purchaseId', adminAuth, approveRepurchasePurchase);
router.patch('/reject/:purchaseId', adminAuth, rejectRepurchasePurchase);

// Admin: Repurchase Store product catalog (name/price/KBP + up to 4 photos
// per product, uploaded to Cloudinary).
router.get('/admin/products', adminAuth, getAdminRepurchaseProducts);
router.post('/admin/products', adminAuth, upload.array('images', 4), createRepurchaseProduct);
router.put('/admin/products/:id', adminAuth, upload.array('images', 4), updateRepurchaseProduct);
router.delete('/admin/products/:id', adminAuth, deleteRepurchaseProduct);

module.exports = router;
