import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminRulesPage.module.css';

const AdminRulesPage = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    key: '',
    value: '',
    type: 'NUMBER',
    description: '',
    status: 'ACTIVE'
  });
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/rules');
      if (response.data.success) {
        setRules(response.data.data.rules || []);
      }
    } catch (error) {
      showNotification('Failed to fetch rules', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        value: formData.type === 'NUMBER' ? parseFloat(formData.value) : formData.value
      };

      if (editingRule) {
        await api.put(`/api/admin/rules/${editingRule._id}`, data);
        showNotification('Rule updated successfully', 'success');
      } else {
        await api.post('/api/admin/rules', data);
        showNotification('Rule created successfully', 'success');
      }
      setShowModal(false);
      setEditingRule(null);
      resetForm();
      fetchRules();
    } catch (error) {
      showNotification(error.response?.data?.message || 'Operation failed', 'error');
    }
  };

  const handleEdit = (rule) => {
    setEditingRule(rule);
    setFormData({
      key: rule.key || '',
      value: rule.value || '',
      type: rule.type || 'NUMBER',
      description: rule.description || '',
      status: rule.status || 'ACTIVE'
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      key: '',
      value: '',
      type: 'NUMBER',
      description: '',
      status: 'ACTIVE'
    });
  };

  const ruleTypes = {
    'NUMBER': 'Number',
    'STRING': 'String',
    'BOOLEAN': 'Boolean',
    'PERCENTAGE': 'Percentage'
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading rules...</p>
      </div>
    );
  }

  return (
    <div className={styles.rulesPage}>
      <div className={styles.header}>
        <h1>Business Rules</h1>
        <button 
          className={styles.createBtn}
          onClick={() => {
            setEditingRule(null);
            resetForm();
            setShowModal(true);
          }}
        >
          + Add Rule
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Key</th>
              <th>Value</th>
              <th>Type</th>
              <th>Description</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 ? (
              <tr>
                <td colSpan="6" className={styles.emptyState}>No rules found</td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr key={rule._id}>
                  <td><code>{rule.key}</code></td>
                  <td>{String(rule.value)}</td>
                  <td>{ruleTypes[rule.type] || rule.type}</td>
                  <td>{rule.description}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${rule.status === 'ACTIVE' ? styles.active : styles.inactive}`}>
                      {rule.status}
                    </span>
                  </td>
                  <td>
                    <button className={styles.editBtn} onClick={() => handleEdit(rule)}>Edit</button>
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
              <h2>{editingRule ? 'Edit Rule' : 'Add New Rule'}</h2>
              <button className={styles.closeModalBtn} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Key *</label>
                  <input
                    type="text"
                    value={formData.key}
                    onChange={(e) => setFormData({...formData, key: e.target.value})}
                    required
                    disabled={!!editingRule}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Type *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    required
                  >
                    {Object.entries(ruleTypes).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Value *</label>
                  <input
                    type={formData.type === 'BOOLEAN' ? 'text' : 'text'}
                    value={formData.value}
                    onChange={(e) => setFormData({...formData, value: e.target.value})}
                    required
                    placeholder={formData.type === 'BOOLEAN' ? 'true or false' : 'Enter value'}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Description *</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.saveBtn}>
                  {editingRule ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRulesPage;