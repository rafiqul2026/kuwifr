// server/src/routes/notification.routes.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const authModule = require('../middleware/auth');

// Support both named and default exports for auth middleware
const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);
const adminAuth =
  authModule.adminAuth ||
  ((req, res, next) => {
    const role = (req.user?.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return next();
    return res.status(403).json({ success: false, message: 'Administrator credentials required' });
  });

// ============ MEMBER NOTIFICATION ENDPOINTS ============
router.get('/', auth, notificationController.getNotifications);
router.get('/unread-count', auth, notificationController.getUnreadCount);
router.put('/:id/read', auth, notificationController.markAsRead);
router.put('/read-all', auth, notificationController.markAllAsRead);
router.delete('/:id', auth, notificationController.deleteNotification);
router.delete('/read-all', auth, notificationController.deleteReadNotifications);

// ============ ADMIN MANAGEMENT ENDPOINTS ============
// Handles /api/notifications/admin/* and /api/admin/notifications/*
router.get('/admin', auth, adminAuth, notificationController.getAdminNotifications);
router.get('/admin/all', auth, adminAuth, notificationController.getAdminNotifications);
router.post('/admin/send', auth, adminAuth, notificationController.sendAdminNotification);
router.post('/send', auth, adminAuth, notificationController.sendAdminNotification);
router.post('/', auth, adminAuth, notificationController.sendAdminNotification);
router.delete('/admin/:id', auth, adminAuth, notificationController.deleteAdminNotification);
router.get('/users/search', auth, adminAuth, notificationController.searchUsersForNotification);

module.exports = router;