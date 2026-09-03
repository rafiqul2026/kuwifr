// server/src/routes/withdrawal.routes.js
const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawal.controller');
const authModule = require('../middleware/auth');

const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);
const adminAuth =
  authModule.adminAuth ||
  ((req, res, next) => {
    const role = (req.user?.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return next();
    return res.status(403).json({ success: false, message: 'Administrator access required' });
  });

// Member Routes (Requires Member Auth)
router.post('/', auth, withdrawalController.createWithdrawal);
router.post('/request', auth, withdrawalController.createWithdrawal);
router.get('/', auth, withdrawalController.getMyWithdrawals);
router.get('/my-withdrawals', auth, withdrawalController.getMyWithdrawals);
router.get('/stats', auth, withdrawalController.getMyWithdrawalStats);
router.put('/bank-details', auth, withdrawalController.updateBankDetails);
router.get('/:id', auth, withdrawalController.getWithdrawalById);
router.put('/:id/cancel', auth, withdrawalController.cancelWithdrawal);

// Admin Routes (Requires Admin Auth)
router.get('/admin/all', auth, adminAuth, withdrawalController.getAllWithdrawals);
router.get('/admin/pending', auth, adminAuth, withdrawalController.getPendingWithdrawals);
router.get('/admin/stats', auth, adminAuth, withdrawalController.getWithdrawalStats);
router.put('/admin/:id/approve', auth, adminAuth, withdrawalController.approveWithdrawal);
router.put('/admin/:id/reject', auth, adminAuth, withdrawalController.rejectWithdrawal);
router.put('/admin/:id/process', auth, adminAuth, withdrawalController.processWithdrawal);
router.put('/admin/:id/reconcile-tds', auth, adminAuth, withdrawalController.reconcileTDS);
router.put('/admin/:id/refund-tds', auth, adminAuth, withdrawalController.refundTDS);

// Universal Fallbacks (Matches calls made to /api/admin/withdrawals/*)
router.get('/pending', auth, adminAuth, withdrawalController.getPendingWithdrawals);
router.put('/:id/approve', auth, adminAuth, withdrawalController.approveWithdrawal);
router.put('/:id/reject', auth, adminAuth, withdrawalController.rejectWithdrawal);
router.put('/:id/process', auth, adminAuth, withdrawalController.processWithdrawal);
router.put('/:id/reconcile-tds', auth, adminAuth, withdrawalController.reconcileTDS);
router.put('/:id/refund-tds', auth, adminAuth, withdrawalController.refundTDS);

module.exports = router;