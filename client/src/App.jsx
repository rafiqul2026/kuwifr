// client/src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Context Providers
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { ShopProvider } from './context/ShopContext';

// Global E-Commerce Slide-Over Drawers
import CartSlideOver from './components/public/CartSlideOver';
import WishlistSlideOver from './components/public/WishlistSlideOver';

// Public & Auth Routes / Pages
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

function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <ThemeProvider>
          <ShopProvider>
            <BrowserRouter>
              <div className="app">
                {/* Global Drawers accessible from Header on any page */}
                <CartSlideOver />
                <WishlistSlideOver />

                <Routes>
                  {/* Public Authentication Routes */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/admin/login" element={<LoginPage isAdminLogin={true} />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
                  <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
                  
                  {/* Protected Member Dashboard */}
                  <Route 
                    path="/member/*" 
                    element={
                      <ProtectedRoute requiredRole="MEMBER">
                        <MemberRoutes />
                      </ProtectedRoute>
                    } 
                  />
                  
                  {/* Protected Admin Dashboard */}
                  <Route 
                    path="/admin/*" 
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <AdminRoutes />
                      </ProtectedRoute>
                    } 
                  />

                  {/* Catch-all Public Website & Store Routes (MUST be last) */}
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