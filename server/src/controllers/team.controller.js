// server/src/controllers/team.controller.js
const BinaryService = require('../services/binary.service');

/**
 * Get complete binary team overview with Left and Right downline breakdown up to unlimited depth
 * GET /api/team/overview
 */
const getTeamOverview = async (req, res, next) => {
  try {
    // Allows admins or members to inspect a specific user ID, or defaults to the authenticated user
    const targetUserId = req.query.userId || req.userId || req.user?.id || req.user?._id;
    
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Target user identifier is required.' });
    }

    const overview = await BinaryService.getTeamOverview(targetUserId);

    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTeamOverview
};