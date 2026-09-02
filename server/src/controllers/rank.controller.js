// server/src/controllers/rank.controller.js
const Rank = require('../models/Rank');
const RankAchievement = require('../models/RankAchievement');
const User = require('../models/User');

const DEFAULT_RANKS = [
  {
    level: 1,
    name: 'Star Executive',
    code: 'STAR',
    starsRequired: 0,
    salaryPercentage: 0,
    reward: 'Recognition Badge',
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
    salaryPercentage: 0.01,
    reward: 'Ruby Ring + ₹25,000 Cash Reward',
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
    salaryPercentage: 0.0075,
    reward: 'Emerald Shield + ₹60,000 Cash Reward',
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
    salaryPercentage: 0.005,
    reward: 'Diamond Trophy + International Trip',
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
    salaryPercentage: 0.004,
    reward: 'Gold Crown + Luxury Car Fund',
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
    salaryPercentage: 0.003,
    reward: 'Royal Trophy + Luxury Villa Fund',
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
    salaryPercentage: 0.0025,
    reward: 'Global Honor Ring + ₹10,00,000',
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
    salaryPercentage: 0.002,
    reward: 'Legend Award + ₹25,00,000',
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
    salaryPercentage: 0.0015,
    reward: 'Emperor Royal Crest + ₹50,00,000',
    color: '#eab308',
    icon: '🦁',
    benefits: ['0.15% Monthly TTO Royalty', 'Company Lifetime Dividend'],
    isActive: true
  }
];

const seedRanksIfEmpty = async () => {
  try {
    const count = await Rank.countDocuments();
    if (count === 0) {
      for (const r of DEFAULT_RANKS) {
        await Rank.findOneAndUpdate({ code: r.code }, { ...r, isActive: true }, { upsert: true, new: true });
      }
    }
  } catch (err) {
    console.error('Error seeding ranks:', err.message);
  }
};

const getAllRanks = async (req, res, next) => {
  try {
    await seedRanksIfEmpty();
    let ranks = await Rank.find({ isActive: true }).sort({ level: 1 }).lean();
    if (!ranks || ranks.length === 0) {
      ranks = DEFAULT_RANKS;
    }
    return res.json({
      success: true,
      data: { ranks }
    });
  } catch (error) {
    return res.json({
      success: true,
      data: { ranks: DEFAULT_RANKS }
    });
  }
};

const getUserRanks = async (req, res, next) => {
  try {
    const userId = req.userId;
    await seedRanksIfEmpty();

    let achievements = [];
    try {
      achievements = await RankAchievement.find({ userId, status: 'ACHIEVED' }).populate('rankId').lean();
    } catch {
      achievements = [];
    }

    const user = await User.findById(userId).lean();
    const currentRank = achievements.length > 0 ? achievements[achievements.length - 1].rankId : null;

    return res.json({
      success: true,
      data: {
        current: currentRank,
        currentStars: user?.kuwiStars || 0,
        totalRanks: achievements.length,
        achievements: achievements || []
      }
    });
  } catch (error) {
    console.error('Error in getUserRanks:', error.message);
    return res.json({
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

const getCurrentRank = async (req, res, next) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).populate('currentRankId').lean();
    return res.json({
      success: true,
      data: { rank: user?.currentRankId || null }
    });
  } catch (error) {
    next(error);
  }
};

const getRankProgression = async (req, res, next) => {
  try {
    return res.json({
      success: true,
      data: { progression: [] }
    });
  } catch (error) {
    next(error);
  }
};

const getKuwiStars = async (req, res, next) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).lean();
    return res.json({
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
    return res.json({
      success: true,
      data: { currentRank: null, achievements: [] }
    });
  } catch (error) {
    next(error);
  }
};

const initializeRanks = async (req, res, next) => {
  try {
    await seedRanksIfEmpty();
    return res.json({ success: true, message: 'Ranks initialized successfully' });
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
  initializeRanks
};