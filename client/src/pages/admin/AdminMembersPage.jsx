// client/src/pages/admin/AdminMembersPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminMembersPage.module.css';

const AdminMembersPage = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
  const [selectedMember, setSelectedMember] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  const notificationHook = useNotification ? useNotification() : null;
  const notify = (msg, type = 'info') => {
    if (notificationHook && typeof notificationHook.showNotification === 'function') {
      notificationHook.showNotification(msg, type);
    }
  };

  const fetchMembers = useCallback(async (targetPage = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page: targetPage,
        limit: pagination.limit,
        status: filterStatus !== 'ALL' ? filterStatus : undefined,
        search: searchTerm.trim() || undefined
      };

      let response;
      try {
        response = await api.get('/api/admin/members', { params });
      } catch (err) {
        response = await api.get('/api/admin/users', { params });
      }

      if (response.data?.success) {
        const payload = response.data.data || {};
        const memberList = payload.members || payload.users || (Array.isArray(payload) ? payload : []);
        setMembers(memberList);

        if (payload.pagination) {
          setPagination(payload.pagination);
        } else {
          setPagination((prev) => ({
            ...prev,
            page: targetPage,
            total: memberList.length,
            pages: Math.ceil(memberList.length / prev.limit) || 1
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load members:', err);
      setError('Unable to fetch members. Please check database connectivity.');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, searchTerm, pagination.limit]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMembers(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchMembers]);

  const handleStatusChange = async (memberId, newStatus) => {
    try {
      setUpdatingId(memberId);
      const res = await api.put(`/api/admin/members/${memberId}/status`, { status: newStatus });
      if (res.data?.success) {
        notify(`Member marked as ${newStatus}`, 'success');
        setMembers((prev) =>
          prev.map((m) => (m._id === memberId ? { ...m, status: newStatus } : m))
        );
        if (selectedMember && selectedMember._id === memberId) {
          setSelectedMember((prev) => ({ ...prev, status: newStatus }));
        }
      }
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to update member status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatAddress = (addr) => {
    if (!addr) return 'Not Provided';
    if (typeof addr === 'string') return addr;
    const parts = [addr.street, addr.city, addr.state, addr.country, addr.pincode].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Not Provided';
  };

  const getStatusBadgeClass = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'active') return styles.badgeActive;
    if (s === 'pending_verification' || s === 'pending') return styles.badgePending;
    if (s === 'suspended' || s === 'blocked') return styles.badgeSuspended;
    return styles.badgeDeactivated;
  };

  return (
    <div className={styles.container}>
      {/* Header Section */}
      <div className={styles.header}>
        <div>
          <div className={styles.breadcrumb}>ADMINISTRATION / NETWORK</div>
          <h1 className={styles.pageTitle}>Distributor Management</h1>
          <p className={styles.pageSubtitle}>
            Full distributor directory, binary genealogy, KYC verifications, and sponsor linkages.
          </p>
        </div>
        <button onClick={() => fetchMembers(pagination.page)} className={styles.syncBtn}>
          🔄 Refresh
        </button>
      </div>

      {/* Control Bar: Search & Status Filters */}
      <div className={styles.controlsBar}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search by ID, Name, Email, Phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className={styles.clearBtn}>
              ✕
            </button>
          )}
        </div>

        <div className={styles.filterTabs}>
          {['ALL', 'ACTIVE', 'INACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED', 'DEACTIVATED'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`${styles.tabBtn} ${filterStatus === status ? styles.tabBtnActive : ''}`}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Error Alert Box */}
      {error && (
        <div className={styles.errorBox}>
          <span>⚠️ {error}</span>
          <button onClick={() => fetchMembers(1)} className={styles.retryBtn}>
            Retry
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className={styles.card}>
        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p>Fetching distributor profiles & sponsor tree...</p>
          </div>
        ) : members.length === 0 ? (
          <div className={styles.emptyState}>
            <span style={{ fontSize: '42px' }}>👥</span>
            <h3>No Members Found</h3>
            <p>No distributor records matched your search query or filter criteria.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Distributor</th>
                    <th>Member ID</th>
                    <th>Sponsor ID</th>
                    <th>Contact Details</th>
                    <th>Total KBP</th>
                    <th>Lifetime Income</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member._id} className={styles.tableRow}>
                      <td>
                        <div className={styles.userCell}>
                          <div className={styles.avatar}>
                            {(member.fullName || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <div className={styles.userName}>{member.fullName || 'Unnamed'}</div>
                            <span className={styles.userRole}>{member.role || 'DISTRIBUTOR'}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={styles.memberIdBadge}>
                          {member.memberId || 'Pending'}
                        </span>
                      </td>
                      <td>
                        <span className={styles.sponsorBadge}>
                          {member.sponsorId?.memberId || (typeof member.sponsorId === 'string' ? member.sponsorId : 'Direct')}
                        </span>
                      </td>
                      <td>
                        <div className={styles.contactCell}>
                          <div>{member.email}</div>
                          <small>{member.phoneNumber || 'No phone'}</small>
                        </div>
                      </td>
                      <td className={styles.kbpCell}>{member.totalKBP || 0}</td>
                      <td className={styles.incomeCell}>
                        ₹{(member.lifetimeIncome || 0).toLocaleString()}
                      </td>
                      <td>
                        <span className={`${styles.badge} ${getStatusBadgeClass(member.status)}`}>
                          {member.status || 'INACTIVE'}
                        </span>
                      </td>
                      <td className={styles.dateCell}>
                        {new Date(member.createdAt || Date.now()).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className={styles.actionGroup}>
                          <button
                            onClick={() => setSelectedMember(member)}
                            className={styles.viewBtn}
                          >
                            Inspect
                          </button>
                          <select
                            disabled={updatingId === member._id}
                            value={member.status || 'INACTIVE'}
                            onChange={(e) => handleStatusChange(member._id, e.target.value)}
                            className={styles.statusSelect}
                          >
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                            <option value="SUSPENDED">Suspend</option>
                            <option value="DEACTIVATED">Deactivate</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stack View (Card-Based, No Slider) */}
            <div className={styles.mobileCardStack}>
              {members.map((member) => (
                <div key={member._id} className={styles.mobileCard}>
                  <div className={styles.mobileCardTop}>
                    <div className={styles.userCell}>
                      <div className={styles.avatar}>
                        {(member.fullName || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className={styles.userName}>{member.fullName || 'Unnamed'}</div>
                        <span className={styles.memberIdBadge}>{member.memberId || 'ID Pending'}</span>
                      </div>
                    </div>
                    <span className={`${styles.badge} ${getStatusBadgeClass(member.status)}`}>
                      {member.status}
                    </span>
                  </div>

                  <div className={styles.mobileDetailsGrid}>
                    <div>
                      <small className={styles.mobileLabel}>Sponsor ID</small>
                      <div className={styles.sponsorBadge} style={{ display: 'inline-block', marginTop: '2px' }}>
                        {member.sponsorId?.memberId || 'Direct'}
                      </div>
                    </div>
                    <div>
                      <small className={styles.mobileLabel}>Phone</small>
                      <div className={styles.mobileVal}>{member.phoneNumber || 'N/A'}</div>
                    </div>
                    <div>
                      <small className={styles.mobileLabel}>Lifetime Income</small>
                      <div className={styles.incomeCell}>₹{(member.lifetimeIncome || 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <small className={styles.mobileLabel}>Total KBP</small>
                      <div className={styles.kbpCell}>{member.totalKBP || 0}</div>
                    </div>
                  </div>

                  <div className={styles.mobileActions}>
                    <button
                      onClick={() => setSelectedMember(member)}
                      className={styles.viewBtn}
                      style={{ flex: 1 }}
                    >
                      Inspect Profile
                    </button>
                    <select
                      disabled={updatingId === member._id}
                      value={member.status || 'INACTIVE'}
                      onChange={(e) => handleStatusChange(member._id, e.target.value)}
                      className={styles.statusSelect}
                      style={{ flex: 1.4 }}
                    >
                      <option value="ACTIVE">Set Active</option>
                      <option value="INACTIVE">Set Inactive</option>
                      <option value="SUSPENDED">Suspend</option>
                      <option value="DEACTIVATED">Deactivate</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {pagination.pages > 1 && (
              <div className={styles.paginationRow}>
                <span className={styles.pageInfo}>
                  Showing page {pagination.page} of {pagination.pages} ({pagination.total} distributors)
                </span>
                <div className={styles.pageBtns}>
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => fetchMembers(pagination.page - 1)}
                    className={styles.pageBtn}
                  >
                    Previous
                  </button>
                  <button
                    disabled={pagination.page >= pagination.pages}
                    onClick={() => fetchMembers(pagination.page + 1)}
                    className={styles.pageBtn}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Inspect Member Modal */}
      {selectedMember && (
        <div className={styles.modalOverlay} onClick={() => setSelectedMember(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderInfo}>
                <div className={styles.avatarLarge}>
                  {(selectedMember.fullName || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <h2 className={styles.modalName}>{selectedMember.fullName || 'Member Profile'}</h2>
                  <div className={styles.modalIdRow}>
                    <span className={styles.memberIdBadge}>
                      {selectedMember.memberId || 'ID PENDING'}
                    </span>
                    <button
                      onClick={() => copyToClipboard(selectedMember.memberId, 'memberId')}
                      className={styles.copyBtn}
                    >
                      {copiedField === 'memberId' ? '✓ Copied' : 'Copy ID'}
                    </button>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedMember(null)} className={styles.closeBtn}>
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Highlighted Hierarchy / Sponsor Box */}
              <div className={styles.sponsorHeroBox}>
                <div className={styles.sponsorHeroItem}>
                  <span className={styles.sponsorHeroLabel}>SPONSOR ID</span>
                  <div className={styles.sponsorHeroValue}>
                    <span className={styles.sponsorHighlight}>
                      {selectedMember.sponsorId?.memberId || (typeof selectedMember.sponsorId === 'string' ? selectedMember.sponsorId : 'ROOT DIRECT')}
                    </span>
                    {selectedMember.sponsorId?.memberId && (
                      <button
                        onClick={() => copyToClipboard(selectedMember.sponsorId.memberId, 'sponsorId')}
                        className={styles.copyBtn}
                        style={{ marginLeft: '8px' }}
                      >
                        {copiedField === 'sponsorId' ? '✓' : 'Copy'}
                      </button>
                    )}
                  </div>
                  <small className={styles.sponsorHeroSub}>
                    {selectedMember.sponsorId?.fullName ? `Sponsor: ${selectedMember.sponsorId.fullName}` : 'Direct Company Referral'}
                  </small>
                </div>

                <div className={styles.sponsorHeroItem}>
                  <span className={styles.sponsorHeroLabel}>DIRECT REFERRALS</span>
                  <div className={styles.sponsorHeroCount}>
                    {selectedMember.directReferrals || 0}
                  </div>
                  <small className={styles.sponsorHeroSub}>Active Downlines</small>
                </div>
              </div>

              {/* Detail Grid */}
              <div className={styles.sectionHeader}>Personal & Account Details</div>
              <div className={styles.modalGrid}>
                <div className={styles.infoCard}>
                  <label>Email Address</label>
                  <p>{selectedMember.email}</p>
                </div>
                <div className={styles.infoCard}>
                  <label>Phone Number</label>
                  <p>{selectedMember.phoneNumber || 'Not Registered'}</p>
                </div>
                <div className={styles.infoCard}>
                  <label>Account Role</label>
                  <p>{selectedMember.role || 'MEMBER'}</p>
                </div>
                <div className={styles.infoCard}>
                  <label>Account Status</label>
                  <div>
                    <span className={`${styles.badge} ${getStatusBadgeClass(selectedMember.status)}`}>
                      {selectedMember.status || 'INACTIVE'}
                    </span>
                  </div>
                </div>
                <div className={styles.infoCard}>
                  <label>Total KBP Accumulated</label>
                  <p style={{ color: '#2563eb', fontWeight: 700 }}>{selectedMember.totalKBP || 0}</p>
                </div>
                <div className={styles.infoCard}>
                  <label>Lifetime Income</label>
                  <p style={{ color: '#059669', fontWeight: 700 }}>
                    ₹{(selectedMember.lifetimeIncome || 0).toLocaleString()}
                  </p>
                </div>
                <div className={styles.infoCard}>
                  <label>Registration Date</label>
                  <p>{new Date(selectedMember.createdAt || Date.now()).toLocaleString()}</p>
                </div>
                <div className={styles.infoCard}>
                  <label>Email Verified</label>
                  <p>{selectedMember.emailVerified ? '✅ Verified' : '⏳ Unverified'}</p>
                </div>
              </div>

              {/* Address Container */}
              <div className={styles.sectionHeader}>Billing & Shipping Location</div>
              <div className={styles.addressBox}>
                📍 {formatAddress(selectedMember.address)}
              </div>
            </div>

            {/* Modal Footer */}
            <div className={styles.modalFooter}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Status:</span>
                <select
                  disabled={updatingId === selectedMember._id}
                  value={selectedMember.status || 'INACTIVE'}
                  onChange={(e) => handleStatusChange(selectedMember._id, e.target.value)}
                  className={styles.statusSelect}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspend</option>
                  <option value="DEACTIVATED">Deactivate</option>
                </select>
              </div>

              <button
                onClick={() => setSelectedMember(null)}
                className={styles.closeModalBtn}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMembersPage;