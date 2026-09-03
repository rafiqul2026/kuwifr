// server/src/routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const {
  getFinancialReport,
  getSalesReport,
  getMemberReport,
  getMemberPerformanceReport,
  getMemberIncomeReport,
  getMemberTeamReport,
  exportMembersCSV,
  exportIncomeCSV
} = require('../controllers/report.controller');

const { getDashboardTelemetry } = require('../controllers/adminDashboardController');
const { auth, adminAuth } = require('../middleware/auth');

// ============ ADMIN REPORTS ============

// Admin Dashboard Live Telemetry Route (Real-Time Aggregations)
router.get('/admin/dashboard', auth, adminAuth, getDashboardTelemetry);

// Admin Detailed Financial & Sales Reports
router.get('/admin/financial', auth, adminAuth, getFinancialReport);
router.get('/admin/sales', auth, adminAuth, getSalesReport);
router.get('/admin/members', auth, adminAuth, getMemberReport);

// ============ MEMBER REPORTS ============

router.get('/member/performance', auth, getMemberPerformanceReport);
router.get('/member/income', auth, getMemberIncomeReport);
router.get('/member/team', auth, getMemberTeamReport);

// ============ EXPORT ROUTES ============

router.get('/export/members', auth, adminAuth, exportMembersCSV);
router.get('/export/income', auth, adminAuth, exportIncomeCSV);

module.exports = router;