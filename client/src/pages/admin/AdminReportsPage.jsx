// client/src/pages/admin/AdminReportsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminReportsPage.module.css';

const REPORT_TYPES = [
  { id: 'members', label: 'Member Report', icon: '👥' },
  { id: 'income', label: 'Income Report', icon: '💰' },
  { id: 'withdrawals', label: 'Withdrawal Report', icon: '💳' },
  { id: 'sales', label: 'Sales Report', icon: '🛍️' },
  { id: 'financial', label: 'Financial Report', icon: '📈' },
  { id: 'tax', label: 'Tax Report (TDS)', icon: '🏛️' }
];

const AdminReportsPage = () => {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState('members');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [reportData, setReportData] = useState(null);
  const { showNotification } = useNotification ? useNotification() : {
    showNotification: (msg, type) => console.log(`[${type}] ${msg}`)
  };

  // Generate Report
  const generateReport = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });

      let endpoint = `/api/reports/admin/${reportType}?${params}`;
      let response;
      try {
        response = await api.get(endpoint);
      } catch {
        response = await api.get(`/api/admin/reports/${reportType}?${params}`);
      }

      if (response && response.data?.success) {
        setReportData(response.data.data);
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
      showNotification('Unable to fetch live report data for this range.', 'error');
    } finally {
      setLoading(false);
    }
  }, [dateRange, reportType, showNotification]);

  // Initial load on page mount
  useEffect(() => {
    generateReport();
  }, [generateReport]);

  // Quick Preset Handlers
  const handleApplyPreset = (days) => {
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setDateRange({ startDate: start, endDate: end });
  };

  // Export CSV
  const exportCSV = async () => {
    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      const response = await api.get(`/api/reports/export/${reportType}?${params}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportType}-report-${dateRange.startDate}-to-${dateRange.endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      showNotification('Report exported successfully (CSV format)', 'success');
    } catch (error) {
      showNotification('Failed to export report CSV', 'error');
    }
  };

  // 1. Members Report View
  const renderMemberReport = () => {
    const data = reportData?.members ? reportData : { members: reportData || [], total: 0, active: 0, new: 0 };
    const list = Array.isArray(data.members) ? data.members : [];

    return (
      <div className={styles.reportContent}>
        <div className={styles.summaryStats}>
          <div className={styles.summaryCard}>
            <span className={styles.statLabel}>Total Members</span>
            <strong className={styles.statValue}>{data.total || list.length}</strong>
            <small>Registered Accounts</small>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.statLabel}>Active Members</span>
            <strong className={`${styles.statValue} ${styles.greenText}`}>{data.active || list.length}</strong>
            <small>Package Activated</small>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.statLabel}>Period Registrations</span>
            <strong className={`${styles.statValue} ${styles.blueText}`}>{data.new || list.length}</strong>
            <small>Within Selected Dates</small>
          </div>
        </div>

        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>FULL NAME</th>
                <th>EMAIL ADDRESS</th>
                <th>PHONE NUMBER</th>
                <th>STATUS</th>
                <th>ROLE</th>
                <th>JOINED DATE</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan="6" className={styles.emptyTableRow}>No members found for this date range</td></tr>
              ) : (
                list.map((member) => (
                  <tr key={member._id || member.id}>
                    <td><strong>{member.fullName || 'Member'}</strong></td>
                    <td>{member.email}</td>
                    <td>{member.phoneNumber || '—'}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${styles[member.status?.toLowerCase()] || styles.active}`}>
                        {member.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td><code>{member.role || 'MEMBER'}</code></td>
                    <td>{member.joinedDate ? new Date(member.joinedDate).toLocaleDateString('en-IN') : 'Recent'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // 2. Income Report View
  const renderIncomeReport = () => {
    const data = reportData || {};
    const transactions = data.transactions || [];

    return (
      <div className={styles.reportContent}>
        <div className={styles.summaryStats}>
          <div className={styles.summaryCard}>
            <span className={styles.statLabel}>Total Income Credited</span>
            <strong className={`${styles.statValue} ${styles.greenText}`}>
              ₹{Number(data.total || 0).toLocaleString('en-IN')}
            </strong>
            <small>Commission Payouts</small>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.statLabel}>Total Transactions</span>
            <strong className={styles.statValue}>{data.count || transactions.length}</strong>
            <small>Credited Ledger Rows</small>
          </div>
        </div>

        {data.byType && (
          <div className={styles.breakdownCard}>
            <h3>Income Stream Breakdown</h3>
            <div className={styles.breakdownGrid}>
              {Object.entries(data.byType).map(([type, val]) => (
                <div key={type} className={styles.breakdownItem}>
                  <span>{type.replace(/_/g, ' ')}</span>
                  <strong>₹{Number(val.total || 0).toLocaleString('en-IN')}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>BENEFICIARY</th>
                <th>COMMISSION TYPE</th>
                <th>CREDITED AMOUNT</th>
                <th>DATE</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan="4" className={styles.emptyTableRow}>No income transactions recorded</td></tr>
              ) : (
                transactions.map((tx, idx) => (
                  <tr key={idx}>
                    <td><strong>{tx.userId?.fullName || 'Direct Member'}</strong></td>
                    <td><span className={styles.tagBadge}>{tx.type}</span></td>
                    <td className={styles.greenText}><strong>₹{Number(tx.creditedAmount || 0).toLocaleString('en-IN')}</strong></td>
                    <td>{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('en-IN') : 'Recent'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // 3. Withdrawal Report View
  const renderWithdrawalReport = () => {
    const data = reportData || {};
    const withdrawals = data.withdrawals || [];

    return (
      <div className={styles.reportContent}>
        <div className={styles.summaryStats}>
          <div className={styles.summaryCard}>
            <span className={styles.statLabel}>Total Disbursals</span>
            <strong className={styles.statValue}>
              ₹{Number(data.totalAmount || 0).toLocaleString('en-IN')}
            </strong>
            <small>Gross Payout Claims</small>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.statLabel}>Total TDS Retained (5%)</span>
            <strong className={`${styles.statValue} ${styles.blueText}`}>
              ₹{Number(data.totalTDS || 0).toLocaleString('en-IN')}
            </strong>
            <small>Tax Provision</small>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.statLabel}>Processed Claims</span>
            <strong className={styles.statValue}>{data.count || withdrawals.length}</strong>
            <small>Requests Settled</small>
          </div>
        </div>

        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>TRANSACTION #</th>
                <th>BENEFICIARY</th>
                <th>GROSS</th>
                <th>TDS (5%)</th>
                <th>NET PAYABLE</th>
                <th>STATUS</th>
                <th>DATE</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.length === 0 ? (
                <tr><td colSpan="7" className={styles.emptyTableRow}>No withdrawal records found</td></tr>
              ) : (
                withdrawals.map((w) => (
                  <tr key={w._id || w.id}>
                    <td><code>{w.withdrawalNumber || w.transactionId || 'WTH-REC'}</code></td>
                    <td><strong>{w.userId?.fullName || 'Member'}</strong></td>
                    <td>₹{Number(w.grossAmount || w.amount || 0).toLocaleString('en-IN')}</td>
                    <td className={styles.redText}>-₹{Number(w.tdsAmount || 0).toLocaleString('en-IN')}</td>
                    <td className={styles.greenText}><strong>₹{Number(w.netAmount || 0).toLocaleString('en-IN')}</strong></td>
                    <td>
                      <span className={`${styles.statusBadge} ${styles[w.status?.toLowerCase()] || styles.active}`}>
                        {w.status || 'PAID'}
                      </span>
                    </td>
                    <td>{w.createdAt ? new Date(w.createdAt).toLocaleDateString('en-IN') : 'Recent'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // 4. Sales Report View
  const renderSalesReport = () => {
    const data = reportData || {};
    return (
      <div className={styles.reportContent}>
        <div className={styles.summaryStats}>
          <div className={styles.summaryCard}>
            <span className={styles.statLabel}>Total Store Revenue</span>
            <strong className={`${styles.statValue} ${styles.greenText}`}>
              ₹{Number(data.totalRevenue || 0).toLocaleString('en-IN')}
            </strong>
            <small>Gross Package Sales</small>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.statLabel}>Completed Orders</span>
            <strong className={styles.statValue}>{data.totalOrders || 0}</strong>
            <small>Paid Package Transactions</small>
          </div>
        </div>

        {data.byPackage && (
          <div className={styles.breakdownCard}>
            <h3>Revenue by Package Tier</h3>
            <div className={styles.breakdownGrid}>
              {data.byPackage.map((pkg, idx) => (
                <div key={idx} className={styles.breakdownItem}>
                  <span>{pkg._id}</span>
                  <strong>₹{Number(pkg.total || 0).toLocaleString('en-IN')} ({pkg.count} Orders)</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 5. Financial Reconciliation View
  const renderFinancialReport = () => {
    const data = reportData || {};
    const inc = Number(data.income?.total || 0);
    const wth = Number(data.withdrawals?.total || 0);

    return (
      <div className={styles.reportContent}>
        <div className={styles.summaryStats}>
          <div className={styles.summaryCard}>
            <span className={styles.statLabel}>Total Sales Inflow</span>
            <strong className={`${styles.statValue} ${styles.greenText}`}>₹{inc.toLocaleString('en-IN')}</strong>
            <small>Gross Inflow Volume</small>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.statLabel}>Total Disbursals</span>
            <strong className={`${styles.statValue} ${styles.redText}`}>₹{wth.toLocaleString('en-IN')}</strong>
            <small>Bank Payout Claims</small>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.statLabel}>Net Operating Balance</span>
            <strong className={`${styles.statValue} ${styles.blueText}`}>₹{(inc - wth).toLocaleString('en-IN')}</strong>
            <small>Net Platform Surplus</small>
          </div>
        </div>
      </div>
    );
  };

  // 6. Tax / TDS Report View
  const renderTaxReport = () => {
    const data = reportData || {};
    const list = data.withdrawals || [];

    return (
      <div className={styles.reportContent}>
        <div className={styles.summaryStats}>
          <div className={styles.summaryCard}>
            <span className={styles.statLabel}>Total TDS Deducted</span>
            <strong className={`${styles.statValue} ${styles.blueText}`}>
              ₹{Number(data.totalTDS || 0).toLocaleString('en-IN')}
            </strong>
            <small>5% Statutory Tax</small>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.statLabel}>Admin Platform Fees</span>
            <strong className={`${styles.statValue} ${styles.amberText}`}>
              ₹{Number(data.totalAdminCharge || 0).toLocaleString('en-IN')}
            </strong>
            <small>10% Maintenance Charges</small>
          </div>
        </div>

        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>MEMBER</th>
                <th>PAN NUMBER</th>
                <th>GROSS PAYOUT</th>
                <th>TDS AMOUNT (5%)</th>
                <th>TAX AUDIT STATUS</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan="5" className={styles.emptyTableRow}>No TDS records found for this period</td></tr>
              ) : (
                list.map((w) => (
                  <tr key={w._id || w.id}>
                    <td><strong>{w.userId?.fullName || 'Direct Member'}</strong></td>
                    <td><code>{w.bankDetails?.panNumber || w.userId?.panNumber || 'NOT SUBMITTED'}</code></td>
                    <td>₹{Number(w.grossAmount || w.amount || 0).toLocaleString('en-IN')}</td>
                    <td className={styles.blueText}><strong>₹{Number(w.tdsAmount || 0).toLocaleString('en-IN')}</strong></td>
                    <td>
                      <span className={`${styles.statusBadge} ${styles.active}`}>
                        {w.tdsReconciled ? 'TDS RECONCILED' : 'CHALLAN PENDING'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderReportContent = () => {
    if (loading) {
      return (
        <div className={styles.loadingArea}>
          <div className={styles.spinner}></div>
          <p>Compiling database financial ledger...</p>
        </div>
      );
    }

    switch (reportType) {
      case 'members':
        return renderMemberReport();
      case 'income':
        return renderIncomeReport();
      case 'withdrawals':
        return renderWithdrawalReport();
      case 'sales':
        return renderSalesReport();
      case 'financial':
        return renderFinancialReport();
      case 'tax':
        return renderTaxReport();
      default:
        return renderMemberReport();
    }
  };

  return (
    <div className={styles.reportsPage}>
      {/* 1. Header Toolbar */}
      <div className={styles.header}>
        <div>
          <div className={styles.statusPill}>
            <span className={styles.pulseDot}></span>
            <span>Cluster Production Database</span>
          </div>
          <h1 className={styles.title}>Financial Reports & System Analytics</h1>
          <p className={styles.subtitle}>
            Audit revenue reconciliation, member onboarding metrics, statutory 5% TDS provisions, and platform solvency.
          </p>
        </div>
      </div>

      {/* 2. Controls & Date Presets */}
      <div className={styles.controlsCard}>
        <div className={styles.controlsRow}>
          <div className={styles.controlGroup}>
            <label>Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className={styles.select}
            >
              {REPORT_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.icon} {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.controlGroup}>
            <label>Start Date</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className={styles.dateInput}
            />
          </div>

          <div className={styles.controlGroup}>
            <label>End Date</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className={styles.dateInput}
            />
          </div>

          <div className={styles.buttonGroup}>
            <button
              className={styles.generateBtn}
              onClick={generateReport}
              disabled={loading}
            >
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
            <button className={styles.exportBtn} onClick={exportCSV}>
              📥 Export CSV
            </button>
          </div>
        </div>

        {/* Quick Date Presets */}
        <div className={styles.presetsRow}>
          <span>Quick Filters:</span>
          <button type="button" onClick={() => handleApplyPreset(7)}>Last 7 Days</button>
          <button type="button" onClick={() => handleApplyPreset(30)}>Last 30 Days</button>
          <button type="button" onClick={() => handleApplyPreset(90)}>Last Quarter</button>
          <button type="button" onClick={() => handleApplyPreset(365)}>This Year</button>
        </div>
      </div>

      {/* 3. Rendered Content Body */}
      <div className={styles.reportContainer}>
        {renderReportContent()}
      </div>
    </div>
  );
};

export default AdminReportsPage;