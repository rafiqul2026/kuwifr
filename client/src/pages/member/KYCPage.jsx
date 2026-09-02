// client/src/pages/member/KYCPage.jsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './KYCPage.module.css';

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB

const KYCPage = () => {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [kycData, setKycData] = useState({
    status: 'NOT_SUBMITTED',
    aadhaarNumber: '',
    panNumber: '',
    rejectionReason: '',
    aadhaarFront: { url: '' },
    aadhaarBack: { url: '' },
    panCard: { url: '' }
  });

  const [formData, setFormData] = useState({
    aadhaarNumber: '',
    panNumber: ''
  });

  const [files, setFiles] = useState({
    aadhaarFront: null,
    aadhaarBack: null,
    panCard: null
  });

  const [previews, setPreviews] = useState({
    aadhaarFront: '',
    aadhaarBack: '',
    panCard: ''
  });

  useEffect(() => {
    fetchKYCStatus();
  }, []);

  const fetchKYCStatus = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/users/kyc');
      if (res.data.success && res.data.data.kyc) {
        const kyc = res.data.data.kyc;
        setKycData(kyc);
        setFormData({
          aadhaarNumber: kyc.aadhaarNumber || '',
          panNumber: kyc.panNumber || ''
        });
        setPreviews({
          aadhaarFront: kyc.aadhaarFront?.url || '',
          aadhaarBack: kyc.aadhaarBack?.url || '',
          panCard: kyc.panCard?.url || ''
        });
      }
    } catch (err) {
      showNotification('Failed to load KYC information', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (field, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      showNotification(`File is too large! Maximum limit is 1 MB.`, 'error');
      e.target.value = '';
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      showNotification('Please upload an image file (JPG, PNG, or WEBP)', 'error');
      e.target.value = '';
      return;
    }

    setFiles((prev) => ({ ...prev, [field]: file }));
    setPreviews((prev) => ({ ...prev, [field]: URL.createObjectURL(file) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!files.aadhaarFront || !files.aadhaarBack || !files.panCard) {
      showNotification('Please select and upload all three required documents.', 'error');
      return;
    }

    const payload = new FormData();
    payload.append('aadhaarNumber', formData.aadhaarNumber);
    payload.append('panNumber', formData.panNumber);
    payload.append('aadhaarFront', files.aadhaarFront);
    payload.append('aadhaarBack', files.aadhaarBack);
    payload.append('panCard', files.panCard);

    setSubmitting(true);
    try {
      const res = await api.post('/api/users/kyc', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        showNotification('KYC Documents submitted successfully!', 'success');
        setKycData(res.data.data.kyc);
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to submit KYC', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading KYC status...</p>
      </div>
    );
  }

  const isLocked = kycData.status === 'VERIFIED' || kycData.status === 'PENDING';

  return (
    <div className={styles.kycPage}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>KYC Verification</h1>
          <p className={styles.pageSubtitle}>Upload government-issued identity documents to activate your payouts</p>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`${styles.statusBanner} ${styles[kycData.status || 'NOT_SUBMITTED']}`}>
        <div className={styles.statusIcon}>
          {kycData.status === 'VERIFIED' && '✅'}
          {kycData.status === 'PENDING' && '⏳'}
          {kycData.status === 'REJECTED' && '❌'}
          {kycData.status === 'NOT_SUBMITTED' && '📋'}
        </div>
        <div className={styles.statusInfo}>
          <h3>
            Status:{' '}
            <span>
              {kycData.status === 'VERIFIED' && 'Verified'}
              {kycData.status === 'PENDING' && 'Under Review'}
              {kycData.status === 'REJECTED' && 'Rejected'}
              {kycData.status === 'NOT_SUBMITTED' && 'Action Required'}
            </span>
          </h3>
          <p>
            {kycData.status === 'VERIFIED' && 'Your identity documents have been approved.'}
            {kycData.status === 'PENDING' && 'Your documents are being verified by our compliance team (typically within 24-48 hours).'}
            {kycData.status === 'REJECTED' && `Reason: ${kycData.rejectionReason || 'Document unreadable or invalid. Please re-upload.'}`}
            {kycData.status === 'NOT_SUBMITTED' && 'Please upload your Aadhaar (Front & Back) and PAN Card.'}
          </p>
        </div>
      </div>

      {/* Upload Form */}
      <form onSubmit={handleSubmit} className={styles.kycForm}>
        {/* Document Numbers Section */}
        <div className={styles.section}>
          <h2>Identity Details</h2>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Aadhaar Card Number (12 Digits) *</label>
              <input
                type="text"
                placeholder="1234 5678 9012"
                maxLength="12"
                required
                disabled={isLocked}
                value={formData.aadhaarNumber}
                onChange={(e) => setFormData({ ...formData, aadhaarNumber: e.target.value.replace(/\D/g, '') })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>PAN Card Number (10 Characters) *</label>
              <input
                type="text"
                placeholder="ABCDE1234F"
                maxLength="10"
                required
                disabled={isLocked}
                value={formData.panNumber}
                onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
              />
            </div>
          </div>
        </div>

        {/* Document File Uploads */}
        <div className={styles.section}>
          <h2>Upload Documents <span className={styles.subtext}>(Max 1 MB each • JPG, PNG, WEBP)</span></h2>

          <div className={styles.uploadGrid}>
            {/* Aadhaar Front */}
            <div className={styles.uploadCard}>
              <div className={styles.cardHeader}>
                <h4>Aadhaar Card (Front Side) *</h4>
              </div>
              <div className={styles.previewBox}>
                {previews.aadhaarFront ? (
                  <img src={previews.aadhaarFront} alt="Aadhaar Front" />
                ) : (
                  <div className={styles.placeholder}>
                    <span>🪪</span>
                    <p>No document selected</p>
                  </div>
                )}
              </div>
              {!isLocked && (
                <label className={styles.fileButton}>
                  <span>Choose File</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleFileSelect('aadhaarFront', e)}
                    required={!kycData.aadhaarFront?.url}
                  />
                </label>
              )}
            </div>

            {/* Aadhaar Back */}
            <div className={styles.uploadCard}>
              <div className={styles.cardHeader}>
                <h4>Aadhaar Card (Back Side) *</h4>
              </div>
              <div className={styles.previewBox}>
                {previews.aadhaarBack ? (
                  <img src={previews.aadhaarBack} alt="Aadhaar Back" />
                ) : (
                  <div className={styles.placeholder}>
                    <span>🪪</span>
                    <p>No document selected</p>
                  </div>
                )}
              </div>
              {!isLocked && (
                <label className={styles.fileButton}>
                  <span>Choose File</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleFileSelect('aadhaarBack', e)}
                    required={!kycData.aadhaarBack?.url}
                  />
                </label>
              )}
            </div>

            {/* PAN Card */}
            <div className={styles.uploadCard}>
              <div className={styles.cardHeader}>
                <h4>PAN Card (Front Side) *</h4>
              </div>
              <div className={styles.previewBox}>
                {previews.panCard ? (
                  <img src={previews.panCard} alt="PAN Card" />
                ) : (
                  <div className={styles.placeholder}>
                    <span>💳</span>
                    <p>No document selected</p>
                  </div>
                )}
              </div>
              {!isLocked && (
                <label className={styles.fileButton}>
                  <span>Choose File</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleFileSelect('panCard', e)}
                    required={!kycData.panCard?.url}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        {!isLocked && (
          <div className={styles.formActions}>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? 'Uploading Documents...' : 'Submit KYC for Verification'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default KYCPage;