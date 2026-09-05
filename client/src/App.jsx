// client/src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Context Providers
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { ShopProvider } from './context/ShopContext';

// Global E-Commerce Slide-Over Drawers
import CartSlideOver from './components/public/CartSlideOver';
import WishlistSlideOver from './components/public/WishlistSlideOver';
import ShopPage from './pages/public/ShopPage';

// Public & Auth Pages
import PublicRoutes from './routes/PublicRoutes';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';

// Protected Dashboards
import MemberRoutes from './routes/MemberRoutes';
import AdminRoutes from './routes/AdminRoutes';
import ProtectedRoute from './routes/ProtectedRoute';

import './App.css';

/**
 * 🧭 Intelligent Portal Dispatcher
 * Evaluates authentication status and directs traffic immediately:
 * - Unauthenticated -> /login
 * - ADMIN / SUPER_ADMIN -> /admin/dashboard
 * - MEMBER -> /member/dashboard
 */
const DashboardRedirector = () => {
  const { isAuthenticated, user, loading } = useAuth();

  // Clean micro-loader during token rehydration to avoid blank screens
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{
          width: '42px',
          height: '42px',
          border: '3.5px solid #e2e8f0',
          borderTopColor: '#2563eb',
          borderRadius: '50%',
          animation: 'spin 0.75s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ marginTop: '16px', fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
          Verifying security credentials...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const role = (user?.role || '').toUpperCase();
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Navigate to="/member/dashboard" replace />;
};

function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <ThemeProvider>
          <ShopProvider>
            <BrowserRouter>
              <div className="app">
                {/* Global Drawer Drawers Accessible Everywhere */}
                <CartSlideOver />
                <WishlistSlideOver />

                <Routes>
                  {/* ================= 1. PUBLIC AUTHENTICATION ROUTES ================= */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/admin/login" element={<LoginPage isAdminLogin={true} />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
                  <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
                  <Route path="/shop" element={<ShopPage />} />

                  {/* ================= 2. UNIVERSAL PORTAL RESOLVERS ================= */}
                  {/* Catch /dashboard, /portal, or root aliases to prevent broken 404 footers */}
                  <Route path="/dashboard" element={<DashboardRedirector />} />
                  <Route path="/portal" element={<DashboardRedirector />} />
                  <Route path="/member" element={<Navigate to="/member/dashboard" replace />} />
                  <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

                  {/* ================= 3. PROTECTED MEMBER PORTAL ================= */}
                  <Route 
                    path="/member/*" 
                    element={
                      <ProtectedRoute requiredRole="MEMBER">
                        <MemberRoutes />
                      </ProtectedRoute>
                    } 
                  />

                  {/* ================= 4. PROTECTED ADMIN PORTAL ================= */}
                  <Route 
                    path="/admin/*" 
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <AdminRoutes />
                      </ProtectedRoute>
                    } 
                  />

                  {/* ================= 5. STOREFRONT & PUBLIC CATCH-ALL ================= */}
                  {/* Must remain the last route */}
                  <Route path="/*" element={<PublicRoutes />} />
                </Routes>
              </div>
            </BrowserRouter>
          </ShopProvider>
        </ThemeProvider>
      </AuthProvider>
    </NotificationProvider>
  );
}

export default App;