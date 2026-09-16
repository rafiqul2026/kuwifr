// server/src/controllers/repurchase.controller.js
const mongoose = require('mongoose');
const RepurchaseService = require('../services/repurchase.service');
const FundService = require('../services/fund.service');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const RepurchasePurchase = require('../models/RepurchasePurchase');

// Complete 30 Products Catalog with MRP, KSP, and KBP
const REPURCHASE_PRODUCTS = [
  { id: 'kfr-p01', name: 'Instant Magic Hair Color Shampoo', mrp: 1999, ksp: 1500, kbp: 1000, category: 'Hair Care' },
  { id: 'kfr-p02', name: 'Kuwi Gold Magic Black Hair oil', mrp: 2100, ksp: 1500, kbp: 1000, category: 'Hair Care' },
  { id: 'kfr-p03', name: 'Modern Saree (Ready Made Wear)', mrp: 2499, ksp: 1500, kbp: 1000, category: 'Apparel' },
  { id: 'kfr-p04', name: 'Kuwi Pro+ Protein Powder (500gm)', mrp: 3130, ksp: 1500, kbp: 1000, category: 'Health & Nutrition' },
  { id: 'kfr-p05', name: 'Kuwimul 77 Multi Vitamin', mrp: 1860, ksp: 1500, kbp: 1000, category: 'Health & Nutrition' },
  { id: 'kfr-p06', name: 'Kuwi Living Sea buckthorn', mrp: 1999, ksp: 1500, kbp: 1000, category: 'Health & Nutrition' },
  { id: 'kfr-p07', name: 'Kuwi Shilajit 99', mrp: 5910, ksp: 5000, kbp: 4000, category: 'Wellness' },
  { id: 'kfr-p08', name: 'Kuwi Magic Berries Juice (All Solutions)', mrp: 2100, ksp: 1500, kbp: 1000, category: 'Beverages' },
  { id: 'kfr-p09', name: 'Festival Wear Premium Modern Saree', mrp: 7250, ksp: 5000, kbp: 4000, category: 'Apparel' },
  { id: 'kfr-p10', name: 'Kuwi Pro+ Protein Powder (1KG)', mrp: 5750, ksp: 5000, kbp: 4000, category: 'Health & Nutrition' },
  { id: 'kfr-p11', name: 'Gents Premium Clothes', mrp: 6500, ksp: 5000, kbp: 4000, category: 'Apparel' },
  { id: 'kfr-p12', name: 'Alkaline Jug', mrp: 5450, ksp: 5000, kbp: 4000, category: 'Home & Kitchen' },
  { id: 'kfr-p13', name: 'Alkaline Drop', mrp: 5550, ksp: 5000, kbp: 4000, category: 'Health & Wellness' },
  { id: 'kfr-p14', name: 'Alkaline Water Device (15k Ltr Capacity)', mrp: 13000, ksp: 10000, kbp: 7500, category: 'Appliances' },
  { id: 'kfr-p15', name: 'Alkaline Mobile Water Device', mrp: 13300, ksp: 10000, kbp: 7500, category: 'Appliances' },
  { id: 'kfr-p16', name: 'Alkaline Water Device Premium (30k Ltr Capacity)', mrp: 18000, ksp: 15000, kbp: 10000, category: 'Appliances' },
  { id: 'kfr-p17', name: 'Alkaline Water Device of Copper Jar', mrp: 18500, ksp: 15000, kbp: 10000, category: 'Appliances' },
  { id: 'kfr-p18', name: 'Electric Scooty (Growth Special)', mrp: 120500, ksp: 110000, kbp: 50000, category: 'Automotive / Package' },
  { id: 'kfr-p19', name: 'Kuwi Gold Face Wash', mrp: 299, ksp: 249, kbp: 186, category: 'Personal Care' },
  { id: 'kfr-p20', name: 'Kuwi Glow Soap', mrp: 299, ksp: 249, kbp: 190, category: 'Personal Care' },
  { id: 'kfr-p21', name: 'Kuwi Glow Cream', mrp: 349, ksp: 299, kbp: 220, category: 'Personal Care' },
  { id: 'kfr-p22', name: 'Kuwi Diabetic White Rice (1Kg)', mrp: 225, ksp: 210, kbp: 50, category: 'Grocery' },
  { id: 'kfr-p23', name: 'Electric Burner', mrp: 9350, ksp: 8000, kbp: 2000, category: 'Appliances' },
  { id: 'kfr-p24', name: 'Electric Geyser', mrp: 4500, ksp: 4000, kbp: 1700, category: 'Appliances' },
  { id: 'kfr-p25', name: 'Premium Kurti Set', mrp: 2999, ksp: 2499, kbp: 1000, category: 'Apparel' },
  { id: 'kfr-p26', name: 'Anno Fresh Salt', mrp: 30, ksp: 25, kbp: 12, category: 'Grocery' },
  { id: 'kfr-p27', name: 'Kuwi Mustard Oil', mrp: 210, ksp: 200, kbp: 70, category: 'Grocery' },
  { id: 'kfr-p28', name: 'Kuwi Fresh Kitchen King Masala (250gm)', mrp: 279, ksp: 249, kbp: 70, category: 'Grocery' },
  { id: 'kfr-p29', name: 'Kuwi Body Spray Perfume', mrp: 279, ksp: 210, kbp: 100, category: 'Personal Care' },
  { id: 'kfr-p30', name: 'Kuwi Toothpaste (100gm)', mrp: 249, ksp: 220, kbp: 80, category: 'Oral Care' }
];

/**
 * Get all 30 Repurchase Products
 * GET /api/repurchase/products
 */
const getRepurchaseProducts = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: { products: REPURCHASE_PRODUCTS }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Compute cart totals + normalized item list against the authoritative
 * REPURCHASE_PRODUCTS catalog — shared by submit/approve so the two can
 * never disagree about what a cart is actually worth.
 */
const priceCart = (items) => {
  let totalKSPAmount = 0;
  let totalKBPAmount = 0;
  const purchasedItems = [];

  for (const item of items || []) {
    const prod = REPURCHASE_PRODUCTS.find((p) => p.id === item.productId);
    if (prod) {
      const qty = parseInt(item.quantity, 10) || 1;
      totalKSPAmount += prod.ksp * qty;
      totalKBPAmount += prod.kbp * qty;
      purchasedItems.push({
        productId: prod.id,
        name: prod.name,
        category: prod.category,
        qty,
        ksp: prod.ksp,
        kbp: prod.kbp,
        subtotalKSP: prod.ksp * qty,
        subtotalKBP: prod.kbp * qty
      });
    }
  }

  return { totalKSPAmount, totalKBPAmount, purchasedItems };
};

/**
 * 1. Member: Submit Repurchase Store Checkout (Requires Admin Payment
 * Verification) — same manual-UPI QR / UTR / screenshot pattern as Buy
 * Package (see packagePurchase.controller.js#completePackagePurchase).
 * Previously this store credited Self Cashback + downline overrides
 * INSTANTLY with no payment step at all; now it only records the pending
 * request. Real money (Self Cashback, downline commissions, the Order
 * itself) is only credited once an admin approves via
 * approveRepurchasePurchase below.
 * POST /api/repurchase/submit
 */
const submitRepurchasePurchase = async (req, res, next) => {
  try {
    const { items, paymentMethod, transactionId, paymentProof } = req.body;
    const userId = req.userId;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'Cart cannot be empty' });
    }

    if (!transactionId || !String(transactionId).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide the transaction reference / UTR number for verification.'
      });
    }

    const existingTxn = await RepurchasePurchase.findOne({ transactionId: String(transactionId).trim() });
    if (existingTxn) {
      return res.status(400).json({
        success: false,
        message: 'This Transaction ID / UTR has already been submitted.'
      });
    }

    const { totalKSPAmount, totalKBPAmount, purchasedItems } = priceCart(items);
    if (purchasedItems.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid products found in cart.' });
    }

    const user = await User.findById(userId).select('memberId fullName');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const newPurchase = await RepurchasePurchase.create({
      user: user._id,
      memberId: user.memberId,
      memberName: user.fullName,
      items: purchasedItems,
      totalKSP: totalKSPAmount,
      totalKBP: totalKBPAmount,
      paymentMethod: paymentMethod || 'UPI_GATEWAY',
      transactionId: String(transactionId).trim(),
      paymentStatus: 'PENDING_VERIFICATION',
      paymentProof: paymentProof || ''
    });

    res.status(201).json({
      success: true,
      message: 'Payment submitted! Your order will be processed once payment is verified by admin.',
      data: newPurchase
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Admin: Approve Repurchase Store payment — mirrors
 * packagePurchase.controller.js#approvePackagePurchase: creates the real
 * Order (orderType: 'REPURCHASE') inside a transaction, then — same as the
 * old instant purchaseProducts flow used to do immediately at checkout —
 * runs Self Cashback + 15-level downline distribution and uplinks KBP to
 * the Life Tension Free funds. Idempotent guard: a purchase already
 * COMPLETED can't be approved (and therefore distributed) twice.
 * PATCH /api/repurchase/approve/:purchaseId
 */
const approveRepurchasePurchase = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { purchaseId } = req.params;

    const purchase = await RepurchasePurchase.findById(purchaseId).session(session);
    if (!purchase) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Purchase record not found' });
    }

    if (purchase.paymentStatus === 'COMPLETED') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'This purchase is already approved and processed.' });
    }

    const user = await User.findById(purchase.user).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Member associated with this purchase not found' });
    }

    const SettingsService = require('../services/settings.service');
    const { selfRate } = await SettingsService.getRepurchase();
    const selfCashback = Math.round(purchase.totalKBP * selfRate * 100) / 100;

    purchase.paymentStatus = 'COMPLETED';
    await purchase.save({ session });

    const orderNumber = `INV-REP-${Date.now().toString().slice(-8)}`;
    const newOrder = await Order.create([{
      userId: user._id,
      orderNumber,
      orderType: 'REPURCHASE',
      packageType: 'REPURCHASE',
      packageName: 'Repurchase Order',
      customerName: user.fullName,
      customerEmail: user.email,
      customerPhone: user.phoneNumber,
      totalAmount: purchase.totalKSP,
      subtotal: purchase.totalKSP,
      totalKBP: purchase.totalKBP,
      kbpGenerated: purchase.totalKBP,
      selfCashback,
      products: purchase.items.map((it) => ({
        name: it.name,
        quantity: it.qty,
        price: it.ksp,
        kbp: it.kbp
      })),
      paymentMethod: purchase.paymentMethod || 'UPI_GATEWAY',
      paymentType: 'ONLINE_GATEWAY',
      paymentStatus: 'COMPLETED',
      orderStatus: 'DELIVERED',
      status: 'COMPLETED',
      statusHistory: [{ status: 'COMPLETED', timestamp: new Date(), note: `Repurchase approved by Admin (Txn: ${purchase.transactionId})` }]
    }], { session });

    purchase.orderId = newOrder[0]._id;
    await purchase.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Self Cashback + 15-level downline commissions, and Life Tension Free
    // fund KBP uplink — run outside the Order-creation transaction (these
    // manage their own sessions), same pattern as package-purchase approval
    // running IncomeService.processOrderIncome after commit.
    let distributionResult = null;
    try {
      distributionResult = await RepurchaseService.processRepurchaseDistribution(
        user._id,
        purchase.totalKBP,
        orderNumber
      );
    } catch (distErr) {
      console.error(`Repurchase distribution failed for approved purchase ${purchase._id}:`, distErr.message);
    }

    try {
      if (FundService && typeof FundService.processRepurchaseKBPForFunds === 'function') {
        await FundService.processRepurchaseKBPForFunds(user._id, purchase.totalKBP);
      }
    } catch (fundErr) {
      console.error(`Fund KBP uplink failed for approved purchase ${purchase._id}:`, fundErr.message);
    }

    try {
      await Notification.create({
        userId: user._id,
        type: 'FINANCIAL',
        priority: 'HIGH',
        title: 'Repurchase Order Verified! 🛍️',
        message: `Your payment for ${purchase.items.length} product(s) has been verified. ₹${selfCashback.toLocaleString('en-IN')} (${Math.round(selfRate * 100)}% Self Cashback) has been credited to your Repurchase Wallet.`,
        icon: '✅',
        color: '#16a34a',
        action: '/member/orders',
        actionLabel: 'View Order'
      });
    } catch (notifErr) {
      console.error(`Notification failed for approved repurchase ${purchase._id}:`, notifErr.message);
    }

    res.json({
      success: true,
      message: `Repurchase order for ${user.memberId} approved. ₹${selfCashback.toLocaleString('en-IN')} Self Cashback credited.`,
      data: { purchase, order: newOrder[0], distributionResult }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * 3. Admin: Reject Repurchase Store payment.
 * PATCH /api/repurchase/reject/:purchaseId
 */
const rejectRepurchasePurchase = async (req, res, next) => {
  try {
    const { purchaseId } = req.params;
    const { reason } = req.body;

    const purchase = await RepurchasePurchase.findById(purchaseId);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase record not found' });
    }

    purchase.paymentStatus = 'FAILED';
    purchase.adminRemarks = reason || 'Payment could not be verified.';
    await purchase.save();

    try {
      await Notification.create({
        userId: purchase.user,
        type: 'FINANCIAL',
        priority: 'HIGH',
        title: 'Repurchase payment verification failed',
        message: `Your Repurchase Store payment submission could not be verified. Reason: ${purchase.adminRemarks}. Please resubmit with correct details.`,
        icon: '⚠️',
        color: '#dc2626',
        action: '/member/repurchase',
        actionLabel: 'Resubmit Payment'
      });
    } catch (notifErr) {
      console.error(`Notification failed for rejected repurchase ${purchase._id}:`, notifErr.message);
    }

    res.json({
      success: true,
      message: 'Repurchase payment request rejected.',
      data: purchase
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Admin: Repurchase Store sales analytics & all requests.
 * GET /api/repurchase/admin-analytics
 */
const getAdminRepurchaseAnalytics = async (req, res, next) => {
  try {
    const purchases = await RepurchasePurchase.find().sort({ createdAt: -1 });

    const totalRevenue = purchases
      .filter((p) => p.paymentStatus === 'COMPLETED')
      .reduce((acc, curr) => acc + (curr.totalKSP || 0), 0);

    const totalOrders = purchases.filter((p) => p.paymentStatus === 'COMPLETED').length;
    const pendingCount = purchases.filter((p) => p.paymentStatus === 'PENDING_VERIFICATION').length;

    res.json({
      success: true,
      data: { totalRevenue, totalOrders, pendingCount, purchases }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get 10-Level Downline Repurchase Matrix, Referral Stats & Live Wallets
 * GET /api/repurchase/10-level-stats
 */
const get10LevelRepurchase = async (req, res, next) => {
  try {
    const userId = req.userId;
    const [user, wallet, statsData] = await Promise.all([
      User.findById(userId).select('memberId fullName totalKBP lifetimeIncome directReferrals status').lean(),
      Wallet.findOne({ userId }).lean(),
      RepurchaseService.get10LevelStats(userId)
    ]);

    const SettingsService = require('../services/settings.service');
    const repurchaseCfg = await SettingsService.getRepurchase();

    // Lifetime breakdown counters (see Wallet.js) vs. the current spendable
    // repurchase wallet balance — both are useful on this screen.
    const selfRepurchaseIncome = wallet?.selfRepurchaseIncome || 0;
    const downlineRepurchaseIncome = wallet?.downlineRepurchaseIncome || 0;
    const totalRepurchaseWallet = wallet?.repurchaseBalance || 0;

    res.json({
      success: true,
      data: {
        user,
        directCount: statsData.directCount || 0,
        maxUnlockedLevel: statsData.maxUnlockedLevel || 0,
        levels: statsData.levels || [],
        wallets: {
          totalRepurchaseWallet,
          selfRepurchaseIncome,
          downlineRepurchaseIncome
        },
        selfPercentage: Math.round((repurchaseCfg.selfRate || 0.20) * 100)
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRepurchaseProducts,
  submitRepurchasePurchase,
  approveRepurchasePurchase,
  rejectRepurchasePurchase,
  getAdminRepurchaseAnalytics,
  get10LevelRepurchase
};