// server/src/routes/repurchase.routes.js
const express = require('express');
const router = express.Router();

const {
  getRepurchaseProducts,
  purchaseProducts,
  get10LevelRepurchase
} = require('../controllers/repurchase.controller');

// Import auth middleware (support both named and default exports)
const authModule = require('../middleware/auth');
const auth = typeof authModule === 'function' ? authModule : authModule.auth || authModule.protect;

// Protected Repurchase Routes
router.use(auth);

router.get('/products', getRepurchaseProducts);
router.post('/purchase', purchaseProducts);
router.get('/10-level-stats', get10LevelRepurchase);

module.exports = router;