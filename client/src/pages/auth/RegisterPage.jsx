// client/src/pages/auth/RegisterPage.jsx

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../hooks/useNotification';
import api from '../../services/api';
import styles from './AuthPages.module.css';

/**
 * ============================================================
 * KUWIFR REFERRAL SIDE PARSER
 * ============================================================
 *
 * Supported referral URLs:
 *
 * ?pos=L
 * ?pos=R
 *
 * ?pos=LEFT
 * ?pos=RIGHT
 *
 * ?side=L
 * ?side=R
 *
 * ?position=L
 * ?position=R
 *
 * Numeric support:
 *
 * ?pos=1 -> LEFT
 * ?pos=2 -> RIGHT
 *
 * IMPORTANT:
 * A valid RIGHT value must NEVER be converted to LEFT.
 * ============================================================
 */
const parseSideFromUrl = (searchStr = '') => {
  try {
    let rawQuery = searchStr;

    // Always use the actual browser URL if no search string
    // was supplied.
    if (!rawQuery && typeof window !== 'undefined') {
      rawQuery = window.location.search || '';
    }

    // Remove leading "?" if present.
    rawQuery = String(rawQuery).replace(/^\?/, '');

    const params = new URLSearchParams(rawQuery);

    /**
     * Read supported parameter names.
     *
     * We intentionally use ?? instead of || so that the
     * first existing parameter is respected.
     */
    const rawValue =
      params.get('pos') ??
      params.get('side') ??
      params.get('position') ??
      '';

    const value = String(rawValue).trim().toUpperCase();

    /**
     * --------------------------------------------------------
     * RIGHT
     * --------------------------------------------------------
     */
    if (
      value === 'R' ||
      value === 'RIGHT' ||
      value === '2'
    ) {
      return 'RIGHT';
    }

    /**
     * --------------------------------------------------------
     * LEFT
     * --------------------------------------------------------
     */
    if (
      value === 'L' ||
      value === 'LEFT' ||
      value === '1'
    ) {
      return 'LEFT';
    }

    /**
     * --------------------------------------------------------
     * Additional defensive URL matching
     * --------------------------------------------------------
     *
     * This protects against unusual query-string handling.
     */
    const rightMatch = rawQuery.match(
      /(?:^|&)(?:pos|side|position)=(?:R|RIGHT|2)(?:&|$)/i
    );

    if (rightMatch) {
      return 'RIGHT';
    }

    const leftMatch = rawQuery.match(
      /(?:^|&)(?:pos|side|position)=(?:L|LEFT|1)(?:&|$)/i
    );

    if (leftMatch) {
      return 'LEFT';
    }

    /**
     * No valid side found.
     *
     * Existing application behavior is preserved:
     * default to LEFT.
     */
    console.warn(
      '[KUWIFR REGISTER] No valid referral side found. Defaulting to LEFT.',
      {
        rawQuery,
        detectedValue: value
      }
    );
  } catch (error) {
    console.error(
      '[KUWIFR REGISTER] Error parsing referral side:',
      error
    );
  }

  return 'LEFT';
};

/**
 * ============================================================
 * KUWIFR SPONSOR ID PARSER
 * ============================================================
 *
 * Supported:
 *
 * ?ref=KFR665384
 * ?sponsor=KFR665384
 * ?sponsorId=KFR665384
 * ============================================================
 */
const parseSponsorFromUrl = (searchStr = '') => {
  try {
    let rawQuery = searchStr;

    if (!rawQuery && typeof window !== 'undefined') {
      rawQuery = window.location.search || '';
    }

    rawQuery = String(rawQuery).replace(/^\?/, '');

    const params = new URLSearchParams(rawQuery);

    const sponsor =
      params.get('ref') ??
      params.get('sponsor') ??
      params.get('sponsorId') ??
      '';

    return String(sponsor).trim().toUpperCase();
  } catch (error) {
    console.error(
      '[KUWIFR REGISTER] Error parsing sponsor ID:',
      error
    );

    return '';
  }
};

const RegisterPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  /**
   * ==========================================================
   * RESOLVE CURRENT URL
   * ==========================================================
   */
  const currentSearch =
    location.search ||
    (typeof window !== 'undefined'
      ? window.location.search
      : '');

  const activeSide = parseSideFromUrl(currentSearch);
  const activeSponsor = parseSponsorFromUrl(currentSearch);

  /**
   * ==========================================================
   * FORM STATE
   * ==========================================================
   */
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    sponsorId: activeSponsor,
    side: activeSide
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  /**
   * ==========================================================
   * WELCOME MODAL STATE
   * ==========================================================
   */
  const [showWelcomeModal, setShowWelcomeModal] =
    useState(false);

  const [registeredData, setRegisteredData] = useState({
    fullName: '',
    memberId: '',
    password: ''
  });

  const { register } = useAuth();
  const { showNotification } = useNotification();

  /**
   * Used to prevent unnecessary repeated sponsor verification.
   */
  const verifiedRef = useRef('');

  /**
   * ==========================================================
   * URL CHANGE EFFECT
   * ==========================================================
   *
   * Whenever React Router detects a new query string:
   *
   * ?pos=L -> LEFT
   * ?pos=R -> RIGHT
   *
   * the form state is updated immediately.
   * ==========================================================
   */
  useEffect(() => {
    const query =
      location.search ||
      (typeof window !== 'undefined'
        ? window.location.search
        : '');

    const resolvedSide = parseSideFromUrl(query);
    const resolvedSponsor = parseSponsorFromUrl(query);

    /**
     * DEBUG LOG
     *
     * For:
     * ?ref=KFR665384&pos=R
     *
     * this MUST show:
     *
     * resolvedSide: "RIGHT"
     */
    console.log(
      '[KUWIFR REGISTER] Referral URL detected:',
      {
        query,
        resolvedSponsor,
        resolvedSide
      }
    );

    setFormData((prev) => ({
      ...prev,
      sponsorId: resolvedSponsor,
      side: resolvedSide
    }));

    /**
     * Verify sponsor only when we actually have one.
     */
    if (
      resolvedSponsor &&
      verifiedRef.current !== resolvedSponsor
    ) {
      verifiedRef.current = resolvedSponsor;

      api
        .get(
          `/api/users/verify-sponsor/${encodeURIComponent(
            resolvedSponsor
          )}`
        )
        .catch(() => {
          showNotification(
            'Sponsor ID not found or inactive',
            'error'
          );
        });
    }
  }, [location.search, showNotification]);

  /**
   * ==========================================================
   * FIELD VALIDATION
   * ==========================================================
   */
  const validateField = (name, value) => {
    switch (name) {
      case 'fullName':
        if (!value || value.trim().length < 2) {
          return 'Full name must be at least 2 characters';
        }

        return '';

      case 'email':
        if (!value) {
          return 'Email is required';
        }

        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ) {
          return 'Please enter a valid email address';
        }

        return '';

      case 'phoneNumber':
        if (!value) {
          return 'Phone number is required';
        }

        if (!/^[0-9]{10}$/.test(value)) {
          return 'Please enter a valid 10-digit phone number';
        }

        return '';

      case 'password':
        if (!value) {
          return 'Password is required';
        }

        if (value.length < 8) {
          return 'Password must be at least 8 characters';
        }

        return '';

      case 'confirmPassword':
        if (!value) {
          return 'Please confirm your password';
        }

        if (value !== formData.password) {
          return 'Passwords do not match';
        }

        return '';

      default:
        return '';
    }
  };

  /**
   * ==========================================================
   * INPUT CHANGE
   * ==========================================================
   */
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  /**
   * ==========================================================
   * INPUT BLUR
   * ==========================================================
   */
  const handleBlur = (e) => {
    const { name, value } = e.target;

    setTouched((prev) => ({
      ...prev,
      [name]: true
    }));

    const error = validateField(name, value);

    if (error) {
      setErrors((prev) => ({
        ...prev,
        [name]: error
      }));
    }
  };

  /**
   * ==========================================================
   * FORM VALIDATION
   * ==========================================================
   */
  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    [
      'fullName',
      'email',
      'phoneNumber',
      'password',
      'confirmPassword'
    ].forEach((field) => {
      const error = validateField(
        field,
        formData[field]
      );

      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);

    return isValid;
  };

  /**
   * ==========================================================
   * FORM SUBMIT
   * ==========================================================
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    /**
     * Mark all fields as touched.
     */
    const allTouched = {};

    Object.keys(formData).forEach((key) => {
      allTouched[key] = true;
    });

    setTouched(allTouched);

    /**
     * Validate.
     */
    if (!validateForm()) {
      showNotification(
        'Please resolve all form errors before submitting',
        'error'
      );

      return;
    }

    setLoading(true);

    try {
      /**
       * Remove confirmPassword from backend payload.
       */
      const {
        confirmPassword,
        ...registrationData
      } = formData;

      /**
       * ======================================================
       * FINAL SIDE NORMALIZATION
       * ======================================================
       *
       * RIGHT is only RIGHT when explicitly detected.
       * Otherwise LEFT is used.
       */
      const finalSide =
        String(
          formData.side || activeSide || 'LEFT'
        )
          .trim()
          .toUpperCase() === 'RIGHT'
          ? 'RIGHT'
          : 'LEFT';

      /**
       * ======================================================
       * REGISTRATION PAYLOAD
       * ======================================================
       *
       * We send the side in several common formats so the
       * existing backend can consume the appropriate field.
       */
      const payload = {
        ...registrationData,

        // Existing/common format
        side: finalSide.toLowerCase(),

        // Explicit binary side
        binarySide: finalSide,

        // Explicit position
        position: finalSide,

        // URL-style compact position
        pos:
          finalSide === 'RIGHT'
            ? 'R'
            : 'L'
      };

      /**
       * DEBUG LOG
       *
       * RIGHT referral should produce:
       *
       * {
       *   side: "right",
       *   binarySide: "RIGHT",
       *   position: "RIGHT",
       *   pos: "R"
       * }
       */
      console.log(
        '[KUWIFR REGISTER] Registration payload:',
        payload
      );

      const result = await register(payload);

      if (result?.success) {
        const assignedId =
          result.data?.user?.memberId ||
          result.data?.memberId ||
          'KFR' +
            Math.floor(
              100000 + Math.random() * 900000
            );

        setRegisteredData({
          fullName: formData.fullName,
          memberId: assignedId,
          password: formData.password
        });

        setShowWelcomeModal(true);
      }
    } catch (error) {
      const message =
        error.response?.data?.message ||
        'Registration failed. Please check details.';

      showNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * ==========================================================
   * COPY CREDENTIALS
   * ==========================================================
   */
  const handleCopyCredentials = () => {
    const textToCopy =
      `Welcome to Kuwifr Services Pvt. Ltd.!\n` +
      `Name: ${registeredData.fullName}\n` +
      `User ID: ${registeredData.memberId}\n` +
      `Password: ${registeredData.password}\n` +
      `Login at: ${window.location.origin}/login`;

    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        showNotification(
          'Credentials copied to clipboard!',
          'success'
        );
      })
      .catch(() => {
        showNotification(
          'Unable to copy credentials',
          'error'
        );
      });
  };

  /**
   * ==========================================================
   * PROCEED TO LOGIN
   * ==========================================================
   */
  const handleProceedToLogin = () => {
    setShowWelcomeModal(false);
    navigate('/login');
  };

  /**
   * ==========================================================
   * FINAL DISPLAY VALUES
   * ==========================================================
   *
   * These values control what is actually rendered in the
   * sponsor banner.
   */
  const renderedSide =
    String(formData.side || activeSide || 'LEFT')
      .trim()
      .toUpperCase() === 'RIGHT'
      ? 'RIGHT'
      : 'LEFT';

  const renderedSponsor =
    formData.sponsorId || activeSponsor;

  /**
   * ==========================================================
   * RENDER
   * ==========================================================
   */
  return (
    <div className={styles.authPage}>
      <div className={styles.authContainer}>
        <div className={styles.authCard}>

          {/* ==================================================
              AUTH HEADER
              ================================================== */}
          <div className={styles.authHeader}>
            <div className={styles.authLogo}>
              🚀
            </div>

            <h1>Create Account</h1>

            <p>
              Join KUWIFR and start your journey to success
            </p>
          </div>

          {/* ==================================================
              DYNAMIC SPONSOR / REFERRAL BANNER
              ================================================== */}
          {renderedSponsor && (
            <div
              className={styles.sponsorBanner}
              style={{
                background:
                  renderedSide === 'LEFT'
                    ? '#eff6ff'
                    : '#fdf2f8',

                border:
                  renderedSide === 'LEFT'
                    ? '1.5px solid #93c5fd'
                    : '1.5px solid #f9a8d4',

                padding: '14px 18px',
                borderRadius: '12px',
                marginBottom: '22px',

                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              {/* Icon */}
              <span
                style={{
                  fontSize: '22px'
                }}
              >
                👤
              </span>

              {/* Sponsor Information */}
              <div>
                <strong
                  style={{
                    color:
                      renderedSide === 'LEFT'
                        ? '#1d4ed8'
                        : '#be185d',

                    fontSize: '14.5px',
                    letterSpacing: '0.4px',
                    display: 'block'
                  }}
                >
                  Sponsor ID: {renderedSponsor} | Side:{' '}
                  {renderedSide}
                </strong>
              </div>
            </div>
          )}

          {/* ==================================================
              REGISTRATION FORM
              ================================================== */}
          <form
            onSubmit={handleSubmit}
            className={styles.authForm}
            noValidate
          >

            {/* ==================================================
                FULL NAME
                ================================================== */}
            <div className={styles.formGroup}>
              <label htmlFor="fullName">
                Full Name{' '}
                <span className={styles.required}>
                  *
                </span>
              </label>

              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Enter your full name"
                className={
                  touched.fullName &&
                  errors.fullName
                    ? styles.error
                    : ''
                }
                disabled={loading}
                autoComplete="name"
              />

              {touched.fullName &&
                errors.fullName && (
                  <span
                    className={styles.errorMessage}
                  >
                    {errors.fullName}
                  </span>
                )}
            </div>

            {/* ==================================================
                EMAIL
                ================================================== */}
            <div className={styles.formGroup}>
              <label htmlFor="email">
                Email Address (For OTP & Notices){' '}
                <span className={styles.required}>
                  *
                </span>
              </label>

              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Enter your email address"
                className={
                  touched.email && errors.email
                    ? styles.error
                    : ''
                }
                disabled={loading}
                autoComplete="email"
              />

              {touched.email &&
                errors.email && (
                  <span
                    className={styles.errorMessage}
                  >
                    {errors.email}
                  </span>
                )}
            </div>

            {/* ==================================================
                PHONE NUMBER
                ================================================== */}
            <div className={styles.formGroup}>
              <label htmlFor="phoneNumber">
                Phone Number{' '}
                <span className={styles.required}>
                  *
                </span>
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
                inputMode="numeric"
                className={
                  touched.phoneNumber &&
                  errors.phoneNumber
                    ? styles.error
                    : ''
                }
                disabled={loading}
                autoComplete="tel"
              />

              {touched.phoneNumber &&
                errors.phoneNumber && (
                  <span
                    className={styles.errorMessage}
                  >
                    {errors.phoneNumber}
                  </span>
                )}
            </div>

            {/* ==================================================
                PASSWORD
                ================================================== */}
            <div className={styles.formGroup}>
              <label htmlFor="password">
                Password{' '}
                <span className={styles.required}>
                  *
                </span>
              </label>

              <div
                className={styles.passwordWrapper}
              >
                <input
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Create a strong password (min 8 chars)"
                  className={
                    touched.password &&
                    errors.password
                      ? styles.error
                      : ''
                  }
                  disabled={loading}
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  className={
                    styles.passwordToggle
                  }
                  onClick={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                >
                  {showPassword
                    ? '🙈'
                    : '👁️'}
                </button>
              </div>

              {touched.password &&
                errors.password && (
                  <span
                    className={styles.errorMessage}
                  >
                    {errors.password}
                  </span>
                )}
            </div>

            {/* ==================================================
                CONFIRM PASSWORD
                ================================================== */}
            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword">
                Confirm Password{' '}
                <span className={styles.required}>
                  *
                </span>
              </label>

              <div
                className={styles.passwordWrapper}
              >
                <input
                  type={
                    showConfirmPassword
                      ? 'text'
                      : 'password'
                  }
                  id="confirmPassword"
                  name="confirmPassword"
                  value={
                    formData.confirmPassword
                  }
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Re-enter your password"
                  className={
                    touched.confirmPassword &&
                    errors.confirmPassword
                      ? styles.error
                      : ''
                  }
                  disabled={loading}
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  className={
                    styles.passwordToggle
                  }
                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                  aria-label={
                    showConfirmPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                >
                  {showConfirmPassword
                    ? '🙈'
                    : '👁️'}
                </button>
              </div>

              {touched.confirmPassword &&
                errors.confirmPassword && (
                  <span
                    className={styles.errorMessage}
                  >
                    {errors.confirmPassword}
                  </span>
                )}

              {formData.confirmPassword &&
                formData.password &&
                formData.password ===
                  formData.confirmPassword && (
                  <span
                    className={
                      styles.successMessage
                    }
                  >
                    ✅ Passwords match
                  </span>
                )}
            </div>

            {/* ==================================================
                CREATE ACCOUNT BUTTON
                ================================================== */}
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
              style={{
                marginTop: '10px'
              }}
            >
              {loading ? (
                <span
                  className={
                    styles.loadingSpinner
                  }
                >
                  <span
                    className={styles.spinner}
                  ></span>

                  Creating Account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* ==================================================
              AUTH FOOTER
              ================================================== */}
          <div className={styles.authFooter}>
            <p>
              Already have an account?{' '}
              <Link to="/login">
                Sign In with User ID
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* ======================================================
          WELCOME / REGISTRATION SUCCESS MODAL
          ====================================================== */}
      {showWelcomeModal && (
        <div
          className={
            styles.welcomeModalOverlay
          }
        >
          <div
            className={
              styles.welcomeModalCard
            }
          >

            {/* ==================================================
                MODAL HEADER
                ================================================== */}
            <div
              className={
                styles.welcomeModalHeader
              }
            >
              <div
                className={
                  styles.welcomeModalIcon
                }
              >
                🎉
              </div>

              <h2>
                Registration Successful!
              </h2>

              <span
                className={
                  styles.welcomeCompanyBadge
                }
              >
                KUWIFR SERVICES PVT. LTD.
              </span>
            </div>

            {/* ==================================================
                MODAL BODY
                ================================================== */}
            <div
              className={
                styles.welcomeModalBody
              }
            >
              <div
                className={
                  styles.welcomeMessageBlock
                }
              >
                <p>
                  Dear{' '}
                  <strong>
                    {registeredData.fullName}
                  </strong>
                  ,
                </p>

                <p>
                  Welcome to{' '}
                  <strong>
                    Kuwifr Services Pvt. Ltd.
                  </strong>
                  ! Your distributor membership
                  account has been successfully
                  created.
                </p>

                <p
                  className={
                    styles.saveNotice
                  }
                >
                  ⚠️ Please save your official
                  account credentials below for
                  sign in:
                </p>
              </div>

              {/* ==================================================
                  CREDENTIALS
                  ================================================== */}
              <div
                className={
                  styles.credentialsDisplayBox
                }
              >
                <div
                  className={
                    styles.credItemRow
                  }
                >
                  <span
                    className={
                      styles.credFieldLabel
                    }
                  >
                    User ID:
                  </span>

                  <strong
                    className={
                      styles.credFieldValue
                    }
                  >
                    {registeredData.memberId}
                  </strong>
                </div>

                <div
                  className={
                    styles.credItemDivider
                  }
                ></div>

                <div
                  className={
                    styles.credItemRow
                  }
                >
                  <span
                    className={
                      styles.credFieldLabel
                    }
                  >
                    Password:
                  </span>

                  <strong
                    className={
                      styles.credFieldValue
                    }
                  >
                    {registeredData.password}
                  </strong>
                </div>
              </div>

              {/* ==================================================
                  MODAL ACTIONS
                  ================================================== */}
              <div
                className={
                  styles.welcomeModalActions
                }
              >
                <button
                  type="button"
                  className={
                    styles.copyCredBtn
                  }
                  onClick={
                    handleCopyCredentials
                  }
                >
                  📋 Copy User ID & Password
                </button>

                <button
                  type="button"
                  className={
                    styles.proceedLoginBtn
                  }
                  onClick={
                    handleProceedToLogin
                  }
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