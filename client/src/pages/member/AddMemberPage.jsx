// client/src/pages/member/AddMemberPage.jsx
//
// Opened from an "Open Spot" on the Growth Generation tree
// (/member/add-member?parent=<memberId>&side=left|right). Registers a new
// member as a direct referral of the logged-in member, placed at that exact
// binary spot — while keeping the logged-in member's own session intact
// (unlike the public /register page, which signs in as the new account).
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AddMemberPage.module.css';

const EMPTY_FORM = { fullName: '', email: '', phoneNumber: '', password: '', confirmPassword: '' };

const validateField = (name, value, form) => {
  switch (name) {
    case 'fullName':
      return !value || value.trim().length < 2 ? 'Full name must be at least 2 characters' : '';
    case 'email':
      if (!value) return 'Email is required';
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? '' : 'Please enter a valid email address';
    case 'phoneNumber':
      if (!value) return 'Phone number is required';
      return /^[0-9]{10}$/.test(value) ? '' : 'Please enter a valid 10-digit phone number';
    case 'password':
      if (!value) return 'Password is required';
      return value.length < 8 ? 'Password must be at least 8 characters' : '';
    case 'confirmPassword':
      if (!value) return 'Please confirm the password';
      return value !== form.password ? 'Passwords do not match' : '';
    default:
      return '';
  }
};

const AddMemberPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const { parentId, side } = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      parentId: (params.get('parent') || '').trim(),
      side: (params.get('side') || '').trim().toLowerCase()
    };
  }, [location.search]);

  const [spot, setSpot] = useState(null);
  const [spotLoading, setSpotLoading] = useState(true);
  const [spotError, setSpotError] = useState('');

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(null);

  // Confirm the spot is still genuinely open (and inside this member's own
  // network) before showing the form — a stale link, a tampered URL, or a
  // spot filled in the meantime is caught here rather than after typing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSpotLoading(true);
      setSpotError('');
      try {
        const res = await api.get('/api/auth/register-downline/spot', {
          params: { parent: parentId, side }
        });
        if (!cancelled) setSpot(res.data?.data || null);
      } catch (err) {
        if (!cancelled) {
          setSpot(null);
          setSpotError(err.response?.data?.message || 'Unable to verify this position.');
        }
      } finally {
        if (!cancelled) setSpotLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [parentId, side]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    const message = validateField(name, value, form);
    if (message) setErrors((prev) => ({ ...prev, [name]: message }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    Object.keys(EMPTY_FORM).forEach((field) => {
      const message = validateField(field, form[field], form);
      if (message) nextErrors[field] = message;
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      showNotification('Please resolve all form errors before submitting', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/api/auth/register-downline', {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim(),
        password: form.password,
        placementParentId: parentId,
        side
      });
      if (res.data?.success) {
        setRegistered({
          memberId: res.data.data.memberId,
          fullName: res.data.data.fullName,
          password: form.password
        });
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed. Please check the details.';
      showNotification(message, 'error');
      // Spot taken while filling the form — drop back to the "unavailable" state.
      if (err.response?.status === 409) setSpotError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    const text = `Welcome to Kuwifr Services Pvt. Ltd.!\nName: ${registered.fullName}\nUser ID: ${registered.memberId}\nPassword: ${registered.password}\nLogin at: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    showNotification('Credentials copied to clipboard!', 'success');
  };

  const backToTree = () => navigate('/member/growth-generation');

  if (spotLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.stateCard}>Verifying position…</div>
      </div>
    );
  }

  if (spotError || !spot) {
    return (
      <div className={styles.page}>
        <div className={styles.stateCard}>
          <span className={styles.stateIcon}>⚠️</span>
          <h2>This position isn't available</h2>
          <p>{spotError || 'This position could not be verified.'}</p>
          <button type="button" className={styles.primaryBtn} onClick={backToTree}>
            Back to Growth Generation
          </button>
        </div>
      </div>
    );
  }

  const isLeft = spot.side === 'left';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>NETWORK</span>
        <h1>Register New Member</h1>
        <p>The new member will be placed at the open spot you selected on your Growth Generation tree.</p>
      </header>

      <div className={`${styles.placementBanner} ${isLeft ? styles.bannerLeft : styles.bannerRight}`}>
        <div>
          <span className={styles.bannerLabel}>Sponsor</span>
          <strong>{spot.sponsor.fullName} ({spot.sponsor.memberId})</strong>
        </div>
        <div>
          <span className={styles.bannerLabel}>Placement</span>
          <strong>
            {isLeft ? 'LEFT' : 'RIGHT'} of {spot.parent.fullName} ({spot.parent.memberId})
          </strong>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.formCard} noValidate>
        <div className={styles.field}>
          <label htmlFor="fullName">Full Name <span>*</span></label>
          <input id="fullName" name="fullName" type="text" value={form.fullName} onChange={handleChange} onBlur={handleBlur} placeholder="Member's full name" />
          {errors.fullName && <small className={styles.error}>{errors.fullName}</small>}
        </div>

        <div className={styles.field}>
          <label htmlFor="email">Email Address <span>*</span></label>
          <input id="email" name="email" type="email" value={form.email} onChange={handleChange} onBlur={handleBlur} placeholder="member@example.com" />
          {errors.email && <small className={styles.error}>{errors.email}</small>}
        </div>

        <div className={styles.field}>
          <label htmlFor="phoneNumber">Phone Number <span>*</span></label>
          <input id="phoneNumber" name="phoneNumber" type="tel" value={form.phoneNumber} onChange={handleChange} onBlur={handleBlur} placeholder="10-digit mobile number" maxLength={10} />
          {errors.phoneNumber && <small className={styles.error}>{errors.phoneNumber}</small>}
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="password">Password <span>*</span></label>
            <input id="password" name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={handleChange} onBlur={handleBlur} placeholder="At least 8 characters" autoComplete="new-password" />
            {errors.password && <small className={styles.error}>{errors.password}</small>}
          </div>
          <div className={styles.field}>
            <label htmlFor="confirmPassword">Confirm Password <span>*</span></label>
            <input id="confirmPassword" name="confirmPassword" type={showPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={handleChange} onBlur={handleBlur} placeholder="Re-enter password" autoComplete="new-password" />
            {errors.confirmPassword && <small className={styles.error}>{errors.confirmPassword}</small>}
          </div>
        </div>

        <label className={styles.checkRow}>
          <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
          <span>Show passwords</span>
        </label>

        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={backToTree} disabled={submitting}>Cancel</button>
          <button type="submit" className={styles.primaryBtn} disabled={submitting}>
            {submitting ? 'Registering…' : 'Register Member'}
          </button>
        </div>
      </form>

      {registered && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <span className={styles.stateIcon}>🎉</span>
            <h2>Member registered!</h2>
            <p>Share these login details with your new member. The password isn't shown again.</p>
            <div className={styles.credBox}>
              <div><span>Name</span><strong>{registered.fullName}</strong></div>
              <div><span>User ID</span><strong>{registered.memberId}</strong></div>
              <div><span>Password</span><strong>{registered.password}</strong></div>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.secondaryBtn} onClick={handleCopyCredentials}>Copy Credentials</button>
              <button type="button" className={styles.primaryBtn} onClick={backToTree}>Back to Growth Generation</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddMemberPage;
