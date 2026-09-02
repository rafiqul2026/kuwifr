const ReportService = require('../services/report.service');
const User = require('../models/User');
const Order = require('../models/Order');
const IncomeTransaction = require('../models/IncomeTransaction');

// ============ ADMIN REPORTS ============

/**
 * Get admin dashboard
 * GET /api/reports/admin/dashboard
 */
const getAdminDashboard = async (req, res, next) => {
  try {
    const dashboard = await ReportService.getAdminDashboard();
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get financial report
 * GET /api/reports/admin/financial
 */
const getFinancialReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const report = await ReportService.getFinancialReport(startDate, endDate);
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get sales report
 * GET /api/reports/admin/sales
 */
const getSalesReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const report = await ReportService.getSalesReport(startDate, endDate);
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get member list report (admin)
 * GET /api/reports/admin/members
 */
const getMemberReport = async (req, res, next) => {
  try {
    const { status, role, limit = 100, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (status) query.status = status;
    if (role) query.role = role;

    const members = await User.find(query)
      .select('fullName email phoneNumber status role joinedDate sponsorId')
      .populate('sponsorId', 'fullName email')
      .sort({ joinedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        members,
        pagination: {
          total,
          limit: parseInt(limit),
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============ MEMBER REPORTS ============

/**
 * Get member performance report
 * GET /api/reports/member/performance
 */
const getMemberPerformanceReport = async (req, res, next) => {
  try {
    const userId = req.userId;
    const report = await ReportService.getMemberPerformanceReport(userId);
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get member income report
 * GET /api/reports/member/income
 */
const getMemberIncomeReport = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const transactions = await IncomeTransaction.find({
      userId: userId,
      status: 'CREDITED'
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await IncomeTransaction.countDocuments({
      userId: userId,
      status: 'CREDITED'
    });

    const summary = await IncomeTransaction.aggregate([
      { $match: { userId: userId, status: 'CREDITED' } },
      { $group: { _id: '$type', total: { $sum: '$creditedAmount' }, count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        transactions,
        summary,
        pagination: {
          total,
          limit: parseInt(limit),
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get member team report
 * GET /api/reports/member/team
 */
const getMemberTeamReport = async (req, res, next) => {
  try {
    const userId = req.userId;
    const teamStats = await ReportService.getTeamStats(userId);
    
    // Get team members
    const members = await User.find({ sponsorId: userId })
      .select('fullName email phoneNumber status joinedDate')
      .sort({ joinedDate: -1 });

    res.json({
      success: true,
      data: {
        stats: teamStats,
        members
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============ EXPORT REPORTS ============

/**
 * Export member list to CSV
 * GET /api/reports/export/members
 */
const exportMembersCSV = async (req, res, next) => {
  try {
    const members = await User.find()
      .select('fullName email phoneNumber status role joinedDate')
      .lean();

    const headers = ['Full Name', 'Email', 'Phone', 'Status', 'Role', 'Joined Date'];
    const data = members.map(m => ({
      'Full Name': m.fullName,
      'Email': m.email,
      'Phone': m.phoneNumber,
      'Status': m.status,
      'Role': m.role,
      'Joined Date': m.joinedDate.toISOString().split('T')[0]
    }));

    const csv = ReportService.exportToCSV(data, headers);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=members-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

/**
 * Export income report to CSV
 * GET /api/reports/export/income
 */
const exportIncomeCSV = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = { status: 'CREDITED' };
    if (startDate && endDate) {
      query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const transactions = await IncomeTransaction.find(query)
      .populate('userId', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();

    const headers = ['Transaction ID', 'User', 'Email', 'Type', 'Amount', 'KBP', 'Created At'];
    const data = transactions.map(t => ({
      'Transaction ID': t.transactionId,
      'User': t.userId?.fullName || 'N/A',
      'Email': t.userId?.email || 'N/A',
      'Type': t.type,
      'Amount': t.creditedAmount,
      'KBP': t.kbp,
      'Created At': t.createdAt.toISOString().split('T')[0]
    }));

    const csv = ReportService.exportToCSV(data, headers);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=income-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminDashboard,
  getFinancialReport,
  getSalesReport,
  getMemberReport,
  getMemberPerformanceReport,
  getMemberIncomeReport,
  getMemberTeamReport,
  exportMembersCSV,
  exportIncomeCSV
};