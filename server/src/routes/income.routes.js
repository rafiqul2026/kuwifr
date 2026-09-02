const express = require('express');
const router = express.Router();
const {
  processOrderIncome,
  getIncomeSummary,
  getIncomeTransactions,
  getIncomeByType,
  getCapStatus,
  getTodayIncome,
  getLeadershipStatus,
  getRepurchaseSummary,
  getRankSalaryStatus,        // ← ADD THIS
  processRankSalary,           // ← ADD THIS
  processAllRankSalaries      // ← ADD THIS
} = require('../controllers/income.controller');
const { auth, adminAuth } = require('../middleware/auth');

// All income routes require authentication
router.use(auth);

// ============ INCOME PROCESSING ============

// Process income for an order
router.post('/process-order/:orderId', processOrderIncome);

// ============ INCOME QUERIES ============

// Get income summary
router.get('/summary', getIncomeSummary);

// Get income transactions
router.get('/transactions', getIncomeTransactions);

// Get income by type
router.get('/type/:type', getIncomeByType);

// Get today's income
router.get('/today', getTodayIncome);

// ============ CAPPING ============

// Get cap status
router.get('/cap-status', getCapStatus);

// ============ LEADERSHIP ============

// Get leadership status
router.get('/leadership-status', getLeadershipStatus);

// ============ REPURCHASE ============

// Get repurchase income summary
router.get('/repurchase-summary', getRepurchaseSummary);

// ============ RANK SALARY ============

// Get rank salary status
router.get('/rank-salary', getRankSalaryStatus);

// Process rank salary (Admin only)
router.post('/process-rank-salary', auth, adminAuth, processRankSalary);

// Process all rank salaries (Admin only)
router.post('/process-all-rank-salaries', auth, adminAuth, processAllRankSalaries);

module.exports = router;