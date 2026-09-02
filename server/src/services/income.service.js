const IncomeTransaction = require('../models/IncomeTransaction');
const User = require('../models/User');
const Package = require('../models/Package');
const BinaryNode = require('../models/BinaryNode');
const Referral = require('../models/Referral');
const WalletService = require('./wallet.service');
const BinaryService = require('./binary.service');

/**
 * Income Service - Handles all income calculations
 * This is the core of the compensation plan
 */
class IncomeService {
  /**
   * Generate unique transaction ID
   */
  generateTransactionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 6);
    return `INC-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Process all income from an order
   * Called when an order is completed
   */
  async processOrderIncome(order) {
    const userId = order.userId;
    const kbp = order.kbpGenerated;
    const orderId = order._id;

    console.log(`📊 Processing income for order ${order.orderNumber}`);
    console.log(`   KBP: ${kbp}, User: ${userId}`);

    const results = [];

    // 1. Process Referral Income
    const referralResult = await this.processReferralIncome(userId, kbp, orderId);
    if (referralResult) results.push(referralResult);

    // 2. Process Matching Income
    const matchingResult = await this.processMatchingIncome(userId, kbp, orderId);
    if (matchingResult) results.push(matchingResult);

    // 3. Process Leadership Income (if qualified)
    const leadershipResult = await this.processLeadershipIncome(userId, kbp, orderId);
    if (leadershipResult) results.push(leadershipResult);

    console.log(`✅ Income processing complete. ${results.length} transactions created`);

    return {
      success: true,
      transactions: results
    };
  }

  // ============ REFERRAL INCOME ============

  /**
   * Process Referral Income (10% of KBP)
   * Income goes to the sponsor (upline level 1)
   */
  async processReferralIncome(userId, kbp, orderId) {
    // Find the sponsor
    const user = await User.findById(userId);
    if (!user || !user.sponsorId) {
      console.log('   No sponsor found for referral income');
      return null;
    }

    const sponsor = await User.findById(user.sponsorId);
    if (!sponsor || sponsor.status !== 'ACTIVE') {
      console.log('   Sponsor not active');
      return null;
    }

    // Calculate income
    const rate = 0.10; // 10%
    const grossAmount = kbp * rate;

    console.log(`   Referral Income: ${grossAmount} for sponsor ${sponsor.email}`);

    // Apply caps
    const cappedResult = await this.applyCaps(sponsor._id, grossAmount);

    // Credit to wallet
    const creditResult = await this.creditIncome(
      sponsor._id,
      cappedResult.allowedAmount,
      'REFERRAL_INCOME',
      orderId,
      'Order',
      kbp,
      rate,
      {
        sponsoredUserId: userId,
        sponsoredEmail: user.email,
        orderId: orderId
      }
    );

    // Store cap breakdown
    if (creditResult && creditResult.transaction) {
      await IncomeTransaction.findByIdAndUpdate(
        creditResult.transaction._id,
        { 
          capBreakdown: cappedResult.capBreakdown,
          grossAmount: grossAmount,
          capAdjustment: grossAmount - cappedResult.allowedAmount
        }
      );
    }

    return {
      type: 'REFERRAL_INCOME',
      sponsorId: sponsor._id,
      grossAmount,
      allowedAmount: cappedResult.allowedAmount,
      excess: cappedResult.excess
    };
  }

  // ============ MATCHING INCOME ============

  /**
   * Process Matching Income (10% of matched KBP)
   * Income goes to upline members based on matching volume
   */
  async processMatchingIncome(userId, kbp, orderId) {
    // Get the user's binary node
    const node = await BinaryNode.findOne({ userId });
    if (!node) {
      console.log('   No binary node found');
      return null;
    }

    // Get upline (all ancestors)
    const upline = await this.getUpline(userId);
    
    if (upline.length === 0) {
      console.log('   No upline found');
      return null;
    }

    const results = [];

    // Process each upline member
    for (const ancestor of upline) {
      // Get ancestor's binary node
      const ancestorNode = await BinaryNode.findOne({ userId: ancestor._id });
      if (!ancestorNode) continue;

      // Calculate available matching volume
      const availableVolume = Math.min(
        ancestorNode.availableLeftVolume,
        ancestorNode.availableRightVolume
      );

      if (availableVolume <= 0) continue;

      // Calculate income (10% of matched KBP)
      const rate = 0.10; // 10%
      const matchAmount = Math.min(availableVolume, kbp);
      const grossAmount = matchAmount * rate;

      if (grossAmount <= 0) continue;

      console.log(`   Matching Income: ${grossAmount} for ${ancestor.email} (${matchAmount} KBP)`);

      // Apply caps
      const cappedResult = await this.applyCaps(ancestor._id, grossAmount);

      // Credit to wallet
      const creditResult = await this.creditIncome(
        ancestor._id,
        cappedResult.allowedAmount,
        'MATCHING_INCOME',
        orderId,
        'Order',
        matchAmount,
        rate,
        {
          sourceUserId: userId,
          sourceEmail: await this.getUserEmail(userId),
          orderId: orderId
        }
      );

      // Store cap breakdown
      if (creditResult && creditResult.transaction) {
        await IncomeTransaction.findByIdAndUpdate(
          creditResult.transaction._id,
          { 
            capBreakdown: cappedResult.capBreakdown,
            grossAmount: grossAmount,
            capAdjustment: grossAmount - cappedResult.allowedAmount
          }
        );
      }

      // Update matching volume
      if (cappedResult.allowedAmount > 0) {
        await this.updateMatchingVolume(ancestor._id, matchAmount);
      }

      results.push({
        type: 'MATCHING_INCOME',
        userId: ancestor._id,
        grossAmount,
        allowedAmount: cappedResult.allowedAmount,
        matchedKBP: matchAmount
      });
    }

    return results.length > 0 ? results : null;
  }

  // ============ LEADERSHIP INCOME ============

  /**
   * Process Leadership Income
   * Level 1: 50%, Level 2: 30%, Level 3: 20%
   * Only applies to downline members who are also leaders
   */
  async processLeadershipIncome(userId, kbp, orderId) {
    // Check if user is leadership qualified
    const isQualified = await this.isLeadershipQualified(userId);
    if (!isQualified) {
      console.log('   User not leadership qualified');
      return null;
    }

    // Get downline leaders (levels 1-3)
    const leaders = await this.getDownlineLeaders(userId, 3);
    
    if (!leaders || Object.keys(leaders).length === 0) {
      console.log('   No downline leaders found');
      return null;
    }

    const rates = {
      1: 0.50, // 50%
      2: 0.30, // 30%
      3: 0.20  // 20%
    };

    const results = [];

    // Process each level
    for (const level in leaders) {
      const levelLeaders = leaders[level];
      const rate = rates[level];

      for (const leader of levelLeaders) {
        const grossAmount = kbp * rate;

        console.log(`   Leadership Income L${level}: ${grossAmount} for ${leader.email}`);

        // Apply caps
        const cappedResult = await this.applyCaps(leader._id, grossAmount);

        // Credit to wallet
        const creditResult = await this.creditIncome(
          leader._id,
          cappedResult.allowedAmount,
          `LEADERSHIP_INCOME_L${level}`,
          orderId,
          'Order',
          kbp,
          rate,
          {
            sourceUserId: userId,
            sourceEmail: await this.getUserEmail(userId),
            level: parseInt(level),
            orderId: orderId
          }
        );

        // Store cap breakdown
        if (creditResult && creditResult.transaction) {
          await IncomeTransaction.findByIdAndUpdate(
            creditResult.transaction._id,
            { 
              capBreakdown: cappedResult.capBreakdown,
              grossAmount: grossAmount,
              capAdjustment: grossAmount - cappedResult.allowedAmount
            }
          );
        }

        results.push({
          type: `LEADERSHIP_INCOME_L${level}`,
          userId: leader._id,
          level: parseInt(level),
          grossAmount,
          allowedAmount: cappedResult.allowedAmount
        });
      }
    }

    return results.length > 0 ? results : null;
  }

  /**
   * Get downline leaders (members who are also leadership qualified)
   */
  async getDownlineLeaders(userId, maxLevel = 3) {
    const leaders = {};
    
    // Get direct downline (level 1)
    const level1Downline = await User.find({ sponsorId: userId, status: 'ACTIVE' });
    
    for (const member of level1Downline) {
      // Check if this member is a leader (has 2:1 or 1:2 structure)
      const isValid = await this.isLeadershipQualified(member._id);
      if (isValid) {
        if (!leaders[1]) leaders[1] = [];
        leaders[1].push(member);
      }

      // Get their downline for level 2
      if (maxLevel >= 2) {
        const level2Downline = await User.find({ sponsorId: member._id, status: 'ACTIVE' });
        for (const member2 of level2Downline) {
          const isValid2 = await this.isLeadershipQualified(member2._id);
          if (isValid2) {
            if (!leaders[2]) leaders[2] = [];
            leaders[2].push(member2);
          }

          // Level 3
          if (maxLevel >= 3) {
            const level3Downline = await User.find({ sponsorId: member2._id, status: 'ACTIVE' });
            for (const member3 of level3Downline) {
              const isValid3 = await this.isLeadershipQualified(member3._id);
              if (isValid3) {
                if (!leaders[3]) leaders[3] = [];
                leaders[3].push(member3);
              }
            }
          }
        }
      }
    }

    return leaders;
  }

  // ============ REPURCHASE INCOME ============

  /**
   * Process Repurchase Income
   * Self: 30%
   * Downline: Level 1-10 (20% to 1%)
   */
  async processRepurchaseIncome(userId, kbp, orderId) {
    console.log(`📊 Processing repurchase income for user ${userId}`);
    console.log(`   KBP: ${kbp}`);

    const results = [];

    // 1. Self Repurchase (30%)
    const selfResult = await this.processSelfRepurchase(userId, kbp, orderId);
    if (selfResult) results.push(selfResult);

    // 2. Downline Repurchase (levels 1-10)
    const downlineResult = await this.processDownlineRepurchase(userId, kbp, orderId);
    if (downlineResult) results.push(...downlineResult);

    console.log(`✅ Repurchase income complete. ${results.length} transactions created`);

    return results;
  }

  /**
   * Self Repurchase Income (30% of KBP)
   * Goes to the member's Repurchase Wallet
   */
  async processSelfRepurchase(userId, kbp, orderId) {
    const rate = 0.30; // 30%
    const grossAmount = kbp * rate;

    console.log(`   Self Repurchase: ${grossAmount} for user ${userId}`);

    // Apply caps
    const cappedResult = await this.applyCaps(userId, grossAmount);

    // Credit to REPURCHASE wallet
    const creditResult = await this.creditIncome(
      userId,
      cappedResult.allowedAmount,
      'REPURCHASE_SELF',
      orderId,
      'Order',
      kbp,
      rate,
      {
        orderId: orderId,
        type: 'SELF'
      }
    );

    // Store cap breakdown
    if (creditResult && creditResult.transaction) {
      await IncomeTransaction.findByIdAndUpdate(
        creditResult.transaction._id,
        { 
          capBreakdown: cappedResult.capBreakdown,
          grossAmount: grossAmount,
          capAdjustment: grossAmount - cappedResult.allowedAmount
        }
      );
    }

    return {
      type: 'REPURCHASE_SELF',
      userId: userId,
      grossAmount,
      allowedAmount: cappedResult.allowedAmount,
      excess: cappedResult.excess
    };
  }

  /**
   * Downline Repurchase Income
   * Levels 1-10 with varying percentages
   */
  async processDownlineRepurchase(userId, kbp, orderId) {
    // Get upline (all ancestors up to 10 levels)
    const upline = await this.getUpline(userId, 10);
    
    if (upline.length === 0) {
      console.log('   No upline found for repurchase');
      return [];
    }

    // Repurchase rates by level
    const rates = {
      1: 0.20, // 20%
      2: 0.15, // 15%
      3: 0.10, // 10%
      4: 0.05, // 5%
      5: 0.03, // 3%
      6: 0.02, // 2%
      7: 0.01, // 1%
      8: 0.01, // 1%
      9: 0.01, // 1%
      10: 0.01 // 1%
    };

    const results = [];

    // Process each level
    for (let i = 0; i < upline.length && i < 10; i++) {
      const ancestor = upline[i];
      const level = i + 1;
      const rate = rates[level] || 0;

      if (rate === 0) continue;

      const grossAmount = kbp * rate;

      console.log(`   Downline Repurchase L${level}: ${grossAmount} for ${ancestor.email}`);

      // Apply caps
      const cappedResult = await this.applyCaps(ancestor._id, grossAmount);

      // Credit to REPURCHASE wallet
      const creditResult = await this.creditIncome(
        ancestor._id,
        cappedResult.allowedAmount,
        'REPURCHASE_DOWNLINE',
        orderId,
        'Order',
        kbp,
        rate,
        {
          sourceUserId: userId,
          sourceEmail: await this.getUserEmail(userId),
          level: level,
          orderId: orderId
        }
      );

      // Store cap breakdown
      if (creditResult && creditResult.transaction) {
        await IncomeTransaction.findByIdAndUpdate(
          creditResult.transaction._id,
          { 
            capBreakdown: cappedResult.capBreakdown,
            grossAmount: grossAmount,
            capAdjustment: grossAmount - cappedResult.allowedAmount
          }
        );
      }

      results.push({
        type: 'REPURCHASE_DOWNLINE',
        userId: ancestor._id,
        level: level,
        grossAmount,
        allowedAmount: cappedResult.allowedAmount
      });
    }

    return results;
  }

  // ============ CAPPING ENGINE ============

  /**
   * Apply daily/weekly/monthly caps to income
   */
  async applyCaps(userId, income) {
    // Get user's active package
    const user = await User.findById(userId);
    if (!user || !user.activePackageId) {
      // No active package = no caps (but still record)
      return {
        allowedAmount: income,
        excess: 0,
        capBreakdown: {
          daily: { consumed: 0, remaining: Infinity, cap: Infinity },
          weekly: { consumed: 0, remaining: Infinity, cap: Infinity },
          monthly: { consumed: 0, remaining: Infinity, cap: Infinity }
        }
      };
    }

    const pkg = await Package.findById(user.activePackageId);
    if (!pkg) {
      return {
        allowedAmount: income,
        excess: 0,
        capBreakdown: {
          daily: { consumed: 0, remaining: Infinity, cap: Infinity },
          weekly: { consumed: 0, remaining: Infinity, cap: Infinity },
          monthly: { consumed: 0, remaining: Infinity, cap: Infinity }
        }
      };
    }

    // Get date ranges
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = this.getWeekStart(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get consumed income for periods
    const dailyConsumed = await this.getConsumedIncome(userId, today, now);
    const weeklyConsumed = await this.getConsumedIncome(userId, weekStart, now);
    const monthlyConsumed = await this.getConsumedIncome(userId, monthStart, now);

    // Calculate remaining caps
    const dailyRemaining = Math.max(0, pkg.dailyCap - dailyConsumed);
    const weeklyRemaining = Math.max(0, pkg.weeklyCap - weeklyConsumed);
    const monthlyRemaining = Math.max(0, pkg.monthlyCap - monthlyConsumed);

    // Apply caps
    let allowedAmount = Math.min(
      income,
      dailyRemaining,
      weeklyRemaining,
      monthlyRemaining
    );
    allowedAmount = Math.max(0, allowedAmount);

    const excess = income - allowedAmount;

    const result = {
      allowedAmount,
      excess,
      capBreakdown: {
        daily: {
          consumed: dailyConsumed,
          remaining: dailyRemaining,
          cap: pkg.dailyCap
        },
        weekly: {
          consumed: weeklyConsumed,
          remaining: weeklyRemaining,
          cap: pkg.weeklyCap
        },
        monthly: {
          consumed: monthlyConsumed,
          remaining: monthlyRemaining,
          cap: pkg.monthlyCap
        }
      }
    };

    if (excess > 0) {
      console.log(`   ⚠️ Income capped: ${income} → ${allowedAmount} (excess: ${excess})`);
    }

    return result;
  }

  /**
   * Get consumed income for a period
   */
  async getConsumedIncome(userId, startDate, endDate) {
    const result = await IncomeTransaction.aggregate([
      {
        $match: {
          userId: userId,
          status: 'CREDITED',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$creditedAmount' }
        }
      }
    ]);
    return result.length > 0 ? result[0].total : 0;
  }

  /**
   * Get week start (Monday)
   */
  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  // ============ INCOME CREDITING ============

  /**
   * Credit income to wallet and create transaction
   */
  async creditIncome(userId, amount, type, sourceId, sourceModel, kbp, rate, metadata = {}) {
    if (amount <= 0) {
      console.log(`   ⚠️ Amount ${amount} <= 0, skipping`);
      return null;
    }

    // Determine wallet type
    const walletType = ['REFERRAL_INCOME', 'MATCHING_INCOME', 'LEADERSHIP_INCOME_L1', 
                        'LEADERSHIP_INCOME_L2', 'LEADERSHIP_INCOME_L3'].includes(type)
      ? 'INCOME' : 'REPURCHASE';

    try {
      // Credit to wallet
      const creditResult = await WalletService.credit(
        userId,
        amount,
        type,
        sourceId,
        {
          sourceModel: sourceModel,
          kbp: kbp,
          rate: rate,
          ...metadata
        }
      );

      if (!creditResult || !creditResult.transaction) {
        throw new Error('Failed to credit wallet');
      }

      // Create income transaction
      const incomeTransaction = new IncomeTransaction({
        userId: userId,
        transactionId: this.generateTransactionId(),
        type: type,
        sourceId: sourceId,
        sourceModel: sourceModel,
        kbp: kbp,
        rate: rate,
        grossAmount: amount,
        capAdjustment: 0,
        creditedAmount: amount,
        walletType: walletType,
        walletId: creditResult.transaction.walletId,
        status: 'CREDITED',
        processedAt: new Date(),
        metadata: {
          ...metadata,
          walletTransactionId: creditResult.transaction._id
        }
      });

      await incomeTransaction.save();

      console.log(`   ✅ Credited ${amount} to ${walletType} wallet of user ${userId}`);

      return {
        success: true,
        transaction: incomeTransaction,
        walletTransaction: creditResult.transaction
      };
    } catch (error) {
      console.error(`   ❌ Failed to credit income: ${error.message}`);
      return null;
    }
  }

  // ============ HELPER METHODS ============

  /**
   * Get user email by ID
   */
  async getUserEmail(userId) {
    const user = await User.findById(userId).select('email');
    return user ? user.email : 'Unknown';
  }

  /**
   * Get upline (all ancestors up to maxDepth)
   */
  async getUpline(userId, maxDepth = 20) {
    const upline = [];
    let currentId = userId;
    let depth = 0;

    while (depth < maxDepth) {
      const user = await User.findById(currentId);
      if (!user || !user.sponsorId) break;
      
      const sponsor = await User.findById(user.sponsorId);
      if (!sponsor) break;

      upline.push(sponsor);
      currentId = sponsor._id;
      depth++;
    }

    return upline;
  }

  /**
   * Check if user is leadership qualified
   * Requirements: Minimum 3 direct sponsors + 2:1 or 1:2 binary structure
   */
  async isLeadershipQualified(userId) {
    const user = await User.findById(userId);
    if (!user) return false;

    // Check minimum 3 direct sponsors
    const directSponsors = await User.countDocuments({ sponsorId: userId });
    if (directSponsors < 3) return false;

    // Check binary structure (2:1 or 1:2)
    const node = await BinaryNode.findOne({ userId });
    if (!node) return false;
    const left = node.leftVolume || 0;
    const right = node.rightVolume || 0;
    return (left >= right * 2 || right >= left * 2);
  }

  /**
   * Update matching volume (deduct matched KBP)
   */
  async updateMatchingVolume(userId, amount) {
    const node = await BinaryNode.findOne({ userId });
    if (!node) return;

    // Deduct from available volumes
    const matchedLeft = Math.min(node.availableLeftVolume, amount);
    const matchedRight = Math.min(node.availableRightVolume, amount);
    
    node.availableLeftVolume -= matchedLeft;
    node.availableRightVolume -= matchedRight;
    node.matchingVolume += Math.min(matchedLeft, matchedRight);
    
    await node.save();
  }

  // ============ QUERY METHODS ============

  /**
   * Get income summary for a user
   */
  async getIncomeSummary(userId) {
    const incomeTypes = [
      'REFERRAL_INCOME',
      'MATCHING_INCOME',
      'LEADERSHIP_INCOME_L1',
      'LEADERSHIP_INCOME_L2',
      'LEADERSHIP_INCOME_L3',
      'REPURCHASE_SELF',
      'REPURCHASE_DOWNLINE'
    ];

    const summary = {};

    for (const type of incomeTypes) {
      const result = await IncomeTransaction.aggregate([
        {
          $match: {
            userId: userId,
            type: type,
            status: 'CREDITED'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$creditedAmount' },
            count: { $sum: 1 }
          }
        }
      ]);

      summary[type] = result.length > 0 ? {
        total: result[0].total,
        count: result[0].count
      } : { total: 0, count: 0 };
    }

    // Get totals
    const totalResult = await IncomeTransaction.aggregate([
      {
        $match: {
          userId: userId,
          status: 'CREDITED'
        }
      },
      {
        $group: {
          _id: null,
          totalIncome: { $sum: '$creditedAmount' },
          totalCount: { $sum: 1 }
        }
      }
    ]);

    const totals = totalResult.length > 0 ? {
      totalIncome: totalResult[0].totalIncome,
      totalCount: totalResult[0].totalCount
    } : { totalIncome: 0, totalCount: 0 };

    // Get last income
    const lastIncome = await IncomeTransaction.findOne({
      userId: userId,
      status: 'CREDITED'
    })
    .sort({ createdAt: -1 })
    .limit(1);

    return {
      byType: summary,
      total: totals,
      lastIncome: lastIncome ? lastIncome.format() : null
    };
  }

  /**
   * Get income transactions
   */
  async getIncomeTransactions(userId, limit = 50, skip = 0) {
    const transactions = await IncomeTransaction.find({
      userId: userId,
      status: 'CREDITED'
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    const total = await IncomeTransaction.countDocuments({
      userId: userId,
      status: 'CREDITED'
    });

    return {
      transactions: transactions.map(t => t.format()),
      pagination: {
        total,
        limit,
        skip,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get income by type
   */
  async getIncomeByType(userId, type, limit = 50, skip = 0) {
    const transactions = await IncomeTransaction.find({
      userId: userId,
      type: type,
      status: 'CREDITED'
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    const total = await IncomeTransaction.countDocuments({
      userId: userId,
      type: type,
      status: 'CREDITED'
    });

    return {
      transactions: transactions.map(t => t.format()),
      pagination: {
        total,
        limit,
        skip,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get cap status for a user
   */
  async getCapStatus(userId) {
    const user = await User.findById(userId);
    if (!user || !user.activePackageId) {
      return {
        hasPackage: false,
        message: 'No active package found'
      };
    }

    const pkg = await Package.findById(user.activePackageId);
    if (!pkg) {
      return {
        hasPackage: false,
        message: 'Package not found'
      };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = this.getWeekStart(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const dailyConsumed = await this.getConsumedIncome(userId, today, now);
    const weeklyConsumed = await this.getConsumedIncome(userId, weekStart, now);
    const monthlyConsumed = await this.getConsumedIncome(userId, monthStart, now);

    return {
      package: {
        name: pkg.name,
        type: pkg.type
      },
      caps: {
        daily: {
          cap: pkg.dailyCap,
          consumed: dailyConsumed,
          remaining: Math.max(0, pkg.dailyCap - dailyConsumed),
          percentage: Math.round((dailyConsumed / pkg.dailyCap) * 100)
        },
        weekly: {
          cap: pkg.weeklyCap,
          consumed: weeklyConsumed,
          remaining: Math.max(0, pkg.weeklyCap - weeklyConsumed),
          percentage: Math.round((weeklyConsumed / pkg.weeklyCap) * 100)
        },
        monthly: {
          cap: pkg.monthlyCap,
          consumed: monthlyConsumed,
          remaining: Math.max(0, pkg.monthlyCap - monthlyConsumed),
          percentage: Math.round((monthlyConsumed / pkg.monthlyCap) * 100)
        }
      }
    };
  }
}

module.exports = new IncomeService();