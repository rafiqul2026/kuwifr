// client/src/pages/admin/AdminSponsorChangePage.jsx
// Move a member and their whole team under a new sponsor.
// Flow: enter member + new sponsor + leg -> Preview -> type CHANGE and a
// reason -> Confirm. Backed by /api/admin/sponsor-change.
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminInsights.module.css';
import { formatNum, formatDate } from './adminInsightsUtils';

const PersonCard = ({ title, person, extra }) => (
  <div className={styles.panel} style={{ marginBottom: 0 }}>
    <span className={styles.cardLabel}>{title}</span>
    {person ? (
      <dl className={styles.kv}>
        <dt>Sponsor</dt><dd>{person.sponsor ? `${person.sponsor.fullName} (${person.sponsor.memberId})` : '— none —'}</dd>
        <dt>Binary parent</dt>
        <dd>
          {person.binaryParent
            ? `${person.binaryParent.fullName} (${person.binaryParent.memberId})${person.binaryParent.side ? ` · ${person.binaryParent.side} leg` : ''}`
            : '— none —'}
        </dd>
        {extra}
      </dl>
    ) : <span className={styles.muted}>—</span>}
  </div>
);

const AdminSponsorChangePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [member, setMember] = useState(searchParams.get('member') || '');
  const [newSponsor, setNewSponsor] = useState('');
  const [side, setSide] = useState('left');
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [executing, setExecuting] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [history, setHistory] = useState({ rows: [], total: 0 });

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/sponsor-change/history', { params: { limit: 20 } });
      setHistory(res.data?.data || { rows: [], total: 0 });
    } catch {
      // History is secondary — the page still works without it.
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Any edit to the inputs invalidates a preview.
  useEffect(() => {
    setPreview(null);
    setConfirmText('');
  }, [member, newSponsor, side]);

  const handlePreview = async (e) => {
    e.preventDefault();
    setPreviewing(true);
    setLastResult(null);
    try {
      const res = await api.post('/api/admin/sponsor-change/preview', { member: member.trim(), newSponsor: newSponsor.trim(), side });
      setPreview(res.data?.data || null);
    } catch (err) {
      showNotification(err.response?.data?.message || 'Could not preview this change.', 'error');
    } finally {
      setPreviewing(false);
    }
  };

  const handleExecute = async () => {
    setExecuting(true);
    try {
      const res = await api.post('/api/admin/sponsor-change', {
        member: preview.member._id,
        newSponsor: preview.newSponsor.memberId,
        side,
        reason: reason.trim(),
        confirm: confirmText.trim()
      });
      showNotification(res.data?.message || 'Sponsor changed.', 'success');
      setLastResult(res.data?.message || 'Sponsor changed.');
      setPreview(null);
      setReason('');
      setConfirmText('');
      setNewSponsor('');
      fetchHistory();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Sponsor change failed. Nothing was changed.', 'error');
    } finally {
      setExecuting(false);
    }
  };

  const canExecute = preview && reason.trim().length >= 5 && confirmText.trim().toUpperCase() === 'CHANGE' && !executing;

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>Sponsor Change</h1>
          <p className={styles.pageSubtitle}>
            Move a member — together with their entire team below them — under a new sponsor. The team keeps its
            own internal structure; only where it attaches changes.
          </p>
        </div>
      </div>

      <div className={styles.warning}>
        <strong>How this works:</strong> the member's sponsor and binary placement move to the new sponsor's chosen
        leg, and everyone below them moves with them. <strong>Income and KBP already earned are not changed</strong>:
        commissions already paid stay with the members who received them, and past volume stays counted where it was.
        From the moment of the change, all <em>new</em> purchases flow up through the new sponsor's team. Every change
        is recorded in the history below and in Audit Logs.
      </div>

      {lastResult && <div className={styles.notice}>✓ {lastResult}</div>}

      <form className={styles.panel} onSubmit={handlePreview}>
        <h2 className={styles.panelTitle}>1. Choose the member and the new sponsor</h2>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label htmlFor="sc-member">Member to move (Member ID)</label>
            <input id="sc-member" className={styles.input} placeholder="KFR123456" value={member} onChange={(e) => setMember(e.target.value)} required />
          </div>
          <div className={styles.field}>
            <label htmlFor="sc-sponsor">New sponsor (Member ID)</label>
            <input id="sc-sponsor" className={styles.input} placeholder="KFR654321" value={newSponsor} onChange={(e) => setNewSponsor(e.target.value)} required />
          </div>
          <div className={styles.field}>
            <label>Place on new sponsor's</label>
            <div className={styles.segmented}>
              <button type="button" className={side === 'left' ? styles.segmentedActive : ''} onClick={() => setSide('left')}>Left leg</button>
              <button type="button" className={side === 'right' ? styles.segmentedActive : ''} onClick={() => setSide('right')}>Right leg</button>
            </div>
          </div>
        </div>
        <div className={styles.formActions}>
          <button type="submit" className={styles.btnPrimary} disabled={previewing || !member.trim() || !newSponsor.trim()}>
            {previewing ? 'Checking…' : 'Preview change'}
          </button>
        </div>
      </form>

      {preview && (
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>
            2. Review — {preview.member.fullName} ({preview.member.memberId})
          </h2>

          <div className={styles.compare}>
            <PersonCard
              title="Now"
              person={{ sponsor: preview.oldSponsor, binaryParent: preview.oldBinaryParent }}
            />
            <div className={styles.compareArrow} aria-hidden="true">→</div>
            <PersonCard
              title="After the change"
              person={{ sponsor: preview.newSponsor, binaryParent: preview.newBinaryParent }}
            />
          </div>

          <div className={styles.cardGrid}>
            <div className={`${styles.card} ${styles.cardWarn}`}>
              <span className={styles.cardLabel}>Team members moving</span>
              <span className={styles.cardValue}>{formatNum(preview.team.sponsorTeamSize)}</span>
              <span className={styles.cardHint}>{formatNum(preview.team.activeMembers)} active · plus the member</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Binary team moving</span>
              <span className={styles.cardValue}>{formatNum(preview.team.binaryTeamSize)}</span>
              <span className={styles.cardHint}>Members below in the binary tree</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Member's own KBP</span>
              <span className={styles.cardValue}>{formatNum(preview.team.memberOwnKBP)}</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Team KBP (both legs)</span>
              <span className={styles.cardValue}>{formatNum(preview.team.teamKBP)}</span>
              <span className={styles.cardHint}>Historic — stays where it was counted</span>
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="sc-reason">Reason (saved in history)</label>
              <textarea id="sc-reason" className={styles.textarea} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Member requested transfer to correct sponsor; approved by management on 23 Nov" />
            </div>
            <div className={styles.field}>
              <label htmlFor="sc-confirm">Type CHANGE to confirm</label>
              <input id="sc-confirm" className={styles.input} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btn} onClick={() => setPreview(null)}>Cancel</button>
            <button type="button" className={styles.btnDanger} disabled={!canExecute} onClick={handleExecute}>
              {executing ? 'Moving team…' : `Move ${formatNum(preview.team.sponsorTeamSize + 1)} member(s)`}
            </button>
          </div>
        </div>
      )}

      <h2 className={styles.sectionTitle}>Change history</h2>
      {history.rows.length === 0 ? (
        <div className={styles.empty}>No sponsor changes yet.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Date</th><th>Member</th><th>From sponsor</th><th>To sponsor</th><th>New binary parent</th><th className={styles.num}>Team moved</th><th>Reason</th><th>By</th></tr>
            </thead>
            <tbody>
              {history.rows.map((h) => (
                <tr key={h._id}>
                  <td>{formatDate(h.createdAt, true)}</td>
                  <td>
                    {h.targetId ? (
                      <button type="button" className={styles.linkBtn} onClick={() => navigate(`/admin/members/${h.targetId}`)}>
                        {h.newData?.memberName} ({h.newData?.memberId})
                      </button>
                    ) : `${h.newData?.memberName || ''} (${h.newData?.memberId || ''})`}
                  </td>
                  <td className={styles.muted}>{h.previousData?.sponsor || '—'}</td>
                  <td className={styles.strong}>{h.newData?.sponsor || '—'}</td>
                  <td className={styles.muted}>{h.newData?.binaryParent || '—'}</td>
                  <td className={styles.num}>{formatNum(h.newData?.movedTeamSize)}</td>
                  <td style={{ whiteSpace: 'normal', minWidth: 200 }}>{h.newData?.reason || '—'}</td>
                  <td className={styles.muted}>{h.adminEmail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminSponsorChangePage;
