import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminCampaignsPage.module.css';

const AdminCampaignsPage = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    type: 'MONTHLY',
    targets: [{ name: '', value: '', unit: 'INCOME' }],
    reward: {
      type: 'CASH',
      value: '',
      description: ''
    },
    startDate: '',
    endDate: '',
    status: 'DRAFT',
    isActive: true
  });
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/campaigns');
      if (response.data.success) {
        setCampaigns(response.data.data.campaigns || []);
      }
    } catch (error) {
      showNotification('Failed to fetch campaigns', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        targets: formData.targets.map(t => ({
          ...t,
          value: parseFloat(t.value)
        })),
        reward: {
          ...formData.reward,
          value: parseFloat(formData.reward.value) || 0
        }
      };

      if (editingCampaign) {
        await api.put(`/api/admin/campaigns/${editingCampaign._id}`, data);
        showNotification('Campaign updated successfully', 'success');
      } else {
        await api.post('/api/admin/campaigns', data);
        showNotification('Campaign created successfully', 'success');
      }
      setShowModal(false);
      setEditingCampaign(null);
      resetForm();
      fetchCampaigns();
    } catch (error) {
      showNotification(error.response?.data?.message || 'Operation failed', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this campaign?')) return;
    try {
      await api.delete(`/api/admin/campaigns/${id}`);
      showNotification('Campaign deleted', 'success');
      fetchCampaigns();
    } catch (error) {
      showNotification('Failed to delete campaign', 'error');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.put(`/api/admin/campaigns/${id}/status`, { status });
      showNotification(`Campaign ${status}`, 'success');
      fetchCampaigns();
    } catch (error) {
      showNotification('Failed to update status', 'error');
    }
  };

  const handleEdit = (campaign) => {
    setEditingCampaign(campaign);
    setFormData({
      name: campaign.name || '',
      code: campaign.code || '',
      description: campaign.description || '',
      type: campaign.type || 'MONTHLY',
      targets: campaign.targets || [{ name: '', value: '', unit: 'INCOME' }],
      reward: campaign.reward || { type: 'CASH', value: '', description: '' },
      startDate: campaign.startDate ? campaign.startDate.split('T')[0] : '',
      endDate: campaign.endDate ? campaign.endDate.split('T')[0] : '',
      status: campaign.status || 'DRAFT',
      isActive: campaign.isActive !== undefined ? campaign.isActive : true
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      type: 'MONTHLY',
      targets: [{ name: '', value: '', unit: 'INCOME' }],
      reward: { type: 'CASH', value: '', description: '' },
      startDate: '',
      endDate: '',
      status: 'DRAFT',
      isActive: true
    });
  };

  const addTarget = () => {
    setFormData({
      ...formData,
      targets: [...formData.targets, { name: '', value: '', unit: 'INCOME' }]
    });
  };

  const removeTarget = (index) => {
    if (formData.targets.length <= 1) return;
    setFormData({
      ...formData,
      targets: formData.targets.filter((_, i) => i !== index)
    });
  };

  const updateTarget = (index, field, value) => {
    const updatedTargets = [...formData.targets];
    updatedTargets[index][field] = value;
    setFormData({ ...formData, targets: updatedTargets });
  };

  const getStatusColor = (status) => {
    const colors = {
      'DRAFT': '#94a3b8',
      'ACTIVE': '#22c55e',
      'PAUSED': '#f59e0b',
      'COMPLETED': '#3b82f6',
      'CANCELLED': '#ef4444'
    };
    return colors[status] || '#94a3b8';
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading campaigns...</p>
      </div>
    );
  }

  return (
    <div className={styles.campaignsPage}>
      <div className={styles.header}>
        <h1>Campaign Management</h1>
        <button 
          className={styles.createBtn}
          onClick={() => {
            setEditingCampaign(null);
            resetForm();
            setShowModal(true);
          }}
        >
          + New Campaign
        </button>
      </div>

      <div className={styles.campaignsGrid}>
        {campaigns.length === 0 ? (
          <div className={styles.emptyState}>
            <span>🎯</span>
            <p>No campaigns created yet</p>
          </div>
        ) : (
          campaigns.map((campaign) => (
            <div key={campaign._id} className={styles.campaignCard}>
              <div className={styles.campaignHeader}>
                <div className={styles.campaignInfo}>
                  <h3>{campaign.name}</h3>
                  <span className={styles.campaignCode}>{campaign.code}</span>
                </div>
                <span 
                  className={styles.campaignStatus}
                  style={{ background: getStatusColor(campaign.status) }}
                >
                  {campaign.status}
                </span>
              </div>
              <div className={styles.campaignBody}>
                <p className={styles.campaignDescription}>{campaign.description}</p>
                <div className={styles.campaignDetails}>
                  <div className={styles.detailItem}>
                    <span>Type</span>
                    <span>{campaign.type}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span>Duration</span>
                    <span>
                      {new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span>Targets</span>
                    <span>
                      {campaign.targets?.map(t => `${t.name}: ${t.value} ${t.unit}`).join(', ')}
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span>Reward</span>
                    <span>{campaign.reward?.description}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span>Progress</span>
                    <span>
                      {campaign.progress?.percentageComplete || 0}% 
                      ({campaign.progress?.achievedParticipants || 0}/{campaign.progress?.totalParticipants || 0})
                    </span>
                  </div>
                </div>
                <div className={styles.campaignActions}>
                  <button 
                    className={styles.editBtn}
                    onClick={() => handleEdit(campaign)}
                  >
                    Edit
                  </button>
                  {campaign.status === 'DRAFT' && (
                    <button 
                      className={styles.activateBtn}
                      onClick={() => handleStatusChange(campaign._id, 'ACTIVE')}
                    >
                      Activate
                    </button>
                  )}
                  {campaign.status === 'ACTIVE' && (
                    <>
                      <button 
                        className={styles.pauseBtn}
                        onClick={() => handleStatusChange(campaign._id, 'PAUSED')}
                      >
                        Pause
                      </button>
                      <button 
                        className={styles.completeBtn}
                        onClick={() => handleStatusChange(campaign._id, 'COMPLETED')}
                      >
                        Complete
                      </button>
                    </>
                  )}
                  <button 
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(campaign._id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingCampaign ? 'Edit Campaign' : 'New Campaign'}</h2>
              <button className={styles.closeModalBtn} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Campaign Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Description *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows="2"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="SPECIAL">Special</option>
                    <option value="REFERRAL">Referral</option>
                    <option value="REPURCHASE">Repurchase</option>
                    <option value="RANK">Rank</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Start Date *</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>End Date *</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active</option>
                    <option value="PAUSED">Paused</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
              </div>

              <div className={styles.targetsSection}>
                <h3>Targets</h3>
                {formData.targets.map((target, index) => (
                  <div key={index} className={styles.targetRow}>
                    <input
                      type="text"
                      placeholder="Target name"
                      value={target.name}
                      onChange={(e) => updateTarget(index, 'name', e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Value"
                      value={target.value}
                      onChange={(e) => updateTarget(index, 'value', e.target.value)}
                    />
                    <select
                      value={target.unit}
                      onChange={(e) => updateTarget(index, 'unit', e.target.value)}
                    >
                      <option value="INCOME">Income</option>
                      <option value="KBP">KBP</option>
                      <option value="REFERRALS">Referrals</option>
                      <option value="SALES">Sales</option>
                      <option value="RANK">Rank</option>
                    </select>
                    <button type="button" onClick={() => removeTarget(index)}>✕</button>
                  </div>
                ))}
                <button type="button" className={styles.addTargetBtn} onClick={addTarget}>
                  + Add Target
                </button>
              </div>

              <div className={styles.rewardSection}>
                <h3>Reward</h3>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Reward Type</label>
                    <select
                      value={formData.reward.type}
                      onChange={(e) => setFormData({
                        ...formData, 
                        reward: {...formData.reward, type: e.target.value}
                      })}
                    >
                      <option value="CASH">Cash</option>
                      <option value="PRODUCT">Product</option>
                      <option value="TRIP">Trip</option>
                      <option value="MERCHANDISE">Merchandise</option>
                      <option value="RECOGNITION">Recognition</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Value (₹)</label>
                    <input
                      type="number"
                      value={formData.reward.value}
                      onChange={(e) => setFormData({
                        ...formData, 
                        reward: {...formData.reward, value: e.target.value}
                      })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Description *</label>
                    <input
                      type="text"
                      value={formData.reward.description}
                      onChange={(e) => setFormData({
                        ...formData, 
                        reward: {...formData.reward, description: e.target.value}
                      })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.saveBtn}>
                  {editingCampaign ? 'Update' : 'Create'}
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