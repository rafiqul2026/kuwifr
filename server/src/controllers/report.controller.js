// server/src/controllers/report.controller.js
// Production Report Controller for Financial Reconciliation & Audit Logging
const User = require('../models/User');
const Order = require('../models/Order');
const Withdrawal = require('../models/Withdrawal');
const Wallet = require('../models/Wallet');
const IncomeTransaction = require('../models/IncomeTransaction');

/**
 * Helper: Parse date range queries with safe 30-day defaults
 */
const getDateFilter = (startDate, endDate, field = 'createdAt') => {
  const filter = {};
  if (startDate || endDate) {
    filter[field] = {};
    if (startDate) filter[field].$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter[field].$lte = end;
    }
  }
  return filter;
};

// Every revenue/sales report below used to filter Order by
// `paymentStatus: 'PAID'` — a value that ISN'T EVEN IN the Order schema's
// paymentStatus enum (server/src/models/Order.js) and is never written by
// any real order-creation path. The actual codepaths that create real
// orders (order.controller.js's cash-activation flow,
// packagePurchase.controller.js's admin-approved online-gateway flow,
// admin.controller.js / package.controller.js's admin quick-activation)
// write paymentStatus 'COMPLETED' or 'SUCCESS'. A filter on 'PAID' alone
// therefore NEVER matched a single real order — every revenue figure
// derived from it (Admin Dashboard gross revenue, Sales Report, Financial
// Report, the Sales CSV export) was silently ₹0/empty regardless of how
// much real business happened.
const PAID_ORDER_MATCH = { paymentStatus: { $in: ['COMPLETED', 'SUCCESS'] } };

// ============ ADMIN REPORTS ============

/**
 * Admin Executive Dashboard Overview
 * GET /api/reports/admin/dashboard or GET /api/reports/admin/overview
 *
 * FIXED — this endpoint used to return a completely different, flat shape
 * ({ totalUsers, activeUsers, grossRevenue, ... }) while
 * client/src/pages/admin/AdminDashboardPage.jsx destructures a nested shape
 * (data.members.total, data.sales.total, data.income.total,
 * data.withdrawals.pending, data.orders.total, data.wallets.*, plus
 * data.recentOrders / recentRegistrations / topPerformers / chartTrends).
 * None of those keys existed on the old response, so every stat card on the
 * Admin Dashboard silently fell back to its 0/₹0 default — regardless of how
 * much real member/order/income data was actually in the database. This was
 * NOT a "no data yet" situation, it was a response-shape mismatch bug.
 *
 * There was also a second, unused draft of this endpoint
 * (adminDashboardController.js#getDashboardTelemetry) that already had the
 * right nested shape but was never wired to any route, and itself had three
 * separate field-name bugs that would have kept it silently returning
 * zeroes anyway: it summed Wallet.totalEarned (that field doesn't exist —
 * see server/src/models/Wallet.js), it summed Withdrawal.amount (the real
 * field is grossAmount/netAmount), and it filtered withdrawals by
 * status:'COMPLETED' (not a valid value — see the status enum in
 * server/src/models/Withdrawal.js, the real "paid out" value is
 * 'PROCESSED'). It also counted 'sales' from orderStatus alone, which
 * would double-count unpaid/PENDING orders as revenue. This rewrite keeps
 * that draft's correct overall shape but fixes all of the above and reuses
 * PAID_ORDER_MATCH (the same paymentStatus COMPLETED/SUCCESS filter already
 * proven correct elsewhere in this file) for every revenue figure.
 */
const getAdminDashboard = async (req, res, next) => {
  try {
    const range = req.query.range || '30d';

    const now = new Date();
    const startDate = new Date();
    if (range === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (range === '7d') {
      startDate.setDate(now.getDate() - 7);
    } else if (range === '1y') {
      startDate.setFullYear(now.getFullYear() - 1);
    } else {
      startDate.setDate(now.getDate() - 30);
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Real member roles per User.js: MEMBER / ADMIN / SUPER_ADMIN — exclude
    // both admin roles from every "member" count, not just ADMIN.
    const NON_MEMBER_ROLES = ['ADMIN', 'SUPER_ADMIN'];
    const memberQuery = { role: { $nin: NON_MEMBER_ROLES } };

    const [
      totalMembers,
      activeMembers,
      newTodayMembers,
      recentRegistrations,
      salesAgg,
      recentOrders,
      trendsAgg,
      pendingWithdrawalAgg,
      processedWithdrawalCount,
      walletAgg,
      incomeAgg,
      topPerformers
    ] = await Promise.all([
      User.countDocuments(memberQuery).catch(() => 0),
      User.countDocuments({ ...memberQuery, status: 'ACTIVE' }).catch(() => 0),
      User.countDocuments({ ...memberQuery, createdAt: { $gte: todayStart } }).catch(() => 0),
      User.find(memberQuery)
        .select('fullName email memberId status createdAt')
        .sort({ createdAt: -1 })
        .limit(6)
        .lean()
        .catch(() => []),
      Order.aggregate([
        {
          $facet: {
            allTime: [{ $match: PAID_ORDER_MATCH }, { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }],
            today: [{ $match: { ...PAID_ORDER_MATCH, createdAt: { $gte: todayStart } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }],
            thisMonth: [{ $match: { ...PAID_ORDER_MATCH, createdAt: { $gte: thisMonthStart } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }],
            pending: [{ $match: { orderStatus: 'PENDING' } }, { $count: 'count' }],
            completed: [{ $match: { orderStatus: { $in: ['DELIVERED', 'COMPLETED'] } } }, { $count: 'count' }]
          }
        }
      ]).catch(() => [{}]),
      Order.find()
        .populate('userId', 'fullName email memberId')
        .sort({ createdAt: -1 })
        .limit(6)
        .lean()
        .catch(() => []),
      Order.aggregate([
        { $match: { ...PAID_ORDER_MATCH, createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$totalAmount' },
            orders: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]).catch(() => []),
      // Withdrawal.status enum: PENDING / APPROVED / REJECTED / PROCESSING /
      // PROCESSED / FAILED / CANCELLED. Amount fields are grossAmount /
      // netAmount (there is no plain "amount" field on this schema).
      Withdrawal.aggregate([
        { $match: { status: 'PENDING' } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$grossAmount' } } }
      ]).catch(() => []),
      Withdrawal.countDocuments({ status: 'PROCESSED' }).catch(() => 0),
      Wallet.aggregate([
        { $group: { _id: null, incomeBal: { $sum: '$incomeBalance' }, repurchaseBal: { $sum: '$repurchaseBalance' } } }
      ]).catch(() => []),
      // "Commissions Paid" comes from IncomeTransaction (the real ledger for
      // every credited income event — same source getAdminIncomeReport
      // below uses), not from a Wallet field: Wallet has no totalEarned
      // field, so summing it always produced ₹0 regardless of real payouts.
      IncomeTransaction.aggregate([
        { $match: { status: 'CREDITED' } },
        { $group: { _id: null, total: { $sum: '$creditedAmount' } } }
      ]).catch(() => []),
      User.find({ ...memberQuery, lifetimeIncome: { $gt: 0 } })
        .select('fullName memberId lifetimeIncome')
        .sort({ lifetimeIncome: -1 })
        .limit(5)
        .lean()
        .catch(() => [])
    ]);

    const salesMetrics = salesAgg[0] || {};
    const totalSales = salesMetrics.allTime?.[0]?.total || 0;
    const totalOrders = salesMetrics.allTime?.[0]?.count || 0;
    const todaySales = salesMetrics.today?.[0]?.total || 0;
    const thisMonthSales = salesMetrics.thisMonth?.[0]?.total || 0;
    const pendingOrders = salesMetrics.pending?.[0]?.count || 0;
    const completedOrders = salesMetrics.completed?.[0]?.count || 0;

    res.status(200).json({
      success: true,
      data: {
        members: {
          total: totalMembers,
          active: activeMembers,
          newToday: newTodayMembers
        },
        sales: {
          total: totalSales,
          today: todaySales,
          thisMonth: thisMonthSales,
          orders: {
            total: totalOrders,
            pending: pendingOrders,
            completed: completedOrders
          }
        },
        income: {
          total: incomeAgg[0]?.total || 0
        },
        withdrawals: {
          pending: pendingWithdrawalAgg[0]?.count || 0,
          total: processedWithdrawalCount,
          totalAmount: pendingWithdrawalAgg[0]?.total || 0
        },
        wallets: {
          totalIncomeBalance: walletAgg[0]?.incomeBal || 0,
          totalRepurchaseBalance: walletAgg[0]?.repurchaseBal || 0
        },
        recentOrders,
        recentRegistrations,
        topPerformers: topPerformers.map((u) => ({
          user: { fullName: u.fullName, memberId: u.memberId },
          total: u.lifetimeIncome
        })),
        chartTrends: trendsAgg
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Member List Report
 * GET /api/reports/admin/members
 */
const getMemberReport = async (req, res, next) => {
  try {
    const { startDate, endDate, status, limit = 100, page = 1 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const query = getDateFilter(startDate, endDate, 'joinedDate');

    if (status && status !== 'ALL') query.status = status;

    const [members, total, active, newPeriod] = await Promise.all([
      User.find(query)
        .select('fullName email phoneNumber status role joinedDate sponsorId')
        .populate('sponsorId', 'fullName email')
        .sort({ joinedDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      User.countDocuments(query),
      User.countDocuments({ ...query, status: 'ACTIVE' }),
      User.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        total,
        active,
        new: newPeriod,
        members: members || [],
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
 * Income & Commission Report
 * GET /api/reports/admin/income
 */
const getAdminIncomeReport = async (req, res, next) => {
  try {
    const { startDate, endDate, limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const query = { status: 'CREDITED', ...getDateFilter(startDate, endDate) };

    // FAILED transactions (income.service.js#creditIncome /
    // binary.service.js#calculateMatching) — a real matching/referral/
    // leadership event happened but paid ₹0, either because crediting threw
    // an error or the member's daily/weekly/monthly package cap was already
    // exhausted. These used to be silently dropped (console.error only, no
    // DB record at all), so a member's team volume could grow for real while
    // their income stayed ₹0 with no way for an admin to see why. Surfaced
    // here so "income shows ₹0 despite real business activity" is now
    // diagnosable instead of a mystery.
    const failedQuery = { status: 'FAILED', ...getDateFilter(startDate, endDate) };

    const [transactions, total, summaryAgg, failedCount, failedRecent, failedGrossAgg] = await Promise.all([
      IncomeTransaction.find(query)
        .populate('userId', 'fullName email memberId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean()
        .catch(() => []),
      IncomeTransaction.countDocuments(query).catch(() => 0),
      IncomeTransaction.aggregate([
        { $match: query },
        { $group: { _id: '$type', total: { $sum: '$creditedAmount' }, count: { $sum: 1 } } }
      ]).catch(() => []),
      IncomeTransaction.countDocuments(failedQuery).catch(() => 0),
      IncomeTransaction.find(failedQuery)
        .populate('userId', 'fullName email memberId')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean()
        .catch(() => []),
      IncomeTransaction.aggregate([
        { $match: failedQuery },
        { $group: { _id: null, totalGrossAmount: { $sum: '$grossAmount' } } }
      ]).catch(() => [])
    ]);

    const byType = {};
    summaryAgg.forEach((item) => {
      byType[item._id || 'COMMISSION'] = { total: item.total, count: item.count };
    });

    const totalIncome = summaryAgg.reduce((sum, item) => sum + item.total, 0);

    // NOTE: this used to fall back to fabricated demo numbers (₹145,000 /
    // 24 transactions / a fake BINARY_MATCHING+DIRECT_SPONSOR+ROYALTY_SALARY
    // breakdown) whenever the real aggregation came back empty or zero —
    // which is indistinguishable, in the admin UI, from "the company
    // genuinely earned ₹145,000 today." An admin financial report must never
    // show invented figures; a quiet period is reported as zero/empty, not
    // papered over with plausible-looking fake activity.
    res.status(200).json({
      success: true,
      data: {
        total: totalIncome,
        count: total,
        byType,
        transactions: transactions || [],
        failedSummary: {
          count: failedCount,
          totalGrossAmount: failedGrossAgg[0]?.totalGrossAmount || 0,
          recent: (failedRecent || []).map((tx) => ({
            userId: tx.userId,
            type: tx.type,
            grossAmount: tx.grossAmount,
            reason: tx.metadata?.failureReason || tx.metadata?.get?.('failureReason') || 'Unknown',
            createdAt: tx.createdAt
          }))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Withdrawal & Payout Report
 * GET /api/reports/admin/withdrawals
 */
const getAdminWithdrawalReport = async (req, res, next) => {
  try {
    const { startDate, endDate, limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const query = getDateFilter(startDate, endDate);

    const [withdrawals, total] = await Promise.all([
      Withdrawal.find(query)
        .populate('userId', 'fullName email memberId')
        .sort({ createdAt: -1, requestedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean()
        .catch(() => []),
      Withdrawal.countDocuments(query).catch(() => 0)
    ]);

    const totalAmount = withdrawals.reduce((sum, w) => sum + Number(w.grossAmount || w.amount || 0), 0);
    const totalTDS = withdrawals.reduce((sum, w) => sum + Number(w.tdsAmount || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        totalAmount,
        totalTDS,
        count: total || withdrawals.length,
        withdrawals: withdrawals || []
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Sales & Package Orders Report
 * GET /api/reports/admin/sales
 */
const getSalesReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { ...PAID_ORDER_MATCH, ...getDateFilter(startDate, endDate) };

    const orders = await Order.find(query).sort({ createdAt: -1 }).lean().catch(() => []);

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

    // Grouping by package
    const packageAggMap = {};
    orders.forEach((o) => {
      const pkg = o.packageName || o.orderType || 'Standard Package';
      if (!packageAggMap[pkg]) packageAggMap[pkg] = { _id: pkg, total: 0, count: 0 };
      packageAggMap[pkg].total += Number(o.totalAmount || 0);
      packageAggMap[pkg].count += 1;
    });

    const byPackage = Object.values(packageAggMap);

    // Daily trend aggregation
    const dayMap = {};
    orders.forEach((o) => {
      const day = new Date(o.createdAt).toISOString().split('T')[0];
      if (!dayMap[day]) dayMap[day] = { _id: day, total: 0, count: 0 };
      dayMap[day].total += Number(o.totalAmount || 0);
      dayMap[day].count += 1;
    });

    const dailyTrend = Object.values(dayMap).sort((a, b) => a._id.localeCompare(b._id));

    // Same principle as getAdminIncomeReport above: no invented package
    // names or sales figures when the selected date range genuinely has no
    // orders — an empty report is the correct, honest result.
    res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        totalOrders: orders.length,
        byPackage,
        dailyTrend
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Financial Cashflow Reconciliation Report
 * GET /api/reports/admin/financial
 */
const getFinancialReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = getDateFilter(startDate, endDate);

    const [orders, withdrawals, incomeAgg] = await Promise.all([
      Order.find({ ...PAID_ORDER_MATCH, ...dateFilter }).lean().catch(() => []),
      Withdrawal.find(dateFilter).lean().catch(() => []),
      IncomeTransaction.aggregate([
        { $match: { status: 'CREDITED', ...dateFilter } },
        { $group: { _id: '$type', total: { $sum: '$creditedAmount' } } }
      ]).catch(() => [])
    ]);

    const totalIncome = orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const totalWithdrawals = withdrawals
      .filter((w) => ['PAID', 'PROCESSED'].includes((w.status || '').toUpperCase()))
      .reduce((sum, w) => sum + Number(w.grossAmount || w.amount || 0), 0);

    // No fabricated Package Activations / Repurchase Reorders split, and no
    // invented ₹450,000 / ₹125,000 totals — same fix as the other reports:
    // real zero is a real answer, not a placeholder to be dressed up.
    res.status(200).json({
      success: true,
      data: {
        income: {
          total: totalIncome,
          byType: incomeAgg
        },
        withdrawals: {
          total: totalWithdrawals
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Tax & Statutory TDS Audit Report
 * GET /api/reports/admin/tax
 */
const getTaxReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const query = getDateFilter(startDate, endDate);

    const withdrawals = await Withdrawal.find(query)
      .populate('userId', 'fullName email memberId bankDetails')
      .sort({ createdAt: -1 })
      .lean()
      .catch(() => []);

    const totalTDS = withdrawals.reduce((sum, w) => sum + Number(w.tdsAmount || 0), 0);
    const totalAdminCharge = withdrawals.reduce((sum, w) => sum + Number(w.adminCharge || w.adminFee || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        totalTDS,
        totalAdminCharge,
        withdrawals: withdrawals || []
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============ CSV EXPORT HANDLERS ============

/**
 * Universal CSV Export Route
 * GET /api/reports/export/:type
 */
const exportReportCSV = async (req, res, next) => {
  try {
    const { type } = req.params;
    const { startDate, endDate } = req.query;
    let csv = '';
    const filename = `${type}_report_${Date.now()}.csv`;

    if (type === 'members') {
      const members = await User.find(getDateFilter(startDate, endDate, 'joinedDate')).lean();
      csv = 'Full Name,Email,Phone,Status,Role,Joined Date\n';
      members.forEach((m) => {
        csv += `"${m.fullName || ''}","${m.email || ''}","${m.phoneNumber || ''}","${m.status || ''}","${m.role || ''}","${m.joinedDate ? new Date(m.joinedDate).toISOString().split('T')[0] : ''}"\n`;
      });
    } else if (type === 'withdrawals' || type === 'tax') {
      const withdrawals = await Withdrawal.find(getDateFilter(startDate, endDate))
        .populate('userId', 'fullName email')
        .lean();
      csv = 'Transaction ID,Member Name,Gross Amount,TDS Amount,Admin Charge,Net Amount,Status,Date\n';
      withdrawals.forEach((w) => {
        csv += `"${w.withdrawalNumber || w.transactionId || ''}","${w.userId?.fullName || 'N/A'}",${w.grossAmount || w.amount || 0},${w.tdsAmount || 0},${w.adminCharge || w.adminFee || 0},${w.netAmount || 0},"${w.status || ''}","${w.createdAt ? new Date(w.createdAt).toISOString().split('T')[0] : ''}"\n`;
      });
    } else if (type === 'sales') {
      const orders = await Order.find({ ...PAID_ORDER_MATCH, ...getDateFilter(startDate, endDate) }).lean();
      csv = 'Order ID,Customer Name,Plan/Items,Total Amount,Payment Method,Date\n';
      orders.forEach((o) => {
        csv += `"${o.orderNumber || ''}","${o.customerName || 'Member'}",${o.totalAmount || 0},"${o.paymentMethod || 'UPI'}","${o.createdAt ? new Date(o.createdAt).toISOString().split('T')[0] : ''}"\n`;
      });
    } else {
      csv = 'Metric,Value\nReport Type,' + type + '\nGenerated At,' + new Date().toISOString() + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    return res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

// ============ MEMBER REPORTS ============

const getMemberPerformanceReport = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    res.status(200).json({
      success: true,
      data: { userId, rank: 'Active Member', performanceScore: 100 }
    });
  } catch (error) {
    next(error);
  }
};

const getMemberIncomeReport = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const transactions = await IncomeTransaction.find({ userId, status: 'CREDITED' }).sort({ createdAt: -1 }).lean();
    res.status(200).json({
      success: true,
      data: { transactions: transactions || [] }
    });
  } catch (error) {
    next(error);
  }
};

const getMemberTeamReport = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const members = await User.find({ sponsorId: userId }).select('fullName email phoneNumber status joinedDate').lean();
    res.status(200).json({
      success: true,
      data: { members: members || [] }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminDashboard,
  getFinancialReport,
  getSalesReport,
  getMemberReport,
  getAdminIncomeReport,
  getAdminWithdrawalReport,
  getTaxReport,
  exportReportCSV,
  getMemberPerformanceReport,
  getMemberIncomeReport,
  getMemberTeamReport
};