const NotificationService = require('../services/notification.service');
const Notification = require('../models/Notification');

/**
 * Get user's notifications
 * GET /api/notifications
 */
const getNotifications = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { read, type, limit = 20, page = 1 } = req.query;

    const result = await NotificationService.getUserNotifications(userId, {
      read: read === 'true' ? true : read === 'false' ? false : undefined,
      type: type,
      limit: parseInt(limit),
      page: parseInt(page)
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread count
 * GET /api/notifications/unread-count
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.userId;
    const count = await Notification.countDocuments({
      userId: userId,
      read: false,
      $or: [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: null }
      ]
    });

    res.json({
      success: true,
      data: { unreadCount: count }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark notification as read
 * PUT /api/notifications/:id/read
 */
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const notification = await NotificationService.markAsRead(id, userId);

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: { notification }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all as read
 * PUT /api/notifications/read-all
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.userId;
    const result = await NotificationService.markAllAsRead(userId);

    res.json({
      success: true,
      message: 'All notifications marked as read',
      data: { modifiedCount: result.modifiedCount }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete notification
 * DELETE /api/notifications/:id
 */
const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const notification = await NotificationService.deleteNotification(id, userId);

    res.json({
      success: true,
      message: 'Notification deleted',
      data: { notification }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete all read notifications
 * DELETE /api/notifications/read-all
 */
const deleteReadNotifications = async (req, res, next) => {
  try {
    const userId = req.userId;
    const result = await NotificationService.deleteReadNotifications(userId);

    res.json({
      success: true,
      message: 'Read notifications deleted',
      data: { deletedCount: result.deletedCount }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteReadNotifications
};