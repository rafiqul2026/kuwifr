import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminFundsPage.module.css';

const AdminFundsPage = () => {
  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchFunds();
  }, []);

  const fetchFunds = async () => {
    try {
      setLoading(true);
      const [fundsRes, statsRes] = await Promise.all([
        api.get('/api/funds/all'),
        api.get('/api/reports/admin/funds')
      ]);
      
      if (fundsRes.data.success) {
        setFunds(fundsRes.data.data.funds || []);
      }
      if (statsRes.data.success) {
        setStats(statsRes.data.data);
      }
    } catch (error) {
      showNotification('Failed to fetch funds data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInitialize = async () => {
    try {
      await api.post('/api/admin/funds/initialize');
      showNotification('Funds initialized successfully', 'success');
      fetchFunds();
    } catch (error) {
      showNotification('Failed to initialize funds', 'error');
    }
  };

  const handleToggleActive = async (fundId, isActive) => {
    try {
      await api.put(`/api/admin/funds/${fundId}`, { isActive: !isActive });
      showNotification('Fund status updated', 'success');
      fetchFunds();
    } catch (error) {
      showNotification('Failed to update fund', 'error');
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading funds...</p>
      </div>
    );
  }

  return (
    <div className={styles.fundsPage}>
      <div className={styles.header}>
        <h1>Fund Management</h1>
        <button 
          className={styles.initBtn}
          onClick={handleInitialize}
        >
          Initialize Funds
        </button>
      </div>

      {stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total Funds</span>
            <span className={styles.statValue}>{stats.totalFunds || 0}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Active Funds</span>
            <span className={styles.statValue}>{stats.activeFunds || 0}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total Qualifications</span>
            <span className={styles.statValue}>{stats.totalQualifications || 0}</span>
          </div>
        </div>
      )}

      <div className={styles.fundsGrid}>
        {funds.map((fund) => (
          <div key={fund._id} className={styles.fundCard}>
            <div className={styles.fundHeader}>
              <span className={styles.fundIcon}>{fund.icon || '🏦'}</span>
              <div className={styles.fundInfo}>
                <h3 className={styles.fundName}>{fund.name}</h3>
                <span className={styles.fundCode}>{fund.code}</span>
              </div>
              <div className={styles.fundStatus}>
                <span className={`${styles.statusBadge} ${fund.isActive ? styles.active : styles.inactive}`}>
                  {fund.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <div className={styles.fundBody}>
              <div className={styles.fundRequirements}>
                <div className={styles.requirementItem}>
                  <span>Left Required</span>
                  <span>{fund.leftKBPRequired?.toLocaleString()}</span>
                </div>
                <div className={styles.requirementItem}>
                  <span>Right Required</span>
                  <span>{fund.rightKBPRequired?.toLocaleString()}</span>
                </div>
                <div className={styles.requirementItem}>
                  <span>Maintenance L/R</span>
                  <span>{fund.maintenanceLeftKBP?.toLocaleString()} / {fund.maintenanceRightKBP?.toLocaleString()}</span>
                </div>
                <div className={styles.requirementItem}>
                  <span>Benefit</span>
                  <span>{fund.benefitPercentage * 100}% on TTO</span>
                </div>
              </div>
              <div className={styles.fundActions}>
                <button 
                  className={styles.toggleBtn}
                  onClick={() => handleToggleActive(fund._id, fund.isActive)}
                >
                  {fund.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminFundsPage;