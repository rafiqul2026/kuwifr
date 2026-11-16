// client/src/pages/admin/AdminContactMessagesPage.jsx
//
// Inbox for messages sent from the public Contact form (homepage and
// /contact). Every message is stored server-side, so it shows up here even
// when email delivery isn't configured. API: /api/contact/admin.
import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminContactMessagesPage.module.css';

const TABS = [
  { key: '', label: 'All' },
  { key: 'NEW', label: 'New' },
  { key: 'READ', label: 'Read' },
  { key: 'RESOLVED', label: 'Resolved' }
];

const formatDate = (d) =>
  new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

const AdminContactMessagesPage = () => {
  const { showNotification } = useNotification();
  const [status, setStatus] = useState('NEW');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ messages: [], total: 0, pages: 1, counts: { NEW: 0, READ: 0, RESOLVED: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/contact/admin', { params: { status: status || undefined, page, search: query || undefined } });
      setData(res.data?.data || { messages: [], total: 0, pages: 1, counts: { NEW: 0, READ: 0, RESOLVED: 0 } });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load contact messages.');
    } finally {
      setLoading(false);
    }
  }, [status, page, query]);

  useEffect(() => { load(); }, [load]);

  const setMessageStatus = async (msg, next, { silent = false } = {}) => {
    setBusyId(msg._id);
    try {
      await api.patch(`/api/contact/admin/${msg._id}`, { status: next });
      if (!silent) showNotification(`Marked as ${next.toLowerCase()}.`, 'success');
      await load();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Could not update the message.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (msg) => {
    if (!window.confirm(`Delete the message from ${msg.name}? This cannot be undone.`)) return;
    setBusyId(msg._id);
    try {
      await api.delete(`/api/contact/admin/${msg._id}`);
      showNotification('Message deleted.', 'success');
      setOpenId(null);
      await load();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Could not delete the message.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const toggleOpen = (msg) => {
    const opening = openId !== msg._id;
    setOpenId(opening ? msg._id : null);
    // Opening a new message marks it read, like an email inbox.
    if (opening && msg.status === 'NEW') setMessageStatus(msg, 'READ', { silent: true });
  };

  const total = data.counts.NEW + data.counts.READ + data.counts.RESOLVED;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1>Contact Messages</h1>
          <p>Messages visitors send from the website's Contact form. Reply by email or phone, then mark them resolved.</p>
        </div>
        <button type="button" className={styles.refreshBtn} onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label="Filter by status">
          {TABS.map((t) => {
            const count = t.key ? data.counts[t.key] : total;
            return (
              <button
                key={t.key || 'all'}
                type="button"
                role="tab"
                aria-selected={status === t.key}
                className={`${styles.tab} ${status === t.key ? styles.tabActive : ''}`}
                onClick={() => { setStatus(t.key); setPage(1); setOpenId(null); }}
              >
                {t.label} <span className={styles.tabCount}>{count}</span>
              </button>
            );
          })}
        </div>
        <form
          className={styles.searchForm}
          onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); setPage(1); }}
          role="search"
        >
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, text…"
            aria-label="Search messages"
          />
          <button type="submit">Search</button>
        </form>
      </div>

      {error && (
        <div className={styles.error} role="alert">
          {error} <button type="button" onClick={load}>Retry</button>
        </div>
      )}

      {!error && !loading && data.messages.length === 0 && (
        <div className={styles.empty}>No messages {status ? `marked ${status.toLowerCase()}` : 'yet'}{query ? ` matching “${query}”` : ''}.</div>
      )}

      <ul className={styles.list}>
        {data.messages.map((m) => {
          const open = openId === m._id;
          return (
            <li key={m._id} className={`${styles.item} ${m.status === 'NEW' ? styles.itemNew : ''}`}>
              <button type="button" className={styles.itemHead} onClick={() => toggleOpen(m)} aria-expanded={open}>
                <span className={`${styles.badge} ${styles[`badge${m.status}`]}`}>{m.status}</span>
                <span className={styles.itemMain}>
                  <strong>{m.subject}</strong>
                  <small>{m.name} · {m.email}{m.phone ? ` · ${m.phone}` : ''}</small>
                </span>
                <time className={styles.itemDate} dateTime={m.createdAt}>{formatDate(m.createdAt)}</time>
              </button>
              {open && (
                <div className={styles.itemBody}>
                  <p className={styles.messageText}>{m.message}</p>
                  {!m.emailDelivered && (
                    <p className={styles.note}>Email notification was not delivered for this message — it is only in this inbox.</p>
                  )}
                  <div className={styles.actions}>
                    <a className={styles.primaryBtn} href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`}>
                      Reply by email
                    </a>
                    {m.phone && (
                      <a className={styles.ghostBtn} href={`tel:${m.phone.replace(/[^\d+]/g, '')}`}>Call {m.phone}</a>
                    )}
                    {m.status !== 'RESOLVED' ? (
                      <button type="button" className={styles.ghostBtn} disabled={busyId === m._id} onClick={() => setMessageStatus(m, 'RESOLVED')}>
                        Mark resolved
                      </button>
                    ) : (
                      <button type="button" className={styles.ghostBtn} disabled={busyId === m._id} onClick={() => setMessageStatus(m, 'READ')}>
                        Reopen
                      </button>
                    )}
                    <button type="button" className={styles.dangerBtn} disabled={busyId === m._id} onClick={() => remove(m)}>
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {data.pages > 1 && (
        <nav className={styles.pager} aria-label="Pagination">
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>← Previous</button>
          <span>Page {page} of {data.pages}</span>
          <button type="button" disabled={page >= data.pages || loading} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </nav>
      )}
    </div>
  );
};

export default AdminContactMessagesPage;
