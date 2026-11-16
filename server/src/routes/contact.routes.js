const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { auth, adminAuth } = require('../middleware/auth');
const {
  sendContactMessage,
  listContactMessages,
  updateContactMessage,
  deleteContactMessage
} = require('../controllers/contact.controller');

// A real visitor sends one or two messages; this stops form spam floods.
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'You have sent several messages recently. Please wait a while, or email support@kuwifr.com directly.'
  }
});

router.post('/', contactLimiter, sendContactMessage);

router.get('/admin', auth, adminAuth, listContactMessages);
router.patch('/admin/:id', auth, adminAuth, updateContactMessage);
router.delete('/admin/:id', auth, adminAuth, deleteContactMessage);

module.exports = router;
