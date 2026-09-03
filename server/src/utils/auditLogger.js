// server/src/utils/auditLogger.js
const AuditLog = require('../models/AuditLog');

const logAdminAction = async ({
  req,
  action,
  module,
  targetId = null,
  previousData = null,
  newData = null,
  status = 'SUCCESS'
}) => {
  try {
    const adminId = req.user?.id || req.user?._id;
    const adminEmail = req.user?.email || 'system@kuwifr.com';
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

    if (!adminId) return;

    await AuditLog.create({
      adminId,
      adminEmail,
      action,
      module,
      targetId: targetId ? targetId.toString() : null,
      previousData,
      newData,
      ipAddress,
      status
    });
  } catch (error) {
    console.error('Failed to write audit log:', error.message);
  }
};

module.exports = {
  logAdminAction
};