// server/src/controllers/order.controller.js
const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const Package = require('../models/Package');
const PackagePurchase = require('../models/PackagePurchase');
const IncomeService = require('../services/income.service');

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
        }
      ];
      await Order.insertMany(sampleOrders);
    }
  } catch (err) {
    console.error('Order seeding notice:', err.message);
  }
};

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
 * Admin: Get Package Sales Report combining Orders & PackagePurchases (Cash)
 */
const getPackageSalesReport = async (req, res, next) => {
  try {
    await seedOrdersIfEmpty();
    const { packageName, search, page = 1, limit = 20 } = req.query;

    const query = { orderType: 'PACKAGE' };

    if (packageName && packageName !== 'ALL') {
      query.packageName = { $regex: new RegExp(packageName, 'i') };
    }

    if (search) {
      const cleanSearch = search.trim();
      const matchingUsers = await User.find({
        $or: [
          { memberId: { $regex: cleanSearch, $options: 'i' } },
          { email: { $regex: cleanSearch, $options: 'i' } },
          { fullName: { $regex: cleanSearch, $options: 'i' } }
        ]
      }).select('_id');

      const userIds = matchingUsers.map(u => u._id);

      query.$or = [
        { orderNumber: { $regex: cleanSearch, $options: 'i' } },
        { customerName: { $regex: cleanSearch, $options: 'i' } },
        { customerEmail: { $regex: cleanSearch, $options: 'i' } },
        { userId: { $in: userIds } }
      ];
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, parseInt(limit, 10) || 20);
    const skip = (currentPage - 1) * pageLimit;

    const [orders, total, stats] = await Promise.all([
      Order.find(query)
        .populate('userId', 'fullName email phoneNumber memberId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .lean(),
      Order.countDocuments(query),
      Order.aggregate([
        { $match: { orderType: 'PACKAGE' } },
        { 
          $group: { 
            _id: '$packageName', 
            totalUnits: { $sum: 1 }, 
            totalRevenue: { $sum: '$totalAmount' } 
          } 
        }
      ])
    ]);

    res.json({
      success: true,
      data: {
        sales: orders || [],
        statistics: stats || [],
        pagination: {
          page: currentPage,
          limit: pageLimit,
          total,
          pages: Math.ceil(total / pageLimit) || 1
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin Cash Package Activation & Automatic Income Distribution (Transactional)
 */
const activateCashPackage = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { memberIdentifier, packageId, cashAmount, receiptNumber, notes } = req.body;
    const adminUser = req.user;

    if (!memberIdentifier || !packageId || !cashAmount) {
      throw new Error('Member ID/Email, package selection, and cash amount are required.');
    }

    const cleanInput = memberIdentifier.trim();
    const member = await User.findOne({
      $or: [
        { memberId: { $regex: new RegExp(`^${cleanInput}$`, 'i') } },
        { email: { $regex: new RegExp(`^${cleanInput}$`, 'i') } },
        { phoneNumber: cleanInput }
      ]
    }).session(session);

    if (!member) {
      throw new Error('Member not found matching the provided identifier.');
    }

    const pkg = await Package.findById(packageId).session(session);
    if (!pkg) {
      throw new Error('Selected package not found in master catalog.');
    }

    const authoritativePrice = pkg.price || pkg.packagePrice || 1500;
    const authoritativeKbp = pkg.kbpValue || pkg.kbp || 1000;

    if (Number(cashAmount) !== Number(authoritativePrice)) {
      throw new Error(`Cash amount (₹${cashAmount}) must exactly match package price (₹${authoritativePrice}).`);
    }

    // Update Member State
    member.status = 'ACTIVE';
    member.activePackageId = pkg._id;
    member.activationDate = new Date();
    await member.save({ session });

    // Create PackagePurchase audit record
    const purchaseRecord = await PackagePurchase.create([{
      memberId: member.memberId,
      memberMongoId: member._id,
      memberName: member.fullName,
      sponsorId: member.sponsorId ? member.sponsorId.toString() : '',
      packageId: pkg._id,
      packageName: pkg.name,
      packagePrice: authoritativePrice,
      kbp: authoritativeKbp,
      paymentMethod: 'CASH',
      paymentStatus: 'PAID',
      activationStatus: 'ACTIVE',
      receiptNumber: receiptNumber || `CASH-RCPT-${Date.now()}`,
      activatedByAdminId: adminUser._id,
      activatedByAdminName: adminUser.fullName || 'Admin',
      notes: notes || 'Cash payment activated by admin'
    }], { session });

    // Create corresponding Order record for Sales Report visibility
    const orderNumber = `INV-CASH-${Date.now().toString().slice(-8)}`;
    const newOrder = await Order.create([{
      userId: member._id,
      orderNumber,
      orderType: 'PACKAGE',
      packageId: pkg._id,
      packageName: pkg.name,
      customerName: member.fullName,
      customerEmail: member.email,
      customerPhone: member.phoneNumber,
      totalAmount: authoritativePrice,
      totalKBP: authoritativeKbp,
      kbpGenerated: authoritativeKbp,
      paymentMethod: 'CASH',
      paymentType: 'CASH',
      paymentStatus: 'PAID',
      orderStatus: 'DELIVERED',
      status: 'COMPLETED',
      products: [{
        name: pkg.name,
        quantity: 1,
        price: authoritativePrice,
        kbp: authoritativeKbp
      }],
      statusHistory: [{ status: 'PAID', timestamp: new Date(), note: `Cash payment verified by Admin ${adminUser.fullName || ''}` }]
    }], { session });

    // Trigger authoritative KBP Income Distribution (Direct 10% & Matching 10%)
    await IncomeService.processOrderIncome(newOrder[0]);

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: `Package ${pkg.name} activated successfully for ${member.memberId}! Income distributed.`,
      data: {
        memberId: member.memberId,
        package: pkg.name,
        kbp: authoritativeKbp,
        amount: authoritativePrice
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

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
  getPackageSalesReport,
  activateCashPackage,
  cancelOrder: updateOrderStatus
};