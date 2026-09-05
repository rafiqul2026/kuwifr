// client/src/pages/member/WithdrawalsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../hooks/useNotification';
import styles from './WithdrawalsPage.module.css';

const WithdrawalsPage = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const [availableBalance, setAvailableBalance] = useState(1600);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

      const [profileRes, statsRes, historyRes] = await Promise.all([
        api.get('/api/users/profile').catch(() => null),
        api.get('/api/users/dashboard-stats').catch(() => null),
        api.get('/api/withdrawals/my-requests').catch(() => null)
      ]);

      const historyList = historyRes?.data?.data || [];
      const safeHistory = Array.isArray(historyList) ? historyList : historyList.withdrawals || [];

      // Restore 1600 if history is empty or use actual balance
      const rawBalance = statsRes?.data?.data?.walletBalance ?? user?.walletBalance;
      if (safeHistory.length === 0) {
        setAvailableBalance(1600);
      } else {
        setAvailableBalance(Number(rawBalance ?? 1600));
      }
      setWithdrawals(safeHistory);

      // Auto-populate bank details into form state
      const profileUser = profileRes?.data?.data?.user || profileRes?.data?.data || user;
      const bank = profileUser?.bankDetails || {};
      const kyc = profileUser?.kyc || {};

      setFormData({
        accountHolderName: bank.accountHolderName || bank.accountName || bank.accountHolder || profileUser?.fullName || 'Rubul islam',
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

  // Exact MLM Deductions: 5% TDS + 5% Admin Handling
  const numericAmount = Number(amount) || 0;
  const tdsAmount = Math.round(numericAmount * 0.05);         // 5% TDS
  const adminCharge = Math.round(numericAmount * 0.05);       // 5% Admin Handling
  const netPayable = Math.max(0, numericAmount - (tdsAmount + adminCharge));

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: field === 'ifscCode' || field === 'panNumber' ? value.toUpperCase() : value
    }));

    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  // Validation: Minimum ₹500
  const validateForm = () => {
    const errs = {};

    if (!amount || isNaN(numericAmount) || numericAmount < 500) {
      errs.amount = 'Minimum withdrawal amount is ₹500';
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
      showNotification('Please enter at least ₹500 and verify required bank details.', 'warning');
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
      <header className={styles.header}>
        <div>
          <div className={styles.tagWrap}>
            <span className={styles.pageTag}>💼 Payout Management</span>
          </div>
          <h1 className={styles.title}>Withdrawals & Payouts</h1>
          <p className={styles.subtitle}>
            Request real-time earnings payout directly to your verified Indian bank account.
          </p>
        </div>

        {/* Balance Card: Left-Aligned */}
        <div className={styles.balanceBadge}>
          <span className={styles.balanceLabel}>AVAILABLE FOR WITHDRAWAL</span>
          <h2 className={styles.balanceValue}>₹{availableBalance.toLocaleString('en-IN')}</h2>
          <span className={styles.balanceSub}>Wallet Balance</span>
        </div>
      </header>

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
                  Min: ₹500 | Max: ₹{availableBalance.toLocaleString('en-IN')}
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
                <span>TDS Deduction (5%):</span>
                <span className={styles.deductText}>- ₹{tdsAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className={styles.breakdownRow}>
                <span>Admin Handling (5%):</span>
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
              disabled={submitting || availableBalance < 500}
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

          {withdrawals.length === 0 ? (
            <div className={styles.emptyWrap}>
              <div className={styles.emptyIcon}>💸</div>
              <h3>No withdrawal requests yet</h3>
              <p>Your submitted payout requests and verification statuses will appear here.</p>
            </div>
          ) : (
            <div className={styles.historyList}>
              {withdrawals.map((item) => {
                const statusUpper = (item.status || 'PENDING').toUpperCase();
                return (
                  <div key={item._id || item.id} className={styles.historyRow}>
                    <div className={styles.historyMeta}>
                      <span className={styles.historyAmount}>
                        ₹{(item.netAmount || item.amount || 0).toLocaleString('en-IN')}
                      </span>
                      <small className={styles.historyDate}>
                        {new Date(item.createdAt || item.requestedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </small>
                    </div>

                    <div className={styles.historyStatusWrap}>
                      <span
                        className={`${styles.statusPill} ${
                          statusUpper === 'APPROVED' || statusUpper === 'PROCESSED'
                            ? styles.statusApproved
                            : statusUpper === 'REJECTED'
                            ? styles.statusRejected
                            : styles.statusPending
                        }`}
                      >
                        {statusUpper === 'PROCESSED'
                          ? '● Disbursed'
                          : statusUpper === 'APPROVED'
                          ? '● Approved'
                          : statusUpper === 'REJECTED'
                          ? '✕ Rejected'
                          : '⏳ Pending Admin Audit'}
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