// server/src/controllers/adminAlerts.controller.js
const AdminAlertsService = require('../services/adminAlerts.service');

/**
 * GET /api/admin/alerts
 */
const getAlerts = async (req, res, next) => {
  try {
    const result = await AdminAlertsService.getAlertsForAdmin(req.user.id || req.user._id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/alerts/mark-all-read
 */
const markAllRead = async (req, res, next) => {
  try {
    await AdminAlertsService.markAllRead(req.user.id || req.user._id);
    res.status(200).json({ success: true, message: 'All alerts marked as read.' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/alerts/clear-all
 */
const clearAll = async (req, res, next) => {
  try {
    await AdminAlertsService.clearAll(req.user.id || req.user._id);
    res.status(200).json({ success: true, message: 'All alerts cleared.' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/alerts/:id/dismiss
 */
const dismissAlert = async (req, res, next) => {
  try {
    await AdminAlertsService.dismissAlert(req.user.id || req.user._id, req.params.id);
    res.status(200).json({ success: true, message: 'Alert dismissed.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAlerts, markAllRead, clearAll, dismissAlert };