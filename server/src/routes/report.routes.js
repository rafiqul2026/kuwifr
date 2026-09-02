const express = require('express');
const router = express.Router();
const {
  getAdminDashboard,
  getFinancialReport,
  getSalesReport,
  getMemberReport,
  getMemberPerformanceReport,
  getMemberIncomeReport,
  getMemberTeamReport,
  exportMembersCSV,
  exportIncomeCSV
} = require('../controllers/report.controller');
const { auth, adminAuth } = require('../middleware/auth');

// ============ ADMIN REPORTS ============

// All admin report routes require admin authentication
router.get('/admin/dashboard', auth, adminAuth, getAdminDashboard);
router.get('/admin/financial', auth, adminAuth, getFinancialReport);
router.get('/admin/sales', auth, adminAuth, getSalesReport);
router.get('/admin/members', auth, adminAuth, getMemberReport);

// ============ MEMBER REPORTS ============

// Member report routes require authentication
router.get('/member/performance', auth, getMemberPerformanceReport);
router.get('/member/income', auth, getMemberIncomeReport);
router.get('/member/team', auth, getMemberTeamReport);

// ============ EXPORT ROUTES ============

router.get('/export/members', auth, adminAuth, exportMembersCSV);
router.get('/export/income', auth, adminAuth, exportIncomeCSV);

module.exports = router;