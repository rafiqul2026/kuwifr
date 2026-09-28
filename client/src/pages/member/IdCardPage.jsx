// client/src/pages/member/IdCardPage.jsx
//
// Member "Consultant / Advisor ID Card". Issued only once the member's ID is
// activated by a package purchase (status ACTIVE with an active package).
// Everything on the card comes from the member's profile; the preview is
// the exact document that is printed / saved as PDF (idCardDocument.js).
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import { buildIdCardHtml, printIdCard, formatCardAddress } from './idCardDocument';
import styles from './IdCardPage.module.css';

const IdCardPage = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const frameRef = useRef(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await api.get('/api/users/profile');
      setMember(res.data?.data?.user || null);
    } catch (err) {
      setLoadError(true);
      showNotification(err.response?.data?.message || 'Failed to load your profile.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Fit the preview iframe to the card (re-measured once web fonts settle).
  const fitFrame = () => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (frame && doc) frame.style.height = `${doc.documentElement.scrollHeight}px`;
  };
  const handleFrameLoad = () => {
    fitFrame();
    const fonts = frameRef.current?.contentDocument?.fonts;
    if (fonts?.ready) fonts.ready.then(fitFrame);
  };

  useEffect(() => {
    window.addEventListener('resize', fitFrame);
    return () => window.removeEventListener('resize', fitFrame);
  }, []);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading your ID card…</p>
        </div>
      </div>
    );
  }

  if (loadError || !member) {
    return (
      <div className={styles.page}>
        <div className={styles.lockedCard}>
          <h2>Couldn&apos;t load your ID card</h2>
          <p>Please check your connection and try again.</p>
          <button type="button" className={styles.primaryBtn} onClick={fetchProfile}>Try Again</button>
        </div>
      </div>
    );
  }

  const isActivated = member.status === 'ACTIVE' && Boolean(member.activePackageId);

  const missing = [
    !member.guardianName && 'S/D/W/O',
    !formatCardAddress(member.address) && 'Address',
    !member.profileImage?.url && 'Profile Photo'
  ].filter(Boolean);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.tag}>🪪 Member Identity</span>
        <h1>My ID Card</h1>
        <p>Your official KUWIFR Consultant / Advisor ID card, generated from your profile details.</p>
      </header>

      {!isActivated ? (
        <div className={styles.lockedCard}>
          <div className={styles.lockedIcon} aria-hidden="true">🔒</div>
          <h2>ID card is issued after activation</h2>
          <p>
            Your ID card will be available as soon as your Member ID ({member.memberId}) is activated by
            purchasing a package.
          </p>
          <button type="button" className={styles.primaryBtn} onClick={() => navigate('/member/packages')}>
            Buy a Package to Activate →
          </button>
        </div>
      ) : (
        <>
          {missing.length > 0 && (
            <div className={styles.notice} role="status">
              <div>
                <strong>Complete your profile for a full ID card.</strong>
                <span> Missing: {missing.join(', ')}. These show as blank on the card until added.</span>
              </div>
              <button type="button" className={styles.secondaryBtn} onClick={() => navigate('/member/profile')}>
                Update Profile
              </button>
            </div>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} onClick={() => printIdCard(member)}>
              ⬇️ Download / Print ID Card
            </button>
            <span className={styles.hint}>Choose “Save as PDF” in the print window to download it.</span>
          </div>

          <iframe
            ref={frameRef}
            title="ID card preview"
            className={styles.previewFrame}
            srcDoc={buildIdCardHtml({ member })}
            onLoad={handleFrameLoad}
          />
        </>
      )}
    </div>
  );
};

export default IdCardPage;
