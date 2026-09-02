const express = require('express');
const router = express.Router();
const {
  createWithdrawal,
  getMyWithdrawals,
  getWithdrawalById,
  cancelWithdrawal,
  getMyWithdrawalStats,
  updateBankDetails
} = require('../controllers/withdrawal.controller');
const { auth } = require('../middleware/auth');

// All withdrawal routes require authentication
router.use(auth);

// Create withdrawal
router.post('/', createWithdrawal);

// Get my withdrawals
router.get('/', getMyWithdrawals);

// Get withdrawal stats
router.get('/stats', getMyWithdrawalStats);

// Update bank details
router.put('/bank-details', updateBankDetails);

// Get withdrawal by ID
router.get('/:id', getWithdrawalById);

// Cancel withdrawal
router.put('/:id/cancel', cancelWithdrawal);

module.exports = router;