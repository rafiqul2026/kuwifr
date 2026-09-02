// server/src/routes/payment.routes.js
const express = require('express');
const router = express.Router();

const authModule = require('../middleware/auth');
const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);

router.use(auth);

// Fixes 404 on /api/payment/create-order
router.post('/create-order', async (req, res, next) => {
  try {
    const { amount, productName, packageId } = req.body;
    
    // Generates simulated order for gateway
    return res.json({
      success: true,
      data: {
        orderId: `ORDER_${Date.now()}`,
        amount: Number(amount) * 100,
        currency: 'INR',
        keyId: process.env.PAYMENT_KEY_ID || 'test_key',
        redirectUrl: '/member/orders'
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;