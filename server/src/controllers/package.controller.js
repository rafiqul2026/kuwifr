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
    description: 'Perfect entry package with 1,000 KBP and instant account activation.',
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
 * Get all available packages
 * GET /api/packages or GET /api/packages/all
 */
const getAllPackages = async (req, res, next) => {
  try {
    await seedPackagesIfEmpty();
    let packages = await Package.find({ isActive: true }).lean();
    if (!packages || packages.length === 0) {
      packages = DEFAULT_PACKAGES;
    }
    res.json({
      success: true,
      data: { packages }
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
 * Package Purchase & Activation Engine
 * Transitions user status: INACTIVE -> ACTIVE
 * POST /api/packages/purchase
 */
const purchasePackage = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { packageId, price, kbp, productName } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Lookup package from database or fallback to default packages
    let selectedPackage = null;
    if (packageId) {
      selectedPackage = await Package.findById(packageId).lean().catch(() => null);
    }
    if (!selectedPackage) {
      selectedPackage = DEFAULT_PACKAGES.find(
        (p) => String(p._id) === String(packageId) || p.price === Number(price)
      ) || DEFAULT_PACKAGES[0];
    }

    const packageKBP = Number(kbp) || selectedPackage.kbp || 1000;
    const directBonus = selectedPackage.directBonus || 200;

    // 1. Activate member account
    user.status = 'ACTIVE';
    user.activationDate = new Date();
    if (selectedPackage._id && String(selectedPackage._id).length === 24) {
      user.activePackageId = selectedPackage._id;
    }
    user.totalKBP = (user.totalKBP || 0) + packageKBP;
    await user.save();

    // 2. Mark unilevel referral records active in genealogy
    await Referral.updateMany({ userId: user._id }, { $set: { isActive: true } });

    // 3. Credit Direct Sponsor Bonus to upline sponsor
    if (user.sponsorId && directBonus > 0) {
      const sponsorWallet = await Wallet.findOne({ userId: user.sponsorId });
      if (sponsorWallet) {
        sponsorWallet.directIncome = (sponsorWallet.directIncome || 0) + directBonus;
        sponsorWallet.incomeBalance = (sponsorWallet.incomeBalance || 0) + directBonus;
        sponsorWallet.totalIncome = (sponsorWallet.totalIncome || 0) + directBonus;
        await sponsorWallet.save();
      }
    }

    // 4. Propagate KBP volume up the binary tree and trigger pair matching
    try {
      await BinaryService.updateVolumes(user._id, packageKBP);
    } catch (volErr) {
      console.error('Volume propagation notice:', volErr.message);
    }

    const updatedUser = user.toObject();
    delete updatedUser.password;

    res.json({
      success: true,
      message: `🎉 Account activated successfully with ${selectedPackage.name || productName || 'Package'}! Your Member ID is now ACTIVE.`,
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
  getPackageById,
  purchasePackage
};