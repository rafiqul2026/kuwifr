// server/src/routes/newsletter.routes.js
const express = require('express');
const router = express.Router();
const { subscribe } = require('../controllers/newsletter.controller');

router.post('/subscribe', subscribe);

module.exports = router;
