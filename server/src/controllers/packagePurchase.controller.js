// server/src/controllers/packagePurchase.controller.js
const mongoose = require('mongoose');
const PackagePurchase = require('../models/PackagePurchase');
const User = require('../models/User');
const Package = require('../models/Package');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
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
      selectedProducts,
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

    // Accept either the current `selectedProducts` array or the legacy
    // singular `selectedProduct` (older client builds) — normalize to both
    // so any code still reading the singular field keeps working.
    const productsArray = Array.isArray(selectedProducts) && selectedProducts.length > 0
      ? selectedProducts
      : (selectedProduct ? [selectedProduct] : []);

    if (productsArray.length === 0 || !productsArray[0]?.name) {
      return res.status(400).json({
        success: false,
        message: 'Please select the product(s) included with this package.'
      });
    }

    // If the admin has assigned an explicit product list to this package
    // (Admin > Packages > Products), the chosen product must be on it.
    if (mongoose.Types.ObjectId.isValid(packageId)) {
      const chosenPkg = await Package.findById(packageId).select('name includedProductIds').lean();
      const productError = require('./package.controller').validateSelectedProducts(chosenPkg, productsArray);
      if (productError) {
        return res.status(400).json({ success: false, message: productError });
      }
    }

    const user = await User.findById(req.user._id || req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    // An already-ACTIVE member must go through the Upgrade Package flow
    // instead of submitting another fresh activation here — the client now
    // hides this option for them, but this guard covers a direct API call
    // bypassing that UI.
    if (user.status === 'ACTIVE' && user.activePackageId) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active package. Please use Upgrade Package to move to a higher tier.'
      });
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
      selectedProduct: productsArray[0],
      selectedProducts: productsArray,
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

// 1b. Member: Submit Package UPGRADE Request (existing ACTIVE members only —
// requires Admin/Payment Approval, same as a fresh purchase). Per business
// rule, an upgrade costs the FULL price of the target package (there is no
// "pay just the difference" discount) and credits 0 KBP — the member only
// gets the higher package's capping ceiling and its product(s); no fresh
// income is generated. The target package must be strictly more expensive
// than what they currently hold.
exports.completePackageUpgrade = async (req, res) => {
  try {
    const { packageId, transactionId, paymentProof, paymentMethod, selectedProduct, selectedProducts } = req.body;

    if (!transactionId || transactionId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide the transaction reference / UTR number for verification.'
      });
    }

    const productsArray = Array.isArray(selectedProducts) && selectedProducts.length > 0
      ? selectedProducts
      : (selectedProduct ? [selectedProduct] : []);

    if (productsArray.length === 0 || !productsArray[0]?.name) {
      return res.status(400).json({
        success: false,
        message: 'Please select the product(s) included with the upgrade package.'
      });
    }

    const user = await User.findById(req.user._id || req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    if (user.status !== 'ACTIVE' || !user.activePackageId) {
      return res.status(400).json({
        success: false,
        message: 'Only active members with an existing package can request an upgrade. Please activate a package first.'
      });
    }

    const currentPkg = await Package.findById(user.activePackageId);
    if (!currentPkg) {
      return res.status(404).json({ success: false, message: 'Your current package could not be resolved. Please contact support.' });
    }

    const targetPkg = await Package.findById(packageId);
    if (!targetPkg) {
      return res.status(404).json({ success: false, message: 'Selected upgrade package not found.' });
    }

    if (targetPkg.price <= currentPkg.price) {
      return res.status(400).json({
        success: false,
        message: 'You can only upgrade to a package priced higher than your current package.'
      });
    }

    const upgradeProductError = require('./package.controller').validateSelectedProducts(targetPkg, productsArray);
    if (upgradeProductError) {
      return res.status(400).json({ success: false, message: upgradeProductError });
    }

    const existingTxn = await PackagePurchase.findOne({ transactionId: transactionId.trim() });
    if (existingTxn) {
      return res.status(400).json({
        success: false,
        message: 'This Transaction ID / UTR has already been submitted.'
      });
    }

    // Amount payable = the target package's full price (not a difference),
    // and KBP is always 0 for an upgrade — no income is generated by it,
    // only the capping ceiling and bundled product(s) change.
    const amountPayable = targetPkg.price;

    const newPurchase = await PackagePurchase.create({
      user: user._id,
      memberId: user.memberId,
      memberName: user.fullName,
      packageId: String(targetPkg._id),
      packageName: targetPkg.name,
      packagePrice: amountPayable,
      targetPackagePrice: targetPkg.price,
      kbpPoints: 0,
      dailyBinaryCap: targetPkg.dailyCap,
      selectedProduct: productsArray[0],
      selectedProducts: productsArray,
      purchaseType: 'UPGRADE',
      previousPackageId: String(currentPkg._id),
      previousPackageName: currentPkg.name,
      previousPackagePrice: currentPkg.price,
      paymentMethod: paymentMethod || 'UPI_GATEWAY',
      transactionId: transactionId.trim(),
      paymentStatus: 'PENDING_VERIFICATION',
      paymentProof: paymentProof || ''
    });

    res.status(201).json({
      success: true,
      message: 'Upgrade request submitted! Your package will be upgraded once payment is verified by admin.',
      data: newPurchase
    });
  } catch (err) {
    console.error('Package Upgrade Error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error processing upgrade request' });
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

    const isUpgrade = purchase.purchaseType === 'UPGRADE';

    // The check above only looks at THIS purchase record. A member can
    // submit a second purchase request (a new transaction ID) while an
    // earlier one was already approved, or an admin may have separately
    // activated them through the cash-activation flow — either way,
    // approving this record too would create another Order and re-run the
    // full income engine, double-crediting the sponsor's referral and
    // matching income for what is really one activation. Block it here too.
    // This guard only applies to fresh NEW activations — an UPGRADE request
    // is expected (required, in fact) to come from a member who is already
    // ACTIVE, so it has its own guard further below instead.
    if (!isUpgrade && user.status === 'ACTIVE' && user.activePackageId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `${user.memberId} is already ACTIVE with a package (activated elsewhere). Approving this purchase too would double-credit referral and matching income — this has been blocked. Reject this request instead if it is a duplicate.`
      });
    }

    if (isUpgrade && (user.status !== 'ACTIVE' || !user.activePackageId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `${user.memberId} is not currently an active member, so there is nothing to upgrade. Reject this request and have them submit a fresh package purchase instead.`
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

    // 🚀 UPGRADE path: member is already ACTIVE — just raise their tier/cap.
    // No new Order/IncomeService run here: per business rules an upgrade
    // (even though paid at the target package's full price) does not
    // generate fresh referral or binary matching income — it only elevates
    // the member's package, daily/weekly/monthly capping ceiling, and hands
    // over the target tier's bundled product(s).
    if (isUpgrade) {
      // Re-validate against the member's CURRENT authoritative package price
      // (not the price captured when they submitted the request) — guards
      // against two upgrade requests being approved out of order, which
      // would otherwise silently downgrade them back down.
      if (authoritativePrice <= (user.packagePrice || 0)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `${user.memberId} is already on a package worth ₹${user.packagePrice || 0}, which is the same or higher than this upgrade target (₹${authoritativePrice}). Approving would downgrade them — this has been blocked. Reject this request if it is stale/duplicate.`
        });
      }

      purchase.paymentStatus = 'COMPLETED';
      purchase.activationDate = new Date();
      await purchase.save({ session });

      const previousPackageName = user.currentPackage;
      user.currentPackage = resolvedPackage.name;
      user.packagePrice = authoritativePrice;
      user.dailyBinaryCap = dailyCap;
      user.activePackageId = resolvedPackage._id;
      await user.save({ session });

      await session.commitTransaction();
      session.endSession();

      try {
        await Notification.create({
          userId: user._id,
          type: 'FINANCIAL',
          priority: 'HIGH',
          title: 'Package Upgraded! 🚀',
          message: `Your package has been upgraded from ${previousPackageName || 'your previous plan'} to ${resolvedPackage.name}. Your daily binary cap is now ₹${dailyCap.toLocaleString('en-IN')}/day.`,
          icon: '🚀',
          color: '#16a34a',
          action: '/member/dashboard',
          actionLabel: 'Go to Dashboard'
        });
      } catch (notifErr) {
        console.error(`Notification failed for approved upgrade ${purchase._id}:`, notifErr.message);
      }

      return res.json({
        success: true,
        message: `Member ${user.memberId} successfully upgraded to ${resolvedPackage.name}!`,
        data: { purchase }
      });
    }

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

    try {
      await Notification.create({
        userId: user._id,
        type: 'FINANCIAL',
        priority: 'HIGH',
        title: 'Your ID is now ACTIVE! 🎉',
        message: `Your payment of ₹${authoritativePrice} for ${resolvedPackage.name} has been verified. Your account is now ACTIVE.`,
        icon: '✅',
        color: '#16a34a',
        action: '/member/dashboard',
        actionLabel: 'Go to Dashboard'
      });
    } catch (notifErr) {
      console.error(`Notification failed for approved purchase ${purchase._id}:`, notifErr.message);
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

    try {
      await Notification.create({
        userId: purchase.user,
        type: 'FINANCIAL',
        priority: 'HIGH',
        title: 'Payment verification failed',
        message: `Your payment submission for ${purchase.packageName} could not be verified. Reason: ${purchase.adminRemarks}. Please resubmit with correct details.`,
        icon: '⚠️',
        color: '#dc2626',
        action: '/member/packages',
        actionLabel: 'Resubmit Payment'
      });
    } catch (notifErr) {
      console.error(`Notification failed for rejected purchase ${purchase._id}:`, notifErr.message);
    }

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
    // `paymentProof` is a base64-encoded screenshot stored directly on the
    // document (often several hundred KB–multiple MB of text per record) —
    // fetching it for every purchase in this list/summary view (with no
    // projection, no .lean()) was pulling the full image data for the
    // entire collection on every load. With only ~50 real purchases so far
    // this had already grown large enough to blow past Vercel's function
    // timeout (504 Gateway Timeout) — it would only get worse as more
    // members submit purchases. Excluded here; "View Proof" now fetches
    // just that one purchase's image on demand (see getPurchaseProof
    // below), and .lean() skips Mongoose document hydration we don't need
    // for a read-only summary.
    const purchases = await PackagePurchase.find().select('-paymentProof').sort({ createdAt: -1 }).lean();

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

/**
 * Admin: fetch a single purchase's payment proof screenshot on demand —
 * split out of getAdminPackageAnalytics above so the list/summary view
 * never has to pull every purchase's proof image just to render a table.
 * GET /api/package-purchases/:purchaseId/proof
 */
exports.getPackagePurchaseProof = async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const purchase = await PackagePurchase.findById(purchaseId).select('paymentProof').lean();
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase record not found' });
    }
    res.json({ success: true, data: { paymentProof: purchase.paymentProof || '' } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};