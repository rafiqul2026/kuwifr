// server/src/routes/campaign.routes.js
const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaign.controller');
const authModule = require('../middleware/auth');

const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);
const adminAuth =
  authModule.adminAuth ||
  ((req, res, next) => {
    const role = (req.user?.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return next();
    return res.status(403).json({ success: false, message: 'Administrator credentials required' });
  });

// ============ PUBLIC & MEMBER ENDPOINTS ============
router.get('/', campaignController.getAllCampaigns);
router.get('/all', campaignController.getAllCampaigns);

// ============ ADMIN MANAGEMENT ENDPOINTS ============
router.post('/initialize', auth, adminAuth, campaignController.initializeCampaigns);
router.post('/', auth, adminAuth, campaignController.createCampaign);
router.put('/:id', auth, adminAuth, campaignController.updateCampaign);
router.put('/:id/status', auth, adminAuth, campaignController.updateCampaignStatus);
router.delete('/:id', auth, adminAuth, campaignController.deleteCampaign);

module.exports = router;