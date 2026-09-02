// client/src/pages/member/ProfilePage.jsx
import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../hooks/useNotification';
import styles from './ProfilePage.module.css';

const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB limit

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const fileInputRef = useRef(null);

  // Change Password OTP Modal States
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdForm, setPwdForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    otp: ''
  });

  const [profile, setProfile] = useState({
    memberId: '',
    fullName: '',
    email: '',
    phoneNumber: '',
    profileImage: {
      url: '',
      publicId: ''
    },
    address: {
      street: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India'
    },
    bankDetails: {
      accountName: '',
      accountNumber: '',
      bankName: '',
      ifscCode: '',
      upiId: '',
      panNumber: ''
    }
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/users/profile');
      if (response.data.success) {
        setProfile(response.data.data.user);
      }
    } catch {
      showNotification('Failed to load profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      showNotification('File size exceeds 1 MB. Please upload a smaller image.', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      showNotification('Please upload a valid image file (JPEG, PNG, or WEBP).', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('profileImage', file);

    setUploadingPhoto(true);
    try {
      const response = await api.put('/api/users/profile/photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        const updatedUserData = response.data.data.user;
        setProfile((prev) => ({
          ...prev,
          profileImage: updatedUserData.profileImage
        }));
        updateUser(updatedUserData);
        showNotification('Profile photo updated successfully!', 'success');
      }
    } catch (error) {
      showNotification(
        error.response?.data?.message || 'Failed to upload profile photo',
        'error'
      );
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setProfile((prev) => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setProfile((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await api.put('/api/users/profile', profile);
      if (response.data.success) {
        updateUser(response.data.data.user);
        showNotification('Profile updated successfully!', 'success');
        setEditMode(false);
      }
    } catch {
      showNotification('Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ============ REQUEST OTP FOR CHANGE PASSWORD ============
  const handleRequestChangePasswordOTP = async () => {
    setPwdLoading(true);
    try {
      const res = await api.post('/api/auth/change-password/send-otp');
      if (res.data.success) {
        setOtpSent(true);
        showNotification('6-digit OTP sent to your registered email address!', 'success');
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to send OTP. Please try again.', 'error');
    } finally {
      setPwdLoading(false);
    }
  };

  // ============ SUBMIT CHANGE PASSWORD WITH OTP ============
  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();

    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      showNotification('New passwords do not match', 'error');
      return;
    }

    if (pwdForm.newPassword.length < 8) {
      showNotification('New password must be at least 8 characters long', 'error');
      return;
    }

    if (!pwdForm.otp || pwdForm.otp.trim().length !== 6) {
      showNotification('Please enter the valid 6-digit OTP', 'error');
      return;
    }

    setPwdLoading(true);
    try {
      const res = await api.post('/api/auth/change-password', {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
        otp: pwdForm.otp.trim()
      });

      if (res.data.success) {
        showNotification('Password changed successfully!', 'success');
        setShowPasswordModal(false);
        setOtpSent(false);
        setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '', otp: '' });
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to change password. Invalid or expired OTP.', 'error');
    } finally {
      setPwdLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className={styles.profilePage}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Profile</h1>
          <p className={styles.pageSubtitle}>Manage your personal information & User ID</p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.editBtn}
            onClick={() => setShowPasswordModal(true)}
            style={{ background: '#0f172a' }}
          >
            🔒 Change Password (OTP)
          </button>
          {!editMode && (
            <button
              className={styles.editBtn}
              onClick={() => setEditMode(true)}
            >
              ✏️ Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Profile Card */}
      <div className={styles.profileCard}>
        <div className={styles.profileAvatar}>
          <div className={styles.avatarWrapper}>
            {profile.profileImage?.url ? (
              <img
                src={profile.profileImage.url}
                alt={profile.fullName || 'User Profile'}
                className={styles.avatarImage}
              />
            ) : (
              <span className={styles.avatarText}>
                {profile.fullName?.charAt(0) || 'U'}
              </span>
            )}

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoChange}
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
            />

            {/* Overlay Upload Button */}
            <button
              type="button"
              className={styles.photoUploadBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              title="Upload Photo (Max 1 MB)"
              aria-label="Upload Profile Photo"
            >
              {uploadingPhoto ? (
                <span className={styles.uploadSpinner}></span>
              ) : (
                <span>📷</span>
              )}
            </button>
          </div>

          <div className={styles.profileBadge}>
            <span className={styles.badgeIcon}>✅</span>
            <span className={styles.badgeText}>Verified</span>
          </div>
        </div>

        <div className={styles.profileInfo}>
          <h2 className={styles.profileName}>{profile.fullName}</h2>
          <p style={{ margin: '0 0 6px 0', fontSize: '15px', color: '#38bdf8', fontWeight: '800' }}>
            User ID: {profile.memberId || user?.memberId || profile.referralCode || user?.referralCode}
          </p>
          <p className={styles.profileEmail}>📧 {profile.email} (For OTP)</p>
          <p className={styles.profilePhone}>📱 {profile.phoneNumber}</p>
          <div className={styles.profileStats}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Member Since</span>
              <span className={styles.statValue}>
                {new Date(user?.joinedDate || Date.now()).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric'
                })}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Status</span>
              <span className={`${styles.statValue} ${styles.statusActive}`}>
                {user?.status || 'Active'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSubmit} className={styles.profileForm}>
        {/* Personal Information */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Personal Information</h2>
            {editMode && (
              <span className={styles.editIndicator}>Editing</span>
            )}
          </div>
          <div className={styles.formGrid}>
            {/* User ID - Permanent Read Only */}
            <div className={styles.formGroup}>
              <label>User ID (Permanent)</label>
              <input
                type="text"
                value={profile.memberId || user?.memberId || profile.referralCode || ''}
                disabled
                className={styles.disabled}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Full Name <span className={styles.required}>*</span></label>
              <input
                type="text"
                name="fullName"
                value={profile.fullName || ''}
                onChange={handleChange}
                disabled={!editMode}
                className={!editMode ? styles.disabled : ''}
                required
              />
            </div>

            {/* Editable Email for OTP */}
            <div className={styles.formGroup}>
              <label>Email Address (Used for OTP) <span className={styles.required}>*</span></label>
              <input
                type="email"
                name="email"
                value={profile.email || ''}
                onChange={handleChange}
                disabled={!editMode}
                className={!editMode ? styles.disabled : ''}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Phone Number <span className={styles.required}>*</span></label>
              <input
                type="tel"
                name="phoneNumber"
                value={profile.phoneNumber || ''}
                onChange={handleChange}
                disabled={!editMode}
                className={!editMode ? styles.disabled : ''}
                required
              />
            </div>
          </div>
        </div>

        {/* Address Section */}
        <div className={styles.section}>
          <h2>Address</h2>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Street</label>
              <input
                type="text"
                name="address.street"
                value={profile.address?.street || ''}
                onChange={handleChange}
                disabled={!editMode}
                className={!editMode ? styles.disabled : ''}
              />
            </div>
            <div className={styles.formGroup}>
              <label>City</label>
              <input
                type="text"
                name="address.city"
                value={profile.address?.city || ''}
                onChange={handleChange}
                disabled={!editMode}
                className={!editMode ? styles.disabled : ''}
              />
            </div>
            <div className={styles.formGroup}>
              <label>State</label>
              <input
                type="text"
                name="address.state"
                value={profile.address?.state || ''}
                onChange={handleChange}
                disabled={!editMode}
                className={!editMode ? styles.disabled : ''}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Pincode</label>
              <input
                type="text"
                name="address.pincode"
                value={profile.address?.pincode || ''}
                onChange={handleChange}
                disabled={!editMode}
                className={!editMode ? styles.disabled : ''}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Country</label>
              <input
                type="text"
                name="address.country"
                value={profile.address?.country || 'India'}
                onChange={handleChange}
                disabled={!editMode}
                className={!editMode ? styles.disabled : ''}
              />
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className={styles.section}>
          <h2>Bank Details</h2>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Account Holder Name</label>
              <input
                type="text"
                name="bankDetails.accountName"
                value={profile.bankDetails?.accountName || ''}
                onChange={handleChange}
                disabled={!editMode}
                className={!editMode ? styles.disabled : ''}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Account Number</label>
              <input
                type="text"
                name="bankDetails.accountNumber"
                value={profile.bankDetails?.accountNumber || ''}
                onChange={handleChange}
                disabled={!editMode}
                className={!editMode ? styles.disabled : ''}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Bank Name</label>
              <input
                type="text"
                name="bankDetails.bankName"
                value={profile.bankDetails?.bankName || ''}
                onChange={handleChange}
                disabled={!editMode}
                className={!editMode ? styles.disabled : ''}
              />
            </div>
            <div className={styles.formGroup}>
              <label>IFSC Code</label>
              <input
                type="text"
                name="bankDetails.ifscCode"
                value={profile.bankDetails?.ifscCode || ''}
                onChange={handleChange}
                disabled={!editMode}
                className={!editMode ? styles.disabled : ''}
              />
            </div>
            <div className={styles.formGroup}>
              <label>UPI ID</label>
              <input
                type="text"
                name="bankDetails.upiId"
                value={profile.bankDetails?.upiId || ''}
                onChange={handleChange}
                disabled={!editMode}
                className={!editMode ? styles.disabled : ''}
              />
            </div>
            <div className={styles.formGroup}>
              <label>PAN Number</label>
              <input
                type="text"
                name="bankDetails.panNumber"
                value={profile.bankDetails?.panNumber || ''}
                onChange={handleChange}
                disabled={!editMode}
                className={!editMode ? styles.disabled : ''}
              />
            </div>
          </div>
        </div>

        {editMode && (
          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => {
                setEditMode(false);
                fetchProfile();
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.saveBtn}
              disabled={saving}
            >
              {saving ? (
                <span className={styles.btnLoading}>
                  <span className={styles.btnSpinner}></span>
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        )}
      </form>

      {/* ============ CHANGE PASSWORD VIA EMAIL OTP MODAL ============ */}
      {showPasswordModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            padding: '2rem',
            borderRadius: '16px',
            maxWidth: '440px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#0f172a' }}>Change Password with Email OTP</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
              For security, an OTP is required to verify your password change request.
            </p>

            {!otpSent ? (
              <div>
                <p style={{ fontSize: '14px', color: '#334155', marginBottom: '16px' }}>
                  Click below to receive a 6-digit OTP on your registered email (<strong>{profile.email}</strong>).
                </p>
                <button
                  type="button"
                  className={styles.saveBtn}
                  onClick={handleRequestChangePasswordOTP}
                  disabled={pwdLoading}
                  style={{ width: '100%' }}
                >
                  {pwdLoading ? 'Sending OTP...' : 'Send OTP to Email'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleChangePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>6-Digit OTP *</label>
                  <input
                    type="text"
                    required
                    maxLength="6"
                    placeholder="Enter 6-digit OTP"
                    value={pwdForm.otp}
                    onChange={(e) => setPwdForm({ ...pwdForm, otp: e.target.value.replace(/\D/g, '') })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', letterSpacing: '4px', textAlign: 'center', fontSize: '16px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>Current Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter current password"
                    value={pwdForm.currentPassword}
                    onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>New Password (min 8 chars) *</label>
                  <input
                    type="password"
                    required
                    minLength="8"
                    placeholder="Enter new password"
                    value={pwdForm.newPassword}
                    onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>Confirm New Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Re-enter new password"
                    value={pwdForm.confirmPassword}
                    onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>

                <button
                  type="submit"
                  className={styles.saveBtn}
                  disabled={pwdLoading}
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  {pwdLoading ? 'Verifying OTP...' : 'Verify OTP & Update Password'}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => { setShowPasswordModal(false); setOtpSent(false); setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '', otp: '' }); }}
              style={{
                width: '100%',
                padding: '10px',
                background: 'transparent',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                marginTop: '10px',
                cursor: 'pointer',
                color: '#64748b'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;