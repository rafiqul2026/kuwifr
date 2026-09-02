// client/src/routes/MemberRoutes.jsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import MemberLayout from "../components/layout/MemberLayout";

import DashboardPage from "../pages/member/DashboardPage";
import ProfilePage from "../pages/member/ProfilePage";
import KYCPage from "../pages/member/KYCPage";
import WalletPage from "../pages/member/WalletPage";
import BonanzaPage from "../pages/member/BonanzaPage";
import RepurchasePage from "../pages/member/RepurchasePage"; // <-- Repurchase Page import
import IncomePage from "../pages/member/IncomePage";
import TeamPage from "../pages/member/TeamPage";
import BinaryTreePage from "../pages/member/BinaryTreePage";
import PackagesPage from "../pages/member/PackagesPage";
import UpgradePackagePage from '../pages/member/UpgradePackagePage'
import OrdersPage from "../pages/member/OrdersPage";
import WithdrawalsPage from "../pages/member/WithdrawalsPage";
import RanksPage from "../pages/member/RanksPage";
import FundsPage from "../pages/member/FundsPage";
import NotificationsPage from "../pages/member/NotificationsPage";
import SupportPage from "../pages/member/SupportPage";

const MemberRoutes = () => {
  return (
    <Routes>
      <Route element={<MemberLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/kyc" element={<KYCPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/bonanza" element={<BonanzaPage />} />
        <Route path="/repurchase" element={<RepurchasePage />} />

        <Route path="support" element={<SupportPage />} />
        {/* 
        <-- Repurchase route */}
        <Route path="/income" element={<IncomePage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/binary" element={<BinaryTreePage />} />
        <Route path="/packages" element={<PackagesPage />} />
        <Route path="packages/upgrade" element={<UpgradePackagePage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/withdrawals" element={<WithdrawalsPage />} />
        <Route path="/ranks" element={<RanksPage />} />
        <Route path="/funds" element={<FundsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
      </Route>
    </Routes>
  );
};

export default MemberRoutes;
