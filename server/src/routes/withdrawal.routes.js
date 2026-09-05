// server/src/routes/withdrawal.routes.js
const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawal.controller');
const authModule = require('../middleware/auth');

// Resolve standard user authentication middleware
const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);

// Resolve admin authorization middleware
const adminAuth =
  authModule.adminAuth ||
  ((req, res, next) => {
    const role = (req.user?.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return next();
    return res.status(403).json({ success: false, message: 'Administrator access required' });
  });

// ============================================================
// 1. MEMBER STATIC ROUTES (Must come before parameterized :id)
// ============================================================
router.post('/', auth, withdrawalController.createWithdrawal);
router.post('/request', auth, withdrawalController.createWithdrawal);
router.get('/', auth, withdrawalController.getMyWithdrawals);
router.get('/my-requests', auth, withdrawalController.getMyWithdrawals);
router.get('/my-withdrawals', auth, withdrawalController.getMyWithdrawals);
router.get('/stats', auth, withdrawalController.getMyWithdrawalStats);
router.get('/my-stats', auth, withdrawalController.getMyWithdrawalStats);
router.put('/bank-details', auth, withdrawalController.updateBankDetails);

// ============================================================
// 2. ADMIN STATIC ROUTES
// ============================================================
router.get('/admin/all', auth, adminAuth, withdrawalController.getAllWithdrawals);
router.get('/admin/pending', auth, adminAuth, withdrawalController.getPendingWithdrawals);
router.get('/admin/stats', auth, adminAuth, withdrawalController.getWithdrawalStats);
router.get('/pending', auth, adminAuth, withdrawalController.getPendingWithdrawals);

// Admin actions with explicit prefix
router.put('/admin/:id/approve', auth, adminAuth, withdrawalController.approveWithdrawal);
router.put('/admin/:id/reject', auth, adminAuth, withdrawalController.rejectWithdrawal);
router.put('/admin/:id/process', auth, adminAuth, withdrawalController.processWithdrawal);
router.put('/admin/:id/reconcile-tds', auth, adminAuth, withdrawalController.reconcileTDS);
router.put('/admin/:id/refund-tds', auth, adminAuth, withdrawalController.refundTDS);

// ============================================================
// 3. PARAMETERIZED DYNAMIC ROUTES (Placed last)
// ============================================================
router.get('/:id', auth, withdrawalController.getWithdrawalById);
router.put('/:id/cancel', auth, withdrawalController.cancelWithdrawal);
router.put('/:id/approve', auth, adminAuth, withdrawalController.approveWithdrawal);
router.put('/:id/reject', auth, adminAuth, withdrawalController.rejectWithdrawal);
router.put('/:id/process', auth, adminAuth, withdrawalController.processWithdrawal);
router.put('/:id/reconcile-tds', auth, adminAuth, withdrawalController.reconcileTDS);
router.put('/:id/refund-tds', auth, adminAuth, withdrawalController.refundTDS);

module.exports = router;