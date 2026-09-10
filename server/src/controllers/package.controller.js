// server/src/controllers/package.controller.js
const mongoose = require('mongoose');
const Package = require('../models/Package');
const User = require('../models/User');
const Referral = require('../models/Referral');
const Order = require('../models/Order');
const BinaryService = require('../services/binary.service');
const IncomeService = require('../services/income.service');

const DEFAULT_PACKAGES = [
  {
    name: 'Starter Package',
    type: 'STARTER',
    price: 1500,
    kbp: 1000,
    dailyCap: 1500,
    directBonus: 100, // 10% of 1000 KBP
    weeklyCap: 10500,
    monthlyCap: 45000,
    description: 'Perfect entry package for beginners to start earning in KUWIFR.',
    badge: 'Popular Choice',
    isActive: true,
    isPopular: true
  },
  {
    name: 'Growth Package',
    type: 'GROWTH',
    price: 5000,
    kbp: 5000,
    dailyCap: 7000,
    directBonus: 500, // 10% of 5000 KBP
    weeklyCap: 49000,
    monthlyCap: 210000,
    description: 'Designed for ambitious members scaling their binary team network.',
    badge: 'Growth Plan',
    isActive: true,
    isPopular: false
  },
  {
    name: 'Life Safe Package',
    type: 'LIFE_SAFE',
    price: 10000,
    kbp: 7500,
    dailyCap: 15000,
    directBonus: 750, // 10% of 7500 KBP
    weeklyCap: 105000,
    monthlyCap: 450000,
    description: 'Comprehensive health & alkaline water purification solutions.',
    badge: 'Health Choice',
    isActive: true,
    isPopular: false
  },
  {
    name: 'Life Safe Elite Package',
    type: 'LIFE_SAFE_ELITE',
    price: 15000,
    kbp: 10000,
    dailyCap: 20000,
    directBonus: 1000, // 10% of 10000 KBP
    weeklyCap: 140000,
    monthlyCap: 600000,
    description: 'Premium alkaline filtration with high daily earning caps for elite performers.',
    badge: 'High Earner',
    isActive: true,
    isPopular: false
  },
  {
    name: 'Titanium Package',
    type: 'TITANIUM',
    price: 110000,
    kbp: 50000,
    dailyCap: 50000,
    directBonus: 5000, // 10% of 50000 KBP
    weeklyCap: 350000,
    monthlyCap: 1500000,
    description: 'The ultimate pinnacle tier with Electric Vehicle benefit and maximum capping.',
    badge: 'Executive VIP',
    isActive: true,
    isPopular: false
  }
];

const seedPackagesIfEmpty = async () => {
  try {
    const count = await Package.countDocuments();
    if (count === 0) {
      for (const p of DEFAULT_PACKAGES) {
        await Package.create(p);
      }
    }
  } catch (err) {
    console.error('Error auto-seeding packages:', err.message);
  }
};

/**
 * Public catalog: Get active packages
 * GET /api/packages or GET /api/packages/all
 */
const getAllPackages = async (req, res, next) => {
  try {
    await seedPackagesIfEmpty();
    const packages = await Package.find({
      $or: [
        { isActive: true },
        { status: 'ACTIVE' },
        { status: 'Active (Visible)' }
      ]
    })
      .sort({ price: 1 })
      .lean();

    res.json({
      success: true,
      data: { packages: packages && packages.length > 0 ? packages : DEFAULT_PACKAGES }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get all packages (including inactive/hidden)
 * GET /api/admin/packages
 */
const adminGetAllPackages = async (req, res, next) => {
  try {
    await seedPackagesIfEmpty();
    const packages = await Package.find().sort({ price: 1 }).lean();
    res.json({
      success: true,
      data: { packages: packages || [] }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get package details by ID
 * GET /api/packages/:id
 */
const getPackageById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pkg = await Package.findById(id).lean();
    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }
    res.json({
      success: true,
      data: { package: pkg }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Create a new package
 * POST /api/packages
 */
const createPackage = async (req, res, next) => {
  try {
    const {
      name,
      packageName,
      type,
      packageType,
      price,
      kbp,
      kbpPoints,
      dailyCap,
      dailyBinaryCap,
      directBonus,
      directSponsorBonus,
      weeklyCap,
      monthlyCap,
      description,
      entitlements,
      isActive,
      status,
      badge,
      displayBadge,
      isPopular
    } = req.body;

    const resolvedName = (name || packageName || '').trim();
    const resolvedPrice = Number(price);
    const resolvedKbp = Number(kbp !== undefined ? kbp : kbpPoints);

    if (!resolvedName || isNaN(resolvedPrice) || isNaN(resolvedKbp)) {
      return res.status(400).json({
        success: false,
        message: 'Package Name, Price, and KBP points are required.'
      });
    }

    const resolvedType = (type || packageType || resolvedName.replace(/\s+/g, '_')).toUpperCase();

    const existing = await Package.findOne({
      $or: [{ name: resolvedName }, { type: resolvedType }]
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Package with name "${resolvedName}" or type "${resolvedType}" already exists.`
      });
    }

    const resolvedDailyCap = Number(dailyCap !== undefined ? dailyCap : (dailyBinaryCap !== undefined ? dailyBinaryCap : resolvedPrice));
    // 🌟 Strictly calculate direct bonus as 10% of package KBP value
    const resolvedDirectBonus = resolvedKbp * 0.10;
    const resolvedWeeklyCap = Number(weeklyCap !== undefined ? weeklyCap : resolvedDailyCap * 7);
    const resolvedMonthlyCap = Number(monthlyCap !== undefined ? monthlyCap : resolvedDailyCap * 30);
    const resolvedDesc = description || entitlements || '';
    const resolvedBadge = displayBadge || badge || '';
    const resolvedIsActive = status ? (status === 'ACTIVE' || status === 'Active (Visible)') : (isActive !== undefined ? Boolean(isActive) : true);

    const newPackage = await Package.create({
      name: resolvedName,
      type: resolvedType,
      price: resolvedPrice,
      kbp: resolvedKbp,
      dailyCap: resolvedDailyCap,
      directBonus: resolvedDirectBonus,
      weeklyCap: resolvedWeeklyCap,
      monthlyCap: resolvedMonthlyCap,
      description: resolvedDesc,
      badge: resolvedBadge,
      status: resolvedIsActive ? 'ACTIVE' : 'INACTIVE',
      isActive: resolvedIsActive,
      isPopular: Boolean(isPopular)
    });

    res.status(201).json({
      success: true,
      message: 'Package created successfully',
      data: { package: newPackage }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update an existing package
 * PUT /api/packages/:id
 */
const updatePackage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pkg = await Package.findById(id);

    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    const b = req.body;
    const updates = {};

    if (b.name !== undefined || b.packageName !== undefined) updates.name = (b.name || b.packageName).trim();
    if (b.type !== undefined || b.packageType !== undefined) updates.type = (b.type || b.packageType).toUpperCase();
    if (b.price !== undefined) updates.price = Number(b.price);
    if (b.kbp !== undefined || b.kbpPoints !== undefined) {
      updates.kbp = Number(b.kbp !== undefined ? b.kbp : b.kbpPoints);
      // Automatically update direct bonus to 10% of new KBP value
      updates.directBonus = updates.kbp * 0.10;
    }
    if (b.dailyCap !== undefined || b.dailyBinaryCap !== undefined) updates.dailyCap = Number(b.dailyCap !== undefined ? b.dailyCap : b.dailyBinaryCap);
    if (b.weeklyCap !== undefined) updates.weeklyCap = Number(b.weeklyCap);
    if (b.monthlyCap !== undefined) updates.monthlyCap = Number(b.monthlyCap);
    if (b.description !== undefined || b.entitlements !== undefined) updates.description = b.description !== undefined ? b.description : b.entitlements;
    if (b.badge !== undefined || b.displayBadge !== undefined) updates.badge = b.displayBadge !== undefined ? b.displayBadge : b.badge;

    if (b.status !== undefined) {
      updates.status = b.status;
      updates.isActive = b.status === 'ACTIVE' || b.status === 'Active (Visible)';
    } else if (b.isActive !== undefined) {
      updates.isActive = Boolean(b.isActive);
      updates.status = updates.isActive ? 'ACTIVE' : 'INACTIVE';
    }

    if (b.isPopular !== undefined) updates.isPopular = Boolean(b.isPopular);

    const updatedPackage = await Package.findByIdAndUpdate(id, { $set: updates }, {
      new: true,
      runValidators: true
    });

    res.json({
      success: true,
      message: 'Package updated successfully',
      data: { package: updatedPackage }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Toggle active status
 * PUT /api/packages/:id/toggle
 */
const togglePackageStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pkg = await Package.findById(id);

    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    pkg.isActive = !pkg.isActive;
    pkg.status = pkg.isActive ? 'ACTIVE' : 'INACTIVE';
    await pkg.save();

    res.json({
      success: true,
      message: `Package ${pkg.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { package: pkg }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete a package
 * DELETE /api/packages/:id
 */
const deletePackage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pkg = await Package.findByIdAndDelete(id);

    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    res.json({
      success: true,
      message: 'Package deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin Quick-Activation Engine
 * POST /api/packages/purchase — ADMIN ONLY (see package.routes.js)
 *
 * This used to be reachable by any authenticated MEMBER with zero payment
 * verification — no transaction ID, no payment proof, no admin approval —
 * a direct bypass of the real, gated member flow
 * (PackagesPage.jsx -> completePackagePurchase submits payment proof ->
 * an admin reviews and calls approvePackagePurchase). The only page that
 * ever called this route, BuyPackagePage.jsx, was never wired into
 * MemberRoutes.jsx, so it was already unreachable from the live app's
 * navigation — but the API endpoint itself was still live and callable
 * directly, so it has been moved behind admin auth in package.routes.js
 * rather than left as an exploitable self-activation loophole.
 *
 * It also used to be able to leave a member ACTIVE with NO real package
 * reference: when `packageId` didn't resolve via Package.findById, it fell
 * back to a hardcoded DEFAULT_PACKAGES entry whose `_id` is not a real
 * Mongo ObjectId, so `user.activePackageId` was silently left unset —
 * producing exactly the "status ACTIVE, Package: No Active Package" state
 * that violates the stated business rule (a member is only ACTIVE once
 * they've actually bought a real package). That fallback is gone: this now
 * always resolves against the real master catalog and refuses to activate
 * if it can't, and the User model's pre-save hook (models/User.js) now
 * refuses to save a MEMBER as ACTIVE without activePackageId regardless,
 * as a second line of defense against this exact bug recurring.
 *
 * Brought up to the same standard as the other three activation paths
 * (admin.controller.js#activateMemberWithPackage,
 * order.controller.js#activateCashPackage,
 * packagePurchase.controller.js#approvePackagePurchase): a duplicate-
 * activation guard, and the real income engine (a proper Order record +
 * IncomeService.processOrderIncome) instead of the previous hand-rolled,
 * ledger-less direct-bonus wallet credit that bypassed IncomeTransaction
 * entirely — which also meant it never showed up on the Income Overview
 * page or in diagnose-income.js.
 */
const purchasePackage = async (req, res, next) => {
  try {
    const userId = req.body.userId || req.userId || req.user?.id || req.user?._id;
    const { packageId } = req.body;

    if (!packageId) {
      return res.status(400).json({ success: false, message: 'Please select a valid package to activate.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Same guard as every other activation path: never double-activate an
    // already-ACTIVE member — that would re-credit referral/matching
    // income for what is really one activation.
    if (user.status === 'ACTIVE' && user.activePackageId) {
      return res.status(400).json({
        success: false,
        message: `${user.memberId} is already ACTIVE with a package. Re-activating would double-credit referral and matching income — this has been blocked.`
      });
    }

    if (!mongoose.Types.ObjectId.isValid(packageId)) {
      return res.status(400).json({ success: false, message: 'Invalid package selected.' });
    }
    const selectedPackage = await Package.findById(packageId);
    if (!selectedPackage) {
      return res.status(404).json({ success: false, message: 'Selected package not found in master catalog.' });
    }

    const packageKBP = selectedPackage.kbp || selectedPackage.kbpValue || 1000;
    const packagePrice = selectedPackage.price || selectedPackage.packagePrice || 0;

    // status, activePackageId, currentPackage, packagePrice and
    // dailyBinaryCap are always written together in the same save — this
    // is exactly the invariant the schema now enforces.
    user.status = 'ACTIVE';
    user.activationDate = new Date();
    user.activePackageId = selectedPackage._id;
    user.currentPackage = selectedPackage.name;
    user.packagePrice = packagePrice;
    user.dailyBinaryCap = selectedPackage.dailyCap || selectedPackage.dailyBinaryCap || 0;
    user.totalKBP = (user.totalKBP || 0) + packageKBP;
    await user.save();

    await Referral.updateMany({ userId: user._id }, { $set: { isActive: true } });

    const orderNumber = `ORD-QA-${Date.now().toString(36).toUpperCase()}`;
    const newOrder = await Order.create({
      userId: user._id,
      orderNumber,
      orderType: 'PACKAGE',
      packageType: 'PACKAGE',
      packageId: selectedPackage._id,
      packageName: selectedPackage.name,
      packagePrice,
      totalAmount: packagePrice,
      subtotal: packagePrice,
      totalKBP: packageKBP,
      kbpGenerated: packageKBP,
      products: [{ name: selectedPackage.name, quantity: 1, price: packagePrice, kbp: packageKBP }],
      paymentMethod: 'ADMIN_MANUAL',
      paymentType: 'ONLINE_GATEWAY',
      paymentStatus: 'SUCCESS',
      orderStatus: 'COMPLETED',
      status: 'COMPLETED',
      statusHistory: [{ status: 'COMPLETED', timestamp: new Date(), note: 'Quick-activated by Admin' }]
    });

    // processOrderIncome already propagates this order's KBP into the
    // member's binary leg volumes (via BinaryService.updateVolumes) as
    // part of matching income — do NOT also call updateVolumes separately
    // here, that would double-count this activation's KBP into the tree.
    const incomeResult = await IncomeService.processOrderIncome(newOrder).catch((incomeErr) => {
      console.error(`Income processing failed for quick-activation of ${user.memberId}:`, incomeErr.message);
      return null;
    });

    const updatedUser = user.toObject();
    delete updatedUser.password;

    res.json({
      success: true,
      message: `🎉 Member ${user.memberId} activated with ${selectedPackage.name}! Member ID is now ACTIVE.`,
      data: {
        user: updatedUser,
        package: selectedPackage,
        order: newOrder,
        incomeResult
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllPackages,
  adminGetAllPackages,
  getPackageById,
  createPackage,
  updatePackage,
  togglePackageStatus,
  deletePackage,
  purchasePackage
};