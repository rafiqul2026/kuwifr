// client/src/pages/admin/AdminMemberDetailPage.jsx
//
// Full single-member profile view — this is what the Admin Dashboard's
// "Recent Registrations" row and the Admin Members page's detail link
// previously pointed at (/admin/members/:id) with no page registered for
// that route, so clicking either one silently redirected back to the
// dashboard. Backed by the new GET /api/admin/members/:id endpoint
// (admin.controller.js: getUserById).
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminMemberDetailPage.module.css';

const formatINR = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(val) || 0);

const formatDate = (val, withTime = false) => {
  if (!val) return '—';
  return new Date(val).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {})
  });
};

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED', 'DEACTIVATED'];

const AdminMemberDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification ? useNotification() : { showNotification: () => {} };

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchMember = useCallback(async () => {
    try {
      setLoading(true);
      setNotFound(false);
      const res = await api.get(`/api/admin/members/${id}`);
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setNotFound(true);
      } else {
        console.error('Failed to load member:', err);
        showNotification('Failed to load member profile.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [id, showNotification]);

  useEffect(() => {
    fetchMember();
  }, [fetchMember]);

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value;
    if (!newStatus || newStatus === data?.user?.status) return;
    setUpdatingStatus(true);
    try {
      await api.put(`/api/admin/members/${id}/status`, { status: newStatus });
      setData((prev) => ({ ...prev, user: { ...prev.user, status: newStatus } }));
      showNotification(`Status updated to ${newStatus}.`, 'success');
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to update status.', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.detailPage}>
        <div className={styles.loadingWrapper}>
          <div className={styles.spinner} />
          <p>Loading member profile...</p>
        </div>
      </div>
    );
  }

  if (notFound || !data?.user) {
    return (
      <div className={styles.detailPage}>
        <button type="button" className={styles.backBtn} onClick={() => navigate('/admin/members')}>
          ← Back to Members
        </button>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🔍</span>
          <p>This member no longer exists, or the link is invalid.</p>
        </div>
      </div>
    );
  }

  const { user, wallet, binaryNode, directReferralCount, downlineCount, recentOrders, recentIncome } = data;

  return (
    <div className={styles.detailPage}>
      <button type="button" className={styles.backBtn} onClick={() => navigate('/admin/members')}>
        ← Back to Members
      </button>

      <div className={styles.profileHeader}>
        <div className={styles.avatarLarge}>
          {(user.fullName || '?').charAt(0).toUpperCase()}
        </div>
        <div className={styles.profileHeaderInfo}>
          <h1 className={styles.memberName}>{user.fullName || 'Unnamed Member'}</h1>
          <div className={styles.profileMetaRow}>
            <span className={styles.memberIdChip}>{user.memberId || '—'}</span>
            <span className={`${styles.statusChip} ${styles['status_' + (user.status || 'INACTIVE')]}`}>
              {user.status || 'INACTIVE'}
            </span>
            <span className={`${styles.kycChip} ${styles['kyc_' + (user.kyc?.status || 'NOT_SUBMITTED')]}`}>
              KYC: {(user.kyc?.status || 'NOT_SUBMITTED').replace(/_/g, ' ')}
            </span>
          </div>
          <p className={styles.contactLine}>{user.email} · {user.phoneNumber || 'No phone on file'}</p>
        </div>
        <div className={styles.statusControl}>
          <label>Change Status</label>
          <select value={user.status || ''} onChange={handleStatusChange} disabled={updatingStatus}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.statGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Income Wallet</span>
          <strong className={styles.statValue}>{formatINR(wallet?.incomeBalance)}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Repurchase Wallet</span>
          <strong className={styles.statValue}>{formatINR(wallet?.repurchaseBalance)}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Salary Wallet</span>
          <strong className={styles.statValue}>{formatINR(wallet?.salaryBalance)}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Lifetime Income</span>
          <strong className={styles.statValue}>
            {formatINR((wallet?.referralIncome || 0) + (wallet?.binaryIncome || 0) + (wallet?.leadershipIncome || 0) + (wallet?.selfRepurchaseIncome || 0) + (wallet?.downlineRepurchaseIncome || 0))}
          </strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Direct Referrals</span>
          <strong className={styles.statValue}>{directReferralCount ?? 0}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Downline</span>
          <strong className={styles.statValue}>{downlineCount ?? 0}</strong>
        </div>
      </div>

      <div className={styles.contentGrid}>
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Profile Details</h3>
          <dl className={styles.detailList}>
            <div><dt>Sponsor</dt><dd>{user.sponsorId ? `${user.sponsorId.fullName} (${user.sponsorId.memberId})` : '—'}</dd></div>
            <div><dt>Active Package</dt><dd>{user.activePackageId ? user.activePackageId.name : 'No active package'}</dd></div>
            <div><dt>Total KBP</dt><dd>{(user.totalKBP || 0).toLocaleString('en-IN')}</dd></div>
            <div><dt>Binary Side</dt><dd>{user.binarySide || '—'}</dd></div>
            <div><dt>Joined</dt><dd>{formatDate(user.createdAt)}</dd></div>
            <div><dt>Email Verified</dt><dd>{user.isEmailVerified ? 'Yes' : 'No'}</dd></div>
          </dl>
        </div>

        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Binary Tree Snapshot</h3>
          {binaryNode ? (
            <dl className={styles.detailList}>
              <div><dt>Left Volume (KBP)</dt><dd>{(binaryNode.leftVolume || 0).toLocaleString('en-IN')}</dd></div>
              <div><dt>Right Volume (KBP)</dt><dd>{(binaryNode.rightVolume || 0).toLocaleString('en-IN')}</dd></div>
              <div><dt>Matched Pairs</dt><dd>{binaryNode.pairCount || 0}</dd></div>
              <div><dt>Matching Volume</dt><dd>{(binaryNode.matchingVolume || 0).toLocaleString('en-IN')}</dd></div>
            </dl>
          ) : (
            <p className={styles.dimText}>No binary tree node yet — this member hasn't been placed.</p>
          )}
        </div>
      </div>

      <div className={styles.panel}>
        <h3 className={styles.panelTitle}>Recent Orders</h3>
        {recentOrders?.length > 0 ? (
          <table className={styles.miniTable}>
            <thead>
              <tr><th>Order #</th><th>Type</th><th>Amount</th><th>KBP</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o._id} className={styles.clickableRow} onClick={() => navigate(`/admin/orders/${o._id}`)}>
                  <td>{o.orderNumber}</td>
                  <td>{o.orderType || '—'}</td>
                  <td>{formatINR(o.totalAmount)}</td>
                  <td>{(o.kbpGenerated || 0).toLocaleString('en-IN')}</td>
                  <td><span className={styles.smallBadge}>{o.status}</span></td>
                  <td>{formatDate(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={styles.dimText}>No orders yet.</p>
        )}
      </div>

      <div className={styles.panel}>
        <h3 className={styles.panelTitle}>Recent Income Transactions</h3>
        {recentIncome?.length > 0 ? (
          <table className={styles.miniTable}>
            <thead>
              <tr><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {recentIncome.map((tx) => (
                <tr key={tx._id}>
                  <td>{(tx.type || '').replace(/_/g, ' ')}</td>
                  <td>{formatINR(tx.creditedAmount)}</td>
                  <td><span className={styles.smallBadge}>{tx.status}</span></td>
                  <td>{formatDate(tx.createdAt, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={styles.dimText}>No income transactions yet.</p>
        )}
      </div>
    </div>
  );
};

export default AdminMemberDetailPage;
