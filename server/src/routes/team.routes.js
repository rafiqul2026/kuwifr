// server/src/routes/team.routes.js
const express = require('express');
const router = express.Router();
const teamController = require('../controllers/team.controller');

// Safe auth middleware import matching your application structure
const authModule = require('../middleware/auth');
const protect = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);

// Protect route so only authenticated members/admins can access team branch overviews
if (protect) {
  router.use(protect);
}

// Route to fetch unlimited depth left and right downline members
router.get('/overview', teamController.getTeamOverview);

module.exports = router;