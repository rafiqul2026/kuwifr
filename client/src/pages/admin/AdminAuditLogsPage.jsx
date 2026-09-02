import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminAuditLogsPage.module.css';

const AdminAuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [filters, setFilters] = useState({
    action: '',
    entity: '',
    userId: '',
    startDate: '',
    endDate: ''
  });
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchLogs();
  }, [pagination.page, filters]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit
      });
      
      if (filters.action) params.append('action', filters.action);
      if (filters.entity) params.append('entity', filters.entity);
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await api.get(`/api/admin/audit-logs?${params}`);
      if (response.data.success) {
        setLogs(response.data.data.logs || []);
        setPagination(response.data.data.pagination);
      }
    } catch (error) {
      showNotification('Failed to fetch audit logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (log) => {
    setSelectedLog(log);
    setShowDetails(true);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      
      const response = await api.get(`/api/admin/audit-logs/export?${params}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      showNotification('Audit logs exported successfully', 'success');
    } catch (error) {
      showNotification('Failed to export audit logs', 'error');
    }
  };

  const getActionColor = (action) => {
    const colors = {
      'LOGIN': '#3b82f6',
      'LOGOUT': '#64748b',
      'CREATE': '#22c55e',
      'UPDATE': '#f59e0b',
      'DELETE': '#ef4444',
      'APPROVE': '#22c55e',
      'REJECT': '#ef4444',
      'PROCESS': '#8b5cf6',
      'ADMIN_ACTION': '#ec4899'
    };
    return colors[action] || '#64748b';
  };

  const getEntityIcon = (entity) => {
    const icons = {
      'User': '👤',
      'Order': '🛒',
      'Package': '📦',
      'Product': '🛍️',
      'Wallet': '💰',
      'Withdrawal': '💸',
      'Rank': '🏆',
      'Fund': '🏦',
      'Rule': '📋',
      'Campaign': '🎯'
    };
    return icons[entity] || '📝';
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading audit logs...</p>
      </div>
    );
  }

  return (
    <div className={styles.auditLogsPage}>
      <div className={styles.header}>
        <h1>Audit Logs</h1>
        <button className={styles.exportBtn} onClick={handleExport}>
          📥 Export Logs
        </button>
      </div>

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label>Action</label>
          <select
            value={filters.action}
            onChange={(e) => setFilters({...filters, action: e.target.value})}
          >
            <option value="">All Actions</option>
            <option value="LOGIN">Login</option>
            <option value="LOGOUT">Logout</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="APPROVE">Approve</option>
            <option value="REJECT">Reject</option>
            <option value="PROCESS">Process</option>
            <option value="ADMIN_ACTION">Admin Action</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>Entity</label>
          <select
            value={filters.entity}
            onChange={(e) => setFilters({...filters, entity: e.target.value})}
          >
            <option value="">All Entities</option>
            <option value="User">User</option>
            <option value="Order">Order</option>
            <option value="Package">Package</option>
            <option value="Product">Product</option>
            <option value="Wallet">Wallet</option>
            <option value="Withdrawal">Withdrawal</option>
            <option value="Rank">Rank</option>
            <option value="Fund">Fund</option>
            <option value="Rule">Rule</option>
            <option value="Campaign">Campaign</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>User ID</label>
          <input
            type="text"
            value={filters.userId}
            onChange={(e) => setFilters({...filters, userId: e.target.value})}
            placeholder="Search by user ID"
          />
        </div>

        <div className={styles.filterGroup}>
          <label>Start Date</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({...filters, startDate: e.target.value})}
          />
        </div>

        <div className={styles.filterGroup}>
          <label>End Date</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({...filters, endDate: e.target.value})}
          />
        </div>

        <button className={styles.applyBtn} onClick={() => fetchLogs()}>
          Apply Filters
        </button>
        <button className={styles.clearBtn} onClick={() => {
          setFilters({ action: '', entity: '', userId: '', startDate: '', endDate: '' });
          fetchLogs();
        }}>
          Clear
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Details</th>
              <th>IP</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="7" className={styles.emptyState}>No audit logs found</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log._id}>
                  <td className={styles.timestamp}>
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td>
                    <div className={styles.userInfo}>
                      <span>{log.userId?.fullName || 'System'}</span>
                      <span className={styles.userEmail}>{log.userId?.email || 'N/A'}</span>
                    </div>
                  </td>
                  <td>
                    <span 
                      className={styles.actionBadge}
                      style={{ background: getActionColor(log.action) }}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td>
                    <span className={styles.entityBadge}>
                      {getEntityIcon(log.entity)} {log.entity}
                    </span>
                  </td>
                  <td className={styles.details}>
                    <div className={styles.detailsPreview}>
                      {log.newValue ? 
                        Object.keys(log.newValue).slice(0, 2).map(key => 
                          `${key}: ${JSON.stringify(log.newValue[key]).slice(0, 20)}...`
                        ).join(', ')
                        : 'No details'
                      }
                    </div>
                  </td>
                  <td className={styles.ip}>
                    <code>{log.ip || 'N/A'}</code>
                  </td>
                  <td>
                    <button 
                      className={styles.viewBtn}
                      onClick={() => handleViewDetails(log)}
                    >
                      View
                    </button>
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

      {/* Details Modal */}
      {showDetails && selectedLog && (
        <div className={styles.modalOverlay} onClick={() => setShowDetails(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Audit Log Details</h2>
              <button className={styles.closeModalBtn} onClick={() => setShowDetails(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.detailsGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Timestamp</span>
                  <span className={styles.detailValue}>
                    {new Date(selectedLog.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>User</span>
                  <span className={styles.detailValue}>
                    {selectedLog.userId?.fullName || 'System'} ({selectedLog.userId?.email || 'N/A'})
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Action</span>
                  <span className={styles.detailValue}>
                    <span 
                      className={styles.actionBadge}
                      style={{ background: getActionColor(selectedLog.action) }}
                    >
                      {selectedLog.action}
                    </span>
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Entity</span>
                  <span className={styles.detailValue}>
                    {selectedLog.entity} (ID: {selectedLog.entityId})
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>IP Address</span>
                  <span className={styles.detailValue}>
                    <code>{selectedLog.ip || 'N/A'}</code>
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>User Agent</span>
                  <span className={styles.detailValue} style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                    {selectedLog.userAgent || 'N/A'}
                  </span>
                </div>
              </div>

              <div className={styles.changeSection}>
                <h3>Changes</h3>
                <div className={styles.changeGrid}>
                  <div className={styles.changeBox}>
                    <h4>Old Value</h4>
                    <pre className={styles.changeContent}>
                      {JSON.stringify(selectedLog.oldValue, null, 2) || 'No old value'}
                    </pre>
                  </div>
                  <div className={styles.changeBox}>
                    <h4>New Value</h4>
                    <pre className={styles.changeContent}>
                      {JSON.stringify(selectedLog.newValue, null, 2) || 'No new value'}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAuditLogsPage;