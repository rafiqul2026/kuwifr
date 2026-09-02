import React, { useState } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminReportsPage.module.css';

const AdminReportsPage = () => {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState('members');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [reportData, setReportData] = useState(null);
  const { showNotification } = useNotification();

  const reportTypes = [
    { id: 'members', label: 'Member Report' },
    { id: 'income', label: 'Income Report' },
    { id: 'withdrawals', label: 'Withdrawal Report' },
    { id: 'sales', label: 'Sales Report' },
    { id: 'financial', label: 'Financial Report' },
    { id: 'tax', label: 'Tax Report' }
  ];

  const generateReport = async () => {
    try {
      setLoading(true);
      let endpoint = '';
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });

      switch (reportType) {
        case 'members':
          endpoint = `/api/reports/admin/members?${params}`;
          break;
        case 'income':
          endpoint = `/api/reports/admin/income?${params}`;
          break;
        case 'withdrawals':
          endpoint = `/api/reports/admin/withdrawals?${params}`;
          break;
        case 'sales':
          endpoint = `/api/reports/admin/sales?${params}`;
          break;
        case 'financial':
          endpoint = `/api/reports/admin/financial?${params}`;
          break;
        case 'tax':
          endpoint = `/api/reports/admin/tax?${params}`;
          break;
        default:
          endpoint = `/api/reports/admin/members?${params}`;
      }

      const response = await api.get(endpoint);
      if (response.data.success) {
        setReportData(response.data.data);
        showNotification('Report generated successfully', 'success');
      }
    } catch (error) {
      showNotification('Failed to generate report', 'error');
    } finally {
      setLoading(false);
    }
  };

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
      
      showNotification('Report exported successfully', 'success');
    } catch (error) {
      showNotification('Failed to export report', 'error');
    }
  };

  const renderReportContent = () => {
    if (!reportData) {
      return (
        <div className={styles.emptyState}>
          <span>📊</span>
          <p>Select report type and date range, then click Generate</p>
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
        return null;
    }
  };

  const renderMemberReport = () => {
    const data = reportData.members || reportData;
    return (
      <div className={styles.reportContent}>
        <div className={styles.summaryStats}>
          <div className={styles.summaryCard}>
            <span>Total Members</span>
            <strong>{data.total || 0}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>Active</span>
            <strong>{data.active || 0}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>New (Period)</span>
            <strong>{data.new || 0}</strong>
          </div>
        </div>
        {data.members && (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((member) => (
                  <tr key={member._id}>
                    <td>{member.fullName}</td>
                    <td>{member.email}</td>
                    <td>{member.phoneNumber}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${styles[member.status?.toLowerCase()]}`}>
                        {member.status}
                      </span>
                    </td>
                    <td>{new Date(member.joinedDate).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderIncomeReport = () => {
    const data = reportData;
    return (
      <div className={styles.reportContent}>
        <div className={styles.summaryStats}>
          <div className={styles.summaryCard}>
            <span>Total Income</span>
            <strong>₹{data.total?.toLocaleString() || 0}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>Transactions</span>
            <strong>{data.count || 0}</strong>
          </div>
        </div>
        {data.byType && (
          <div className={styles.breakdown}>
            <h3>Income by Type</h3>
            {Object.entries(data.byType).map(([type, value]) => (
              <div key={type} className={styles.breakdownItem}>
                <span>{type.replace(/_/g, ' ')}</span>
                <span>₹{value.total?.toLocaleString() || 0}</span>
              </div>
            ))}
          </div>
        )}
        {data.transactions && (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((tx, index) => (
                  <tr key={index}>
                    <td>{tx.userId?.fullName || 'N/A'}</td>
                    <td>{tx.type}</td>
                    <td>₹{tx.creditedAmount?.toLocaleString()}</td>
                    <td>{new Date(tx.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderWithdrawalReport = () => {
    const data = reportData;
    return (
      <div className={styles.reportContent}>
        <div className={styles.summaryStats}>
          <div className={styles.summaryCard}>
            <span>Total Withdrawals</span>
            <strong>₹{data.totalAmount?.toLocaleString() || 0}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>Total TDS</span>
            <strong>₹{data.totalTDS?.toLocaleString() || 0}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>Count</span>
            <strong>{data.count || 0}</strong>
          </div>
        </div>
        {data.withdrawals && (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Member</th>
                  <th>Gross</th>
                  <th>TDS</th>
                  <th>Net</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.withdrawals.map((w) => (
                  <tr key={w._id}>
                    <td>{w.withdrawalNumber}</td>
                    <td>{w.userId?.fullName || 'N/A'}</td>
                    <td>₹{w.grossAmount?.toLocaleString()}</td>
                    <td>₹{w.tdsAmount?.toLocaleString()}</td>
                    <td>₹{w.netAmount?.toLocaleString()}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${styles[w.status?.toLowerCase()]}`}>
                        {w.status}
                      </span>
                    </td>
                    <td>{new Date(w.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderSalesReport = () => {
    const data = reportData;
    return (
      <div className={styles.reportContent}>
        <div className={styles.summaryStats}>
          <div className={styles.summaryCard}>
            <span>Total Revenue</span>
            <strong>₹{data.totalRevenue?.toLocaleString() || 0}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>Total Orders</span>
            <strong>{data.totalOrders || 0}</strong>
          </div>
        </div>
        {data.byPackage && (
          <div className={styles.breakdown}>
            <h3>Sales by Package</h3>
            {data.byPackage.map((pkg) => (
              <div key={pkg._id} className={styles.breakdownItem}>
                <span>{pkg._id}</span>
                <span>{pkg.count} orders - ₹{pkg.total?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
        {data.dailyTrend && (
          <div className={styles.breakdown}>
            <h3>Daily Trend</h3>
            {data.dailyTrend.map((day) => (
              <div key={day._id} className={styles.breakdownItem}>
                <span>{day._id}</span>
                <span>{day.count} orders - ₹{day.total?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderFinancialReport = () => {
    const data = reportData;
    return (
      <div className={styles.reportContent}>
        <div className={styles.summaryStats}>
          <div className={styles.summaryCard}>
            <span>Total Income</span>
            <strong>₹{data.income?.total?.toLocaleString() || 0}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>Total Withdrawals</span>
            <strong>₹{data.withdrawals?.total?.toLocaleString() || 0}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>Net Balance</span>
            <strong>₹{((data.income?.total || 0) - (data.withdrawals?.total || 0)).toLocaleString()}</strong>
          </div>
        </div>
        {data.income?.byType && (
          <div className={styles.breakdown}>
            <h3>Income Breakdown</h3>
            {data.income.byType.map((item) => (
              <div key={item._id} className={styles.breakdownItem}>
                <span>{item._id}</span>
                <span>₹{item.total?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderTaxReport = () => {
    const data = reportData;
    return (
      <div className={styles.reportContent}>
        <div className={styles.summaryStats}>
          <div className={styles.summaryCard}>
            <span>Total TDS Collected</span>
            <strong>₹{data.totalTDS?.toLocaleString() || 0}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>Total Admin Charges</span>
            <strong>₹{data.totalAdminCharge?.toLocaleString() || 0}</strong>
          </div>
        </div>
        {data.withdrawals && (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>PAN</th>
                  <th>Gross</th>
                  <th>TDS</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.withdrawals.map((w) => (
                  <tr key={w._id}>
                    <td>{w.userId?.fullName || 'N/A'}</td>
                    <td>{w.bankDetails?.panNumber || 'N/A'}</td>
                    <td>₹{w.grossAmount?.toLocaleString()}</td>
                    <td>₹{w.tdsAmount?.toLocaleString()}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${styles[w.tdsReconciliation?.status?.toLowerCase() || 'pending']}`}>
                        {w.tdsReconciliation?.status || 'PENDING'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.reportsPage}>
      <div className={styles.header}>
        <h1>Reports</h1>
      </div>

      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <label>Report Type</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className={styles.select}
          >
            {reportTypes.map((type) => (
              <option key={type.id} value={type.id}>{type.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.controlGroup}>
          <label>Start Date</label>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
            className={styles.dateInput}
          />
        </div>

        <div className={styles.controlGroup}>
          <label>End Date</label>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
            className={styles.dateInput}
          />
        </div>

        <button 
          className={styles.generateBtn}
          onClick={generateReport}
          disabled={loading}
        >
          {loading ? 'Generating...' : 'Generate Report'}
        </button>

        {reportData && (
          <button 
            className={styles.exportBtn}
            onClick={exportCSV}
          >
            📥 Export CSV
          </button>
        )}
      </div>

      <div className={styles.reportContainer}>
        {renderReportContent()}
      </div>
    </div>
  );
};

export default AdminReportsPage;