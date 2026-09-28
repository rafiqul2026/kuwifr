// client/src/components/common/InstallAppHelpModal.jsx
//
// "How to install" instructions for the KUWIFR app (PWA), shown when the
// browser has no native install prompt to offer (iPhone Safari, or a
// browser that hasn't offered it yet). Shared by the member panel and the
// public website footer. See utils/pwaInstall.js for the install logic.
import React, { useEffect } from 'react';
import { FiShare, FiPlusSquare, FiMoreVertical } from 'react-icons/fi';
import styles from './InstallAppHelpModal.module.css';

const InstallAppHelpModal = ({ isIOS, onClose }) => {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-app-title"
        onClick={(e) => e.stopPropagation()}
      >
        <img src="/icons/icon-192.png" alt="KUWIFR" className={styles.logo} />
        <h3 id="install-app-title">Download the KUWIFR App</h3>
        {isIOS ? (
          <ol className={styles.steps}>
            <li>Open this page in <strong>Safari</strong>.</li>
            <li>Tap the <strong>Share</strong> button <FiShare aria-hidden="true" />.</li>
            <li>Choose <strong>Add to Home Screen</strong> <FiPlusSquare aria-hidden="true" />, then tap <strong>Add</strong>.</li>
          </ol>
        ) : (
          <ol className={styles.steps}>
            <li>Open this page in <strong>Chrome</strong> (or Edge / Samsung Internet).</li>
            <li>Tap the browser menu <FiMoreVertical aria-hidden="true" />.</li>
            <li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
          </ol>
        )}
        <p className={styles.note}>
          The KUWIFR icon will appear on your home screen and open like a normal app.
        </p>
        <button type="button" className={styles.closeBtn} onClick={onClose} autoFocus>
          Got it
        </button>
      </div>
    </div>
  );
};

export default InstallAppHelpModal;
