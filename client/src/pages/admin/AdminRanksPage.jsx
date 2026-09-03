// client/src/pages/admin/AdminRanksPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminRanksPage.module.css';

// Preset icons for career rank progression
const RANK_ICONS = ['⭐', '🥉', '🥈', '🥇', '💎', '🟢', '💠', '👑', '🏰', '🌌', '⚜️', '🦁', '🏆'];

// Palette swatches matching executive milestone tiers
const COLOR_PRESETS = [
  '#3b82f6', // Blue (Star Executive)
  '#cd7f32', // Bronze
  '#94a3b8', // Silver
  '#f59e0b', // Gold
  '#ef4444', // Ruby Red
  '#10b981', // Emerald Green
  '#06b6d4', // Diamond Cyan
  '#8b5cf6', // Crown Purple
  '#ec4899', // Pink
  '#6366f1', // Indigo
  '#d946ef', // Fuchsia
  '#eab308'  // Emperor Amber Gold
];

const INITIAL_FORM = {
  name: '',
  level: '',
  code: '',
  starsRequired: '',
  reward: '',
  rewardValue: '',
  salaryPercentage: '0',
  icon: '⭐',
  color: '#f59e0b',
  isActive: true
};

const AdminRanksPage = () => {
  const [ranks, setRanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRank, setEditingRank] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { showNotification } = useNotification ? useNotification() : {
    showNotification: (msg, type) => console.log(`[${type}] ${msg}`)
  };

  // Multi-route rank fetcher to avoid 404s
  const fetchRanks = useCallback(async () => {
    try {
      setLoading(true);
      let res;
      try {
        res = await api.get('/api/admin/ranks');
      } catch {
        try {
          res = await api.get('/api/ranks/all');
        } catch {
          res = await api.get('/api/ranks');
        }
      }

      if (res.data?.success || Array.isArray(res.data)) {
        const list = res.data?.data?.ranks || res.data?.ranks || res.data || [];
        setRanks(Array.isArray(list) ? list : []);
      }
    } catch (error) {
      console.error('Failed to load ranks:', error);
      showNotification('Unable to fetch live ranks. Showing catalog.', 'warning');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchRanks();
  }, [fetchRanks]);

  // Real-time catalog search
  const filteredRanks = useMemo(() => {
    return ranks.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        r.name?.toLowerCase().includes(q) ||
        r.code?.toLowerCase().includes(q) ||
        r.reward?.toLowerCase().includes(q)
      );
    });
  }, [ranks, searchQuery]);

  // Financial KPI Metrics
  const kpis = useMemo(() => {
    const totalTiers = ranks.length;
    const activeTiers = ranks.filter((r) => r.isActive).length;
    const topReward = ranks.reduce((max, r) => Math.max(max, Number(r.rewardValue || 0)), 0);
    const cumulativePool = ranks.reduce((sum, r) => {
      const p = Number(r.salaryPercentage || 0);
      return sum + (p > 1 ? p : p * 100);
    }, 0);
    return { totalTiers, activeTiers, topReward, cumulativePool };
  }, [ranks]);

  const handleOpenCreate = () => {
    setEditingRank(null);
    const nextLevel = ranks.length + 1;
    setFormData({
      ...INITIAL_FORM,
      level: String(nextLevel),
      code: `RANK_LEVEL_${nextLevel}`
    });
    setShowModal(true);
  };

  const handleEdit = (rank) => {
    setEditingRank(rank);
    // Convert decimal salary back to display percentage (e.g., 0.01 -> "1.0", 0.0075 -> "0.75")
    let displayPercent = '0';
    if (rank.salaryPercentage !== undefined) {
      const p = Number(rank.salaryPercentage);
      displayPercent = p > 0 && p < 1 ? String(p * 100) : String(p);
    }

    setFormData({
      name: rank.name || '',
      level: rank.level !== undefined ? String(rank.level) : '1',
      code: rank.code || '',
      starsRequired: rank.starsRequired !== undefined ? String(rank.starsRequired) : '',
      reward: rank.reward || '',
      rewardValue: rank.rewardValue !== undefined ? String(rank.rewardValue) : '',
      salaryPercentage: displayPercent,
      icon: rank.icon || '⭐',
      color: rank.color || '#2563eb',
      isActive: rank.isActive !== undefined ? rank.isActive : true
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.level) {
      showNotification('Rank Name and Progression Level are required.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      // Parse salary percentage: 1.0% -> 0.01, 0.75% -> 0.0075
      const numPercent = parseFloat(formData.salaryPercentage) || 0;
      const parsedSalaryDecimal = numPercent > 1 ? numPercent / 100 : numPercent <= 0.05 && numPercent > 0 ? numPercent : numPercent / 100;

      const payload = {
        ...formData,
        code: (formData.code || formData.name.replace(/\s+/g, '_')).toUpperCase(),
        level: parseInt(formData.level, 10),
        starsRequired: parseInt(formData.starsRequired, 10) || 0,
        rewardValue: parseFloat(formData.rewardValue) || 0,
        salaryPercentage: parsedSalaryDecimal
      };

      if (editingRank) {
        const id = editingRank._id || editingRank.id;
        try {
          await api.put(`/api/admin/ranks/${id}`, payload);
        } catch {
          await api.put(`/api/ranks/${id}`, payload);
        }
        showNotification('Rank updated successfully!', 'success');
      } else {
        try {
          await api.post('/api/admin/ranks', payload);
        } catch {
          await api.post('/api/ranks', payload);
        }
        showNotification('New rank tier created!', 'success');
      }

      setShowModal(false);
      fetchRanks();
    } catch (error) {
      const msg = error.response?.data?.message || 'Operation failed. Check server logs.';
      showNotification(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (rank) => {
    const id = rank._id || rank.id;
    const newStatus = !rank.isActive;
    try {
      try {
        await api.put(`/api/admin/ranks/${id}`, { isActive: newStatus });
      } catch {
        await api.put(`/api/ranks/${id}`, { isActive: newStatus });
      }

      setRanks((prev) =>
        prev.map((r) => ((r._id || r.id) === id ? { ...r, isActive: newStatus } : r))
      );
      showNotification(`Rank visibility set to ${newStatus ? 'ACTIVE' : 'INACTIVE'}`, 'success');
    } catch (err) {
      showNotification('Failed to toggle status', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this rank? This affects member progression logic.')) return;
    try {
      try {
        await api.delete(`/api/admin/ranks/${id}`);
      } catch {
        await api.delete(`/api/ranks/${id}`);
      }
      showNotification('Rank removed from career progression', 'success');
      setRanks((prev) => prev.filter((r) => (r._id || r.id) !== id));
    } catch (error) {
      showNotification('Failed to delete rank', 'error');
    }
  };

  return (
    <div className={styles.ranksPage}>
      {/* 1. Header Area */}
      <div className={styles.header}>
        <div>
          <div className={styles.statusPill}>
            <span className={styles.pulseDot}></span>
            <span>Cluster Production Database</span>
          </div>
          <h1 className={styles.title}>Rank Management</h1>
          <p className={styles.subtitle}>
            Configure the 12-tier Kuwi Star career progression tree, star pair qualification thresholds, physical rewards, and 1% TTO royalty salary allocations.
          </p>
        </div>

        <div className={styles.topActions}>
          <button onClick={fetchRanks} className={styles.refreshBtn} title="Sync database">
            ↻ Refresh Ranks
          </button>
          <button onClick={handleOpenCreate} className={styles.createBtn}>
            + Add Rank
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Progression Tiers</span>
          <strong className={styles.statValue}>{kpis.totalTiers}</strong>
          <span className={styles.statHelp}>Official Kuwi Star Ranks</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Active in Career Path</span>
          <strong className={`${styles.statValue} ${styles.greenText}`}>
            {kpis.activeTiers}
          </strong>
          <span className={styles.statHelp}>Visible to members</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Top Tier Reward Value</span>
          <strong className={`${styles.statValue} ${styles.blueText}`}>
            ₹{kpis.topReward.toLocaleString('en-IN')}
          </strong>
          <span className={styles.statHelp}>Emperor Royal Crest Prize</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Cumulative 1% TTO Salary Pool</span>
          <strong className={styles.statValue}>
            {kpis.cumulativePool.toFixed(2)}%
          </strong>
          <span className={styles.statHelp}>Total turnover royalty pool</span>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className={styles.filterStrip}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search by Rank Name, Code, or Reward..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className={styles.clearSearch}>✕</button>
          )}
        </div>
      </div>

      {/* 4. Table Wrapper */}
      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loadingArea}>
            <div className={styles.spinner}></div>
            <p>Syncing rank progression rules...</p>
          </div>
        ) : filteredRanks.length === 0 ? (
          <div className={styles.emptyArea}>
            <span className={styles.emptyIcon}>🏆</span>
            <h3>No ranks configured</h3>
            <p>Click below to configure your first career rank.</p>
            <button onClick={handleOpenCreate} className={styles.createBtn} style={{ marginTop: '12px' }}>
              + Add First Rank
            </button>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ICON</th>
                <th>RANK NAME & CODE</th>
                <th>LEVEL</th>
                <th>STARS REQUIRED</th>
                <th>ACHIEVEMENT REWARD</th>
                <th>REWARD VALUE</th>
                <th>SALARY % (TTO)</th>
                <th>STATUS</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredRanks.map((rank) => {
                const id = rank._id || rank.id;
                const salaryVal = Number(rank.salaryPercentage || 0);
                const isSalaryActive = salaryVal > 0;
                const formattedPercent = salaryVal > 0 && salaryVal < 1 ? (salaryVal * 100).toFixed(2) : salaryVal.toFixed(2);

                return (
                  <tr key={id}>
                    <td>
                      <div
                        className={styles.iconCircle}
                        style={{
                          backgroundColor: `${rank.color || '#2563eb'}18`,
                          borderColor: rank.color || '#2563eb'
                        }}
                      >
                        <span>{rank.icon || '⭐'}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.rankNameCol}>
                        <strong className={styles.rankTitle} style={{ color: rank.color || '#0f172a' }}>
                          {rank.name}
                        </strong>
                        <code className={styles.rankCode}>{rank.code}</code>
                      </div>
                    </td>
                    <td>
                      <span className={styles.levelPill}>Level {rank.level}</span>
                    </td>
                    <td>
                      <strong className={styles.starsText}>
                        ⭐ {Number(rank.starsRequired || 0).toLocaleString('en-IN')}
                      </strong>
                    </td>
                    <td>
                      <span className={styles.rewardText}>{rank.reward || '—'}</span>
                    </td>
                    <td>
                      <strong className={styles.valueText}>
                        {rank.rewardValue ? `₹${Number(rank.rewardValue).toLocaleString('en-IN')}` : '—'}
                      </strong>
                    </td>
                    <td>
                      <span className={`${styles.salaryPill} ${isSalaryActive ? styles.salaryActive : styles.salaryNone}`}>
                        {isSalaryActive ? `${formattedPercent}% Monthly TTO` : '—'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(rank)}
                        className={`${styles.statusToggle} ${rank.isActive ? styles.statusActive : styles.statusInactive}`}
                      >
                        {rank.isActive ? '● Active' : '○ Inactive'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className={styles.actionBtns}>
                        <button
                          className={styles.editBtn}
                          onClick={() => handleEdit(rank)}
                          title="Edit Rank Details"
                        >
                          Edit
                        </button>
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDelete(id)}
                          title="Delete Rank"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 5. Production-Ready High-Z-Index Modal Card */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => !isSubmitting && setShowModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>
                  {editingRank ? `Edit ${editingRank.name}` : 'Configure New Rank Tier'}
                </h2>
                <p className={styles.modalSub}>
                  Define stars qualification thresholds, physical rewards, and 1% monthly royalty salary rules.
                </p>
              </div>
              <button
                className={styles.closeModalBtn}
                onClick={() => setShowModal(false)}
                disabled={isSubmitting}
                aria-label="Close Modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.modalForm}>
              <div className={styles.formGrid}>
                {/* Rank Name */}
                <div className={styles.formGroup}>
                  <label>Rank Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g. Gold Director"
                  />
                </div>

                {/* Level */}
                <div className={styles.formGroup}>
                  <label>Progression Level (1-12) *</label>
                  <input
                    type="number"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    required
                    placeholder="e.g. 5"
                  />
                </div>

                {/* Code */}
                <div className={styles.formGroup}>
                  <label>Unique Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    required
                    placeholder="e.g. GOLD_DIRECTOR"
                  />
                </div>

                {/* Stars Required */}
                <div className={styles.formGroup}>
                  <label>Stars Required (Pairs) *</label>
                  <input
                    type="number"
                    value={formData.starsRequired}
                    onChange={(e) => setFormData({ ...formData, starsRequired: e.target.value })}
                    required
                    placeholder="e.g. 200"
                  />
                </div>

                {/* Reward Name */}
                <div className={styles.formGroup}>
                  <label>Physical / Cash Reward *</label>
                  <input
                    type="text"
                    value={formData.reward}
                    onChange={(e) => setFormData({ ...formData, reward: e.target.value })}
                    required
                    placeholder="e.g. Ruby Ring + ₹25,000 Cash"
                  />
                </div>

                {/* Reward Value */}
                <div className={styles.formGroup}>
                  <label>Reward Monetary Value (₹)</label>
                  <input
                    type="number"
                    value={formData.rewardValue}
                    onChange={(e) => setFormData({ ...formData, rewardValue: e.target.value })}
                    placeholder="e.g. 25000"
                  />
                </div>

                {/* Salary Percentage */}
                <div className={styles.formGroup}>
                  <label>Turnover Royalty Salary (% TTO)</label>
                  <div className={styles.inputWithAddon}>
                    <input
                      type="number"
                      step="0.001"
                      value={formData.salaryPercentage}
                      onChange={(e) => setFormData({ ...formData, salaryPercentage: e.target.value })}
                      placeholder="e.g. 1.0 (for 1% TTO)"
                    />
                    <span className={styles.inputAddon}>% TTO</span>
                  </div>
                  <small className={styles.fieldHelper}>
                    Directly calculated from company 1% total monthly turnover pool.
                  </small>
                </div>

                {/* Icon Selection */}
                <div className={styles.formGroup}>
                  <label>Rank Badge Icon</label>
                  <div className={styles.iconSelectionRow}>
                    <input
                      type="text"
                      value={formData.icon}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      className={styles.iconManualInput}
                      maxLength={4}
                    />
                    <div className={styles.presetIcons}>
                      {RANK_ICONS.map((ic) => (
                        <button
                          type="button"
                          key={ic}
                          onClick={() => setFormData({ ...formData, icon: ic })}
                          className={`${styles.presetIconBtn} ${formData.icon === ic ? styles.presetIconActive : ''}`}
                        >
                          {ic}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Color Preset Palette */}
                <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                  <label>Tier Branding Color</label>
                  <div className={styles.colorPaletteRow}>
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className={styles.colorPickerNative}
                    />
                    <div className={styles.colorPresets}>
                      {COLOR_PRESETS.map((col) => (
                        <button
                          type="button"
                          key={col}
                          onClick={() => setFormData({ ...formData, color: col })}
                          className={`${styles.colorChip} ${formData.color === col ? styles.colorChipActive : ''}`}
                          style={{ backgroundColor: col }}
                          title={col}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Active Checkbox */}
                <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                  <label className={styles.checkboxContainer}>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    <span>Active (Display this milestone in Member Career Progression)</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving Rank...' : editingRank ? 'Update Rank' : 'Create Rank'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRanksPage;