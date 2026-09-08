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

const checkIsKuwiStar = async (userId) => {
  const directActives = await User.find({
    sponsorId: userId,
    status: 'ACTIVE'
  }).populate('activePackageId').lean();

  if (!directActives || directActives.length < 3) return false;

  let leftDirects = 0;
  let rightDirects = 0;
  let totalDirectKbp = 0;

  for (const direct of directActives) {
    const kbp = resolveUserKbp(direct);
    if (kbp > 0) {
      totalDirectKbp += kbp;
      const side = String(direct.binarySide || '').toLowerCase();
      if (side === 'left') leftDirects++;
      else if (side === 'right') rightDirects++;
    }
  }

  const isRatioMet = (leftDirects >= 2 && rightDirects >= 1) || (leftDirects >= 1 && rightDirects >= 2);
  const isVolumeMet = totalDirectKbp >= 3000;

  return isRatioMet && isVolumeMet;
};

const countSubtreeKuwiStars = async (userId, sinceDate = null) => {
  const downlineMembers = await Referral.find({ sponsorId: userId }).select('userId').lean();
  let leftStars = 0;
  let rightStars = 0;

  for (const ref of downlineMembers) {
    const isStar = await checkIsKuwiStar(ref.userId);
    if (isStar) {
      const u = await User.findById(ref.userId).select('binarySide createdAt').lean();
      if (sinceDate && u && new Date(u.createdAt) < sinceDate) continue;
      if (String(u?.binarySide).toLowerCase() === 'left') leftStars++;
      else if (String(u?.binarySide).toLowerCase() === 'right') rightStars++;
    }
  }

  return { leftStars, rightStars, totalStars: leftStars + rightStars };
};

const evaluateMemberRank = async (user) => {
  if (user.currentRankId?.name) {
    return {
      name: user.currentRankId.name,
      code: user.currentRankId.code || 'RANK',
      level: user.currentRankId.level || 1
    };
  }

  const isKuwiStarAchieved = await checkIsKuwiStar(user._id);
  if (!isKuwiStarAchieved) {
    return { name: 'Not Achieved', code: 'NONE', level: 0 };
  }

  const { totalStars: downlineKuwiStars } = await countSubtreeKuwiStars(user._id);

  if (downlineKuwiStars >= 160000) return { name: 'Crown', code: 'CROWN', level: 12 };
  if (downlineKuwiStars >= 75000) return { name: 'Ambassador', code: 'AMBASSADOR', level: 11 };
  if (downlineKuwiStars >= 35000) return { name: 'Sales Director', code: 'SALES_DIRECTOR', level: 10 };
  if (downlineKuwiStars >= 15000) return { name: 'Diamond Star', code: 'DIAMOND_STAR', level: 9 };
  if (downlineKuwiStars >= 7000) return { name: 'Ruby Star', code: 'RUBY_STAR', level: 8 };
  if (downlineKuwiStars >= 2200) return { name: 'Emerald Star', code: 'EMERALD_STAR', level: 7 };
  if (downlineKuwiStars >= 700) return { name: 'Sapphire Star', code: 'SAPPHIRE_STAR', level: 6 };
  if (downlineKuwiStars >= 200) return { name: 'Gold Star', code: 'GOLD_STAR', level: 5 };
  if (downlineKuwiStars >= 70) return { name: 'Platinum Star', code: 'PLATINUM_STAR', level: 4 };
  if (downlineKuwiStars >= 20) return { name: 'Silver Star', code: 'SILVER_STAR', level: 3 };
  if (downlineKuwiStars >= 6) return { name: 'Bronze Star', code: 'BRONZE_STAR', level: 2 };

  return { name: 'Kuwi Star', code: 'KUWI_STAR', level: 1 };
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

    const [todayAddMembers, todayActiveMembers, totalDirects] = await Promise.all([
      User.countDocuments({ sponsorId: userId, createdAt: { $gte: todayStart } }),
      User.countDocuments({ sponsorId: userId, status: 'ACTIVE', createdAt: { $gte: todayStart } }),
      User.countDocuments({ sponsorId: userId })
    ]);

    const totalTeamCount = await Referral.countDocuments({ sponsorId: userId });

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

    const todayStars = await countSubtreeKuwiStars(userId, todayStart);
    const monthlyStars = await countSubtreeKuwiStars(userId, monthStart);
    const lifetimeStars = await countSubtreeKuwiStars(userId, null);

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
        totalMembers: totalTeamCount > 0 ? totalTeamCount : totalDirects,
        totalActiveMembers: await User.countDocuments({ sponsorId: userId, status: 'ACTIVE' }),

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

  const personalKbp = resolveUserKbp(userDoc);

  let sponsorCode = 'ROOT';
  let sponsorFullName = 'Company Direct';
  if (userDoc.sponsorId) {
    if (typeof userDoc.sponsorId === 'object' && userDoc.sponsorId.memberId) {
      sponsorCode = userDoc.sponsorId.memberId;
      sponsorFullName = userDoc.sponsorId.fullName || '';
    } else {
      const sp = await User.findById(userDoc.sponsorId).select('memberId fullName').lean();
      if (sp) {
        sponsorCode = sp.memberId;
        sponsorFullName = sp.fullName || '';
      }
    }
  }

  return {
    _id: userDoc._id,
    memberId: userDoc.memberId || userDoc.referralCode || 'KFR_MEMBER',
    fullName: userDoc.fullName || userDoc.name || 'Member',
    status: (userDoc.status || 'ACTIVE').toUpperCase(),
    currentPackage: packageName,
    personalKbp,
    sponsorId: sponsorCode,
    sponsorName: sponsorFullName,
    email: userDoc.email || '',
    phoneNumber: userDoc.phoneNumber || '',
    joinedDate: userDoc.createdAt || userDoc.joinedDate || new Date(),
    leftKbp: 0,
    rightKbp: 0,
    left: null,
    right: null
  };
};

const buildSpilloverBranch = async (membersList, side, visited) => {
  if (!membersList || membersList.length === 0) return null;

  const currentMember = membersList[0];
  const memberIdStr = String(currentMember._id);

  if (visited.has(memberIdStr)) return null;
  visited.add(memberIdStr);

  const node = await formatNode(currentMember);
  const remainingInChain = membersList.slice(1);

  const ownDirects = await User.find({ sponsorId: currentMember._id })
    .populate('activePackageId')
    .populate('sponsorId', 'memberId fullName')
    .sort({ createdAt: 1 })
    .lean();

  let ownLeft = ownDirects.filter((m) => String(m.binarySide || '').toLowerCase() === 'left');
  let ownRight = ownDirects.filter((m) => String(m.binarySide || '').toLowerCase() === 'right');

  const unassigned = ownDirects.filter(
    (m) => !['left', 'right'].includes(String(m.binarySide || '').toLowerCase())
  );
  unassigned.forEach((m) => {
    if (ownLeft.length <= ownRight.length) ownLeft.push(m);
    else ownRight.push(m);
  });

  if (side === 'LEFT') {
    const nextLeftList = [...remainingInChain, ...ownLeft];
    node.left = await buildSpilloverBranch(nextLeftList, 'LEFT', visited);
    node.right = await buildSpilloverBranch(ownRight, 'RIGHT', visited);
  } else {
    const nextRightList = [...remainingInChain, ...ownRight];
    node.right = await buildSpilloverBranch(nextRightList, 'RIGHT', visited);
    node.left = await buildSpilloverBranch(ownLeft, 'LEFT', visited);
  }

  const leftVol = node.left ? (node.left.personalKbp || 0) + (node.left.leftKbp || 0) + (node.left.rightKbp || 0) : 0;
  const rightVol = node.right ? (node.right.personalKbp || 0) + (node.right.leftKbp || 0) + (node.right.rightKbp || 0) : 0;

  node.leftKbp = leftVol;
  node.rightKbp = rightVol;

  return node;
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
      }).populate('activePackageId').populate('sponsorId', 'memberId fullName');
    }

    if (!rootUser && userId && mongoose.isValidObjectId(userId)) {
      rootUser = await User.findById(userId).populate('activePackageId').populate('sponsorId', 'memberId fullName');
    }

    if (!rootUser && req.userId && mongoose.isValidObjectId(req.userId)) {
      rootUser = await User.findById(req.userId).populate('activePackageId').populate('sponsorId', 'memberId fullName');
    }

    if (!rootUser) {
      return res.status(404).json({ success: false, message: 'Member not found in growth generation tree.' });
    }

    const visited = new Set();
    visited.add(String(rootUser._id));

    const tree = await formatNode(rootUser.toObject());
    tree.isMyNode = true;

    const directReferrals = await User.find({ sponsorId: rootUser._id })
      .populate('activePackageId')
      .populate('sponsorId', 'memberId fullName')
      .sort({ createdAt: 1 })
      .lean();

    const leftMembers = directReferrals.filter((m) => String(m.binarySide || '').toLowerCase() === 'left');
    const rightMembers = directReferrals.filter((m) => String(m.binarySide || '').toLowerCase() === 'right');

    const unassignedMembers = directReferrals.filter(
      (m) => !['left', 'right'].includes(String(m.binarySide || '').toLowerCase())
    );
    unassignedMembers.forEach((m) => {
      if (leftMembers.length <= rightMembers.length) leftMembers.push(m);
      else rightMembers.push(m);
    });

    tree.left = await buildSpilloverBranch(leftMembers, 'LEFT', visited);
    tree.right = await buildSpilloverBranch(rightMembers, 'RIGHT', visited);

    const leftVol = tree.left ? (tree.left.personalKbp || 0) + (tree.left.leftKbp || 0) + (tree.left.rightKbp || 0) : 0;
    const rightVol = tree.right ? (tree.right.personalKbp || 0) + (tree.right.leftKbp || 0) + (tree.right.rightKbp || 0) : 0;
    const totalVol = leftVol + rightVol;
    const matchingVol = Math.min(leftVol, rightVol);

    tree.leftKbp = leftVol;
    tree.rightKbp = rightVol;

    await BinaryNode.findOneAndUpdate(
      { userId: rootUser._id },
      {
        $set: {
          leftChildId: leftMembers[0]?._id || null,
          rightChildId: rightMembers[0]?._id || null,
          leftVolume: leftVol,
          rightVolume: rightVol,
          matchingVolume: matchingVol,
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
        myNodeId: tree.memberId,
        summary: {
          totalKbp: totalVol,
          leftKbp: leftVol,
          rightKbp: rightVol,
          matchingVolume: matchingVol
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
  getSponsorStats,
  getReferralLinks,
  verifySponsor
};