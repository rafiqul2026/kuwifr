// client/src/pages/admin/AdminKycPage.jsx
// Admin > KYC Requests: review members' KYC submissions (Aadhaar front/back,
// PAN card + PAN number) and verify or reject them — one at a time or in
// bulk. Members who never submitted can be verified manually. Backed by
// GET /api/admin/kyc, /api/admin/kyc/counts, POST /api/admin/kyc/review,
// /api/admin/kyc/bulk-verify.
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import fi from './FranchiseInventory.module.css';
import k from './AdminKyc.module.css';
import { formatDate } from './adminInsightsUtils';

const TABS = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'VERIFIED', label: 'Verified' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'NOT_SUBMITTED', label: 'Not submitted' }
];

const DOCS = [
  { key: 'aadhaarFront', label: 'Aadhaar — front' },
  { key: 'aadhaarBack', label: 'Aadhaar — back' },
  { key: 'panCard', label: 'PAN card' }
];

const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null);
const isPdf = (url) => /\.pdf($|\?)/i.test(url || '');

const useDebounced = (value, ms = 350) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
};

const useEscape = (onClose, extra) => {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (extra) extra(e);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, extra]);
};

// ---------------------------------------------------------------- lightbox

const Lightbox = ({ member, startIndex, onClose }) => {
  const docs = DOCS.map((d) => ({ ...d, url: member.kyc?.[d.key]?.url })).filter((d) => d.url);
  const [i, setI] = useState(Math.max(0, docs.findIndex((d) => d.key === startIndex)));
  const arrows = useCallback((e) => {
    if (e.key === 'ArrowRight') setI((x) => Math.min(docs.length - 1, x + 1));
    if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
  }, [docs.length]);
  useEscape(onClose, arrows);
  const doc = docs[i];
  if (!doc) return null;

  return (
    <div className={k.lightbox} role="dialog" aria-modal="true" aria-label={`${doc.label} — ${member.fullName}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={k.lightboxTop}>
        <span><strong>{doc.label}</strong> · {member.fullName} ({member.memberId}) · {i + 1}/{docs.length}</span>
        <span>
          <a href={doc.url} target="_blank" rel="noopener noreferrer">Open full size ↗</a>
          <button type="button" className={k.lightboxClose} onClick={onClose} aria-label="Close">✕</button>
        </span>
      </div>
      <div className={k.lightboxStage} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <button type="button" className={`${k.navBtn} ${k.navPrev}`} onClick={() => setI(i - 1)} disabled={i === 0} aria-label="Previous document">‹</button>
        {isPdf(doc.url)
          ? <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ color: '#99d6d6', fontSize: 16 }}>This document is a PDF — open it ↗</a>
          : <img src={doc.url} alt={doc.label} />}
        <button type="button" className={`${k.navBtn} ${k.navNext}`} onClick={() => setI(i + 1)} disabled={i === docs.length - 1} aria-label="Next document">›</button>
      </div>
    </div>
  );
};

// ------------------------------------------------------------- decide dialog

const DecisionDialog = ({ member, mode, onClose, onDone }) => {
  const { showNotification } = useNotification();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  useEscape(onClose);
  const reject = mode === 'REJECT';
  const manual = !reject && (member.kyc?.status || 'NOT_SUBMITTED') === 'NOT_SUBMITTED';
  const QUICK = ['Document image is blurred or unreadable', 'Name does not match the account', 'PAN number does not match the PAN card', 'Aadhaar back side missing or wrong'];

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/api/admin/kyc/review', { userId: member._id, status: reject ? 'REJECTED' : 'VERIFIED', rejectionReason: reason.trim() });
      showNotification(res.data?.message || 'KYC updated.', 'success');
      onDone();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Could not update KYC.', 'error');
      setSaving(false);
    }
  };

  return (
    <div className={fi.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className={fi.dialogSmall} onSubmit={submit} role="alertdialog" aria-modal="true" aria-labelledby="kyc-dlg-title">
        <div className={fi.dialogHead}>
          <div>
            <h2 id="kyc-dlg-title" className={fi.dialogTitle}>{reject ? 'Reject KYC' : manual ? 'Verify KYC manually' : 'Verify KYC'}</h2>
            <p className={fi.dialogSub}>{member.fullName} · {member.memberId}</p>
          </div>
          <button type="button" className={fi.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className={fi.dialogBody}>
          {reject ? (
            <>
              <p className={fi.hint}>The member is notified with this reason and can upload new documents.</p>
              <div className={fi.field}>
                <label htmlFor="kyc-reason">Reason</label>
                <textarea id="kyc-reason" className={fi.textarea} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus required />
              </div>
              <div className={fi.tabs} style={{ flexWrap: 'wrap', marginTop: 10 }}>
                {QUICK.map((q) => <button key={q} type="button" className={fi.tab} onClick={() => setReason(q)}>{q}</button>)}
              </div>
            </>
          ) : manual ? (
            <div className={fi.summaryWarn} style={{ marginTop: 0 }}>
              This member has <b>not uploaded any KYC documents</b>. Verify only if you have checked their identity another way. This is recorded in the audit log as a manual verification.
            </div>
          ) : (
            <p className={fi.hint} style={{ marginBottom: 0 }}>
              Confirm the documents are clear, belong to <b>{member.fullName}</b>, and the PAN number <b>{member.kyc?.panNumber || '—'}</b> matches the PAN card. The member will be notified.
            </p>
          )}
        </div>
        <div className={fi.dialogFoot}>
          <button type="button" className={fi.btn} onClick={onClose}>Cancel</button>
          {reject ? (
            <button type="submit" className={fi.btnDanger} disabled={saving || reason.trim().length < 3}>{saving ? 'Rejecting…' : 'Reject KYC'}</button>
          ) : (
            <button type="submit" className={k.btnVerify} disabled={saving}>{saving ? 'Verifying…' : 'Verify KYC'}</button>
          )}
        </div>
      </form>
    </div>
  );
};

// ------------------------------------------------------------------ card

const SubmissionCard = ({ m, tab, selectable, selected, onToggle, onDecide, onOpenDoc, onOpenMember }) => {
  const kyc = m.kyc || {};
  const wait = daysSince(kyc.submittedAt);
  return (
    <article className={`${k.card} ${selected ? k.cardSelected : ''}`}>
      <div className={k.pick}>
        {selectable && (
          <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${m.fullName}`} />
        )}
      </div>

      <div className={k.member}>
        <span className={k.avatar} aria-hidden="true">{initials(m.fullName)}</span>
        <div style={{ minWidth: 0 }}>
          <h3 className={k.name}><button type="button" className={k.nameLink} onClick={onOpenMember}>{m.fullName}</button></h3>
          <dl className={k.facts}>
            <dt>ID</dt><dd>{m.memberId}</dd>
            <dt>Phone</dt><dd>{m.phoneNumber || '—'}</dd>
            <dt>Email</dt><dd title={m.email}>{m.email || '—'}</dd>
            <dt>Sponsor</dt><dd>{m.sponsorId ? `${m.sponsorId.fullName} (${m.sponsorId.memberId})` : '—'}</dd>
            <dt>Account</dt><dd>{m.status}</dd>
          </dl>
          {tab === 'PENDING' && wait !== null && (
            <span className={`${k.waiting} ${wait >= 3 ? k.waitingLong : ''}`}>
              Submitted {formatDate(kyc.submittedAt)} · waiting {wait === 0 ? 'today' : `${wait} day${wait === 1 ? '' : 's'}`}
            </span>
          )}
        </div>
      </div>

      <div className={k.docsCol}>
        {tab === 'NOT_SUBMITTED' ? (
          <div className={k.noteInfo} style={{ marginTop: 0 }}>No KYC documents uploaded yet. Joined {formatDate(m.createdAt)}.</div>
        ) : (
          <>
            <div className={k.pan}>PAN <code>{kyc.panNumber || '—'}</code></div>
            <div className={k.docs}>
              {DOCS.map((d) => {
                const url = kyc[d.key]?.url;
                return url ? (
                  <button key={d.key} type="button" className={k.doc} onClick={() => onOpenDoc(d.key)} aria-label={`View ${d.label}`}>
                    {isPdf(url) ? <span className={k.docThumb}>PDF</span> : <img className={k.docThumb} src={url} alt="" loading="lazy" />}
                    <span className={k.docLabel}>{d.label}</span>
                  </button>
                ) : (
                  <div key={d.key} className={k.doc} style={{ cursor: 'default' }}>
                    <span className={k.docMissing}>Missing</span>
                    <span className={k.docLabel}>{d.label}</span>
                  </div>
                );
              })}
            </div>
            {tab === 'REJECTED' && kyc.rejectionReason && <div className={k.noteBad}>Rejected: {kyc.rejectionReason}</div>}
            {tab === 'VERIFIED' && <div className={k.noteGood}>Verified on {formatDate(kyc.verifiedAt, true)}</div>}
          </>
        )}
      </div>

      <div className={k.actions}>
        {tab === 'PENDING' && (
          <>
            <button type="button" className={k.btnVerify} onClick={() => onDecide('VERIFY')}>✓ Verify</button>
            <button type="button" className={k.btnReject} onClick={() => onDecide('REJECT')}>Reject</button>
          </>
        )}
        {tab === 'REJECTED' && <button type="button" className={k.btnVerify} onClick={() => onDecide('VERIFY')}>Verify anyway</button>}
        {tab === 'NOT_SUBMITTED' && <button type="button" className={k.btnVerify} onClick={() => onDecide('VERIFY')}>Verify manually</button>}
        {tab === 'VERIFIED' && <button type="button" className={k.btnReject} onClick={() => onDecide('REJECT')}>Revoke</button>}
      </div>
    </article>
  );
};

// ------------------------------------------------------------------- page

const AdminKycPage = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === searchParams.get('status')) ? searchParams.get('status') : 'PENDING';
  const [q, setQ] = useState(searchParams.get('q') || '');
  const dq = useDebounced(q);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [counts, setCounts] = useState({});
  const [selected, setSelected] = useState(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [decision, setDecision] = useState(null); // { member, mode }
  const [viewer, setViewer] = useState(null); // { member, docKey }

  const loadCounts = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/kyc/counts');
      setCounts(res.data?.data || {});
    } catch {
      // badges are secondary
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/kyc', { params: { status: tab, q: dq || undefined, page, limit: 20 } });
      setData(res.data?.data || null);
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to load KYC requests.', 'error');
      setData({ submissions: [], pagination: { total: 0, page: 1, pages: 1 } });
    }
  }, [tab, dq, page, showNotification]);

  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => { setPage(1); setSelected(new Set()); }, [tab, dq]);
  useEffect(() => { setData(null); load(); }, [load]);

  const refresh = () => { load(); loadCounts(); setSelected(new Set()); };

  const setTab = (key) => {
    const next = new URLSearchParams(searchParams);
    if (key === 'PENDING') next.delete('status'); else next.set('status', key);
    setSearchParams(next, { replace: true });
  };

  const rows = data?.submissions || [];
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r._id));
  const toggle = (id) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r._id)));

  const bulkVerify = async () => {
    if (!window.confirm(`Verify KYC for ${selected.size} member(s)? Each will be notified.`)) return;
    setBulkSaving(true);
    try {
      const res = await api.post('/api/admin/kyc/bulk-verify', { userIds: [...selected] });
      showNotification(res.data?.message || 'KYC verified.', 'success');
      refresh();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Bulk verify failed.', 'error');
    } finally {
      setBulkSaving(false);
    }
  };

  const closeDecision = useCallback(() => setDecision(null), []);
  const closeViewer = useCallback(() => setViewer(null), []);
  const pg = data?.pagination || { page: 1, pages: 1, total: 0 };

  return (
    <div className={fi.page}>
      <header className={fi.header}>
        <div>
          <h1 className={fi.title}>KYC Requests</h1>
          <p className={fi.subtitle}>
            Check each member's Aadhaar and PAN documents, then verify or reject their KYC. Members are notified of every decision.
          </p>
        </div>
      </header>

      <div className={k.statusTabs} role="tablist" aria-label="KYC status">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`${k.statusTab} ${tab === t.key ? k.statusTabActive : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
            <span className={`${k.count} ${t.key === 'PENDING' && counts.PENDING > 0 ? k.countAlert : ''}`}>{counts[t.key] ?? '·'}</span>
          </button>
        ))}
      </div>

      <div className={k.toolbar}>
        <input className={fi.search} type="search" placeholder="Search name, Member ID, phone, email or PAN…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search members" />
        {tab === 'PENDING' && rows.length > 0 && (
          <label className={k.selectAll}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            Select all on this page
          </label>
        )}
      </div>

      {!data ? (
        <div className={k.list}>
          {[0, 1, 2].map((i) => <div key={i} className={fi.skeleton} style={{ height: 150 }} />)}
        </div>
      ) : rows.length === 0 ? (
        <div className={fi.empty}>
          <span className={fi.emptyIcon}>{tab === 'PENDING' ? '🎉' : '🗂️'}</span>
          {dq ? 'No members match your search.' : tab === 'PENDING' ? 'All caught up — no KYC requests are waiting.' : 'Nothing here yet.'}
        </div>
      ) : (
        <>
          <p className={fi.metaLine}><b>{pg.total}</b> member(s){tab === 'PENDING' ? ' · oldest first' : ''}</p>
          <div className={k.list}>
            {rows.map((m) => (
              <SubmissionCard
                key={m._id}
                m={m}
                tab={tab}
                selectable={tab === 'PENDING'}
                selected={selected.has(m._id)}
                onToggle={() => toggle(m._id)}
                onDecide={(mode) => setDecision({ member: m, mode })}
                onOpenDoc={(docKey) => setViewer({ member: m, docKey })}
                onOpenMember={() => navigate(`/admin/members/${m._id}`)}
              />
            ))}
          </div>
          {pg.pages > 1 && (
            <div className={fi.pagination}>
              <button type="button" className={fi.btn} disabled={page <= 1} onClick={() => setPage(page - 1)}>← Previous</button>
              <span>Page {page} of {pg.pages}</span>
              <button type="button" className={fi.btn} disabled={page >= pg.pages} onClick={() => setPage(page + 1)}>Next →</button>
            </div>
          )}
        </>
      )}

      {selected.size > 0 && (
        <div className={k.bulkBar} role="region" aria-label="Bulk actions">
          <span><b>{selected.size}</b> selected</span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button type="button" className={fi.btn} onClick={() => setSelected(new Set())}>Clear</button>
            <button type="button" className={k.btnVerify} onClick={bulkVerify} disabled={bulkSaving}>{bulkSaving ? 'Verifying…' : `✓ Verify ${selected.size}`}</button>
          </span>
        </div>
      )}

      {decision && (
        <DecisionDialog member={decision.member} mode={decision.mode} onClose={closeDecision} onDone={() => { setDecision(null); refresh(); }} />
      )}
      {viewer && <Lightbox member={viewer.member} startIndex={viewer.docKey} onClose={closeViewer} />}
    </div>
  );
};

export default AdminKycPage;
