// client/src/routes/AdminRoutes.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';

import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import AdminMembersPage from '../pages/admin/AdminMembersPage';
import AdminPackagesPage from '../pages/admin/AdminPackagesPage';
import AdminProductsPage from '../pages/admin/AdminProductsPage';
import AdminOrdersPage from '../pages/admin/AdminOrdersPage';
import AdminWithdrawalsPage from '../pages/admin/AdminWithdrawalsPage';
import AdminRanksPage from '../pages/admin/AdminRanksPage';
import AdminFundsPage from '../pages/admin/AdminFundsPage';
import AdminRulesPage from '../pages/admin/AdminRulesPage';
import AdminReportsPage from '../pages/admin/AdminReportsPage';
import AdminCampaignsPage from '../pages/admin/AdminCampaignsPage';
import AdminNotificationsPage from '../pages/admin/AdminNotificationsPage';
import AdminSettingsPage from '../pages/admin/AdminSettingsPage';
import AdminAuditLogsPage from '../pages/admin/AdminAuditLogsPage';

const AdminRoutes = () => {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="members" element={<AdminMembersPage />} />
        <Route path="members/:id" element={<AdminMembersPage />} />
        <Route path="packages" element={<AdminPackagesPage />} />
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="orders/:id" element={<AdminOrdersPage />} />
        <Route path="withdrawals" element={<AdminWithdrawalsPage />} />
        <Route path="withdrawals/:id" element={<AdminWithdrawalsPage />} />
        <Route path="ranks" element={<AdminRanksPage />} />
        <Route path="funds" element={<AdminFundsPage />} />
        <Route path="rules" element={<AdminRulesPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="campaigns" element={<AdminCampaignsPage />} />
        <Route path="notifications" element={<AdminNotificationsPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="audit" element={<AdminAuditLogsPage />} />
        
        {/* Catch unmatched subroutes inside /admin/* */}
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Route>
    </Routes>
  );
};

export default AdminRoutes;