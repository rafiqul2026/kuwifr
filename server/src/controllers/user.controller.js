// server/src/controllers/user.controller.js
const mongoose = require('mongoose');
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
// 📊 CONSOLIDATED DASHBOARD STATISTICS + SALARY WALLET
// ============================================================
const getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.userId;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

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

    const [todayAddMembers, todayActiveMembers, totalDirects] = await Promise.all([
      User.countDocuments({ sponsorId: userId, createdAt: { $gte: todayStart } }),
      User.countDocuments({ sponsorId: userId, status: 'ACTIVE', createdAt: { $gte: todayStart } }),
      User.countDocuments({ sponsorId: userId })
    ]);

    const totalTeamCount = await Referral.countDocuments({ sponsorId: userId });
    const teamReferrals = await Referral.find({ sponsorId: userId }).select('userId').lean();
    const teamUserIds = teamReferrals.map((r) => r.userId);

    let totalActiveMembers = 0;
    if (teamUserIds.length > 0) {
      totalActiveMembers = await User.countDocuments({ _id: { $in: teamUserIds }, status: 'ACTIVE' });
    } else {
      totalActiveMembers = await User.countDocuments({ sponsorId: userId, status: 'ACTIVE' });
    }

    let todayStarLeft = 0;
    let todayStarRight = 0;

    if (binaryNode) {
      if (binaryNode.leftChildId) {
        const leftTodayUser = await User.findOne({
          _id: binaryNode.leftChildId,
          createdAt: { $gte: todayStart }
        }).populate('activePackageId').lean();
        if (leftTodayUser?.activePackageId?.kbp) {
          todayStarLeft += leftTodayUser.activePackageId.kbp;
        }
      }
      if (binaryNode.rightChildId) {
        const rightTodayUser = await User.findOne({
          _id: binaryNode.rightChildId,
          createdAt: { $gte: todayStart }
        }).populate('activePackageId').lean();
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
        todayIncome: wallet?.todayIncome || 0,
        totalIncome: wallet?.totalIncome || 0,
        totalWithdrawal: wallet?.totalWithdrawn || 0,
        todayAddMembers,
        todayActiveMembers,
        totalMembers: totalTeamCount > 0 ? totalTeamCount : totalDirects,
        totalActiveMembers,
        todayStar: {
          left: todayStarLeft,
          right: todayStarRight
        },
        totalStar: {
          left: binaryNode?.leftVolume || 0,
          right: binaryNode?.rightVolume || 0
        },
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
// 🌲 UNLIMITED RECURSIVE BINARY TREE WITH AUTOMATIC SPILLOVER
// ============================================================

/**
 * Format a single user document into frontend node schema
 */
const formatNode = async (userDoc) => {
  if (!userDoc) return null;

  let packageName = 'Starter Package';
  if (userDoc.activePackageId) {
    if (typeof userDoc.activePackageId === 'object' && userDoc.activePackageId.name) {
      packageName = userDoc.activePackageId.name;
    } else {
      try {
        const pkg = await require('../models/Package').findById(userDoc.activePackageId).lean();
        if (pkg) packageName = pkg.name || pkg.packageName || packageName;
      } catch (_) {}
    }
  } else if (userDoc.currentPackage) {
    packageName = userDoc.currentPackage;
  }

  const binaryNode = await BinaryNode.findOne({ userId: userDoc._id }).lean();
  const leftVol = binaryNode?.leftVolume || userDoc.leftKbp || 0;
  const rightVol = binaryNode?.rightVolume || userDoc.rightKbp || 0;

  return {
    _id: userDoc._id,
    memberId: userDoc.memberId || userDoc.referralCode || 'KFR_MEMBER',
    fullName: userDoc.fullName || userDoc.name || 'Member',
    status: (userDoc.status || 'ACTIVE').toUpperCase(),
    currentPackage: packageName,
    leftKbp: Number(leftVol),
    rightKbp: Number(rightVol),
    left: null,
    right: null
  };
};

/**
 * Builds a chain of spillover nodes down a specific leg
 * @param {Array} members - Ordered list of members assigned to this side
 * @param {String} side - 'LEFT' or 'RIGHT'
 */
const buildSpilloverChain = async (members, side, visited) => {
  if (!members || members.length === 0) return null;

  const currentMember = members[0];
  if (visited.has(String(currentMember._id))) return null;
  visited.add(String(currentMember._id));

  const node = await formatNode(currentMember);
  const remainingMembers = members.slice(1);

  // Check if currentMember has their own downlines as well
  const ownDirects = await User.find({ sponsorId: currentMember._id }).populate('activePackageId').sort({ createdAt: 1 }).lean();
  const ownOppositeSide = side === 'LEFT' ? 'RIGHT' : 'LEFT';
  const ownOppositeDirects = ownDirects.filter((m) => String(m.binarySide).toUpperCase() === ownOppositeSide);

  if (side === 'LEFT') {
    // Left spillover cascades down the left child slot
    node.left = await buildSpilloverChain(remainingMembers, 'LEFT', visited);
    // Any direct opposite referrals from this member populate their right child
    if (ownOppositeDirects.length > 0) {
      node.right = await buildSpilloverChain(ownOppositeDirects, 'RIGHT', visited);
    }
  } else {
    // Right spillover cascades down the right child slot
    node.right = await buildSpilloverChain(remainingMembers, 'RIGHT', visited);
    // Any direct opposite referrals from this member populate their left child
    if (ownOppositeDirects.length > 0) {
      node.left = await buildSpilloverChain(ownOppositeDirects, 'LEFT', visited);
    }
  }

  return node;
};

/**
 * Controller: GET /api/users/binary-tree
 * Builds complete binary tree with full Left & Right spillover
 */
const getBinaryTree = async (req, res, next) => {
  try {
    const { memberId, userId } = req.query;
    let rootUser = null;

    // 1. Resolve Root Member
    if (memberId && memberId.trim() !== '') {
      rootUser = await User.findOne({
        $or: [
          { memberId: memberId.trim() },
          { referralCode: memberId.trim() }
        ]
      }).populate('activePackageId');
    }

    if (!rootUser && userId && mongoose.isValidObjectId(userId)) {
      rootUser = await User.findById(userId).populate('activePackageId');
    }

    if (!rootUser && req.userId && mongoose.isValidObjectId(req.userId)) {
      rootUser = await User.findById(req.userId).populate('activePackageId');
    }

    if (!rootUser) {
      return res.status(404).json({ success: false, message: 'Member not found in binary tree.' });
    }

    const visited = new Set();
    visited.add(String(rootUser._id));
    const tree = await formatNode(rootUser.toObject());

    // 2. Fetch all direct downlines belonging to Root
    const directReferrals = await User.find({ sponsorId: rootUser._id })
      .populate('activePackageId')
      .sort({ createdAt: 1 })
      .lean();

    // 3. Partition into Left and Right teams
    const leftMembers = directReferrals.filter(
      (m) => String(m.binarySide).toUpperCase() === 'LEFT'
    );
    const rightMembers = directReferrals.filter(
      (m) => String(m.binarySide).toUpperCase() === 'RIGHT'
    );

    // If binarySide was not explicitly saved, balance unassigned members across both sides
    const unassigned = directReferrals.filter(
      (m) => !['LEFT', 'RIGHT'].includes(String(m.binarySide).toUpperCase())
    );
    unassigned.forEach((member, index) => {
      if (leftMembers.length <= rightMembers.length) {
        leftMembers.push(member);
      } else {
        rightMembers.push(member);
      }
    });

    // 4. Build recursive spillover trees
    tree.left = await buildSpilloverChain(leftMembers, 'LEFT', visited);
    tree.right = await buildSpilloverChain(rightMembers, 'RIGHT', visited);

    // 5. Volume and Pairs calculation
    const activeCount = directReferrals.filter((m) => (m.status || '').toUpperCase() === 'ACTIVE').length;
    const binaryNode = await BinaryNode.findOne({ userId: rootUser._id }).lean();

    const calculatedLeftKbp = leftMembers.filter((m) => m.status === 'ACTIVE').length * 1500;
    const calculatedRightKbp = rightMembers.filter((m) => m.status === 'ACTIVE').length * 1500;

    const leftVol = Number(binaryNode?.leftVolume || calculatedLeftKbp);
    const rightVol = Number(binaryNode?.rightVolume || calculatedRightKbp);
    const totalVol = leftVol + rightVol;
    const matchingVol = Math.min(leftVol, rightVol);
    const pairs = Math.floor(matchingVol / 1500);

    // Update root node display metrics
    tree.leftKbp = leftVol;
    tree.rightKbp = rightVol;

    // Sync BinaryNode for root
    await BinaryNode.findOneAndUpdate(
      { userId: rootUser._id },
      {
        $set: {
          leftChildId: leftMembers[0]?._id || null,
          rightChildId: rightMembers[0]?._id || null,
          leftVolume: leftVol,
          rightVolume: rightVol,
          matchingVolume: matchingVol,
          pairCount: pairs,
          totalKBP: totalVol
        }
      },
      { upsert: true }
    );

    return res.json({
      success: true,
      data: {
        root: tree,
        tree: tree,
        summary: {
          totalKbp: totalVol,
          leftKbp: leftVol,
          rightKbp: rightVol,
          matchingVolume: matchingVol,
          totalPairs: pairs
        }
      }
    });
  } catch (error) {
    console.error('Binary Tree Controller Error:', error);
    next(error);
  }
};

// ============================================================
// 👥 TEAM DOWNLINE & SPONSOR GENEALOGY STATS
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