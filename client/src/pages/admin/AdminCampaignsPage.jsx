// client/src/pages/admin/AdminCampaignsPage.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminCampaignsPage.module.css';

const CAMPAIGN_TYPES = ['MONTHLY', 'QUARTERLY', 'SPECIAL', 'REFERRAL', 'REPURCHASE', 'RANK'];

const TARGET_UNITS = [
  { value: 'INCOME', label: 'Income Earned (₹)' },
  { value: 'KBP', label: 'Binary KBP Volume' },
  { value: 'REFERRALS', label: 'Direct Referrals' },
  { value: 'SALES', label: 'Sales Revenue (₹)' },
  { value: 'RANK', label: 'Matching Star Pairs' }
];

const REWARD_TYPES = ['CASH', 'PRODUCT', 'TRIP', 'MERCHANDISE', 'RECOGNITION'];

const INITIAL_FORM = {
  name: '',
  code: '',
  description: '',
  type: 'MONTHLY',
  targets: [{ name: 'Star Pairs Matching', value: '10', unit: 'RANK' }],
  reward: {
    type: 'TRIP',
    value: '',
    description: '',
    imageUrl: ''
  },
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  status: 'ACTIVE',
  isActive: true
};

const AdminCampaignsPage = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef(null);
  const { showNotification } = useNotification ? useNotification() : {
    showNotification: (msg, type) => console.log(`[${type}] ${msg}`)
  };

  // Resilient multi-route fetch
  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      let res;
      try {
        res = await api.get('/api/admin/campaigns');
      } catch {
        try {
          res = await api.get('/api/campaigns/all');
        } catch {
          res = await api.get('/api/campaigns');
        }
      }

      if (res.data?.success || Array.isArray(res.data)) {
        const list = res.data?.data?.campaigns || res.data?.campaigns || (Array.isArray(res.data) ? res.data : []);
        setCampaigns(Array.isArray(list) ? list : []);
      }
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
      showNotification('Unable to fetch campaigns.', 'warning');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // One-click seed campaigns
  const handleInitialize = async () => {
    try {
      setIsSubmitting(true);
      let res;
      try {
        res = await api.post('/api/admin/campaigns/initialize');
      } catch {
        res = await api.post('/api/campaigns/initialize');
      }

      if (res.data?.success) {
        showNotification('Campaigns initialized successfully!', 'success');
        fetchCampaigns();
      }
    } catch (err) {
      showNotification('Failed to initialize campaigns.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered dataset
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.name?.toLowerCase().includes(q) ||
        c.code?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.reward?.description?.toLowerCase().includes(q);

      const matchesType = filterType === 'ALL' || c.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [campaigns, searchQuery, filterType]);

  // Financial KPI Metrics
  const kpis = useMemo(() => {
    const total = campaigns.length;
    const active = campaigns.filter((c) => c.status === 'ACTIVE').length;
    const totalQualifiers = campaigns.reduce(
      (sum, c) => sum + Number(c.progress?.achievedParticipants || c.qualifierCount || 0),
      0
    );
    const totalPrizePool = campaigns.reduce(
      (sum, c) => sum + Number(c.reward?.value || c.rewardValue || 0),
      0
    );
    return { total, active, totalQualifiers, totalPrizePool };
  }, [campaigns]);

  // Image Upload to Base64
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showNotification('Image size should be less than 2MB', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({
        ...prev,
        reward: { ...prev.reward, imageUrl: reader.result }
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleOpenCreate = () => {
    setEditingCampaign(null);
    setFormData(INITIAL_FORM);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowModal(true);
  };

  const handleOpenEdit = (c) => {
    setEditingCampaign(c);
    setFormData({
      name: c.name || '',
      code: c.code || '',
      description: c.description || '',
      type: c.type || 'MONTHLY',
      targets: Array.isArray(c.targets) && c.targets.length > 0
        ? c.targets.map((t) => ({ name: t.name, value: String(t.value), unit: t.unit || 'INCOME' }))
        : [{ name: 'Target', value: '10', unit: 'INCOME' }],
      reward: {
        type: c.reward?.type || 'CASH',
        value: c.reward?.value !== undefined ? String(c.reward.value) : '',
        description: c.reward?.description || '',
        imageUrl: c.reward?.imageUrl || ''
      },
      startDate: c.startDate ? new Date(c.startDate).toISOString().split('T')[0] : '',
      endDate: c.endDate ? new Date(c.endDate).toISOString().split('T')[0] : '',
      status: c.status || 'ACTIVE',
      isActive: c.isActive !== undefined ? c.isActive : true
    });
    setShowModal(true);
  };

  // Target Array Builders
  const addTarget = () => {
    setFormData((prev) => ({
      ...prev,
      targets: [...prev.targets, { name: '', value: '', unit: 'KBP' }]
    }));
  };

  const removeTarget = (index) => {
    if (formData.targets.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      targets: prev.targets.filter((_, i) => i !== index)
    }));
  };

  const updateTarget = (index, field, value) => {
    const updated = [...formData.targets];
    updated[index][field] = value;
    setFormData((prev) => ({ ...prev, targets: updated }));
  };

  // Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.code || !formData.endDate) {
      showNotification('Campaign Name, Code, and End Date are required.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        code: formData.code.trim().toUpperCase().replace(/\s+/g, '_'),
        targets: formData.targets.map((t) => ({
          name: t.name || 'Target Requirement',
          value: parseFloat(t.value) || 0,
          unit: t.unit || 'INCOME'
        })),
        reward: {
          ...formData.reward,
          value: parseFloat(formData.reward.value) || 0
        }
      };

      if (editingCampaign) {
        const id = editingCampaign._id || editingCampaign.id;
        try {
          await api.put(`/api/admin/campaigns/${id}`, payload);
        } catch {
          await api.put(`/api/campaigns/${id}`, payload);
        }
        showNotification('Campaign updated successfully!', 'success');
      } else {
        try {
          await api.post('/api/admin/campaigns', payload);
        } catch {
          await api.post('/api/campaigns', payload);
        }
        showNotification('Campaign created and activated!', 'success');
      }

      setShowModal(false);
      fetchCampaigns();
    } catch (err) {
      const msg = err.response?.data?.message || 'Operation failed.';
      showNotification(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Transitions
  const handleStatusChange = async (id, status) => {
    try {
      try {
        await api.put(`/api/admin/campaigns/${id}/status`, { status });
      } catch {
        await api.put(`/api/campaigns/${id}/status`, { status });
      }
      showNotification(`Campaign set to ${status}`, 'success');
      fetchCampaigns();
    } catch (err) {
      showNotification('Failed to update status', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this promotional campaign?')) return;
    try {
      try {
        await api.delete(`/api/admin/campaigns/${id}`);
      } catch {
        await api.delete(`/api/campaigns/${id}`);
      }
      showNotification('Campaign deleted', 'success');
      setCampaigns((prev) => prev.filter((c) => (c._id || c.id) !== id));
    } catch (err) {
      showNotification('Failed to delete campaign', 'error');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return styles.badgeGreen;
      case 'PAUSED':
        return styles.badgeAmber;
      case 'COMPLETED':
        return styles.badgeBlue;
      case 'CANCELLED':
        return styles.badgeRed;
      default:
        return styles.badgeGray;
    }
  };

  const calculateDaysLeft = (end) => {
    const diff = new Date(end) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? `${days} Days Left` : 'Ended';
  };

  return (
    <div className={styles.campaignsPage}>
      {/* 1. Header Toolbar */}
      <div className={styles.header}>
        <div>
          <div className={styles.statusPill}>
            <span className={styles.pulseDot}></span>
            <span>Cluster Production Database</span>
          </div>
          <h1 className={styles.title}>Campaign Management</h1>
          <p className={styles.subtitle}>
            Configure performance bonanzas, leadership foreign retreats, festive rewards, and rank sprint milestones.
          </p>
        </div>

        <div className={styles.topActions}>
          <button
            onClick={handleInitialize}
            disabled={isSubmitting}
            className={styles.initBtn}
            title="Seed 4 standard promotional campaigns"
          >
            ⚡ Initialize Campaigns
          </button>
          <button onClick={fetchCampaigns} className={styles.refreshBtn} title="Sync database">
            ↻ Refresh
          </button>
          <button onClick={handleOpenCreate} className={styles.createBtn}>
            + New Campaign
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Campaigns</span>
          <strong className={styles.statValue}>{kpis.total}</strong>
          <span className={styles.statHelp}>All-time configured</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Active Sprints</span>
          <strong className={`${styles.statValue} ${styles.greenText}`}>{kpis.active}</strong>
          <span className={styles.statHelp}>Currently open for members</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Achieved Qualifiers</span>
          <strong className={`${styles.statValue} ${styles.blueText}`}>{kpis.totalQualifiers}</strong>
          <span className={styles.statHelp}>Winners verified</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Prize Allocation</span>
          <strong className={`${styles.statValue} ${styles.amberText}`}>
            ₹{kpis.totalPrizePool.toLocaleString('en-IN')}
          </strong>
          <span className={styles.statHelp}>Cumulative incentives</span>
        </div>
      </div>

      {/* 3. Search & Category Filters */}
      <div className={styles.filterStrip}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search by Name, Code, Target, or Reward..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className={styles.clearSearch}>✕</button>
          )}
        </div>

        <div className={styles.categoryPillsRow}>
          {['ALL', ...CAMPAIGN_TYPES].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`${styles.filterPill} ${filterType === t ? styles.filterPillActive : ''}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Campaigns Cards Grid */}
      {loading ? (
        <div className={styles.loadingArea}>
          <div className={styles.spinner}></div>
          <p>Syncing promotional campaigns from cluster...</p>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className={styles.emptyArea}>
          <span className={styles.emptyIcon}>🎯</span>
          <h3>No campaigns found</h3>
          <p>Click "Initialize Campaigns" to seed the 4 standard KUWIFR promotional bonanzas.</p>
          <button onClick={handleInitialize} className={styles.initBtn} style={{ marginTop: '12px' }}>
            ⚡ Initialize Campaigns Now
          </button>
        </div>
      ) : (
        <div className={styles.campaignsGrid}>
          {filteredCampaigns.map((c) => {
            const id = c._id || c.id;
            const rewardImg = c.reward?.imageUrl || 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=600&auto=format&fit=crop&q=80';

            return (
              <div key={id} className={styles.campaignCard}>
                <div className={styles.cardCover}>
                  <img src={rewardImg} alt={c.name} className={styles.coverImg} />
                  <span className={styles.typeBadge}>{c.type}</span>
                  <span className={`${styles.statusBadge} ${getStatusBadge(c.status)}`}>
                    {c.status}
                  </span>
                </div>

                <div className={styles.cardBody}>
                  <h3 className={styles.campaignTitle}>{c.name}</h3>
                  <code className={styles.campaignCode}>{c.code}</code>
                  <p className={styles.campaignDescription}>{c.description}</p>

                  {/* Target & Reward Block */}
                  <div className={styles.detailsBlock}>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>TARGET</span>
                      <strong>
                        {c.targets?.map((t) => `${t.name}: ${t.value} ${t.unit}`).join(' • ') || 'Active Participation'}
                      </strong>
                    </div>

                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>REWARD</span>
                      <strong className={styles.rewardHighlight}>
                        {c.reward?.type}: {c.reward?.description} {c.reward?.value ? `(₹${Number(c.reward.value).toLocaleString('en-IN')})` : ''}
                      </strong>
                    </div>
                  </div>

                  {/* Progress & Timing */}
                  <div className={styles.progressRow}>
                    <span>⏳ {calculateDaysLeft(c.endDate)}</span>
                    <span>
                      👥 {c.progress?.achievedParticipants || 0} / {c.progress?.totalParticipants || 0} Qualifiers
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className={styles.campaignActions}>
                    <button className={styles.editBtn} onClick={() => handleOpenEdit(c)}>
                      Edit
                    </button>

                    {c.status === 'DRAFT' && (
                      <button
                        className={styles.activateBtn}
                        onClick={() => handleStatusChange(id, 'ACTIVE')}
                      >
                        Activate
                      </button>
                    )}

                    {c.status === 'ACTIVE' && (
                      <button
                        className={styles.pauseBtn}
                        onClick={() => handleStatusChange(id, 'PAUSED')}
                      >
                        Pause
                      </button>
                    )}

                    {c.status === 'PAUSED' && (
                      <button
                        className={styles.activateBtn}
                        onClick={() => handleStatusChange(id, 'ACTIVE')}
                      >
                        Resume
                      </button>
                    )}

                    <button className={styles.deleteBtn} onClick={() => handleDelete(id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Production Modal Card */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => !isSubmitting && setShowModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{editingCampaign ? `Edit ${editingCampaign.name}` : 'Create New Campaign'}</h2>
                <p>Configure qualification thresholds, promotional rewards, and campaign dates.</p>
              </div>
              <button
                className={styles.closeModalBtn}
                onClick={() => setShowModal(false)}
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.modalForm}>
              <div className={styles.formGrid}>
                {/* Name */}
                <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                  <label>Campaign Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g. Goa Leadership Convention 2026"
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
                    placeholder="e.g. GOA_BONANZA_2026"
                  />
                </div>

                {/* Type */}
                <div className={styles.formGroup}>
                  <label>Campaign Type *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    {CAMPAIGN_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Start Date */}
                <div className={styles.formGroup}>
                  <label>Start Date *</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>

                {/* End Date */}
                <div className={styles.formGroup}>
                  <label>End Date *</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                  />
                </div>

                {/* Status */}
                <div className={styles.formGroup}>
                  <label>Initial Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PAUSED">PAUSED</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </div>

                {/* Reward Image URL & Upload */}
                <div className={styles.formGroup}>
                  <label>Reward Image URL / Upload</label>
                  <div className={styles.imageInputRow}>
                    <input
                      type="text"
                      placeholder="Paste Image URL..."
                      value={formData.reward.imageUrl}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reward: { ...formData.reward, imageUrl: e.target.value }
                        })
                      }
                    />
                    <label htmlFor="campImgUpload" className={styles.uploadFileBtn}>
                      📁
                    </label>
                    <input
                      type="file"
                      id="campImgUpload"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                  </div>
                </div>

                {/* Description */}
                <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                  <label>Description & Purpose *</label>
                  <textarea
                    rows="2"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    placeholder="Describe eligibility conditions and qualifying guidelines..."
                  />
                </div>
              </div>

              {/* Dynamic Targets Builder */}
              <div className={styles.sectionDivider}>
                <div className={styles.sectionHeader}>
                  <h3>Qualification Target Milestones</h3>
                  <button type="button" onClick={addTarget} className={styles.addTargetBtn}>
                    + Add Target
                  </button>
                </div>

                <div className={styles.targetsList}>
                  {formData.targets.map((t, idx) => (
                    <div key={idx} className={styles.targetRow}>
                      <input
                        type="text"
                        placeholder="Target Name (e.g. Star Pairs)"
                        value={t.name}
                        onChange={(e) => updateTarget(idx, 'name', e.target.value)}
                        required
                        className={styles.targetNameInput}
                      />
                      <input
                        type="number"
                        placeholder="Target Value"
                        value={t.value}
                        onChange={(e) => updateTarget(idx, 'value', e.target.value)}
                        required
                        className={styles.targetValueInput}
                      />
                      <select
                        value={t.unit}
                        onChange={(e) => updateTarget(idx, 'unit', e.target.value)}
                        className={styles.targetUnitSelect}
                      >
                        {TARGET_UNITS.map((u) => (
                          <option key={u.value} value={u.value}>{u.label}</option>
                        ))}
                      </select>
                      {formData.targets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTarget(idx)}
                          className={styles.removeTargetBtn}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Reward Specification */}
              <div className={styles.sectionDivider}>
                <div className={styles.sectionHeader}>
                  <h3>Incentive Reward Specification</h3>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Reward Category *</label>
                    <select
                      value={formData.reward.type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reward: { ...formData.reward, type: e.target.value }
                        })
                      }
                    >
                      {REWARD_TYPES.map((rt) => (
                        <option key={rt} value={rt}>{rt}</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Monetary Valuation (₹)</label>
                    <input
                      type="number"
                      value={formData.reward.value}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reward: { ...formData.reward, value: e.target.value }
                        })
                      }
                      placeholder="e.g. 45000"
                    />
                  </div>

                  <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                    <label>Prize Description *</label>
                    <input
                      type="text"
                      value={formData.reward.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reward: { ...formData.reward, description: e.target.value }
                        })
                      }
                      required
                      placeholder="e.g. 3N/4D 5-Star Luxury Goa Stay + Airfare"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                  {isSubmitting ? 'Saving Campaign...' : editingCampaign ? 'Update Campaign' : 'Launch Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCampaignsPage;