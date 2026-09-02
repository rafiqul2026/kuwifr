// server/src/controllers/repurchase.controller.js
const RepurchaseService = require('../services/repurchase.service');
const FundService = require('../services/fund.service');
const User = require('../models/User');
const Wallet = require('../models/Wallet');

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
 * Purchase Products via Repurchase Store
 * POST /api/repurchase/purchase
 */
const purchaseProducts = async (req, res, next) => {
  try {
    const { items } = req.body;
    const userId = req.userId;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'Cart cannot be empty' });
    }

    let totalKSPAmount = 0;
    let totalKBPAmount = 0;
    const purchasedItems = [];

    for (const item of items) {
      const prod = REPURCHASE_PRODUCTS.find((p) => p.id === item.productId);
      if (prod) {
        const qty = parseInt(item.quantity, 10) || 1;
        totalKSPAmount += prod.ksp * qty;
        totalKBPAmount += prod.kbp * qty;
        purchasedItems.push({
          productId: prod.id,
          name: prod.name,
          qty,
          ksp: prod.ksp,
          kbp: prod.kbp,
          subtotalKSP: prod.ksp * qty,
          subtotalKBP: prod.kbp * qty
        });
      }
    }

    // 1. Process 25% Self Cashback & Downline Level Distribution (with Direct Referral Gates)
    const distributionResult = await RepurchaseService.processRepurchaseDistribution(
      userId,
      totalKBPAmount,
      `ORD-REP-${Date.now()}`
    );

    // 2. Uplink Repurchase KBP to Life Tension Free Matching Funds
    if (FundService && typeof FundService.processRepurchaseKBPForFunds === 'function') {
      await FundService.processRepurchaseKBPForFunds(userId, totalKBPAmount);
    }

    res.json({
      success: true,
      message: `Purchase completed successfully! ₹${distributionResult.selfIncomeAmount.toLocaleString()} (25% Self Cashback) credited to your Repurchase Wallet.`,
      data: {
        totalKSP: totalKSPAmount,
        totalKBP: totalKBPAmount,
        selfIncomeEarned: distributionResult.selfIncomeAmount,
        purchasedItems
      }
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

    const selfRepurchaseIncome = wallet?.selfRepurchaseIncome || 0;
    const downlineRepurchaseIncome = wallet?.downlineRepurchaseIncome || 0;
    const totalRepurchaseWallet = wallet?.totalRepurchaseWallet || (selfRepurchaseIncome + downlineRepurchaseIncome);

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
        selfPercentage: 25
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRepurchaseProducts,
  purchaseProducts,
  get10LevelRepurchase
};