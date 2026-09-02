// server/src/routes/product.routes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');

// Safe authentication middleware import
const authModule = require('../middleware/auth');
const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);

// ============ PUBLIC ROUTES ============
router.get('/', productController.getAllProducts);
router.get('/categories', productController.getCategories);
router.get('/featured', productController.getFeaturedProducts);
router.get('/:id', productController.getProductById);

// ============ ADMIN / PROTECTED ROUTES ============
if (auth) {
  router.use(auth);
}

router.post('/', productController.createProduct);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

module.exports = router;