// client/src/pages/member/WithdrawalsPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../hooks/useNotification';
import styles from './WithdrawalsPage.module.css';

// Status pill color mapping — same token set used across every other
// redesigned member page (TeamPage/DashboardPage/OrdersPage): amber =
// pending, teal = approved, green = processed/disbursed, red = rejected,
// grey = cancelled/refunded.
const STATUS_STYLES = {
  PENDING: { color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
  APPROVED: { color: '#008080', bg: 'rgba(0,128,128,0.12)' },
  PROCESSED: { color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
  REJECTED: { color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
  CANCELLED: { color: '#737373', bg: 'rgba(115,115,115,0.12)' },
  REFUNDED: { color: '#737373', bg: 'rgba(115,115,115,0.12)' }
};

const statusMeta = (status) => {
  const upper = (status || 'PENDING').toUpperCase();
  const style = STATUS_STYLES[upper] || STATUS_STYLES.PENDING;
  const label =
    upper === 'PROCESSED'
      ? '● Disbursed'
      : upper === 'APPROVED'
      ? '● Approved'
      : upper === 'REJECTED'
      ? '✕ Rejected'
      : upper === 'CANCELLED'
      ? '● Cancelled'
      : upper === 'REFUNDED'
      ? '● Refunded'
      : '⏳ Pending Admin Audit';
  return { ...style, label };
};

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const WithdrawalsPage = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const [availableBalance, setAvailableBalance] = useState(0);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Live, admin-configurable withdrawal rules (Admin Settings > Commission &
  // Withdrawal Setup) — previously hardcoded here (500 / 5% / 5%) while the
  // backend read these dynamically, so an admin changing them had no effect
  // on what the member actually saw or could submit. Defaults below match
  // the business rule and only apply until the real settings load.
  const [withdrawalConfig, setWithdrawalConfig] = useState({ minAmount: 500, adminChargeRate: 0.05, tdsRate: 0.05 });

  // Form state initialized to minimum ₹500
  const [amount, setAmount] = useState('500');
  const [formData, setFormData] = useState({
    accountHolderName: '',
    accountNumber: '',
    bankName: '',
    ifscCode: '',
    panNumber: '',
    upiId: ''
  });

  const [fieldErrors, setFieldErrors] = useState({});

  // Fetch Live Profile, Balance, and History
  const fetchWalletAndProfile = useCallback(async () => {
    try {
      setLoading(true);

      const [profileRes, statsRes, historyRes, settingsRes] = await Promise.all([
        api.get('/api/users/profile').catch(() => null),
        api.get('/api/users/dashboard-stats').catch(() => null),
        api.get('/api/withdrawals/my-requests').catch(() => null),
        api.get('/api/settings').catch(() => null)
      ]);

      const liveWithdrawalConfig = settingsRes?.data?.data?.compensation?.withdrawal;
      if (liveWithdrawalConfig) {
        setWithdrawalConfig({
          minAmount: Number(liveWithdrawalConfig.minAmount ?? 500),
          adminChargeRate: Number(liveWithdrawalConfig.adminChargeRate ?? 0.05),
          tdsRate: Number(liveWithdrawalConfig.tdsRate ?? 0.05)
        });
      }

      const historyList = historyRes?.data?.data || [];
      const safeHistory = Array.isArray(historyList) ? historyList : historyList.withdrawals || [];

      // Every member's real wallet.incomeBalance, straight from
      // dashboard-stats — this used to be overwritten with a hardcoded
      // ₹1,600 "demo" fallback whenever the member had no withdrawal
      // history yet, so every first-time withdrawer saw the same fake
      // balance (and could submit a withdrawal request against money they
      // never earned). No fallback to any nonzero placeholder now — 0 when
      // genuinely unavailable.
      const rawBalance = statsRes?.data?.data?.walletBalance ?? user?.walletBalance;
      setAvailableBalance(Number(rawBalance) || 0);
      setWithdrawals(safeHistory);

      if (!statsRes) {
        showNotification('Could not load your wallet balance. Please refresh.', 'error');
      }

      // Auto-populate bank details into form state
      const profileUser = profileRes?.data?.data?.user || profileRes?.data?.data || user;
      const bank = profileUser?.bankDetails || {};
      const kyc = profileUser?.kyc || {};

      setFormData({
        accountHolderName: bank.accountHolderName || bank.accountName || bank.accountHolder || profileUser?.fullName || '',
        accountNumber: bank.accountNumber || '',
        bankName: bank.bankName || '',
        ifscCode: (bank.ifscCode || '').toUpperCase(),
        panNumber: (bank.panNumber || kyc.panNumber || '').toUpperCase(),
        upiId: bank.upiId || ''
      });
    } catch (err) {
      console.error('Failed to load withdrawal data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWalletAndProfile();
  }, [fetchWalletAndProfile]);

  // Deductions computed from the live admin-configured rates (defaults:
  // 5% TDS + 5% Admin Handling = 10% total, 90% net).
  const numericAmount = Number(amount) || 0;
  const tdsAmount = Math.round(numericAmount * withdrawalConfig.tdsRate);
  const adminCharge = Math.round(numericAmount * withdrawalConfig.adminChargeRate);
  const netPayable = Math.max(0, numericAmount - (tdsAmount + adminCharge));

  // Real, derived-only summary numbers for the KPI strip — every figure
  // here is computed straight from the withdrawal history already fetched
  // above, nothing is fabricated.
  const summary = useMemo(() => {
    const totalRequests = withdrawals.length;
    const totalWithdrawn = withdrawals
      .filter((w) => ['APPROVED', 'PROCESSED'].includes((w.status || '').toUpperCase()))
      .reduce((sum, w) => sum + Number(w.netAmount || w.amount || 0), 0);
    const pendingCount = withdrawals.filter((w) => {
      const s = (w.status || 'PENDING').toUpperCase();
      return s !== 'APPROVED' && s !== 'PROCESSED' && s !== 'REJECTED' && s !== 'CANCELLED';
    }).length;
    return { totalRequests, totalWithdrawn, pendingCount };
  }, [withdrawals]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: field === 'ifscCode' || field === 'panNumber' ? value.toUpperCase() : value
    }));

    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  // Validation: Minimum amount per the live admin-configured setting
  const validateForm = () => {
    const errs = {};

    if (!amount || isNaN(numericAmount) || numericAmount < withdrawalConfig.minAmount) {
      errs.amount = `Minimum withdrawal amount is ₹${withdrawalConfig.minAmount.toLocaleString('en-IN')}`;
    } else if (numericAmount > availableBalance) {
      errs.amount = `Amount exceeds available balance (₹${availableBalance.toLocaleString('en-IN')})`;
    }

    if (!formData.accountHolderName.trim()) {
      errs.accountHolderName = 'Account holder name is required';
    }

    const cleanAcc = formData.accountNumber.trim();
    if (!cleanAcc) {
      errs.accountNumber = 'Account number is required';
    } else if (!/^\d{9,18}$/.test(cleanAcc)) {
      errs.accountNumber = 'Valid bank account number (9 to 18 digits) is required';
    }

    if (!formData.bankName.trim()) {
      errs.bankName = 'Bank name is required';
    }

    const cleanIfsc = formData.ifscCode.trim().toUpperCase();
    if (!cleanIfsc) {
      errs.ifscCode = 'IFSC code is required';
    } else if (cleanIfsc.length < 8) {
      errs.ifscCode = 'Please enter a valid IFSC code';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit Withdrawal Request
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showNotification(`Please enter at least ₹${withdrawalConfig.minAmount.toLocaleString('en-IN')} and verify required bank details.`, 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const holderName = formData.accountHolderName.trim();
      const panVal = formData.panNumber.trim().toUpperCase() || 'APPLIED_FOR';

      const payload = {
        amount: numericAmount,
        accountHolderName: holderName,
        accountNumber: formData.accountNumber.trim(),
        bankName: formData.bankName.trim(),
        ifscCode: formData.ifscCode.trim().toUpperCase(),
        panNumber: panVal,
        upiId: formData.upiId.trim(),
        bankDetails: {
          accountName: holderName,
          accountHolder: holderName,
          accountHolderName: holderName,
          accountNumber: formData.accountNumber.trim(),
          bankName: formData.bankName.trim(),
          ifscCode: formData.ifscCode.trim().toUpperCase(),
          panNumber: panVal,
          upiId: formData.upiId.trim()
        }
      };

      let res;
      try {
        res = await api.post('/api/withdrawals/request', payload);
      } catch (firstErr) {
        if (firstErr.response?.status === 404) {
          res = await api.post('/api/withdrawals', payload);
        } else {
          throw firstErr;
        }
      }

      if (res.data?.success) {
        showNotification(res.data.message || 'Withdrawal request submitted successfully!', 'success');
        setAvailableBalance((prev) => Math.max(0, prev - numericAmount));
        fetchWalletAndProfile();
      } else {
        showNotification(res.data?.message || 'Unable to submit withdrawal.', 'error');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to submit withdrawal request.';
      showNotification(errorMsg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      {/* Top Banner */}
      <div className={styles.headerRow}>
        <div className={styles.titleGroup}>
          <div className={styles.titleBadge}>💼 PAYOUT MANAGEMENT</div>
          <h1 className={styles.pageTitle}>Withdrawals &amp; Payouts</h1>
          <p className={styles.pageSubtitle}>
            Request real-time earnings payout directly to your verified Indian bank account.
          </p>
        </div>

        {/* Balance Card */}
        <div className={styles.balanceCard}>
          <div className={styles.balanceLabel}>AVAILABLE FOR WITHDRAWAL</div>
          <div className={styles.balanceValue}>₹{availableBalance.toLocaleString('en-IN')}</div>
          <span className={styles.balanceSub}>Wallet Balance</span>
        </div>
      </div>

      {/* KPI Summary Strip — real numbers only, derived from the fetched withdrawal history */}
      <div className={styles.gradientKpiGrid}>
        <div className={`${styles.gradientKpiCard} ${styles.gradientMint}`}>
          <div className={styles.gradientKpiTop}>
            <span className={styles.gradientKpiIcon}>📨</span>
            <span className={styles.gradientKpiLabel}>Total Requests</span>
          </div>
          <h2 className={styles.gradientKpiValue}>{summary.totalRequests}</h2>
          <span className={styles.gradientKpiSub}>Lifetime payout requests</span>
        </div>

        <div className={`${styles.gradientKpiCard} ${styles.gradientBlue}`}>
          <div className={styles.gradientKpiTop}>
            <span className={styles.gradientKpiIcon}>💰</span>
            <span className={styles.gradientKpiLabel}>Total Withdrawn</span>
          </div>
          <h2 className={styles.gradientKpiValue}>₹{summary.totalWithdrawn.toLocaleString('en-IN')}</h2>
          <span className={styles.gradientKpiSub}>Approved &amp; disbursed payouts</span>
        </div>

        <div className={`${styles.gradientKpiCard} ${styles.gradientPeach}`}>
          <div className={styles.gradientKpiTop}>
            <span className={styles.gradientKpiIcon}>⏳</span>
            <span className={styles.gradientKpiLabel}>Pending Requests</span>
          </div>
          <h2 className={styles.gradientKpiValue}>{summary.pendingCount}</h2>
          <span className={styles.gradientKpiSub}>Awaiting admin audit</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className={styles.mainGrid}>
        {/* Left Column: Form */}
        <section className={styles.formCard}>
          <div className={styles.cardHeaderRow}>
            <h2 className={styles.cardTitle}>Request Payout</h2>
            <span className={styles.autoFilledBadge}>✓ Auto-Filled from Profile</span>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {/* Amount Field */}
            <div className={styles.inputGroup}>
              <div className={styles.labelRow}>
                <label className={styles.inputLabel}>
                  Withdrawal Amount (₹) <span className={styles.reqStar}>*</span>
                </label>
                <span className={styles.rangeHint}>
                  Min: ₹{withdrawalConfig.minAmount.toLocaleString('en-IN')} | Max: ₹{availableBalance.toLocaleString('en-IN')}
                </span>
              </div>

              <div className={styles.amountInputWrap}>
                <span className={styles.currencyPrefix}>₹</span>
                <input
                  type="number"
                  placeholder="Enter amount (min 500)"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (fieldErrors.amount) setFieldErrors((prev) => ({ ...prev, amount: '' }));
                  }}
                  className={`${styles.input} ${styles.amountInput} ${fieldErrors.amount ? styles.inputError : ''}`}
                />
              </div>

              {/* Quick Select Preset Pills */}
              <div className={styles.presetPills}>
                {[500, 1000, 1500].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setAmount(String(Math.min(preset, availableBalance)));
                      if (fieldErrors.amount) setFieldErrors((prev) => ({ ...prev, amount: '' }));
                    }}
                    className={styles.presetBtn}
                  >
                    ₹{preset}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setAmount(String(availableBalance));
                    if (fieldErrors.amount) setFieldErrors((prev) => ({ ...prev, amount: '' }));
                  }}
                  className={styles.presetBtnFull}
                >
                  Withdraw All
                </button>
              </div>

              {fieldErrors.amount && <span className={styles.errorText}>{fieldErrors.amount}</span>}
            </div>

            {/* Payout Breakdown Box */}
            <div className={styles.breakdownBox}>
              <div className={styles.breakdownRow}>
                <span>Gross Request:</span>
                <strong>₹{numericAmount.toLocaleString('en-IN')}</strong>
              </div>
              <div className={styles.breakdownRow}>
                <span>TDS Deduction ({Math.round(withdrawalConfig.tdsRate * 100)}%):</span>
                <span className={styles.deductText}>- ₹{tdsAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className={styles.breakdownRow}>
                <span>Admin Handling ({Math.round(withdrawalConfig.adminChargeRate * 100)}%):</span>
                <span className={styles.deductText}>- ₹{adminCharge.toLocaleString('en-IN')}</span>
              </div>
              <div className={styles.breakdownDivider}></div>
              <div className={styles.breakdownTotalRow}>
                <span>Net Credit to Bank:</span>
                <strong className={styles.netAmountText}>₹{netPayable.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            {/* Bank Fields */}
            <div className={styles.twoCol}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>
                  Account Holder Name <span className={styles.reqStar}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rubul islam"
                  value={formData.accountHolderName}
                  onChange={(e) => handleInputChange('accountHolderName', e.target.value)}
                  className={`${styles.input} ${fieldErrors.accountHolderName ? styles.inputError : ''}`}
                />
                {fieldErrors.accountHolderName && (
                  <span className={styles.errorText}>{fieldErrors.accountHolderName}</span>
                )}
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>
                  Bank Account Number <span className={styles.reqStar}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 20370176267"
                  value={formData.accountNumber}
                  onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                  className={`${styles.input} ${styles.mono} ${fieldErrors.accountNumber ? styles.inputError : ''}`}
                />
                {fieldErrors.accountNumber && (
                  <span className={styles.errorText}>{fieldErrors.accountNumber}</span>
                )}
              </div>
            </div>

            <div className={styles.twoCol}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>
                  Bank Name <span className={styles.reqStar}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. State Bank of India"
                  value={formData.bankName}
                  onChange={(e) => handleInputChange('bankName', e.target.value)}
                  className={`${styles.input} ${fieldErrors.bankName ? styles.inputError : ''}`}
                />
                {fieldErrors.bankName && (
                  <span className={styles.errorText}>{fieldErrors.bankName}</span>
                )}
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>
                  Bank IFSC Code <span className={styles.reqStar}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. SBIN0000078"
                  value={formData.ifscCode}
                  onChange={(e) => handleInputChange('ifscCode', e.target.value)}
                  className={`${styles.input} ${styles.mono} ${fieldErrors.ifscCode ? styles.inputError : ''}`}
                  maxLength={11}
                />
                {fieldErrors.ifscCode && (
                  <span className={styles.errorText}>{fieldErrors.ifscCode}</span>
                )}
              </div>
            </div>

            {/* Optional PAN / UPI Fields */}
            <div className={styles.twoCol}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>PAN Number</label>
                <input
                  type="text"
                  placeholder="e.g. ABCDE1234F"
                  value={formData.panNumber}
                  onChange={(e) => handleInputChange('panNumber', e.target.value)}
                  className={`${styles.input} ${styles.mono}`}
                  maxLength={10}
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>UPI ID (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. name@oksbi"
                  value={formData.upiId}
                  onChange={(e) => handleInputChange('upiId', e.target.value)}
                  className={styles.input}
                />
              </div>
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              disabled={submitting || availableBalance < withdrawalConfig.minAmount}
              className={styles.submitBtn}
            >
              {submitting ? 'Submitting Request...' : `Submit Request for ₹${numericAmount.toLocaleString('en-IN')}`}
            </button>
          </form>
        </section>

        {/* Right Column: History */}
        <section className={styles.historyCard}>
          <div className={styles.cardHeaderRow}>
            <h2 className={styles.cardTitle}>Withdrawal History</h2>
            <span className={styles.historyBadge}>{withdrawals.length} Records</span>
          </div>

          {loading ? (
            <div className={styles.centerBox}>
              <div className={styles.glowSpinner}></div>
              <p className={styles.loadingText}>Loading withdrawal history...</p>
            </div>
          ) : withdrawals.length === 0 ? (
            <div className={styles.centerBox}>
              <span className={styles.emptyIcon}>💸</span>
              <h4 className={styles.emptyTitle}>No withdrawal requests yet</h4>
              <p className={styles.emptyDesc}>Your submitted payout requests and verification statuses will appear here.</p>
            </div>
          ) : (
            <div className={styles.historyList}>
              {withdrawals.map((item) => {
                const meta = statusMeta(item.status);
                return (
                  <div key={item._id || item.id} className={styles.historyRow}>
                    <div className={styles.historyAvatar}>💸</div>
                    <div className={styles.historyMeta}>
                      <span className={styles.historyAmount}>
                        ₹{(item.netAmount || item.amount || 0).toLocaleString('en-IN')}
                      </span>
                      <small className={styles.historyDate}>
                        {formatDate(item.createdAt || item.requestedAt)}
                      </small>
                    </div>

                    <div className={styles.historyStatusWrap}>
                      <span className={styles.statusPill} style={{ color: meta.color, background: meta.bg }}>
                        {meta.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default WithdrawalsPage;
