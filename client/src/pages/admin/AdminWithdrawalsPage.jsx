import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminWithdrawalsPage.module.css';

const AdminWithdrawalsPage = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('PENDING');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchWithdrawals();
  }, [filterStatus, pagination.page]);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let endpoint = '/api/admin/withdrawals';
      if (filterStatus === 'PENDING') {
        endpoint = '/api/admin/withdrawals/pending';
      }
      
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit
      });
      
      const response = await api.get(`${endpoint}?${params}`);
      if (response.data.success) {
        setWithdrawals(response.data.data.withdrawals || []);
        setPagination(response.data.data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch withdrawals:', error);
      setError('Failed to load withdrawals');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (withdrawalId) => {
    try {
      await api.put(`/api/admin/withdrawals/${withdrawalId}/approve`, { notes: 'Approved by admin' });
      showNotification('Withdrawal approved', 'success');
      fetchWithdrawals();
    } catch (error) {
      showNotification('Failed to approve withdrawal', 'error');
    }
  };

  const handleReject = async (withdrawalId) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    
    try {
      await api.put(`/api/admin/withdrawals/${withdrawalId}/reject`, { reason });
      showNotification('Withdrawal rejected', 'success');
      fetchWithdrawals();
    } catch (error) {
      showNotification('Failed to reject withdrawal', 'error');
    }
  };

  const handleProcess = async (withdrawalId) => {
    try {
      const utrNumber = prompt('Enter UTR number:');
      if (!utrNumber) return;
      
      await api.put(`/api/admin/withdrawals/${withdrawalId}/process`, { 
        utrNumber,
        paymentMethod: 'BANK_TRANSFER'
      });
      showNotification('Withdrawal processed', 'success');
      fetchWithdrawals();
    } catch (error) {
      showNotification('Failed to process withdrawal', 'error');
    }
  };

  const handleReconcileTDS = async (withdrawalId) => {
    try {
      const refNumber = prompt('Enter TDS reference number:');
      if (!refNumber) return;
      
      await api.put(`/api/admin/withdrawals/${withdrawalId}/reconcile-tds`, { 
        referenceNumber: refNumber,
        notes: 'TDS reconciled'
      });
      showNotification('TDS reconciled', 'success');
      fetchWithdrawals();
    } catch (error) {
      showNotification('Failed to reconcile TDS', 'error');
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      'PENDING': '#f59e0b',
      'APPROVED': '#22c55e',
      'REJECTED': '#ef4444',
      'PROCESSED': '#3b82f6',
      'CANCELLED': '#64748b'
    };
    return colors[status] || '#64748b';
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading withdrawals...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <span>⚠️</span>
        <p>{error}</p>
        <button onClick={fetchWithdrawals} className={styles.retryBtn}>Retry</button>
      </div>
    );
  }

  return (
    <div className={styles.withdrawalsPage}>
      <div className={styles.header}>
        <h1>Withdrawal Management</h1>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="PROCESSED">Processed</option>
          <option value="ALL">All</option>
        </select>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Member</th>
              <th>Gross Amount</th>
              <th>Admin Charge</th>
              <th>TDS</th>
              <th>Net Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.length === 0 ? (
              <tr>
                <td colSpan="8" className={styles.emptyState}>No withdrawals found</td>
              </tr>
            ) : (
              withdrawals.map((w) => (
                <tr key={w._id}>
                  <td>{w.withdrawalNumber}</td>
                  <td>{w.userId?.fullName || 'N/A'}</td>
                  <td>₹{w.grossAmount?.toLocaleString()}</td>
                  <td>₹{w.adminCharge?.toLocaleString()}</td>
                  <td>₹{w.tdsAmount?.toLocaleString()}</td>
                  <td>₹{w.netAmount?.toLocaleString()}</td>
                  <td>
                    <span 
                      className={styles.statusBadge}
                      style={{ background: getStatusBadge(w.status) }}
                    >
                      {w.status}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionButtons}>
                      {w.status === 'PENDING' && (
                        <>
                          <button 
                            className={styles.approveBtn}
                            onClick={() => handleApprove(w._id)}
                          >
                            Approve
                          </button>
                          <button 
                            className={styles.rejectBtn}
                            onClick={() => handleReject(w._id)}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {w.status === 'APPROVED' && (
                        <button 
                          className={styles.processBtn}
                          onClick={() => handleProcess(w._id)}
                        >
                          Process
                        </button>
                      )}
                      {w.status === 'PROCESSED' && (
                        <button 
                          className={styles.reconcileBtn}
                          onClick={() => handleReconcileTDS(w._id)}
                        >
                          Reconcile TDS
                        </button>
                      )}
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

export default AdminWithdrawalsPage;