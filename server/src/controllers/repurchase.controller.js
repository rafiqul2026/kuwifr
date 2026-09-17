// server/src/controllers/repurchase.controller.js
const mongoose = require('mongoose');
const RepurchaseService = require('../services/repurchase.service');
const FundService = require('../services/fund.service');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const RepurchasePurchase = require('../models/RepurchasePurchase');
const RepurchaseProduct = require('../models/RepurchaseProduct');
const cloudinary = require('../config/cloudinary');

const MAX_PRODUCT_IMAGES = 4;

/**
 * Get all active Repurchase Store products, DB-backed (RepurchaseProduct —
 * see that model's comment for why this replaced a hardcoded array).
 * GET /api/repurchase/products
 */
const getRepurchaseProducts = async (req, res, next) => {
  try {
    const products = await RepurchaseProduct.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();

    res.json({
      success: true,
      data: { products }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Compute cart totals + normalized item list against the authoritative
 * RepurchaseProduct catalog — shared by submit/approve so the two can
 * never disagree about what a cart is actually worth.
 */
const priceCart = async (items) => {
  let totalKSPAmount = 0;
  let totalKBPAmount = 0;
  const purchasedItems = [];

  const ids = (items || []).map((item) => item.productId);
  const products = await RepurchaseProduct.find({ id: { $in: ids } }).lean();
  const productMap = new Map(products.map((p) => [p.id, p]));

  for (const item of items || []) {
    const prod = productMap.get(item.productId);
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

    const { totalKSPAmount, totalKBPAmount, purchasedItems } = await priceCart(items);
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
    // Same fix as packagePurchase.controller.js#getAdminPackageAnalytics:
    // `paymentProof` is a base64-encoded screenshot stored inline on the
    // document — fetching it for every purchase here (no projection, no
    // .lean()) grows this payload by the full image data of the entire
    // collection on every load, which is exactly what pushed the package
    // equivalent of this endpoint past Vercel's function timeout (504) at
    // only ~50 records. Excluded here before the same happens to this
    // endpoint; "View Proof" now fetches just that one purchase's image on
    // demand (see getRepurchasePurchaseProof below).
    const purchases = await RepurchasePurchase.find().select('-paymentProof').sort({ createdAt: -1 }).lean();

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
 * Admin: fetch a single repurchase purchase's payment proof screenshot on
 * demand — split out of getAdminRepurchaseAnalytics above so the list/
 * summary view never has to pull every purchase's proof image.
 * GET /api/repurchase/:purchaseId/proof
 */
const getRepurchasePurchaseProof = async (req, res, next) => {
  try {
    const { purchaseId } = req.params;
    const purchase = await RepurchasePurchase.findById(purchaseId).select('paymentProof').lean();
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase record not found' });
    }
    res.json({ success: true, data: { paymentProof: purchase.paymentProof || '' } });
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

/**
 * Uploads a single image buffer to Cloudinary under the Repurchase Store
 * product folder — same upload_stream shape used by offer.controller.js and
 * user.controller.js's KYC upload.
 */
const uploadProductImage = (buffer) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'kuwifr/repurchase-products',
        transformation: [{ width: 800, crop: 'limit' }, { quality: 'auto', fetch_format: 'auto' }]
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });

/**
 * Admin: List every Repurchase Store product (active + inactive), for the
 * product management screen.
 * GET /api/repurchase/admin/products
 */
const getAdminRepurchaseProducts = async (req, res, next) => {
  try {
    const products = await RepurchaseProduct.find().sort({ sortOrder: 1, createdAt: 1 }).lean();
    res.json({ success: true, data: { products } });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Create a new Repurchase Store product, with up to 4 original
 * product photos uploaded straight to Cloudinary (multipart `images` field
 * — see repurchase.routes.js's multer wiring).
 * POST /api/repurchase/admin/products
 */
const createRepurchaseProduct = async (req, res, next) => {
  try {
    const { id, name, category, description, tag, mrp, ksp, kbp, sortOrder, isActive } = req.body;

    if (!id || !String(id).trim()) {
      return res.status(400).json({ success: false, message: 'A unique Product ID is required.' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Product name is required.' });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ success: false, message: 'Category is required.' });
    }
    if (!mrp || !ksp || !kbp) {
      return res.status(400).json({ success: false, message: 'MRP, KSP, and KBP are all required.' });
    }

    const normalizedId = String(id).trim().toLowerCase();
    const existing = await RepurchaseProduct.findOne({ id: normalizedId });
    if (existing) {
      return res.status(400).json({ success: false, message: `A product with ID "${normalizedId}" already exists.` });
    }

    const files = (req.files || []).slice(0, MAX_PRODUCT_IMAGES);
    const uploads = await Promise.all(files.map((f) => uploadProductImage(f.buffer)));
    const images = uploads.map((u) => ({ url: u.secure_url, publicId: u.public_id }));

    const product = await RepurchaseProduct.create({
      id: normalizedId,
      name: name.trim(),
      category: category.trim(),
      description: description ? description.trim() : '',
      tag: tag ? tag.trim() : '',
      mrp: Number(mrp),
      ksp: Number(ksp),
      kbp: Number(kbp),
      sortOrder: Number(sortOrder) || 0,
      isActive: isActive === undefined ? true : isActive === 'true' || isActive === true,
      images
    });

    res.status(201).json({ success: true, message: 'Product added to the Repurchase Store.', data: { product } });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update a Repurchase Store product's fields, add new photos (up to
 * the 4-image cap), and/or remove specific existing photos (Cloudinary
 * assets are destroyed on removal). `removeImageIds` is a JSON-encoded array
 * of `publicId`s sent as a text field alongside any new `images` files.
 * PUT /api/repurchase/admin/products/:id
 */
const updateRepurchaseProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await RepurchaseProduct.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const { name, category, description, tag, mrp, ksp, kbp, sortOrder, isActive, removeImageIds } = req.body;
    if (name !== undefined) product.name = name.trim();
    if (category !== undefined) product.category = category.trim();
    if (description !== undefined) product.description = description.trim();
    if (tag !== undefined) product.tag = tag.trim();
    if (mrp !== undefined) product.mrp = Number(mrp);
    if (ksp !== undefined) product.ksp = Number(ksp);
    if (kbp !== undefined) product.kbp = Number(kbp);
    if (sortOrder !== undefined) product.sortOrder = Number(sortOrder) || 0;
    if (isActive !== undefined) product.isActive = isActive === 'true' || isActive === true;

    if (removeImageIds) {
      let idsToRemove = [];
      try {
        idsToRemove = JSON.parse(removeImageIds);
      } catch {
        idsToRemove = [];
      }
      if (Array.isArray(idsToRemove) && idsToRemove.length) {
        await Promise.all(
          idsToRemove.map((publicId) => cloudinary.uploader.destroy(publicId).catch(() => {}))
        );
        product.images = product.images.filter((img) => !idsToRemove.includes(img.publicId));
      }
    }

    const files = req.files || [];
    if (files.length) {
      const remainingSlots = MAX_PRODUCT_IMAGES - product.images.length;
      if (remainingSlots <= 0) {
        return res.status(400).json({
          success: false,
          message: `This product already has the maximum of ${MAX_PRODUCT_IMAGES} images. Remove one before adding another.`
        });
      }
      const uploads = await Promise.all(files.slice(0, remainingSlots).map((f) => uploadProductImage(f.buffer)));
      product.images.push(...uploads.map((u) => ({ url: u.secure_url, publicId: u.public_id })));
    }

    await product.save();
    res.json({ success: true, message: 'Product updated.', data: { product } });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete a Repurchase Store product (and all of its Cloudinary
 * photos). Past orders/purchase history keep their own denormalized
 * name/category/ksp/kbp snapshot (see RepurchasePurchase.items), so removing
 * a product here never rewrites completed order history.
 * DELETE /api/repurchase/admin/products/:id
 */
const deleteRepurchaseProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await RepurchaseProduct.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    if (product.images?.length) {
      await Promise.all(product.images.map((img) => cloudinary.uploader.destroy(img.publicId).catch(() => {})));
    }
    await product.deleteOne();

    res.json({ success: true, message: 'Product removed from the Repurchase Store.' });
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
  getRepurchasePurchaseProof,
  get10LevelRepurchase,
  getAdminRepurchaseProducts,
  createRepurchaseProduct,
  updateRepurchaseProduct,
  deleteRepurchaseProduct
};
