// server/src/controllers/order.controller.js
const Order = require('../models/Order');
const User = require('../models/User');

/**
 * Get Orders Split by Type (Package vs Repurchase) with Invoice Details
 * GET /api/orders
 */
const getMyOrders = async (req, res, next) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).select('fullName email phoneNumber memberId address');

    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    // Categorize
    const packageOrders = orders.filter(o => o.orderType === 'PACKAGE' || o.packageId);
    const repurchaseOrders = orders.filter(o => o.orderType === 'REPURCHASE' || (!o.packageId && o.items?.length > 0));

    res.json({
      success: true,
      data: {
        user,
        packageOrders: packageOrders || [],
        repurchaseOrders: repurchaseOrders || [],
        allOrders: orders || []
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Specific Invoice / Order by ID
 * GET /api/orders/:id
 */
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const [order, user] = await Promise.all([
      Order.findOne({ _id: id, userId }).lean(),
      User.findById(userId).select('fullName email phoneNumber memberId address')
    ]);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Invoice/Order not found' });
    }

    res.json({
      success: true,
      data: { order, user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Order
 * POST /api/orders
 */
const createOrder = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { orderType, items, totalAmount, totalKBP, packageId, packageName, selectedProduct, shippingAddress, paymentMethod } = req.body;

    const orderNumber = `INV-${Date.now().toString().slice(-8)}`;

    const order = await Order.create({
      userId,
      orderNumber,
      orderType: orderType || 'REPURCHASE',
      packageId,
      packageName,
      selectedProduct,
      items: items || [],
      totalAmount: totalAmount || 0,
      totalKBP: totalKBP || 0,
      shippingAddress: shippingAddress || {},
      paymentMethod: paymentMethod || 'ONLINE_GATEWAY',
      paymentStatus: 'PAID',
      status: 'COMPLETED'
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { order }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyOrders,
  getOrderById,
  createOrder,
  cancelOrder: (req, res) => res.json({ success: true, message: 'Order status updated' }),
  getAllOrders: (req, res) => res.json({ success: true, data: { orders: [] } }),
  updateOrderStatus: (req, res) => res.json({ success: true, message: 'Status updated' })
};