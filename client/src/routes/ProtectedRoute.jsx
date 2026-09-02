// client/src/routes/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  // Show loading indicator while auth status rehydrates from localStorage/API
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '18px',
          color: '#64748b',
          backgroundColor: '#f8fafc'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '4px solid #e2e8f0',
              borderTopColor: '#2563eb',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px'
            }}
          />
          <p style={{ fontFamily: 'sans-serif', fontWeight: 500 }}>
            Verifying authentication...
          </p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Not authenticated -> redirect to login preserving intended target
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Normalize roles to uppercase strings to avoid casing issues
  const currentRole = (user?.role || '').toUpperCase();
  const targetRole = (requiredRole || '').toUpperCase();

  // Check required permissions
  if (targetRole) {
    const isSuperAdmin = currentRole === 'SUPER_ADMIN';
    const hasRequiredRole = currentRole === targetRole;

    if (!hasRequiredRole && !isSuperAdmin) {
      // If a non-admin tries to access admin routes, redirect to their member panel or login
      if (targetRole === 'ADMIN') {
        return <Navigate to="/member/dashboard" replace />;
      }
      return <Navigate to="/login" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;