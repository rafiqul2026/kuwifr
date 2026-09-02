// server/src/routes/fund.routes.js
const express = require('express');
const router = express.Router();
const fundController = require('../controllers/fund.controller');

// Support both named and default exports for auth middleware
const authModule = require('../middleware/auth');
const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);

// Protected routes
router.use(auth);

router.get('/status', fundController.getFundStatus);
router.get('/all', fundController.getAllFunds);
router.post('/process-qualification', fundController.processFundQualification);
router.get('/benefits', fundController.getFundBenefits);
router.post('/calculate-tto', fundController.calculateTTO);
router.get('/tto-history', fundController.getTTORecords);
router.get('/current-tto', fundController.getCurrentTTO);

module.exports = router;