// client/src/routes/MemberRoutes.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Member Portal Pages
import DashboardPage from "../pages/member/DashboardPage";
import ProfilePage from "../pages/member/ProfilePage";
import KYCPage from "../pages/member/KYCPage";
import WalletPage from "../pages/member/WalletPage";
import BonanzaPage from "../pages/member/BonanzaPage";
import RepurchasePage from "../pages/member/RepurchasePage";
import IncomePage from "../pages/member/IncomePage";
import TeamPage from "../pages/member/TeamPage";
import GrowthGenerationPage from "../pages/member/GrowthGenerationPage";
import PackagesPage from "../pages/member/PackagesPage";
import UpgradePackagePage from "../pages/member/UpgradePackagePage";
import OrdersPage from "../pages/member/OrdersPage";
import WithdrawalsPage from "../pages/member/WithdrawalsPage";
import RanksPage from "../pages/member/RanksPage";
import NotificationsPage from "../pages/member/NotificationsPage";
import SupportPage from "../pages/member/SupportPage";

import MemberLayout from "../components/layout/MemberLayout";

const MemberRoutes = () => {
  return (
    <Routes>
      <Route element={<MemberLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />

        {/* Profile & Sub-routes */}
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/kyc" element={<KYCPage />} />
        <Route path="kyc" element={<KYCPage />} />

        {/* Financial & Team Routes */}
        <Route path="wallet" element={<WalletPage />} />
        <Route path="bonanza" element={<BonanzaPage />} />
        <Route path="repurchase" element={<RepurchasePage />} />
        <Route path="income" element={<IncomePage />} />
        <Route path="team" element={<TeamPage />} />

        {/* Growth Generation Routes */}
        <Route path="growth-generation" element={<GrowthGenerationPage />} />
        <Route path="growth-map" element={<Navigate to="../growth-generation" replace />} />
        <Route path="binary" element={<Navigate to="../growth-generation" replace />} />
        <Route path="genealogy" element={<Navigate to="../growth-generation" replace />} />

        {/* Package Routes */}
        <Route path="packages" element={<PackagesPage />} />
        <Route path="packages/upgrade" element={<UpgradePackagePage />} />

        {/* Financial & Support Routes */}
        <Route path="orders" element={<OrdersPage />} />
        <Route path="withdrawals" element={<WithdrawalsPage />} />
        <Route path="ranks" element={<RanksPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="support" element={<SupportPage />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
};

export default MemberRoutes;