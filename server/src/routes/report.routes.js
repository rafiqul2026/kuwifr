// server/src/routes/report.routes.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const authModule = require('../middleware/auth');

const auth = typeof authModule === 'function' ? authModule : (authModule.auth || authModule.protect);
const adminAuth =
  authModule.adminAuth ||
  ((req, res, next) => {
    const role = (req.user?.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return next();
    return res.status(403).json({ success: false, message: 'Administrator credentials required' });
  });

// ============ ADMIN REPORT ENDPOINTS ============
router.get('/admin/dashboard', auth, adminAuth, reportController.getAdminDashboard);
router.get('/admin/overview', auth, adminAuth, reportController.getAdminDashboard);
router.get('/admin/members', auth, adminAuth, reportController.getMemberReport);
router.get('/admin/income', auth, adminAuth, reportController.getAdminIncomeReport);
router.get('/admin/withdrawals', auth, adminAuth, reportController.getAdminWithdrawalReport);
router.get('/admin/sales', auth, adminAuth, reportController.getSalesReport);
router.get('/admin/financial', auth, adminAuth, reportController.getFinancialReport);
router.get('/admin/tax', auth, adminAuth, reportController.getTaxReport);

// ============ CSV EXPORT ENDPOINTS ============
router.get('/export/:type', auth, adminAuth, reportController.exportReportCSV);
router.get('/export/members', auth, adminAuth, (req, res, next) => {
  req.params.type = 'members';
  reportController.exportReportCSV(req, res, next);
});
router.get('/export/income', auth, adminAuth, (req, res, next) => {
  req.params.type = 'income';
  reportController.exportReportCSV(req, res, next);
});

// ============ MEMBER REPORTS ============
router.get('/member/performance', auth, reportController.getMemberPerformanceReport);
router.get('/member/income', auth, reportController.getMemberIncomeReport);
router.get('/member/team', auth, reportController.getMemberTeamReport);

module.exports = router;