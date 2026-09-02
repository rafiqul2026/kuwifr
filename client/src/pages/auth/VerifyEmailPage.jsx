import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AuthPages.module.css';

const VerifyEmailPage = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState(null);
  const { showNotification } = useNotification();

  useEffect(() => {
    verifyEmail();
  }, [token]);

  const verifyEmail = async () => {
    try {
      const response = await api.get(`/api/auth/verify-email/${token}`);
      if (response.data.success) {
        setVerified(true);
        showNotification('Email verified successfully!', 'success');
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Verification failed';
      setError(message);
      showNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.authPage}>
        <div className={styles.authContainer}>
          <div className={styles.authCard}>
            <div className={styles.authHeader}>
              <div className={styles.spinner}></div>
              <h1>Verifying...</h1>
              <p>Please wait while we verify your email.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.authPage}>
        <div className={styles.authContainer}>
          <div className={styles.authCard}>
            <div className={styles.authHeader}>
              <div className={styles.errorIcon}>❌</div>
              <h1>Verification Failed</h1>
              <p>{error}</p>
            </div>
            <div className={styles.authFooter}>
              <p>
                <Link to="/login">Go to Login</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.authPage}>
      <div className={styles.authContainer}>
        <div className={styles.authCard}>
          <div className={styles.authHeader}>
            <div className={styles.successIcon}>✅</div>
            <h1>Email Verified!</h1>
            <p>Your email has been successfully verified.</p>
          </div>
          <div className={styles.authFooter}>
            <p>
              <Link to="/login">Go to Login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;