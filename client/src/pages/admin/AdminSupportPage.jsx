// client/src/pages/admin/AdminSupportPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminSupportPage.module.css';

const CATEGORIES = [
  { value: 'WITHDRAWAL_PAYOUT', label: 'Payout / Bank Withdrawal' },
  { value: 'REPURCHASE_KBP', label: 'Repurchase / KBP & Cashback' },
  { value: 'KYC_VERIFICATION', label: 'KYC Document Approval' },
  { value: 'BINARY_TREE', label: 'Binary Placement / Downline' },
  { value: 'PACKAGE_ACTIVATION', label: 'Package Activation & Products' },
  { value: 'GENERAL', label: 'General Technical Query' }
];

const STATUS_FILTERS = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const AdminSupportPage = () => {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ total: 0, open: 0, inProgress: 0, resolved: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const { showNotification } = useNotification ? useNotification() : {
    showNotification: (msg) => console.log(msg)
  };

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/support/admin/all-tickets');
      if (res.data?.success) {
        const list = res.data.data.tickets || [];
        setTickets(list);
        setStats(res.data.data.stats || {
          total: list.length,
          open: list.filter((t) => t.status === 'OPEN').length,
          inProgress: list.filter((t) => t.status === 'IN_PROGRESS').length,
          resolved: list.filter((t) => t.status === 'RESOLVED').length,
          closed: list.filter((t) => t.status === 'CLOSED').length
        });
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to load support tickets', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Keep the currently-open ticket's own copy in sync with the freshly
  // fetched list (e.g. after a reply or status change), so the detail
  // panel never shows stale data next to an up-to-date table row.
  useEffect(() => {
    if (!selectedTicket) return;
    const fresh = tickets.find((t) => t._id === selectedTicket._id);
    if (fresh) setSelectedTicket(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets]);

  const visibleTickets = tickets.filter((t) => {
    if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      t.ticketId?.toLowerCase().includes(q) ||
      t.subject?.toLowerCase().includes(q) ||
      t.userId?.fullName?.toLowerCase().includes(q) ||
      t.userId?.memberId?.toLowerCase().includes(q) ||
      t.userId?.email?.toLowerCase().includes(q)
    );
  });

  const handleSendReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    setReplying(true);
    try {
      const res = await api.post(`/api/support/tickets/${selectedTicket._id}/reply`, { message: replyText.trim() });
      if (res.data?.success) {
        showNotification('Reply sent to member', 'success');
        setReplyText('');
        await fetchTickets();
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to send reply', 'error');
    } finally {
      setReplying(false);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedTicket || newStatus === selectedTicket.status) return;
    setUpdatingStatus(true);
    try {
      const res = await api.put(`/api/support/admin/tickets/${selectedTicket._id}/status`, { status: newStatus });
      if (res.data?.success) {
        showNotification(`Ticket marked ${newStatus.replace('_', ' ')}`, 'success');
        await fetchTickets();
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to update ticket status', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'OPEN':
        return <span className={`${styles.badge} ${styles.badgeOpen}`}>● Open</span>;
      case 'IN_PROGRESS':
        return <span className={`${styles.badge} ${styles.badgeProgress}`}>⏳ In Progress</span>;
      case 'RESOLVED':
        return <span className={`${styles.badge} ${styles.badgeResolved}`}>✓ Resolved</span>;
      case 'CLOSED':
        return <span className={`${styles.badge} ${styles.badgeClosed}`}>Closed</span>;
      default:
        return <span className={styles.badge}>{status}</span>;
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'URGENT':
        return <span className={`${styles.priorityChip} ${styles.pUrgent}`}>Urgent</span>;
      case 'HIGH':
        return <span className={`${styles.priorityChip} ${styles.pHigh}`}>High</span>;
      case 'MEDIUM':
        return <span className={`${styles.priorityChip} ${styles.pMed}`}>Medium</span>;
      default:
        return <span className={`${styles.priorityChip} ${styles.pLow}`}>Low</span>;
    }
  };

  if (loading && tickets.length === 0) {
    return (
      <div className={styles.loadingWrapper}>
        <div className={styles.spinner} />
        <p>Loading support tickets...</p>
      </div>
    );
  }

  return (
    <div className={styles.supportPage}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>🎧 Support Tickets</h1>
          <p className={styles.pageSubtitle}>Every ticket raised by a member from Help &amp; Support, in one place.</p>
        </div>
        <button type="button" className={styles.refreshBtn} onClick={fetchTickets} disabled={loading}>
          {loading ? 'Refreshing...' : '↻ Refresh'}
        </button>
      </header>

      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(0, 128, 128, 0.12)', color: '#008080' }}>🎫</div>
          <div className={styles.statInfo}><small>Total Tickets</small><h3>{stats.total}</h3></div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(220, 38, 38, 0.12)', color: '#dc2626' }}>🔴</div>
          <div className={styles.statInfo}><small>Open</small><h3>{stats.open}</h3></div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(217, 119, 6, 0.12)', color: '#d97706' }}>⏳</div>
          <div className={styles.statInfo}><small>In Progress</small><h3>{stats.inProgress}</h3></div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(22, 163, 74, 0.12)', color: '#16a34a' }}>✅</div>
          <div className={styles.statInfo}><small>Resolved</small><h3>{stats.resolved}</h3></div>
        </div>
      </section>

      <section className={styles.filterBar}>
        <div className={styles.filterTabs}>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              className={`${styles.filterTab} ${filterStatus === s ? styles.filterTabActive : ''}`}
              onClick={() => setFilterStatus(s)}
            >
              {s === 'ALL' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search by ticket ID, member name, member ID, or subject..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </section>

      {!selectedTicket && (
        <section className={styles.tableSection}>
          {visibleTickets.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🎫</span>
              <h3>No tickets match this view</h3>
              <p>Try a different status filter or clear your search.</p>
            </div>
          ) : (
            <div className={styles.ticketsTableCard}>
              <table className={styles.ticketTable}>
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>Member</th>
                    <th>Category</th>
                    <th>Subject</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTickets.map((t) => (
                    <tr key={t._id}>
                      <td><span className={styles.ticketCode}>{t.ticketId}</span></td>
                      <td>
                        <div className={styles.memberCell}>
                          <strong>{t.userId?.fullName || 'Unknown Member'}</strong>
                          <small>{t.userId?.memberId || '—'}</small>
                        </div>
                      </td>
                      <td>
                        <span className={styles.categoryBadge}>
                          {CATEGORIES.find((c) => c.value === t.category)?.label || t.category}
                        </span>
                      </td>
                      <td className={styles.subjectCell}><strong>{t.subject}</strong></td>
                      <td>{getPriorityBadge(t.priority)}</td>
                      <td>{getStatusBadge(t.status)}</td>
                      <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.viewDetailsBtn}
                          onClick={() => setSelectedTicket(t)}
                        >
                          View &amp; Reply →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {selectedTicket && (
        <section className={styles.ticketDetailCard}>
          <div className={styles.detailHeader}>
            <button type="button" className={styles.backBtn} onClick={() => setSelectedTicket(null)}>
              ← Back to All Tickets
            </button>
            <div className={styles.detailMeta}>
              <span className={styles.ticketCode}>{selectedTicket.ticketId}</span>
              {getStatusBadge(selectedTicket.status)}
              {getPriorityBadge(selectedTicket.priority)}
            </div>
          </div>

          <div className={styles.detailBody}>
            <div className={styles.memberInfoBar}>
              <div className={styles.memberAvatar}>
                {(selectedTicket.userId?.fullName || 'M')[0].toUpperCase()}
              </div>
              <div>
                <strong>{selectedTicket.userId?.fullName || 'Unknown Member'}</strong>
                <div className={styles.memberInfoMeta}>
                  <span>{selectedTicket.userId?.memberId || '—'}</span>
                  <span>{selectedTicket.userId?.email || '—'}</span>
                  <span>{selectedTicket.userId?.phoneNumber || '—'}</span>
                </div>
              </div>
            </div>

            <h2 className={styles.detailSubject}>{selectedTicket.subject}</h2>
            <div className={styles.initialMessageBubble}>
              <div className={styles.bubbleHead}>
                <strong>{selectedTicket.userId?.fullName || 'Member'}</strong>
                <small>{new Date(selectedTicket.createdAt).toLocaleString()}</small>
              </div>
              <p>{selectedTicket.message}</p>
            </div>

            <div className={styles.repliesStream}>
              <h4>💬 Conversation History</h4>
              {(!selectedTicket.replies || selectedTicket.replies.length === 0) ? (
                <p className={styles.noRepliesText}>No replies yet. Post the first response below.</p>
              ) : (
                selectedTicket.replies.map((rep, idx) => {
                  const isAdmin = rep.senderRole === 'ADMIN' || rep.senderRole === 'SUPPORT';
                  return (
                    <div key={idx} className={`${styles.replyBubble} ${isAdmin ? styles.adminBubble : styles.userBubble}`}>
                      <div className={styles.bubbleHead}>
                        <strong>{isAdmin ? '🛡️ You (Admin)' : selectedTicket.userId?.fullName || 'Member'}</strong>
                        <small>{new Date(rep.createdAt).toLocaleString()}</small>
                      </div>
                      <p>{rep.message}</p>
                    </div>
                  );
                })
              )}
            </div>

            <div className={styles.statusActionBar}>
              <span>Update status:</span>
              {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={updatingStatus || s === selectedTicket.status}
                  className={`${styles.statusActionBtn} ${s === selectedTicket.status ? styles.statusActionCurrent : ''}`}
                  onClick={() => handleUpdateStatus(s)}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>

            {selectedTicket.status !== 'CLOSED' && (
              <div className={styles.replyFormBox}>
                <textarea
                  rows="3"
                  placeholder="Reply to this member..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.sendReplyBtn}
                  onClick={handleSendReply}
                  disabled={replying || !replyText.trim()}
                >
                  {replying ? 'Sending Reply...' : 'Post Reply'}
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default AdminSupportPage;
