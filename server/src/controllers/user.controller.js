// server/src/controllers/user.controller.js
const User = require('../models/User');
const Referral = require('../models/Referral');
const BinaryNode = require('../models/BinaryNode');
const Fund = require('../models/Fund');
const Wallet = require('../models/Wallet');
const BinaryService = require('../services/binary.service');
const SalaryService = require('../services/salary.service');
const cloudinary = require('../config/cloudinary');

// ============================================================
// 🏆 FUND BENEFIT PLANS DEFINITIONS
// ============================================================
const FUND_PLANS = [
  { code: 'SCHOOL', name: 'School Fund', requiredLeftKBP: 25000, requiredRightKBP: 25000, icon: '🏫' },
  { code: 'FAMILY', name: 'Family Fund', requiredLeftKBP: 100000, requiredRightKBP: 100000, icon: '👨‍👩‍👦' },
  { code: 'TRAVELLING', name: 'Travelling Fund', requiredLeftKBP: 250000, requiredRightKBP: 250000, icon: '✈️' },
  { code: 'LIFESTYLE', name: 'Lifestyle Fund', requiredLeftKBP: 500000, requiredRightKBP: 500000, icon: '🌟' },
  { code: 'FOREIGN_TRIP', name: 'Foreign Trip Fund', requiredLeftKBP: 1000000, requiredRightKBP: 1000000, icon: '🌍' },
  { code: 'PENSION', name: 'Pension Fund', requiredLeftKBP: 1000000, requiredRightKBP: 1000000, icon: '🏦' }
];

/**
 * Helper: Calculate live achieved fund qualifications from binary leg volume
 * @param {String|ObjectId} userId - User ID
 * @returns {Object} Fund achievement summary
 */
const getMemberFundSummary = async (userId) => {
  const binaryNode = await BinaryNode.findOne({ userId }).lean();
  const leftKBP = binaryNode?.leftVolume || 0;
  const rightKBP = binaryNode?.rightVolume || 0;

  let achievedFunds = [];
  let highestFund = null;
  let allPrevious = true;

  for (const fund of FUND_PLANS) {
    const isPension = fund.code === 'PENSION';
    const volumeMatch = leftKBP >= fund.requiredLeftKBP && rightKBP >= fund.requiredRightKBP;

    let qualified = false;
    if (isPension) {
      qualified = allPrevious && volumeMatch;
    } else {
      qualified = volumeMatch;
      if (!qualified) allPrevious = false;
    }

    if (qualified) {
      achievedFunds.push(fund);
      highestFund = fund;
    }
  }

  return {
    currentFundName: highestFund ? highestFund.name : 'Not Achieved',
    currentFundCode: highestFund ? highestFund.code : 'NONE',
    currentFundIcon: highestFund ? highestFund.icon : '🎯',
    totalAchievedCount: achievedFunds.length,
    achievedFunds: achievedFunds.map((f) => ({ name: f.name, code: f.code, icon: f.icon })),
    pensionActive: achievedFunds.some((f) => f.code === 'PENSION'),
    currentLeftKBP: leftKBP,
    currentRightKBP: rightKBP
  };
};

// ============================================================
// 📊 CONSOLIDATED 12-POINT DASHBOARD STATISTICS + SALARY WALLET
// ============================================================
const getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.userId;

    // Start of current day boundary (00:00:00.000)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Run lookups in parallel
    const [user, wallet, binaryNode, fundSummary, salaryProgress] = await Promise.all([
      User.findById(userId)
        .populate({ path: 'sponsorId', select: 'fullName memberId referralCode email' })
        .populate({ path: 'currentRankId', select: 'name code', strictPopulate: false })
        .lean(),
      Wallet.findOne({ userId }).lean(),
      BinaryNode.findOne({ userId }).lean(),
      getMemberFundSummary(userId),
      SalaryService.getLiveSalaryProgress(userId).catch(() => null)
    ]);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Member profile not found' });
    }

    // 1. Direct Referrals Metrics
    const [todayAddMembers, todayActiveMembers, totalDirects] = await Promise.all([
      User.countDocuments({ sponsorId: userId, createdAt: { $gte: todayStart } }),
      User.countDocuments({ sponsorId: userId, status: 'ACTIVE', createdAt: { $gte: todayStart } }),
      User.countDocuments({ sponsorId: userId })
    ]);

    // 2. Downline Network Counts
    const totalTeamCount = await Referral.countDocuments({ sponsorId: userId });

    const teamReferrals = await Referral.find({ sponsorId: userId }).select('userId').lean();
    const teamUserIds = teamReferrals.map((r) => r.userId);

    let totalActiveMembers = 0;
    if (teamUserIds.length > 0) {
      totalActiveMembers = await User.countDocuments({ _id: { $in: teamUserIds }, status: 'ACTIVE' });
    } else {
      totalActiveMembers = await User.countDocuments({ sponsorId: userId, status: 'ACTIVE' });
    }

    // 3. Today's Star/KBP Volume Calculations
    let todayStarLeft = 0;
    let todayStarRight = 0;

    if (binaryNode) {
      if (binaryNode.leftChildId) {
        const leftTodayUser = await User.findOne({
          _id: binaryNode.leftChildId,
          createdAt: { $gte: todayStart }
        })
          .populate('activePackageId')
          .lean();
        if (leftTodayUser?.activePackageId?.kbp) {
          todayStarLeft += leftTodayUser.activePackageId.kbp;
        }
      }
      if (binaryNode.rightChildId) {
        const rightTodayUser = await User.findOne({
          _id: binaryNode.rightChildId,
          createdAt: { $gte: todayStart }
        })
          .populate('activePackageId')
          .lean();
        if (rightTodayUser?.activePackageId?.kbp) {
          todayStarRight += rightTodayUser.activePackageId.kbp;
        }
      }
    }

    const baseUrl = process.env.CLIENT_URL || 'https://www.kuwifr.in';
    const identifier = user.memberId || user.referralCode;

    res.json({
      success: true,
      data: {
        // ROW 1: Financial Overview
        todayIncome: wallet?.todayIncome || 0,
        totalIncome: wallet?.totalIncome || 0,
        totalWithdrawal: wallet?.totalWithdrawn || 0,

        // ROW 2: Member Acquisition
        todayAddMembers,
        todayActiveMembers,
        totalMembers: totalTeamCount > 0 ? totalTeamCount : totalDirects,

        // ROW 3: Active & Star Volume (KBP)
        totalActiveMembers,
        todayStar: {
          left: todayStarLeft,
          right: todayStarRight
        },
        totalStar: {
          left: binaryNode?.leftVolume || 0,
          right: binaryNode?.rightVolume || 0
        },

        // ROW 4: Rank, Fund & Direct Sponsor Info
        currentRank: {
          name: user.currentRankId?.name || (binaryNode && (binaryNode.leftVolume + binaryNode.rightVolume >= 200) ? 'Gold Star' : 'Not Achieved'),
          code: user.currentRankId?.code || 'NONE'
        },
        currentFundAchieved: {
          name: fundSummary.currentFundName,
          icon: fundSummary.currentFundIcon,
          count: fundSummary.totalAchievedCount
        },
        directSponsor: {
          name: user.sponsorId?.fullName || 'Direct Company Root',
          memberId: user.sponsorId?.memberId || user.sponsorId?.referralCode || 'ROOT'
        },

        // SALARY INCOME WALLET (1% TTO from Package Purchases)
        salaryBalance: wallet?.salaryBalance || 0,
        totalSalaryEarned: wallet?.totalSalaryEarned || 0,
        salaryQualification: salaryProgress
          ? {
              isGoldStarRank: salaryProgress.isGoldStarAchieved,
              currentTotalStars: salaryProgress.currentTotalStar,
              has10PercentGrowth: salaryProgress.has10PercentGrowth,
              has5050LegBalance: salaryProgress.has5050Balance,
              isQualifiedThisMonth: salaryProgress.isCurrentlyQualified,
              monthlyTTO: salaryProgress.currentMonthTTO,
              estimatedSalary: salaryProgress.estimatedSalary
            }
          : null,

        // Ancillary Metadata
        walletBalance: wallet?.incomeBalance || 0,
        repurchaseWallet: wallet?.repurchaseBalance || 0,
        userStatus: user.status || 'INACTIVE',
        memberId: user.memberId,
        referralLinks: {
          left: { url: `${baseUrl}/register?ref=${identifier}&side=left`, side: 'left' },
          right: { url: `${baseUrl}/register?ref=${identifier}&side=right`, side: 'right' }
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// 👤 MEMBER PROFILE OPERATIONS
// ============================================================
const getProfile = async (req, res, next) => {
  try {
    let user = await User.findById(req.userId)
      .populate('sponsorId', 'fullName email memberId referralCode')
      .populate('activePackageId', 'name type price');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.memberId) {
      user.memberId = await User.generateMemberId();
      if (!user.referralCode) user.referralCode = user.memberId;
      await user.save();
    }

    const teamStats = await BinaryService.getTeamStats(user._id);
    const binaryNode = await BinaryNode.findOne({ userId: user._id });

    res.json({
      success: true,
      data: {
        user,
        team: teamStats,
        binary: binaryNode || { leftVolume: 0, rightVolume: 0, matchingVolume: 0, pairCount: 0 }
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { fullName, email, phoneNumber, address, bankDetails } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (fullName) user.fullName = fullName;
    if (email) user.email = email.toLowerCase().trim();
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (address) user.address = address;
    if (bankDetails) user.bankDetails = { ...user.bankDetails, ...bankDetails };

    await user.save();
    res.json({ success: true, message: 'Profile updated successfully', data: { user } });
  } catch (error) {
    next(error);
  }
};

const uploadProfilePhoto = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image file uploaded' });
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.profileImage?.publicId) {
      await cloudinary.uploader.destroy(user.profileImage.publicId).catch(() => {});
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'kuwifr/profiles',
          transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }, { quality: 'auto', fetch_format: 'auto' }]
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    user.profileImage = { url: uploadResult.secure_url, publicId: uploadResult.public_id };
    await user.save();

    res.json({ success: true, message: 'Profile photo updated successfully', data: { user } });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// 📑 KYC VERIFICATION ENDPOINTS
// ============================================================
const getKYCDetails = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('kyc fullName email phoneNumber memberId');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({
      success: true,
      data: {
        kyc: user.kyc || {
          status: 'NOT_SUBMITTED',
          panNumber: '',
          aadhaarFront: { url: '' },
          aadhaarBack: { url: '' },
          panCard: { url: '' }
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const submitKYC = async (req, res, next) => {
  try {
    const { panNumber } = req.body;
    const files = req.files;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.kyc?.status === 'VERIFIED') {
      return res.status(400).json({ success: false, message: 'KYC is already verified' });
    }

    if (!files?.aadhaarFront || !files?.aadhaarBack || !files?.panCard) {
      return res.status(400).json({ success: false, message: 'Please upload all required KYC documents' });
    }

    const uploadToCloudinary = (fileBuffer, folderName) => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: `kuwifr/kyc/${folderName}`, transformation: [{ quality: 'auto', fetch_format: 'auto' }] },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        uploadStream.end(fileBuffer);
      });
    };

    const oldDocs = [
      user.kyc?.aadhaarFront?.publicId,
      user.kyc?.aadhaarBack?.publicId,
      user.kyc?.panCard?.publicId
    ];
    for (const publicId of oldDocs) {
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId);
        } catch (err) {
          console.error('Failed to remove old KYC doc:', err.message);
        }
      }
    }

    const [aadhaarFrontRes, aadhaarBackRes, panCardRes] = await Promise.all([
      uploadToCloudinary(files.aadhaarFront[0].buffer, 'aadhaar'),
      uploadToCloudinary(files.aadhaarBack[0].buffer, 'aadhaar'),
      uploadToCloudinary(files.panCard[0].buffer, 'pan')
    ]);

    user.kyc = {
      status: 'PENDING',
      panNumber: (panNumber || user.kyc?.panNumber || '').toUpperCase(),
      aadhaarFront: { url: aadhaarFrontRes.secure_url, publicId: aadhaarFrontRes.public_id },
      aadhaarBack: { url: aadhaarBackRes.secure_url, publicId: aadhaarBackRes.public_id },
      panCard: { url: panCardRes.secure_url, publicId: panCardRes.public_id },
      rejectionReason: '',
      submittedAt: new Date(),
      verifiedAt: null
    };

    await user.save();
    res.json({ success: true, message: 'KYC documents submitted successfully!', data: { kyc: user.kyc } });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// 🔍 GET USER DETAILS BY ID
// ============================================================
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id)
      .select('fullName email phoneNumber memberId referralCode status binarySide activePackageId activationDate createdAt sponsorId')
      .populate('sponsorId', 'fullName memberId referralCode email')
      .populate('activePackageId', 'name type price kbp');

    if (!user) return res.status(404).json({ success: false, message: 'Member not found' });
    const teamStats = await BinaryService.getTeamStats(user._id);

    res.json({ success: true, data: { user, team: teamStats } });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// 🌲 REFERRAL CHAIN & BINARY TREE SERVICES
// ============================================================
const getReferralChain = async (req, res, next) => {
  try {
    const chain = [];
    let currentId = req.userId;
    let level = 0;

    while (currentId && level < 10) {
      const user = await User.findById(currentId).populate('sponsorId', 'fullName email memberId');
      if (!user || !user.sponsorId) break;
      chain.push(user.sponsorId);
      currentId = user.sponsorId._id;
      level++;
    }

    res.json({ success: true, data: { chain } });
  } catch (error) {
    next(error);
  }
};

const getBinaryTree = async (req, res, next) => {
  try {
    const { depth = 5, userId } = req.query;
    const targetUserId = userId || req.userId;
    const tree = await BinaryService.getTree(targetUserId, parseInt(depth, 10), new Set(), req.userId);
    res.json({ success: true, data: { tree } });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// 👥 TEAM DOWNLINE & SPONSOR GENEALOGY STATS
// ============================================================
const getTeamStats = async (req, res, next) => {
  try {
    const userId = req.userId;
    const directCount = await User.countDocuments({ sponsorId: userId });
    const activeDirectCount = await User.countDocuments({ sponsorId: userId, status: 'ACTIVE' });
    const totalTeamCount = await Referral.countDocuments({ sponsorId: userId });
    const binaryNode = await BinaryNode.findOne({ userId });

    res.json({
      success: true,
      data: {
        directReferrals: directCount,
        activeMembers: activeDirectCount,
        totalTeam: totalTeamCount > 0 ? totalTeamCount : directCount,
        levels: directCount > 0 ? 1 : 0,
        totalKBP: binaryNode?.totalKBP || 0,
        leftVolume: binaryNode?.leftVolume || 0,
        rightVolume: binaryNode?.rightVolume || 0,
        matchingVolume: binaryNode?.matchingVolume || 0,
        pairCount: binaryNode?.pairCount || 0
      }
    });
  } catch (error) {
    next(error);
  }
};

const getTeam = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, level } = req.query;
    const userId = req.userId;

    let query = { sponsorId: userId };
    if (level && Number(level) > 0) {
      const levelRefs = await Referral.find({ sponsorId: userId, level: Number(level) }).select('userId');
      const userIds = levelRefs.map((r) => r.userId);
      query = { _id: { $in: userIds } };
    }

    const teamMembers = await User.find(query)
      .select('fullName email phoneNumber status joinedDate memberId referralCode binarySide sponsorId createdAt')
      .populate('activePackageId', 'name type')
      .populate('sponsorId', 'fullName memberId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10))
      .lean();

    const membersWithLevels = await Promise.all(
      teamMembers.map(async (m) => {
        let memberLevel = 1;
        if (String(m.sponsorId?._id) === String(userId)) {
          memberLevel = 1;
        } else {
          const ref = await Referral.findOne({ sponsorId: userId, userId: m._id });
          if (ref) memberLevel = ref.level;
        }
        return { ...m, level: memberLevel };
      })
    );

    const totalDirect = await User.countDocuments({ sponsorId: userId });
    const activeDirect = await User.countDocuments({ sponsorId: userId, status: 'ACTIVE' });

    res.json({
      success: true,
      data: {
        team: membersWithLevels,
        stats: { totalDirect, activeDirect, totalTeam: totalDirect, levels: 1 },
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total: totalDirect,
          pages: Math.ceil(totalDirect / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getTeamByLevel = async (req, res, next) => {
  try {
    const { level } = req.params;
    const userId = req.userId;
    const referrals = await Referral.find({
      sponsorId: userId,
      level: parseInt(level, 10),
      isActive: true
    }).populate('userId', 'fullName email phoneNumber status joinedDate memberId binarySide');

    res.json({
      success: true,
      data: {
        level: parseInt(level, 10),
        count: referrals.length,
        members: referrals.map((r) => r.userId)
      }
    });
  } catch (error) {
    next(error);
  }
};

const getSponsorStats = async (req, res, next) => {
  try {
    const userId = req.userId;
    const levelStats = await Referral.aggregate([
      { $match: { sponsorId: userId } },
      { $group: { _id: '$level', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    const totalTeam = await Referral.countDocuments({ sponsorId: userId });
    const activeTeam = await Referral.countDocuments({ sponsorId: userId, isActive: true });
    const directReferrals = await User.countDocuments({ sponsorId: userId });
    const binaryNode = await BinaryNode.findOne({ userId });

    res.json({
      success: true,
      data: {
        directReferrals,
        totalTeam,
        activeTeam,
        byLevel: levelStats,
        binary: binaryNode
          ? {
              leftVolume: binaryNode.leftVolume,
              rightVolume: binaryNode.rightVolume,
              matchingVolume: binaryNode.matchingVolume,
              pairCount: binaryNode.pairCount,
              totalKBP: binaryNode.totalKBP
            }
          : null
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// 🔗 REFERRAL LINKS & VERIFICATION
// ============================================================
const getReferralLinks = async (req, res, next) => {
  try {
    const userId = req.userId;
    let user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!user.memberId) {
      user.memberId = await User.generateMemberId();
      if (!user.referralCode) user.referralCode = user.memberId;
      await user.save();
    }

    const baseUrl = process.env.CLIENT_URL || 'https://www.kuwifr.in';
    const identifier = user.memberId || user.referralCode;

    res.json({
      success: true,
      data: {
        left: { url: `${baseUrl}/register?ref=${identifier}&side=left`, side: 'left', label: 'Left Side Referral' },
        right: { url: `${baseUrl}/register?ref=${identifier}&side=right`, side: 'right', label: 'Right Side Referral' },
        referralCode: identifier,
        memberId: user.memberId
      }
    });
  } catch (error) {
    next(error);
  }
};

const verifySponsor = async (req, res, next) => {
  try {
    const rawCode = req.params.referralCode || req.params.code || '';
    const cleanCode = rawCode.trim();
    if (!cleanCode) return res.status(400).json({ success: false, message: 'Sponsor Referral Code is required' });

    const sponsor = await User.findOne({
      $or: [
        { memberId: { $regex: new RegExp(`^${cleanCode}$`, 'i') } },
        { referralCode: { $regex: new RegExp(`^${cleanCode}$`, 'i') } },
        { email: cleanCode.toLowerCase() },
        { phoneNumber: cleanCode }
      ]
    }).select('fullName email memberId referralCode status role');

    if (!sponsor) return res.status(404).json({ success: false, message: 'Sponsor not found or inactive' });
    if (['SUSPENDED', 'BLOCKED', 'DEACTIVATED'].includes(sponsor.status)) {
      return res.status(400).json({ success: false, message: 'Sponsor account is inactive' });
    }

    res.json({
      success: true,
      message: 'Sponsor verified successfully',
      data: {
        sponsor: {
          fullName: sponsor.fullName,
          email: sponsor.email,
          memberId: sponsor.memberId || sponsor.referralCode,
          referralCode: sponsor.memberId || sponsor.referralCode,
          status: sponsor.status
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getProfile,
  updateProfile,
  uploadProfilePhoto,
  getKYCDetails,
  submitKYC,
  getUserById,
  getReferralChain,
  getBinaryTree,
  getTeamStats,
  getTeam,
  getTeamByLevel,
  getSponsorStats,
  getReferralLinks,
  verifySponsor
};