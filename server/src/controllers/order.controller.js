// server/src/controllers/order.controller.js
const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const Package = require('../models/Package');
const PackagePurchase = require('../models/PackagePurchase');
const IncomeService = require('../services/income.service');

const seedOrdersIfEmpty = async () => {
  // Never fabricate a placeholder order (fake customer "Rahul Sharma", fake
  // tracking number/courier) on a real deployment — demo data stays opt-in
  // to non-production environments only.
  if (process.env.NODE_ENV === 'production') return;
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
          subtotal: 1500,
          totalKBP: 1000,
          kbpGenerated: 1000,
          paymentMethod: 'UPI',
          paymentType: 'ONLINE_GATEWAY',
          paymentStatus: 'COMPLETED',
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
            { status: 'COMPLETED', timestamp: new Date(Date.now() - 48 * 3600000), note: 'Payment confirmed via UPI' },
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
    const { packageName, search, sponsorId, startDate, endDate, page = 1, limit = 20 } = req.query;

    // "Is this a package order" — orderType was, until now, never actually
    // persisted: Order.js's schema never declared the field, so Mongoose's
    // default strict mode silently stripped `orderType: 'PACKAGE'` on every
    // single write (admin.controller.js, order.controller.js,
    // package.controller.js, packagePurchase.controller.js all set it; none
    // of it was ever saved). A hard `{ orderType: 'PACKAGE' }` filter
    // therefore matched literally zero documents — EVERY member's package
    // sales history, including real, completed purchases, showed "No
    // package sales records found." The schema now declares the field (see
    // Order.js), so it persists correctly going forward, but every order
    // created before that fix still has no orderType stored at all. Falling
    // back to `packageId` (a real, always-populated required field on every
    // package order, completely unaffected by the strict-mode bug) makes
    // this correct for that entire backlog of pre-existing orders too, with
    // no migration needed.
    const PACKAGE_ORDER_MATCH = { $or: [{ orderType: 'PACKAGE' }, { packageId: { $exists: true, $ne: null } }] };
    const andConditions = [PACKAGE_ORDER_MATCH];

    if (packageName && packageName !== 'ALL') {
      andConditions.push({ packageName: { $regex: new RegExp(packageName, 'i') } });
    }

    // Date range filter (Admin panel spec: "filter date wise, weekly wise,
    // monthly wise, year wise, custom date") — the caller/UI turns any of
    // those presets into a concrete startDate/endDate before it gets here.
    if (startDate || endDate) {
      const createdAt = {};
      if (startDate) createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        createdAt.$lte = end;
      }
      andConditions.push({ createdAt });
    }

    // "Search By Sponsor ID (how many member buy package under xyz sponsor
    // ID)" — resolve the sponsor by memberId, then restrict to orders placed
    // by that sponsor's DIRECT sponsees. Applied ON TOP OF (not instead of)
    // the free-text `search`, so an admin can combine both.
    if (sponsorId && sponsorId.trim()) {
      const sponsor = await User.findOne({
        memberId: { $regex: new RegExp(`^${sponsorId.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      }).select('_id');

      if (!sponsor) {
        // A sponsor ID that resolves to nobody should return zero rows, not
        // silently ignore the filter and show every sale.
        andConditions.push({ _id: null });
      } else {
        const sponsees = await User.find({ sponsorId: sponsor._id }).select('_id');
        andConditions.push({ userId: { $in: sponsees.map((u) => u._id) } });
      }
    }

    // NOTE: this is a second, independent $or (member/order text search),
    // separate from PACKAGE_ORDER_MATCH's $or above. Putting both directly
    // on `query` would mean the second `query.$or = [...]` assignment
    // silently overwrites the first — so every condition is instead pushed
    // into `andConditions` and combined with `$and`, which lets a query
    // object hold any number of independent $or clauses safely.
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

      andConditions.push({
        $or: [
          { orderNumber: { $regex: cleanSearch, $options: 'i' } },
          { customerName: { $regex: cleanSearch, $options: 'i' } },
          { customerEmail: { $regex: cleanSearch, $options: 'i' } },
          { userId: { $in: userIds } }
        ]
      });
    }

    const query = { $and: andConditions };

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
        { $match: PACKAGE_ORDER_MATCH },
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
      return res.status(400).json({ success: false, message: 'Member ID/Email, package selection, and cash amount are required.' });
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
      return res.status(404).json({ success: false, message: 'Member not found matching the provided identifier.' });
    }

    // Same missing guard as admin.controller.js's activateMemberWithPackage:
    // without this, calling this endpoint twice for an already-ACTIVE
    // member creates a second Order and re-runs processOrderIncome, so the
    // sponsor's referral/matching income gets credited a second time for
    // one real-world activation.
    if (member.status === 'ACTIVE' && member.activePackageId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `${member.memberId} is already ACTIVE with a package. Re-activating would double-credit referral and matching income — this has been blocked.`
      });
    }

    const pkg = await Package.findById(packageId).session(session);
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Selected package not found in master catalog.' });
    }

    const authoritativePrice = pkg.price || pkg.packagePrice || 1500;
    const authoritativeKbp = pkg.kbpValue || pkg.kbp || 1000;

    if (Number(cashAmount) !== Number(authoritativePrice)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cash amount (₹${cashAmount}) must exactly match package price (₹${authoritativePrice}).` 
      });
    }

    // 1. Update Member State
    member.status = 'ACTIVE';
    member.activePackageId = pkg._id;
    member.activationDate = new Date();
    await member.save({ session });

    // 2. Create PackagePurchase record matching exact schema requirements
    const uniqueTxId = receiptNumber && receiptNumber.trim() !== '' 
      ? receiptNumber.trim() 
      : `CASH-TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    await PackagePurchase.create([{
      user: member._id,
      memberId: member.memberId,
      memberName: member.fullName,
      packageId: pkg._id.toString(),
      packageName: pkg.name,
      packagePrice: authoritativePrice,
      kbpPoints: authoritativeKbp,
      dailyBinaryCap: pkg.dailyCap || 0,
      paymentMethod: 'CASH',
      transactionId: uniqueTxId,
      paymentStatus: 'COMPLETED',
      activationDate: new Date()
    }], { session });

    // 3. Create corresponding Order record using schema-compliant enum values ('ONLINE_GATEWAY' / 'COMPLETED')
    const orderNumber = `INV-CASH-${Date.now().toString().slice(-8)}`;
    const newOrder = await Order.create([{
      userId: member._id,
      orderNumber,
      orderType: 'PACKAGE',
      packageType: 'PACKAGE',
      packageId: pkg._id,
      packageName: pkg.name,
      customerName: member.fullName,
      customerEmail: member.email,
      customerPhone: member.phoneNumber,
      totalAmount: authoritativePrice,
      subtotal: authoritativePrice,
      totalKBP: authoritativeKbp,
      kbpGenerated: authoritativeKbp,
      paymentMethod: 'CASH',
      paymentType: 'ONLINE_GATEWAY',
      paymentStatus: 'COMPLETED',
      orderStatus: 'DELIVERED',
      status: 'COMPLETED',
      products: [{
        name: pkg.name,
        quantity: 1,
        price: authoritativePrice,
        kbp: authoritativeKbp
      }],
      statusHistory: [{ status: 'COMPLETED', timestamp: new Date(), note: `Cash payment verified by Admin. Notes: ${notes || 'None'}` }]
    }], { session });

    // 4. Trigger authoritative KBP Income Distribution (Direct 10% & Matching 10%)
    await IncomeService.processOrderIncome(newOrder[0]);

    await session.commitTransaction();
    session.endSession();

    return res.json({
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
    console.error('❌ Cash Package Activation Error:', error);

    const errMsg = error.code === 11000 
      ? 'Duplicate transaction or receipt number detected. Please use a unique reference number.' 
      : (error.message || 'Package activation failed.');

    return res.status(400).json({ success: false, message: errMsg });
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
      packageType: orderType || 'REPURCHASE',
      packageId,
      packageName,
      selectedProduct,
      customerName,
      customerEmail,
      customerPhone,
      items: items || [],
      products: products || items || [],
      totalAmount: totalAmount || 0,
      subtotal: totalAmount || 0,
      totalKBP: totalKBP || 0,
      kbpGenerated: totalKBP || 0,
      paymentMethod: paymentMethod || 'ONLINE_GATEWAY',
      paymentType: 'ONLINE_GATEWAY',
      paymentStatus: 'COMPLETED',
      orderStatus: 'PROCESSING',
      status: 'COMPLETED',
      statusHistory: [
        { status: 'COMPLETED', timestamp: new Date(), note: 'Order created and paid successfully' }
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