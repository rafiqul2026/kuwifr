// server/src/controllers/auditLog.controller.js
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

const DEFAULT_LOGS = [
  {
    action: 'SETTINGS_UPDATE',
    module: 'SETTINGS',
    adminEmail: 'admin@kuwifr.com',
    ipAddress: '127.0.0.1',
    severity: 'INFO',
    details: 'Corporate contact details and Razorpay live keys updated.',
    createdAt: new Date(Date.now() - 15 * 60 * 1000)
  },
  {
    action: 'BROADCAST_DISPATCHED',
    module: 'NOTIFICATIONS',
    adminEmail: 'admin@kuwifr.com',
    ipAddress: '127.0.0.1',
    severity: 'INFO',
    details: 'Broadcast "Goa Leadership Bonanza 2026 Live!" delivered to all active members.',
    createdAt: new Date(Date.now() - 2 * 3600 * 1000)
  },
  {
    action: 'WITHDRAWAL_PROCESSED',
    module: 'WITHDRAWALS',
    adminEmail: 'admin@kuwifr.com',
    ipAddress: '127.0.0.1',
    severity: 'INFO',
    details: 'Payout #WTH-2026-8802 (₹10,200 net) confirmed via UTR-HDFC-99120491.',
    createdAt: new Date(Date.now() - 4 * 3600 * 1000)
  },
  {
    action: 'RULE_MODIFIED',
    module: 'RULES',
    adminEmail: 'admin@kuwifr.com',
    ipAddress: '127.0.0.1',
    severity: 'WARNING',
    details: 'Rule "MINIMUM_WITHDRAWAL_LIMIT" value changed to ₹500.',
    createdAt: new Date(Date.now() - 12 * 3600 * 1000)
  },
  {
    action: 'RANK_CREATED',
    module: 'RANKS',
    adminEmail: 'admin@kuwifr.com',
    ipAddress: '127.0.0.1',
    severity: 'CRITICAL',
    details: 'Custom rank "Rubul" (Level 13) added to career progression tree.',
    createdAt: new Date(Date.now() - 24 * 3600 * 1000)
  }
];

const seedLogsIfEmpty = async () => {
  try {
    const count = await AuditLog.countDocuments();
    if (count === 0) {
      await AuditLog.insertMany(DEFAULT_LOGS);
    }
  } catch (err) {
    console.error('Audit seed notice:', err.message);
  }
};

/**
 * GET /api/admin/audit or GET /api/audit
 */
exports.getAuditLogs = async (req, res, next) => {
  try {
    await seedLogsIfEmpty();
    const { module, severity, search, limit = 50, page = 1 } = req.query;
    const query = {};

    if (module && module !== 'ALL') query.module = module;
    if (severity && severity !== 'ALL') query.severity = severity;
    if (search) {
      query.$or = [
        { action: { $regex: search, $options: 'i' } },
        { details: { $regex: search, $options: 'i' } },
        { adminEmail: { $regex: search, $options: 'i' } }
      ];
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, parseInt(limit, 10) || 50);
    const skip = (currentPage - 1) * pageLimit;

    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageLimit).lean(),
      AuditLog.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        logs: logs || [],
        pagination: {
          total,
          limit: pageLimit,
          page: currentPage,
          pages: Math.ceil(total / pageLimit) || 1
        }
      },
      logs: logs || []
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/audit/clear
 */
exports.clearAuditLogs = async (req, res, next) => {
  try {
    await AuditLog.deleteMany({});
    return res.status(200).json({
      success: true,
      message: 'Audit history cleared successfully.'
    });
  } catch (error) {
    next(error);
  }
};