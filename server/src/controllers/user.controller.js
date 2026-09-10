// server/src/controllers/user.controller.js
const mongoose = require('mongoose');
const User = require('../models/User');
const Referral = require('../models/Referral');
const BinaryNode = require('../models/BinaryNode');
const Fund = require('../models/Fund');
const Wallet = require('../models/Wallet');
const Package = require('../models/Package');
const BinaryService = require('../services/binary.service');
const SalaryService = require('../services/salary.service');
const DownlineService = require('../services/downline.service');
const cloudinary = require('../config/cloudinary');

// ============================================================
// 📦 5-TIER OFFICIAL PACKAGE KBP RESOLUTION
// ============================================================
const resolveUserKbp = (userDoc) => {
  if (!userDoc || (userDoc.status || '').toUpperCase() !== 'ACTIVE') return 0;

  if (userDoc.activePackageId && typeof userDoc.activePackageId === 'object') {
    if (typeof userDoc.activePackageId.kbp === 'number' && userDoc.activePackageId.kbp > 0) {
      return userDoc.activePackageId.kbp;
    }
  }

  const pkgName = (userDoc.activePackageId?.name || userDoc.currentPackage || '').toUpperCase();
  if (pkgName.includes('TITANIUM')) return 50000;
  if (pkgName.includes('ELITE')) return 10000;
  if (pkgName.includes('LIFESAFE') || pkgName.includes('LIFE SAFE')) return 7500;
  if (pkgName.includes('GROWTH')) return 5000;
  if (pkgName.includes('STARTER')) return 1000;
  return 1000;
};

// NOTE: Rank/Kuwi-Star qualification used to be reimplemented here from scratch
// (checkIsKuwiStar/evaluateMemberRank), completely independently of RankService
// (which owns RankAchievement persistence, dynamic Rank.kuwiStarRequirements,
// and rank-salary crediting). The two could disagree — the dashboard could show
// a different rank than the one actually on file — which is a real correctness
// bug for a compensation platform. RankService is now the single source of
// truth; this file only decorates its output for display (left/right counts).
const RankService = require('../services/rank.service');
const RankAchievement = require('../models/RankAchievement');

/**
 * Count how many downline members (any depth, computed authoritatively via
 * DownlineService — see that file for why this used to read the incomplete
 * `Referral` collection instead) hold the Kuwi Star rank achievement, split
 * by which leg (left/right) they sit under, optionally restricted to
 * achievements recorded on/after `sinceDate`. Uses the persisted
 * RankAchievement.createdAt (when the rank was actually achieved) rather
 * than the member's join date — counting by join date would misreport
 * "today's/this month's" Kuwi Star achievers.
 *
 * Takes the already-fetched full-downline id list (rather than re-running
 * the $graphLookup aggregation on every call) since getDashboardStats calls
 * this three times (today/month/lifetime) for the same member.
 */
const countSubtreeKuwiStars = async (downlineIds, sinceDate = null) => {
  if (!downlineIds || downlineIds.length === 0) return { leftStars: 0, rightStars: 0, totalStars: 0 };

  const achievementQuery = { userId: { $in: downlineIds }, rankName: 'Kuwi Star', status: 'ACHIEVED' };
  if (sinceDate) achievementQuery.createdAt = { $gte: sinceDate };

  const achievements = await RankAchievement.find(achievementQuery).select('userId').lean();
  if (achievements.length === 0) return { leftStars: 0, rightStars: 0, totalStars: 0 };

  const achieverIds = achievements.map((a) => a.userId);
  const achievers = await User.find({ _id: { $in: achieverIds } }).select('binarySide').lean();

  let leftStars = 0;
  let rightStars = 0;
  for (const u of achievers) {
    const side = String(u.binarySide || '').toLowerCase();
    if (side === 'left') leftStars++;
    else if (side === 'right') rightStars++;
  }

  return { leftStars, rightStars, totalStars: leftStars + rightStars };
};

/** Delegates to RankService — the persisted, official rank for this user. */
const evaluateMemberRank = async (user) => {
  const rank = await RankService.getCurrentRank(user._id);
  if (!rank) return { name: 'Not Achieved', code: 'NONE', level: 0 };
  return { name: rank.name, code: rank.code || 'RANK', level: rank.level || 1 };
};

const getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.userId;
    const now = new Date();

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const dayOfWeek = now.getDay();
    const diffToMonday = (dayOfWeek + 6) % 7;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diffToMonday);
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const [user, wallet, binaryNode, fundSummary, salaryProgress] = await Promise.all([
      User.findById(userId)
        .populate({ path: 'sponsorId', select: 'fullName memberId referralCode email' })
        .populate({ path: 'currentRankId', select: 'name code level', strictPopulate: false })
        .lean(),
      Wallet.findOne({ userId }).lean(),
      BinaryNode.findOne({ userId }).lean(),
      getMemberFundSummary(userId),
      SalaryService.getLiveSalaryProgress(userId).catch(() => null)
    ]);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Member profile not found' });
    }

    const [todayAddMembers, todayActiveMembers, totalDirects, fullDownline] = await Promise.all([
      User.countDocuments({ sponsorId: userId, createdAt: { $gte: todayStart } }),
      User.countDocuments({ sponsorId: userId, status: 'ACTIVE', createdAt: { $gte: todayStart } }),
      User.countDocuments({ sponsorId: userId }),
      // Full downline (any depth), computed authoritatively from User.sponsorId
      // via DownlineService instead of the incomplete Referral collection —
      // see downline.service.js. This one fetch backs totalMembers,
      // totalActiveMembers ("Full Downline Network" / "Network Wide Active"),
      // and all three Star cards below, so a member with a large real
      // downline no longer shows a handful of direct-only numbers.
      DownlineService.getFullDownline(userId)
    ]);

    const totalTeamCount = Math.max(fullDownline.length, totalDirects);
    const totalActiveTeamCount = fullDownline.filter((m) => String(m.status).toUpperCase() === 'ACTIVE').length;
    const downlineIds = fullDownline.map((m) => m._id);

    const totalKbpLeft = Number(binaryNode?.leftVolume || 0);
    const totalKbpRight = Number(binaryNode?.rightVolume || 0);
    const totalKbpMatch = Number(binaryNode?.matchingVolume || Math.min(totalKbpLeft, totalKbpRight));

    const directs = await User.find({ sponsorId: userId }).populate('activePackageId').lean();
    const leftDirects = directs.filter((d) => String(d.binarySide || '').toLowerCase() === 'left');
    const rightDirects = directs.filter((d) => String(d.binarySide || '').toLowerCase() === 'right');

    const sumKbpSince = (members, startDate) => {
      return members
        .filter((m) => new Date(m.createdAt) >= startDate && m.status === 'ACTIVE')
        .reduce((sum, m) => sum + resolveUserKbp(m), 0);
    };

    const todayLeftBusiness = sumKbpSince(leftDirects, todayStart);
    const todayRightBusiness = sumKbpSince(rightDirects, todayStart);

    const weeklyLeftKbp = sumKbpSince(leftDirects, weekStart);
    const weeklyRightKbp = sumKbpSince(rightDirects, weekStart);
    const weeklyTotalKbp = weeklyLeftKbp + weeklyRightKbp;
    const weeklyKbpMatch = Math.min(weeklyLeftKbp, weeklyRightKbp);

    const todayStars = await countSubtreeKuwiStars(downlineIds, todayStart);
    const monthlyStars = await countSubtreeKuwiStars(downlineIds, monthStart);
    const lifetimeStars = await countSubtreeKuwiStars(downlineIds, null);

    const evaluatedRank = await evaluateMemberRank(user);

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
        totalMembers: totalTeamCount,
        totalActiveMembers: totalActiveTeamCount,

        todayLeftBusiness,
        todayRightBusiness,
        weeklyKbp: {
          total: weeklyTotalKbp,
          left: weeklyLeftKbp,
          right: weeklyRightKbp
        },
        weeklyKbpMatch,
        totalKbpMatch,

        todayStar: {
          left: todayStars.leftStars,
          right: todayStars.rightStars
        },
        monthlyStar: {
          left: monthlyStars.leftStars,
          right: monthlyStars.rightStars
        },
        totalStar: {
          left: lifetimeStars.leftStars,
          right: lifetimeStars.rightStars
        },

        currentRank: {
          name: evaluatedRank.name,
          code: evaluatedRank.code,
          level: evaluatedRank.level
        },
        currentFundAchieved: {
          name: fundSummary.currentFundName,
          icon: fundSummary.currentFundIcon,
          count: fundSummary.totalAchievedCount
        },

        salaryBalance: wallet?.salaryBalance || 0,
        totalSalaryEarned: wallet?.totalSalaryEarned || 0,
        salaryQualification: salaryProgress,
        walletBalance: wallet?.incomeBalance || 0,
        repurchaseWallet: wallet?.repurchaseBalance || 0,
        userStatus: user.status || 'INACTIVE',
        memberId: user.memberId,
        referralLinks: {
          left: { url: `${baseUrl}/register?ref=${identifier}&pos=L&side=left`, side: 'left' },
          right: { url: `${baseUrl}/register?ref=${identifier}&pos=R&side=right`, side: 'right' }
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// NOTE: This endpoint used to rebuild the whole tree from scratch on every
// request by walking User.sponsorId + binarySide with its own ad-hoc
// "spillover" algorithm (formatNode/buildSpilloverBranch, removed), which is
// NOT how members are actually placed at registration (see
// binary.service.js placeMember, which uses BinaryNode.parentId /
// leftChildId / rightChildId — the extreme-leg spillover placement engine
// that matching income is actually calculated against). Worse, it then
// WROTE its own recomputed leftChildId/rightChildId/leftVolume/rightVolume
// back onto the ROOT's BinaryNode document — so simply opening the Growth
// Generation page could silently corrupt the tree structure that income
// calculations depend on. The Growth Generation tree must show the SAME
// tree BinaryService uses for matching income, and a read-only "view my
// tree" request must never mutate placement data. This now delegates to
// BinaryService.getTree (the authoritative source) and only *formats* the
// result for display.
const toDisplayNode = (node, isRoot = false) => {
  if (!node) return null;

  const leftChild = (node.children || []).find((c) => c.position === 'left') || null;
  const rightChild = (node.children || []).find((c) => c.position === 'right') || null;

  return {
    _id: node.userId,
    userId: node.userId,
    memberId: node.memberId,
    fullName: node.fullName,
    email: node.email,
    status: node.status,
    currentPackage: node.packageName,
    personalKbp: node.personalKbp || 0,
    sponsorId: node.sponsorId,
    sponsorName: node.sponsorName || '',
    side: node.side,
    binaryLevel: node.binaryLevel,
    leftKbp: node.leftVolume || 0,
    rightKbp: node.rightVolume || 0,
    matchingVolume: node.matchingVolume || 0,
    pairCount: node.pairCount || 0,
    totalKBP: node.totalKBP || 0,
    isMyNode: isRoot,
    // A real child exists below but wasn't fetched at this response's depth
    // limit — the UI should offer "view more" here, not draw an empty slot.
    hasMoreLeft: !leftChild && Boolean(node.hasMoreLeft),
    hasMoreRight: !rightChild && Boolean(node.hasMoreRight),
    left: toDisplayNode(leftChild),
    right: toDisplayNode(rightChild)
  };
};

const getBinaryTree = async (req, res, next) => {
  try {
    const { memberId, userId } = req.query;
    let rootUser = null;

    if (memberId && memberId.trim() !== '') {
      rootUser = await User.findOne({
        $or: [
          { memberId: memberId.trim().toUpperCase() },
          { referralCode: memberId.trim().toUpperCase() }
        ]
      });
    }

    if (!rootUser && userId && mongoose.isValidObjectId(userId)) {
      rootUser = await User.findById(userId);
    }

    if (!rootUser && req.userId && mongoose.isValidObjectId(req.userId)) {
      rootUser = await User.findById(req.userId);
    }

    if (!rootUser) {
      return res.status(404).json({ success: false, message: 'Member not found in growth generation tree.' });
    }

    // Cap the requested depth: the frontend re-roots on node click to walk
    // deeper (unlimited overall depth via that navigation), so one response
    // only needs a handful of generations to stay fast and lightweight.
    const requestedDepth = parseInt(req.query.depth, 10);
    const depth = Number.isFinite(requestedDepth) ? Math.min(Math.max(requestedDepth, 2), 10) : 6;

    const rawTree = await BinaryService.getTree(rootUser._id, depth);
    if (!rawTree) {
      return res.status(404).json({ success: false, message: 'This member has no binary tree placement yet.' });
    }

    const tree = toDisplayNode(rawTree, true);

    // Member Left / Member Right in the legend row must be the REAL,
    // unlimited-depth subtree size — not a count of whatever happened to be
    // fetched at this response's depth limit (the tree itself is capped at
    // `depth` generations for payload size, so counting only what's in
    // `tree.left`/`tree.right` would under-report a member with a deeper
    // downline than that cap, exactly like the reported "showing 19/17 but
    // the real total is bigger" issue). getBranchCounts walks the full,
    // unlimited-depth subtree via the same leftChildId/rightChildId
    // pointers this tree is built from, so this number is always the true
    // total regardless of how deep the visible tree was fetched.
    const branchCounts = await BinaryService.getBranchCounts(rootUser._id);

    return res.json({
      success: true,
      data: {
        root: tree,
        tree,
        myNodeId: tree.memberId,
        summary: {
          totalKbp: tree.totalKBP,
          leftKbp: tree.leftKbp,
          rightKbp: tree.rightKbp,
          matchingVolume: tree.matchingVolume,
          leftCount: branchCounts.leftCount,
          rightCount: branchCounts.rightCount
        }
      }
    });
  } catch (error) {
    console.error('Growth Generation Tree Controller Error:', error);
    next(error);
  }
};

const FUND_PLANS = [
  { code: 'SCHOOL', name: 'School Fund', requiredLeftKBP: 25000, requiredRightKBP: 25000, icon: '🏫' },
  { code: 'FAMILY', name: 'Family Fund', requiredLeftKBP: 100000, requiredRightKBP: 100000, icon: '👨‍👩‍👦' },
  { code: 'TRAVELLING', name: 'Travelling Fund', requiredLeftKBP: 250000, requiredRightKBP: 250000, icon: '✈️' },
  { code: 'LIFESTYLE', name: 'Lifestyle Fund', requiredLeftKBP: 500000, requiredRightKBP: 500000, icon: '🌟' },
  { code: 'FOREIGN_TRIP', name: 'Foreign Trip Fund', requiredLeftKBP: 1000000, requiredRightKBP: 1000000, icon: '🌍' },
  { code: 'PENSION', name: 'Pension Fund', requiredLeftKBP: 1000000, requiredRightKBP: 1000000, icon: '🏦' }
];

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

const getProfile = async (req, res, next) => {
  try {
    let user = await User.findById(req.userId)
      .populate('sponsorId', 'fullName email memberId referralCode')
      .populate('activePackageId', 'name type price kbp');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

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

    const cleanPan = panNumber ? panNumber.toUpperCase().trim() : '';
    if (cleanPan) {
      // 🌟 Enforce 1 PAN per member ID across the entire system
      const existingPanUser = await User.findOne({
        'kyc.panNumber': cleanPan,
        _id: { $ne: user._id }
      });

      if (existingPanUser) {
        return res.status(400).json({
          success: false,
          message: `This PAN card is already registered and verified with another Member ID (${existingPanUser.memberId}). One PAN can only be used for one account.`
        });
      }
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
      panNumber: cleanPan || user.kyc?.panNumber || '',
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
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate constraint conflict: This PAN card is already registered with another member ID.'
      });
    }
    next(error);
  }
};

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
    // Authoritative full-downline count (any depth) via DownlineService —
    // see downline.service.js for why this replaced Referral.countDocuments,
    // which was a best-effort derived mirror that could silently under-count.
    const fullDownline = await DownlineService.getFullDownline(userId);
    const totalTeamCount = Math.max(fullDownline.length, directCount);
    const binaryNode = await BinaryNode.findOne({ userId });

    res.json({
      success: true,
      data: {
        directReferrals: directCount,
        activeMembers: activeDirectCount,
        totalTeam: totalTeamCount,
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
      .populate('activePackageId', 'name type price kbp')
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

// Human-readable label for each unilevel generation, matching the naming the
// member-facing "My Team" page uses. Business rule (stated explicitly by the
// product owner): "Direct Referral" and "First Level" are the same thing —
// a member's own direct sponsees ARE their first level, so that generation
// is now labeled "First Level Member", and every deeper generation shifts
// its ordinal accordingly (their referrals' referrals = "Second Level
// Member", and so on). This spans the full 10-generation cap this platform
// tracks (matches the 10-level repurchase compensation plan already
// configurable in Admin Settings), so "Tenth Level Member" is genuinely the
// deepest generation shown.
const GENERATION_ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
const generationLabel = (level) => {
  const word = GENERATION_ORDINALS[level - 1] || `${level}th`;
  return `${word} Level Member`;
};

// Full unilevel (sponsor-chain) genealogy for the requesting member, grouped
// generation by generation (First Level Member, Second Level Member, ... up
// to the 10-level cap), each member carrying enough detail for the "My
// Team" page to render a clean card row AND a "View" basic-details popup
// without a second round-trip per member.
//
// NOTE: this is the sponsor/unilevel genealogy (who referred whom), which is
// a separate data source from the binary placement tree used by the Growth
// Generation page (BinaryNode: parentId/leftChildId/rightChildId) — see the
// long comment in binary.service.js#repairAllPlacements for why those two
// can, in rare corrupted-data cases, disagree. "Position" below is each
// member's own binarySide (which leg of their immediate parent they were
// placed on), not a statement about the binary tree's overall shape.
//
// EVERY generation here — not just level 1 — is now computed authoritatively
// from the live User.sponsorId graph via DownlineService (a single
// $graphLookup query), instead of the derived `Referral` collection.
// Referral is a best-effort mirror written once at registration inside a
// try/catch that can silently fail (see referral.service.js), and that gap
// was observed doing real damage in practice: for a member with a genuinely
// large, deep downline (confirmed populated in the Growth Generation binary
// tree), every generation below Direct Referral showed "0 Members" here.
// $graphLookup reads straight from User.sponsorId, which is always correct
// (Mongoose requires it to save a user at all), so there is no separate,
// driftable collection left in this path and no repair step is needed for
// this page ever again.
const memberToRow = (member, level) => ({
  _id: member._id,
  fullName: member.fullName,
  email: member.email,
  phoneNumber: member.phoneNumber,
  memberId: member.memberId || member.referralCode,
  status: member.status,
  position: member.binarySide === 'right' ? 'R' : 'L',
  positionLabel: member.binarySide === 'right' ? 'Right' : 'Left',
  packageName: member.activePackageId?.name || member.currentPackage || 'No Active Package',
  packagePrice: member.activePackageId?.price || 0,
  kbp: member.activePackageId?.kbp || 0,
  activationDate: member.activationDate || null,
  joinedDate: member.createdAt,
  sponsorMemberId: member.sponsorId?.memberId || member.sponsorId?.referralCode || '-',
  sponsorName: member.sponsorId?.fullName || '-',
  level
});

// Resolves each raw $graphLookup downline entry's activePackageId (an
// ObjectId, since $graphLookup can't populate refs) and sponsorId (also a
// bare ObjectId — either the root themselves, or another member already
// inside this same downline set) into the small display objects
// memberToRow expects, using in-memory maps built from a couple of cheap
// follow-up queries instead of one populate per member.
const buildGenerationGroups = async (userId) => {
  const rawDownline = await DownlineService.getFullDownline(userId);

  const MAX_LEVEL = DownlineService.MAX_LEVEL;
  if (rawDownline.length === 0) {
    const levels = [];
    for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) {
      levels.push({ level: lvl, label: generationLabel(lvl), count: 0, members: [] });
    }
    return { levels, totalTeam: 0, directCount: 0 };
  }

  const packageIds = [...new Set(rawDownline.filter((m) => m.activePackageId).map((m) => String(m.activePackageId)))];
  const packages = packageIds.length
    ? await Package.find({ _id: { $in: packageIds } }).select('name type price kbp').lean()
    : [];
  const packageMap = new Map(packages.map((p) => [String(p._id), p]));

  const rootUser = await User.findById(userId).select('fullName memberId referralCode').lean();
  const memberMap = new Map(rawDownline.map((m) => [String(m._id), m]));

  const resolveSponsor = (sponsorId) => {
    if (!sponsorId) return null;
    const key = String(sponsorId);
    if (rootUser && key === String(rootUser._id || userId)) return rootUser;
    const m = memberMap.get(key);
    return m ? { fullName: m.fullName, memberId: m.memberId, referralCode: m.referralCode } : null;
  };

  const grouped = {};
  for (const member of rawDownline) {
    const level = (member.depth || 0) + 1;
    const pkg = member.activePackageId ? packageMap.get(String(member.activePackageId)) : null;
    const row = memberToRow(
      { ...member, activePackageId: pkg || null, sponsorId: resolveSponsor(member.sponsorId) },
      level
    );
    if (!grouped[level]) grouped[level] = [];
    grouped[level].push(row);
  }

  for (const lvl of Object.keys(grouped)) {
    grouped[lvl].sort((a, b) => new Date(a.joinedDate) - new Date(b.joinedDate));
  }

  const levels = [];
  for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) {
    levels.push({
      level: lvl,
      label: generationLabel(lvl),
      count: (grouped[lvl] || []).length,
      members: grouped[lvl] || []
    });
  }

  const totalTeam = levels.reduce((sum, lvl) => sum + lvl.count, 0);
  const directCount = (grouped[1] || []).length;

  return { levels, totalTeam, directCount };
};

const getTeamByGeneration = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { levels, totalTeam, directCount } = await buildGenerationGroups(userId);

    return res.json({
      success: true,
      data: { levels, totalTeam, directCount }
    });
  } catch (error) {
    next(error);
  }
};

const getSponsorStats = async (req, res, next) => {
  try {
    const userId = req.userId;
    // Authoritative full-downline (any depth), via DownlineService instead
    // of the Referral collection — see downline.service.js. Used by the
    // Income page's team-size/level breakdown, which had the same
    // under-counting exposure as "My Team" and the dashboard.
    const fullDownline = await DownlineService.getFullDownline(userId);
    const levelCounts = new Map();
    for (const m of fullDownline) {
      const level = (m.depth || 0) + 1;
      levelCounts.set(level, (levelCounts.get(level) || 0) + 1);
    }
    const levelStats = Array.from(levelCounts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([_id, count]) => ({ _id, count }));

    const directReferrals = await User.countDocuments({ sponsorId: userId });
    const totalTeam = Math.max(fullDownline.length, directReferrals);
    const activeTeam = fullDownline.filter((m) => String(m.status).toUpperCase() === 'ACTIVE').length;
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
        left: {
          url: `${baseUrl}/register?ref=${identifier}&pos=L&side=left`,
          side: 'left',
          label: 'Left Side Referral'
        },
        right: {
          url: `${baseUrl}/register?ref=${identifier}&pos=R&side=right`,
          side: 'right',
          label: 'Right Side Referral'
        },
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
  getTeamByGeneration,
  getSponsorStats,
  getReferralLinks,
  verifySponsor
};