const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const WalletService = require('./wallet.service');

/**
 * Withdrawal Service - Handles all withdrawal operations
 * Complete with TDS calculation and reconciliation
 */
class WithdrawalService {
  /**
   * Calculate withdrawal amounts
   * Rule: 5% Admin Charge + 5% TDS = 10% Total
   * No Service Charge
   */
  calculateWithdrawal(grossAmount) {
    const adminChargeRate = 0.05; // 5%
    const tdsRate = 0.05; // 5%
    const serviceChargeRate = 0; // 0% (cancelled)

    const adminCharge = grossAmount * adminChargeRate;
    const tdsAmount = grossAmount * tdsRate;
    const serviceCharge = grossAmount * serviceChargeRate;
    const netAmount = grossAmount - adminCharge - tdsAmount - serviceCharge;

    return {
      grossAmount,
      adminCharge,
      adminChargeRate,
      tdsAmount,
      tdsRate,
      serviceCharge,
      serviceChargeRate,
      netAmount,
      totalDeduction: adminCharge + tdsAmount + serviceCharge,
      deductionPercentage: (adminChargeRate + tdsRate + serviceChargeRate) * 100
    };
  }

  /**
   * Create withdrawal request
   */
  async createWithdrawal(userId, amount, bankDetails, ipAddress = null, userAgent = null) {
    // Check minimum amount
    if (amount < 100) {
      throw new Error('Minimum withdrawal amount is ₹100');
    }

    // Check wallet balance
    const hasBalance = await WalletService.hasSufficientBalance(userId, amount, 'INCOME');
    if (!hasBalance) {
      throw new Error('Insufficient income wallet balance');
    }

    // Calculate deductions
    const calculation = this.calculateWithdrawal(amount);

    // Get user's PAN
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validate bank details
    if (!bankDetails || !bankDetails.accountName || !bankDetails.accountNumber) {
      throw new Error('Bank details are required');
    }

    // Use user's PAN if not provided
    const panNumber = bankDetails.panNumber || user.bankDetails?.panNumber || 'PENDING';

    // Create withdrawal
    const withdrawal = new Withdrawal({
      userId: userId,
      grossAmount: amount,
      adminCharge: calculation.adminCharge,
      adminChargeRate: calculation.adminChargeRate,
      tdsAmount: calculation.tdsAmount,
      tdsRate: calculation.tdsRate,
      serviceCharge: calculation.serviceCharge,
      netAmount: calculation.netAmount,
      bankDetails: {
        accountName: bankDetails.accountName,
        accountNumber: bankDetails.accountNumber,
        bankName: bankDetails.bankName || 'Not Provided',
        ifscCode: bankDetails.ifscCode || 'Not Provided',
        upiId: bankDetails.upiId || '',
        panNumber: panNumber
      },
      status: 'PENDING',
      statusHistory: [{
        status: 'PENDING',
        timestamp: new Date(),
        note: 'Withdrawal request created'
      }],
      ipAddress: ipAddress,
      userAgent: userAgent,
      requestedAt: new Date()
    });

    await withdrawal.save();

    return withdrawal;
  }

  /**
   * Admin approve withdrawal
   */
  async approveWithdrawal(withdrawalId, adminId, notes = '') {
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }

    if (withdrawal.status !== 'PENDING') {
      throw new Error('Withdrawal is not pending approval');
    }

    // Check if user has sufficient balance
    const hasBalance = await WalletService.hasSufficientBalance(
      withdrawal.userId,
      withdrawal.grossAmount,
      'INCOME'
    );

    if (!hasBalance) {
      throw new Error('User does not have sufficient balance');
    }

    // Update withdrawal
    withdrawal.status = 'APPROVED';
    withdrawal.approval.approvedBy = adminId;
    withdrawal.approval.approvedAt = new Date();
    withdrawal.approval.notes = notes;
    withdrawal.statusHistory.push({
      status: 'APPROVED',
      timestamp: new Date(),
      note: notes || 'Withdrawal approved',
      updatedBy: adminId
    });

    await withdrawal.save();

    return withdrawal;
  }

  /**
   * Admin reject withdrawal
   */
  async rejectWithdrawal(withdrawalId, adminId, reason) {
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }

    if (withdrawal.status !== 'PENDING') {
      throw new Error('Withdrawal is not pending approval');
    }

    // Update withdrawal
    withdrawal.status = 'REJECTED';
    withdrawal.approval.approvedBy = adminId;
    withdrawal.approval.approvedAt = new Date();
    withdrawal.approval.rejectionReason = reason;
    withdrawal.statusHistory.push({
      status: 'REJECTED',
      timestamp: new Date(),
      note: `Rejected: ${reason}`,
      updatedBy: adminId
    });

    await withdrawal.save();

    return withdrawal;
  }

  /**
   * Process withdrawal (deduct from wallet and mark as processed)
   */
  async processWithdrawal(withdrawalId, adminId, paymentDetails = {}) {
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }

    if (withdrawal.status !== 'APPROVED') {
      throw new Error('Withdrawal must be approved first');
    }

    // Debit from wallet
    const debitResult = await WalletService.debit(
      withdrawal.userId,
      withdrawal.grossAmount,
      'WITHDRAWAL',
      withdrawal._id,
      {
        description: `Withdrawal: ${withdrawal.withdrawalNumber}`,
        ipAddress: null,
        userAgent: null
      }
    );

    if (!debitResult || !debitResult.success) {
      throw new Error('Failed to debit wallet');
    }

    // Update withdrawal
    withdrawal.status = 'PROCESSED';
    withdrawal.payment.processedAt = new Date();
    withdrawal.payment.processedBy = adminId;
    withdrawal.payment.transactionId = paymentDetails.transactionId || null;
    withdrawal.payment.utrNumber = paymentDetails.utrNumber || null;
    withdrawal.payment.paymentMethod = paymentDetails.paymentMethod || 'BANK_TRANSFER';
    withdrawal.statusHistory.push({
      status: 'PROCESSED',
      timestamp: new Date(),
      note: 'Withdrawal processed and amount debited from wallet',
      updatedBy: adminId
    });

    await withdrawal.save();

    return {
      withdrawal,
      debit: debitResult
    };
  }

  /**
   * Get user's withdrawals
   */
  async getUserWithdrawals(userId, status = null, limit = 50, skip = 0) {
    const query = { userId: userId };
    if (status) {
      query.status = status;
    }

    const withdrawals = await Withdrawal.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Withdrawal.countDocuments(query);

    return {
      withdrawals,
      pagination: {
        total,
        limit,
        skip,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get withdrawal by ID (with authorization check)
   */
  async getWithdrawalById(withdrawalId, userId = null, isAdmin = false) {
    const query = { _id: withdrawalId };
    if (!isAdmin && userId) {
      query.userId = userId;
    }

    const withdrawal = await Withdrawal.findById(query);
    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }

    return withdrawal;
  }

  /**
   * Get all pending withdrawals (admin)
   */
  async getPendingWithdrawals(limit = 50, skip = 0) {
    const withdrawals = await Withdrawal.find({ status: 'PENDING' })
      .populate('userId', 'fullName email phoneNumber')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Withdrawal.countDocuments({ status: 'PENDING' });

    return {
      withdrawals,
      pagination: {
        total,
        limit,
        skip,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get withdrawal statistics for admin dashboard
   */
  async getWithdrawalStats() {
    const stats = await Withdrawal.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$grossAmount' },
          totalNetAmount: { $sum: '$netAmount' },
          totalTDS: { $sum: '$tdsAmount' },
          totalAdminCharge: { $sum: '$adminCharge' }
        }
      }
    ]);

    // Get today's withdrawals
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayWithdrawals = await Withdrawal.countDocuments({
      createdAt: { $gte: today },
      status: 'PROCESSED'
    });

    // Get pending count
    const pending = await Withdrawal.countDocuments({ status: 'PENDING' });

    return {
      summary: stats,
      pending: pending,
      todayProcessed: todayWithdrawals,
      totalWithdrawals: stats.reduce((sum, s) => sum + s.count, 0),
      totalAmount: stats.reduce((sum, s) => sum + s.totalAmount, 0)
    };
  }

  /**
   * Reconcile TDS for a withdrawal
   */
  async reconcileTDS(withdrawalId, adminId, referenceNumber, notes = '') {
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }

    if (withdrawal.status !== 'PROCESSED') {
      throw new Error('Withdrawal must be processed first');
    }

    withdrawal.tdsReconciliation.status = 'RECONCILED';
    withdrawal.tdsReconciliation.referenceNumber = referenceNumber;
    withdrawal.tdsReconciliation.notes = notes;
    withdrawal.tdsReconciliation.reconciledBy = adminId;
    withdrawal.tdsReconciliation.reconciledAt = new Date();

    withdrawal.statusHistory.push({
      status: 'RECONCILED',
      timestamp: new Date(),
      note: `TDS reconciled. Reference: ${referenceNumber}`,
      updatedBy: adminId
    });

    await withdrawal.save();

    return withdrawal;
  }

  /**
   * Refund TDS (on PAN verification)
   */
  async refundTDS(withdrawalId, adminId, refundAmount = null, notes = '') {
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }

    if (withdrawal.tdsReconciliation.status !== 'RECONCILED') {
      throw new Error('TDS must be reconciled first');
    }

    const refundAmountValue = refundAmount || withdrawal.tdsAmount;

    // Credit TDS refund back to wallet
    const creditResult = await WalletService.credit(
      withdrawal.userId,
      refundAmountValue,
      'TDS_REFUND',
      withdrawal._id,
      {
        description: `TDS refund for withdrawal ${withdrawal.withdrawalNumber}`,
        ipAddress: null,
        userAgent: null
      }
    );

    withdrawal.tdsReconciliation.status = 'REFUNDED';
    withdrawal.tdsReconciliation.refundDate = new Date();
    withdrawal.tdsReconciliation.refundAmount = refundAmountValue;
    withdrawal.tdsReconciliation.notes = notes;
    withdrawal.tdsReconciliation.reconciledBy = adminId;

    withdrawal.statusHistory.push({
      status: 'REFUNDED',
      timestamp: new Date(),
      note: `TDS refunded: ₹${refundAmountValue}. ${notes}`,
      updatedBy: adminId
    });

    await withdrawal.save();

    return {
      withdrawal,
      refund: creditResult
    };
  }

  /**
   * Cancel withdrawal (user)
   */
  async cancelWithdrawal(withdrawalId, userId) {
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }

    if (withdrawal.userId.toString() !== userId.toString()) {
      throw new Error('Unauthorized');
    }

    if (withdrawal.status !== 'PENDING') {
      throw new Error('Only pending withdrawals can be cancelled');
    }

    withdrawal.status = 'CANCELLED';
    withdrawal.statusHistory.push({
      status: 'CANCELLED',
      timestamp: new Date(),
      note: 'Withdrawal cancelled by user',
      updatedBy: userId
    });

    await withdrawal.save();

    return withdrawal;
  }

  /**
   * Update bank details for a member
   */
  async updateBankDetails(userId, bankDetails) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.bankDetails = {
      accountName: bankDetails.accountName || user.bankDetails?.accountName,
      accountNumber: bankDetails.accountNumber || user.bankDetails?.accountNumber,
      bankName: bankDetails.bankName || user.bankDetails?.bankName,
      ifscCode: bankDetails.ifscCode || user.bankDetails?.ifscCode,
      upiId: bankDetails.upiId || user.bankDetails?.upiId,
      panNumber: bankDetails.panNumber || user.bankDetails?.panNumber
    };

    await user.save();

    return user;
  }

  /**
   * Get total withdrawal statistics for a user
   */
  async getUserWithdrawalStats(userId) {
    const stats = await Withdrawal.aggregate([
      {
        $match: { userId: userId }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$grossAmount' },
          totalNetAmount: { $sum: '$netAmount' },
          totalTDS: { $sum: '$tdsAmount' },
          totalAdminCharge: { $sum: '$adminCharge' }
        }
      }
    ]);

    // Get total withdrawals
    const total = await Withdrawal.countDocuments({ userId: userId });
    const totalAmount = await Withdrawal.aggregate([
      { $match: { userId: userId, status: 'PROCESSED' } },
      { $group: { _id: null, total: { $sum: '$grossAmount' } } }
    ]);

    return {
      summary: stats,
      total: {
        count: total,
        amount: totalAmount.length > 0 ? totalAmount[0].total : 0
      }
    };
  }
}

module.exports = new WithdrawalService();