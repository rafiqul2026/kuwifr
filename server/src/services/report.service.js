const User = require('../models/User');
const Order = require('../models/Order');
const IncomeTransaction = require('../models/IncomeTransaction');
const Withdrawal = require('../models/Withdrawal');
const Wallet = require('../models/Wallet');
const RankAchievement = require('../models/RankAchievement');
const FundQualification = require('../models/FundQualification');
const BinaryNode = require('../models/BinaryNode');

/**
 * Report Service - Handles all reporting and analytics
 */
class ReportService {
  // ============ ADMIN DASHBOARD ============

  /**
   * Get admin dashboard statistics
   */
  async getAdminDashboard() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = this.getWeekStart(now);

    // Member Statistics
    const totalMembers = await User.countDocuments();
    const activeMembers = await User.countDocuments({ status: 'ACTIVE' });
    const pendingVerification = await User.countDocuments({ status: 'PENDING_VERIFICATION' });
    const newMembersToday = await User.countDocuments({
      createdAt: { $gte: today }
    });
    const newMembersThisMonth = await User.countDocuments({
      createdAt: { $gte: startOfMonth }
    });

    // Sales Statistics
    const totalSales = await Order.aggregate([
      { $match: { orderStatus: 'COMPLETED' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalSalesAmount = totalSales.length > 0 ? totalSales[0].total : 0;

    const salesToday = await Order.aggregate([
      { $match: { orderStatus: 'COMPLETED', createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const salesTodayAmount = salesToday.length > 0 ? salesToday[0].total : 0;

    const salesThisMonth = await Order.aggregate([
      { $match: { orderStatus: 'COMPLETED', createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const salesThisMonthAmount = salesThisMonth.length > 0 ? salesThisMonth[0].total : 0;

    // Order Statistics
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ orderStatus: 'PENDING' });
    const processingOrders = await Order.countDocuments({ orderStatus: 'PROCESSING' });
    const completedOrders = await Order.countDocuments({ orderStatus: 'COMPLETED' });

    // Income Statistics
    const totalIncome = await IncomeTransaction.aggregate([
      { $match: { status: 'CREDITED' } },
      { $group: { _id: null, total: { $sum: '$creditedAmount' } } }
    ]);
    const totalIncomeAmount = totalIncome.length > 0 ? totalIncome[0].total : 0;

    // Income by type
    const incomeByType = await IncomeTransaction.aggregate([
      { $match: { status: 'CREDITED' } },
      { $group: { _id: '$type', total: { $sum: '$creditedAmount' }, count: { $sum: 1 } } }
    ]);

    // Withdrawal Statistics
    const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'PENDING' });
    const totalWithdrawals = await Withdrawal.countDocuments({ status: 'PROCESSED' });
    const totalWithdrawn = await Withdrawal.aggregate([
      { $match: { status: 'PROCESSED' } },
      { $group: { _id: null, total: { $sum: '$grossAmount' } } }
    ]);
    const totalWithdrawnAmount = totalWithdrawn.length > 0 ? totalWithdrawn[0].total : 0;

    // Total TDS
    const totalTDS = await Withdrawal.aggregate([
      { $match: { status: 'PROCESSED' } },
      { $group: { _id: null, total: { $sum: '$tdsAmount' } } }
    ]);
    const totalTDSAmount = totalTDS.length > 0 ? totalTDS[0].total : 0;

    // Rank Distribution
    const rankDistribution = await RankAchievement.aggregate([
      { $match: { status: 'ACHIEVED' } },
      { $group: { _id: '$rankName', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Fund Distribution
    const fundDistribution = await FundQualification.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$fundName', count: { $sum: 1 } } }
    ]);

    // Top Performers (by income)
    const topPerformers = await IncomeTransaction.aggregate([
      { $match: { status: 'CREDITED' } },
      { $group: { _id: '$userId', total: { $sum: '$creditedAmount' } } },
      { $sort: { total: -1 } },
      { $limit: 10 }
    ]);

    // Populate top performers with user details
    const topPerformersWithDetails = [];
    for (const performer of topPerformers) {
      const user = await User.findById(performer._id).select('fullName email');
      if (user) {
        topPerformersWithDetails.push({
          ...performer,
          user: user
        });
      }
    }

    // Recent Orders
    const recentOrders = await Order.find()
      .populate('userId', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(10);

    // Recent Registrations
    const recentRegistrations = await User.find()
      .select('fullName email status createdAt')
      .sort({ createdAt: -1 })
      .limit(10);

    // Wallet Statistics
    const totalWalletBalance = await Wallet.aggregate([
      { $group: { _id: null, total: { $sum: '$incomeBalance' } } }
    ]);
    const totalWalletBalanceAmount = totalWalletBalance.length > 0 ? totalWalletBalance[0].total : 0;

    const totalRepurchaseBalance = await Wallet.aggregate([
      { $group: { _id: null, total: { $sum: '$repurchaseBalance' } } }
    ]);
    const totalRepurchaseBalanceAmount = totalRepurchaseBalance.length > 0 ? totalRepurchaseBalance[0].total : 0;

    return {
      members: {
        total: totalMembers,
        active: activeMembers,
        pendingVerification: pendingVerification,
        newToday: newMembersToday,
        newThisMonth: newMembersThisMonth
      },
      sales: {
        total: totalSalesAmount,
        today: salesTodayAmount,
        thisMonth: salesThisMonthAmount,
        orders: {
          total: totalOrders,
          pending: pendingOrders,
          processing: processingOrders,
          completed: completedOrders
        }
      },
      income: {
        total: totalIncomeAmount,
        byType: incomeByType
      },
      withdrawals: {
        pending: pendingWithdrawals,
        total: totalWithdrawals,
        totalAmount: totalWithdrawnAmount,
        totalTDS: totalTDSAmount
      },
      wallets: {
        totalIncomeBalance: totalWalletBalanceAmount,
        totalRepurchaseBalance: totalRepurchaseBalanceAmount
      },
      ranks: rankDistribution,
      funds: fundDistribution,
      topPerformers: topPerformersWithDetails,
      recentOrders: recentOrders,
      recentRegistrations: recentRegistrations
    };
  }

  // ============ MEMBER REPORTS ============

  /**
   * Get member performance report
   */
  async getMemberPerformanceReport(userId) {
    // Income Summary
    const incomeSummary = await IncomeTransaction.aggregate([
      { $match: { userId: userId, status: 'CREDITED' } },
      { $group: { _id: '$type', total: { $sum: '$creditedAmount' }, count: { $sum: 1 } } }
    ]);

    // Monthly Income Trend
    const monthlyIncome = await IncomeTransaction.aggregate([
      { $match: { userId: userId, status: 'CREDITED' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          total: { $sum: '$creditedAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    // Team Statistics
    const teamStats = await this.getTeamStats(userId);

    // Rank Progression
    const rankProgression = await RankAchievement.find({
      userId: userId,
      status: 'ACHIEVED'
    }).populate('rankId').sort({ rankLevel: -1 });

    // Fund Status
    const fundStatus = await FundQualification.find({
      userId: userId,
      isActive: true
    });

    // Withdrawal Summary
    const withdrawalSummary = await Withdrawal.aggregate([
      { $match: { userId: userId } },
      { $group: { _id: '$status', total: { $sum: '$grossAmount' }, count: { $sum: 1 } } }
    ]);

    // Order Summary
    const orderSummary = await Order.aggregate([
      { $match: { userId: userId } },
      { $group: { _id: '$orderStatus', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
    ]);

    // Total KBP
    const totalKBP = await Order.aggregate([
      { $match: { userId: userId, orderStatus: 'COMPLETED' } },
      { $group: { _id: null, total: { $sum: '$kbpGenerated' } } }
    ]);

    return {
      incomeSummary,
      monthlyIncome,
      teamStats,
      rankProgression,
      fundStatus,
      withdrawalSummary,
      orderSummary,
      totalKBP: totalKBP.length > 0 ? totalKBP[0].total : 0
    };
  }

  /**
   * Get team statistics for a member
   */
  async getTeamStats(userId) {
    const directReferrals = await User.countDocuments({ sponsorId: userId });
    const totalTeam = await User.countDocuments({ sponsorId: userId });

    // Get binary tree stats
    const binaryNode = await BinaryNode.findOne({ userId });
    const binaryStats = binaryNode ? {
      leftVolume: binaryNode.leftVolume,
      rightVolume: binaryNode.rightVolume,
      matchingVolume: binaryNode.matchingVolume,
      pairCount: binaryNode.pairCount
    } : null;

    return {
      directReferrals,
      totalTeam,
      binary: binaryStats
    };
  }

  // ============ FINANCIAL REPORTS ============

  /**
   * Get financial summary report
   */
  async getFinancialReport(startDate, endDate) {
    const query = {
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
    };

    // Income by period
    const incomeByPeriod = await IncomeTransaction.aggregate([
      { $match: { ...query, status: 'CREDITED' } },
      { $group: { _id: '$type', total: { $sum: '$creditedAmount' }, count: { $sum: 1 } } }
    ]);

    // Withdrawals by period
    const withdrawalsByPeriod = await Withdrawal.aggregate([
      { $match: { ...query, status: 'PROCESSED' } },
      { $group: { _id: null, total: { $sum: '$grossAmount' }, count: { $sum: 1 } } }
    ]);

    // TDS collected
    const tdsCollected = await Withdrawal.aggregate([
      { $match: { ...query, status: 'PROCESSED' } },
      { $group: { _id: null, total: { $sum: '$tdsAmount' } } }
    ]);

    // Sales by period
    const salesByPeriod = await Order.aggregate([
      { $match: { ...query, orderStatus: 'COMPLETED' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
    ]);

    return {
      period: {
        start: startDate,
        end: endDate
      },
      income: {
        byType: incomeByPeriod,
        total: incomeByPeriod.reduce((sum, i) => sum + i.total, 0)
      },
      withdrawals: {
        total: withdrawalsByPeriod.length > 0 ? withdrawalsByPeriod[0].total : 0,
        count: withdrawalsByPeriod.length > 0 ? withdrawalsByPeriod[0].count : 0
      },
      tds: {
        total: tdsCollected.length > 0 ? tdsCollected[0].total : 0
      },
      sales: {
        total: salesByPeriod.length > 0 ? salesByPeriod[0].total : 0,
        count: salesByPeriod.length > 0 ? salesByPeriod[0].count : 0
      }
    };
  }

  // ============ SALES REPORTS ============

  /**
   * Get sales report
   */
  async getSalesReport(startDate, endDate) {
    const query = {
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
      orderStatus: 'COMPLETED'
    };

    // Sales by package
    const salesByPackage = await Order.aggregate([
      { $match: query },
      { $group: { _id: '$packageName', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]);

    // Sales by product
    const salesByProduct = await Order.aggregate([
      { $match: query },
      { $unwind: '$products' },
      { $group: { _id: '$products.name', total: { $sum: { $multiply: ['$products.price', '$products.quantity'] } }, count: { $sum: '$products.quantity' } } },
      { $sort: { total: -1 } }
    ]);

    // Daily sales trend
    const dailySales = await Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return {
      period: {
        start: startDate,
        end: endDate
      },
      byPackage: salesByPackage,
      byProduct: salesByProduct,
      dailyTrend: dailySales,
      totalOrders: dailySales.reduce((sum, d) => sum + d.count, 0),
      totalRevenue: dailySales.reduce((sum, d) => sum + d.total, 0)
    };
  }

  // ============ UTILITY METHODS ============

  /**
   * Get week start (Monday)
   */
  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  /**
   * Export data to CSV
   */
  exportToCSV(data, headers) {
    const headerRow = headers.join(',');
    const dataRows = data.map(row => {
      return headers.map(header => {
        const value = row[header] || '';
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',');
    });
    return [headerRow, ...dataRows].join('\n');
  }
}

module.exports = new ReportService();