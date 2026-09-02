import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './FundsPage.module.css';

const FundsPage = () => {
  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [allFundsAchieved, setAllFundsAchieved] = useState(false);
  const [pensionActive, setPensionActive] = useState(false);
  const [showPensionInfo, setShowPensionInfo] = useState(false);
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchFundStatus();
  }, []);

  const fetchFundStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/funds/status');
      if (response.data.success) {
        const data = response.data.data;
        setFunds(data.funds || []);
        setAllFundsAchieved(data.allFundsAchieved || false);
        setPensionActive(data.pensionActive || false);
      }
    } catch (error) {
      showNotification('Failed to fetch fund status', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessQualification = async () => {
    try {
      setProcessing(true);
      const response = await api.post('/api/funds/process-qualification');
      if (response.data.success) {
        showNotification('Fund qualification processed successfully!', 'success');
        fetchFundStatus();
      }
    } catch (error) {
      showNotification('Failed to process qualification', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const getProgressColor = (progress) => {
    if (progress >= 100) return '#22c55e';
    if (progress >= 50) return '#f59e0b';
    return '#2563eb';
  };

  const getFundIcon = (code) => {
    const icons = {
      'SCHOOL': '🏫',
      'FAMILY': '👨‍👩‍👦',
      'TRAVELLING': '✈️',
      'LIFESTYLE': '🌟',
      'FOREIGN_TRIP': '🌍',
      'PENSION': '🏦'
    };
    return icons[code] || '🏦';
  };

  const getFundColor = (code) => {
    const colors = {
      'SCHOOL': '#f59e0b',
      'FAMILY': '#3b82f6',
      'TRAVELLING': '#8b5cf6',
      'LIFESTYLE': '#ec4899',
      'FOREIGN_TRIP': '#14b8a6',
      'PENSION': '#ef4444'
    };
    return colors[code] || '#64748b';
  };

  const getFundDescription = (fund) => {
    if (!fund) return '';
    return `${fund.requiredLeftKBP?.toLocaleString()}L + ${fund.requiredRightKBP?.toLocaleString()}R KBP Matching`;
  };

  const getMaintenanceText = (fund) => {
    if (!fund) return '';
    if (fund.code === 'PENSION') return 'No maintenance required';
    return `Maintain: ${fund.maintenanceLeftKBP?.toLocaleString()}L : ${fund.maintenanceRightKBP?.toLocaleString()}R monthly`;
  };

  const getBenefitText = (fund) => {
    if (!fund) return '';
    if (fund.code === 'PENSION') return '1% lifetime on TTO';
    return `${fund.benefitPercentage * 100}% on TTO Monthly`;
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
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Life Tension Free Income/Fund</h1>
          <p className={styles.pageSubtitle}>
            Complete repurchase target from your team to unlock lifetime benefits
          </p>
        </div>
        <div className={styles.headerStats}>
          <div className={styles.headerStat}>
            <span className={styles.headerStatLabel}>Funds Qualified</span>
            <span className={styles.headerStatValue}>
              {funds.filter(f => f.qualified).length}/{funds.length}
            </span>
          </div>
          <div className={styles.headerStat}>
            <span className={styles.headerStatLabel}>Pension Status</span>
            <span className={`${styles.headerStatValue} ${pensionActive ? styles.active : styles.inactive}`}>
              {pensionActive ? '✅ Active' : '🔒 Locked'}
            </span>
          </div>
        </div>
      </div>

      {/* Process Button */}
      <button 
        className={styles.processBtn}
        onClick={handleProcessQualification}
        disabled={processing}
      >
        {processing ? (
          <span className={styles.btnLoading}>
            <span className={styles.btnSpinner}></span>
            Processing...
          </span>
        ) : (
          '🔄 Check Fund Qualification'
        )}
      </button>

      {/* All Funds Achieved Banner */}
      {allFundsAchieved && (
        <div className={styles.achievementBanner}>
          <div className={styles.bannerIcon}>🏆</div>
          <div className={styles.bannerContent}>
            <h3>All Funds Achieved!</h3>
            <p>Congratulations! You have qualified for all funds. You are now eligible for the Pension Fund!</p>
          </div>
        </div>
      )}

      {/* Pension Fund Section */}
      {pensionActive && (
        <div className={styles.pensionCard}>
          <div className={styles.pensionIcon}>🏦</div>
          <div className={styles.pensionContent}>
            <h3>Pension Fund Active</h3>
            <p>You are receiving <strong>1% lifetime</strong> on TTO. No maintenance required!</p>
          </div>
          <div className={styles.pensionStatus}>
            <span className={styles.activeBadge}>✅ Active</span>
          </div>
        </div>
      )}

      {/* Funds Grid - All Funds Displayed */}
      <div className={styles.fundsGrid}>
        {funds.map((fund, index) => {
          const isQualified = fund.qualified;
          const leftProgress = Math.min(100, (fund.current?.leftKBP || 0) / (fund.fund?.requiredLeftKBP || 1) * 100);
          const rightProgress = Math.min(100, (fund.current?.rightKBP || 0) / (fund.fund?.requiredRightKBP || 1) * 100);
          const overallProgress = Math.min(100, Math.round((leftProgress + rightProgress) / 2));
          const isPension = fund.fund?.code === 'PENSION';
          const color = getFundColor(fund.fund?.code);
          const icon = getFundIcon(fund.fund?.code);

          // Only show progress for non-pension funds
          const showProgress = !isPension;

          return (
            <div 
              key={fund.fund?._id || index} 
              className={`${styles.fundCard} ${isQualified ? styles.qualified : ''} ${isPension ? styles.pensionFund : ''}`}
              style={{ 
                borderLeftColor: isQualified ? color : '#e2e8f0',
                animationDelay: `${index * 0.08}s`
              }}
            >
              {/* Fund Header */}
              <div className={styles.fundHeader}>
                <div className={styles.fundIconWrapper} style={{ background: color }}>
                  <span className={styles.fundIcon}>{icon}</span>
                </div>
                <div className={styles.fundInfo}>
                  <h3 className={styles.fundName}>{fund.fund?.name}</h3>
                  <span className={styles.fundCode}>{fund.fund?.code}</span>
                </div>
                <span className={`${styles.fundStatus} ${isQualified ? styles.qualifiedStatus : styles.lockedStatus}`}>
                  {isQualified ? '✅ Qualified' : '🔒 Locked'}
                </span>
              </div>

              {/* Fund Body */}
              <div className={styles.fundBody}>
                {/* Fund Description */}
                <div className={styles.fundDescription}>
                  <span>{getFundDescription(fund.fund)}</span>
                </div>

                {/* Requirements - Progress Bars */}
                <div className={styles.fundRequirements}>
                  <div className={styles.requirementItem}>
                    <span className={styles.requirementLabel}>Left Volume</span>
                    <div className={styles.requirementProgress}>
                      <span className={styles.requirementValue}>
                        {fund.current?.leftKBP?.toLocaleString() || 0} / {fund.fund?.requiredLeftKBP?.toLocaleString() || 0}
                      </span>
                      <div className={styles.progressBarSmall}>
                        <div 
                          className={styles.progressFillSmall}
                          style={{ 
                            width: `${leftProgress}%`,
                            background: leftProgress >= 100 ? '#22c55e' : '#2563eb'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className={styles.requirementItem}>
                    <span className={styles.requirementLabel}>Right Volume</span>
                    <div className={styles.requirementProgress}>
                      <span className={styles.requirementValue}>
                        {fund.current?.rightKBP?.toLocaleString() || 0} / {fund.fund?.requiredRightKBP?.toLocaleString() || 0}
                      </span>
                      <div className={styles.progressBarSmall}>
                        <div 
                          className={styles.progressFillSmall}
                          style={{ 
                            width: `${rightProgress}%`,
                            background: rightProgress >= 100 ? '#22c55e' : '#ef4444'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Overall Progress */}
                {showProgress && (
                  <div className={styles.fundProgress}>
                    <div className={styles.progressBar}>
                      <div 
                        className={styles.progressFill}
                        style={{ 
                          width: `${overallProgress}%`,
                          background: getProgressColor(overallProgress)
                        }}
                      />
                    </div>
                    <span className={styles.progressLabel}>{overallProgress}% Complete</span>
                  </div>
                )}

                {/* Fund Benefits & Maintenance */}
                <div className={styles.fundDetails}>
                  <div className={styles.fundBenefit}>
                    <span className={styles.benefitIcon}>💰</span>
                    <span className={styles.benefitText}>{getBenefitText(fund.fund)}</span>
                  </div>
                  <div className={styles.fundMaintenance}>
                    <span className={styles.maintenanceIcon}>🔧</span>
                    <span className={styles.maintenanceText}>{getMaintenanceText(fund.fund)}</span>
                  </div>
                </div>

                {/* Qualified Details */}
                {isQualified && fund.qualification && (
                  <div className={styles.fundQualifiedInfo}>
                    <div className={styles.qualifiedBadge}>
                      <span>🎉 Qualified</span>
                    </div>
                    <div className={styles.qualifiedDetails}>
                      <span>
                        <strong>Date:</strong> {new Date(fund.qualification.qualifiedAt).toLocaleDateString()}
                      </span>
                      <span>
                        <strong>Matched:</strong> {fund.qualification.matchedLeftKBP?.toLocaleString()}L / {fund.qualification.matchedRightKBP?.toLocaleString()}R
                      </span>
                    </div>
                  </div>
                )}

                {/* Locked Info */}
                {!isQualified && !isPension && (
                  <div className={styles.fundLockedInfo}>
                    <span>🔒 Complete the requirements to unlock this fund</span>
                  </div>
                )}

                {/* Pension Special Info */}
                {isPension && !isQualified && (
                  <div className={styles.pensionInfo}>
                    <span>🏆 Requires all previous funds to be achieved</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FundsPage;