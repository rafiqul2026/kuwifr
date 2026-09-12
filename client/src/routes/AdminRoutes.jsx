// client/src/routes/AdminRoutes.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layout & Dashboard Pages
import AdminLayout from '../components/layout/AdminLayout';
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import AdminPackageAnalyticsPage from '../pages/admin/AdminPackageAnalyticsPage';

// Import remaining admin management pages (adjust to your project files)
import AdminMembersPage from '../pages/admin/AdminMembersPage';
import AdminPackagesPage from '../pages/admin/AdminPackagesPage';
import AdminProductsPage from '../pages/admin/AdminProductsPage';
import AdminOrdersPage from '../pages/admin/AdminOrdersPage';
import AdminWithdrawalsPage from '../pages/admin/AdminWithdrawalsPage';
import AdminRanksPage from '../pages/admin/AdminRanksPage';
import AdminFundsPage from '../pages/admin/AdminFundsPage';
import AdminSettingsPage from '../pages/admin/AdminSettingsPage';

// These pages exist on disk and are linked from the sidebar, but were never
// registered as routes — clicking them in the sidebar fell through to the
// dashboard catch-all. Wiring them up here.
import AdminPackageSalesReport from '../pages/admin/AdminPackageSalesReport';
import AdminReportsPage from '../pages/admin/AdminReportsPage';
import AdminCampaignsPage from '../pages/admin/AdminCampaignsPage';
import AdminNotificationsPage from '../pages/admin/AdminNotificationsPage';
import AdminAuditLogsPage from '../pages/admin/AdminAuditLogsPage';
import AdminFranchisePage from '../pages/admin/AdminFranchisePage';
import AdminAlertsPage from '../pages/admin/AdminAlertsPage';
import AdminIncomeHistoryPage from '../pages/admin/AdminIncomeHistoryPage';

// Detail pages — previously the Dashboard's "Recent Orders"/"Recent
// Registrations" rows navigated to /admin/orders/:id and /admin/members/:id,
// but neither route was registered, so clicking a row silently redirected
// back to the dashboard via the catch-all below.
import AdminMemberDetailPage from '../pages/admin/AdminMemberDetailPage';
import AdminOrderDetailPage from '../pages/admin/AdminOrderDetailPage';
import AdminTransactionsPage from '../pages/admin/AdminTransactionsPage';

const AdminRoutes = () => {
  return (
    <Routes>
      {/* All admin child pages render inside the AdminLayout shell */}
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />

        {/* 📦 Package Sales & Member Activations Analytics */}
        <Route path="package-sales" element={<AdminPackageAnalyticsPage />} />

        {/* Core Administrative Pages */}
        <Route path="members" element={<AdminMembersPage />} />
        <Route path="members/:id" element={<AdminMemberDetailPage />} />
        <Route path="packages" element={<AdminPackagesPage />} />
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="orders/:id" element={<AdminOrderDetailPage />} />
        <Route path="transactions" element={<AdminTransactionsPage />} />
        <Route path="withdrawals" element={<AdminWithdrawalsPage />} />
        <Route path="ranks" element={<AdminRanksPage />} />
        <Route path="funds" element={<AdminFundsPage />} />
        <Route path="franchise" element={<AdminFranchisePage />} />
        <Route path="settings" element={<AdminSettingsPage />} />

        {/* Previously orphaned sidebar links (page existed, no route) */}
        <Route path="package-sales-report" element={<AdminPackageSalesReport />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="campaigns" element={<AdminCampaignsPage />} />
        <Route path="notifications" element={<AdminNotificationsPage />} />
        <Route path="audit" element={<AdminAuditLogsPage />} />
        <Route path="alerts" element={<AdminAlertsPage />} />
        <Route path="income-history" element={<AdminIncomeHistoryPage />} />

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
};

export default AdminRoutes;