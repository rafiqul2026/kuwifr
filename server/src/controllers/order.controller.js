// server/src/controllers/order.controller.js
const Order = require('../models/Order');
const User = require('../models/User');

const seedOrdersIfEmpty = async () => {
  try {
    const count = await Order.countDocuments();
    if (count === 0) {
      const sampleOrders = [
        {
          orderNumber: 'INV-10024891',
          customerName: 'Rahul Sharma',
          customerEmail: 'rahul.sharma@example.com',
          customerPhone: '+91 98765 43210',
          packageName: 'Starter Package',
          orderType: 'PACKAGE',
          totalAmount: 1500,
          totalKBP: 1000,
          kbpGenerated: 1000,
          paymentMethod: 'UPI',
          paymentType: 'ONLINE_GATEWAY',
          paymentStatus: 'PAID',
          orderStatus: 'DELIVERED',
          status: 'COMPLETED',
          trackingNumber: 'DEL-IN-88921',
          courierPartner: 'Delhivery Express',
          deliveryAddress: {
            addressLine1: 'GS Road, Christian Basti',
            city: 'Guwahati',
            state: 'Assam',
            pincode: '781005'
          },
          products: [
            {
              name: 'Instant Magic Hair Colour Shampoo (500ml)',
              quantity: 1,
              price: 1500,
              kbp: 1000
            }
          ],
          statusHistory: [
            { status: 'PAID', timestamp: new Date(Date.now() - 48 * 3600000), note: 'Payment confirmed via UPI' },
            { status: 'SHIPPED', timestamp: new Date(Date.now() - 24 * 3600000), note: 'Dispatched via Delhivery Express' },
            { status: 'DELIVERED', timestamp: new Date(), note: 'Delivered to customer' }
          ],
          createdAt: new Date(Date.now() - 48 * 3600000)
        },
        {
          orderNumber: 'INV-10024892',
          customerName: 'Priya Das',
          customerEmail: 'priya.das@example.com',
          customerPhone: '+91 91234 56789',
          packageName: 'Growth Package',
          orderType: 'PACKAGE',
          totalAmount: 5000,
          totalKBP: 4000,
          kbpGenerated: 4000,
          paymentMethod: 'Razorpay',
          paymentType: 'ONLINE_GATEWAY',
          paymentStatus: 'PAID',
          orderStatus: 'SHIPPED',
          status: 'COMPLETED',
          trackingNumber: 'BD-AIR-55412',
          courierPartner: 'BlueDart Air',
          deliveryAddress: {
            addressLine1: 'Zoo Road Tiniali',
            city: 'Guwahati',
            state: 'Assam',
            pincode: '781024'
          },
          products: [
            {
              name: 'Kuwi Shilajit 99 (Pure Himalayan Resin 30g)',
              quantity: 1,
              price: 5000,
              kbp: 4000
            }
          ],
          statusHistory: [
            { status: 'PAID', timestamp: new Date(Date.now() - 12 * 3600000), note: 'Payment verified' },
            { status: 'SHIPPED', timestamp: new Date(), note: 'In transit via BlueDart' }
          ],
          createdAt: new Date(Date.now() - 12 * 3600000)
        },
        {
          orderNumber: 'INV-10024893',
          customerName: 'Amit Baruah',
          customerEmail: 'amit.b@example.com',
          customerPhone: '+91 94350 11223',
          packageName: 'Life Safe Package',
          orderType: 'PACKAGE',
          totalAmount: 10000,
          totalKBP: 7500,
          kbpGenerated: 7500,
          paymentMethod: 'NetBanking',
          paymentType: 'ONLINE_GATEWAY',
          paymentStatus: 'PAID',
          orderStatus: 'PROCESSING',
          status: 'COMPLETED',
          trackingNumber: '',
          courierPartner: 'DTDC Courier',
          deliveryAddress: {
            addressLine1: 'Paltan Bazaar',
            city: 'Guwahati',
            state: 'Assam',
            pincode: '781008'
          },
          products: [
            {
              name: 'Alkaline Water Ionizer Device (15k Ltr Capacity)',
              quantity: 1,
              price: 10000,
              kbp: 7500
            }
          ],
          statusHistory: [
            { status: 'PAID', timestamp: new Date(), note: 'Order placed, awaiting packaging' }
          ],
          createdAt: new Date()
        }
      ];

      await Order.insertMany(sampleOrders);
    }
  } catch (err) {
    console.error('Order seeding notice:', err.message);
  }
};

/**
 * Get Orders Split by Type (Member Portal)
 * GET /api/orders
 */
const getMyOrders = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const user = await User.findById(userId).select('fullName email phoneNumber memberId address');

    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

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
    let order = await Order.findById(id).populate('userId', 'fullName email phoneNumber memberId').lean();

    if (!order) {
      order = await Order.findOne({ orderNumber: id }).populate('userId', 'fullName email phoneNumber memberId').lean();
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Invoice/Order not found' });
    }

    res.json({
      success: true,
      data: { order }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get All Orders with Status Filter & Safe Pagination
 * GET /api/admin/orders
 */
const getAllOrders = async (req, res, next) => {
  try {
    await seedOrdersIfEmpty();
    const { status, page = 1, limit = 20, search } = req.query;

    const query = {};
    if (status && status !== 'ALL') {
      query.orderStatus = status.toUpperCase();
    }

    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } },
        { trackingNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, parseInt(limit, 10) || 20);
    const skip = (currentPage - 1) * pageLimit;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('userId', 'fullName email phoneNumber memberId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .lean(),
      Order.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / pageLimit) || 1;

    res.json({
      success: true,
      data: {
        orders: orders || [],
        pagination: {
          page: currentPage,
          limit: pageLimit,
          total,
          pages: totalPages
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update Order Status & Courier Tracking
 * PUT /api/admin/orders/:id/status
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, orderStatus, trackingNumber, courierPartner } = req.body;
    const newStatus = (status || orderStatus || '').toUpperCase();

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (newStatus) {
      order.orderStatus = newStatus;
      if (newStatus === 'DELIVERED') order.status = 'COMPLETED';
      if (newStatus === 'CANCELLED') order.status = 'CANCELLED';

      if (!Array.isArray(order.statusHistory)) {
        order.statusHistory = [];
      }
      order.statusHistory.push({
        status: newStatus,
        timestamp: new Date(),
        note: `Status updated to ${newStatus} by Administrator`
      });
    }

    if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;
    if (courierPartner !== undefined) order.courierPartner = courierPartner;

    await order.save();

    res.json({
      success: true,
      message: `Order status updated to ${newStatus || 'updated'} successfully`,
      data: { order }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Order (Checkout flow)
 * POST /api/orders
 */
const createOrder = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const {
      orderType,
      items,
      products,
      totalAmount,
      totalKBP,
      packageId,
      packageName,
      selectedProduct,
      shippingAddress,
      deliveryAddress,
      paymentMethod,
      customerName,
      customerEmail,
      customerPhone
    } = req.body;

    const orderNumber = `INV-${Date.now().toString().slice(-8)}`;

    const order = await Order.create({
      userId,
      orderNumber,
      orderType: orderType || 'REPURCHASE',
      packageId,
      packageName,
      selectedProduct,
      customerName,
      customerEmail,
      customerPhone,
      items: items || [],
      products: products || items || [],
      totalAmount: totalAmount || 0,
      totalKBP: totalKBP || 0,
      kbpGenerated: totalKBP || 0,
      shippingAddress: shippingAddress || deliveryAddress || {},
      deliveryAddress: deliveryAddress || shippingAddress || {},
      paymentMethod: paymentMethod || 'ONLINE_GATEWAY',
      paymentType: paymentMethod || 'ONLINE_GATEWAY',
      paymentStatus: 'PAID',
      orderStatus: 'PROCESSING',
      status: 'COMPLETED',
      statusHistory: [
        { status: 'PAID', timestamp: new Date(), note: 'Order created and paid successfully' }
      ]
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
  getAllOrders,
  updateOrderStatus,
  createOrder,
  cancelOrder: updateOrderStatus
};