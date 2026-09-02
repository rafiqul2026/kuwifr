// client/src/pages/member/WalletPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import SalaryProgressCard from '../../components/member/SalaryProgressCard';
import styles from './WalletPage.module.css';

/**
 * Member Wallet Page
 * Displays Income, Repurchase, and Salary Wallets with live 50:50 TTO progress and transactions
 */
const WalletPage = () => {
  // State: Consolidated wallet balances
  const [wallet, setWallet] = useState({
    incomeBalance: 0,
    repurchaseBalance: 0,
    salaryBalance: 0,
    totalSalaryEarned: 0,
    totalBalance: 0,
    totalIncome: 0,
    totalWithdrawn: 0
  });

  // State: Transaction records and controls
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('ALL'); // 'ALL' | 'INCOME' | 'REPURCHASE' | 'SALARY'

  // State: Transfer to repurchase wallet
  const [transferAmount, setTransferAmount] = useState('');
  const [transferring, setTransferring] = useState(false);

  const { showNotification } = useNotification();

  /**
   * Fetch live balance summary and transaction audit history
   */
  const fetchWalletData = useCallback(async () => {
    try {
      setLoading(true);
      const [balanceRes, txRes] = await Promise.all([
        api.get('/api/wallet/balance'),
        api.get('/api/wallet/transactions?limit=30')
      ]);

      if (balanceRes.data?.success && balanceRes.data?.data?.balance) {
        setWallet(balanceRes.data.data.balance);
      }

      if (txRes.data?.success) {
        setTransactions(txRes.data.data.transactions || []);
      }
    } catch (error) {
      console.error('Failed to load wallet data:', error);
      showNotification('Failed to synchronize wallet balances', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  // Initial load and periodic background polling (every 30 seconds)
  useEffect(() => {
    fetchWalletData();
    const interval = setInterval(fetchWalletData, 30000);
    return () => clearInterval(interval);
  }, [fetchWalletData]);

  /**
   * Handle internal fund transfer: Income Wallet -> Repurchase Wallet
   */
  const handleTransfer = async (e) => {
    e.preventDefault();
    const amountNum = parseFloat(transferAmount);

    if (!amountNum || amountNum <= 0) {
      showNotification('Please enter a valid amount greater than ₹0', 'error');
      return;
    }

    if (amountNum > (wallet.incomeBalance || 0)) {
      showNotification('Insufficient balance in Income Wallet', 'error');
      return;
    }

    try {
      setTransferring(true);
      const response = await api.post('/api/wallet/transfer-to-repurchase', {
        amount: amountNum
      });

      if (response.data?.success) {
        showNotification('Funds transferred to Repurchase Wallet successfully!', 'success');
        setTransferAmount('');
        fetchWalletData(); // Refresh balances immediately
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Transfer failed';
      showNotification(message, 'error');
    } finally {
      setTransferring(false);
    }
  };

  /**
   * Indian Currency formatting helper
   */
  const formatINR = (val) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);

  // Filter transaction records by wallet category
  const filteredTransactions = selectedType === 'ALL'
    ? transactions
    : transactions.filter((tx) => tx.walletType === selectedType);

  // Total balance across all three liquid wallets
  const netCalculatedTotal =
    (wallet.incomeBalance || 0) +
    (wallet.repurchaseBalance || 0) +
    (wallet.salaryBalance || 0);

  // 5-Card Metric Configuration
  const walletCards = [
    {
      id: 'income',
      label: 'Income Wallet',
      value: wallet.incomeBalance || 0,
      sublabel: 'Binary matching & referral earnings',
      icon: '💵',
      gradientClass: styles.cardIncome
    },
    {
      id: 'repurchase',
      label: 'Repurchase Wallet',
      value: wallet.repurchaseBalance || 0,
      sublabel: 'Dedicated for store purchases',
      icon: '🛍️',
      gradientClass: styles.cardRepurchase
    },
    {
      id: 'salary',
      label: 'Salary Wallet',
      value: wallet.salaryBalance || 0,
      sublabel: '1% Monthly TTO Payouts',
      icon: '💼',
      gradientClass: styles.cardSalary
    },
    {
      id: 'totalIncome',
      label: 'Total Lifetime Income',
      value: wallet.totalIncome || 0,
      sublabel: 'Accumulated earnings to date',
      icon: '📊',
      gradientClass: styles.cardTotalIncome
    },
    {
      id: 'totalWithdrawn',
      label: 'Total Dispatched',
      value: wallet.totalWithdrawn || 0,
      sublabel: 'Bank payouts successfully processed',
      icon: '🏦',
      gradientClass: styles.cardWithdrawn
    }
  ];

  if (loading && !wallet.incomeBalance && transactions.length === 0) {
    return (
      <div className={styles.loadingWrapper}>
        <div className={styles.spinner}></div>
        <p>Loading financial balances and ledger...</p>
      </div>
    );
  }

  return (
    <div className={styles.walletPage}>
      {/* ================= HEADER SECTION ================= */}
      <header className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.badgeTag}>FINANCIAL HUB</div>
          <h1 className={styles.pageTitle}>My Wallets</h1>
          <p className={styles.pageSubtitle}>
            Track real-time earnings, salary benefits, and transaction history
          </p>
        </div>

        {/* Aggregate Net Total Balance Display */}
        <div className={styles.totalBalanceCard}>
          <span className={styles.totalLabel}>TOTAL LIQUID BALANCE</span>
          <span className={styles.totalValue}>{formatINR(netCalculatedTotal)}</span>
          <small className={styles.totalSubNote}>Income + Repurchase + Salary</small>
        </div>
      </header>

      {/* ================= 5-CARD BALANCE GRID ================= */}
      <section className={styles.walletCardsGrid} aria-label="Wallet Overview">
        {walletCards.map((card) => (
          <div key={card.id} className={`${styles.walletCard} ${card.gradientClass}`}>
            <div className={styles.cardIconBox}>{card.icon}</div>
            <div className={styles.cardContent}>
              <span className={styles.cardLabel}>{card.label}</span>
              <span className={styles.cardValue}>{formatINR(card.value)}</span>
              <small className={styles.cardSubText}>{card.sublabel}</small>
            </div>
          </div>
        ))}
      </section>

      {/* ================= LIVE SALARY QUALIFICATION (50:50 / 1% TTO) ================= */}
      <section className={styles.salarySectionWrapper}>
        <SalaryProgressCard />
      </section>

      {/* ================= TRANSFER SECTION ================= */}
      <section className={styles.transferSection}>
        <div className={styles.transferHeader}>
          <div>
            <h2>Transfer to Repurchase Wallet</h2>
            <p>Instantly move available funds from Income Wallet to make package/product purchases</p>
          </div>
          <span className={styles.availableBalance}>
            Available for Transfer: <strong>{formatINR(wallet.incomeBalance)}</strong>
          </span>
        </div>

        <form onSubmit={handleTransfer} className={styles.transferForm}>
          <div className={styles.transferInputWrapper}>
            <span className={styles.currencySymbol}>₹</span>
            <input
              type="number"
              placeholder="Enter amount to transfer"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              className={styles.transferInput}
              min="1"
              max={wallet.incomeBalance || 0}
              step="1"
              disabled={transferring}
            />
          </div>
          <button
            type="submit"
            className={styles.transferBtn}
            disabled={transferring || !transferAmount || parseFloat(transferAmount) <= 0}
          >
            {transferring ? (
              <span className={styles.btnLoading}>
                <span className={styles.btnSpinner}></span>
                Processing Transfer...
              </span>
            ) : (
              'Transfer Funds'
            )}
          </button>
        </form>
      </section>

      {/* ================= AUDIT TRANSACTION HISTORY ================= */}
      <section className={styles.transactionSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Transaction Ledger</h2>
            <span className={styles.transactionCount}>
              Showing {filteredTransactions.length} records
            </span>
          </div>

          {/* Type Filter Pills */}
          <div className={styles.filterPills}>
            {['ALL', 'INCOME', 'REPURCHASE', 'SALARY'].map((type) => (
              <button
                key={type}
                type="button"
                className={`${styles.filterPill} ${selectedType === type ? styles.filterPillActive : ''}`}
                onClick={() => setSelectedType(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.transactionList}>
          {filteredTransactions.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>💳</span>
              <p>No transactions found for this selection</p>
              <span className={styles.emptySubtext}>New earnings and transfers will appear here</span>
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const isCredit = tx.type === 'CREDIT';
              return (
                <div key={tx._id || tx.transactionId} className={styles.transactionItem}>
                  <div className={styles.txLeft}>
                    <div className={`${styles.txIcon} ${isCredit ? styles.creditIcon : styles.debitIcon}`}>
                      {isCredit ? '📥' : '📤'}
                    </div>
                    <div className={styles.txInfo}>
                      <span className={styles.txDescription}>{tx.description || 'Wallet Transaction'}</span>
                      <span className={styles.txDate}>
                        {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  <div className={styles.txRight}>
                    <span className={styles.txSourceBadge}>{tx.walletType}</span>
                    <span className={`${styles.txAmount} ${isCredit ? styles.creditText : styles.debitText}`}>
                      {isCredit ? '+' : '-'}{formatINR(tx.amount)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};

export default WalletPage;