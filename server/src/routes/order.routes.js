// server/src/routes/order.routes.js
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const authModule = require('../middleware/auth');

const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);
const adminAuth =
  authModule.adminAuth ||
  ((req, res, next) => {
    const role = (req.user?.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return next();
    return res.status(403).json({ success: false, message: 'Administrator access required' });
  });

// Member Routes
router.get('/my-orders', auth, orderController.getMyOrders);
router.get('/user', auth, orderController.getMyOrders);
router.post('/', auth, orderController.createOrder);

// Admin Routes (Directly callable via /api/orders and /api/admin/orders)
router.get('/', auth, adminAuth, orderController.getAllOrders);
router.get('/admin', auth, adminAuth, orderController.getAllOrders);
router.get('/admin/all', auth, adminAuth, orderController.getAllOrders);
router.put('/:id/status', auth, adminAuth, orderController.updateOrderStatus);

// Detail lookup
router.get('/:id', auth, orderController.getOrderById);

module.exports = router;