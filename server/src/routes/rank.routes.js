// server/src/routes/rank.routes.js
const express = require('express');
const router = express.Router();
const {
  getCurrentRank,
  getUserRanks,
  getRankProgression,
  getKuwiStars,
  getAllRanks,
  getUserRankById
} = require('../controllers/rank.controller');

// Support both export shapes for the auth middleware
const authModule = require('../middleware/auth');
const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);
const optionalAuth = authModule.optionalAuth || ((req, res, next) => next());

// ============ PUBLIC (Optional Auth) ============
router.get('/user/:userId', optionalAuth, getUserRankById);
router.get('/all', getAllRanks);

// ============ AUTHENTICATED ============
router.use(auth);

// Get current user's rank
router.get('/current', getCurrentRank);

// Get all ranks achieved by user
router.get('/my-ranks', getUserRanks);

// Get rank progression
router.get('/progression', getRankProgression);

// Get Kuwi stars history
router.get('/stars', getKuwiStars);

module.exports = router;