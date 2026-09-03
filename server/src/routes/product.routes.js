// server/src/routes/product.routes.js
const express = require('express');
const router = express.Router();
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

// GET Public & Admin
router.get('/', productController.getAllProducts);
router.get('/categories', productController.getCategories);
router.get('/admin/all', auth, adminAuth, productController.adminGetAllProducts);
router.get('/:id', productController.getProductById);

// Seed Route to populate all 30 products if needed
router.post('/seed-all', productController.seedAllProductsManual);

// Admin Mutating Routes
router.post('/', auth, adminAuth, productController.createProduct);
router.put('/:id', auth, adminAuth, productController.updateProduct);
router.delete('/:id', auth, adminAuth, productController.deleteProduct);

module.exports = router;