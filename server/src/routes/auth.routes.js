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
  changePasswordWithOTP,
  changePasswordDirect
} = require('../controllers/auth.controller');
const { auth } = require('../middleware/auth');

// ============ PUBLIC AUTH ROUTES ============
router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', refreshToken);
// Paths match ForgotPasswordPage.jsx's actual calls
// (/api/auth/forgot-password/send-otp, /api/auth/forgot-password/reset) —
// previously registered as bare /forgot-password and /reset-password, so
// every real "forgot password" attempt 404'd and no logged-out member
// could ever recover their account. Old paths kept as aliases below in
// case anything external still points at them.
router.post('/forgot-password/send-otp', sendForgotPasswordOTP);
router.post('/forgot-password/reset', resetPasswordWithOTP);
router.post('/forgot-password', sendForgotPasswordOTP);
router.post('/reset-password', resetPasswordWithOTP);

// ============ PROTECTED AUTH ROUTES ============
router.get('/me', auth, getCurrentUser);
router.post('/logout', auth, logout);
router.post('/change-password/send-otp', auth, sendChangePasswordOTP);
router.post('/change-password/verify', auth, changePasswordWithOTP);
// Member Profile page's real "Change Password" form — current password +
// new password, no OTP. See auth.controller.js#changePasswordDirect.
router.post('/change-password', auth, changePasswordDirect);

module.exports = router;