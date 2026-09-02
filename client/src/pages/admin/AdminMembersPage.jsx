import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminMembersPage.module.css';

const AdminMembersPage = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [selectedMember, setSelectedMember] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchMembers();
  }, [pagination.page, filterStatus]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...(filterStatus !== 'ALL' && { status: filterStatus })
      });
      
      const response = await api.get(`/api/admin/members?${params}`);
      if (response.data.success) {
        setMembers(response.data.data.members || []);
        setPagination(response.data.data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
      setError('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      fetchMembers();
      return;
    }
    
    try {
      setLoading(true);
      const response = await api.get(`/api/admin/members?search=${searchTerm}`);
      if (response.data.success) {
        setMembers(response.data.data.members || []);
      }
    } catch (error) {
      showNotification('Search failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (memberId, newStatus) => {
    try {
      await api.put(`/api/admin/members/${memberId}/status`, { status: newStatus });
      showNotification('Member status updated', 'success');
      fetchMembers();
    } catch (error) {
      showNotification('Failed to update status', 'error');
    }
  };

  const handleDeleteMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to delete this member?')) return;
    
    try {
      await api.delete(`/api/admin/members/${memberId}`);
      showNotification('Member deleted successfully', 'success');
      fetchMembers();
    } catch (error) {
      showNotification('Failed to delete member', 'error');
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      'ACTIVE': '#22c55e',
      'PENDING_VERIFICATION': '#f59e0b',
      'SUSPENDED': '#ef4444',
      'DEACTIVATED': '#64748b'
    };
    return colors[status] || '#64748b';
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading members...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <span>⚠️</span>
        <p>{error}</p>
        <button onClick={fetchMembers} className={styles.retryBtn}>Retry</button>
      </div>
    );
  }

  return (
    <div className={styles.membersPage}>
      <div className={styles.header}>
        <h1>Member Management</h1>
        <div className={styles.actions}>
          <div className={styles.searchBox}>
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch}>Search</button>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING_VERIFICATION">Pending</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DEACTIVATED">Deactivated</option>
          </select>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan="6" className={styles.emptyState}>No members found</td>
              </tr>
            ) : (
              members.map((member) => (
                <tr key={member._id}>
                  <td>{member.fullName}</td>
                  <td>{member.email}</td>
                  <td>{member.phoneNumber}</td>
                  <td>
                    <span 
                      className={styles.statusBadge}
                      style={{ background: getStatusBadge(member.status) }}
                    >
                      {member.status}
                    </span>
                  </td>
                  <td>{new Date(member.joinedDate).toLocaleDateString()}</td>
                  <td>
                    <div className={styles.actionButtons}>
                      <button 
                        className={styles.editBtn}
                        onClick={() => {
                          setSelectedMember(member);
                          setShowEditModal(true);
                        }}
                      >
                        Edit
                      </button>
                      <select
                        className={styles.statusSelect}
                        value={member.status}
                        onChange={(e) => handleStatusChange(member._id, e.target.value)}
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="SUSPENDED">Suspend</option>
                        <option value="DEACTIVATED">Deactivate</option>
                      </select>
                      <button 
                        className={styles.deleteBtn}
                        onClick={() => handleDeleteMember(member._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <button
          disabled={pagination.page <= 1}
          onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
        >
          Previous
        </button>
        <span>Page {pagination.page} of {pagination.pages}</span>
        <button
          disabled={pagination.page >= pagination.pages}
          onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default AdminMembersPage;