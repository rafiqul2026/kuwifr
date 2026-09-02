// server/src/routes/package.routes.js
const express = require('express');
const router = express.Router();
const packageController = require('../controllers/package.controller');
const { auth } = require('../middleware/auth');

// Public catalog routes
router.get('/', packageController.getAllPackages);
router.get('/all', packageController.getAllPackages);
router.get('/:id', packageController.getPackageById);

// Authenticated activation route
router.post('/purchase', auth, packageController.purchasePackage);

module.exports = router;