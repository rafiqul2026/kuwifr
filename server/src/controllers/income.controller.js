const IncomeService = require('../services/income.service');
const Order = require('../models/Order');
const User = require('../models/User');
const BinaryNode = require('../models/BinaryNode');
const IncomeTransaction = require('../models/IncomeTransaction');

// ============ INCOME STREAM DROPDOWN (Problem 6) ============
// Maps the member-facing "Income Stream" categories (see the dropdown on
// IncomePage.jsx) onto the underlying IncomeTransaction.type values. Several
// display categories are a UNION of multiple stored types (Leadership spans
// 3 per-level types), and two — Life Tension Free vs. Pension — share the
// SAME stored type (FUND_SALARY/FUND_INCOME) and are distinguished only by
// which Fund tier the payout metadata records (fund.service.js stores
// metadata.fundCode; 'PENSION' is the last of the 6 Life Tension Free Fund
// tiers, the other 5 — School/Family/Travelling/Lifestyle/Foreign Trip —
// all roll up into "Life Tension Free Income").
const INCOME_STREAM_CATEGORIES = {
  DIRECT: { label: 'Direct Income', types: ['REFERRAL_INCOME'] },
  MATCHING: { label: 'Matching Income', types: ['MATCHING_INCOME'] },
  LEADERSHIP: { label: 'Leadership Income', types: ['LEADERSHIP_INCOME_L1', 'LEADERSHIP_INCOME_L2', 'LEADERSHIP_INCOME_L3'] },
  REMUNERATION: { label: 'Remuneration Income', types: ['RANK_SALARY'] },
  REPURCHASE_SELF: { label: 'Re-purchase (Self) Income', types: ['REPURCHASE_SELF'] },
  REPURCHASE_DOWNLINE: { label: 'Downline Re-purchase Income', types: ['REPURCHASE_DOWNLINE'] },
  LIFE_TENSION_FREE: { label: 'Life Tension Free Income', types: ['FUND_SALARY', 'FUND_INCOME'], excludeFundCode: 'PENSION' },
  PENSION: { label: 'Pension Income', types: ['FUND_SALARY', 'FUND_INCOME'], onlyFundCode: 'PENSION' }
};

const buildIncomeStreamMatch = (userId, categoryKey) => {
  const cfg = INCOME_STREAM_CATEGORIES[categoryKey];
  if (!cfg) return null;
  const match = { userId, type: { $in: cfg.types }, status: 'CREDITED' };
  if (cfg.onlyFundCode) match['metadata.fundCode'] = cfg.onlyFundCode;
  if (cfg.excludeFundCode) match['metadata.fundCode'] = { $ne: cfg.excludeFundCode };
  return match;
};

/**
 * Process income for an order (Called after payment)
 * POST /api/income/process-order/:orderId
 */
const processOrderIncome = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.userId.toString() !== userId.toString() && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (order.orderStatus === 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'Income already processed for this order' });
    }

    const result = await IncomeService.processOrderIncome(order);

    order.orderStatus = 'COMPLETED';
    await order.save();

    res.json({ success: true, message: 'Income processed successfully', data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Get income summary (Aggregates Direct Referral and Binary Matching strictly from ledger)
 * GET /api/income/summary
 */
const getIncomeSummary = async (req, res, next) => {
  try {
    const userId = req.userId;
    const summary = await IncomeService.getIncomeSummary(userId);

    // Aggregate specific fields cleanly for frontend cards matching expected test criteria
    const referralTx = await IncomeTransaction.aggregate([
      { $match: { userId: userId, type: 'REFERRAL_INCOME', status: 'CREDITED' } },
      { $group: { _id: null, total: { $sum: '$creditedAmount' } } }
    ]);

    const matchingTx = await IncomeTransaction.aggregate([
      { $match: { userId: userId, type: 'MATCHING_INCOME', status: 'CREDITED' } },
      { $group: { _id: null, total: { $sum: '$creditedAmount' } } }
    ]);

    const directReferralIncome = referralTx.length > 0 ? referralTx[0].total : 0;
    const matchingIncome = matchingTx.length > 0 ? matchingTx[0].total : 0;
    const totalNetworkIncome = directReferralIncome + matchingIncome;

    res.json({
      success: true,
      data: {
        ...summary,
        totalNetworkIncome,
        directReferralIncome,
        matchingIncome
      }
    });
  } catch (error) {
    next(error);
  }
};

const getIncomeTransactions = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const result = await IncomeService.getIncomeTransactions(userId, parseInt(limit), skip);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getIncomeByType = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { type } = req.params;
    const { limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const result = await IncomeService.getIncomeByType(userId, type, parseInt(limit), skip);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getCapStatus = async (req, res, next) => {
  try {
    const userId = req.userId;
    const status = await IncomeService.getCapStatus(userId);
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
};

const getTodayIncome = async (req, res, next) => {
  try {
    const userId = req.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    const result = await IncomeTransaction.aggregate([
      { $match: { userId: userId, status: 'CREDITED', createdAt: { $gte: today, $lte: now } } },
      { $group: { _id: null, total: { $sum: '$creditedAmount' }, count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        today: today.toISOString().split('T')[0],
        total: result.length > 0 ? result[0].total : 0,
        count: result.length > 0 ? result[0].count : 0
      }
    });
  } catch (error) {
    next(error);
  }
};

const getLeadershipStatus = async (req, res, next) => {
  try {
    const userId = req.userId;
    const isQualified = await IncomeService.isLeadershipQualified(userId);
    const directSponsors = await User.countDocuments({ sponsorId: userId, status: 'ACTIVE' });
    const node = await BinaryNode.findOne({ userId });
    const binaryData = node ? {
      leftVolume: node.leftVolume,
      rightVolume: node.rightVolume,
      ratio: node.leftVolume >= node.rightVolume * 2 ? '2:1' : node.rightVolume >= node.leftVolume * 2 ? '1:2' : 'Not qualified'
    } : null;

    res.json({
      success: true,
      data: {
        isQualified,
        requirements: {
          directSponsors: { required: 3, current: directSponsors, met: directSponsors >= 3 },
          binaryStructure: { required: '2:1 or 1:2', current: binaryData ? binaryData.ratio : 'No binary data', met: isQualified }
        },
        binary: binaryData
      }
    });
  } catch (error) {
    next(error);
  }
};

const getRepurchaseSummary = async (req, res, next) => {
  try {
    const userId = req.userId;
    const selfRepurchase = await IncomeTransaction.aggregate([
      { $match: { userId: userId, type: 'REPURCHASE_SELF', status: 'CREDITED' } },
      { $group: { _id: null, total: { $sum: '$creditedAmount' }, count: { $sum: 1 } } }
    ]);
    const downlineRepurchase = await IncomeTransaction.aggregate([
      { $match: { userId: userId, type: 'REPURCHASE_DOWNLINE', status: 'CREDITED' } },
      { $group: { _id: null, total: { $sum: '$creditedAmount' }, count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        self: { total: selfRepurchase.length > 0 ? selfRepurchase[0].total : 0, count: selfRepurchase.length > 0 ? selfRepurchase[0].count : 0 },
        downline: { total: downlineRepurchase.length > 0 ? downlineRepurchase[0].total : 0, count: downlineRepurchase.length > 0 ? downlineRepurchase[0].count : 0 }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getRankSalaryStatus = async (req, res, next) => {
  try {
    const userId = req.userId;
    const RankService = require('../services/rank.service');
    const rank = await RankService.getCurrentRank(userId);
    const tto = await RankService.getUserTTO(userId);
    
    let potentialSalary = 0;
    let salaryPercentage = 0;
    let isEligible = false;
    
    if (rank && rank.salaryPercentage > 0) {
      salaryPercentage = rank.salaryPercentage;
      potentialSalary = tto * salaryPercentage;
      isEligible = true;
    }

    const salaryHistory = await IncomeTransaction.find({ userId: userId, type: 'RANK_SALARY', status: 'CREDITED' }).sort({ createdAt: -1 }).limit(12);

    res.json({
      success: true,
      data: {
        currentRank: rank ? { name: rank.name, level: rank.level, salaryPercentage: rank.salaryPercentage, reward: rank.reward } : null,
        eligibility: { isEligible, salaryPercentage: salaryPercentage * 100, currentTTO: tto, potentialSalary },
        history: salaryHistory.map(s => ({
          amount: s.creditedAmount,
          period: s.metadata?.period || s.createdAt.toISOString().slice(0, 7),
          rankName: s.metadata?.rankName || 'Rank Salary',
          percentage: s.metadata?.salaryPercentage || s.rate,
          ttoAmount: s.metadata?.ttoAmount || s.kbp,
          createdAt: s.createdAt
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

const processRankSalary = async (req, res, next) => {
  try {
    const { userId, period } = req.body;
    const targetUserId = userId || req.userId;
    const RankService = require('../services/rank.service');
    const result = await RankService.calculateAndCreditRankSalary(targetUserId, null, period);
    res.json({ success: true, message: result.success ? 'Rank salary processed successfully' : 'No salary processed', data: result });
  } catch (error) {
    next(error);
  }
};

const processAllRankSalaries = async (req, res, next) => {
  try {
    const { period } = req.body;
    const RankService = require('../services/rank.service');
    const results = await RankService.processAllRankSalaries(period);
    res.json({ success: true, message: `Processed ${results.length} rank salaries`, data: results });
  } catch (error) {
    next(error);
  }
};

/**
 * Live totals (today + lifetime) for every Income Stream dropdown category.
 * GET /api/income/streams
 */
const getIncomeStreamBreakdown = async (req, res, next) => {
  try {
    const userId = req.userId;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const categoryKeys = Object.keys(INCOME_STREAM_CATEGORIES);
    const streams = await Promise.all(categoryKeys.map(async (key) => {
      const match = buildIncomeStreamMatch(userId, key);
      const [totalAgg, todayAgg] = await Promise.all([
        IncomeTransaction.aggregate([
          { $match: match },
          { $group: { _id: null, total: { $sum: '$creditedAmount' }, count: { $sum: 1 } } }
        ]),
        IncomeTransaction.aggregate([
          { $match: { ...match, createdAt: { $gte: todayStart } } },
          { $group: { _id: null, total: { $sum: '$creditedAmount' }, count: { $sum: 1 } } }
        ])
      ]);

      return {
        key,
        label: INCOME_STREAM_CATEGORIES[key].label,
        total: totalAgg[0]?.total || 0,
        count: totalAgg[0]?.count || 0,
        today: todayAgg[0]?.total || 0
      };
    }));

    const grandTotal = streams.reduce((sum, s) => sum + s.total, 0);

    res.json({ success: true, data: { streams, grandTotal } });
  } catch (error) {
    next(error);
  }
};

/**
 * Transaction history for ONE Income Stream dropdown category.
 * GET /api/income/streams/:category
 */
const getIncomeStreamHistory = async (req, res, next) => {
  try {
    const userId = req.userId;
    const categoryKey = String(req.params.category || '').toUpperCase();
    const { limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const match = buildIncomeStreamMatch(userId, categoryKey);
    if (!match) {
      return res.status(400).json({ success: false, message: `Unknown income stream category: ${req.params.category}` });
    }

    const [transactions, totalCount, totalAgg] = await Promise.all([
      IncomeTransaction.find(match).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)).lean(),
      IncomeTransaction.countDocuments(match),
      IncomeTransaction.aggregate([
        { $match: match },
        { $group: { _id: null, total: { $sum: '$creditedAmount' } } }
      ])
    ]);

    // TRANSACTION HISTORY DETAIL: for Direct/Referral and Matching Income,
    // attach WHICH member generated this credit, on WHICH package, at WHAT
    // KBP value — per the user's docx request. See
    // IncomeService.enrichTransactionHistory for the full explanation
    // (including why older, pre-fix matching transactions can't be
    // retroactively attributed to a source member).
    const enrichedTransactions = await IncomeService.enrichTransactionHistory(transactions);

    res.json({
      success: true,
      data: {
        category: categoryKey,
        label: INCOME_STREAM_CATEGORIES[categoryKey].label,
        total: totalAgg[0]?.total || 0,
        totalCount,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        transactions: enrichedTransactions
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  processOrderIncome,
  getIncomeSummary,
  getIncomeTransactions,
  getIncomeByType,
  getCapStatus,
  getTodayIncome,
  getLeadershipStatus,
  getRepurchaseSummary,
  getRankSalaryStatus,
  processRankSalary,
  processAllRankSalaries,
  getIncomeStreamBreakdown,
  getIncomeStreamHistory
};