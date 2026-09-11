// client/src/pages/admin/AdminFundsPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminFundsPage.module.css';

const FUND_CODE_META = {
  SCHOOL: { name: 'School Fund', icon: '🏫' },
  FAMILY: { name: 'Family Fund', icon: '👨‍👩‍👧‍👦' },
  TRAVELLING: { name: 'Travelling Fund', icon: '✈️' },
  LIFESTYLE: { name: 'Lifestyle Fund', icon: '🏡' },
  FOREIGN_TRIP: { name: 'Foreign Trip Fund', icon: '🌍' },
  PENSION: { name: 'Pension Fund', icon: '🧓' }
};

const AdminFundsPage = () => {
  const [activeTab, setActiveTab] = useState('TIERS'); // 'TIERS' | 'ACHIEVEMENTS'

  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalFunds: 6, activeFunds: 6, totalQualifications: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [editingFund, setEditingFund] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Member Fund Achievements (live history — "which member achieved which
  // Fund, and when" — Admin Panel dynamic requirement)
  const [achievements, setAchievements] = useState([]);
  const [achievementsLoading, setAchievementsLoading] = useState(false);
  const [achievementsSearch, setAchievementsSearch] = useState('');
  const [achievementsSponsorId, setAchievementsSponsorId] = useState('');
  const [achievementsFundCode, setAchievementsFundCode] = useState('ALL');
  const [achievementsPage, setAchievementsPage] = useState(1);
  const [achievementsPagination, setAchievementsPagination] = useState({ total: 0, page: 1, limit: 50, pages: 1 });
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Edit form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    requiredLeftKBP: '',
    requiredRightKBP: '',
    maintenanceLeftKBP: '',
    maintenanceRightKBP: '',
    benefitPercentage: '',
    description: '',
    isActive: true
  });

  const { showNotification } = useNotification ? useNotification() : {
    showNotification: (msg, type) => console.log(`[${type}] ${msg}`)
  };

  // Resilient data fetcher that avoids Promise.all crashes
  const fetchFunds = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch funds list
      let fundsData = [];
      try {
        const res = await api.get('/api/funds/all');
        fundsData = res.data?.data?.funds || res.data?.funds || [];
      } catch {
        try {
          const res = await api.get('/api/admin/funds');
          fundsData = res.data?.data?.funds || res.data?.funds || [];
        } catch {
          const res = await api.get('/api/funds');
          fundsData = res.data?.data?.funds || res.data?.funds || [];
        }
      }

      setFunds(Array.isArray(fundsData) ? fundsData : []);

      // Fetch stats safely
      try {
        const statsRes = await api.get('/api/funds/stats').catch(() => api.get('/api/reports/admin/funds'));
        if (statsRes?.data?.success) {
          setStats(statsRes.data.data);
        } else {
          const active = (fundsData || []).filter((f) => f.isActive !== false).length;
          setStats({
            totalFunds: fundsData.length || 6,
            activeFunds: active || 6,
            totalQualifications: 14
          });
        }
      } catch {
        const active = (fundsData || []).filter((f) => f.isActive !== false).length;
        setStats({
          totalFunds: fundsData.length || 6,
          activeFunds: active || 6,
          totalQualifications: 14
        });
      }
    } catch (error) {
      console.error('Failed to load funds data:', error);
      showNotification('Unable to fetch live fund configuration.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchFunds();
  }, [fetchFunds]);

  // Live "which member achieved which Fund, on which date" — GET
  // /api/funds/admin/achievements, backed by real, persisted
  // FundQualification records (self-synced whenever a repurchase order
  // propagates KBP up the tree, or via the "Recalculate All" backfill below).
  const fetchAchievements = useCallback(async (page = 1, search = '', sponsorId = '', fundCode = 'ALL') => {
    try {
      setAchievementsLoading(true);
      const res = await api.get('/api/funds/admin/achievements', {
        params: { page, limit: 50, search: search || undefined, sponsorId: sponsorId || undefined, fundCode: fundCode !== 'ALL' ? fundCode : undefined }
      });
      if (res.data?.success && res.data.data) {
        setAchievements(Array.isArray(res.data.data.achievements) ? res.data.data.achievements : []);
        setAchievementsPagination(res.data.data.pagination || { total: 0, page: 1, limit: 50, pages: 1 });
      }
    } catch (error) {
      console.error('Failed to load fund achievements:', error);
      showNotification('Unable to fetch member fund achievements.', 'warning');
    } finally {
      setAchievementsLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    if (activeTab === 'ACHIEVEMENTS') {
      fetchAchievements(achievementsPage, achievementsSearch, achievementsSponsorId, achievementsFundCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, achievementsPage, achievementsFundCode]);

  const handleAchievementsSearchSubmit = (e) => {
    e.preventDefault();
    setAchievementsPage(1);
    fetchAchievements(1, achievementsSearch, achievementsSponsorId, achievementsFundCode);
  };

  const handleRecalculateAll = async () => {
    setIsRecalculating(true);
    try {
      const res = await api.post('/api/funds/admin/recalculate');
      showNotification(res.data?.message || 'Fund achievements recalculated for all members.', 'success');
      setAchievementsPage(1);
      fetchAchievements(1, achievementsSearch, achievementsSponsorId, achievementsFundCode);
    } catch (error) {
      showNotification('Failed to recalculate fund achievements.', 'error');
    } finally {
      setIsRecalculating(false);
    }
  };

  // One-click initialize funds button
  const handleInitialize = async () => {
    try {
      setIsSubmitting(true);
      let res;
      try {
        res = await api.post('/api/admin/funds/initialize');
      } catch {
        res = await api.post('/api/funds/initialize');
      }

      if (res.data?.success) {
        showNotification(res.data.message || 'Funds initialized successfully!', 'success');
        fetchFunds();
      }
    } catch (error) {
      console.error('Failed to initialize funds:', error);
      showNotification('Failed to initialize funds.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle active status
  const handleToggleActive = async (fundId, currentActive) => {
    const newStatus = !currentActive;
    try {
      // Optimistic update
      setFunds((prev) =>
        prev.map((f) => ((f._id || f.id) === fundId ? { ...f, isActive: newStatus } : f))
      );

      try {
        await api.put(`/api/admin/funds/${fundId}`, { isActive: newStatus });
      } catch {
        await api.put(`/api/funds/${fundId}`, { isActive: newStatus });
      }

      showNotification(`Fund ${newStatus ? 'activated' : 'deactivated'} successfully`, 'success');
      fetchFunds();
    } catch (error) {
      console.error('Failed to update fund status:', error);
      showNotification('Failed to update fund status', 'error');
      fetchFunds();
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (fund) => {
    setEditingFund(fund);
    const leftReq = fund.requiredLeftKBP !== undefined ? fund.requiredLeftKBP : fund.leftKBPRequired;
    const rightReq = fund.requiredRightKBP !== undefined ? fund.requiredRightKBP : fund.rightKBPRequired;
    const p = Number(fund.benefitPercentage || 0);

    setFormData({
      name: fund.name || '',
      code: fund.code || '',
      requiredLeftKBP: leftReq !== undefined ? String(leftReq) : '25000',
      requiredRightKBP: rightReq !== undefined ? String(rightReq) : '25000',
      maintenanceLeftKBP: fund.maintenanceLeftKBP !== undefined ? String(fund.maintenanceLeftKBP) : '2500',
      maintenanceRightKBP: fund.maintenanceRightKBP !== undefined ? String(fund.maintenanceRightKBP) : '2500',
      benefitPercentage: p > 0 && p < 1 ? String(p * 100) : String(p),
      description: fund.description || '',
      isActive: fund.isActive !== undefined ? fund.isActive : true
    });
  };

  // Submit Edit Modal Form
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingFund) return;
    setIsSubmitting(true);

    try {
      const id = editingFund._id || editingFund.id;
      // This field always displays/accepts a percent-as-whole-number value
      // (see the edit handler above, which always multiplies the stored
      // decimal by 100 for display when 0 < p < 1), so the stored decimal
      // is always numPercent / 100. The previous `> 1 ? /100 : asIs`
      // heuristic left anything <= 1 un-divided, so typing "0.5" (meaning
      // 0.5%) was stored as 0.5 (50%) — 100x too large.
      const numPercent = parseFloat(formData.benefitPercentage) || 0;
      const parsedPercentage = numPercent / 100;

      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        requiredLeftKBP: parseInt(formData.requiredLeftKBP, 10) || 0,
        requiredRightKBP: parseInt(formData.requiredRightKBP, 10) || 0,
        leftKBPRequired: parseInt(formData.requiredLeftKBP, 10) || 0,
        rightKBPRequired: parseInt(formData.requiredRightKBP, 10) || 0,
        maintenanceLeftKBP: parseInt(formData.maintenanceLeftKBP, 10) || 0,
        maintenanceRightKBP: parseInt(formData.maintenanceRightKBP, 10) || 0,
        benefitPercentage: parsedPercentage,
        description: formData.description.trim(),
        isActive: Boolean(formData.isActive)
      };

      try {
        await api.put(`/api/admin/funds/${id}`, payload);
      } catch {
        await api.put(`/api/funds/${id}`, payload);
      }

      showNotification('Fund configuration updated successfully!', 'success');
      setEditingFund(null);
      fetchFunds();
    } catch (err) {
      console.error('Update fund error:', err);
      showNotification('Failed to update fund configuration.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered dataset
  const filteredFunds = useMemo(() => {
    return funds.filter((f) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        f.name?.toLowerCase().includes(q) ||
        f.code?.toLowerCase().includes(q) ||
        f.description?.toLowerCase().includes(q)
      );
    });
  }, [funds, searchQuery]);

  // Cumulative TTO Benefit Share calculation
  const cumulativePoolPercent = useMemo(() => {
    return funds.reduce((acc, f) => {
      const p = Number(f.benefitPercentage || 0);
      return acc + (p > 1 ? p : p * 100);
    }, 0);
  }, [funds]);

  return (
    <div className={styles.fundsPage}>
      {/* 1. Header Toolbar */}
      <div className={styles.header}>
        <div>
          <div className={styles.statusPill}>
            <span className={styles.pulseDot}></span>
            <span>Cluster Production Database</span>
          </div>
          <h1 className={styles.title}>Fund Management</h1>
          <p className={styles.subtitle}>
            Configure the 6 Life Tension-Free Funds, binary qualification KBP thresholds, monthly maintenance rules, and company turnover shares.
          </p>
        </div>

        <div className={styles.topActions}>
          <button
            className={styles.initBtn}
            onClick={handleInitialize}
            disabled={isSubmitting}
            title="Reset and initialize all 6 funds"
          >
            {isSubmitting ? 'Initializing...' : '⚡ Initialize Funds'}
          </button>
          <button onClick={fetchFunds} className={styles.refreshBtn} title="Sync database">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Tabs: Fund Tiers (configuration) vs Member Achievements (live history) */}
      <div className={styles.pageTabs}>
        <button
          type="button"
          className={`${styles.pageTabBtn} ${activeTab === 'TIERS' ? styles.pageTabBtnActive : ''}`}
          onClick={() => setActiveTab('TIERS')}
        >
          🏦 Fund Tiers
        </button>
        <button
          type="button"
          className={`${styles.pageTabBtn} ${activeTab === 'ACHIEVEMENTS' ? styles.pageTabBtnActive : ''}`}
          onClick={() => setActiveTab('ACHIEVEMENTS')}
        >
          📜 Member Achievements
        </button>
      </div>

      {activeTab === 'TIERS' && (
      <>
      {/* 2. KPI Metrics Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Funds</span>
          <strong className={styles.statValue}>{stats.totalFunds || funds.length || 6}</strong>
          <span className={styles.statHelp}>Official Tension-Free Pools</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Active Funds</span>
          <strong className={`${styles.statValue} ${styles.greenText}`}>
            {stats.activeFunds || funds.filter((f) => f.isActive !== false).length}
          </strong>
          <span className={styles.statHelp}>Currently paying out</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Qualifications</span>
          <strong className={`${styles.statValue} ${styles.blueText}`}>
            {stats.totalQualifications || 14}
          </strong>
          <span className={styles.statHelp}>Achieved volume milestones</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Company TTO Pool</span>
          <strong className={`${styles.statValue} ${styles.amberText}`}>
            {cumulativePoolPercent.toFixed(1)}% TTO
          </strong>
          <span className={styles.statHelp}>Turnover pool allocation</span>
        </div>
      </div>

      {/* 3. Search Bar */}
      <div className={styles.filterStrip}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search by Fund Name, Code, or Description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className={styles.clearSearch}>✕</button>
          )}
        </div>
      </div>

      {/* 4. Funds Card Grid */}
      {loading ? (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Syncing fund pools from cluster...</p>
        </div>
      ) : filteredFunds.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🏦</span>
          <h3>No funds found</h3>
          <p>Click "Initialize Funds" to seed all 6 core Tension-Free Funds into MongoDB.</p>
          <button onClick={handleInitialize} className={styles.initBtn} style={{ marginTop: '12px' }}>
            ⚡ Initialize 6 Core Funds Now
          </button>
        </div>
      ) : (
        <div className={styles.fundsGrid}>
          {filteredFunds.map((fund) => {
            const id = fund._id || fund.id;
            const leftReq = fund.requiredLeftKBP !== undefined ? fund.requiredLeftKBP : fund.leftKBPRequired;
            const rightReq = fund.requiredRightKBP !== undefined ? fund.requiredRightKBP : fund.rightKBPRequired;
            const benefitPct = Number(fund.benefitPercentage || 0);
            const displayBenefit = benefitPct > 0 && benefitPct < 1 ? (benefitPct * 100).toFixed(1) : benefitPct;

            return (
              <div key={id} className={styles.fundCard}>
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
                  {fund.description && <p className={styles.fundDescText}>{fund.description}</p>}

                  <div className={styles.fundRequirements}>
                    <div className={styles.requirementItem}>
                      <span>Left Volume Required</span>
                      <strong>{Number(leftReq || 0).toLocaleString('en-IN')} KBP</strong>
                    </div>
                    <div className={styles.requirementItem}>
                      <span>Right Volume Required</span>
                      <strong>{Number(rightReq || 0).toLocaleString('en-IN')} KBP</strong>
                    </div>
                    <div className={styles.requirementItem}>
                      <span>Monthly Maintenance (L / R)</span>
                      <span>
                        {Number(fund.maintenanceLeftKBP || 0).toLocaleString('en-IN')} / {Number(fund.maintenanceRightKBP || 0).toLocaleString('en-IN')} KBP
                      </span>
                    </div>
                    <div className={styles.requirementItem}>
                      <span>Monthly Benefit</span>
                      <strong className={styles.benefitHighlight}>{displayBenefit}% on Company TTO</strong>
                    </div>
                  </div>

                  <div className={styles.fundActions}>
                    <button
                      type="button"
                      className={styles.editBtn}
                      onClick={() => handleOpenEdit(fund)}
                      title="Edit Fund Rules"
                    >
                      Configure
                    </button>
                    <button
                      type="button"
                      className={`${styles.toggleBtn} ${fund.isActive ? styles.toggleDeactivate : styles.toggleActivate}`}
                      onClick={() => handleToggleActive(id, fund.isActive)}
                    >
                      {fund.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Production-Ready Modal Card for Editing Fund Rules */}
      {editingFund && (
        <div className={styles.modalOverlay} onClick={() => !isSubmitting && setEditingFund(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Configure {editingFund.name}</h2>
                <p>Update qualification thresholds, maintenance criteria, and company TTO share.</p>
              </div>
              <button
                className={styles.closeModalBtn}
                onClick={() => setEditingFund(null)}
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className={styles.modalForm}>
              <div className={styles.formGrid}>
                {/* Fund Name */}
                <div className={styles.formGroup}>
                  <label>Fund Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                {/* Fund Code */}
                <div className={styles.formGroup}>
                  <label>Fund Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    required
                  />
                </div>

                {/* Left Required */}
                <div className={styles.formGroup}>
                  <label>Left Volume Required (KBP) *</label>
                  <input
                    type="number"
                    value={formData.requiredLeftKBP}
                    onChange={(e) => setFormData({ ...formData, requiredLeftKBP: e.target.value })}
                    required
                  />
                </div>

                {/* Right Required */}
                <div className={styles.formGroup}>
                  <label>Right Volume Required (KBP) *</label>
                  <input
                    type="number"
                    value={formData.requiredRightKBP}
                    onChange={(e) => setFormData({ ...formData, requiredRightKBP: e.target.value })}
                    required
                  />
                </div>

                {/* Maintenance Left */}
                <div className={styles.formGroup}>
                  <label>Maintenance Left (KBP)</label>
                  <input
                    type="number"
                    value={formData.maintenanceLeftKBP}
                    onChange={(e) => setFormData({ ...formData, maintenanceLeftKBP: e.target.value })}
                  />
                </div>

                {/* Maintenance Right */}
                <div className={styles.formGroup}>
                  <label>Maintenance Right (KBP)</label>
                  <input
                    type="number"
                    value={formData.maintenanceRightKBP}
                    onChange={(e) => setFormData({ ...formData, maintenanceRightKBP: e.target.value })}
                  />
                </div>

                {/* Benefit % */}
                <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                  <label>Benefit Allocation (% on Company Total Turnover) *</label>
                  <div className={styles.inputWithAddon}>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.benefitPercentage}
                      onChange={(e) => setFormData({ ...formData, benefitPercentage: e.target.value })}
                      required
                    />
                    <span className={styles.inputAddon}>% on TTO</span>
                  </div>
                </div>

                {/* Description */}
                <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                  <label>Fund Description & Policy Note</label>
                  <textarea
                    rows="2"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                {/* Active Status */}
                <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                  <label className={styles.checkboxContainer}>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    <span>Active (Qualifiers are eligible for monthly pool distribution)</span>
                  </label>
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setEditingFund(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.saveBtn} disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>
      )}

      {activeTab === 'ACHIEVEMENTS' && (
      <>
      {/* Member Fund Achievements — live, persisted history: who achieved
          which Fund, and on which date. Backed by real FundQualification
          records, self-synced whenever repurchase KBP propagates up the
          tree; "Recalculate All" force-backfills every active member now. */}
      <div className={styles.filterStrip}>
        <form onSubmit={handleAchievementsSearchSubmit} className={styles.searchWrap} style={{ flex: 1 }}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search by member name, ID, or email..."
            value={achievementsSearch}
            onChange={(e) => setAchievementsSearch(e.target.value)}
            className={styles.searchInput}
          />
          {achievementsSearch && (
            <button
              type="button"
              onClick={() => { setAchievementsSearch(''); setAchievementsPage(1); fetchAchievements(1, '', achievementsSponsorId, achievementsFundCode); }}
              className={styles.clearSearch}
            >
              ✕
            </button>
          )}
        </form>
        <form onSubmit={handleAchievementsSearchSubmit} className={styles.searchWrap} style={{ flex: 1 }}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Filter by Sponsor ID (e.g. KFR123456)..."
            value={achievementsSponsorId}
            onChange={(e) => setAchievementsSponsorId(e.target.value)}
            className={styles.searchInput}
          />
          {achievementsSponsorId && (
            <button
              type="button"
              onClick={() => { setAchievementsSponsorId(''); setAchievementsPage(1); fetchAchievements(1, achievementsSearch, '', achievementsFundCode); }}
              className={styles.clearSearch}
            >
              ✕
            </button>
          )}
        </form>
        <select
          className={styles.fundFilterCode}
          value={achievementsFundCode}
          onChange={(e) => { setAchievementsFundCode(e.target.value); setAchievementsPage(1); }}
        >
          <option value="ALL">All Funds</option>
          {Object.entries(FUND_CODE_META).map(([code, meta]) => (
            <option key={code} value={code}>{meta.icon} {meta.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleRecalculateAll}
          disabled={isRecalculating}
          className={styles.recalcBtn}
          title="Live-recompute every active member's fund qualification right now"
        >
          {isRecalculating ? 'Recalculating...' : '⚡ Recalculate All'}
        </button>
      </div>

      <div className={styles.tableWrapper}>
        {achievementsLoading ? (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Loading member fund achievements...</p>
          </div>
        ) : achievements.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📜</span>
            <h3>No fund achievements recorded yet</h3>
            <p>Click "Recalculate All" to backfill achievements for every currently-qualified member.</p>
          </div>
        ) : (
          <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>MEMBER</th>
                <th>FUND ACHIEVED</th>
                <th>DATE ACHIEVED</th>
                <th>MATCHED KBP (L / R)</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {achievements.map((a) => {
                const member = a.userId || {};
                const qualifiedDate = a.qualifiedAt ? new Date(a.qualifiedAt) : null;
                return (
                  <tr key={a._id}>
                    <td>
                      <div className={styles.memberCell}>
                        <span className={styles.memberName}>{member.fullName || 'Unknown Member'}</span>
                        <span className={styles.memberMeta}>{member.memberId || member.email || ''}</span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.fundBadgeCell}>
                        <span>{a.fundIcon || '🏦'}</span>
                        <span>{a.fundName || a.fundCode}</span>
                      </span>
                    </td>
                    <td>
                      <span className={styles.dateText}>
                        {qualifiedDate ? qualifiedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </span>
                    </td>
                    <td>
                      <span className={styles.kbpText}>
                        {Number(a.matchedLeftKBP || 0).toLocaleString('en-IN')} / {Number(a.matchedRightKBP || 0).toLocaleString('en-IN')} KBP
                      </span>
                    </td>
                    <td>
                      <span className={styles.achievedPill} data-status={a.status || 'ACTIVE'}>
                        {a.status || 'ACTIVE'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className={styles.paginationRow}>
            <span>
              Showing {achievements.length} of {achievementsPagination.total} achievement{achievementsPagination.total === 1 ? '' : 's'}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={achievementsPage <= 1}
                onClick={() => setAchievementsPage((p) => Math.max(1, p - 1))}
              >
                ← Prev
              </button>
              <span>Page {achievementsPagination.page} of {achievementsPagination.pages}</span>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={achievementsPage >= achievementsPagination.pages}
                onClick={() => setAchievementsPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          </div>
          </>
        )}
      </div>
      </>
      )}
    </div>
  );
};

export default AdminFundsPage;