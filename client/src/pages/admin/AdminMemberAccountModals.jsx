// client/src/pages/admin/AdminMemberAccountModals.jsx
//
// Admin > Members: "Edit Profile" and "Set New Password" popups.
// - Edit: name, email, phone, S/D/W/O, address, bank details
//   (PUT /api/admin/members/:id/profile). Member ID, sponsor, placement,
//   package and income are intentionally not editable here.
// - Password: passwords are stored only as one-way bcrypt hashes, so an
//   existing password can never be shown. The admin sets a new one (typed
//   or generated) via POST /api/admin/members/:id/reset-password and sees it
//   once to share with the member.
import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminMemberAccountModals.module.css';

const ADDRESS_FIELDS = [
  ['street', 'Street / Village'],
  ['city', 'City / Town'],
  ['state', 'State'],
  ['pincode', 'PIN Code']
];

const BANK_FIELDS = [
  ['accountName', 'Account Holder Name'],
  ['accountNumber', 'Account Number'],
  ['bankName', 'Bank Name'],
  ['ifscCode', 'IFSC Code'],
  ['panNumber', 'PAN Number'],
  ['upiId', 'UPI ID']
];

const useEscape = (onClose, disabled) => {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !disabled) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, disabled]);
};

export const EditMemberProfileModal = ({ member, onClose, onSaved }) => {
  const { showNotification } = useNotification();
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  useEscape(onClose, saving);

  // Load the full record (the list rows don't carry every field).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/api/admin/members/${member._id}`);
        const u = res.data?.data?.user || res.data?.data || member;
        if (cancelled) return;
        setForm({
          fullName: u.fullName || '',
          email: u.email || '',
          phoneNumber: u.phoneNumber || '',
          guardianName: u.guardianName || '',
          address: {
            street: u.address?.street || '',
            city: u.address?.city || '',
            state: u.address?.state || '',
            pincode: u.address?.pincode || u.address?.postalCode || '',
            country: u.address?.country || 'India'
          },
          bankDetails: Object.fromEntries(BANK_FIELDS.map(([k]) => [k, u.bankDetails?.[k] || '']))
        });
      } catch (err) {
        if (!cancelled) setLoadError(err.response?.data?.message || 'Could not load this member.');
      }
    })();
    return () => { cancelled = true; };
  }, [member]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setNested = (group, key, value) => setForm((f) => ({ ...f, [group]: { ...f[group], [key]: value } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await api.put(`/api/admin/members/${member._id}/profile`, form);
      if (!res.data?.success) {
        showNotification(res.data?.message || 'Could not save changes.', 'error');
        return;
      }
      showNotification(res.data.message || 'Profile updated.', 'success');
      onSaved(res.data.data?.user);
    } catch (err) {
      showNotification(err.response?.data?.message || 'Could not save changes.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={() => !saving && onClose()} role="presentation">
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="edit-member-title" onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 id="edit-member-title">Edit Member Profile</h2>
            <p>{member.fullName} · <span className={styles.mono}>{member.memberId}</span></p>
          </div>
          <button type="button" className={styles.iconBtn} onClick={onClose} disabled={saving} aria-label="Close">✕</button>
        </div>

        {!form ? (
          <div className={styles.body}>
            <p className={loadError ? styles.error : styles.muted}>{loadError || 'Loading member details…'}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.body}>
              <h3 className={styles.section}>Personal Information</h3>
              <div className={styles.grid}>
                <label className={styles.field}>
                  <span>Full Name *</span>
                  <input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} required minLength={2} maxLength={100} />
                </label>
                <label className={styles.field}>
                  <span>S/D/W/O</span>
                  <input value={form.guardianName} onChange={(e) => set('guardianName', e.target.value)} maxLength={100} placeholder="e.g. S/O Abdul Karim" />
                </label>
                <label className={styles.field}>
                  <span>Email *</span>
                  <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required maxLength={120} />
                </label>
                <label className={styles.field}>
                  <span>Phone Number *</span>
                  <input
                    inputMode="numeric"
                    value={form.phoneNumber}
                    onChange={(e) => set('phoneNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    required
                    pattern="[0-9]{10}"
                    title="10-digit phone number"
                  />
                </label>
              </div>

              <h3 className={styles.section}>Address</h3>
              <div className={styles.grid}>
                {ADDRESS_FIELDS.map(([k, label]) => (
                  <label key={k} className={styles.field}>
                    <span>{label}</span>
                    <input value={form.address[k]} onChange={(e) => setNested('address', k, e.target.value)} maxLength={200} />
                  </label>
                ))}
              </div>

              <h3 className={styles.section}>Bank Details</h3>
              <div className={styles.grid}>
                {BANK_FIELDS.map(([k, label]) => (
                  <label key={k} className={styles.field}>
                    <span>{label}</span>
                    <input value={form.bankDetails[k]} onChange={(e) => setNested('bankDetails', k, e.target.value)} maxLength={60} />
                  </label>
                ))}
              </div>

              <p className={styles.note}>
                Member ID, sponsor, tree position, package and income can&apos;t be changed here. Every edit is recorded in the Audit Log.
              </p>
            </div>

            <div className={styles.footer}>
              <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={saving}>Cancel</button>
              <button type="submit" className={styles.primaryBtn} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export const ResetMemberPasswordModal = ({ member, onClose }) => {
  const { showNotification } = useNotification();
  const [mode, setMode] = useState('generate'); // 'generate' | 'custom'
  const [password, setPassword] = useState('');
  const [showTyped, setShowTyped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); // new password, shown once
  useEscape(onClose, saving);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'custom' && (password.length < 8 || /\s/.test(password))) {
      showNotification('Password must be at least 8 characters with no spaces.', 'warning');
      return;
    }
    try {
      setSaving(true);
      const res = await api.post(`/api/admin/members/${member._id}/reset-password`, {
        password: mode === 'custom' ? password : ''
      });
      if (!res.data?.success) {
        showNotification(res.data?.message || 'Could not set the password.', 'error');
        return;
      }
      setResult(res.data.data?.password || '');
      setPassword('');
      showNotification('New password set.', 'success');
    } catch (err) {
      showNotification(err.response?.data?.message || 'Could not set the password.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotification(`${label} copied.`, 'success');
    } catch {
      showNotification('Copy failed — please select and copy it manually.', 'warning');
    }
  };

  const shareText = result
    ? `KUWIFR login details\nUser ID: ${member.memberId}\nNew Password: ${result}\nLogin: ${window.location.origin}/login\nPlease change your password after logging in.`
    : '';

  return (
    <div className={styles.overlay} onClick={() => !saving && onClose()} role="presentation">
      <div className={`${styles.modal} ${styles.modalSmall}`} role="dialog" aria-modal="true" aria-labelledby="reset-pw-title" onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 id="reset-pw-title">Set New Password</h2>
            <p>{member.fullName} · <span className={styles.mono}>{member.memberId}</span></p>
          </div>
          <button type="button" className={styles.iconBtn} onClick={onClose} disabled={saving} aria-label="Close">✕</button>
        </div>

        {result ? (
          <>
            <div className={styles.body}>
              <div className={styles.successBox}>
                <span>New password</span>
                <strong className={styles.mono}>{result}</strong>
                <button type="button" className={styles.copyBtn} onClick={() => copy(result, 'Password')}>Copy</button>
              </div>
              <p className={styles.note}>
                This is shown only once. Share it with the member securely — they have been signed out of other
                devices and can change it from their Profile after logging in.
              </p>
            </div>
            <div className={styles.footer}>
              <button type="button" className={styles.secondaryBtn} onClick={() => copy(shareText, 'Login details')}>Copy Login Details</button>
              <button type="button" className={styles.primaryBtn} onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.body}>
              <p className={styles.info}>
                For security, existing passwords are stored encrypted and can&apos;t be viewed by anyone. Set a new
                password here and share it with the member.
              </p>

              <div className={styles.choices}>
                <label className={`${styles.choice} ${mode === 'generate' ? styles.choiceOn : ''}`}>
                  <input type="radio" name="pwmode" checked={mode === 'generate'} onChange={() => setMode('generate')} />
                  <span><strong>Generate a strong password</strong><small>Recommended</small></span>
                </label>
                <label className={`${styles.choice} ${mode === 'custom' ? styles.choiceOn : ''}`}>
                  <input type="radio" name="pwmode" checked={mode === 'custom'} onChange={() => setMode('custom')} />
                  <span><strong>Type a password</strong><small>At least 8 characters</small></span>
                </label>
              </div>

              {mode === 'custom' && (
                <label className={styles.field}>
                  <span>New Password</span>
                  <div className={styles.pwRow}>
                    <input
                      type={showTyped ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={8}
                      maxLength={64}
                      autoComplete="new-password"
                      autoFocus
                    />
                    <button type="button" className={styles.secondaryBtn} onClick={() => setShowTyped((v) => !v)}>
                      {showTyped ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </label>
              )}

              <p className={styles.note}>The member will be signed out of all devices and notified.</p>
            </div>
            <div className={styles.footer}>
              <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={saving}>Cancel</button>
              <button type="submit" className={styles.primaryBtn} disabled={saving}>{saving ? 'Setting…' : 'Set Password'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
