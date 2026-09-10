// server/src/controllers/team.controller.js
const BinaryService = require('../services/binary.service');

const getTeamOverview = async (req, res, next) => {
  try {
    const requesterId = req.userId || req.user?.id || req.user?._id;
    const targetUserId = req.query.userId || requesterId;
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Target user identifier is required.' });
    }

    // Only allow viewing your own overview, a member in your own downline, or as an admin.
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
    const isSelf = String(targetUserId) === String(requesterId);

    if (!isAdmin && !isSelf) {
      const authorized = await BinaryService.isInDownline(requesterId, targetUserId);
      if (!authorized) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to view this member\'s downline.'
        });
      }
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