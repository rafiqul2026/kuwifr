// server/src/routes/product.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const productController = require('../controllers/product.controller');
const authModule = require('../middleware/auth');

const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);
const adminAuth =
  authModule.adminAuth ||
  ((req, res, next) => {
    const role = (req.user?.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return next();
    return res.status(403).json({ success: false, message: 'Administrator credentials required' });
  });

// Same multer shape as offer.routes.js / repurchase.routes.js — buffer
// straight into memory, then streamed to Cloudinary in the controller.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 } // 3 MB
});

// GET Public & Admin
router.get('/', productController.getAllProducts);
router.get('/categories', productController.getCategories);
router.get('/admin/all', auth, adminAuth, productController.adminGetAllProducts);
router.get('/:id', productController.getProductById);

// Seed Route to populate all 30 products if needed — admin-only, so a
// public, unauthenticated caller can't force arbitrary database writes.
router.post('/seed-all', auth, adminAuth, productController.seedAllProductsManual);

// Admin Mutating Routes
router.post('/', auth, adminAuth, upload.single('image'), productController.createProduct);
router.put('/:id', auth, adminAuth, upload.single('image'), productController.updateProduct);
router.delete('/:id', auth, adminAuth, productController.deleteProduct);

module.exports = router;
