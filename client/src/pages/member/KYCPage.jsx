// client/src/pages/member/KYCPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './KYCPage.module.css';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

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

  const fetchKYCStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/users/kyc');
      if (res.data?.success && res.data?.data?.kyc) {
        const kyc = res.data.data.kyc;
        setKycData(kyc);

        // Pre-fill numbers if available
        const rawAadhaar = kyc.aadhaarNumber ? String(kyc.aadhaarNumber).replace(/\D/g, '') : '';
        const formattedAadhaar = rawAadhaar.replace(/(\d{4})(?=\d)/g, '$1 ');

        setFormData({
          aadhaarNumber: formattedAadhaar,
          panNumber: kyc.panNumber || ''
        });

        setPreviews({
          aadhaarFront: kyc.aadhaarFront?.url || '',
          aadhaarBack: kyc.aadhaarBack?.url || '',
          panCard: kyc.panCard?.url || ''
        });
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        showNotification('Failed to load KYC information', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchKYCStatus();
  }, [fetchKYCStatus]);

  // Format 12-digit number with spaces: 1234 5678 9012
  const handleAadhaarChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
    const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ');
    setFormData((prev) => ({ ...prev, aadhaarNumber: formatted }));
  };

  // Format PAN: ABCDE1234F (Auto-uppercase)
  const handlePanChange = (e) => {
    const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    setFormData((prev) => ({ ...prev, panNumber: raw }));
  };

  const handleFileSelect = (field, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      showNotification('File is too large! Maximum limit is 2 MB.', 'error');
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

    const cleanAadhaar = formData.aadhaarNumber.replace(/\s/g, '');
    if (cleanAadhaar.length !== 12) {
      showNotification('Please enter a valid 12-digit Aadhaar number', 'error');
      return;
    }

    if (formData.panNumber.length !== 10) {
      showNotification('Please enter a valid 10-character PAN number', 'error');
      return;
    }

    const hasFront = files.aadhaarFront || previews.aadhaarFront;
    const hasBack = files.aadhaarBack || previews.aadhaarBack;
    const hasPan = files.panCard || previews.panCard;

    if (!hasFront || !hasBack || !hasPan) {
      showNotification('Please select and upload all three required identity documents.', 'error');
      return;
    }

    const payload = new FormData();
    payload.append('aadhaarNumber', cleanAadhaar);
    payload.append('panNumber', formData.panNumber);

    if (files.aadhaarFront) payload.append('aadhaarFront', files.aadhaarFront);
    if (files.aadhaarBack) payload.append('aadhaarBack', files.aadhaarBack);
    if (files.panCard) payload.append('panCard', files.panCard);

    setSubmitting(true);
    try {
      const res = await api.post('/api/users/kyc', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        showNotification('KYC Documents submitted successfully!', 'success');
        if (res.data.data?.kyc) {
          setKycData(res.data.data.kyc);
        } else {
          fetchKYCStatus();
        }
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to submit KYC documents', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading compliance profile...</p>
      </div>
    );
  }

  const status = (kycData.status || 'NOT_SUBMITTED').toUpperCase();
  const isLocked = status === 'VERIFIED' || status === 'PENDING';

  return (
    <div className={styles.kycPage}>
      {/* ================= COMPACT HEADER ================= */}
      <div className={styles.pageHeader}>
        <span className={styles.headerPill}>SECURITY & COMPLIANCE</span>
        <h1 className={styles.pageTitle}>KYC Verification</h1>
        <p className={styles.pageSubtitle}>
          Upload government-issued identity documents to activate your payouts & wallet withdrawals.
        </p>
      </div>

      {/* ================= DYNAMIC STATUS HERO BANNER ================= */}
      <div
        className={`${styles.statusBanner} ${
          status === 'VERIFIED'
            ? styles.bannerVerified
            : status === 'PENDING'
            ? styles.bannerPending
            : status === 'REJECTED'
            ? styles.bannerRejected
            : styles.bannerActionRequired
        }`}
      >
        <div className={styles.statusLeft}>
          <div className={styles.statusIconWrap}>
            {status === 'VERIFIED' && '✅'}
            {status === 'PENDING' && '⏳'}
            {status === 'REJECTED' && '⚠️'}
            {status === 'NOT_SUBMITTED' && '📋'}
          </div>
          <div className={styles.statusTextWrap}>
            <div className={styles.statusTitleRow}>
              <span className={styles.statusPrefix}>Status:</span>
              <span className={styles.statusCurrent}>
                {status === 'VERIFIED' && 'Verified & Approved'}
                {status === 'PENDING' && 'Under Review'}
                {status === 'REJECTED' && 'Action Required (Rejected)'}
                {status === 'NOT_SUBMITTED' && 'Action Required'}
              </span>
              <span
                className={`${styles.statusPill} ${
                  status === 'VERIFIED'
                    ? styles.pillVerified
                    : status === 'PENDING'
                    ? styles.pillPending
                    : status === 'REJECTED'
                    ? styles.pillRejected
                    : styles.pillAction
                }`}
              >
                {status.replace(/_/g, ' ')}
              </span>
              <span className={styles.pulseDot}></span>
            </div>
            <p className={styles.statusMessage}>
              {status === 'VERIFIED' && 'Your documents have been verified. Payouts and transfers are fully unlocked.'}
              {status === 'PENDING' && 'Your documents are being verified by our compliance team (typically within 24 hours).'}
              {status === 'REJECTED' && (kycData.rejectionReason || 'Document unreadable or invalid. Please re-upload clear photos.')}
              {status === 'NOT_SUBMITTED' && 'Please upload your Aadhaar (Front & Back) and PAN Card.'}
            </p>
          </div>
        </div>
      </div>

      {/* ================= FORM WORKSPACE ================= */}
      <form onSubmit={handleSubmit} className={styles.kycForm}>
        {/* Step 1: Identification Numbers */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Identity Details</h2>
            <span className={styles.sectionHint}>Details must match your government documents</span>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label htmlFor="aadhaarInput">Aadhaar Card Number (12 Digits) *</label>
              <div className={styles.inputShell}>
                <input
                  id="aadhaarInput"
                  type="text"
                  placeholder="1234 5678 9012"
                  required
                  disabled={isLocked}
                  value={formData.aadhaarNumber}
                  onChange={handleAadhaarChange}
                  className={styles.formInput}
                />
                <span className={styles.badgeFormat}>12 DIGITS</span>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="panInput">PAN Card Number (10 Characters) *</label>
              <div className={styles.inputShell}>
                <input
                  id="panInput"
                  type="text"
                  placeholder="ABCDE1234F"
                  required
                  disabled={isLocked}
                  value={formData.panNumber}
                  onChange={handlePanChange}
                  className={styles.formInput}
                />
                <span className={styles.badgeFormat}>PAN</span>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Document Photos */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionHeaderSplit}>
              <h2>Upload Documents</h2>
              <span className={styles.limitTag}>Max 2 MB each • JPG, PNG, WEBP</span>
            </div>
            <span className={styles.sectionHint}>Ensure full edges and text are legible with no glare</span>
          </div>

          <div className={styles.uploadGrid}>
            {/* 1. Aadhaar Front */}
            <div className={styles.uploadCard}>
              <div className={styles.cardHeader}>
                <h4>Aadhaar Card (Front Side) *</h4>
              </div>

              <div className={`${styles.previewBox} ${previews.aadhaarFront ? styles.hasPreview : ''}`}>
                {previews.aadhaarFront ? (
                  <img src={previews.aadhaarFront} alt="Aadhaar Front Preview" className={styles.docImg} />
                ) : (
                  <div className={styles.placeholder}>
                    <span className={styles.placeholderIcon}>🪪</span>
                    <p>No document selected</p>
                  </div>
                )}
              </div>

              <div className={styles.cardFooter}>
                <div className={styles.statusChip}>
                  {isLocked ? (
                    <span
                      className={`${styles.docStatusPill} ${
                        status === 'VERIFIED' ? styles.docStatusVerified : styles.docStatusPending
                      }`}
                    >
                      {status}
                    </span>
                  ) : previews.aadhaarFront ? (
                    <span className={styles.chipUploaded}>● Ready</span>
                  ) : (
                    <span className={styles.chipRequired}>● Required</span>
                  )}
                </div>

                {!isLocked && (
                  <label className={styles.fileButton}>
                    <span>{previews.aadhaarFront ? 'Change' : 'Choose File'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      onChange={(e) => handleFileSelect('aadhaarFront', e)}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* 2. Aadhaar Back */}
            <div className={styles.uploadCard}>
              <div className={styles.cardHeader}>
                <h4>Aadhaar Card (Back Side) *</h4>
              </div>

              <div className={`${styles.previewBox} ${previews.aadhaarBack ? styles.hasPreview : ''}`}>
                {previews.aadhaarBack ? (
                  <img src={previews.aadhaarBack} alt="Aadhaar Back Preview" className={styles.docImg} />
                ) : (
                  <div className={styles.placeholder}>
                    <span className={styles.placeholderIcon}>🪪</span>
                    <p>No document selected</p>
                  </div>
                )}
              </div>

              <div className={styles.cardFooter}>
                <div className={styles.statusChip}>
                  {isLocked ? (
                    <span
                      className={`${styles.docStatusPill} ${
                        status === 'VERIFIED' ? styles.docStatusVerified : styles.docStatusPending
                      }`}
                    >
                      {status}
                    </span>
                  ) : previews.aadhaarBack ? (
                    <span className={styles.chipUploaded}>● Ready</span>
                  ) : (
                    <span className={styles.chipRequired}>● Required</span>
                  )}
                </div>

                {!isLocked && (
                  <label className={styles.fileButton}>
                    <span>{previews.aadhaarBack ? 'Change' : 'Choose File'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      onChange={(e) => handleFileSelect('aadhaarBack', e)}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* 3. PAN Card */}
            <div className={styles.uploadCard}>
              <div className={styles.cardHeader}>
                <h4>PAN Card (Front Side) *</h4>
              </div>

              <div className={`${styles.previewBox} ${previews.panCard ? styles.hasPreview : ''}`}>
                {previews.panCard ? (
                  <img src={previews.panCard} alt="PAN Card Preview" className={styles.docImg} />
                ) : (
                  <div className={styles.placeholder}>
                    <span className={styles.placeholderIcon}>💳</span>
                    <p>No document selected</p>
                  </div>
                )}
              </div>

              <div className={styles.cardFooter}>
                <div className={styles.statusChip}>
                  {isLocked ? (
                    <span
                      className={`${styles.docStatusPill} ${
                        status === 'VERIFIED' ? styles.docStatusVerified : styles.docStatusPending
                      }`}
                    >
                      {status}
                    </span>
                  ) : previews.panCard ? (
                    <span className={styles.chipUploaded}>● Ready</span>
                  ) : (
                    <span className={styles.chipRequired}>● Required</span>
                  )}
                </div>

                {!isLocked && (
                  <label className={styles.fileButton}>
                    <span>{previews.panCard ? 'Change' : 'Choose File'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      onChange={(e) => handleFileSelect('panCard', e)}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        {!isLocked && (
          <div className={styles.formActions}>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? 'Uploading Documents...' : 'Submit KYC for Verification →'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default KYCPage;