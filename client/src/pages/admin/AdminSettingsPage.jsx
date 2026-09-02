import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminSettingsPage.module.css';

const AdminSettingsPage = () => {
  const [settings, setSettings] = useState({
    company: {
      name: 'KUWIFR Services Pvt Ltd',
      email: 'support@kuwifr.com',
      phone: '+91-XXXXXXXXXX',
      address: '123, Business Park, Mumbai, India'
    },
    payment: {
      upiId: 'kuwifr@upi',
      upiName: 'KUWIFR SERVICES PVT LTD',
      maxOfflineAmount: 100000,
      minOfflineAmount: 100,
      verificationTimeout: 48
    },
    security: {
      rateLimitWindow: 15,
      rateLimitMax: 100,
      jwtExpiresIn: '7d'
    },
    email: {
      from: 'noreply@kuwifr.com',
      verificationExpiry: 24,
      resetExpiry: 1
    },
    system: {
      maintenanceMode: false,
      debugMode: false
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('company');
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/settings');
      if (response.data.success) {
        setSettings(response.data.data);
      }
    } catch (error) {
      showNotification('Failed to fetch settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (section, field, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/api/admin/settings', settings);
      showNotification('Settings saved successfully', 'success');
    } catch (error) {
      showNotification('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset all settings to default?')) {
      fetchSettings();
      showNotification('Settings reset', 'info');
    }
  };

  const tabs = [
    { id: 'company', label: 'Company' },
    { id: 'payment', label: 'Payment' },
    { id: 'security', label: 'Security' },
    { id: 'email', label: 'Email' },
    { id: 'system', label: 'System' }
  ];

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading settings...</p>
      </div>
    );
  }

  const renderCompanySettings = () => (
    <div className={styles.settingsSection}>
      <h2>Company Information</h2>
      <div className={styles.formGrid}>
        <div className={styles.formGroup}>
          <label>Company Name</label>
          <input
            type="text"
            value={settings.company.name}
            onChange={(e) => handleChange('company', 'name', e.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <label>Support Email</label>
          <input
            type="email"
            value={settings.company.email}
            onChange={(e) => handleChange('company', 'email', e.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <label>Support Phone</label>
          <input
            type="text"
            value={settings.company.phone}
            onChange={(e) => handleChange('company', 'phone', e.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <label>Address</label>
          <textarea
            value={settings.company.address}
            onChange={(e) => handleChange('company', 'address', e.target.value)}
            rows="2"
          />
        </div>
      </div>
    </div>
  );

  const renderPaymentSettings = () => (
    <div className={styles.settingsSection}>
      <h2>Payment Configuration</h2>
      <div className={styles.formGrid}>
        <div className={styles.formGroup}>
          <label>UPI ID</label>
          <input
            type="text"
            value={settings.payment.upiId}
            onChange={(e) => handleChange('payment', 'upiId', e.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <label>UPI Name</label>
          <input
            type="text"
            value={settings.payment.upiName}
            onChange={(e) => handleChange('payment', 'upiName', e.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <label>Max Offline Amount (₹)</label>
          <input
            type="number"
            value={settings.payment.maxOfflineAmount}
            onChange={(e) => handleChange('payment', 'maxOfflineAmount', parseInt(e.target.value))}
          />
        </div>
        <div className={styles.formGroup}>
          <label>Min Offline Amount (₹)</label>
          <input
            type="number"
            value={settings.payment.minOfflineAmount}
            onChange={(e) => handleChange('payment', 'minOfflineAmount', parseInt(e.target.value))}
          />
        </div>
        <div className={styles.formGroup}>
          <label>Verification Timeout (hours)</label>
          <input
            type="number"
            value={settings.payment.verificationTimeout}
            onChange={(e) => handleChange('payment', 'verificationTimeout', parseInt(e.target.value))}
          />
        </div>
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className={styles.settingsSection}>
      <h2>Security Configuration</h2>
      <div className={styles.formGrid}>
        <div className={styles.formGroup}>
          <label>Rate Limit Window (minutes)</label>
          <input
            type="number"
            value={settings.security.rateLimitWindow}
            onChange={(e) => handleChange('security', 'rateLimitWindow', parseInt(e.target.value))}
          />
        </div>
        <div className={styles.formGroup}>
          <label>Rate Limit Max Requests</label>
          <input
            type="number"
            value={settings.security.rateLimitMax}
            onChange={(e) => handleChange('security', 'rateLimitMax', parseInt(e.target.value))}
          />
        </div>
        <div className={styles.formGroup}>
          <label>JWT Expires In</label>
          <input
            type="text"
            value={settings.security.jwtExpiresIn}
            onChange={(e) => handleChange('security', 'jwtExpiresIn', e.target.value)}
            placeholder="7d"
          />
        </div>
      </div>
    </div>
  );

  const renderEmailSettings = () => (
    <div className={styles.settingsSection}>
      <h2>Email Configuration</h2>
      <div className={styles.formGrid}>
        <div className={styles.formGroup}>
          <label>From Email</label>
          <input
            type="email"
            value={settings.email.from}
            onChange={(e) => handleChange('email', 'from', e.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <label>Verification Expiry (hours)</label>
          <input
            type="number"
            value={settings.email.verificationExpiry}
            onChange={(e) => handleChange('email', 'verificationExpiry', parseInt(e.target.value))}
          />
        </div>
        <div className={styles.formGroup}>
          <label>Reset Password Expiry (hours)</label>
          <input
            type="number"
            value={settings.email.resetExpiry}
            onChange={(e) => handleChange('email', 'resetExpiry', parseInt(e.target.value))}
          />
        </div>
      </div>
    </div>
  );

  const renderSystemSettings = () => (
    <div className={styles.settingsSection}>
      <h2>System Configuration</h2>
      <div className={styles.formGrid}>
        <div className={styles.formGroup}>
          <label>
            <input
              type="checkbox"
              checked={settings.system.maintenanceMode}
              onChange={(e) => handleChange('system', 'maintenanceMode', e.target.checked)}
            />
            Maintenance Mode
          </label>
          <p className={styles.helperText}>When enabled, only admins can access the system</p>
        </div>
        <div className={styles.formGroup}>
          <label>
            <input
              type="checkbox"
              checked={settings.system.debugMode}
              onChange={(e) => handleChange('system', 'debugMode', e.target.checked)}
            />
            Debug Mode
          </label>
          <p className={styles.helperText}>Enables detailed error logging</p>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'company': return renderCompanySettings();
      case 'payment': return renderPaymentSettings();
      case 'security': return renderSecuritySettings();
      case 'email': return renderEmailSettings();
      case 'system': return renderSystemSettings();
      default: return null;
    }
  };

  return (
    <div className={styles.settingsPage}>
      <div className={styles.header}>
        <h1>Settings</h1>
        <div className={styles.headerActions}>
          <button className={styles.resetBtn} onClick={handleReset}>
            Reset to Default
          </button>
          <button 
            className={styles.saveBtn} 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {renderContent()}
      </div>
    </div>
  );
};

export default AdminSettingsPage;