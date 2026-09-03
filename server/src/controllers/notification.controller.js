// server/src/controllers/notification.controller.js
// Production Notification Controller for Member Broadcasts & Targeted Alerts
const Notification = require('../models/Notification');
const User = require('../models/User');

// Helper: Seed default announcements to registered users if collection is empty
const seedNotificationsIfEmpty = async () => {
  try {
    const count = await Notification.countDocuments();
    if (count === 0) {
      const users = await User.find({ status: 'ACTIVE' }).limit(20);
      if (users && users.length > 0) {
        const sampleBroadcasts = [
          {
            title: 'Welcome to KUWIFR Direct Business Hub',
            message: 'Explore our latest health supplements, alkaline devices, and binary matching commission opportunities.',
            type: 'SYSTEM',
            priority: 'HIGH',
            icon: '📢',
            color: '#2563eb',
            action: '/shop',
            actionLabel: 'Explore Store',
            status: 'SENT'
          },
          {
            title: 'Goa Leadership Bonanza 2026 Live!',
            message: 'Qualify for an all-expenses-paid 3N/4D 5-star Goa trip by achieving 35 Star Pairs this month.',
            type: 'CAMPAIGN',
            priority: 'URGENT',
            icon: '🎯',
            color: '#f59e0b',
            action: '/member/bonanza',
            actionLabel: 'View Targets',
            status: 'SENT'
          },
          {
            title: 'Weekly Payout Cycle Dispatched',
            message: 'TDS (5%) and Admin fee reconciliations have been processed. Check your bank ledger for UTR details.',
            type: 'FINANCIAL',
            priority: 'MEDIUM',
            icon: '💳',
            color: '#059669',
            action: '/member/withdrawals',
            actionLabel: 'Check Ledger',
            status: 'SENT'
          }
        ];

        const bulkDocs = [];
        for (const user of users) {
          for (const item of sampleBroadcasts) {
            bulkDocs.push({
              ...item,
              userId: user._id
            });
          }
        }

        if (bulkDocs.length > 0) {
          await Notification.insertMany(bulkDocs);
        }
      }
    }
  } catch (err) {
    console.error('Auto-seed notifications notice:', err.message);
  }
};

// ============ MEMBER CONTROLLER HANDLERS ============

/**
 * Get logged-in user's notifications
 * GET /api/notifications
 */
const getNotifications = async (req, res, next) => {
  try {
    await seedNotificationsIfEmpty();
    const userId = req.userId || req.user?.id || req.user?._id;
    const { read, type, limit = 20, page = 1 } = req.query;

    const query = { userId };
    if (read === 'true') query.read = true;
    if (read === 'false') query.read = false;
    if (type && type !== 'ALL') query.type = type;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [notifications, total, unread] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ userId, read: false })
    ]);

    res.status(200).json({
      success: true,
      data: {
        notifications: notifications || [],
        unreadCount: unread,
        pagination: {
          total,
          limit: parseInt(limit, 10),
          page: parseInt(page, 10),
          pages: Math.ceil(total / parseInt(limit, 10)) || 1
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread notification count
 * GET /api/notifications/unread-count
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const count = await Notification.countDocuments({
      userId,
      read: false,
      $or: [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: null }
      ]
    });

    res.status(200).json({
      success: true,
      data: { unreadCount: count }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a notification as read
 * PUT /api/notifications/:id/read
 */
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.userId || req.user?.id || req.user?._id;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: { notification }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read
 * PUT /api/notifications/read-all
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const result = await Notification.updateMany(
      { userId, read: false },
      { $set: { read: true, readAt: new Date() } }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data: { modifiedCount: result.modifiedCount }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete single notification
 * DELETE /api/notifications/:id
 */
const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.userId || req.user?.id || req.user?._id;

    await Notification.findOneAndDelete({ _id: id, userId });

    res.status(200).json({
      success: true,
      message: 'Notification deleted'
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
    const userId = req.userId || req.user?.id || req.user?._id;
    const result = await Notification.deleteMany({ userId, read: true });

    res.status(200).json({
      success: true,
      message: 'Read notifications deleted',
      data: { deletedCount: result.deletedCount }
    });
  } catch (error) {
    next(error);
  }
};

// ============ ADMIN CONTROLLER HANDLERS ============

/**
 * Admin: Get Sent Notifications (Aggregated by unique notification title)
 * GET /api/admin/notifications or GET /api/notifications/admin
 */
const getAdminNotifications = async (req, res, next) => {
  try {
    await seedNotificationsIfEmpty();

    // Aggregate unique broadcasts by title, grouping recipients count
    const uniqueNotifications = await Notification.aggregate([
      {
        $group: {
          _id: '$title',
          docId: { $first: '$_id' },
          title: { $first: '$title' },
          message: { $first: '$message' },
          type: { $first: '$type' },
          priority: { $first: '$priority' },
          icon: { $first: '$icon' },
          color: { $first: '$color' },
          action: { $first: '$action' },
          actionLabel: { $first: '$actionLabel' },
          createdAt: { $first: '$createdAt' },
          recipientCount: { $sum: 1 }
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    const formattedList = uniqueNotifications.map((n) => ({
      _id: n.docId,
      title: n.title,
      message: n.message,
      type: n.type,
      priority: n.priority,
      icon: n.icon,
      color: n.color,
      action: n.action,
      actionLabel: n.actionLabel,
      createdAt: n.createdAt,
      recipientCount: n.recipientCount
    }));

    return res.status(200).json({
      success: true,
      data: {
        notifications: formattedList
      },
      notifications: formattedList
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Send Broadcast to All Members or Selected User IDs
 * POST /api/admin/notifications/send or POST /api/admin/notifications
 */
const sendAdminNotification = async (req, res, next) => {
  try {
    const {
      title,
      message,
      body,
      type,
      priority,
      icon,
      color,
      action,
      actionLabel,
      userIds
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Notification Title and Message are required.'
      });
    }

    // Determine recipients
    let targetUsers = [];
    if (Array.isArray(userIds) && userIds.length > 0) {
      targetUsers = await User.find({ _id: { $in: userIds } }).select('_id');
    } else {
      // Broadcast to all active users
      targetUsers = await User.find({ status: 'ACTIVE' }).select('_id');
      if (!targetUsers || targetUsers.length === 0) {
        targetUsers = await User.find().select('_id');
      }
    }

    if (!targetUsers || targetUsers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No eligible member accounts found to receive this notification.'
      });
    }

    // Build notifications for all recipients to satisfy the required userId constraint
    const notificationsToInsert = targetUsers.map((u) => ({
      userId: u._id,
      title: title.trim(),
      message: message.trim(),
      body: body || '',
      type: type || 'SYSTEM',
      priority: priority || 'MEDIUM',
      icon: icon || '📢',
      color: color || '#2563eb',
      action: action || null,
      actionLabel: actionLabel || 'Learn More',
      source: 'ADMIN',
      status: 'SENT',
      delivered: true,
      deliveredAt: new Date()
    }));

    await Notification.insertMany(notificationsToInsert);

    return res.status(201).json({
      success: true,
      message: `Notification successfully broadcast to ${targetUsers.length} members!`,
      data: {
        recipientCount: targetUsers.length,
        notification: notificationsToInsert[0]
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete a Broadcast (Removes all matching title/message records)
 * DELETE /api/admin/notifications/:id
 */
const deleteAdminNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const targetDoc = await Notification.findById(id);

    if (!targetDoc) {
      // Fallback: delete directly by ID
      await Notification.findByIdAndDelete(id);
      return res.status(200).json({
        success: true,
        message: 'Notification removed successfully'
      });
    }

    // Delete all duplicate broadcast entries matching the same title & created timestamp window
    await Notification.deleteMany({
      title: targetDoc.title,
      createdAt: {
        $gte: new Date(new Date(targetDoc.createdAt).getTime() - 60000),
        $lte: new Date(new Date(targetDoc.createdAt).getTime() + 60000)
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Broadcast notification removed from all member portals.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Search members for specific recipient selection
 * GET /api/admin/users/search or GET /api/admin/notifications/search-users
 */
const searchUsersForNotification = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.status(200).json({ success: true, data: { users: [] } });
    }

    const searchRegex = new RegExp(q.trim(), 'i');
    const users = await User.find({
      $or: [
        { fullName: searchRegex },
        { email: searchRegex },
        { phoneNumber: searchRegex },
        { memberId: searchRegex }
      ]
    })
      .select('_id fullName email phoneNumber memberId')
      .limit(20)
      .lean();

    return res.status(200).json({
      success: true,
      data: { users: users || [] }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  // Member routes
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteReadNotifications,

  // Admin routes
  getAdminNotifications,
  sendAdminNotification,
  deleteAdminNotification,
  searchUsersForNotification
};