// server/src/controllers/package.controller.js
const Package = require('../models/Package');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Referral = require('../models/Referral');
const BinaryService = require('../services/binary.service');

const DEFAULT_PACKAGES = [
  {
    name: 'Starter Package',
    type: 'STARTER',
    price: 1500,
    kbp: 1000,
    dailyCap: 1500,
    directBonus: 200,
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
    kbp: 4000,
    dailyCap: 7000,
    directBonus: 600,
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
    directBonus: 1200,
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
    directBonus: 1800,
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
    directBonus: 12000,
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
    // Return all documents where isActive is not explicitly false
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
    const resolvedDirectBonus = Number(directBonus !== undefined ? directBonus : (directSponsorBonus || 0));
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
    if (b.kbp !== undefined || b.kbpPoints !== undefined) updates.kbp = Number(b.kbp !== undefined ? b.kbp : b.kbpPoints);
    if (b.dailyCap !== undefined || b.dailyBinaryCap !== undefined) updates.dailyCap = Number(b.dailyCap !== undefined ? b.dailyCap : b.dailyBinaryCap);
    if (b.directBonus !== undefined || b.directSponsorBonus !== undefined) updates.directBonus = Number(b.directBonus !== undefined ? b.directBonus : b.directSponsorBonus);
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
 * Package Purchase & Activation Engine
 * POST /api/packages/purchase
 */
const purchasePackage = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const { packageId, price, kbp, productName } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let selectedPackage = null;
    if (packageId) {
      selectedPackage = await Package.findById(packageId).lean().catch(() => null);
    }
    if (!selectedPackage) {
      selectedPackage =
        DEFAULT_PACKAGES.find(
          (p) => String(p._id) === String(packageId) || p.price === Number(price)
        ) || DEFAULT_PACKAGES[0];
    }

    const packageKBP = Number(kbp) || selectedPackage.kbp || 1000;
    const directBonus = selectedPackage.directBonus || 200;

    user.status = 'ACTIVE';
    user.activationDate = new Date();
    if (selectedPackage._id && String(selectedPackage._id).length === 24) {
      user.activePackageId = selectedPackage._id;
    }
    user.totalKBP = (user.totalKBP || 0) + packageKBP;
    await user.save();

    await Referral.updateMany({ userId: user._id }, { $set: { isActive: true } });

    if (user.sponsorId && directBonus > 0) {
      const sponsorWallet = await Wallet.findOne({ userId: user.sponsorId });
      if (sponsorWallet) {
        sponsorWallet.directIncome = (sponsorWallet.directIncome || 0) + directBonus;
        sponsorWallet.incomeBalance = (sponsorWallet.incomeBalance || 0) + directBonus;
        sponsorWallet.totalIncome = (sponsorWallet.totalIncome || 0) + directBonus;
        await sponsorWallet.save();
      }
    }

    try {
      if (BinaryService && typeof BinaryService.updateVolumes === 'function') {
        await BinaryService.updateVolumes(user._id, packageKBP);
      }
    } catch (volErr) {
      console.error('Volume propagation notice:', volErr.message);
    }

    const updatedUser = user.toObject();
    delete updatedUser.password;

    res.json({
      success: true,
      message: `🎉 Account activated successfully with ${
        selectedPackage.name || productName || 'Package'
      }! Your Member ID is now ACTIVE.`,
      data: {
        user: updatedUser,
        package: selectedPackage
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