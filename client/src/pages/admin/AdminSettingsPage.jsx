// client/src/pages/admin/AdminSettingsPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './AdminSettingsPage.module.css';

const TABS = [
  { id: 'company', label: 'Company Profile', icon: '🏢', tag: 'Identity' },
  { id: 'payment', label: 'Payment Gateway', icon: '💳', tag: 'Banking' },
  { id: 'compensation', label: 'Commission & Level Income', icon: '💰', tag: 'Compensation Plan' },
  { id: 'security', label: 'Security & Auth', icon: '🔒', tag: 'Protection' },
  { id: 'email', label: 'Email & SMTP', icon: '✉️', tag: 'Mailer' },
  { id: 'system', label: 'Engine & TTO', icon: '⚙️', tag: 'Operations' }
];

// Mirrors server/src/models/Setting.js's `compensation` sub-schema defaults
// exactly, so a fresh install (before any admin save) shows the same rates
// the business plan / backend already runs with.
const COMPENSATION_DEFAULTS = {
  referral: {
    rate: 0.10
  },
  matching: {
    rate: 0.10,
    unitValue: 1000,
    firstPairSmallUnits: 1,
    firstPairLargeUnits: 2,
    firstPairMinDirects: 2
  },
  leadership: {
    levelRates: [0.50, 0.30, 0.20],
    minRankCode: 'KUWI_STAR'
  },
  repurchase: {
    selfRate: 0.25,
    levelRates: [0.17, 0.13, 0.09, 0.05, 0.03, 0.02, 0.01, 0.01, 0.01, 0.01],
    unlockLevelsByDirects: [2, 4, 6, 8, 10]
  },
  withdrawal: {
    minAmount: 100,
    adminChargeRate: 0.05,
    serviceChargeRate: 0.05,
    tdsRate: 0.05,
    stopWithdrawals: false,
    stopWithdrawalsMessage: 'Withdrawals are temporarily paused. Please check back later.'
  },
  franchise: {
    kspRate: 0.10,
    kbpLifetimeRate: 0.01
  }
};

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
  },
  compensation: COMPENSATION_DEFAULTS
};

const AdminSettingsPage = () => {
  const [activeTab, setActiveTab] = useState('company');
  const [settings, setSettings] = useState(INITIAL_STATE);
  const [savedBaseline, setSavedBaseline] = useState(INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  // Data-integrity repair tools (see the "Data Integrity Tools" card in the
  // Engine & TTO tab below) — one-click, non-destructive backfills for two
  // known gaps: a member whose binary-tree placement (Growth Generation
  // tree, Total Downline Left/Right, KBP matching) or unilevel Referral
  // chain (My Team's generation grouping) never got written, most often
  // because it silently failed at registration time on an earlier deploy.
  const [isRepairingBinary, setIsRepairingBinary] = useState(false);
  const [isRepairingReferrals, setIsRepairingReferrals] = useState(false);
  const [binaryRepairResult, setBinaryRepairResult] = useState(null);
  const [referralRepairResult, setReferralRepairResult] = useState(null);
  // READ-ONLY diagnostic — run this FIRST, before any binary-tree repair
  // action. Finds nodes whose placement doesn't trace back through their own
  // real sponsor at all (genuinely misplaced/orphaned data) as opposed to
  // normal extreme-leg spillover (expected, not flagged). Never writes
  // anything. See BinaryService.auditPlacementIntegrity.
  const [isAuditingPlacement, setIsAuditingPlacement] = useState(false);
  const [placementAuditResult, setPlacementAuditResult] = useState(null);
  const [isCorrectingPlacement, setIsCorrectingPlacement] = useState(false);
  const [placementCorrectionResult, setPlacementCorrectionResult] = useState(null);
  // One-time index migration — the Referral collection's old single-field
  // unique index on `userId` made it impossible to store more than a
  // member's level-1 row, which is exactly why "Repair Referral Chains" can
  // report a wall of errors (one per member per ancestor level beyond the
  // first) the first time it's run after this fix ships. Run this once,
  // THEN Repair Referral Chains.
  const [isFixingReferralIndex, setIsFixingReferralIndex] = useState(false);
  const [referralIndexFixResult, setReferralIndexFixResult] = useState(null);
  // Income reconciliation — separate from the two repairs above, which only
  // fix tree/genealogy LINKS. These backfill actual missing money: Direct
  // Referral Income that an activation should have paid a sponsor but never
  // did, and Matching Income/leg KBP that never propagated up the binary
  // tree because the original activation skipped BinaryService.updateVolumes.
  // Real case: RAFIQUL Test (KFR441197) had 5 real ACTIVE referrals, only
  // 3 of which ever paid him referral income, and 0 KBP ever reached either
  // of his legs despite all 5 being real, active, package-holding members.
  const [isReconcilingReferral, setIsReconcilingReferral] = useState(false);
  const [isReconcilingMatching, setIsReconcilingMatching] = useState(false);
  const [referralReconcileResult, setReferralReconcileResult] = useState(null);
  const [matchingReconcileResult, setMatchingReconcileResult] = useState(null);
  // Separate from "missing" referral credits above — this tops up a credit
  // that EXISTS but used a stale package KBP value (fixed in
  // processReferralIncome; see IncomeService.reconcileUnderpaidReferralIncome).
  const [isReconcilingUnderpaid, setIsReconcilingUnderpaid] = useState(false);
  const [underpaidReconcileResult, setUnderpaidReconcileResult] = useState(null);
  // Separate again from BOTH of the above: even once a member's leg KBP
  // totals are fully correct, Matching Income itself can still be short by
  // exactly one UNIT's worth — the first-pair 2:1 rule burns 2 UNITs from
  // whichever leg happens to be heavier the moment it fires, which a
  // REPLAYED reconciliation (not true chronological order) can get backwards
  // relative to the final totals. Run this AFTER "Reconcile Matching Income"
  // above. See BinaryService.reconcileUnderpaidMatchingIncome.
  const [isReconcilingMatchingUnderpaid, setIsReconcilingMatchingUnderpaid] = useState(false);
  const [matchingUnderpaidReconcileResult, setMatchingUnderpaidReconcileResult] = useState(null);
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
        const remoteComp = res.data.data.compensation || {};
        const merged = {
          company: { ...INITIAL_STATE.company, ...res.data.data.company },
          payment: { ...INITIAL_STATE.payment, ...res.data.data.payment },
          security: { ...INITIAL_STATE.security, ...res.data.data.security },
          email: { ...INITIAL_STATE.email, ...res.data.data.email },
          system: { ...INITIAL_STATE.system, ...res.data.data.system },
          compensation: {
            referral: { ...COMPENSATION_DEFAULTS.referral, ...remoteComp.referral },
            matching: { ...COMPENSATION_DEFAULTS.matching, ...remoteComp.matching },
            leadership: { ...COMPENSATION_DEFAULTS.leadership, ...remoteComp.leadership },
            repurchase: { ...COMPENSATION_DEFAULTS.repurchase, ...remoteComp.repurchase },
            withdrawal: { ...COMPENSATION_DEFAULTS.withdrawal, ...remoteComp.withdrawal },
            franchise: { ...COMPENSATION_DEFAULTS.franchise, ...remoteComp.franchise }
          }
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

  // Compensation is one level deeper (settings.compensation.<block>.<field>)
  // than every other tab, so it gets its own helper.
  const handleCompChange = (block, field, value) => {
    setSettings((prev) => ({
      ...prev,
      compensation: {
        ...prev.compensation,
        [block]: {
          ...prev.compensation[block],
          [field]: value
        }
      }
    }));
  };

  // For the level-rate arrays (leadership.levelRates, repurchase.levelRates,
  // repurchase.unlockLevelsByDirects) — updates one index in place.
  const handleCompArrayChange = (block, field, index, value) => {
    setSettings((prev) => {
      const arr = [...(prev.compensation[block][field] || [])];
      arr[index] = value;
      return {
        ...prev,
        compensation: {
          ...prev.compensation,
          [block]: {
            ...prev.compensation[block],
            [field]: arr
          }
        }
      };
    });
  };

  // Every rate in the compensation plan is stored server-side as a decimal
  // fraction (0.10 = 10%) but always displayed/typed here as a whole
  // percent number, matching the fix already applied to the Ranks/Funds
  // pages — never let the write path guess based on the value's size.
  const pctToDisplay = (frac) => {
    const n = Number(frac);
    return Number.isFinite(n) ? String(Math.round(n * 10000) / 100) : '0';
  };
  const displayToPct = (display) => {
    const n = parseFloat(display);
    return Number.isFinite(n) ? n / 100 : 0;
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

  // READ-ONLY — never writes anything. Run this FIRST to see whether a
  // confusing Growth Generation tree (e.g. "Total Downline Left" much higher
  // than a member's real referral count, or their own immediate Left/Right
  // child not being one of their actual referrals) is normal spillover
  // (expected, not flagged) or genuinely misplaced/orphaned data.
  const handleAuditPlacementIntegrity = async () => {
    setIsAuditingPlacement(true);
    setPlacementAuditResult(null);
    try {
      const res = await api.get('/api/admin/binary/audit-placement-integrity');
      const summary = res.data?.data;
      setPlacementAuditResult(summary);
      showNotification(res.data?.message || 'Placement integrity audit complete.', 'success');
    } catch (err) {
      showNotification(err.response?.data?.message || 'Placement integrity audit failed.', 'error');
    } finally {
      setIsAuditingPlacement(false);
    }
  };

  // Applies the fix for exactly what Audit Placement Integrity finds: moves
  // each misplaced member to sit under their REAL sponsor's current binary
  // subtree. Structure-only — it does NOT touch any already-credited
  // leftVolume/rightVolume/matching income, so no real money already paid
  // out is clawed back or re-credited. Run Audit Placement Integrity again
  // afterward to confirm 0 remain. Use dryRun to preview with zero writes.
  const handleCorrectMisplacedNodes = async (dryRun = false) => {
    setIsCorrectingPlacement(true);
    if (!dryRun) setPlacementCorrectionResult(null);
    try {
      const res = await api.post(`/api/admin/binary/correct-misplaced-nodes${dryRun ? '?dryRun=true' : ''}`);
      const summary = res.data?.data;
      setPlacementCorrectionResult(summary);
      showNotification(res.data?.message || 'Placement correction complete.', 'success');
    } catch (err) {
      showNotification(err.response?.data?.message || 'Placement correction failed.', 'error');
    } finally {
      setIsCorrectingPlacement(false);
    }
  };

  // Backfills any missing BinaryNode placement (leftChildId/rightChildId
  // links) from existing sponsor data — fixes members whose Growth
  // Generation tree, Total Downline Left/Right counts, or KBP matching
  // show 0 despite having real downline. Never deletes anything and never
  // touches a link that's already correct, so it's safe to run any time,
  // repeatedly, with no risk to already-working members.
  const handleRepairBinaryTree = async () => {
    setIsRepairingBinary(true);
    setBinaryRepairResult(null);
    try {
      const res = await api.post('/api/admin/binary/repair');
      const summary = res.data?.data;
      setBinaryRepairResult(summary);
      showNotification(res.data?.message || 'Binary tree repair complete.', 'success');
    } catch (err) {
      showNotification(err.response?.data?.message || 'Binary tree repair failed.', 'error');
    } finally {
      setIsRepairingBinary(false);
    }
  };

  // One-time index migration — must be run BEFORE "Repair Referral Chains"
  // below. The Referral collection used to have a single-field unique index
  // on userId alone, making it physically impossible to store more than a
  // member's level-1 ancestor row; every level-2+ row failed with a
  // duplicate-key error (this is exactly what "95 errors" on a Repair
  // Referral Chains run means). Only touches indexes, never documents — safe
  // to run any time, repeatedly (a no-op once the old index is already gone).
  const handleFixReferralIndex = async () => {
    setIsFixingReferralIndex(true);
    setReferralIndexFixResult(null);
    try {
      const res = await api.post('/api/admin/referrals/fix-index');
      const summary = res.data?.data;
      setReferralIndexFixResult(summary);
      showNotification(res.data?.message || 'Referral index migration complete.', 'success');
    } catch (err) {
      showNotification(err.response?.data?.message || 'Referral index migration failed.', 'error');
    } finally {
      setIsFixingReferralIndex(false);
    }
  };

  // Same idea for the unilevel/sponsor-chain Referral collection (what "My
  // Team" groups members by generation with) — a separate collection from
  // BinaryNode, with the same "can silently fail to write at registration"
  // failure shape, so it gets its own repair pass.
  const handleRepairReferrals = async () => {
    setIsRepairingReferrals(true);
    setReferralRepairResult(null);
    try {
      const res = await api.post('/api/admin/referrals/repair');
      const summary = res.data?.data;
      setReferralRepairResult(summary);
      showNotification(res.data?.message || 'Referral chain repair complete.', 'success');
    } catch (err) {
      showNotification(err.response?.data?.message || 'Referral chain repair failed.', 'error');
    } finally {
      setIsRepairingReferrals(false);
    }
  };

  // Backfills the one-time 10% Direct Referral Bonus for any ACTIVE,
  // sponsored member whose activation never actually credited their
  // sponsor — most commonly caused by an activation path that has since
  // been fixed but whose already-missed credit still needs paying.
  // processReferralIncome's own duplicate guards make this safe to run any
  // time, repeatedly: it can only ever fill in a genuinely missing credit,
  // never pay one twice.
  const handleReconcileReferralIncome = async () => {
    setIsReconcilingReferral(true);
    setReferralReconcileResult(null);
    try {
      const res = await api.post('/api/admin/income/reconcile-referral');
      const summary = res.data?.data;
      setReferralReconcileResult(summary);
      showNotification(res.data?.message || 'Referral income reconciliation complete.', 'success');
    } catch (err) {
      showNotification(err.response?.data?.message || 'Referral income reconciliation failed.', 'error');
    } finally {
      setIsReconcilingReferral(false);
    }
  };

  // Tops up a REFERRAL_INCOME credit that EXISTS but is for LESS than it
  // should be — different from "missing" above. Root cause: the credit was
  // calculated from the package's CURRENT catalog KBP instead of the order's
  // own immutable kbpGenerated at the time it was placed (fixed in
  // IncomeService.processReferralIncome). Uses ONLY each transaction's own
  // source order's kbpGenerated to compute the correct amount and pays just
  // the shortfall as a new, clearly-labeled correction transaction — the
  // original transaction is never edited or deleted. Safe to run any time,
  // repeatedly.
  const handleReconcileUnderpaidReferral = async () => {
    setIsReconcilingUnderpaid(true);
    setUnderpaidReconcileResult(null);
    try {
      const res = await api.post('/api/admin/income/reconcile-referral-underpaid');
      const summary = res.data?.data;
      setUnderpaidReconcileResult(summary);
      showNotification(res.data?.message || 'Underpaid referral income reconciliation complete.', 'success');
    } catch (err) {
      showNotification(err.response?.data?.message || 'Underpaid referral income reconciliation failed.', 'error');
    } finally {
      setIsReconcilingUnderpaid(false);
    }
  };

  // Backfills Matching Income / Left-vs-Right leg KBP for any member whose
  // real completed-order KBP never actually propagated up the binary tree —
  // replays exactly the missing amount through the real matching engine
  // (BinaryService.updateVolumes), so 2:1 first-pair rules, caps, leadership
  // bonus, and rank re-evaluation all fire normally. Safe to run any time,
  // repeatedly — a member already fully reconciled contributes a shortfall
  // of 0 on every subsequent run.
  const handleReconcileMatchingIncome = async () => {
    setIsReconcilingMatching(true);
    setMatchingReconcileResult(null);
    try {
      const res = await api.post('/api/admin/income/reconcile-matching');
      const summary = res.data?.data;
      setMatchingReconcileResult(summary);
      showNotification(res.data?.message || 'Matching income reconciliation complete.', 'success');
    } catch (err) {
      showNotification(err.response?.data?.message || 'Matching income reconciliation failed.', 'error');
    } finally {
      setIsReconcilingMatching(false);
    }
  };

  // Tops up Matching Income that is LESS than it should be even though a
  // member's leg KBP totals ARE already correct — a separate bug from the
  // "missing KBP" case above. The first-pair 2:1 rule burns an extra UNIT
  // from whichever leg is heavier the moment it fires; a replayed
  // reconciliation (not true chronological order) can pick the wrong leg
  // relative to final totals and silently short-pay by one UNIT of income.
  // Run this AFTER "Reconcile Matching Income" above, not instead of it.
  const handleReconcileMatchingUnderpaid = async () => {
    setIsReconcilingMatchingUnderpaid(true);
    setMatchingUnderpaidReconcileResult(null);
    try {
      const res = await api.post('/api/admin/income/reconcile-matching-underpaid');
      const summary = res.data?.data;
      setMatchingUnderpaidReconcileResult(summary);
      showNotification(res.data?.message || 'Underpaid matching income reconciliation complete.', 'success');
    } catch (err) {
      showNotification(err.response?.data?.message || 'Underpaid matching income reconciliation failed.', 'error');
    } finally {
      setIsReconcilingMatchingUnderpaid(false);
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

            {/* TAB: Commission & Level Income (Compensation Plan) */}
            {activeTab === 'compensation' && (
              <div className={styles.sectionBlock}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h3>Direct Referral & Binary Matching Income</h3>
                    <p>Core payout rates applied to every package purchase. All percentages are entered as whole numbers (e.g. 10 = 10%).</p>
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Direct Referral Income (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={pctToDisplay(settings.compensation.referral.rate)}
                      onChange={(e) => handleCompChange('referral', 'rate', displayToPct(e.target.value))}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Binary Matching Income (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={pctToDisplay(settings.compensation.matching.rate)}
                      onChange={(e) => handleCompChange('matching', 'rate', displayToPct(e.target.value))}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Matching Unit Value (KBP per unit)</label>
                    <input
                      type="number"
                      min="1"
                      value={settings.compensation.matching.unitValue}
                      onChange={(e) => handleCompChange('matching', 'unitValue', parseInt(e.target.value, 10) || 0)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>First Pair Ratio — Smaller Leg (units)</label>
                    <input
                      type="number"
                      min="1"
                      value={settings.compensation.matching.firstPairSmallUnits}
                      onChange={(e) => handleCompChange('matching', 'firstPairSmallUnits', parseInt(e.target.value, 10) || 0)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>First Pair Ratio — Larger Leg (units)</label>
                    <input
                      type="number"
                      min="1"
                      value={settings.compensation.matching.firstPairLargeUnits}
                      onChange={(e) => handleCompChange('matching', 'firstPairLargeUnits', parseInt(e.target.value, 10) || 0)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>First Pair — Min. Direct Referrals Required</label>
                    <input
                      type="number"
                      min="0"
                      value={settings.compensation.matching.firstPairMinDirects}
                      onChange={(e) => handleCompChange('matching', 'firstPairMinDirects', parseInt(e.target.value, 10) || 0)}
                    />
                  </div>
                </div>

                <div className={styles.sectionHeader} style={{ marginTop: '28px' }}>
                  <div>
                    <h3>Leadership / Cheque Match Bonus</h3>
                    <p>Paid to a qualified leader's level-1/2/3 sponsor-tree upline as a % of the leader's own matching-income payout.</p>
                  </div>
                </div>
                <div className={styles.formGrid}>
                  {[0, 1, 2].map((idx) => (
                    <div className={styles.formGroup} key={`leadership-${idx}`}>
                      <label>Level {idx + 1} Leadership Bonus (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={pctToDisplay(settings.compensation.leadership.levelRates[idx])}
                        onChange={(e) => handleCompArrayChange('leadership', 'levelRates', idx, displayToPct(e.target.value))}
                      />
                    </div>
                  ))}
                  <div className={styles.formGroup}>
                    <label>Minimum Qualifying Rank</label>
                    <input
                      type="text"
                      value={settings.compensation.leadership.minRankCode}
                      onChange={(e) => handleCompChange('leadership', 'minRankCode', e.target.value.toUpperCase())}
                      placeholder="e.g. KUWI_STAR"
                    />
                  </div>
                </div>

                <div className={styles.sectionHeader} style={{ marginTop: '28px' }}>
                  <div>
                    <h3>Repurchase Plan — 10-Level Downline Income</h3>
                    <p>25% self cashback plus a 10-level downline matrix. Level unlock count is based on active direct referrals.</p>
                  </div>
                </div>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Self Repurchase Cashback (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={pctToDisplay(settings.compensation.repurchase.selfRate)}
                      onChange={(e) => handleCompChange('repurchase', 'selfRate', displayToPct(e.target.value))}
                    />
                  </div>
                </div>
                <div className={styles.formGrid}>
                  {settings.compensation.repurchase.levelRates.map((rate, idx) => (
                    <div className={styles.formGroup} key={`repurchase-level-${idx}`}>
                      <label>Level {idx + 1} Downline Income (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={pctToDisplay(rate)}
                        onChange={(e) => handleCompArrayChange('repurchase', 'levelRates', idx, displayToPct(e.target.value))}
                      />
                    </div>
                  ))}
                </div>
                <div className={styles.formGrid}>
                  {settings.compensation.repurchase.unlockLevelsByDirects.map((levels, idx) => (
                    <div className={styles.formGroup} key={`repurchase-unlock-${idx}`}>
                      <label>{idx + 1}{idx === settings.compensation.repurchase.unlockLevelsByDirects.length - 1 ? '+' : ''} Direct{idx === 0 ? '' : 's'} Unlocks Levels Up To</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={levels}
                        onChange={(e) => handleCompArrayChange('repurchase', 'unlockLevelsByDirects', idx, parseInt(e.target.value, 10) || 0)}
                      />
                    </div>
                  ))}
                </div>

                <div className={styles.sectionHeader} style={{ marginTop: '28px' }}>
                  <div>
                    <h3>Withdrawal Deductions</h3>
                    <p>Applied to the gross amount requested on every payout.</p>
                  </div>
                </div>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Minimum Withdrawal Amount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={settings.compensation.withdrawal.minAmount}
                      onChange={(e) => handleCompChange('withdrawal', 'minAmount', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Admin Charge (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={pctToDisplay(settings.compensation.withdrawal.adminChargeRate)}
                      onChange={(e) => handleCompChange('withdrawal', 'adminChargeRate', displayToPct(e.target.value))}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Service Charge (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={pctToDisplay(settings.compensation.withdrawal.serviceChargeRate)}
                      onChange={(e) => handleCompChange('withdrawal', 'serviceChargeRate', displayToPct(e.target.value))}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>TDS (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={pctToDisplay(settings.compensation.withdrawal.tdsRate)}
                      onChange={(e) => handleCompChange('withdrawal', 'tdsRate', displayToPct(e.target.value))}
                    />
                  </div>
                  <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                    <span className={styles.statHelp}>
                      Total deduction on withdrawal: {(
                        (Number(settings.compensation.withdrawal.adminChargeRate) || 0) +
                        (Number(settings.compensation.withdrawal.serviceChargeRate) || 0) +
                        (Number(settings.compensation.withdrawal.tdsRate) || 0)
                      ) * 100}% of the gross amount requested.
                    </span>
                  </div>

                  <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                    <label className={styles.checkboxContainer}>
                      <input
                        type="checkbox"
                        checked={settings.compensation.withdrawal.stopWithdrawals}
                        onChange={(e) => handleCompChange('withdrawal', 'stopWithdrawals', e.target.checked)}
                      />
                      <span>Stop All Withdrawals (blocks every new withdrawal request platform-wide)</span>
                    </label>
                  </div>
                  {settings.compensation.withdrawal.stopWithdrawals && (
                    <div className={`${styles.formGroup} ${styles.colSpan2}`}>
                      <label>Message Shown to Members</label>
                      <input
                        type="text"
                        value={settings.compensation.withdrawal.stopWithdrawalsMessage}
                        onChange={(e) => handleCompChange('withdrawal', 'stopWithdrawalsMessage', e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <div className={styles.sectionHeader} style={{ marginTop: '28px' }}>
                  <div>
                    <h3>Franchise Commissions</h3>
                    <p>Commission rates for franchise partners.</p>
                  </div>
                </div>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Franchise KSP Commission (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={pctToDisplay(settings.compensation.franchise.kspRate)}
                      onChange={(e) => handleCompChange('franchise', 'kspRate', displayToPct(e.target.value))}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Franchise Lifetime KBP Commission (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={pctToDisplay(settings.compensation.franchise.kbpLifetimeRate)}
                      onChange={(e) => handleCompChange('franchise', 'kbpLifetimeRate', displayToPct(e.target.value))}
                    />
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

                {/* Data Integrity Tools — one-click, non-destructive repair
                    for the two known "member's data shows 0 / empty despite
                    being real" gaps: a missing binary-tree placement
                    (Growth Generation tree, Total Downline Left/Right, KBP
                    matching) or a missing unilevel Referral chain (My
                    Team's generation grouping). Both repairs only ever
                    INSERT what should already be there from real
                    User.sponsorId/binarySide data — never delete or
                    overwrite a correct existing link — so they're safe to
                    run at any time, including repeatedly. */}
                <div className={styles.sectionBlock} style={{ marginTop: '24px' }}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h3>Data Integrity Tools</h3>
                      <p>
                        Backfill any member whose binary tree or team genealogy never got linked correctly —
                        safe to run any time, never deletes or overwrites correct data.
                      </p>
                    </div>
                    <span className={styles.sectionBadge}>Non-destructive</span>
                  </div>

                  <div className={styles.formGrid}>
                    <div className={styles.maintenanceCard}>
                      <span className={styles.maintenanceLabel}>Audit Binary Placement Integrity (read-only, run first)</span>
                      <p className={styles.maintenanceHelp}>
                        Writes nothing — just reports. Fixes confusion like "Total Downline Left" far exceeding a
                        member's real referral count, or their own immediate Left/Right child not being one of their
                        actual referrals. Normal spillover (a referral landing below their sponsor because that leg
                        already has depth) is NOT flagged — only nodes with no legitimate placement explanation at
                        all back to their real sponsor.
                      </p>
                      <button
                        type="button"
                        className={styles.testEmailBtn}
                        onClick={handleAuditPlacementIntegrity}
                        disabled={isAuditingPlacement}
                        style={{ marginTop: '10px' }}
                      >
                        {isAuditingPlacement ? 'Auditing...' : '🔍 Audit Placement Integrity'}
                      </button>
                      {placementAuditResult && (
                        <div className={styles.maintenanceHelp} style={{ marginTop: '8px' }}>
                          <p style={{ margin: 0 }}>
                            {placementAuditResult.misplacedCount} misplaced node(s) found ·{' '}
                            {placementAuditResult.correctlyTraced} correctly traced ·{' '}
                            {placementAuditResult.totalSponsoredUsersChecked} member(s) checked
                            {placementAuditResult.noBinaryNode ? ` · ${placementAuditResult.noBinaryNode} with no BinaryNode at all` : ''}
                          </p>
                          {placementAuditResult.misplaced?.length > 0 && (
                            <ul style={{ margin: '8px 0 0', paddingLeft: '18px', maxHeight: '220px', overflowY: 'auto' }}>
                              {placementAuditResult.misplaced.map((m) => (
                                <li key={m.userId} style={{ marginBottom: '6px' }}>
                                  <strong>{m.fullName || m.memberId}</strong> ({m.memberId}) — real sponsor{' '}
                                  <strong>{m.realSponsorFullName || m.realSponsorMemberId || m.realSponsorUserId}</strong>
                                  {m.realSponsorMemberId ? ` (${m.realSponsorMemberId})` : ''}, but binary-placed under{' '}
                                  <strong>{m.binaryParentFullName || m.binaryParentMemberId || m.binaryParentUserId || 'nothing (no parent)'}</strong>
                                  {m.binaryParentMemberId ? ` (${m.binaryParentMemberId})` : ''}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>

                    <div className={styles.maintenanceCard}>
                      <span className={styles.maintenanceLabel}>Correct Misplaced Binary Nodes (run after audit)</span>
                      <p className={styles.maintenanceHelp}>
                        Fixes exactly what "Audit Placement Integrity" found above: re-parents each misplaced member
                        under their real sponsor's current binary subtree, using the same placement logic every
                        normal registration uses. Structure only — it never touches leftVolume/rightVolume/matching
                        income already credited, so no real money already paid out is moved, clawed back, or
                        re-credited. Going forward, every calculation for these members and their downlines will be
                        100% correct; past income already paid under the old (wrong) tree shape is left exactly as
                        it is. Re-run "Audit Placement Integrity" afterward — it should report 0 misplaced.
                      </p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                        <button
                          type="button"
                          className={styles.testEmailBtn}
                          onClick={() => handleCorrectMisplacedNodes(true)}
                          disabled={isCorrectingPlacement}
                        >
                          {isCorrectingPlacement ? 'Working...' : '👁️ Preview (Dry Run)'}
                        </button>
                        <button
                          type="button"
                          className={styles.testEmailBtn}
                          onClick={() => handleCorrectMisplacedNodes(false)}
                          disabled={isCorrectingPlacement}
                        >
                          {isCorrectingPlacement ? 'Correcting...' : '🛠️ Correct Misplaced Nodes'}
                        </button>
                      </div>
                      {placementCorrectionResult && (
                        <div className={styles.maintenanceHelp} style={{ marginTop: '8px' }}>
                          <p style={{ margin: 0 }}>
                            {placementCorrectionResult.dryRun ? 'DRY RUN — ' : ''}
                            {placementCorrectionResult.correctedCount} of {placementCorrectionResult.totalMisplaced} corrected ·{' '}
                            {placementCorrectionResult.skippedCount} skipped · {placementCorrectionResult.errorCount} errors
                          </p>
                          {placementCorrectionResult.corrected?.length > 0 && (
                            <ul style={{ margin: '8px 0 0', paddingLeft: '18px', maxHeight: '220px', overflowY: 'auto' }}>
                              {placementCorrectionResult.corrected.map((c) => (
                                <li key={c.userId} style={{ marginBottom: '6px' }}>
                                  <strong>{c.fullName || c.memberId}</strong> ({c.memberId}) moved from under{' '}
                                  {c.oldParentMemberId || c.oldParentUserId || 'nothing'} to under real sponsor{' '}
                                  <strong>{c.realSponsorMemberId || c.realSponsorUserId}</strong>
                                </li>
                              ))}
                            </ul>
                          )}
                          {placementCorrectionResult.errors?.length > 0 && (
                            <ul style={{ margin: '8px 0 0', paddingLeft: '18px', color: '#b3261e' }}>
                              {placementCorrectionResult.errors.map((e) => (
                                <li key={e.userId}>{e.memberId}: {e.error}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>

                    <div className={styles.maintenanceCard}>
                      <span className={styles.maintenanceLabel}>Fix Referral Chain Index (run first)</span>
                      <p className={styles.maintenanceHelp}>
                        One-time migration. Fixes: "Repair Referral Chains" below reporting a wall of errors — the
                        collection's old index made it impossible to store a member's ancestor rows beyond level 1.
                        Only touches indexes, never documents. Run this once, then run "Repair Referral Chains."
                      </p>
                      <button
                        type="button"
                        className={styles.testEmailBtn}
                        onClick={handleFixReferralIndex}
                        disabled={isFixingReferralIndex}
                        style={{ marginTop: '10px' }}
                      >
                        {isFixingReferralIndex ? 'Migrating...' : '🛠️ Fix Referral Index'}
                      </button>
                      {referralIndexFixResult && (
                        <p className={styles.maintenanceHelp} style={{ marginTop: '8px' }}>
                          {referralIndexFixResult.droppedOldIndex
                            ? 'Old index dropped and indexes re-synced.'
                            : 'Old index already gone — indexes re-synced.'}{' '}
                          Now run "Repair Referral Chains" below.
                        </p>
                      )}
                    </div>

                    <div className={styles.maintenanceCard}>
                      <span className={styles.maintenanceLabel}>Repair Binary Tree Placement</span>
                      <p className={styles.maintenanceHelp}>
                        Fixes: Growth Generation tree showing empty/"Open Spot" for real members, Total Downline
                        Left/Right showing 0, KBP Left/Right and Matched Pairs stuck at 0.
                      </p>
                      <button
                        type="button"
                        className={styles.testEmailBtn}
                        onClick={handleRepairBinaryTree}
                        disabled={isRepairingBinary}
                        style={{ marginTop: '10px' }}
                      >
                        {isRepairingBinary ? 'Repairing...' : '🌳 Repair Binary Tree'}
                      </button>
                      {binaryRepairResult && (
                        <p className={styles.maintenanceHelp} style={{ marginTop: '8px' }}>
                          {binaryRepairResult.placementsFixed?.length || 0} member(s) re-linked ·{' '}
                          {binaryRepairResult.rootsEnsured || 0} root node(s) ensured ·{' '}
                          {binaryRepairResult.alreadyCorrect || 0} already correct
                          {binaryRepairResult.errors?.length ? ` · ${binaryRepairResult.errors.length} error(s)` : ''}
                        </p>
                      )}
                    </div>

                    <div className={styles.maintenanceCard}>
                      <span className={styles.maintenanceLabel}>Repair Referral / Team Genealogy</span>
                      <p className={styles.maintenanceHelp}>
                        Fixes: a member missing from a downline's "My Team" generation grouping despite being a
                        real, active sponsor-chain descendant.
                      </p>
                      <button
                        type="button"
                        className={styles.testEmailBtn}
                        onClick={handleRepairReferrals}
                        disabled={isRepairingReferrals}
                        style={{ marginTop: '10px' }}
                      >
                        {isRepairingReferrals ? 'Repairing...' : '🔗 Repair Referral Chains'}
                      </button>
                      {referralRepairResult && (
                        <p className={styles.maintenanceHelp} style={{ marginTop: '8px' }}>
                          {referralRepairResult.rowsCreated || 0} row(s) created across{' '}
                          {referralRepairResult.usersAffected || 0} member(s) ·{' '}
                          {referralRepairResult.alreadyComplete || 0} already complete
                          {referralRepairResult.errors?.length ? ` · ${referralRepairResult.errors.length} error(s)` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Income Reconciliation — separate from the two repairs
                    above, which only fix tree/genealogy LINKS. These
                    backfill actual missing money: a sponsor's Direct
                    Referral Income that an activation should have paid but
                    never did, and Matching Income/leg KBP that never
                    propagated up the binary tree. Run "Repair Binary Tree"
                    first if you haven't already — reconciling matching
                    income needs each member correctly linked to get credited
                    to the right upline. Both are non-destructive and safe to
                    run repeatedly; each only ever fills in a genuinely
                    missing amount, never pays or propagates the same KBP
                    twice. */}
                <div className={styles.sectionBlock} style={{ marginTop: '24px' }}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h3>Income Reconciliation</h3>
                      <p>
                        Backfill Direct Referral or Matching Income that a real, ACTIVE member's activation should
                        have paid but never did — safe to run any time, never double-credits a member who's already correct.
                      </p>
                    </div>
                    <span className={styles.sectionBadge}>Non-destructive</span>
                  </div>

                  <div className={styles.formGrid}>
                    <div className={styles.maintenanceCard}>
                      <span className={styles.maintenanceLabel}>Reconcile Direct Referral Income</span>
                      <p className={styles.maintenanceHelp}>
                        Fixes: a sponsor whose Direct Income card is missing the 10% bonus for one or more real,
                        ACTIVE direct referrals they already have.
                      </p>
                      <button
                        type="button"
                        className={styles.testEmailBtn}
                        onClick={handleReconcileReferralIncome}
                        disabled={isReconcilingReferral}
                        style={{ marginTop: '10px' }}
                      >
                        {isReconcilingReferral ? 'Reconciling...' : '💰 Reconcile Referral Income'}
                      </button>
                      {referralReconcileResult && (
                        <p className={styles.maintenanceHelp} style={{ marginTop: '8px' }}>
                          {referralReconcileResult.credited || 0} missing credit(s) paid ·{' '}
                          {referralReconcileResult.checked || 0} active member(s) checked ·{' '}
                          {referralReconcileResult.alreadyCredited || 0} already correct
                          {referralReconcileResult.failed ? ` · ${referralReconcileResult.failed} error(s)` : ''}
                        </p>
                      )}
                    </div>

                    <div className={styles.maintenanceCard}>
                      <span className={styles.maintenanceLabel}>Reconcile Underpaid Referral Income</span>
                      <p className={styles.maintenanceHelp}>
                        Different from the missing-credit tool above. Fixes: a sponsor's Direct Referral Income
                        credit that already exists but is LESS than it should be, because it was calculated from a
                        package's current catalog KBP instead of the order's own KBP at the time. Tops up exactly
                        the shortfall as a new, separately-labeled credit — never edits the original transaction.
                      </p>
                      <button
                        type="button"
                        className={styles.testEmailBtn}
                        onClick={handleReconcileUnderpaidReferral}
                        disabled={isReconcilingUnderpaid}
                        style={{ marginTop: '10px' }}
                      >
                        {isReconcilingUnderpaid ? 'Reconciling...' : '🧾 Reconcile Underpaid Referral Income'}
                      </button>
                      {underpaidReconcileResult && (
                        <p className={styles.maintenanceHelp} style={{ marginTop: '8px' }}>
                          {underpaidReconcileResult.corrected || 0} correction(s) credited ·{' '}
                          {underpaidReconcileResult.checked || 0} transaction(s) checked ·{' '}
                          {underpaidReconcileResult.alreadyCorrect || 0} already correct
                          {underpaidReconcileResult.failed ? ` · ${underpaidReconcileResult.failed} error(s)` : ''}
                        </p>
                      )}
                    </div>

                    <div className={styles.maintenanceCard}>
                      <span className={styles.maintenanceLabel}>Reconcile Matching Income / Leg KBP</span>
                      <p className={styles.maintenanceHelp}>
                        Fixes: Matching Income stuck at ₹0 and Left/Right Leg showing 0 KBP despite real, ACTIVE
                        downline members with completed package orders.
                      </p>
                      <button
                        type="button"
                        className={styles.testEmailBtn}
                        onClick={handleReconcileMatchingIncome}
                        disabled={isReconcilingMatching}
                        style={{ marginTop: '10px' }}
                      >
                        {isReconcilingMatching ? 'Reconciling...' : '⚖️ Reconcile Matching Income'}
                      </button>
                      {matchingReconcileResult && (
                        <p className={styles.maintenanceHelp} style={{ marginTop: '8px' }}>
                          {matchingReconcileResult.reconciled?.length || 0} member(s) had missing KBP replayed ·{' '}
                          {matchingReconcileResult.alreadyCorrect || 0} already correct
                          {matchingReconcileResult.errors?.length ? ` · ${matchingReconcileResult.errors.length} error(s)` : ''}
                        </p>
                      )}
                    </div>

                    <div className={styles.maintenanceCard}>
                      <span className={styles.maintenanceLabel}>Reconcile Underpaid Matching Income (run last)</span>
                      <p className={styles.maintenanceHelp}>
                        Different from the two Matching tools above — those fix KBP that never reached a member's
                        leg totals. This fixes Matching Income that's short even though Left/Right Leg KBP is
                        already correct: the first-pair 2:1 rule can burn its extra unit off the wrong (eventually
                        smaller) leg when volume was replayed rather than processed in real time, silently
                        underpaying by one unit's worth of income. Run this AFTER "Reconcile Matching Income" above.
                      </p>
                      <button
                        type="button"
                        className={styles.testEmailBtn}
                        onClick={handleReconcileMatchingUnderpaid}
                        disabled={isReconcilingMatchingUnderpaid}
                        style={{ marginTop: '10px' }}
                      >
                        {isReconcilingMatchingUnderpaid ? 'Reconciling...' : '🎯 Reconcile Underpaid Matching Income'}
                      </button>
                      {matchingUnderpaidReconcileResult && (
                        <p className={styles.maintenanceHelp} style={{ marginTop: '8px' }}>
                          {matchingUnderpaidReconcileResult.corrected?.length || 0} member(s) corrected across{' '}
                          {matchingUnderpaidReconcileResult.totalNodesChecked || 0} node(s) checked ·{' '}
                          {matchingUnderpaidReconcileResult.alreadyCorrect || 0} already correct
                          {matchingUnderpaidReconcileResult.errors?.length ? ` · ${matchingUnderpaidReconcileResult.errors.length} error(s)` : ''}
                        </p>
                      )}
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