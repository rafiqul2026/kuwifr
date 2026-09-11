// server/src/controllers/rank.controller.js
// Production controller for Kuwi Star Career Path & Rank Milestones
const Rank = require('../models/Rank');
const RankAchievement = require('../models/RankAchievement');
const User = require('../models/User');
const RankService = require('../services/rank.service');

// Helper: Auto-seed standard ranks on first boot.
//
// This used to carry its OWN duplicate 12-tier rank list (names like "Star
// Executive"/"Bronze Leader" with codes like STAR/BRONZE) which do not
// exist in the Rank model's `code` enum (server/src/models/Rank.js only
// allows KUWI_STAR/BRONZE_STAR/SILVER_STAR/...) — every upsert attempt from
// that list would fail Mongoose schema validation, so on an empty
// collection this silently seeded NOTHING, and getAllRanks() fell back to
// returning that same schema-invalid array directly in the API response
// (never persisted, never matching what RankAchievement records could
// actually reference). RankService.initializeRanks() (used everywhere else
// rank data is computed — getCurrentRank, checkAndAwardRanks) already has
// the correct, schema-valid 12-tier list ("Kuwi Star"/"Bronze Star"/...),
// so seeding now delegates to that single source of truth instead of
// duplicating it here.
const seedRanksIfEmpty = async () => {
  try {
    const count = await Rank.countDocuments();
    if (count === 0) {
      await RankService.initializeRanks();
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
    const ranks = await Rank.find().sort({ level: 1 }).lean();

    // Expose each tier's own per-leg requirement (half of that tier's raw
    // starsRequired) alongside starsRequired itself, so the Member Ranks
    // page can show correct progress bars without re-deriving this itself.
    //
    // NOTE: an earlier version of this endpoint computed a CUMULATIVE
    // running sum across every prior tier here (reading the comp plan's
    // "carry forward" language as "stars already used for the previous
    // rank don't count toward this one's total"). That was wrong — a
    // member reported Silver Star's card showing "need 13 on each leg"
    // (the cumulative Bronze+Silver figure) instead of the correct 10,
    // and the comp plan's own per-rank numbers ("Left 10 Stars : Right 10
    // Stars" for Silver Star, etc.) are each already exactly half of that
    // rank's OWN raw starsRequired, confirming thresholds are NOT
    // cumulative. Reverted to the simple per-rank half.
    const ranksWithRequirement = (ranks || []).map((rank) => ({
      ...rank,
      requiredPerLeg: Math.ceil((rank.starsRequired || 0) / 2)
    }));

    return res.status(200).json({
      success: true,
      data: { ranks: ranksWithRequirement },
      ranks: ranksWithRequirement
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      data: { ranks: [] },
      ranks: []
    });
  }
};

/**
 * Member: Get the caller's live rank progress — current stars, current
 * rank, and achieved-ranks history — for the "Ranks & Progression" page.
 * GET /api/ranks/my-ranks
 *
 * Backed by RankService.getUserRanks(), which self-syncs (persists any
 * newly-qualified RankAchievement records) before reading, so this always
 * reflects the true live downline star count rather than a stale counter.
 */
const getMyRanks = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const result = await RankService.getUserRanks(userId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('getMyRanks failed:', error.message);
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
 * Member: Get user's current rank and earned milestones
 * GET /api/ranks/user
 * Kept as an alias of the live my-ranks computation for any older callers.
 */
const getUserRanks = async (req, res, next) => {
  return getMyRanks(req, res, next);
};

/**
 * Member: Get user's current rank badge
 * GET /api/ranks/current
 */
const getCurrentRank = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const rank = await RankService.getCurrentRank(userId);
    return res.status(200).json({
      success: true,
      data: { rank: rank || null }
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
    const userId = req.userId || req.user?.id || req.user?._id;
    const progression = await RankService.getRankProgression(userId);
    return res.status(200).json({ success: true, data: { progression } });
  } catch (error) {
    next(error);
  }
};

const getKuwiStars = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const SalaryService = require('../services/salary.service');
    const { leftStars, rightStars } = await SalaryService.countVerifiedSubtreeStars(userId);
    return res.status(200).json({
      success: true,
      data: {
        total: leftStars + rightStars,
        leftStars,
        rightStars,
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

/**
 * Admin: Live, paginated history of which member achieved which rank on
 * which date — every real RankAchievement record, newest first.
 * GET /api/ranks/admin/achievements
 * Query: page, limit, search (member name/ID/email), rankLevel
 */
const getRankAchievementsAdmin = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const { search, rankLevel, sponsorId } = req.query;

    const match = { status: 'ACHIEVED' };
    if (rankLevel) match.rankLevel = Number(rankLevel);

    if (search && search.trim()) {
      const re = new RegExp(search.trim(), 'i');
      const matchingUsers = await User.find({
        $or: [{ fullName: re }, { memberId: re }, { email: re }]
      }).select('_id').lean();
      match.userId = { $in: matchingUsers.map((u) => u._id) };
    }

    // Search by Sponsor ID — every member who achieved a rank under a given
    // sponsor's direct downline. Combines (AND) with the free-text `search`
    // above if both are supplied.
    if (sponsorId && sponsorId.trim()) {
      const sponsor = await User.findOne({
        memberId: { $regex: new RegExp(`^${sponsorId.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      }).select('_id').lean();

      if (!sponsor) {
        match._id = null;
      } else {
        const sponsees = await User.find({ sponsorId: sponsor._id }).select('_id').lean();
        const sponseeIds = sponsees.map((u) => u._id);
        match.userId = match.userId
          ? { $in: match.userId.$in.filter((id) => sponseeIds.some((s) => s.equals(id))) }
          : { $in: sponseeIds };
      }
    }

    const [total, achievements] = await Promise.all([
      RankAchievement.countDocuments(match),
      RankAchievement.find(match)
        .populate('userId', 'fullName memberId email status')
        .populate('rankId', 'name level icon color')
        .sort({ achievedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
    ]);

    return res.status(200).json({
      success: true,
      data: {
        achievements,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Force a live recalculation of rank achievements for every active
 * member — backfills real RankAchievement history for members who
 * qualified before this tracking existed / before this member last
 * triggered a match or order event.
 * POST /api/ranks/admin/recalculate
 */
const recalculateAllRankAchievements = async (req, res, next) => {
  try {
    const result = await RankService.processAllRanks();
    return res.status(200).json({
      success: true,
      message: `Recalculated ranks for ${result.processed} members — ${result.achievements} newly achieved a rank.`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: move a rank achievement's physical/one-time reward through its
 * fulfillment lifecycle (PENDING -> PROCESSED -> DELIVERED).
 * PUT /api/ranks/admin/achievements/:id/reward
 * Body: { status: 'PENDING' | 'PROCESSED' | 'DELIVERED' | 'NOT_APPLICABLE', notes? }
 */
const updateRewardStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const adminId = req.userId || req.user?.id || req.user?._id;

    if (!status) {
      return res.status(400).json({ success: false, message: 'A target reward status is required.' });
    }

    const achievement = await RankService.updateRewardStatus(id, status, adminId, notes || '');

    return res.status(200).json({
      success: true,
      message: `Reward marked as ${status}.`,
      data: { achievement }
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to update reward status.' });
  }
};

module.exports = {
  getCurrentRank,
  getMyRanks,
  getUserRanks,
  getRankProgression,
  getKuwiStars,
  getAllRanks,
  getUserRankById,
  initializeRanks,
  createRank,
  updateRank,
  deleteRank,
  getRankAchievementsAdmin,
  recalculateAllRankAchievements,
  updateRewardStatus
};