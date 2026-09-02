// server/src/routes/wallet.routes.js
const express = require('express');
const router = express.Router();
const {
  getBalance,
  getWallet,
  getTransactions,
  transferToRepurchase,
  getStats,
  getVerificationStatus,
  getSalaryWalletDetails,
  processMonthlySalary
} = require('../controllers/wallet.controller');
const { auth } = require('../middleware/auth');

// All wallet routes require authentication
router.use(auth);

// ============ STANDARD WALLET ROUTES ============

// Get wallet balance summary (Income, Repurchase, Salary)
router.get('/balance', getBalance);

// Get complete wallet with paginated transactions
router.get('/', getWallet);

// Get transaction history with optional type filter
router.get('/transactions', getTransactions);

// Get transaction statistics over N days
router.get('/stats', getStats);

// Transfer funds from Income Wallet to Repurchase Wallet
router.post('/transfer-to-repurchase', transferToRepurchase);

// Get wallet verification and security lock status
router.get('/verification-status', getVerificationStatus);

// ============ SALARY INCOME WALLET (1% TTO) ROUTES ============

// Get Gold Star 10% monthly growth (50:50 ratio) and salary ledger
router.get('/salary', getSalaryWalletDetails);

// Process monthly salary payout settlement
router.post('/salary/process', processMonthlySalary);

module.exports = router;