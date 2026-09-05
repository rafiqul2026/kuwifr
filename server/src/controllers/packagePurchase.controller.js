// server/src/controllers/packagePurchase.controller.js
const PackagePurchase = require('../models/PackagePurchase');
const User = require('../models/User');

// Member: Confirm & Complete Purchase
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
      transactionId
    } = req.body;

    const user = await User.findById(req.user._id || req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Member not found' });
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
      transactionId: transactionId || `TXN_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      paymentStatus: 'COMPLETED',
      activationDate: new Date()
    });

    // Update user status and active package plan
    user.status = 'ACTIVE';
    user.currentPackage = packageName;
    user.packagePrice = Number(packagePrice);
    user.dailyBinaryCap = Number(dailyBinaryCap);
    await user.save();

    res.status(201).json({
      success: true,
      message: `Account activated successfully with ${packageName}!`,
      data: newPurchase
    });
  } catch (err) {
    console.error('Package Purchase Error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error processing package activation' });
  }
};

// Admin: Get Sales Stats, Counts & Purchases History
exports.getAdminPackageAnalytics = async (req, res) => {
  try {
    const purchases = await PackagePurchase.find().sort({ createdAt: -1 });

    const totalRevenue = purchases.reduce((acc, curr) => acc + (curr.packagePrice || 0), 0);
    const totalUnitsSold = purchases.length;

    const packageCounts = purchases.reduce((acc, curr) => {
      acc[curr.packageName] = (acc[curr.packageName] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalUnitsSold,
        packageCounts,
        purchases
      }
    });
  } catch (err) {
    console.error('Analytics Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};