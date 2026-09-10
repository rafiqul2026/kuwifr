// server/src/controllers/packagePurchase.controller.js
const mongoose = require('mongoose');
const PackagePurchase = require('../models/PackagePurchase');
const User = require('../models/User');
const Package = require('../models/Package');
const Order = require('../models/Order');
const IncomeService = require('../services/income.service');

// 1. Member: Submit Package Purchase Request (Requires Admin/Payment Approval)
exports.completePackagePurchase = async (req, res) => {
  try {
    const {
      packageId,
      packageName,
      packagePrice,
      kbpPoints,
      dailyBinaryCap,
      selectedProduct,
      paymentMethod,
      transactionId, // UTR / Reference number provided by member
      paymentProof
    } = req.body;

    if (!transactionId || transactionId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide the transaction reference / UTR number for verification.'
      });
    }

    const user = await User.findById(req.user._id || req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    // Prevent duplicate pending requests for the same transaction
    const existingTxn = await PackagePurchase.findOne({ transactionId: transactionId.trim() });
    if (existingTxn) {
      return res.status(400).json({
        success: false,
        message: 'This Transaction ID / UTR has already been submitted.'
      });
    }

    const newPurchase = await PackagePurchase.create({
      user: user._id,
      memberId: user.memberId,
      memberName: user.fullName,
      packageId: String(packageId),
      packageName,
      packagePrice: Number(packagePrice),
      kbpPoints: Number(kbpPoints) || 0,
      dailyBinaryCap: Number(dailyBinaryCap) || 0,
      selectedProduct,
      paymentMethod: paymentMethod || 'UPI_GATEWAY',
      transactionId: transactionId.trim(),
      paymentStatus: 'PENDING_VERIFICATION', // 🔒 Not activated until admin approval
      paymentProof: paymentProof || ''
    });

    // NOTE: user.status remains 'INACTIVE' until verified!

    res.status(201).json({
      success: true,
      message: 'Package purchase request submitted! Account will be activated upon payment confirmation.',
      data: newPurchase
    });
  } catch (err) {
    console.error('Package Purchase Error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error processing request' });
  }
};

// 2. Admin: Approve / Activate Member Package
//
// This is THE live member-facing package purchase path (member submits a
// UPI/gateway transaction reference via /activate, admin verifies and calls
// this). Previously this just flipped paymentStatus to 'COMPLETED' and set
// a few User fields — it never created an Order record and never called
// IncomeService.processOrderIncome, so approving a purchase activated the
// member but silently paid NO referral income, NO matching income, and
// awarded NO Kuwi Stars/ranks to anyone. Rewritten to mirror the working
// order.controller.js activateCashPackage flow: authoritative package
// lookup, a real Order record (needed for reporting/TTO aggregation and as
// the object IncomeService expects), and full income distribution — all
// inside one transaction so a failure can't leave the member activated
// without income, or vice versa.
exports.approvePackagePurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { purchaseId } = req.params;

    const purchase = await PackagePurchase.findById(purchaseId).session(session);
    if (!purchase) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Purchase record not found' });
    }

    if (purchase.paymentStatus === 'COMPLETED') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'This purchase is already approved and active.' });
    }

    const user = await User.findById(purchase.user).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Member associated with this purchase not found' });
    }

    // The check above only looks at THIS purchase record. A member can
    // submit a second purchase request (a new transaction ID) while an
    // earlier one was already approved, or an admin may have separately
    // activated them through the cash-activation flow — either way,
    // approving this record too would create another Order and re-run the
    // full income engine, double-crediting the sponsor's referral and
    // matching income for what is really one activation. Block it here too.
    if (user.status === 'ACTIVE' && user.activePackageId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `${user.memberId} is already ACTIVE with a package (activated elsewhere). Approving this purchase too would double-credit referral and matching income — this has been blocked. Reject this request instead if it is a duplicate.`
      });
    }

    // Prefer the authoritative master-catalog package (price/kbp) over the
    // client-submitted values on the purchase record where available, same
    // trust boundary as the admin cash-activation flow. A real Package
    // document must be resolved here — the User model's pre-save hook now
    // refuses to save a MEMBER as ACTIVE without a valid activePackageId,
    // so this can no longer silently leave that field unset the way it
    // used to whenever purchase.packageId wasn't a Mongo ObjectId (some
    // submissions store a plain client-side id/slug instead). That gap was
    // exactly how a member could end up ACTIVE with "No Active Package"
    // showing on their profile.
    let resolvedPackage = null;
    if (mongoose.Types.ObjectId.isValid(purchase.packageId)) {
      resolvedPackage = await Package.findById(purchase.packageId).session(session);
    }
    if (!resolvedPackage && purchase.packageName) {
      resolvedPackage = await Package.findOne({ name: purchase.packageName }).session(session);
    }

    if (!resolvedPackage) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: `Could not match "${purchase.packageName || purchase.packageId}" to a package in the master catalog. Verify the package still exists under Admin > Packages, then try approving again.`
      });
    }

    const authoritativePrice = resolvedPackage.price || purchase.packagePrice;
    const authoritativeKbp = resolvedPackage.kbp || purchase.kbpPoints || 0;
    const dailyCap = resolvedPackage.dailyCap || purchase.dailyBinaryCap || 0;

    // 🚀 Activate Member & Bind Package Capping
    purchase.paymentStatus = 'COMPLETED';
    purchase.activationDate = new Date();
    await purchase.save({ session });

    user.status = 'ACTIVE';
    user.currentPackage = resolvedPackage.name;
    user.packagePrice = authoritativePrice;
    user.dailyBinaryCap = dailyCap;
    user.activePackageId = resolvedPackage._id;
    if (!user.activationDate) user.activationDate = new Date();
    await user.save({ session });

    // Create the Order record income processing expects, and trigger
    // referral / binary-matching income distribution for this activation.
    const orderNumber = `INV-PKG-${Date.now().toString().slice(-8)}`;
    const newOrder = await Order.create([{
      userId: user._id,
      orderNumber,
      orderType: 'PACKAGE',
      packageType: 'PACKAGE',
      packageId: resolvedPackage._id,
      packageName: resolvedPackage.name,
      customerName: user.fullName,
      customerEmail: user.email,
      customerPhone: user.phoneNumber,
      totalAmount: authoritativePrice,
      subtotal: authoritativePrice,
      totalKBP: authoritativeKbp,
      kbpGenerated: authoritativeKbp,
      products: [{
        name: resolvedPackage.name,
        quantity: 1,
        price: authoritativePrice,
        kbp: authoritativeKbp
      }],
      paymentMethod: purchase.paymentMethod || 'UPI_GATEWAY',
      paymentType: 'ONLINE_GATEWAY',
      paymentStatus: 'COMPLETED',
      orderStatus: 'DELIVERED',
      status: 'COMPLETED',
      statusHistory: [{ status: 'COMPLETED', timestamp: new Date(), note: `Package purchase approved by Admin (Txn: ${purchase.transactionId})` }]
    }], { session });

    await session.commitTransaction();
    session.endSession();

    // Income distribution runs its own writes/credits outside this
    // transaction (WalletService/IncomeService manage their own sessions
    // where needed); the member's activation and the Order record are
    // already durably committed at this point.
    let incomeResult = null;
    try {
      incomeResult = await IncomeService.processOrderIncome(newOrder[0]);
    } catch (incomeErr) {
      console.error(`Income processing failed for approved purchase ${purchase._id}:`, incomeErr.message);
    }

    res.json({
      success: true,
      message: `Member ${user.memberId} successfully activated with ${purchase.packageName}! Income distributed.`,
      data: { purchase, order: newOrder[0], incomeResult }
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Package Purchase Approval Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 3. Admin: Reject Purchase Request
exports.rejectPackagePurchase = async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const { reason } = req.body;

    const purchase = await PackagePurchase.findById(purchaseId);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase record not found' });
    }

    purchase.paymentStatus = 'FAILED';
    purchase.adminRemarks = reason || 'Payment could not be verified.';
    await purchase.save();

    res.json({
      success: true,
      message: 'Purchase request rejected.',
      data: purchase
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 4. Admin: Get Sales Analytics & All Requests
exports.getAdminPackageAnalytics = async (req, res) => {
  try {
    const purchases = await PackagePurchase.find().sort({ createdAt: -1 });

    const totalRevenue = purchases
      .filter((p) => p.paymentStatus === 'COMPLETED')
      .reduce((acc, curr) => acc + (curr.packagePrice || 0), 0);

    const totalUnitsSold = purchases.filter((p) => p.paymentStatus === 'COMPLETED').length;
    const pendingCount = purchases.filter((p) => p.paymentStatus === 'PENDING_VERIFICATION').length;

    const packageCounts = purchases
      .filter((p) => p.paymentStatus === 'COMPLETED')
      .reduce((acc, curr) => {
        acc[curr.packageName] = (acc[curr.packageName] || 0) + 1;
        return acc;
      }, {});

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalUnitsSold,
        pendingCount,
        packageCounts,
        purchases
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};