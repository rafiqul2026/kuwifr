// client/src/pages/member/FranchisePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './FranchisePage.module.css';

const formatINR = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(val) || 0);

const FranchisePage = () => {
  const { showNotification } = useNotification();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null); // Franchise doc, or null if never applied
  const [applying, setApplying] = useState(false);
  const [note, setNote] = useState('');

  const [dashboard, setDashboard] = useState(null);
  const [territory, setTerritory] = useState([]);
  const [territoryLoading, setTerritoryLoading] = useState(false);
  const [territorySearch, setTerritorySearch] = useState('');
  const [territoryPagination, setTerritoryPagination] = useState({ page: 1, pages: 1 });

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/franchise/status');
      if (res.data?.success) {
        setStatus(res.data.data.franchise);
      }
    } catch (error) {
      console.error('Failed to load franchise status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (status?.status === 'APPROVED') {
      fetchDashboard();
      fetchTerritory(1, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.status]);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/api/franchise/dashboard');
      if (res.data?.success) setDashboard(res.data.data);
    } catch (error) {
      console.error('Failed to load franchise dashboard:', error);
    }
  };

  const fetchTerritory = async (page = 1, search = '') => {
    try {
      setTerritoryLoading(true);
      const res = await api.get('/api/franchise/territory', { params: { page, limit: 20, search: search || undefined } });
      if (res.data?.success) {
        setTerritory(res.data.data.members || []);
        setTerritoryPagination(res.data.data.pagination || { page: 1, pages: 1 });
      }
    } catch (error) {
      console.error('Failed to load franchise territory:', error);
    } finally {
      setTerritoryLoading(false);
    }
  };

  const handleApply = async (e) => {
    e.preventDefault();
    try {
      setApplying(true);
      const res = await api.post('/api/franchise/apply', { note });
      showNotification(res.data?.message || 'Franchise application submitted.', 'success');
      fetchStatus();
    } catch (error) {
      showNotification(error.response?.data?.message || 'Failed to submit application.', 'error');
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading Franchise status...</p>
        </div>
      </div>
    );
  }

  // ============ NOT YET APPLIED, OR REJECTED (can re-apply) ============
  if (!status || status.status === 'REJECTED' || status.status === 'REVOKED') {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.headerRow}>
          <div className={styles.headerTitleWrap}>
            <span className={styles.pillBadge}>🏢 Franchise Network</span>
            <h1 className={styles.pageTitle}>Become a Franchise</h1>
            <p className={styles.pageSubtitle}>Apply to become an official KUWIFR Franchise and start earning territory overrides on your full downline's business.</p>
          </div>
        </div>

        {status?.status === 'REJECTED' && (
          <div className={styles.noticeBanner}>
            Your previous application was not approved.
            {status.rejectionReason && <> Reason: <strong>{status.rejectionReason}</strong>.</>} You may apply again below.
          </div>
        )}
        {status?.status === 'REVOKED' && (
          <div className={styles.noticeBanner}>
            Your Franchise status was revoked by the admin.
            {status.rejectionReason && <> Reason: <strong>{status.rejectionReason}</strong>.</>} You may apply again below.
          </div>
        )}

        <form onSubmit={handleApply} className={styles.applyCard}>
          <label className={styles.formLabel}>Tell us why you'd be a good fit (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. I have an active, engaged team and would like to manage my own territory..."
            className={styles.textarea}
          />
          <button type="submit" disabled={applying} className={styles.primaryBtn}>
            {applying ? 'Submitting...' : 'Apply for Franchise'}
          </button>
        </form>
      </div>
    );
  }

  // ============ PENDING ============
  if (status.status === 'PENDING') {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.headerRow}>
          <div className={styles.headerTitleWrap}>
            <span className={styles.pillBadge}>🏢 Franchise Network</span>
            <h1 className={styles.pageTitle}>Franchise Application</h1>
            <p className={styles.pageSubtitle}>Your application is under review.</p>
          </div>
        </div>
        <div className={styles.pendingCard}>
          <span className={styles.pendingIcon}>⏳</span>
          <h2>Application Pending</h2>
          <p>Submitted on {new Date(status.appliedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}. You'll get a notification here as soon as the admin reviews it.</p>
        </div>
      </div>
    );
  }

  // ============ APPROVED ============
  return (
    <div className={styles.pageContainer}>
      <div className={styles.headerRow}>
        <div className={styles.headerTitleWrap}>
          <span className={styles.pillBadge}>🏢 Franchise Network</span>
          <h1 className={styles.pageTitle}>Franchise Dashboard</h1>
          <p className={styles.pageSubtitle}>Your territory is your full downline network — overrides are credited automatically on every real order placed within it.</p>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Territory Members</span>
          <h2 className={styles.statValue}>{dashboard?.territoryStats?.totalMembers ?? '—'}</h2>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Active Members</span>
          <h2 className={styles.statValue}>{dashboard?.territoryStats?.activeMembers ?? '—'}</h2>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Territory KBP</span>
          <h2 className={styles.statValue}>{(dashboard?.territoryStats?.totalKbp || 0).toLocaleString()}</h2>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Franchise Income Today</span>
          <h2 className={styles.statValue}>{formatINR(dashboard?.franchiseIncome?.today)}</h2>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Franchise Income (Lifetime)</span>
          <h2 className={styles.statValue}>{formatINR(dashboard?.franchiseIncome?.total)}</h2>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Your Rates</span>
          <h2 className={styles.statValue}>{((dashboard?.rates?.kspRate || 0) * 100).toFixed(1)}% / {((dashboard?.rates?.kbpLifetimeRate || 0) * 100).toFixed(1)}%</h2>
          <span className={styles.statHelp}>Activation / Lifetime KBP</span>
        </div>
      </div>

      <div className={styles.territorySection}>
        <div className={styles.sectionHeader}>
          <h3>Territory Members</h3>
          <input
            type="text"
            placeholder="Search by name, Member ID, or email..."
            value={territorySearch}
            onChange={(e) => setTerritorySearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') fetchTerritory(1, territorySearch); }}
            className={styles.searchInput}
          />
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Member</th>
                <th>Member ID</th>
                <th>Status</th>
                <th>Total KBP</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {territoryLoading ? (
                <tr><td colSpan="5" className={styles.emptyState}>Loading territory...</td></tr>
              ) : territory.length === 0 ? (
                <tr><td colSpan="5" className={styles.emptyState}>No territory members found.</td></tr>
              ) : (
                territory.map((m) => (
                  <tr key={m._id}>
                    <td>{m.fullName}</td>
                    <td>{m.memberId}</td>
                    <td><span className={styles.statusBadge} data-status={m.status}>{m.status}</span></td>
                    <td>{(m.totalKBP || 0).toLocaleString()}</td>
                    <td>{m.createdAt ? new Date(m.createdAt).toLocaleDateString('en-IN') : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {territoryPagination.pages > 1 && (
          <div className={styles.pagination}>
            <button
              disabled={territoryPagination.page <= 1}
              onClick={() => fetchTerritory(territoryPagination.page - 1, territorySearch)}
            >← Prev</button>
            <span>Page {territoryPagination.page} of {territoryPagination.pages}</span>
            <button
              disabled={territoryPagination.page >= territoryPagination.pages}
              onClick={() => fetchTerritory(territoryPagination.page + 1, territorySearch)}
            >Next →</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FranchisePage;
