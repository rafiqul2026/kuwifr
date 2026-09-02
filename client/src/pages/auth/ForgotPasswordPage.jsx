// client/src/pages/auth/ForgotPasswordPage.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotification } from '../../hooks/useNotification';
import api from '../../services/api';
import styles from './AuthPages.module.css';

const ForgotPasswordPage = () => {
  const [step, setStep] = useState(1); // 1: Request OTP, 2: Enter OTP & New Password
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { showNotification } = useNotification();
  const navigate = useNavigate();

  // Step 1: Send OTP to email
  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      showNotification('Please enter your User ID or Email', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/auth/forgot-password/send-otp', {
        identifier: identifier.trim()
      });

      if (res.data.success) {
        showNotification(res.data.message, 'success');
        setStep(2);
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to send OTP', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      showNotification('Passwords do not match', 'error');
      return;
    }

    if (newPassword.length < 8) {
      showNotification('Password must be at least 8 characters', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/auth/forgot-password/reset', {
        identifier: identifier.trim(),
        otp: otp.trim(),
        newPassword
      });

      if (res.data.success) {
        showNotification('Password reset successfully! Please login with your new password.', 'success');
        navigate('/login');
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to reset password', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.authContainer}>
        <div className={styles.authCard}>
          <div className={styles.authHeader}>
            <div className={styles.authLogo}>🔐</div>
            <h1>Reset Password</h1>
            <p>{step === 1 ? 'Enter your User ID or registered Email to receive an OTP' : 'Enter the 6-digit OTP sent to your email'}</p>
          </div>

          {step === 1 ? (
            <form onSubmit={handleSendOTP} className={styles.authForm}>
              <div className={styles.formGroup}>
                <label>User ID or Email Address *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KFR635174 or your email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? 'Sending OTP...' : 'Send OTP to Email'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className={styles.authForm}>
              <div className={styles.formGroup}>
                <label>6-Digit Email OTP *</label>
                <input
                  type="text"
                  required
                  maxLength="6"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  style={{ letterSpacing: '4px', fontSize: '18px', textAlign: 'center' }}
                />
              </div>

              <div className={styles.formGroup}>
                <label>New Password *</label>
                <input
                  type="password"
                  required
                  minLength="8"
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Confirm New Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? 'Resetting Password...' : 'Verify OTP & Reset Password'}
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '13px',
                  marginTop: '8px',
                  cursor: 'pointer'
                }}
              >
                ← Back to enter ID / Email
              </button>
            </form>
          )}

          <div className={styles.authFooter}>
            <p>
              Remember your password? <Link to="/login">Sign In</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;