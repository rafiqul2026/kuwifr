// server/src/services/adminAlerts.service.js
//
// Admin Alerts inbox — a personal activity feed for the logged-in admin,
// distinct from AdminNotificationsPage (which is a broadcast COMPOSER admins
// use to send announcements OUT to members). This is the reverse direction:
// real system events coming IN to the admin, modeled after PBW Foundation's
// admin notification inbox (All/Unread/Read tabs, search, per-item
// "View details").
//
// There is no dedicated AdminAlert collection — alerts are synthesized
// on-read from the collections that already record these events (new
// signups, pending KYC, pending withdrawals), each given a stable synthetic
// id (e.g. "signup:<userId>") so read/clear state can be tracked against it.
// Read/clear state itself lives on the admin's own User document
// (adminAlertsReadAt, clearedAlertIds — see User.js) rather than a new
// collection, since it's small, per-admin state with no need for its own
// audit trail.

const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');

const MAX_ALERTS = 40;
const NON_MEMBER_ROLES = ['ADMIN', 'SUPER_ADMIN'];

async function buildAlertFeed() {
  const [recentSignups, pendingKyc, pendingWithdrawals] = await Promise.all([
    User.find({ role: { $nin: NON_MEMBER_ROLES } })
      .select('fullName memberId createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
      .catch(() => []),
    User.find({ role: { $nin: NON_MEMBER_ROLES }, 'kyc.status': 'PENDING' })
      .select('fullName memberId kyc.submittedAt')
      .sort({ 'kyc.submittedAt': -1 })
      .limit(20)
      .lean()
      .catch(() => []),
    Withdrawal.find({ status: 'PENDING' })
      .populate('userId', 'fullName memberId')
      .select('userId grossAmount withdrawalNumber createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
      .catch(() => [])
  ]);

  const alerts = [];

  recentSignups.forEach((u) => {
    alerts.push({
      id: `signup:${u._id}`,
      type: 'SIGNUP',
      badge: 'Success',
      icon: '🎉',
      title: 'New Referral Signup!',
      message: `${u.fullName || 'A new member'} just joined as ${u.memberId || 'a pending ID'}.`,
      createdAt: u.createdAt,
      link: '/admin/members'
    });
  });

  pendingKyc.forEach((u) => {
    alerts.push({
      id: `kyc:${u._id}`,
      type: 'KYC',
      badge: 'Action needed',
      icon: '🪪',
      title: 'KYC Verification Pending',
      message: `${u.fullName || 'A member'} (${u.memberId || 'pending ID'}) submitted KYC documents for review.`,
      createdAt: u.kyc?.submittedAt || u.createdAt,
      link: '/admin/members'
    });
  });

  pendingWithdrawals.forEach((w) => {
    const name = w.userId?.fullName || 'A member';
    const memberId = w.userId?.memberId || 'pending ID';
    alerts.push({
      id: `withdrawal:${w._id}`,
      type: 'WITHDRAWAL',
      badge: 'Action needed',
      icon: '💸',
      title: 'Withdrawal Request',
      message: `${name} (${memberId}) requested a withdrawal of ₹${Number(w.grossAmount || 0).toLocaleString('en-IN')}.`,
      createdAt: w.createdAt,
      link: '/admin/withdrawals'
    });
  });

  alerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return alerts.slice(0, MAX_ALERTS);
}

/**
 * Full alert list for one admin, with read/cleared state applied.
 */
async function getAlertsForAdmin(adminId) {
  const [feed, admin] = await Promise.all([
    buildAlertFeed(),
    User.findById(adminId).select('adminAlertsReadAt clearedAlertIds').lean()
  ]);

  const clearedIds = new Set(admin?.clearedAlertIds || []);
  const readAt = admin?.adminAlertsReadAt ? new Date(admin.adminAlertsReadAt) : null;

  const visible = feed
    .filter((a) => !clearedIds.has(a.id))
    .map((a) => ({
      ...a,
      read: !!readAt && new Date(a.createdAt) <= readAt
    }));

  const unreadCount = visible.filter((a) => !a.read).length;

  return {
    alerts: visible,
    counts: {
      all: visible.length,
      unread: unreadCount,
      read: visible.length - unreadCount
    },
    latestAt: visible[0]?.createdAt || null
  };
}

async function markAllRead(adminId) {
  await User.findByIdAndUpdate(adminId, { adminAlertsReadAt: new Date() });
}

async function clearAll(adminId) {
  const feed = await buildAlertFeed();
  const allIds = feed.map((a) => a.id);
  await User.findByIdAndUpdate(adminId, {
    // Cap stored ids so this never grows unbounded across many clears —
    // only the currently-visible feed's ids need to be remembered.
    clearedAlertIds: allIds.slice(0, MAX_ALERTS)
  });
}

async function dismissAlert(adminId, alertId) {
  const admin = await User.findById(adminId).select('clearedAlertIds');
  if (!admin) return;
  const existing = admin.clearedAlertIds || [];
  if (!existing.includes(alertId)) {
    admin.clearedAlertIds = [...existing, alertId].slice(-MAX_ALERTS);
    await admin.save();
  }
}

module.exports = {
  getAlertsForAdmin,
  markAllRead,
  clearAll,
  dismissAlert
};