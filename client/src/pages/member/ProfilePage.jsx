// client/src/pages/member/ProfilePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../hooks/useNotification';
import styles from './ProfilePage.module.css';

const ProfilePage = () => {
  const { user, refreshUser } = useAuth();
  const { showNotification } = useNotification();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState(null);

  // Form inputs
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    address: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India'
    },
    bankDetails: {
      accountHolderName: '',
      accountNumber: '',
      bankName: '',
      ifscCode: '',
      branchName: '',
      upiId: ''
    }
  });

  // Fetch Member Profile
  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/users/profile');
      if (res.data?.success && res.data?.data?.user) {
        const u = res.data.data.user;
        setProfileData(u);
        setFormData({
          fullName: u.fullName || '',
          email: u.email || '',
          phoneNumber: u.phoneNumber || '',
          address: {
            street: u.address?.street || '',
            city: u.address?.city || '',
            state: u.address?.state || '',
            postalCode: u.address?.postalCode || '',
            country: u.address?.country || 'India'
          },
          bankDetails: {
            accountHolderName: u.bankDetails?.accountHolderName || '',
            accountNumber: u.bankDetails?.accountNumber || '',
            bankName: u.bankDetails?.bankName || '',
            ifscCode: u.bankDetails?.ifscCode || '',
            branchName: u.bankDetails?.branchName || '',
            upiId: u.bankDetails?.upiId || ''
          }
        });
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to load profile', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [group, field] = name.split('.');
      setFormData((prev) => ({
        ...prev,
        [group]: {
          ...prev[group],
          [field]: value
        }
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await api.put('/api/users/profile', formData);
      if (res.data?.success) {
        showNotification('Profile updated successfully!', 'success');
        setIsEditing(false);
        if (refreshUser) refreshUser();
        fetchProfile();
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to save changes', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Profile photo upload handler
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      showNotification('Photo must be less than 3MB', 'error');
      e.target.value = '';
      return;
    }

    const uploadForm = new FormData();
    uploadForm.append('profilePhoto', file);
    uploadForm.append('profileImage', file);

    try {
      setUploadingPhoto(true);
      showNotification('Uploading new profile photo...', 'info');

      const res = await api.post('/api/users/profile/photo', uploadForm, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        showNotification('Profile photo updated successfully!', 'success');
        if (refreshUser) refreshUser();
        await fetchProfile();
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to upload photo';
      showNotification(errMsg, 'error');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const activeUser = profileData || user;
  const memberJoinedFormatted = activeUser?.createdAt
    ? new Date(activeUser.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'September 2026';

  return (
    <div className={styles.profileContainer}>
      {/* ================= TOP COMPACT HEADER ================= */}
      <div className={styles.headerBlock}>
        <div className={styles.headerTitleGroup}>
          <h1 className={styles.pageTitle}>Profile</h1>
          <p className={styles.pageSubtitle}>Manage your personal credentials, identity & settlement details</p>
        </div>

        {/* Scaled & Refined SaaS Action Buttons */}
        <div className={styles.headerActionGroup}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => showNotification('Password reset link sent to your registered email & phone OTP', 'info')}
            title="Reset Password via OTP"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span>Change Password (OTP)</span>
          </button>

          <button
            type="button"
            className={`${styles.btnPrimary} ${isEditing ? styles.btnActive : ''}`}
            onClick={() => setIsEditing((prev) => !prev)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            <span>{isEditing ? 'Cancel Edit' : 'Edit Profile'}</span>
          </button>
        </div>
      </div>

      {/* ================= HERO PROFILE CARD ================= */}
      <div className={styles.heroProfileCard}>
        <div className={styles.heroMainRow}>
          {/* Avatar Block */}
          <div className={styles.avatarWrapper}>
            <div className={styles.avatarCircle}>
              {uploadingPhoto ? (
                <div className={styles.avatarSpinner}></div>
              ) : activeUser?.profileImage?.url ? (
                <img
                  src={activeUser.profileImage.url}
                  alt={activeUser.fullName || 'User'}
                  className={styles.avatarImg}
                />
              ) : (
                <span className={styles.avatarInitial}>
                  {(activeUser?.fullName || 'Member').charAt(0).toUpperCase()}
                </span>
              )}

              <label
                htmlFor="avatarFileInput"
                className={`${styles.avatarUploadBadge} ${uploadingPhoto ? styles.badgeDisabled : ''}`}
                title="Change Profile Photo"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                  <circle cx="12" cy="13" r="4"></circle>
                </svg>
              </label>
              <input
                id="avatarFileInput"
                type="file"
                accept="image/*"
                disabled={uploadingPhoto}
                onChange={handleAvatarUpload}
                style={{ display: 'none' }}
              />
            </div>

            <div className={styles.statusBadgeSmall}>
              <span className={styles.verifiedDot}></span>
              <span>Verified</span>
            </div>
          </div>

          {/* User Details */}
          <div className={styles.heroInfoContent}>
            <div className={styles.nameLine}>
              <h2 className={styles.userName}>{activeUser?.fullName || 'Jyoti Priya'}</h2>
            </div>

            <div className={styles.userIdPill}>
              User ID: <strong>{activeUser?.memberId || 'KFR773006'}</strong>
            </div>

            <div className={styles.contactMetaList}>
              <div className={styles.contactItem}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                <span>{activeUser?.email || 'member@kuwifr.in'}</span>
                <span className={styles.otpTag}>(For OTP)</span>
              </div>

              <div className={styles.contactItem}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                <span>{activeUser?.phoneNumber || '+91 ----------'}</span>
              </div>
            </div>

            <div className={styles.heroStatsRow}>
              <div className={styles.heroStatItem}>
                <span className={styles.statLabel}>MEMBER SINCE</span>
                <strong className={styles.statValue}>{memberJoinedFormatted}</strong>
              </div>
              <div className={styles.statDivider}></div>
              <div className={styles.heroStatItem}>
                <span className={styles.statLabel}>STATUS</span>
                <strong className={activeUser?.status === 'ACTIVE' ? styles.statValueActive : styles.statValueInactive}>
                  {activeUser?.status || 'ACTIVE'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= PERSONAL & FINANCIAL FORMS ================= */}
      <form onSubmit={handleSaveProfile} className={styles.formContainer}>
        {/* Personal Information Section */}
        <section className={styles.contentSection}>
          <div className={styles.sectionHeader}>
            <h3>Personal Information</h3>
            <span className={styles.sectionSub}>Your core member identity details</span>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.inputGroup}>
              <label>User ID (Permanent)</label>
              <input
                type="text"
                disabled
                value={activeUser?.memberId || 'KFR773006'}
                className={`${styles.formInput} ${styles.inputLocked}`}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Full Name *</label>
              <input
                type="text"
                name="fullName"
                disabled={!isEditing}
                value={formData.fullName}
                onChange={handleInputChange}
                className={`${styles.formInput} ${!isEditing ? styles.inputReadOnly : ''}`}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Email Address (Used for OTP) *</label>
              <input
                type="email"
                name="email"
                disabled={!isEditing}
                value={formData.email}
                onChange={handleInputChange}
                className={`${styles.formInput} ${!isEditing ? styles.inputReadOnly : ''}`}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Phone Number *</label>
              <input
                type="text"
                name="phoneNumber"
                disabled={!isEditing}
                value={formData.phoneNumber}
                onChange={handleInputChange}
                className={`${styles.formInput} ${!isEditing ? styles.inputReadOnly : ''}`}
                required
              />
            </div>
          </div>
        </section>

        {/* Residential Address Section */}
        <section className={styles.contentSection}>
          <div className={styles.sectionHeader}>
            <h3>Residential Address</h3>
            <span className={styles.sectionSub}>For product delivery and official documentation</span>
          </div>

          <div className={styles.formGrid}>
            <div className={`${styles.inputGroup} ${styles.gridSpan2}`}>
              <label>Street / House Address</label>
              <input
                type="text"
                name="address.street"
                disabled={!isEditing}
                placeholder="Flat / House No., Street, Landmark"
                value={formData.address.street}
                onChange={handleInputChange}
                className={`${styles.formInput} ${!isEditing ? styles.inputReadOnly : ''}`}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>City</label>
              <input
                type="text"
                name="address.city"
                disabled={!isEditing}
                value={formData.address.city}
                onChange={handleInputChange}
                className={`${styles.formInput} ${!isEditing ? styles.inputReadOnly : ''}`}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>State</label>
              <input
                type="text"
                name="address.state"
                disabled={!isEditing}
                value={formData.address.state}
                onChange={handleInputChange}
                className={`${styles.formInput} ${!isEditing ? styles.inputReadOnly : ''}`}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Postal PIN Code</label>
              <input
                type="text"
                name="address.postalCode"
                disabled={!isEditing}
                value={formData.address.postalCode}
                onChange={handleInputChange}
                className={`${styles.formInput} ${!isEditing ? styles.inputReadOnly : ''}`}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Country</label>
              <input
                type="text"
                disabled
                value="India"
                className={`${styles.formInput} ${styles.inputLocked}`}
              />
            </div>
          </div>
        </section>

        {/* Payout & Settlement Bank Details */}
        <section className={styles.contentSection}>
          <div className={styles.sectionHeader}>
            <h3>Bank Settlement & Payout Details</h3>
            <span className={styles.sectionSub}>Where your binary matching & salary commissions are deposited</span>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.inputGroup}>
              <label>Account Holder Name</label>
              <input
                type="text"
                name="bankDetails.accountHolderName"
                disabled={!isEditing}
                value={formData.bankDetails.accountHolderName}
                onChange={handleInputChange}
                className={`${styles.formInput} ${!isEditing ? styles.inputReadOnly : ''}`}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Account Number</label>
              <input
                type="text"
                name="bankDetails.accountNumber"
                disabled={!isEditing}
                value={formData.bankDetails.accountNumber}
                onChange={handleInputChange}
                className={`${styles.formInput} ${!isEditing ? styles.inputReadOnly : ''}`}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Bank Name</label>
              <input
                type="text"
                name="bankDetails.bankName"
                disabled={!isEditing}
                value={formData.bankDetails.bankName}
                onChange={handleInputChange}
                className={`${styles.formInput} ${!isEditing ? styles.inputReadOnly : ''}`}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>IFSC Code</label>
              <input
                type="text"
                name="bankDetails.ifscCode"
                disabled={!isEditing}
                value={formData.bankDetails.ifscCode}
                onChange={handleInputChange}
                className={`${styles.formInput} ${!isEditing ? styles.inputReadOnly : ''}`}
              />
            </div>

            <div className={`${styles.inputGroup} ${styles.gridSpan2}`}>
              <label>UPI ID (Google Pay / PhonePe / Paytm)</label>
              <input
                type="text"
                name="bankDetails.upiId"
                disabled={!isEditing}
                placeholder="username@upi"
                value={formData.bankDetails.upiId}
                onChange={handleInputChange}
                className={`${styles.formInput} ${!isEditing ? styles.inputReadOnly : ''}`}
              />
            </div>
          </div>
        </section>

        {/* Floating / Sticky Save Footer when in Edit Mode */}
        {isEditing && (
          <div className={styles.editFooterBar}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.saveBtn}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default ProfilePage;