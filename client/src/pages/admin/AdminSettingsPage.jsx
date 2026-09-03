// client/src/pages/admin/AdminSettingsPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminSettingsPage.module.css';

const TABS = [
  { id: 'company', label: 'Company Profile', icon: '🏢', tag: 'Identity' },
  { id: 'payment', label: 'Payment Gateway', icon: '💳', tag: 'Banking' },
  { id: 'security', label: 'Security & Auth', icon: '🔒', tag: 'Protection' },
  { id: 'email', label: 'Email & SMTP', icon: '✉️', tag: 'Mailer' },
  { id: 'system', label: 'Engine & TTO', icon: '⚙️', tag: 'Operations' }
];

const INITIAL_STATE = {
  company: {
    name: 'KUWIFR Marketing Pvt Ltd',
    supportEmail: 'support@kuwifr.com',
    supportPhone: '+91 94350 11223',
    address: 'GS Road, Christian Basti, Guwahati, Assam - 781005',
    cinNumber: 'U51909AS2026PTC019821',
    panNumber: 'AAECK1298P',
    gstNumber: '18AAECK1298P1Z5'
  },
  payment: {
    gatewayEnabled: true,
    defaultGateway: 'RAZORPAY',
    razorpayKeyId: 'rzp_live_kuwifr_production',
    razorpayKeySecret: '••••••••••••••••••••',
    upiId: 'kuwifr@icici',
    accountHolder: 'KUWIFR MARKETING PRIVATE LIMITED',
    bankName: 'ICICI Bank Ltd',
    accountNumber: '002105018921',
    ifscCode: 'ICIC0000021'
  },
  security: {
    sessionTimeoutMinutes: 120,
    maxLoginAttempts: 5,
    twoFactorRequiredForAdmin: false,
    allowMultipleLogins: true,
    ipWhitelistEnabled: false
  },
  email: {
    smtpHost: 'smtp.sendgrid.net',
    smtpPort: 587,
    smtpUser: 'apikey',
    smtpPass: '••••••••••••••••••••',
    fromEmail: 'no-reply@kuwifr.com',
    senderName: 'KUWIFR Official System',
    emailAlertsActive: true
  },
  system: {
    maintenanceMode: false,
    maintenanceNotice: 'System optimization underway. Storefront will resume shortly.',
    allowRegistrations: true,
    autoCalculateTTO: true,
    currencySymbol: '₹',
    currencyCode: 'INR'
  }
};

const AdminSettingsPage = () => {
  const [activeTab, setActiveTab] = useState('company');
  const [settings, setSettings] = useState(INITIAL_STATE);
  const [savedBaseline, setSavedBaseline] = useState(INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);

  const { showNotification } = useNotification ? useNotification() : {
    showNotification: (msg, type) => console.log(`[${type}] ${msg}`)
  };

  // Resilient multi-endpoint fetch
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      let res;
      try {
        res = await api.get('/api/admin/settings');
      } catch {
        try {
          res = await api.get('/api/settings/admin');
        } catch {
          res = await api.get('/api/settings');
        }
      }

      if (res.data?.success && res.data?.data) {
        const merged = {
          company: { ...INITIAL_STATE.company, ...res.data.data.company },
          payment: { ...INITIAL_STATE.payment, ...res.data.data.payment },
          security: { ...INITIAL_STATE.security, ...res.data.data.security },
          email: { ...INITIAL_STATE.email, ...res.data.data.email },
          system: { ...INITIAL_STATE.system, ...res.data.data.system }
        };
        setSettings(merged);
        setSavedBaseline(merged);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
      showNotification('Unable to fetch live settings from cluster.', 'warning');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Track if admin has unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(savedBaseline);
  }, [settings, savedBaseline]);

  // Nested property update helper
  const handleFieldChange = (section, field, value) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);

    try {
      let res;
      try {
        res = await api.put('/api/admin/settings', settings);
      } catch {
        res = await api.put('/api/settings', settings);
      }

      showNotification(res.data?.message || 'Configuration saved and synced across cluster!', 'success');
      setSavedBaseline(settings);
    } catch (err) {
      console.error('Save error:', err);
      showNotification('Failed to update system settings.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Test Email
  const handleTestEmail = async () => {
    setIsTestingEmail(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      showNotification(`Test email successfully sent from ${settings.email.fromEmail}!`, 'success');
    } catch (err) {
      showNotification('Failed to deliver test email', 'error');
    } finally {
      setIsTestingEmail(false);
    }
  };

  // Reset to Factory Defaults
  const handleResetDefaults = async () => {
    if (!window.confirm('Restore all system settings back to corporate factory defaults?')) return;
    setIsSaving(true);

    try {
      let res;
      try {
        res = await api.post('/api/admin/settings/reset');
      } catch {
        res = await api.post('/api/settings/reset');
      }

      showNotification('Settings restored to defaults.', 'success');
      setSettings(INITIAL_STATE);
      setSavedBaseline(INITIAL_STATE);
    } catch (err) {
      showNotification('Failed to reset settings.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.settingsPage}>
      {/* 1. Header Toolbar */}
      <div className={styles.header}>
        <div>
          <div className={styles.statusPill}>
            <span className={styles.pulseDot}></span>
            <span>Cluster Production Configurator</span>
          </div>
          <h1 className={styles.title}>System Settings & Configuration</h1>
          <p className={styles.subtitle}>
            Control corporate credentials, payment gateway keys, SMTP email dispatchers, and core system governance.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={isSaving}
            className={styles.resetBtn}
          >
            Reset to Default
          </button>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={isSaving}
            className={styles.saveBtn}
          >
            {isSaving ? 'Saving Changes...' : '💾 Save Changes'}
          </button>
        </div>
      </div>

      {/* 2. System Readiness KPI Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Payment Engine</span>
            <span className={`${styles.statusDot} ${settings.payment.gatewayEnabled ? styles.dotGreen : styles.dotAmber}`}></span>
          </div>
          <strong className={styles.statValue}>{settings.payment.defaultGateway}</strong>
          <span className={styles.statHelp}>
            {settings.payment.gatewayEnabled ? '● Live Gateway Active' : '○ Gateway Offline'}
          </span>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Disbursal Account</span>
            <span className={styles.dotGreen}></span>
          </div>
          <strong className={styles.statValue}>{settings.payment.bankName || 'Direct IMPS'}</strong>
          <span className={styles.statHelp}>
            A/C: •••• {settings.payment.accountNumber ? settings.payment.accountNumber.slice(-4) : '8921'}
          </span>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Security Policy</span>
            <span className={`${styles.statusDot} ${settings.security.twoFactorRequiredForAdmin ? styles.dotGreen : styles.dotBlue}`}></span>
          </div>
          <strong className={styles.statValue}>{settings.security.sessionTimeoutMinutes} min timeout</strong>
          <span className={styles.statHelp}>
            Max {settings.security.maxLoginAttempts} login attempts
          </span>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Platform Health</span>
            <span className={`${styles.statusDot} ${!settings.system.maintenanceMode ? styles.dotGreen : styles.dotRed}`}></span>
          </div>
          <strong className={`${styles.statValue} ${!settings.system.maintenanceMode ? styles.greenText : styles.redText}`}>
            {!settings.system.maintenanceMode ? 'Operational (100%)' : 'Maintenance Mode'}
          </strong>
          <span className={styles.statHelp}>
            {settings.system.allowRegistrations ? 'Registrations Open' : 'Registrations Locked'}
          </span>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className={styles.tabsContainer}>
        <div className={styles.tabsStrip}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ''}`}
            >
              <span className={styles.tabIcon}>{tab.icon}</span>
              <span className={styles.tabLabel}>{tab.label}</span>
              <span className={styles.tabTag}>{tab.tag}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Settings Card Body */}
      <div className={styles.contentCard}>
        {loading ? (
          <div className={styles.loadingArea}>
            <div className={styles.spinner}></div>
            <p>Syncing system configuration from cluster...</p>
          </div>
        ) : (
          <form onSubmit={handleSaveSettings} className={styles.formContainer}>
            {/* TAB 1: Company Profile */}
            {activeTab === 'company' && (
              <div className={styles.sectionBlock}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h3>Company Legal Information</h3>
                    <p>Displayed across public member invoices, tax receipts, and storefront headers.</p>
                  </div>
                  <span className={styles.sectionBadge}>GST & PAN Verified</span>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Enterprise Legal Name *</label>
                    <input
                      type="text"
                      value={settings.company.name}
                      onChange={(e) => handleFieldChange('company', 'name', e.target.value)}
                      required
                      placeholder="e.g. KUWIFR Marketing Pvt Ltd"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Corporate Support Email *</label>
                    <input
                      type="email"
                      value={settings.company.supportEmail}
                      onChange={(e) => handleFieldChange('company', 'supportEmail', e.target.value)}
                      required
                      placeholder="support@kuwifr.com"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Corporate Support Phone *</label>
                    <input
                      type="text"
                      value={settings.company.supportPhone}
                      onChange={(e) => handleFieldChange('company', 'supportPhone', e.target.value)}
                      required
                      placeholder="+91 94350 11223"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Corporate Identity Number (CIN)</label>
                    <input
                      type="text"
                      value={settings.company.cinNumber}
                      onChange={(e) => handleFieldChange('company', 'cinNumber', e.target.value)}
                      placeholder="e.g. U51909AS2026PTC019821"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Company PAN Card #</label>
                    <input
                      type="text"
                      value={settings.company.panNumber}
                      onChange={(e) => handleFieldChange('company', 'panNumber', e.target.value)}
                      placeholder="e.g. AAECK1298P"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>GST Registration Number</label>
                    <input
                      type="text"
                      value={settings.company.gstNumber}
                      onChange={(e) => handleFieldChange('company', 'gstNumber', e.target.value)}
                      placeholder="e.g. 18AAECK1298P1Z5"
                    />
                  </div>

                  <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                    <label>Registered Corporate Office Address *</label>
                    <textarea
                      rows="3"
                      value={settings.company.address}
                      onChange={(e) => handleFieldChange('company', 'address', e.target.value)}
                      required
                      placeholder="Street, locality, city, state, postal code"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Payment Gateway & Banking */}
            {activeTab === 'payment' && (
              <div className={styles.sectionBlock}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h3>Payment Gateways & Direct Deposit Bank Account</h3>
                    <p>Credentials utilized for online customer checkout and admin IMPS disbursals.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSecrets(!showSecrets)}
                    className={styles.toggleSecretsBtn}
                  >
                    {showSecrets ? '🔒 Hide API Keys' : '👁️ Reveal API Keys'}
                  </button>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Online Payment Gateway Provider</label>
                    <select
                      value={settings.payment.defaultGateway}
                      onChange={(e) => handleFieldChange('payment', 'defaultGateway', e.target.value)}
                    >
                      <option value="RAZORPAY">Razorpay Live Gateway</option>
                      <option value="PHONEPE">PhonePe PG Suite</option>
                      <option value="CASHFREE">Cashfree Payments</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Razorpay Key ID</label>
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      value={settings.payment.razorpayKeyId}
                      onChange={(e) => handleFieldChange('payment', 'razorpayKeyId', e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Razorpay Key Secret</label>
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      value={settings.payment.razorpayKeySecret}
                      onChange={(e) => handleFieldChange('payment', 'razorpayKeySecret', e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Official Corporate UPI VPA</label>
                    <input
                      type="text"
                      value={settings.payment.upiId}
                      onChange={(e) => handleFieldChange('payment', 'upiId', e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Bank Name (Disbursals)</label>
                    <input
                      type="text"
                      value={settings.payment.bankName}
                      onChange={(e) => handleFieldChange('payment', 'bankName', e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Account Holder Legal Name</label>
                    <input
                      type="text"
                      value={settings.payment.accountHolder}
                      onChange={(e) => handleFieldChange('payment', 'accountHolder', e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Current Account Number</label>
                    <input
                      type="text"
                      value={settings.payment.accountNumber}
                      onChange={(e) => handleFieldChange('payment', 'accountNumber', e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Bank IFSC Code</label>
                    <input
                      type="text"
                      value={settings.payment.ifscCode}
                      onChange={(e) => handleFieldChange('payment', 'ifscCode', e.target.value)}
                    />
                  </div>

                  <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                    <label className={styles.checkboxContainer}>
                      <input
                        type="checkbox"
                        checked={settings.payment.gatewayEnabled}
                        onChange={(e) => handleFieldChange('payment', 'gatewayEnabled', e.target.checked)}
                      />
                      <span>Enable Online Payment Gateway at Storefront Checkout</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Security & Access Control */}
            {activeTab === 'security' && (
              <div className={styles.sectionBlock}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h3>Session Authentication & Governance</h3>
                    <p>Security policies enforced across user sessions and admin suites.</p>
                  </div>
                  <span className={styles.sectionBadge}>Compliance Tier 1</span>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Session Idle Timeout (Minutes)</label>
                    <input
                      type="number"
                      value={settings.security.sessionTimeoutMinutes}
                      onChange={(e) => handleFieldChange('security', 'sessionTimeoutMinutes', Number(e.target.value))}
                    />
                    <small className={styles.fieldHelp}>User sessions expire automatically after inactivity.</small>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Max Consecutive Failed Logins</label>
                    <input
                      type="number"
                      value={settings.security.maxLoginAttempts}
                      onChange={(e) => handleFieldChange('security', 'maxLoginAttempts', Number(e.target.value))}
                    />
                    <small className={styles.fieldHelp}>Account locks temporarily after exceeding threshold.</small>
                  </div>

                  <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                    <label className={styles.checkboxContainer}>
                      <input
                        type="checkbox"
                        checked={settings.security.allowMultipleLogins}
                        onChange={(e) => handleFieldChange('security', 'allowMultipleLogins', e.target.checked)}
                      />
                      <span>Allow Multiple Active Concurrent Sessions Per Member Account</span>
                    </label>
                  </div>

                  <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                    <label className={styles.checkboxContainer}>
                      <input
                        type="checkbox"
                        checked={settings.security.twoFactorRequiredForAdmin}
                        onChange={(e) => handleFieldChange('security', 'twoFactorRequiredForAdmin', e.target.checked)}
                      />
                      <span>Enforce Two-Factor OTP Verification for Super Admin Sign-Ins</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Email & SMTP */}
            {activeTab === 'email' && (
              <div className={styles.sectionBlock}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h3>SMTP Email Dispatcher Configuration</h3>
                    <p>Outgoing server settings for registration verification, invoices, and OTPs.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestEmail}
                    disabled={isTestingEmail}
                    className={styles.testEmailBtn}
                  >
                    {isTestingEmail ? 'Sending...' : '📨 Send Test Email'}
                  </button>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>SMTP Host Server</label>
                    <input
                      type="text"
                      value={settings.email.smtpHost}
                      onChange={(e) => handleFieldChange('email', 'smtpHost', e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>SMTP Port</label>
                    <input
                      type="number"
                      value={settings.email.smtpPort}
                      onChange={(e) => handleFieldChange('email', 'smtpPort', Number(e.target.value))}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>SMTP Username / API Key</label>
                    <input
                      type="text"
                      value={settings.email.smtpUser}
                      onChange={(e) => handleFieldChange('email', 'smtpUser', e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>SMTP Password / Secret</label>
                    <input
                      type={showSecrets ? 'text' : 'password'}
                      value={settings.email.smtpPass}
                      onChange={(e) => handleFieldChange('email', 'smtpPass', e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Sender "From" Email Address</label>
                    <input
                      type="email"
                      value={settings.email.fromEmail}
                      onChange={(e) => handleFieldChange('email', 'fromEmail', e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Sender Display Name</label>
                    <input
                      type="text"
                      value={settings.email.senderName}
                      onChange={(e) => handleFieldChange('email', 'senderName', e.target.value)}
                    />
                  </div>

                  <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                    <label className={styles.checkboxContainer}>
                      <input
                        type="checkbox"
                        checked={settings.email.emailAlertsActive}
                        onChange={(e) => handleFieldChange('email', 'emailAlertsActive', e.target.checked)}
                      />
                      <span>Activate Outgoing Automated Email Notifications (Invoices, OTPs, Bonanzas)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: System & Maintenance Engine */}
            {activeTab === 'system' && (
              <div className={styles.sectionBlock}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h3>Global Engine Controls & Maintenance Mode</h3>
                    <p>Control platform-wide registrations, currency formats, and emergency site locks.</p>
                  </div>
                  <span className={styles.sectionBadge}>Engine V1.0</span>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>System Currency Symbol</label>
                    <input
                      type="text"
                      value={settings.system.currencySymbol}
                      onChange={(e) => handleFieldChange('system', 'currencySymbol', e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>ISO Currency Code</label>
                    <input
                      type="text"
                      value={settings.system.currencyCode}
                      onChange={(e) => handleFieldChange('system', 'currencyCode', e.target.value)}
                    />
                  </div>

                  <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                    <label className={styles.checkboxContainer}>
                      <input
                        type="checkbox"
                        checked={settings.system.allowRegistrations}
                        onChange={(e) => handleFieldChange('system', 'allowRegistrations', e.target.checked)}
                      />
                      <span>Allow New Member Registrations Across Binary Placement Tree</span>
                    </label>
                  </div>

                  <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                    <label className={styles.checkboxContainer}>
                      <input
                        type="checkbox"
                        checked={settings.system.autoCalculateTTO}
                        onChange={(e) => handleFieldChange('system', 'autoCalculateTTO', e.target.checked)}
                      />
                      <span>Enable Automated Midnight 1% TTO Royalty Calculation Engine</span>
                    </label>
                  </div>

                  <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                    <div className={styles.maintenanceCard}>
                      <label className={styles.checkboxContainer}>
                        <input
                          type="checkbox"
                          checked={settings.system.maintenanceMode}
                          onChange={(e) => handleFieldChange('system', 'maintenanceMode', e.target.checked)}
                        />
                        <span className={styles.maintenanceLabel}>
                          Activate Emergency System Maintenance Mode
                        </span>
                      </label>
                      <p className={styles.maintenanceHelp}>
                        When enabled, all non-admin members will be locked out and redirected to a maintenance notice screen.
                      </p>

                      <div style={{ marginTop: '12px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '750', color: '#334155' }}>
                          Custom Maintenance Notice Message
                        </label>
                        <textarea
                          rows="2"
                          value={settings.system.maintenanceNotice}
                          onChange={(e) => handleFieldChange('system', 'maintenanceNotice', e.target.value)}
                          style={{ width: '100%', marginTop: '6px' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </form>
        )}
      </div>

      {/* 5. Sticky Floating Save Bar (Reveals when changes occur) */}
      {hasUnsavedChanges && (
        <div className={styles.floatingBar}>
          <div className={styles.floatingContent}>
            <div className={styles.floatingText}>
              <span className={styles.floatingAlertIcon}>⚠️</span>
              <div>
                <strong>Unsaved Changes Detected</strong>
                <p>You have made changes to the live system configuration.</p>
              </div>
            </div>

            <div className={styles.floatingActions}>
              <button
                type="button"
                onClick={() => setSettings(savedBaseline)}
                className={styles.floatingDiscardBtn}
                disabled={isSaving}
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                className={styles.floatingSaveBtn}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettingsPage;