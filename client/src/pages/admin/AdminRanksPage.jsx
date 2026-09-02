import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminRanksPage.module.css';

const AdminRanksPage = () => {
  const [ranks, setRanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRank, setEditingRank] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    level: '',
    code: '',
    starsRequired: '',
    reward: '',
    rewardValue: '',
    salaryPercentage: '',
    icon: '🏆',
    color: '#2563eb',
    isActive: true
  });
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchRanks();
  }, []);

  const fetchRanks = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/ranks/all');
      if (response.data.success) {
        setRanks(response.data.data.ranks || []);
      }
    } catch (error) {
      showNotification('Failed to fetch ranks', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        level: parseInt(formData.level),
        starsRequired: parseInt(formData.starsRequired) || 0,
        rewardValue: parseFloat(formData.rewardValue) || 0,
        salaryPercentage: parseFloat(formData.salaryPercentage) || 0
      };

      if (editingRank) {
        await api.put(`/api/admin/ranks/${editingRank._id}`, data);
        showNotification('Rank updated successfully', 'success');
      } else {
        await api.post('/api/admin/ranks', data);
        showNotification('Rank created successfully', 'success');
      }
      setShowModal(false);
      setEditingRank(null);
      resetForm();
      fetchRanks();
    } catch (error) {
      showNotification(error.response?.data?.message || 'Operation failed', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this rank?')) return;
    try {
      await api.delete(`/api/admin/ranks/${id}`);
      showNotification('Rank deleted successfully', 'success');
      fetchRanks();
    } catch (error) {
      showNotification('Failed to delete rank', 'error');
    }
  };

  const handleEdit = (rank) => {
    setEditingRank(rank);
    setFormData({
      name: rank.name || '',
      level: rank.level || '',
      code: rank.code || '',
      starsRequired: rank.starsRequired || '',
      reward: rank.reward || '',
      rewardValue: rank.rewardValue || '',
      salaryPercentage: rank.salaryPercentage || '',
      icon: rank.icon || '🏆',
      color: rank.color || '#2563eb',
      isActive: rank.isActive !== undefined ? rank.isActive : true
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      level: '',
      code: '',
      starsRequired: '',
      reward: '',
      rewardValue: '',
      salaryPercentage: '',
      icon: '🏆',
      color: '#2563eb',
      isActive: true
    });
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading ranks...</p>
      </div>
    );
  }

  return (
    <div className={styles.ranksPage}>
      <div className={styles.header}>
        <h1>Rank Management</h1>
        <button 
          className={styles.createBtn}
          onClick={() => {
            setEditingRank(null);
            resetForm();
            setShowModal(true);
          }}
        >
          + Add Rank
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Icon</th>
              <th>Name</th>
              <th>Level</th>
              <th>Stars Required</th>
              <th>Reward</th>
              <th>Salary %</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ranks.length === 0 ? (
              <tr>
                <td colSpan="8" className={styles.emptyState}>No ranks found</td>
              </tr>
            ) : (
              ranks.map((rank) => (
                <tr key={rank._id}>
                  <td style={{ fontSize: '24px' }}>{rank.icon || '🏆'}</td>
                  <td>{rank.name}</td>
                  <td>{rank.level}</td>
                  <td>{rank.starsRequired}</td>
                  <td>{rank.reward || '-'}</td>
                  <td>{rank.salaryPercentage ? `${rank.salaryPercentage * 100}%` : '-'}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${rank.isActive ? styles.active : styles.inactive}`}>
                      {rank.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button className={styles.editBtn} onClick={() => handleEdit(rank)}>Edit</button>
                    <button className={styles.deleteBtn} onClick={() => handleDelete(rank._id)}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingRank ? 'Edit Rank' : 'Add New Rank'}</h2>
              <button className={styles.closeModalBtn} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Rank Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Level *</label>
                  <input
                    type="number"
                    value={formData.level}
                    onChange={(e) => setFormData({...formData, level: e.target.value})}
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
                  <label>Stars Required</label>
                  <input
                    type="number"
                    value={formData.starsRequired}
                    onChange={(e) => setFormData({...formData, starsRequired: e.target.value})}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Reward</label>
                  <input
                    type="text"
                    value={formData.reward}
                    onChange={(e) => setFormData({...formData, reward: e.target.value})}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Reward Value (₹)</label>
                  <input
                    type="number"
                    value={formData.rewardValue}
                    onChange={(e) => setFormData({...formData, rewardValue: e.target.value})}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Salary Percentage (0-1)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.salaryPercentage}
                    onChange={(e) => setFormData({...formData, salaryPercentage: e.target.value})}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Icon</label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({...formData, icon: e.target.value})}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Color</label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                    />
                    Active
                  </label>
                </div>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.saveBtn}>
                  {editingRank ? 'Update' : 'Create'}
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