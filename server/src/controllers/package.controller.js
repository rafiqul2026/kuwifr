// server/src/controllers/package.controller.js
const mongoose = require('mongoose');
const Package = require('../models/Package');
const User = require('../models/User');
const Referral = require('../models/Referral');
const Order = require('../models/Order');
const BinaryService = require('../services/binary.service');
const IncomeService = require('../services/income.service');
const { withInsurancePlan, getInsurancePlan } = require('../constants/insurancePlans');

// Income caps (dailyCap/weeklyCap/monthlyCap) — the Rupee capping value
// itself is correct as-is and must NOT be scaled. What members see as
// "Daily/Weekly/Monthly Maximum KBP" is a purely informational figure
// (capping value x10, since compensation.matching.rate is 10% — see
// settings.service.js — so e.g. 15,000 KBP matched x 10% = the Starter
// Package's real ₹1,500 daily cap) computed client-side from these same
// fields; see PackagesPage.jsx/UpgradePackagePage.jsx. Nothing here stores
// that KBP figure — it is always derived, never a separate source of truth.
const DEFAULT_PACKAGES = [
  {
    name: 'Standard Package',
    type: 'STANDARD',
    price: 1000,
    kbp: 600,
    dailyCap: 1000,
    directBonus: 60, // 10% of 600 KBP
    weeklyCap: 7000,
    monthlyCap: 30000,
    description: 'Affordable entry package to activate your KUWIFR ID and start earning.',
    badge: 'Entry Plan',
    isActive: true,
    isPopular: false
  },
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
    // Matches the live Package document's kbp (4000) — this constant had
    // drifted to 5000, out of sync with the DB, before this fix.
    kbp: 4000,
    dailyCap: 7000,
    directBonus: 400, // 10% of 4000 KBP
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
      data: { packages: (packages && packages.length > 0 ? packages : DEFAULT_PACKAGES).map(withInsurancePlan) }
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
      data: { package: withInsurancePlan(pkg) }
    });
  } catch (error) {
    next(error);
  }
};

// "standard plus" / "Standard-Plus" -> "STANDARD_PLUS"; a leading digit
// gets a PKG_ prefix so the code always starts with a letter.
const normalizeTypeCode = (value) => {
  const code = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return /^[0-9]/.test(code) ? `PKG_${code}`.slice(0, 40) : code;
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const collapseSpaces = (s) => String(s || '').trim().replace(/\s+/g, ' ');

// Validates the numeric fields that were sent; returns an error message or null.
const validatePackageNumbers = (fields) => {
  const labels = {
    price: 'Price',
    kbp: 'KBP points',
    dailyCap: 'Daily binary cap',
    weeklyCap: 'Weekly cap',
    monthlyCap: 'Monthly cap'
  };
  for (const [key, label] of Object.entries(labels)) {
    if (fields[key] === undefined) continue;
    const n = fields[key];
    if (!Number.isFinite(n) || n < 0) return `${label} must be a number of 0 or more.`;
  }
  if (fields.price !== undefined && fields.price <= 0) return 'Price must be greater than 0.';
  return null;
};

// Another package (optionally excluding one) with the same name — ignoring
// case and extra spaces — or the same type code.
const findConflictingPackage = (name, type, excludeId) => {
  const or = [];
  if (name) or.push({ name: new RegExp(`^\\s*${escapeRegex(name).replace(/ /g, '\\s+')}\\s*$`, 'i') });
  if (type) or.push({ type });
  if (or.length === 0) return null;
  const query = { $or: or };
  if (excludeId) query._id = { $ne: excludeId };
  return Package.findOne(query).select('name type').lean();
};

/**
 * Admin: Create a new package
 * POST /api/packages
 */
const createPackage = async (req, res, next) => {
  try {
    const b = req.body || {};
    const resolvedName = collapseSpaces(b.name || b.packageName);
    const resolvedPrice = Number(b.price);
    const resolvedKbp = Number(b.kbp !== undefined && b.kbp !== '' ? b.kbp : b.kbpPoints);

    if (!resolvedName) {
      return res.status(400).json({ success: false, message: 'Package name is required.' });
    }
    if (b.price === undefined || b.price === '' || (b.kbp ?? b.kbpPoints ?? '') === '') {
      return res.status(400).json({ success: false, message: 'Price and KBP points are required.' });
    }

    // Type code: the one typed in Admin, else derived from the name.
    const resolvedType = normalizeTypeCode(b.type || b.packageType || resolvedName);
    if (!resolvedType) {
      return res.status(400).json({ success: false, message: 'Enter a package type code, e.g. STANDARD_PLUS.' });
    }

    const num = (v, fallback) => (v === undefined || v === '' ? fallback : Number(v));
    const resolvedDailyCap = num(b.dailyCap !== undefined ? b.dailyCap : b.dailyBinaryCap, resolvedPrice);
    const resolvedWeeklyCap = num(b.weeklyCap, resolvedDailyCap * 7);
    const resolvedMonthlyCap = num(b.monthlyCap, resolvedDailyCap * 30);

    const numberError = validatePackageNumbers({
      price: resolvedPrice,
      kbp: resolvedKbp,
      dailyCap: resolvedDailyCap,
      weeklyCap: resolvedWeeklyCap,
      monthlyCap: resolvedMonthlyCap
    });
    if (numberError) return res.status(400).json({ success: false, message: numberError });

    const existing = await findConflictingPackage(resolvedName, resolvedType);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: existing.type === resolvedType
          ? `A package with type code "${resolvedType}" already exists (${existing.name}). Use a different type code.`
          : `A package named "${existing.name}" already exists. Use a different name or edit that package.`
      });
    }

    const resolvedIsActive = b.status
      ? (b.status === 'ACTIVE' || b.status === 'Active (Visible)')
      : (b.isActive !== undefined ? Boolean(b.isActive) : true);

    const newPackage = await Package.create({
      name: resolvedName,
      type: resolvedType,
      price: resolvedPrice,
      kbp: resolvedKbp,
      dailyCap: resolvedDailyCap,
      weeklyCap: resolvedWeeklyCap,
      monthlyCap: resolvedMonthlyCap,
      description: collapseSpaces(b.description || b.entitlements),
      badge: collapseSpaces(b.displayBadge || b.badge),
      isActive: resolvedIsActive,
      isPopular: Boolean(b.isPopular)
    });

    res.status(201).json({
      success: true,
      message: `${newPackage.name} created successfully`,
      data: { package: newPackage }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update package
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

    const b = req.body || {};
    const updates = {};
    const has = (v) => v !== undefined && v !== '';

    if (has(b.name) || has(b.packageName)) updates.name = collapseSpaces(b.name || b.packageName);
    if (has(b.type) || has(b.packageType)) updates.type = normalizeTypeCode(b.type || b.packageType);
    if (has(b.price)) updates.price = Number(b.price);
    if (has(b.kbp) || has(b.kbpPoints)) updates.kbp = Number(has(b.kbp) ? b.kbp : b.kbpPoints);
    if (has(b.dailyCap) || has(b.dailyBinaryCap)) updates.dailyCap = Number(has(b.dailyCap) ? b.dailyCap : b.dailyBinaryCap);
    if (has(b.weeklyCap)) updates.weeklyCap = Number(b.weeklyCap);
    if (has(b.monthlyCap)) updates.monthlyCap = Number(b.monthlyCap);
    if (b.description !== undefined || b.entitlements !== undefined) {
      updates.description = collapseSpaces(b.description !== undefined ? b.description : b.entitlements);
    }
    if (b.badge !== undefined || b.displayBadge !== undefined) {
      updates.badge = collapseSpaces(b.displayBadge !== undefined ? b.displayBadge : b.badge);
    }

    if (b.status !== undefined) {
      updates.isActive = b.status === 'ACTIVE' || b.status === 'Active (Visible)';
    } else if (b.isActive !== undefined) {
      updates.isActive = Boolean(b.isActive);
    }
    if (b.isPopular !== undefined) updates.isPopular = Boolean(b.isPopular);

    if (updates.name === '') {
      return res.status(400).json({ success: false, message: 'Package name cannot be empty.' });
    }
    if (updates.type !== undefined && !updates.type) {
      return res.status(400).json({ success: false, message: 'Enter a valid package type code, e.g. STANDARD_PLUS.' });
    }

    const numberError = validatePackageNumbers(updates);
    if (numberError) return res.status(400).json({ success: false, message: numberError });

    const conflict = await findConflictingPackage(updates.name, updates.type, pkg._id);
    if (conflict) {
      return res.status(400).json({
        success: false,
        message: updates.type && conflict.type === updates.type
          ? `Type code "${updates.type}" is already used by ${conflict.name}.`
          : `Another package is already named "${conflict.name}".`
      });
    }

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
 * Admin: choose which products members can pick when buying / upgrading to
 * this package.
 * PUT /api/packages/:id/products
 *   body { productIds: ['kfr-p01', ...] }  -> explicit list (replaces any
 *                                             previous one; [] = none offered)
 *   body { reset: true }                   -> back to the automatic default
 *                                             (every active product whose KSP
 *                                             equals the package price)
 * Product ids are RepurchaseProduct.id slugs. Unknown ids are rejected
 * rather than silently stored, so a typo can't leave a package offering a
 * product that doesn't exist.
 */
const setPackageProducts = async (req, res, next) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }

    if (req.body?.reset === true) {
      await Package.updateOne({ _id: pkg._id }, { $unset: { includedProductIds: 1 } });
      return res.json({
        success: true,
        message: `${pkg.name} now uses the automatic product list (products priced at ₹${pkg.price.toLocaleString('en-IN')}).`,
        data: { packageId: pkg._id, includedProductIds: null }
      });
    }

    const { productIds } = req.body || {};
    if (!Array.isArray(productIds) || productIds.some((x) => typeof x !== 'string')) {
      return res.status(400).json({ success: false, message: 'productIds must be an array of product ids.' });
    }

    const uniqueIds = [...new Set(productIds.map((x) => x.trim()).filter(Boolean))];
    const RepurchaseProduct = require('../models/RepurchaseProduct');
    const found = await RepurchaseProduct.find({ id: { $in: uniqueIds } }).select('id').lean();
    const foundSet = new Set(found.map((p) => p.id));
    const missing = uniqueIds.filter((x) => !foundSet.has(x));
    if (missing.length) {
      return res.status(400).json({ success: false, message: `Unknown product id(s): ${missing.join(', ')}` });
    }

    await Package.updateOne({ _id: pkg._id }, { $set: { includedProductIds: uniqueIds } });
    res.json({
      success: true,
      message: `${pkg.name} now offers ${uniqueIds.length} product${uniqueIds.length === 1 ? '' : 's'}.`,
      data: { packageId: pkg._id, includedProductIds: uniqueIds }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Enforces the admin-assigned product list at purchase/upgrade time: when a
 * package has an explicit includedProductIds list, every product a member
 * submits must be on it. Packages with no explicit list keep the legacy
 * behaviour (no server-side product check). Returns an error message string,
 * or null when the selection is fine.
 */
const validateSelectedProducts = (pkg, selectedProducts) => {
  if (!pkg || !Array.isArray(pkg.includedProductIds)) return null;
  // The package's insurance plan is always a valid choice alongside the
  // admin-assigned products (see constants/insurancePlans.js).
  const allowed = new Set(pkg.includedProductIds);
  const insurance = getInsurancePlan(pkg.type);
  if (insurance) allowed.add(insurance.id);
  // Member pages submit the product slug as `productId`; accept `id` too.
  const bad = (selectedProducts || []).filter((p) => !allowed.has(p?.productId || p?.id));
  if (bad.length) {
    return `${bad.map((p) => p?.name || p?.id || 'That product').join(', ')} is not available with ${pkg.name}. Please choose one of the listed products.`;
  }
  return null;
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
  setPackageProducts,
  validateSelectedProducts,
  togglePackageStatus,
  deletePackage,
  purchasePackage
};