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
  getTeamByGeneration,
  getSponsorStats,
  getReferralLinks,
  verifySponsor
} = require('../controllers/user.controller');
const { auth } = require('../middleware/auth');

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

// ============================================================
// The route that used to live here (`POST /reindex-binary`) was a leftover
// dev/debug endpoint with NO authentication that:
//   1. Deleted specific hardcoded test users by name/memberId
//   2. Wiped the ENTIRE BinaryNode collection for every user in the system
//      (BinaryNode.deleteMany({}))
//   3. Only rebuilt ONE hardcoded root member's immediate direct downline
// Anyone — a stray request, a bot, a browser prefetch, a dev testing
// locally — hitting this endpoint would silently destroy every member's
// binary tree placement except that one hardcoded account, while leaving
// User/Referral (sponsor) records completely untouched. That mismatch is
// exactly what produces a member whose "My Team" page correctly shows
// their direct referrals but whose Growth Generation tree shows nothing
// but "Open Spot" — the BinaryNode link is gone even though the
// underlying relationship still exists.
//
// It has been removed outright and replaced by the safe, admin-only,
// NON-destructive repair endpoint below (see also
// BinaryService.repairAllPlacements). That endpoint never deletes
// anything — it only fills in BinaryNode placement for members who are
// missing it, for every user, in registration order.
// ============================================================

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
router.get('/team/by-generation', getTeamByGeneration);
router.get('/team/level/:level', getTeamByLevel);
router.get('/sponsor-stats', getSponsorStats);

// ============ DYNAMIC PARAMETER ROUTE (MUST BE LAST) ============
router.get('/:id', getUserById);

module.exports = router;