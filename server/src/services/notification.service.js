const Notification = require('../models/Notification');
const Campaign = require('../models/Campaign');
const EmailService = require('./email.service');
const User = require('../models/User');

/**
 * Notification Service - Handles all notifications
 * Supports in-app and email notifications
 */
class NotificationService {
  /**
   * Create and send notification
   */
  async createNotification(userId, data) {
    const notification = new Notification({
      userId: userId,
      type: data.type || 'SYSTEM',
      priority: data.priority || 'MEDIUM',
      title: data.title,
      message: data.message,
      body: data.body || '',
      action: data.action || null,
      actionLabel: data.actionLabel || null,
      actionData: data.actionData || {},
      icon: data.icon || this.getIconForType(data.type),
      color: data.color || this.getColorForType(data.type),
      source: data.source || 'SYSTEM',
      sourceId: data.sourceId || null,
      sourceModel: data.sourceModel || null,
      metadata: data.metadata || {},
      expiresAt: data.expiresAt || this.getExpiryForType(data.type),
      status: 'PENDING'
    });

    await notification.save();

    // Send email if needed
    if (data.sendEmail !== false) {
      await this.sendEmailNotification(userId, notification);
    }

    return notification;
  }

  /**
   * Create notifications for multiple users
   */
  async createBulkNotifications(userIds, data) {
    const notifications = [];
    for (const userId of userIds) {
      const notification = await this.createNotification(userId, data);
      notifications.push(notification);
    }
    return notifications;
  }

  /**
   * Get user's notifications
   */
  async getUserNotifications(userId, options = {}) {
    const { read, type, limit = 20, page = 1, includeExpired = false } = options;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { userId: userId };
    if (read !== undefined) query.read = read;
    if (type) query.type = type;
    if (!includeExpired) {
      query.$or = [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: null }
      ];
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(query);

    // Get unread count
    const unreadCount = await Notification.countDocuments({
      userId: userId,
      read: false,
      $or: [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: null }
      ]
    });

    return {
      notifications,
      unreadCount,
      pagination: {
        total,
        limit: parseInt(limit),
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOne({
      _id: notificationId,
      userId: userId
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    notification.read = true;
    notification.readAt = new Date();
    notification.status = 'READ';
    await notification.save();

    return notification;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    const result = await Notification.updateMany(
      { userId: userId, read: false },
      { read: true, readAt: new Date(), status: 'READ' }
    );
    return result;
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId, userId) {
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId: userId
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return notification;
  }

  /**
   * Delete all read notifications
   */
  async deleteReadNotifications(userId) {
    const result = await Notification.deleteMany({
      userId: userId,
      read: true
    });
    return result;
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(userId, notification) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.email) return;

      const emailTemplate = this.getEmailTemplate(notification);
      
      await EmailService.sendEmail({
        to: user.email,
        subject: notification.title,
        html: emailTemplate.html,
        text: emailTemplate.text
      });

      notification.emailSent = true;
      notification.emailSentAt = new Date();
      notification.delivered = true;
      notification.deliveredAt = new Date();
      await notification.save();
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }
  }

  /**
   * Get notification icon by type
   */
  getIconForType(type) {
    const icons = {
      'SYSTEM': '📢',
      'FINANCIAL': '💰',
      'ACHIEVEMENT': '🏆',
      'CAMPAIGN': '🎯',
      'ADMIN': '📋',
      'SECURITY': '🔒',
      'REMINDER': '⏰'
    };
    return icons[type] || '📢';
  }

  /**
   * Get notification color by type
   */
  getColorForType(type) {
    const colors = {
      'SYSTEM': '#2563eb',
      'FINANCIAL': '#22c55e',
      'ACHIEVEMENT': '#f59e0b',
      'CAMPAIGN': '#8b5cf6',
      'ADMIN': '#ef4444',
      'SECURITY': '#ec4899',
      'REMINDER': '#14b8a6'
    };
    return colors[type] || '#2563eb';
  }

  /**
   * Get expiry for notification type
   */
  getExpiryForType(type) {
    const now = new Date();
    const expiries = {
      'SYSTEM': new Date(now.setDate(now.getDate() + 30)),
      'FINANCIAL': new Date(now.setDate(now.getDate() + 90)),
      'ACHIEVEMENT': new Date(now.setFullYear(now.getFullYear() + 1)),
      'CAMPAIGN': null,
      'ADMIN': null,
      'SECURITY': new Date(now.setDate(now.getDate() + 7)),
      'REMINDER': new Date(now.setDate(now.getDate() + 14))
    };
    return expiries[type] || null;
  }

  /**
   * Get email template
   */
  getEmailTemplate(notification) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${notification.color}; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
          .icon { font-size: 48px; }
          .button { display: inline-block; background: ${notification.color}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="icon">${notification.icon}</div>
          <h2>${notification.title}</h2>
        </div>
        <div class="content">
          <p>${notification.message}</p>
          ${notification.body ? `<p>${notification.body}</p>` : ''}
          ${notification.action ? `<div style="text-align: center;"><a href="${notification.action}" class="button">${notification.actionLabel || 'Learn More'}</a></div>` : ''}
          <p style="font-size: 14px; color: #64748b;">This notification was sent to you because you are a member of KUWIFR Services.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} KUWIFR Services Pvt Ltd. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    const text = `${notification.title}\n\n${notification.message}\n\n${notification.body || ''}`;

    return { html, text };
  }

  // ============ NOTIFICATION TRIGGERS ============

  /**
   * Send income credited notification
   */
  async sendIncomeCreditedNotification(userId, amount, type, orderId) {
    await this.createNotification(userId, {
      type: 'FINANCIAL',
      priority: 'HIGH',
      title: '💰 Income Credited!',
      message: `₹${amount.toFixed(2)} has been credited to your wallet.`,
      body: `Income Type: ${type}\nReference: Order ${orderId}`,
      action: '/member/wallet',
      actionLabel: 'View Wallet',
      source: 'SYSTEM',
      sourceId: orderId,
      sourceModel: 'Order',
      metadata: { amount, type, orderId }
    });
  }

  /**
   * Send withdrawal status notification
   */
  async sendWithdrawalNotification(userId, withdrawal, status) {
    const messages = {
      'PENDING': {
        title: '📤 Withdrawal Requested',
        message: `Your withdrawal of ₹${withdrawal.grossAmount.toFixed(2)} has been submitted.`,
        body: 'Please wait for admin approval.'
      },
      'APPROVED': {
        title: '✅ Withdrawal Approved',
        message: `Your withdrawal of ₹${withdrawal.grossAmount.toFixed(2)} has been approved.`,
        body: 'Net amount: ₹' + withdrawal.netAmount.toFixed(2)
      },
      'PROCESSED': {
        title: '💸 Withdrawal Processed',
        message: `Your withdrawal of ₹${withdrawal.grossAmount.toFixed(2)} has been processed.`,
        body: `Net amount: ₹${withdrawal.netAmount.toFixed(2)} has been credited to your account.`
      },
      'REJECTED': {
        title: '❌ Withdrawal Rejected',
        message: `Your withdrawal of ₹${withdrawal.grossAmount.toFixed(2)} has been rejected.`,
        body: `Reason: ${withdrawal.approval?.rejectionReason || 'No reason provided'}`
      }
    };

    const data = messages[status];
    if (data) {
      await this.createNotification(userId, {
        type: 'FINANCIAL',
        priority: 'HIGH',
        title: data.title,
        message: data.message,
        body: data.body,
        action: '/member/withdrawals',
        actionLabel: 'View Withdrawals',
        source: 'SYSTEM',
        sourceId: withdrawal._id,
        sourceModel: 'Withdrawal'
      });
    }
  }

  /**
   * Send rank achievement notification
   */
  async sendRankAchievementNotification(userId, rank) {
    await this.createNotification(userId, {
      type: 'ACHIEVEMENT',
      priority: 'HIGH',
      title: `🏆 New Rank Achieved: ${rank.name}!`,
      message: `Congratulations! You've achieved the rank of ${rank.name}.`,
      body: rank.reward ? `Reward: ${rank.reward}` : 'Keep up the great work!',
      action: '/member/ranks',
      actionLabel: 'View My Ranks',
      source: 'SYSTEM',
      sourceId: rank._id,
      sourceModel: 'Rank',
      icon: '🏆',
      color: '#f59e0b'
    });
  }

  /**
   * Send fund qualification notification
   */
  async sendFundQualificationNotification(userId, fund) {
    await this.createNotification(userId, {
      type: 'ACHIEVEMENT',
      priority: 'HIGH',
      title: `🌟 Fund Achieved: ${fund.name}!`,
      message: `Congratulations! You've qualified for the ${fund.name}.`,
      body: `Benefit: ${fund.benefitDescription || '2% on TTO monthly'}`,
      action: '/member/funds',
      actionLabel: 'View Funds',
      source: 'SYSTEM',
      sourceId: fund._id,
      sourceModel: 'Fund',
      icon: '🌟',
      color: '#8b5cf6'
    });
  }
}

module.exports = new NotificationService();