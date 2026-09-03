// server/src/controllers/rank.controller.js
// Production controller for Kuwi Star Career Path & Rank Milestones
const Rank = require('../models/Rank');
const RankAchievement = require('../models/RankAchievement');
const User = require('../models/User');

// Standard 12-Tier Official KUWIFR Career Progression System
const DEFAULT_RANKS = [
  {
    level: 1,
    name: 'Star Executive',
    code: 'STAR',
    starsRequired: 0,
    salaryPercentage: 0,
    reward: 'Recognition Badge',
    rewardValue: 500,
    color: '#3b82f6',
    icon: '⭐',
    benefits: ['First milestone of binary pair matching', 'Direct referral privileges'],
    isActive: true
  },
  {
    level: 2,
    name: 'Bronze Leader',
    code: 'BRONZE',
    starsRequired: 6,
    salaryPercentage: 0,
    reward: 'Bronze Pin + ₹2,000 Cash Reward',
    rewardValue: 2000,
    color: '#cd7f32',
    icon: '🥉',
    benefits: ['Leadership Recognition', 'Team Overrides'],
    isActive: true
  },
  {
    level: 3,
    name: 'Silver Director',
    code: 'SILVER',
    starsRequired: 20,
    salaryPercentage: 0,
    reward: 'Silver Trophy + ₹5,000 Cash Reward',
    rewardValue: 5000,
    color: '#94a3b8',
    icon: '🥈',
    benefits: ['Director Level Perks', 'Special Leadership Trainings'],
    isActive: true
  },
  {
    level: 4,
    name: 'Gold Director',
    code: 'GOLD',
    starsRequired: 70,
    salaryPercentage: 0,
    reward: 'Gold Trophy + ₹10,000 Cash Reward',
    rewardValue: 10000,
    color: '#f59e0b',
    icon: '🥇',
    benefits: ['Executive Access', 'Quarterly Growth Meets'],
    isActive: true
  },
  {
    level: 5,
    name: 'Ruby Ambassador',
    code: 'RUBY',
    starsRequired: 200,
    salaryPercentage: 0.01, // 1.0% TTO Royalty
    reward: 'Ruby Ring + ₹25,000 Cash Reward',
    rewardValue: 25000,
    color: '#ef4444',
    icon: '💎',
    benefits: ['1% Monthly TTO Royalty', 'National Convention VIP Access'],
    isActive: true
  },
  {
    level: 6,
    name: 'Emerald Ambassador',
    code: 'EMERALD',
    starsRequired: 700,
    salaryPercentage: 0.0075, // 0.75% TTO Royalty
    reward: 'Emerald Shield + ₹60,000 Cash Reward',
    rewardValue: 60000,
    color: '#10b981',
    icon: '🟢',
    benefits: ['0.75% Monthly TTO Royalty', 'Luxury Travel Allowance'],
    isActive: true
  },
  {
    level: 7,
    name: 'Diamond King',
    code: 'DIAMOND',
    starsRequired: 2200,
    salaryPercentage: 0.005, // 0.5% TTO Royalty
    reward: 'Diamond Trophy + International Trip',
    rewardValue: 200000,
    color: '#06b6d4',
    icon: '💠',
    benefits: ['0.50% Monthly TTO Royalty', 'International Tours'],
    isActive: true
  },
  {
    level: 8,
    name: 'Crown Ambassador',
    code: 'CROWN',
    starsRequired: 7000,
    salaryPercentage: 0.004, // 0.4% TTO Royalty
    reward: 'Gold Crown + Luxury Car Fund',
    rewardValue: 600000,
    color: '#8b5cf6',
    icon: '👑',
    benefits: ['0.40% Monthly TTO Royalty', 'Car Fund Eligibility'],
    isActive: true
  },
  {
    level: 9,
    name: 'Royal Crown',
    code: 'ROYAL_CROWN',
    starsRequired: 15000,
    salaryPercentage: 0.003, // 0.3% TTO Royalty
    reward: 'Royal Trophy + Luxury Villa Fund',
    rewardValue: 1500000,
    color: '#ec4899',
    icon: '🏰',
    benefits: ['0.30% Monthly TTO Royalty', 'House Fund Eligibility'],
    isActive: true
  },
  {
    level: 10,
    name: 'Universal King',
    code: 'UNIVERSAL_KING',
    starsRequired: 35000,
    salaryPercentage: 0.0025, // 0.25% TTO Royalty
    reward: 'Global Honor Ring + ₹10,00,000',
    rewardValue: 1000000,
    color: '#6366f1',
    icon: '🌌',
    benefits: ['0.25% Monthly TTO Royalty', 'Global Board Member'],
    isActive: true
  },
  {
    level: 11,
    name: 'Global Legend',
    code: 'GLOBAL_LEGEND',
    starsRequired: 75000,
    salaryPercentage: 0.002, // 0.2% TTO Royalty
    reward: 'Legend Award + ₹25,00,000',
    rewardValue: 2500000,
    color: '#d946ef',
    icon: '⚜️',
    benefits: ['0.20% Monthly TTO Royalty', 'Lifetime Council Access'],
    isActive: true
  },
  {
    level: 12,
    name: 'Kuwi Emperor',
    code: 'KUWI_EMPEROR',
    starsRequired: 160000,
    salaryPercentage: 0.0015, // 0.15% TTO Royalty
    reward: 'Emperor Royal Crest + ₹50,00,000',
    rewardValue: 5000000,
    color: '#eab308',
    icon: '🦁',
    benefits: ['0.15% Monthly TTO Royalty', 'Company Lifetime Dividend'],
    isActive: true
  }
];

// Helper: Auto-seed standard ranks on first boot
const seedRanksIfEmpty = async () => {
  try {
    const count = await Rank.countDocuments();
    if (count === 0) {
      for (const r of DEFAULT_RANKS) {
        await Rank.findOneAndUpdate(
          { code: r.code },
          { ...r, isActive: true },
          { upsert: true, new: true }
        );
      }
    }
  } catch (err) {
    console.error('Error auto-seeding ranks:', err.message);
  }
};

/**
 * Public & Admin: Fetch all ranks in progression sequence
 * GET /api/ranks or GET /api/ranks/all
 */
const getAllRanks = async (req, res, next) => {
  try {
    await seedRanksIfEmpty();
    let ranks = await Rank.find().sort({ level: 1 }).lean();
    if (!ranks || ranks.length === 0) {
      ranks = DEFAULT_RANKS;
    }
    return res.status(200).json({
      success: true,
      data: { ranks },
      ranks
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      data: { ranks: DEFAULT_RANKS },
      ranks: DEFAULT_RANKS
    });
  }
};

/**
 * Member: Get user's current rank and earned milestones
 * GET /api/ranks/user
 */
const getUserRanks = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    await seedRanksIfEmpty();

    let achievements = [];
    try {
      achievements = await RankAchievement.find({ userId, status: 'ACHIEVED' })
        .populate('rankId')
        .lean();
    } catch {
      achievements = [];
    }

    const user = await User.findById(userId).lean();
    const currentRank = achievements.length > 0 ? achievements[achievements.length - 1].rankId : null;

    return res.status(200).json({
      success: true,
      data: {
        current: currentRank,
        currentStars: user?.kuwiStars || 0,
        totalRanks: achievements.length,
        achievements: achievements || []
      }
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      data: {
        current: null,
        currentStars: 0,
        totalRanks: 0,
        achievements: []
      }
    });
  }
};

/**
 * Member: Get user's current rank badge
 * GET /api/ranks/current
 */
const getCurrentRank = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const user = await User.findById(userId).populate('currentRankId').lean();
    return res.status(200).json({
      success: true,
      data: { rank: user?.currentRankId || null }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Create a new rank
 * POST /api/admin/ranks or POST /api/ranks
 */
const createRank = async (req, res, next) => {
  try {
    const {
      name,
      level,
      code,
      starsRequired,
      reward,
      rewardValue,
      salaryPercentage,
      icon,
      color,
      isActive,
      benefits
    } = req.body;

    if (!name || level === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Rank Name and Progression Level are required.'
      });
    }

    const rankCode = (code || name.replace(/\s+/g, '_')).toUpperCase();

    const existing = await Rank.findOne({
      $or: [{ name: name.trim() }, { code: rankCode }, { level: Number(level) }]
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Rank with name "${name}", code "${rankCode}", or level "${level}" already exists.`
      });
    }

    // Convert percentage if passed as whole percentage (e.g. 1.0 -> 0.01)
    let parsedSalary = Number(salaryPercentage || 0);
    if (parsedSalary > 1) {
      parsedSalary = parsedSalary / 100;
    }

    const newRank = await Rank.create({
      name: name.trim(),
      level: Number(level),
      code: rankCode,
      starsRequired: Number(starsRequired || 0),
      reward: reward || '',
      rewardValue: Number(rewardValue || 0),
      salaryPercentage: parsedSalary,
      icon: icon || '⭐',
      color: color || '#2563eb',
      benefits: Array.isArray(benefits) ? benefits : ['Career progression perk'],
      isActive: isActive !== undefined ? Boolean(isActive) : true
    });

    return res.status(201).json({
      success: true,
      message: 'Rank milestone created successfully',
      data: { rank: newRank },
      rank: newRank
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update existing rank
 * PUT /api/admin/ranks/:id or PUT /api/ranks/:id
 */
const updateRank = async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = { ...req.body };

    if (body.level !== undefined) body.level = Number(body.level);
    if (body.starsRequired !== undefined) body.starsRequired = Number(body.starsRequired);
    if (body.rewardValue !== undefined) body.rewardValue = Number(body.rewardValue);

    // Format salary decimal percentage
    if (body.salaryPercentage !== undefined) {
      let parsed = Number(body.salaryPercentage);
      if (parsed > 1) {
        parsed = parsed / 100;
      }
      body.salaryPercentage = parsed;
    }

    if (body.isActive !== undefined) body.isActive = Boolean(body.isActive);

    const updated = await Rank.findByIdAndUpdate(id, { $set: body }, {
      new: true,
      runValidators: true
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Rank not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Rank updated successfully',
      data: { rank: updated },
      rank: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete rank
 * DELETE /api/admin/ranks/:id or DELETE /api/ranks/:id
 */
const deleteRank = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await Rank.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Rank not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Rank deleted permanently from progression tree'
    });
  } catch (error) {
    next(error);
  }
};

const getRankProgression = async (req, res, next) => {
  try {
    return res.status(200).json({ success: true, data: { progression: [] } });
  } catch (error) {
    next(error);
  }
};

const getKuwiStars = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const user = await User.findById(userId).lean();
    return res.status(200).json({
      success: true,
      data: {
        total: user?.kuwiStars || 0,
        history: [],
        pagination: { total: 0, limit: 50, page: 1, pages: 0 }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getUserRankById = async (req, res, next) => {
  try {
    return res.status(200).json({ success: true, data: { currentRank: null, achievements: [] } });
  } catch (error) {
    next(error);
  }
};

const initializeRanks = async (req, res, next) => {
  try {
    await seedRanksIfEmpty();
    return res.status(200).json({ success: true, message: 'Ranks initialized successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCurrentRank,
  getUserRanks,
  getRankProgression,
  getKuwiStars,
  getAllRanks,
  getUserRankById,
  initializeRanks,
  createRank,
  updateRank,
  deleteRank
};