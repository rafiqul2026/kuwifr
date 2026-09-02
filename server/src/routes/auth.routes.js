// server/src/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const {
  register,
  login,
  logout,
  getCurrentUser,
  refreshToken,
  sendForgotPasswordOTP,
  resetPasswordWithOTP,
  sendChangePasswordOTP,
  changePasswordWithOTP
} = require('../controllers/auth.controller');
const { auth } = require('../middleware/auth');

// ============ PUBLIC AUTH ROUTES ============
router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', sendForgotPasswordOTP);
router.post('/reset-password', resetPasswordWithOTP);

// ============ PROTECTED AUTH ROUTES ============
router.get('/me', auth, getCurrentUser);
router.post('/logout', auth, logout);
router.post('/change-password/send-otp', auth, sendChangePasswordOTP);
router.post('/change-password/verify', auth, changePasswordWithOTP);

module.exports = router;