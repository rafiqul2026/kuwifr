// client/src/pages/admin/AdminAuditLogsPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminAuditLogsPage.module.css';

const MODULES = ['ALL', 'AUTH', 'ORDERS', 'WITHDRAWALS', 'PRODUCTS', 'RANKS', 'FUNDS', 'RULES', 'NOTIFICATIONS', 'SETTINGS'];
const SEVERITIES = ['ALL', 'INFO', 'WARNING', 'CRITICAL'];

const AdminAuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');

  const { showNotification } = useNotification ? useNotification() : {
    showNotification: (msg, type) => console.log(`[${type}] ${msg}`)
  };

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        ...(selectedModule !== 'ALL' && { module: selectedModule }),
        ...(selectedSeverity !== 'ALL' && { severity: selectedSeverity }),
        ...(searchQuery.trim() && { search: searchQuery.trim() })
      });

      let res;
      try {
        res = await api.get(`/api/admin/audit?${params}`);
      } catch {
        try {
          res = await api.get(`/api/audit?${params}`);
        } catch {
          res = await api.get(`/api/admin/audit/all?${params}`);
        }
      }

      const list = res.data?.data?.logs || res.data?.logs || (Array.isArray(res.data) ? res.data : []);
      setLogs(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      showNotification('Unable to fetch audit logs.', 'warning');
    } finally {
      setLoading(false);
    }
  }, [selectedModule, selectedSeverity, searchQuery, showNotification]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // KPI Metrics
  const stats = useMemo(() => {
    const total = logs.length;
    const critical = logs.filter((l) => l.severity === 'CRITICAL').length;
    const warnings = logs.filter((l) => l.severity === 'WARNING').length;
    const standard = logs.filter((l) => l.severity === 'INFO').length;
    return { total, critical, warnings, standard };
  }, [logs]);

  const handleExportCSV = () => {
    let csv = "Timestamp,Module,Action,Severity,Admin,IP Address,Details\n";
    logs.forEach((l) => {
      csv += `"${new Date(l.createdAt).toISOString()}","${l.module}","${l.action}","${l.severity}","${l.adminEmail || 'Admin'}","${l.ipAddress || '127.0.0.1'}","${l.details.replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KUWIFR_Audit_Log_${Date.now()}.csv`;
    a.click();
    showNotification('Audit log CSV exported successfully', 'success');
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Clear all historical audit records? This cannot be undone.')) return;
    try {
      await api.delete('/api/admin/audit/clear');
      showNotification('Audit logs cleared', 'info');
      fetchLogs();
    } catch (err) {
      showNotification('Failed to clear logs', 'error');
    }
  };

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'CRITICAL':
        return styles.badgeCritical;
      case 'WARNING':
        return styles.badgeWarning;
      default:
        return styles.badgeInfo;
    }
  };

  return (
    <div className={styles.auditPage}>
      {/* 1. Header Toolbar */}
      <div className={styles.header}>
        <div>
          <div className={styles.statusPill}>
            <span className={styles.pulseDot}></span>
            <span>Security Compliance Engine</span>
          </div>
          <h1 className={styles.title}>System Audit & Event Logs</h1>
          <p className={styles.subtitle}>
            Immutable forensic trace for administrative configuration updates, financial overrides, and platform security flags.
          </p>
        </div>

        <div className={styles.topActions}>
          <button onClick={handleExportCSV} className={styles.exportBtn}>
            📥 Export CSV
          </button>
          <button onClick={fetchLogs} className={styles.refreshBtn}>
            ↻ Refresh
          </button>
          <button onClick={handleClearHistory} className={styles.clearBtn}>
            🗑️ Clear History
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Recorded Events</span>
          <strong className={styles.statValue}>{stats.total}</strong>
          <span className={styles.statHelp}>Total trace events</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Routine Actions</span>
          <strong className={`${styles.statValue} ${styles.blueText}`}>{stats.standard}</strong>
          <span className={styles.statHelp}>Standard administrative tasks</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Policy Warnings</span>
          <strong className={`${styles.statValue} ${styles.amberText}`}>{stats.warnings}</strong>
          <span className={styles.statHelp}>Rule & quota changes</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Critical Operations</span>
          <strong className={`${styles.statValue} ${styles.redText}`}>{stats.critical}</strong>
          <span className={styles.statHelp}>Rank & ledger structure edits</span>
        </div>
      </div>

      {/* 3. Search & Module Filter */}
      <div className={styles.filterStrip}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search action, details, admin email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className={styles.clearSearch}>✕</button>
          )}
        </div>

        <div className={styles.filtersGroup}>
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className={styles.selectInput}
          >
            {MODULES.map((m) => (
              <option key={m} value={m}>{m === 'ALL' ? 'All Modules' : m}</option>
            ))}
          </select>

          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className={styles.selectInput}
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{s === 'ALL' ? 'All Severities' : s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Logs Table */}
      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.loadingArea}>
            <div className={styles.spinner}></div>
            <p>Syncing security audit trail...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className={styles.emptyArea}>
            <span className={styles.emptyIcon}>🛡️</span>
            <h3>No audit records found</h3>
            <p>Administrative actions are recorded automatically in real-time.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>TIMESTAMP</th>
                <th>MODULE</th>
                <th>ACTION CODE</th>
                <th>SEVERITY</th>
                <th>ACTOR / IP</th>
                <th>EVENT DETAILS</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const id = log._id || log.id;
                return (
                  <tr key={id}>
                    <td>
                      <span className={styles.timeText}>
                        {log.createdAt ? new Date(log.createdAt).toLocaleString('en-IN') : 'Recent'}
                      </span>
                    </td>
                    <td>
                      <span className={styles.moduleBadge}>{log.module || 'SYSTEM'}</span>
                    </td>
                    <td>
                      <code className={styles.actionCode}>{log.action}</code>
                    </td>
                    <td>
                      <span className={`${styles.severityBadge} ${getSeverityBadge(log.severity)}`}>
                        {log.severity || 'INFO'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actorCol}>
                        <strong>{log.adminEmail || 'admin@kuwifr.com'}</strong>
                        <small>{log.ipAddress || '127.0.0.1'}</small>
                      </div>
                    </td>
                    <td>
                      <p className={styles.detailsText}>{log.details || 'System operation executed.'}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminAuditLogsPage;