// client/src/pages/auth/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../hooks/useNotification';
import styles from './AuthPages.module.css';

const LoginPage = () => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const { login } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/member/dashboard';

  useEffect(() => {
    const savedUserId = localStorage.getItem('rememberedUserId');
    if (savedUserId) {
      setUserId(savedUserId);
      setRememberMe(true);
    }
  }, []);

  const validateField = (name, value) => {
    switch (name) {
      case 'userId':
        if (!value || !value.trim()) return 'User ID is required (e.g. KFR123456)';
        return '';
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 6) return 'Password must be at least 6 characters';
        return '';
      default:
        return '';
    }
  };

  const handleUserIdChange = (e) => {
    const value = e.target.value.toUpperCase();
    setUserId(value);
    if (touched.userId) {
      const error = validateField('userId', value);
      setErrors((prev) => ({ ...prev, userId: error }));
    }
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);
    if (touched.password) {
      const error = validateField('password', value);
      setErrors((prev) => ({ ...prev, password: error }));
    }
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, field === 'userId' ? userId : password);
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setTouched({ userId: true, password: true });

    const userIdError = validateField('userId', userId);
    const passwordError = validateField('password', password);

    if (userIdError || passwordError) {
      setErrors({ userId: userIdError, password: passwordError });
      showNotification('Please enter both User ID and Password', 'error');
      return;
    }

    setLoading(true);

    try {
      const result = await login(userId.trim(), password);

      if (result.success) {
        if (rememberMe) {
          localStorage.setItem('rememberedUserId', userId.trim());
        } else {
          localStorage.removeItem('rememberedUserId');
        }

        const userRole = result.data?.user?.role;
        if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
          navigate('/admin/dashboard');
        } else {
          navigate(from);
        }
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed. Please try again.';
      showNotification(message, 'error');
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
            <h1>Welcome Back</h1>
            <p>Login with your User ID (KFRxxxxxx)</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.authForm} noValidate>
            <div className={styles.formGroup}>
              <label htmlFor="userId">
                User ID <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                id="userId"
                name="userId"
                value={userId}
                onChange={handleUserIdChange}
                onBlur={() => handleBlur('userId')}
                placeholder="e.g. KFR635174"
                className={touched.userId && errors.userId ? styles.error : ''}
                disabled={loading}
                autoComplete="username"
                autoFocus
              />
              {touched.userId && errors.userId && (
                <span className={styles.errorMessage}>{errors.userId}</span>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password">
                Password <span className={styles.required}>*</span>
              </label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={password}
                  onChange={handlePasswordChange}
                  onBlur={() => handleBlur('password')}
                  placeholder="Enter your password"
                  className={touched.password && errors.password ? styles.error : ''}
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {touched.password && errors.password && (
                <span className={styles.errorMessage}>{errors.password}</span>
              )}
            </div>

            <div className={styles.formOptions}>
              <label className={styles.rememberMe}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                />
                Remember User ID
              </label>
              <Link to="/forgot-password" className={styles.forgotLink}>
                Forgot Password?
              </Link>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? (
                <span className={styles.loadingSpinner}>
                  <span className={styles.spinner}></span>
                  Logging in...
                </span>
              ) : (
                'Login with User ID'
              )}
            </button>
          </form>

          <div className={styles.authFooter}>
            <p>
              Don't have an account? <Link to="/register">Register Now</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;