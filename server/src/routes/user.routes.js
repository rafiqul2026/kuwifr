// server/src/routes/user.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
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
} = require('../controllers/user.controller');
const { auth } = require('../middleware/auth');
const BinaryService = require('../services/binary.service');
const BinaryNode = require('../models/BinaryNode');
const User = require('../models/User');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 } // 3 MB
});

const kycUploadFields = upload.fields([
  { name: 'aadhaarFront', maxCount: 1 },
  { name: 'aadhaarBack', maxCount: 1 },
  { name: 'panCard', maxCount: 1 }
]);

// Handle both 'profileImage' and 'profilePhoto' field names safely
const avatarUpload = (req, res, next) => {
  const singleUpload = upload.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'profileImage', maxCount: 1 }
  ]);

  singleUpload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    // Normalize req.file for controller consumption
    if (req.files) {
      if (req.files.profilePhoto && req.files.profilePhoto[0]) {
        req.file = req.files.profilePhoto[0];
      } else if (req.files.profileImage && req.files.profileImage[0]) {
        req.file = req.files.profileImage[0];
      }
    }
    next();
  });
};

// ============ PUBLIC ROUTES ============
router.get('/verify-sponsor/:referralCode', verifySponsor);
router.get('/verify-sponsor/code/:code', verifySponsor);

// ============ RE-INDEX BINARY ============
router.post('/reindex-binary', async (req, res, next) => {
  try {
    await User.deleteMany({
      $or: [
        { fullName: { $regex: /rofiqul/i } },
        { memberId: { $in: ['KFR843196', 'KFR384461', 'KFR304461'] } }
      ]
    });

    await BinaryNode.deleteMany({});

    const rootUser = await User.findOne({
      $or: [{ memberId: 'KFR665384' }, { sponsorId: null }]
    });

    if (!rootUser) {
      return res.status(404).json({ success: false, message: 'Root account not found' });
    }

    await BinaryNode.create({
      userId: rootUser._id,
      parentId: null,
      position: 'root',
      level: 1,
      leftChildId: null,
      rightChildId: null,
      leftVolume: 0,
      rightVolume: 0,
      availableLeftVolume: 0,
      availableRightVolume: 0,
      matchingVolume: 0,
      pairCount: 0,
      totalKBP: rootUser.totalKBP || 0
    });

    const validDownline = await User.find({
      sponsorId: rootUser._id,
      status: 'ACTIVE'
    }).sort({ createdAt: 1 });

    for (const member of validDownline) {
      await BinaryService.placeMember(member._id, rootUser._id, member.binarySide || 'left');
    }

    rootUser.directReferrals = validDownline.length;
    await rootUser.save();

    res.json({
      success: true,
      message: 'Binary tree rebuilt successfully.'
    });
  } catch (error) {
    next(error);
  }
});

// Protect all remaining routes
router.use(auth);

// ============ SPECIFIC STATIC ROUTES FIRST ============
router.get('/dashboard-stats', getDashboardStats);
router.get('/dashboard', getDashboardStats);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

// Both PUT and POST supported for seamless frontend compatibility
router.post('/profile/photo', avatarUpload, uploadProfilePhoto);
router.put('/profile/photo', avatarUpload, uploadProfilePhoto);

// KYC
router.get('/kyc', getKYCDetails);
router.post('/kyc', kycUploadFields, submitKYC);

// Team & Binary
router.get('/referral-chain', getReferralChain);
router.get('/binary-tree', getBinaryTree);
router.get('/team-stats', getTeamStats);
router.get('/referral-links', getReferralLinks);
router.get('/team', getTeam);
router.get('/team/level/:level', getTeamByLevel);
router.get('/sponsor-stats', getSponsorStats);

// ============ DYNAMIC PARAMETER ROUTE (MUST BE LAST) ============
router.get('/:id', getUserById);

module.exports = router;