const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const User = require('../models/User');

/**
 * Wallet Service - Handles all wallet operations
 * Ensures financial integrity with complete audit trail
 */
class WalletService {
  /**
   * Get or create wallet for user
   */
  async getOrCreateWallet(userId) {
    let wallet = await Wallet.findOne({ userId });
    
    if (!wallet) {
      wallet = new Wallet({
        userId,
        incomeBalance: 0,
        repurchaseBalance: 0,
        totalIncome: 0,
        totalWithdrawn: 0,
        totalRepurchased: 0
      });
      await wallet.save();
    }
    
    return wallet;
  }

  /**
   * Get wallet with transactions
   */
  async getWallet(userId, limit = 50, skip = 0) {
    const wallet = await this.getOrCreateWallet(userId);
    const transactions = await wallet.getTransactionHistory(limit, skip);
    const summary = wallet.getBalanceSummary();
    
    return {
      wallet,
      summary,
      transactions
    };
  }

  /**
   * Credit amount to wallet
   */
  async credit(userId, amount, source, reference, metadata = {}) {
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    const wallet = await this.getOrCreateWallet(userId);
    
    // Determine wallet type based on source
    let walletType;
    if (['REFERRAL_INCOME', 'MATCHING_INCOME', 'LEADERSHIP_INCOME'].includes(source)) {
      walletType = 'INCOME';
    } else if (['REPURCHASE_SELF', 'REPURCHASE_DOWNLINE'].includes(source)) {
      walletType = 'REPURCHASE';
    } else if (['RANK_REWARD', 'FUND_REWARD'].includes(source)) {
      walletType = 'INCOME';
    } else {
      walletType = 'INCOME'; // Default
    }

    // Update balance
    const transactionData = {
      transactionId: wallet.generateTransactionId(),
      type: 'CREDIT',
      description: this.getTransactionDescription(source, reference),
      source: source,
      reference: reference,
      metadata: metadata,
      ipAddress: metadata.ipAddress || null,
      userAgent: metadata.userAgent || null
    };

    const transaction = await wallet.updateBalance(amount, walletType, transactionData);

    // Update total income if source is income
    if (walletType === 'INCOME') {
      wallet.totalIncome += amount;
      await wallet.save();
    }

    // Update user's lifetime income
    if (['REFERRAL_INCOME', 'MATCHING_INCOME', 'LEADERSHIP_INCOME'].includes(source)) {
      await User.findByIdAndUpdate(userId, {
        $inc: { lifetimeIncome: amount }
      });
    }

    return {
      success: true,
      transaction,
      newBalance: {
        income: wallet.incomeBalance,
        repurchase: wallet.repurchaseBalance
      }
    };
  }

  /**
   * Debit amount from wallet
   */
  async debit(userId, amount, source, reference, metadata = {}) {
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    const wallet = await this.getOrCreateWallet(userId);
    
    // Determine wallet type
    let walletType;
    if (source === 'WITHDRAWAL') {
      walletType = 'INCOME';
    } else if (source === 'PURCHASE') {
      walletType = 'REPURCHASE';
    } else {
      walletType = 'INCOME';
    }

    // Update balance (negative amount for debit)
    const transactionData = {
      transactionId: wallet.generateTransactionId(),
      type: 'DEBIT',
      description: this.getTransactionDescription(source, reference),
      source: source,
      reference: reference,
      metadata: metadata,
      ipAddress: metadata.ipAddress || null,
      userAgent: metadata.userAgent || null
    };

    const transaction = await wallet.updateBalance(-amount, walletType, transactionData);

    // Update totals
    if (source === 'WITHDRAWAL') {
      wallet.totalWithdrawn += amount;
      await wallet.save();
    } else if (source === 'PURCHASE') {
      wallet.totalRepurchased += amount;
      await wallet.save();
    }

    return {
      success: true,
      transaction,
      newBalance: {
        income: wallet.incomeBalance,
        repurchase: wallet.repurchaseBalance
      }
    };
  }

  /**
   * Transfer between wallets (Income → Repurchase)
   */
  async transferToRepurchase(userId, amount, metadata = {}) {
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    // First, debit from income wallet
    const debitResult = await this.debit(userId, amount, 'SYSTEM', null, {
      ...metadata,
      description: 'Transfer to Repurchase Wallet'
    });

    // Then, credit to repurchase wallet
    const creditResult = await this.credit(userId, amount, 'SYSTEM', null, {
      ...metadata,
      description: 'Transfer from Income Wallet'
    });

    return {
      success: true,
      debit: debitResult,
      credit: creditResult
    };
  }

  /**
   * Check if user has sufficient balance
   */
  async hasSufficientBalance(userId, amount, walletType = 'INCOME') {
    const wallet = await this.getOrCreateWallet(userId);
    
    if (walletType === 'INCOME') {
      return wallet.incomeBalance >= amount;
    } else if (walletType === 'REPURCHASE') {
      return wallet.repurchaseBalance >= amount;
    }
    
    return false;
  }

  /**
   * Get balance summary for user
   */
  async getBalanceSummary(userId) {
    const wallet = await this.getOrCreateWallet(userId);
    return wallet.getBalanceSummary();
  }

  /**
   * Get transaction description based on source
   */
  getTransactionDescription(source, reference) {
    const descriptions = {
      'REFERRAL_INCOME': 'Referral income from sponsored member',
      'MATCHING_INCOME': 'Matching income from binary pairs',
      'LEADERSHIP_INCOME': 'Leadership income from downline',
      'REPURCHASE_SELF': 'Self repurchase income',
      'REPURCHASE_DOWNLINE': 'Downline repurchase income',
      'WITHDRAWAL': 'Withdrawal request',
      'PURCHASE': 'Product purchase',
      'RANK_REWARD': 'Rank achievement reward',
      'FUND_REWARD': 'Fund achievement reward',
      'ADMIN_ADJUSTMENT': 'Admin adjustment',
      'SYSTEM': 'System transaction'
    };
    
    let description = descriptions[source] || 'Transaction';
    
    if (reference) {
      description += ` (Ref: ${reference})`;
    }
    
    return description;
  }

  /**
   * Reconcile wallet balances
   * Checks if balance matches sum of transactions
   */
  async reconcile(userId) {
    const wallet = await this.getOrCreateWallet(userId);
    
    // Get all completed transactions
    const transactions = await WalletTransaction.find({
      walletId: wallet._id,
      status: 'COMPLETED'
    });

    // Calculate expected balances
    let expectedIncome = 0;
    let expectedRepurchase = 0;

    for (const tx of transactions) {
      const amount = tx.type === 'CREDIT' ? tx.amount : -tx.amount;
      if (tx.walletType === 'INCOME') {
        expectedIncome += amount;
      } else if (tx.walletType === 'REPURCHASE') {
        expectedRepurchase += amount;
      }
    }

    const isReconciled = 
      expectedIncome === wallet.incomeBalance &&
      expectedRepurchase === wallet.repurchaseBalance;

    return {
      isReconciled,
      expected: {
        income: expectedIncome,
        repurchase: expectedRepurchase
      },
      actual: {
        income: wallet.incomeBalance,
        repurchase: wallet.repurchaseBalance
      },
      differences: {
        income: expectedIncome - wallet.incomeBalance,
        repurchase: expectedRepurchase - wallet.repurchaseBalance
      }
    };
  }

  /**
   * Get transaction statistics
   */
  async getTransactionStats(userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const wallet = await this.getOrCreateWallet(userId);

    const stats = await WalletTransaction.aggregate([
      {
        $match: {
          walletId: wallet._id,
          status: 'COMPLETED',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$walletType',
          totalCredits: {
            $sum: {
              $cond: [{ $eq: ['$type', 'CREDIT'] }, '$amount', 0]
            }
          },
          totalDebits: {
            $sum: {
              $cond: [{ $eq: ['$type', 'DEBIT'] }, '$amount', 0]
            }
          },
          transactionCount: { $sum: 1 }
        }
      }
    ]);

    // Format results
    const result = {
      income: { credits: 0, debits: 0, count: 0 },
      repurchase: { credits: 0, debits: 0, count: 0 }
    };

    for (const stat of stats) {
      const key = stat._id.toLowerCase();
      if (result[key]) {
        result[key].credits = stat.totalCredits || 0;
        result[key].debits = stat.totalDebits || 0;
        result[key].count = stat.transactionCount || 0;
        result[key].net = stat.totalCredits - stat.totalDebits;
      }
    }

    return {
      period: `${days} days`,
      stats: result,
      totalTransactions: stats.reduce((sum, s) => sum + s.transactionCount, 0),
      startDate,
      endDate: new Date()
    };
  }

  /**
   * Get wallet verification status
   */
  async getVerificationStatus(userId) {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return { exists: false };
    }

    return {
      exists: true,
      isVerified: wallet.isVerified,
      verificationRemarks: wallet.verificationRemarks,
      lastTransactionAt: wallet.lastTransactionAt,
      totalTransactions: wallet.totalTransactions
    };
  }

  /**
   * Verify wallet (admin)
   */
  async verifyWallet(userId, verified = true, remarks = '') {
    const wallet = await this.getOrCreateWallet(userId);
    wallet.isVerified = verified;
    wallet.verificationRemarks = remarks;
    await wallet.save();

    // Create audit transaction
    await this.credit(
      userId,
      0,
      'SYSTEM',
      null,
      {
        description: `Wallet ${verified ? 'verified' : 'unverified'} - ${remarks}`,
        type: 'ADMIN_ACTION'
      }
    );

    return wallet;
  }
}

module.exports = new WalletService();