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
        <Route path="packages" element={<AdminPackagesPage />} />
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="withdrawals" element={<AdminWithdrawalsPage />} />
        <Route path="ranks" element={<AdminRanksPage />} />
        <Route path="funds" element={<AdminFundsPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
};

export default AdminRoutes;