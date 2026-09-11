// client/src/pages/admin/AdminFranchisePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminFranchisePage.module.css';

const formatINR = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(val) || 0);

const STATUS_TABS = ['PENDING', 'APPROVED', 'REJECTED', 'REVOKED', 'ALL'];

export default function AdminFranchisePage() {
  const { showNotification } = useNotification();

  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [applications, setApplications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Admin-initiated direct Franchise selection: "from the all member list,
  // which member we want to give franchise, we will select them" — a
  // dedicated member-picker modal, separate from the apply/approve flow
  // above, so the admin can grant Franchise status to ANY member directly.
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantSearch, setGrantSearch] = useState('');
  const [grantResults, setGrantResults] = useState([]);
  const [grantSearchLoading, setGrantSearchLoading] = useState(false);
  const [selectedGrantMember, setSelectedGrantMember] = useState(null);
  const [grantNote, setGrantNote] = useState('');
  const [isGranting, setIsGranting] = useState(false);

  const fetchApplications = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const res = await api.get('/api/franchise/admin', {
        params: { status: statusFilter, search: search || undefined, page, limit: 20 }
      });
      if (res.data?.success) {
        setApplications(res.data.data.applications || []);
        setPagination(res.data.data.pagination || { page: 1, pages: 1 });
      }
    } catch (error) {
      console.error('Failed to load franchise applications:', error);
      showNotification('Unable to fetch franchise applications.', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    fetchApplications(1);
  }, [fetchApplications]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchApplications(1);
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Approve this Franchise application? The member will be notified immediately.')) return;
    try {
      setActionLoadingId(id);
      const res = await api.post(`/api/franchise/admin/${id}/approve`);
      showNotification(res.data?.message || 'Franchise approved.', 'success');
      fetchApplications(pagination.page);
    } catch (error) {
      showNotification(error.response?.data?.message || 'Failed to approve.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Reason for rejecting this application (shown to the member):', '');
    if (reason === null) return;
    try {
      setActionLoadingId(id);
      const res = await api.post(`/api/franchise/admin/${id}/reject`, { reason });
      showNotification(res.data?.message || 'Franchise application rejected.', 'success');
      fetchApplications(pagination.page);
    } catch (error) {
      showNotification(error.response?.data?.message || 'Failed to reject.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRevoke = async (id) => {
    const reason = window.prompt('Reason for revoking this Franchise (shown to the member):', '');
    if (reason === null) return;
    try {
      setActionLoadingId(id);
      const res = await api.post(`/api/franchise/admin/${id}/revoke`, { reason });
      showNotification(res.data?.message || 'Franchise revoked.', 'success');
      fetchApplications(pagination.page);
    } catch (error) {
      showNotification(error.response?.data?.message || 'Failed to revoke.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleViewOverview = async (id) => {
    try {
      setOverviewLoading(true);
      setOverview({ loading: true, id });
      const res = await api.get(`/api/franchise/admin/${id}/overview`);
      if (res.data?.success) {
        setOverview(res.data.data);
      }
    } catch (error) {
      showNotification('Failed to load franchise overview.', 'error');
      setOverview(null);
    } finally {
      setOverviewLoading(false);
    }
  };

  const handleOpenGrantModal = () => {
    setShowGrantModal(true);
    setGrantSearch('');
    setGrantResults([]);
    setSelectedGrantMember(null);
    setGrantNote('');
  };

  const handleCloseGrantModal = () => {
    if (isGranting) return;
    setShowGrantModal(false);
  };

  const handleGrantSearchSubmit = async (e) => {
    e.preventDefault();
    if (!grantSearch.trim()) return;
    try {
      setGrantSearchLoading(true);
      setSelectedGrantMember(null);
      const res = await api.get('/api/admin/members/search', { params: { query: grantSearch.trim() } });
      setGrantResults(res.data?.data?.members || []);
    } catch (error) {
      showNotification('Member search failed.', 'error');
      setGrantResults([]);
    } finally {
      setGrantSearchLoading(false);
    }
  };

  const handleConfirmGrant = async () => {
    if (!selectedGrantMember) return;
    if (!window.confirm(`Grant Franchise status to ${selectedGrantMember.fullName} (${selectedGrantMember.memberId})? They will be notified immediately.`)) return;

    try {
      setIsGranting(true);
      const res = await api.post('/api/admin/franchise/grant', {
        memberId: selectedGrantMember.memberId,
        note: grantNote.trim()
      });
      showNotification(res.data?.message || 'Franchise granted.', 'success');
      setShowGrantModal(false);
      fetchApplications(1);
    } catch (error) {
      showNotification(error.response?.data?.message || 'Failed to grant Franchise.', 'error');
    } finally {
      setIsGranting(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>🏢 Franchise Management</h1>
          <p className={styles.pageSubtitle}>Review applications, approve or reject members as official Franchises, and see franchise income/withdrawal/territory — everything.</p>
        </div>
        <button type="button" className={styles.grantBtn} onClick={handleOpenGrantModal}>
          + Grant Franchise to Member
        </button>
      </div>

      <div className={styles.tabStrip}>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            className={`${styles.tabBtn} ${statusFilter === tab ? styles.tabBtnActive : ''}`}
            onClick={() => setStatusFilter(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
        <input
          type="text"
          placeholder="Search by member name, ID, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
        />
        <button type="submit" className={styles.searchBtn}>Search</button>
      </form>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Applicant</th>
              <th>Member ID</th>
              <th>Status</th>
              <th>Applied</th>
              <th>Decided</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className={styles.emptyState}>Loading applications...</td></tr>
            ) : applications.length === 0 ? (
              <tr><td colSpan="6" className={styles.emptyState}>No applications found.</td></tr>
            ) : (
              applications.map((app) => (
                <tr key={app._id}>
                  <td>
                    <div className={styles.memberName}>{app.userId?.fullName || 'N/A'}</div>
                    <div className={styles.memberSub}>{app.userId?.email}</div>
                  </td>
                  <td>{app.userId?.memberId || 'N/A'}</td>
                  <td><span className={styles.statusBadge} data-status={app.status}>{app.status}</span></td>
                  <td>{app.appliedAt ? new Date(app.appliedAt).toLocaleDateString('en-IN') : '—'}</td>
                  <td>{app.decidedAt ? new Date(app.decidedAt).toLocaleDateString('en-IN') : '—'}</td>
                  <td>
                    <div className={styles.actionRow}>
                      <button className={styles.linkBtn} onClick={() => handleViewOverview(app._id)}>View</button>
                      {app.status === 'PENDING' && (
                        <>
                          <button
                            className={styles.approveBtn}
                            disabled={actionLoadingId === app._id}
                            onClick={() => handleApprove(app._id)}
                          >Approve</button>
                          <button
                            className={styles.rejectBtn}
                            disabled={actionLoadingId === app._id}
                            onClick={() => handleReject(app._id)}
                          >Reject</button>
                        </>
                      )}
                      {app.status === 'APPROVED' && (
                        <button
                          className={styles.rejectBtn}
                          disabled={actionLoadingId === app._id}
                          onClick={() => handleRevoke(app._id)}
                        >Revoke</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.pages > 1 && (
        <div className={styles.pagination}>
          <button disabled={pagination.page <= 1} onClick={() => fetchApplications(pagination.page - 1)}>← Prev</button>
          <span>Page {pagination.page} of {pagination.pages}</span>
          <button disabled={pagination.page >= pagination.pages} onClick={() => fetchApplications(pagination.page + 1)}>Next →</button>
        </div>
      )}

      {overview && (
        <div className={styles.modalOverlay} onClick={() => setOverview(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            {overviewLoading || overview.loading ? (
              <p>Loading overview...</p>
            ) : (
              <>
                <h2 className={styles.modalTitle}>
                  {overview.franchise?.userId?.fullName} ({overview.franchise?.userId?.memberId})
                </h2>
                <div className={styles.overviewGrid}>
                  <div className={styles.overviewStat}>
                    <span>Territory Members</span>
                    <strong>{overview.territoryStats?.totalMembers ?? 0}</strong>
                  </div>
                  <div className={styles.overviewStat}>
                    <span>Active Members</span>
                    <strong>{overview.territoryStats?.activeMembers ?? 0}</strong>
                  </div>
                  <div className={styles.overviewStat}>
                    <span>Territory KBP</span>
                    <strong>{(overview.territoryStats?.totalKbp || 0).toLocaleString()}</strong>
                  </div>
                  <div className={styles.overviewStat}>
                    <span>Franchise Income Today</span>
                    <strong>{formatINR(overview.franchiseIncome?.today)}</strong>
                  </div>
                  <div className={styles.overviewStat}>
                    <span>Franchise Income Total</span>
                    <strong>{formatINR(overview.franchiseIncome?.total)}</strong>
                  </div>
                </div>

                <h3 className={styles.modalSubTitle}>Recent Withdrawals</h3>
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr><th>Date</th><th>Amount</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {(overview.withdrawals || []).length === 0 ? (
                        <tr><td colSpan="3" className={styles.emptyState}>No withdrawals yet.</td></tr>
                      ) : (
                        overview.withdrawals.slice(0, 10).map((w) => (
                          <tr key={w._id}>
                            <td>{new Date(w.createdAt).toLocaleDateString('en-IN')}</td>
                            <td>{formatINR(w.requestedAmount || w.amount)}</td>
                            <td>{w.status}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <button className={styles.closeBtn} onClick={() => setOverview(null)}>Close</button>
              </>
            )}
          </div>
        </div>
      )}

      {showGrantModal && (
        <div className={styles.modalOverlay} onClick={handleCloseGrantModal}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Grant Franchise to a Member</h2>
            <p className={styles.pageSubtitle}>
              Search the full member list and select anyone to become an official Franchise directly — they don't need to have applied. The member is notified immediately.
            </p>

            <form onSubmit={handleGrantSearchSubmit} className={styles.searchForm}>
              <input
                type="text"
                placeholder="Search by Member ID, name, email, or phone..."
                value={grantSearch}
                onChange={(e) => setGrantSearch(e.target.value)}
                className={styles.searchInput}
                autoFocus
              />
              <button type="submit" className={styles.searchBtn} disabled={grantSearchLoading}>
                {grantSearchLoading ? 'Searching...' : 'Search'}
              </button>
            </form>

            {grantResults.length > 0 && (
              <div className={styles.grantResultsList}>
                {grantResults.map((m) => (
                  <button
                    type="button"
                    key={m._id}
                    className={`${styles.grantResultItem} ${selectedGrantMember?._id === m._id ? styles.grantResultItemActive : ''}`}
                    onClick={() => setSelectedGrantMember(m)}
                  >
                    <div>
                      <div className={styles.memberName}>{m.fullName}</div>
                      <div className={styles.memberSub}>{m.memberId} · {m.email}</div>
                    </div>
                    <span className={styles.statusBadge} data-status={m.status}>{m.status}</span>
                  </button>
                ))}
              </div>
            )}

            {!grantSearchLoading && grantSearch && grantResults.length === 0 && (
              <p className={styles.emptyState}>No members matched that search.</p>
            )}

            {selectedGrantMember && (
              <div className={styles.grantConfirmBox}>
                <p>
                  Selected: <strong>{selectedGrantMember.fullName}</strong> ({selectedGrantMember.memberId})
                </p>
                <textarea
                  className={styles.grantNoteInput}
                  placeholder="Optional note (visible only to admins)..."
                  rows={2}
                  value={grantNote}
                  onChange={(e) => setGrantNote(e.target.value)}
                />
              </div>
            )}

            <div className={styles.grantModalActions}>
              <button type="button" className={styles.closeBtn} onClick={handleCloseGrantModal} disabled={isGranting}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.approveBtn}
                disabled={!selectedGrantMember || isGranting}
                onClick={handleConfirmGrant}
              >
                {isGranting ? 'Granting...' : 'Grant Franchise'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
