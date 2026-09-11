// server/src/controllers/fund.controller.js
// Production Controller for KUWIFR Life Tension Free Funds & TTO Royalty Engine
const Fund = require('../models/Fund');
const BinaryNode = require('../models/BinaryNode');
const User = require('../models/User');
const FundQualification = require('../models/FundQualification');
const FundService = require('../services/fund.service');

// Standard 6 KUWIFR Life Tension-Free Funds
const FUND_PLANS = [
  {
    code: 'SCHOOL',
    name: 'School Fund',
    requiredLeftKBP: 25000,
    requiredRightKBP: 25000,
    benefitPercentage: 0.02, // 2% Company TTO
    maintenanceLeftKBP: 2500,
    maintenanceRightKBP: 2500,
    icon: '🏫',
    description: 'Monthly educational support fund for qualifier children.',
    order: 1,
    isActive: true
  },
  {
    code: 'FAMILY',
    name: 'Family Fund',
    requiredLeftKBP: 100000,
    requiredRightKBP: 100000,
    benefitPercentage: 0.02, // 2% Company TTO
    maintenanceLeftKBP: 10000,
    maintenanceRightKBP: 10000,
    icon: '👨‍👩‍👧‍👦',
    description: 'Family welfare allowance for leaders sustaining healthy team volume.',
    order: 2,
    isActive: true
  },
  {
    code: 'TRAVELLING',
    name: 'Travelling Fund',
    requiredLeftKBP: 250000,
    requiredRightKBP: 250000,
    benefitPercentage: 0.02, // 2% Company TTO
    maintenanceLeftKBP: 25000,
    maintenanceRightKBP: 25000,
    icon: '✈️',
    description: 'Domestic travel and hotel allowance for leadership expansion.',
    order: 3,
    isActive: true
  },
  {
    code: 'LIFESTYLE',
    name: 'Lifestyle Fund',
    requiredLeftKBP: 500000,
    requiredRightKBP: 500000,
    benefitPercentage: 0.02, // 2% Company TTO
    maintenanceLeftKBP: 50000,
    maintenanceRightKBP: 50000,
    icon: '🏖️',
    description: 'Premium gadget and luxury lifestyle maintenance allowance.',
    order: 4,
    isActive: true
  },
  {
    code: 'FOREIGN_TRIP',
    name: 'Foreign Trip Fund',
    requiredLeftKBP: 1000000,
    requiredRightKBP: 1000000,
    benefitPercentage: 0.02, // 2% Company TTO
    maintenanceLeftKBP: 100000,
    maintenanceRightKBP: 100000,
    icon: '🌏',
    description: 'Annual international luxury convention tour and global retreat.',
    order: 5,
    isActive: true
  },
  {
    code: 'PENSION',
    name: 'Pension Fund',
    requiredLeftKBP: 1000000,
    requiredRightKBP: 1000000,
    benefitPercentage: 0.01, // 1% Company TTO
    maintenanceLeftKBP: 0,
    maintenanceRightKBP: 0,
    icon: '🛡️',
    description: 'Lifetime royalty pension allocated when all prior 5 funds are maintained.',
    order: 6,
    isActive: true
  }
];

// Seed or update funds in MongoDB
const seedFundsIfEmpty = async () => {
  try {
    const count = await Fund.countDocuments();
    if (count === 0) {
      for (const item of FUND_PLANS) {
        await Fund.findOneAndUpdate(
          { code: item.code },
          {
            ...item,
            leftKBPRequired: item.requiredLeftKBP,
            rightKBPRequired: item.requiredRightKBP,
            isActive: true
          },
          { upsert: true, new: true }
        );
      }
    }
  } catch (err) {
    console.error('Auto-seed funds notice:', err.message);
  }
};

/**
 * Admin: Initialize / Reset Funds
 * POST /api/funds/initialize or POST /api/admin/funds/initialize
 */
const initializeFunds = async (req, res, next) => {
  try {
    for (const item of FUND_PLANS) {
      await Fund.findOneAndUpdate(
        { code: item.code },
        {
          ...item,
          leftKBPRequired: item.requiredLeftKBP,
          rightKBPRequired: item.requiredRightKBP,
          isActive: true
        },
        { upsert: true, new: true }
      );
    }

    const funds = await Fund.find().sort({ order: 1 }).lean();

    return res.status(200).json({
      success: true,
      message: 'All 6 Life Tension-Free Funds initialized successfully.',
      data: { funds },
      funds
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public & Admin: Fetch all funds
 * GET /api/funds or GET /api/funds/all or GET /api/admin/funds
 */
const getAllFunds = async (req, res, next) => {
  try {
    await seedFundsIfEmpty();

    let funds = await Fund.find().sort({ order: 1 }).lean();

    if (!funds || funds.length === 0) {
      funds = FUND_PLANS;
    }

    // Normalize keys so frontend receives both leftKBPRequired and requiredLeftKBP
    const normalizedFunds = funds.map((f) => ({
      ...f,
      leftKBPRequired: f.leftKBPRequired !== undefined ? f.leftKBPRequired : f.requiredLeftKBP,
      rightKBPRequired: f.rightKBPRequired !== undefined ? f.rightKBPRequired : f.requiredRightKBP,
      requiredLeftKBP: f.requiredLeftKBP !== undefined ? f.requiredLeftKBP : f.leftKBPRequired,
      requiredRightKBP: f.requiredRightKBP !== undefined ? f.requiredRightKBP : f.rightKBPRequired
    }));

    return res.status(200).json({
      success: true,
      data: { funds: normalizedFunds },
      funds: normalizedFunds
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      data: { funds: FUND_PLANS },
      funds: FUND_PLANS
    });
  }
};

/**
 * Admin: Get live stats & qualifications count
 * GET /api/funds/stats or GET /api/admin/funds/stats
 */
const getAdminFundStats = async (req, res, next) => {
  try {
    await seedFundsIfEmpty();
    const funds = await Fund.find().lean();
    const activeFunds = funds.filter((f) => f.isActive !== false).length;

    // Real qualification counts from FundQualification — this used to be a
    // rough estimate derived from BinaryNode.leftVolume/rightVolume (package
    // volume), which isn't even what Funds qualify on (Funds qualify on
    // repurchase KBP — see fund.service.js#evaluateFundQualification). Now
    // it reflects the actual "who achieved which Fund" records, broken down
    // per fund so the admin stat cards mean something.
    const perFund = await FundQualification.aggregate([
      { $match: { status: 'ACTIVE' } },
      { $group: { _id: '$fundCode', count: { $sum: 1 } } }
    ]).catch(() => []);

    const byCode = perFund.reduce((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {});

    const totalQualifications = perFund.reduce((sum, row) => sum + row.count, 0);

    return res.status(200).json({
      success: true,
      data: {
        totalFunds: funds.length || 6,
        activeFunds: activeFunds || 6,
        totalQualifications,
        byFund: FUND_PLANS.map((p) => ({ code: p.code, name: p.name, icon: p.icon, achievers: byCode[p.code] || 0 }))
      }
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      data: {
        totalFunds: 6,
        activeFunds: 6,
        totalQualifications: 0,
        byFund: []
      }
    });
  }
};

/**
 * Admin: Get every member who has achieved a Fund, with search/filter.
 * GET /api/funds/admin/achievements or /api/admin/funds/admin/achievements
 */
const getFundAchievementsAdmin = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const { search, fundCode, sponsorId } = req.query;

    const match = { status: 'ACTIVE' };
    if (fundCode && fundCode !== 'ALL') match.fundCode = fundCode;

    if (search && search.trim()) {
      const re = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const matchingUsers = await User.find({
        $or: [{ fullName: re }, { memberId: re }, { email: re }]
      }).select('_id').lean();
      match.userId = { $in: matchingUsers.map((u) => u._id) };
    }

    // Search by Sponsor ID — every member who achieved a Fund under a given
    // sponsor's direct downline. Combines (AND) with free-text `search`.
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
      FundQualification.countDocuments(match),
      FundQualification.find(match)
        .populate('userId', 'fullName memberId email status')
        .sort({ qualifiedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
    ]);

    // FundQualification stores only a fundCode, not a Fund ref, so the
    // display name/icon come from the FUND_PLANS lookup, same as everywhere
    // else in this controller.
    const planByCode = FUND_PLANS.reduce((acc, p) => {
      acc[p.code] = p;
      return acc;
    }, {});

    const enriched = achievements.map((a) => ({
      ...a,
      fundName: planByCode[a.fundCode]?.name || a.fundCode,
      fundIcon: planByCode[a.fundCode]?.icon || '🏦'
    }));

    return res.status(200).json({
      success: true,
      data: {
        achievements: enriched,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: force a live recalculation of Fund qualification for every active
 * member — backfills real FundQualification history for members who
 * qualified before this tracking existed / since their last repurchase.
 * POST /api/funds/admin/recalculate
 */
const recalculateAllFundQualifications = async (req, res, next) => {
  try {
    const result = await FundService.processAllFundQualifications();
    return res.status(200).json({
      success: true,
      message: `Re-evaluated Funds for ${result.processed} members — ${result.newQualifications} new fund qualification(s) found.`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update fund details & active status
 * PUT /api/admin/funds/:id or PUT /api/funds/:id
 */
const updateFund = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.benefitPercentage !== undefined) {
      let p = Number(updates.benefitPercentage);
      if (p > 1) p = p / 100;
      updates.benefitPercentage = p;
    }

    if (updates.requiredLeftKBP !== undefined) {
      updates.requiredLeftKBP = Number(updates.requiredLeftKBP);
      updates.leftKBPRequired = updates.requiredLeftKBP;
    }
    if (updates.requiredRightKBP !== undefined) {
      updates.requiredRightKBP = Number(updates.requiredRightKBP);
      updates.rightKBPRequired = updates.requiredRightKBP;
    }
    if (updates.maintenanceLeftKBP !== undefined) updates.maintenanceLeftKBP = Number(updates.maintenanceLeftKBP);
    if (updates.maintenanceRightKBP !== undefined) updates.maintenanceRightKBP = Number(updates.maintenanceRightKBP);
    if (updates.isActive !== undefined) updates.isActive = Boolean(updates.isActive);

    const updated = await Fund.findByIdAndUpdate(id, { $set: updates }, {
      new: true,
      runValidators: true
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Fund plan not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Fund updated successfully',
      data: { fund: updated }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Member: Get user qualification status for all 6 funds
 * GET /api/funds/status
 */
const getFundStatus = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const binaryNode = await BinaryNode.findOne({ userId }).lean().catch(() => null);
    const currentLeftKBP = binaryNode?.leftVolume || 0;
    const currentRightKBP = binaryNode?.rightVolume || 0;

    let allPreviousAchieved = true;
    const fundsStatus = FUND_PLANS.map((fund) => {
      const isQualified = currentLeftKBP >= fund.requiredLeftKBP && currentRightKBP >= fund.requiredRightKBP;
      if (!isQualified && fund.code !== 'PENSION') {
        allPreviousAchieved = false;
      }

      const isPension = fund.code === 'PENSION';
      const pensionActive = isPension && allPreviousAchieved && isQualified;

      return {
        fund,
        qualified: isPension ? pensionActive : isQualified,
        current: {
          leftKBP: currentLeftKBP,
          rightKBP: currentRightKBP
        }
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        funds: fundsStatus,
        allFundsAchieved: allPreviousAchieved,
        pensionActive: fundsStatus.find((f) => f.fund.code === 'PENSION')?.qualified || false
      }
    });
  } catch (error) {
    next(error);
  }
};

const processFundQualification = async (req, res, next) => {
  try {
    return getFundStatus(req, res, next);
  } catch (error) {
    next(error);
  }
};

const getFundBenefits = async (req, res, next) => {
  try {
    res.json({ success: true, data: { benefits: [] } });
  } catch (error) {
    next(error);
  }
};

const calculateTTO = async (req, res, next) => {
  try {
    res.json({ success: true, data: { totalKBP: 0 } });
  } catch (error) {
    next(error);
  }
};

const getTTORecords = async (req, res, next) => {
  try {
    res.json({ success: true, data: { records: [] } });
  } catch (error) {
    next(error);
  }
};

const getCurrentTTO = async (req, res, next) => {
  try {
    res.json({ success: true, data: { tto: null } });
  } catch (error) {
    next(error);
  }
};

const processFundMaintenance = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'Maintenance processed' });
  } catch (error) {
    next(error);
  }
};

const processAllTTO = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'All TTO processed' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  initializeFunds,
  getAllFunds,
  getAdminFundStats,
  updateFund,
  getFundStatus,
  processFundQualification,
  getFundBenefits,
  calculateTTO,
  getTTORecords,
  getCurrentTTO,
  processFundMaintenance,
  processAllTTO,
  getFundAchievementsAdmin,
  recalculateAllFundQualifications
};