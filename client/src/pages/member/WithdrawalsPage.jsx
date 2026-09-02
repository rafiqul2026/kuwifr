import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import styles from './WithdrawalsPage.module.css';

const WithdrawalsPage = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [formData, setFormData] = useState({
    amount: '',
    bankDetails: {
      accountName: '',
      accountNumber: '',
      bankName: '',
      ifscCode: '',
      panNumber: ''
    }
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [withdrawalsRes, walletRes] = await Promise.all([
        api.get('/api/withdrawals?limit=20'),
        api.get('/api/wallet/balance')
      ]);
      
      if (withdrawalsRes.data.success) {
        setWithdrawals(withdrawalsRes.data.data.withdrawals || []);
      }
      if (walletRes.data.success) {
        setWalletBalance(walletRes.data.data.balance.incomeBalance || 0);
      }
    } catch (error) {
      showNotification('Failed to fetch data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const validateField = (name, value) => {
    switch (name) {
      case 'amount':
        if (!value || parseFloat(value) <= 0) {
          return 'Please enter a valid amount';
        }
        if (parseFloat(value) < 100) {
          return 'Minimum withdrawal amount is ₹100';
        }
        if (parseFloat(value) > walletBalance) {
          return 'Insufficient wallet balance';
        }
        return '';
      case 'accountName':
        if (!value || value.trim().length < 2) {
          return 'Please enter account holder name';
        }
        return '';
      case 'accountNumber':
        if (!value || value.trim().length < 9) {
          return 'Please enter a valid account number';
        }
        return '';
      case 'bankName':
        if (!value || value.trim().length < 2) {
          return 'Please enter bank name';
        }
        return '';
      case 'ifscCode':
        if (!value || value.trim().length < 4) {
          return 'Please enter IFSC code';
        }
        return '';
      default:
        return '';
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
      if (touched[`${parent}.${child}`]) {
        const error = validateField(child, value);
        setErrors(prev => ({ ...prev, [`${parent}.${child}`]: error }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
      if (touched[name]) {
        const error = validateField(name, value);
        setErrors(prev => ({ ...prev, [name]: error }));
      }
    }
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const value = field.includes('.') 
      ? formData.bankDetails[field.split('.')[1]] 
      : formData[field];
    const error = validateField(field.split('.')[1] || field, value);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate all fields
    const fields = ['amount', 'accountName', 'accountNumber', 'bankName', 'ifscCode'];
    const newErrors = {};
    let isValid = true;

    fields.forEach(field => {
      const value = field === 'amount' ? formData[field] : formData.bankDetails[field];
      const error = validateField(field, value);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
      setTouched(prev => ({ ...prev, [field]: true }));
    });

    if (!isValid) {
      setErrors(newErrors);
      showNotification('Please fix all errors before submitting', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        amount: parseFloat(formData.amount),
        bankDetails: formData.bankDetails
      };

      const response = await api.post('/api/withdrawals', payload);
      if (response.data.success) {
        showNotification('Withdrawal request submitted successfully!', 'success');
        setFormData({
          amount: '',
          bankDetails: {
            accountName: '',
            accountNumber: '',
            bankName: '',
            ifscCode: '',
            panNumber: ''
          }
        });
        fetchData();
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Withdrawal request failed';
      showNotification(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'PENDING': '#f59e0b',
      'APPROVED': '#22c55e',
      'REJECTED': '#ef4444',
      'PROCESSED': '#3b82f6',
      'CANCELLED': '#64748b'
    };
    return colors[status] || '#64748b';
  };

  const getStatusBadge = (status) => {
    const styles_map = {
      'PENDING': styles.statusPending,
      'APPROVED': styles.statusApproved,
      'REJECTED': styles.statusRejected,
      'PROCESSED': styles.statusProcessed,
      'CANCELLED': styles.statusCancelled
    };
    return styles_map[status] || styles.statusPending;
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading withdrawals...</p>
      </div>
    );
  }

  return (
    <div className={styles.withdrawalsPage}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Withdrawals</h1>
          <p className={styles.pageSubtitle}>Request and track your withdrawals</p>
        </div>
        <div className={styles.balanceCard}>
          <span className={styles.balanceLabel}>Available Balance</span>
          <span className={styles.balanceValue}>₹{walletBalance.toLocaleString()}</span>
        </div>
      </div>

      <div className={styles.contentGrid}>
        {/* Request Form */}
        <div className={styles.requestSection}>
          <h2>Request Withdrawal</h2>
          <form onSubmit={handleSubmit} className={styles.requestForm}>
            <div className={styles.formGroup}>
              <label>Amount (₹) <span className={styles.required}>*</span></label>
              <div className={styles.amountInputWrapper}>
                <span className={styles.currencySymbol}>₹</span>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  onBlur={() => handleBlur('amount')}
                  placeholder="Enter amount (min ₹100)"
                  className={touched.amount && errors.amount ? styles.error : ''}
                  min="100"
                  max={walletBalance}
                  step="1"
                />
              </div>
              {touched.amount && errors.amount && (
                <span className={styles.errorMessage}>{errors.amount}</span>
              )}
              <span className={styles.helperText}>
                Min: ₹100 | Max: ₹{walletBalance.toLocaleString()}
              </span>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Account Holder Name <span className={styles.required}>*</span></label>
                <input
                  type="text"
                  name="bankDetails.accountName"
                  value={formData.bankDetails.accountName}
                  onChange={handleChange}
                  onBlur={() => handleBlur('accountName')}
                  placeholder="Enter account holder name"
                  className={touched.accountName && errors.accountName ? styles.error : ''}
                />
                {touched.accountName && errors.accountName && (
                  <span className={styles.errorMessage}>{errors.accountName}</span>
                )}
              </div>

              <div className={styles.formGroup}>
                <label>Account Number <span className={styles.required}>*</span></label>
                <input
                  type="text"
                  name="bankDetails.accountNumber"
                  value={formData.bankDetails.accountNumber}
                  onChange={handleChange}
                  onBlur={() => handleBlur('accountNumber')}
                  placeholder="Enter account number"
                  className={touched.accountNumber && errors.accountNumber ? styles.error : ''}
                />
                {touched.accountNumber && errors.accountNumber && (
                  <span className={styles.errorMessage}>{errors.accountNumber}</span>
                )}
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Bank Name <span className={styles.required}>*</span></label>
                <input
                  type="text"
                  name="bankDetails.bankName"
                  value={formData.bankDetails.bankName}
                  onChange={handleChange}
                  onBlur={() => handleBlur('bankName')}
                  placeholder="Enter bank name"
                  className={touched.bankName && errors.bankName ? styles.error : ''}
                />
                {touched.bankName && errors.bankName && (
                  <span className={styles.errorMessage}>{errors.bankName}</span>
                )}
              </div>

              <div className={styles.formGroup}>
                <label>IFSC Code <span className={styles.required}>*</span></label>
                <input
                  type="text"
                  name="bankDetails.ifscCode"
                  value={formData.bankDetails.ifscCode}
                  onChange={handleChange}
                  onBlur={() => handleBlur('ifscCode')}
                  placeholder="Enter IFSC code"
                  className={touched.ifscCode && errors.ifscCode ? styles.error : ''}
                />
                {touched.ifscCode && errors.ifscCode && (
                  <span className={styles.errorMessage}>{errors.ifscCode}</span>
                )}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>PAN Number</label>
              <input
                type="text"
                name="bankDetails.panNumber"
                value={formData.bankDetails.panNumber}
                onChange={handleChange}
                placeholder="Enter PAN for TDS (optional)"
              />
              <span className={styles.helperText}>PAN is required for TDS refund</span>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? (
                <span className={styles.btnLoading}>
                  <span className={styles.btnSpinner}></span>
                  Submitting...
                </span>
              ) : (
                'Submit Withdrawal Request'
              )}
            </button>
          </form>
        </div>

        {/* Withdrawal History */}
        <div className={styles.historySection}>
          <div className={styles.historyHeader}>
            <h2>Withdrawal History</h2>
            <span className={styles.historyCount}>{withdrawals.length} requests</span>
          </div>

          {withdrawals.length === 0 ? (
            <div className={styles.emptyState}>
              <span>💸</span>
              <p>No withdrawal requests yet</p>
              <span className={styles.emptySubtext}>Your withdrawal history will appear here</span>
            </div>
          ) : (
            <div className={styles.withdrawalList}>
              {withdrawals.map((w) => (
                <div key={w._id} className={styles.withdrawalItem}>
                  <div className={styles.wdHeader}>
                    <span className={styles.wdNumber}>{w.withdrawalNumber}</span>
                    <span className={`${styles.wdStatus} ${getStatusBadge(w.status)}`}>
                      {w.status}
                    </span>
                  </div>
                  <div className={styles.wdBody}>
                    <div className={styles.wdAmounts}>
                      <div>
                        <span className={styles.wdLabel}>Gross Amount</span>
                        <span className={styles.wdGross}>₹{w.grossAmount.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className={styles.wdLabel}>Deductions</span>
                        <span className={styles.wdDeductions}>
                          -₹{(w.adminCharge + w.tdsAmount).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className={styles.wdLabel}>Net Amount</span>
                        <span className={styles.wdNet}>₹{w.netAmount.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className={styles.wdMeta}>
                      <span className={styles.wdDate}>
                        📅 {new Date(w.createdAt).toLocaleDateString()}
                      </span>
                      {w.status === 'REJECTED' && w.approval?.rejectionReason && (
                        <span className={styles.wdReason}>
                          Reason: {w.approval.rejectionReason}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WithdrawalsPage;