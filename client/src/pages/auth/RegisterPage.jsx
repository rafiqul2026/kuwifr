// client/src/pages/auth/RegisterPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../hooks/useNotification';
import api from '../../services/api';
import styles from './AuthPages.module.css';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    sponsorId: '',
    side: 'right'
  });

  const [sponsorName, setSponsorName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Welcome Pop-up State
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [registeredData, setRegisteredData] = useState({
    fullName: '',
    memberId: '',
    password: ''
  });

  const { register } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const verifiedRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const refCode = params.get('ref') || params.get('sponsor');
    const sideParam = params.get('side') || 'right';

    if (refCode) {
      const cleanCode = refCode.trim().toUpperCase();
      setFormData((prev) => ({
        ...prev,
        sponsorId: cleanCode,
        side: sideParam.toLowerCase()
      }));

      if (!verifiedRef.current) {
        verifiedRef.current = true;
        verifySponsor(cleanCode);
      }
    }
  }, [location.search]);

  const verifySponsor = async (code) => {
    try {
      const response = await api.get(`/api/users/verify-sponsor/${encodeURIComponent(code)}`);
      if (response.data.success && response.data.data?.sponsor) {
        const sp = response.data.data.sponsor;
        setSponsorName(sp.fullName);
        showNotification(`Sponsor verified: ${sp.fullName} (${sp.memberId})`, 'success');
      }
    } catch {
      setSponsorName('');
      showNotification('Sponsor ID not found or inactive', 'error');
    }
  };

  const validateField = (name, value) => {
    switch (name) {
      case 'fullName':
        if (!value || value.trim().length < 2) {
          return 'Full name must be at least 2 characters';
        }
        return '';
      case 'email':
        if (!value) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Please enter a valid email address';
        }
        return '';
      case 'phoneNumber':
        if (!value) return 'Phone number is required';
        if (!/^[0-9]{10}$/.test(value)) {
          return 'Please enter a valid 10-digit phone number';
        }
        return '';
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        return '';
      case 'confirmPassword':
        if (!value) return 'Please confirm your password';
        if (value !== formData.password) return 'Passwords do not match';
        return '';
      default:
        return '';
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));

    const error = validateField(name, value);
    if (error) {
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    ['fullName', 'email', 'phoneNumber', 'password', 'confirmPassword'].forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const allTouched = {};
    Object.keys(formData).forEach((key) => {
      allTouched[key] = true;
    });
    setTouched(allTouched);

    if (!validateForm()) {
      showNotification('Please resolve all form errors before submitting', 'error');
      return;
    }

    setLoading(true);
    try {
      const { confirmPassword, ...registrationData } = formData;

      const result = await register(registrationData);
      if (result.success) {
        const assignedId = result.data?.user?.memberId || result.data?.memberId || 'KFR' + Math.floor(100000 + Math.random() * 900000);
        
        setRegisteredData({
          fullName: formData.fullName,
          memberId: assignedId,
          password: formData.password
        });
        setShowWelcomeModal(true);
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed. Please check details.';
      showNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    const textToCopy = `Welcome to Kuwifr Services Pvt. Ltd.!\nName: ${registeredData.fullName}\nUser ID: ${registeredData.memberId}\nPassword: ${registeredData.password}\nLogin at: ${window.location.origin}/login`;
    navigator.clipboard.writeText(textToCopy);
    showNotification('Credentials copied to clipboard!', 'success');
  };

  const handleProceedToLogin = () => {
    setShowWelcomeModal(false);
    navigate('/login');
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.authContainer}>
        <div className={styles.authCard}>
          <div className={styles.authHeader}>
            <div className={styles.authLogo}>🚀</div>
            <h1>Create Account</h1>
            <p>Join KUWIFR and start your journey to success</p>
          </div>

          {/* Dynamic Sponsor Banner */}
          {formData.sponsorId && (
            <div
              className={styles.sponsorBanner}
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                padding: '14px 18px',
                borderRadius: '12px',
                marginBottom: '22px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <span style={{ fontSize: '22px' }}>👤</span>
              <div>
                <strong style={{ color: '#15803d', fontSize: '14px', letterSpacing: '0.3px' }}>
                  Sponsor ID: {formData.sponsorId} | Side: {formData.side?.toUpperCase() || 'RIGHT'}
                </strong>
                {sponsorName && (
                  <div style={{ fontSize: '12px', color: '#166534', fontWeight: '600' }}>
                    Sponsor Name: {sponsorName}
                  </div>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.authForm} noValidate>
            <div className={styles.formGroup}>
              <label htmlFor="fullName">
                Full Name <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Enter your full name"
                className={touched.fullName && errors.fullName ? styles.error : ''}
                disabled={loading}
              />
              {touched.fullName && errors.fullName && (
                <span className={styles.errorMessage}>{errors.fullName}</span>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="email">
                Email Address (For OTP & Notices) <span className={styles.required}>*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Enter your email address"
                className={touched.email && errors.email ? styles.error : ''}
                disabled={loading}
              />
              {touched.email && errors.email && (
                <span className={styles.errorMessage}>{errors.email}</span>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="phoneNumber">
                Phone Number <span className={styles.required}>*</span>
              </label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Enter 10-digit phone number"
                maxLength="10"
                className={touched.phoneNumber && errors.phoneNumber ? styles.error : ''}
                disabled={loading}
              />
              {touched.phoneNumber && errors.phoneNumber && (
                <span className={styles.errorMessage}>{errors.phoneNumber}</span>
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
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Create a strong password (min 8 chars)"
                  className={touched.password && errors.password ? styles.error : ''}
                  disabled={loading}
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

            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword">
                Confirm Password <span className={styles.required}>*</span>
              </label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Re-enter your password"
                  className={touched.confirmPassword && errors.confirmPassword ? styles.error : ''}
                  disabled={loading}
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {touched.confirmPassword && errors.confirmPassword && (
                <span className={styles.errorMessage}>{errors.confirmPassword}</span>
              )}
              {formData.confirmPassword && formData.password && formData.password === formData.confirmPassword && (
                <span className={styles.successMessage}>✅ Passwords match</span>
              )}
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading} style={{ marginTop: '10px' }}>
              {loading ? (
                <span className={styles.loadingSpinner}>
                  <span className={styles.spinner}></span>
                  Creating Account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className={styles.authFooter}>
            <p>
              Already have an account? <Link to="/login">Sign In with User ID</Link>
            </p>
          </div>
        </div>
      </div>

      {/* ================= WELCOME POPUP MODAL ================= */}
      {showWelcomeModal && (
        <div className={styles.welcomeModalOverlay}>
          <div className={styles.welcomeModalCard}>
            <div className={styles.welcomeModalHeader}>
              <div className={styles.welcomeModalIcon}>🎉</div>
              <h2>Registration Successful!</h2>
              <span className={styles.welcomeCompanyBadge}>KUWIFR SERVICES PVT. LTD.</span>
            </div>

            <div className={styles.welcomeModalBody}>
              <div className={styles.welcomeMessageBlock}>
                <p>
                  Dear <strong>{registeredData.fullName}</strong>,
                </p>
                <p>
                  Welcome to <strong>Kuwifr Services Pvt. Ltd.</strong>! Your distributor membership account has been successfully created.
                </p>
                <p className={styles.saveNotice}>
                  ⚠️ Please save your official account credentials below for sign in:
                </p>
              </div>

              <div className={styles.credentialsDisplayBox}>
                <div className={styles.credItemRow}>
                  <span className={styles.credFieldLabel}>User ID:</span>
                  <strong className={styles.credFieldValue}>{registeredData.memberId}</strong>
                </div>

                <div className={styles.credItemDivider}></div>

                <div className={styles.credItemRow}>
                  <span className={styles.credFieldLabel}>Password:</span>
                  <strong className={styles.credFieldValue}>{registeredData.password}</strong>
                </div>
              </div>

              <div className={styles.welcomeModalActions}>
                <button
                  type="button"
                  className={styles.copyCredBtn}
                  onClick={handleCopyCredentials}
                >
                  📋 Copy User ID & Password
                </button>

                <button
                  type="button"
                  className={styles.proceedLoginBtn}
                  onClick={handleProceedToLogin}
                >
                  Sign In with User ID →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegisterPage;