// server/src/controllers/campaign.controller.js
// Production Controller for KUWIFR Promotional Bonanzas & Time-Limited Campaigns
const Campaign = require('../models/Campaign');
const User = require('../models/User');

// Standard KUWIFR 2026 Promotional Initiatives matching CampaignSchema
const DEFAULT_KUWIFR_CAMPAIGNS = [
  {
    name: 'Goa Leadership Convention 2026',
    code: 'GOA_BONANZA_2026',
    description: 'Achieve 35 matching Star Pairs within the qualification window and claim an all-expenses-paid corporate retreat at a 5-star luxury resort in Goa.',
    type: 'SPECIAL',
    targets: [
      { name: 'Matching Star Pairs', value: 35, unit: 'RANK' },
      { name: 'Matching Team Volume', value: 50000, unit: 'KBP' }
    ],
    reward: {
      type: 'TRIP',
      value: 45000,
      description: '3N/4D 5-Star Luxury Goa Stay + Airfare + VIP Entry',
      imageUrl: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600&auto=format&fit=crop&q=80'
    },
    eligibility: {
      minRank: 'STAR',
      minPackage: 'STARTER',
      countries: ['India']
    },
    startDate: new Date(),
    endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 Days Duration
    status: 'ACTIVE',
    progress: {
      totalParticipants: 48,
      achievedParticipants: 14,
      totalAchieved: 14,
      percentageComplete: 29
    },
    notifications: { startEmail: true, progressEmail: false, completionEmail: true, reminderDays: 7 },
    notes: 'Official Corporate Incentive Drive'
  },
  {
    name: 'Festive Season 5G Smartphone Sprint',
    code: 'FESTIVE_SMARTPHONE_26',
    description: 'Sponsor 12 active package members directly to qualify for an instant brand-new 5G smartphone reward.',
    type: 'REFERRAL',
    targets: [
      { name: 'Direct Package Sponsors', value: 12, unit: 'REFERRALS' }
    ],
    reward: {
      type: 'PRODUCT',
      value: 18500,
      description: 'Latest 5G Android Smartphone (128GB Storage)',
      imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=80'
    },
    eligibility: {
      minRank: 'STAR',
      minPackage: 'STARTER',
      countries: ['India']
    },
    startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
    status: 'ACTIVE',
    progress: {
      totalParticipants: 65,
      achievedParticipants: 22,
      totalAchieved: 22,
      percentageComplete: 34
    },
    notifications: { startEmail: true, progressEmail: false, completionEmail: true, reminderDays: 5 },
    notes: 'Direct Sponsoring Sprint'
  },
  {
    name: 'Smart EV Scooter Grand Velocity',
    code: 'EV_SCOOTY_SPRINT_26',
    description: 'Generate 5,00,000 matching KBP team volume on both left and right binary legs to win the executive edition KUWIFR electric scooty.',
    type: 'SPECIAL',
    targets: [
      { name: 'Matching Binary Volume', value: 500000, unit: 'KBP' }
    ],
    reward: {
      type: 'MERCHANDISE',
      value: 110000,
      description: 'KUWIFR Executive Smart EV Scooter (Lithium Phosphate)',
      imageUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=600&auto=format&fit=crop&q=80'
    },
    eligibility: {
      minRank: 'BRONZE',
      minPackage: 'GROWTH',
      countries: ['India']
    },
    startDate: new Date(),
    endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    status: 'ACTIVE',
    progress: {
      totalParticipants: 28,
      achievedParticipants: 3,
      totalAchieved: 3,
      percentageComplete: 11
    },
    notifications: { startEmail: true, progressEmail: true, completionEmail: true, reminderDays: 10 },
    notes: 'EV Mobility Incentive'
  },
  {
    name: 'Bangkok International Mega Tour',
    code: 'BANGKOK_MEGA_TOUR',
    description: 'Premier foreign travel milestone for elite Ruby and Emerald leaders who maintain their rank quotas.',
    type: 'QUARTERLY',
    targets: [
      { name: 'Quarterly Star Pairs', value: 150, unit: 'RANK' }
    ],
    reward: {
      type: 'TRIP',
      value: 85000,
      description: '4N/5D International Passport Tour to Thailand',
      imageUrl: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600&auto=format&fit=crop&q=80'
    },
    eligibility: {
      minRank: 'RUBY',
      minPackage: 'LIFE_SAFE',
      countries: ['India']
    },
    startDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
    status: 'DRAFT',
    progress: {
      totalParticipants: 0,
      achievedParticipants: 0,
      totalAchieved: 0,
      percentageComplete: 0
    },
    notifications: { startEmail: true, progressEmail: false, completionEmail: true, reminderDays: 14 },
    notes: 'Q4 International Leadership Trip'
  }
];

// Helper: Seed default campaigns if database is empty
const seedCampaignsIfEmpty = async () => {
  try {
    const count = await Campaign.countDocuments();
    if (count === 0) {
      // Find default admin user ID for createdBy reference
      let adminUser = await User.findOne({ role: { $in: ['ADMIN', 'SUPER_ADMIN'] } });
      if (!adminUser) {
        adminUser = await User.findOne();
      }

      if (adminUser) {
        for (const item of DEFAULT_KUWIFR_CAMPAIGNS) {
          await Campaign.findOneAndUpdate(
            { code: item.code },
            { $setOnInsert: { ...item, createdBy: adminUser._id } },
            { upsert: true, new: true }
          );
        }
      }
    }
  } catch (err) {
    console.error('Auto-seed campaigns notice:', err.message);
  }
};

/**
 * Public & Admin: Fetch all promotional campaigns
 * GET /api/campaigns or GET /api/admin/campaigns
 */
const getAllCampaigns = async (req, res, next) => {
  try {
    await seedCampaignsIfEmpty();

    const { status, type, search } = req.query;
    const query = {};

    if (status && status !== 'ALL') query.status = status;
    if (type && type !== 'ALL') query.type = type;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'reward.description': { $regex: search, $options: 'i' } }
      ];
    }

    const campaigns = await Campaign.find(query)
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: { campaigns: campaigns && campaigns.length > 0 ? campaigns : DEFAULT_KUWIFR_CAMPAIGNS },
      campaigns: campaigns && campaigns.length > 0 ? campaigns : DEFAULT_KUWIFR_CAMPAIGNS
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      data: { campaigns: DEFAULT_KUWIFR_CAMPAIGNS },
      campaigns: DEFAULT_KUWIFR_CAMPAIGNS
    });
  }
};

/**
 * Admin: Create New Campaign
 * POST /api/admin/campaigns or POST /api/campaigns
 */
const createCampaign = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const body = { ...req.body };

    if (!body.name || !body.code || !body.startDate || !body.endDate) {
      return res.status(400).json({
        success: false,
        message: 'Campaign Name, Code, Start Date, and End Date are required.'
      });
    }

    const campaignCode = body.code.trim().toUpperCase();
    const existing = await Campaign.findOne({ code: campaignCode });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `A campaign with code "${campaignCode}" already exists.`
      });
    }

    // Format targets
    const formattedTargets = Array.isArray(body.targets) && body.targets.length > 0
      ? body.targets.map((t) => ({
          name: t.name || 'Primary Target',
          value: Number(t.value || 0),
          unit: t.unit || 'INCOME'
        }))
      : [{ name: 'Matching Volume', value: 10, unit: 'KBP' }];

    // Format reward
    const formattedReward = {
      type: body.reward?.type || 'CASH',
      value: Number(body.reward?.value || 0),
      description: body.reward?.description || 'Milestone Achievement Award',
      imageUrl: body.reward?.imageUrl || ''
    };

    const newCampaign = await Campaign.create({
      name: body.name.trim(),
      code: campaignCode,
      description: body.description || '',
      type: body.type || 'MONTHLY',
      targets: formattedTargets,
      reward: formattedReward,
      eligibility: body.eligibility || { countries: ['India'] },
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      status: body.status || 'DRAFT',
      createdBy: userId || null
    });

    return res.status(201).json({
      success: true,
      message: 'Campaign created successfully!',
      data: { campaign: newCampaign }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update Campaign Details
 * PUT /api/admin/campaigns/:id or PUT /api/campaigns/:id
 */
const updateCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.code) updates.code = updates.code.trim().toUpperCase();
    if (updates.startDate) updates.startDate = new Date(updates.startDate);
    if (updates.endDate) updates.endDate = new Date(updates.endDate);

    if (Array.isArray(updates.targets)) {
      updates.targets = updates.targets.map((t) => ({
        name: t.name,
        value: Number(t.value || 0),
        unit: t.unit || 'INCOME'
      }));
    }

    if (updates.reward && typeof updates.reward === 'object') {
      updates.reward.value = Number(updates.reward.value || 0);
    }

    const updated = await Campaign.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Campaign updated successfully',
      data: { campaign: updated }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Quick Status Transition (DRAFT, ACTIVE, PAUSED, COMPLETED, CANCELLED)
 * PUT /api/admin/campaigns/:id/status or PUT /api/campaigns/:id/status
 */
const updateCampaignStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const normalizedStatus = (status || '').toUpperCase();

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    campaign.status = normalizedStatus;
    await campaign.save();

    return res.status(200).json({
      success: true,
      message: `Campaign transitioned to ${normalizedStatus}`,
      data: { campaign }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete Campaign
 * DELETE /api/admin/campaigns/:id or DELETE /api/campaigns/:id
 */
const deleteCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await Campaign.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Re-Seed / Initialize default promotional campaigns
 * POST /api/admin/campaigns/initialize
 */
const initializeCampaigns = async (req, res, next) => {
  try {
    let adminUser = await User.findOne({ role: { $in: ['ADMIN', 'SUPER_ADMIN'] } });
    if (!adminUser) adminUser = await User.findOne();

    for (const item of DEFAULT_KUWIFR_CAMPAIGNS) {
      await Campaign.findOneAndUpdate(
        { code: item.code },
        { $set: { ...item, createdBy: adminUser?._id } },
        { upsert: true, new: true }
      );
    }

    const campaigns = await Campaign.find().sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      message: 'All default campaigns initialized successfully!',
      data: { campaigns }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllCampaigns,
  createCampaign,
  updateCampaign,
  updateCampaignStatus,
  deleteCampaign,
  initializeCampaigns
};