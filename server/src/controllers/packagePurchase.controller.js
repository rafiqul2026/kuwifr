// server/src/controllers/packagePurchase.controller.js
const PackagePurchase = require('../models/PackagePurchase');
const User = require('../models/User');

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
exports.approvePackagePurchase = async (req, res) => {
  try {
    const { purchaseId } = req.params;

    const purchase = await PackagePurchase.findById(purchaseId);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase record not found' });
    }

    if (purchase.paymentStatus === 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'This purchase is already approved and active.' });
    }

    const user = await User.findById(purchase.user);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Member associated with this purchase not found' });
    }

    // 🚀 Activate Member & Bind Package Capping
    purchase.paymentStatus = 'COMPLETED';
    purchase.activationDate = new Date();
    await purchase.save();

    user.status = 'ACTIVE';
    user.currentPackage = purchase.packageName;
    user.packagePrice = purchase.packagePrice;
    user.dailyBinaryCap = purchase.dailyBinaryCap;
    await user.save();

    res.json({
      success: true,
      message: `Member ${user.memberId} successfully activated with ${purchase.packageName}!`,
      data: purchase
    });
  } catch (err) {
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