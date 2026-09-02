const Rank = require("../models/Rank");
const RankAchievement = require("../models/RankAchievement");
const KuwiStar = require("../models/KuwiStar");
const User = require("../models/User");
const Order = require("../models/Order");
const BinaryNode = require("../models/BinaryNode");

/**
 * Rank Service - Handles all rank and star operations
 */
class RankService {
  /**
   * Initialize default ranks (run once)
   */
  async initializeRanks() {
    const ranks = [
      {
        name: "Kuwi Star",
        level: 1,
        code: "KUWI_STAR",
        kuwiStarRequirements: {
          directSponsors: 3,
          kbpRequired: 3000,
          timeLimit: 15,
        },
        starsRequired: 0,
        reward: "Diary + Pen",
        rewardValue: 500,
        salaryPercentage: 0,
        benefits: ["Entry level recognition"],
        icon: "⭐",
        color: "#f59e0b",
      },
      {
        name: "Bronze Star",
        level: 2,
        code: "BRONZE_STAR",
        starsRequired: 6,
        reward: "Executive Bag",
        rewardValue: 1500,
        salaryPercentage: 0,
        benefits: ["Professional recognition"],
        icon: "🥉",
        color: "#cd7f32",
      },
      {
        name: "Silver Star",
        level: 3,
        code: "SILVER_STAR",
        starsRequired: 20,
        reward: "Branded Watch",
        rewardValue: 5000,
        salaryPercentage: 0,
        benefits: ["Leadership recognition"],
        icon: "🥈",
        color: "#c0c0c0",
      },
      {
        name: "Platinum Star",
        level: 4,
        code: "PLATINUM_STAR",
        starsRequired: 70,
        reward: "Android Mobile",
        rewardValue: 15000,
        salaryPercentage: 0,
        benefits: ["High achiever recognition"],
        icon: "💎",
        color: "#e5e4e2",
      },
      {
        name: "Gold Star",
        level: 5,
        code: "GOLD_STAR",
        starsRequired: 200,
        reward: "Laptop",
        rewardValue: 50000,
        salaryPercentage: 0.01,
        benefits: ["Salary: 1% on TTO monthly"],
        icon: "🥇",
        color: "#ffd700",
      },
      {
        name: "Sapphire Star",
        level: 6,
        code: "SAPPHIRE_STAR",
        starsRequired: 700,
        reward: "Electric Bike",
        rewardValue: 80000,
        salaryPercentage: 0.0075,
        benefits: ["Salary: 0.75% on TTO monthly"],
        icon: "💙",
        color: "#0f52ba",
      },
      {
        name: "Emerald Star",
        level: 7,
        code: "EMERALD_STAR",
        starsRequired: 2200,
        reward: "Alto 800",
        rewardValue: 350000,
        salaryPercentage: 0.005,
        benefits: ["Salary: 0.50% on TTO monthly"],
        icon: "💚",
        color: "#50c878",
      },
      {
        name: "Ruby Star",
        level: 8,
        code: "RUBY_STAR",
        starsRequired: 7000,
        reward: "Venue/Bolero",
        rewardValue: 800000,
        salaryPercentage: 0.004,
        benefits: ["Salary: 0.40% on TTO monthly"],
        icon: "❤️",
        color: "#e0115f",
      },
      {
        name: "Diamond Star",
        level: 9,
        code: "DIAMOND_STAR",
        starsRequired: 15000,
        reward: "Thar Roxx",
        rewardValue: 1500000,
        salaryPercentage: 0.003,
        benefits: ["Salary: 0.30% on TTO monthly"],
        icon: "💎",
        color: "#b9f2ff",
      },
      {
        name: "Sales Director",
        level: 10,
        code: "SALES_DIRECTOR",
        starsRequired: 35000,
        reward: "Fortuner",
        rewardValue: 3500000,
        salaryPercentage: 0.0025,
        benefits: ["Salary: 0.25% on TTO monthly"],
        icon: "🏆",
        color: "#ff6b35",
      },
      {
        name: "Ambassador",
        level: 11,
        code: "AMBASSADOR",
        starsRequired: 75000,
        reward: "BMW X5",
        rewardValue: 7500000,
        salaryPercentage: 0.002,
        benefits: ["Salary: 0.20% on TTO monthly"],
        icon: "👑",
        color: "#8b008b",
      },
      {
        name: "Crown",
        level: 12,
        code: "CROWN",
        starsRequired: 160000,
        reward: "Bungalow",
        rewardValue: 25000000,
        salaryPercentage: 0.0015,
        benefits: ["Salary: 0.15% on TTO monthly"],
        icon: "👑",
        color: "#ffd700",
      },
    ];

    for (const rankData of ranks) {
      const existing = await Rank.findOne({ code: rankData.code });

      if (!existing) {
        const rank = new Rank(rankData);
        await rank.save();

        console.log(`✅ Created rank: ${rankData.name}`);
      }
    }
  }

  /**
   * Add Kuwi Stars to a member
   */
  async addKuwiStars(
    userId,
    count,
    source,
    sourceId = null,
    sourceModel = null,
    reason = "",
  ) {
    if (count <= 0) {
      throw new Error("Star count must be positive");
    }

    // Get current total
    const currentTotal = await this.getTotalKuwiStars(userId);

    // Create star record
    const star = new KuwiStar({
      userId: userId,
      count: count,
      source: source,
      sourceId: sourceId,
      sourceModel: sourceModel,
      reason: reason,
      runningTotal: currentTotal + count,
    });

    await star.save();

    // Update user's total stars
    await User.findByIdAndUpdate(userId, {
      $inc: { kuwiStars: count },
    });

    // Check for rank achievements
    await this.checkAndAwardRanks(userId);

    return star;
  }

  /**
   * Get total Kuwi Stars for a user
   */
  async getTotalKuwiStars(userId) {
    const user = await User.findById(userId);

    return user ? user.kuwiStars || 0 : 0;
  }

  /**
   * Get Kuwi Stars history
   */
  async getKuwiStarHistory(userId, limit = 50, skip = 0) {
    const stars = await KuwiStar.find({
      userId: userId,
      status: "ACTIVE",
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await KuwiStar.countDocuments({
      userId: userId,
      status: "ACTIVE",
    });

    return {
      stars,
      total,
      runningTotal: await this.getTotalKuwiStars(userId),
    };
  }

  /**
   * Check if user qualifies for Kuwi Star (special case)
   */
  async checkKuwiStarQualification(userId) {
    const user = await User.findById(userId);

    if (!user) {
      return false;
    }

    // Already has Kuwi Star?
    const hasKuwiStar = await RankAchievement.findOne({
      userId: userId,
      rankName: "Kuwi Star",
      status: "ACHIEVED",
    });

    if (hasKuwiStar) {
      return true;
    }

    // Check direct sponsors
    const directSponsors = await User.countDocuments({
      sponsorId: userId,
    });

    if (directSponsors < 3) {
      return false;
    }

    // Check KBP
    const totalKBP = await Order.aggregate([
      {
        $match: {
          userId: userId,
          orderStatus: "COMPLETED",
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$kbpGenerated",
          },
        },
      },
    ]);

    const kbp = totalKBP.length > 0 ? totalKBP[0].total : 0;

    if (kbp < 3000) {
      return false;
    }

    // Check time limit (15 days from joining)
    const daysSinceJoin = Math.floor(
      (Date.now() - user.joinedDate) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceJoin > 15) {
      return false;
    }

    return true;
  }

  /**
   * Check all rank achievements for a user
   */
  async checkAndAwardRanks(userId) {
    const user = await User.findById(userId);

    if (!user) {
      return;
    }

    const currentStars = user.kuwiStars || 0;

    // Get all ranks sorted by level
    const allRanks = await Rank.find({
      isActive: true,
    }).sort({
      level: 1,
    });

    // Get already achieved ranks
    const achievedRanks = await RankAchievement.find({
      userId: userId,
      status: "ACHIEVED",
    }).select("rankId");

    const achievedRankIds = achievedRanks.map((achievement) =>
      achievement.rankId.toString(),
    );

    let newRankAchieved = false;

    for (const rank of allRanks) {
      // Skip if already achieved
      if (achievedRankIds.includes(rank._id.toString())) {
        continue;
      }

      // Special check for Kuwi Star
      if (rank.code === "KUWI_STAR") {
        const qualifies = await this.checkKuwiStarQualification(userId);

        if (qualifies) {
          await this.achieveRank(userId, rank);
          newRankAchieved = true;
        }

        continue;
      }

      // For all other ranks, check stars required
      if (currentStars >= rank.starsRequired) {
        await this.achieveRank(userId, rank);
        newRankAchieved = true;
      }
    }

    // Update user's current rank (highest achieved)
    const highestAchieved = await RankAchievement.findOne({
      userId: userId,
      status: "ACHIEVED",
    }).sort({
      rankLevel: -1,
    });

    if (highestAchieved) {
      const rank = await Rank.findById(highestAchieved.rankId);

      const currentRank = user.currentRankId
        ? await Rank.findById(user.currentRankId)
        : null;

      if (rank && (!currentRank || rank.level > currentRank.level)) {
        user.currentRankId = rank._id;
        user.rankAchievedAt = new Date();

        await user.save();
      }
    }

    return newRankAchieved;
  }

  /**
   * Check all rank achievements for a user
   * Kept for backward compatibility
   */
  async checkRankAchievements(userId) {
    return this.checkAndAwardRanks(userId);
  }

  /**
   * Achieve a rank for a user
   */
  async achieveRank(userId, rank) {
    // Check if already achieved
    const existing = await RankAchievement.findOne({
      userId: userId,
      rankId: rank._id,
    });

    if (existing) {
      return;
    }

    // Create achievement
    const achievement = new RankAchievement({
      userId: userId,
      rankId: rank._id,
      rankName: rank.name,
      rankLevel: rank.level,
      starsAtAchievement: await this.getTotalKuwiStars(userId),
      reward: rank.reward || "",
      rewardStatus: rank.reward ? "PENDING" : "NOT_APPLICABLE",
      status: "ACHIEVED",
      notes: `Achieved ${rank.name} on ${new Date().toISOString()}`,
    });

    await achievement.save();

    // Update user's current rank
    const user = await User.findById(userId);

    if (user) {
      const currentRank = user.currentRankId
        ? await Rank.findById(user.currentRankId)
        : null;

      if (rank.level > (currentRank ? currentRank.level : 0)) {
        user.currentRankId = rank._id;
        user.rankAchievedAt = new Date();

        await user.save();
      }
    }

    // Add bonus stars if applicable
    if (rank.level === 2) {
      await this.addKuwiStars(
        userId,
        1,
        "RANK_BONUS",
        achievement._id,
        "RankAchievement",
        "Bronze Star achievement bonus",
      );
    }

    console.log(`🌟 User ${userId} achieved rank: ${rank.name}`);

    return achievement;
  }

  /**
   * Get current rank for a user
   */
  async getCurrentRank(userId) {
    const user = await User.findById(userId).populate("currentRankId");

    if (!user || !user.currentRankId) {
      const achievement = await RankAchievement.findOne({
        userId: userId,
        status: "ACHIEVED",
      }).sort({
        rankLevel: -1,
      });

      if (achievement) {
        const rank = await Rank.findById(achievement.rankId);

        return rank || null;
      }

      return null;
    }

    return user.currentRankId;
  }

  /**
   * Get all rank achievements for a user
   */
  async getUserRanks(userId) {
    const achievements = await RankAchievement.find({
      userId: userId,
      status: "ACHIEVED",
    })
      .populate("rankId")
      .sort({
        rankLevel: -1,
      });

    const currentRank = await this.getCurrentRank(userId);

    return {
      current: currentRank,
      achievements: achievements,
      totalRanks: achievements.length,
    };
  }

  /**
   * Get rank progression for a user
   */
  async getRankProgression(userId) {
    const currentStars = await this.getTotalKuwiStars(userId);

    const allRanks = await Rank.find({
      isActive: true,
    }).sort({
      level: 1,
    });

    const achieved = await RankAchievement.find({
      userId: userId,
      status: "ACHIEVED",
    }).select("rankId");

    const achievedIds = achieved.map((achievement) =>
      achievement.rankId.toString(),
    );

    const progression = {
      currentStars,
      achieved: [],
      next: null,
      all: [],
    };

    for (const rank of allRanks) {
      const isAchieved = achievedIds.includes(rank._id.toString());

      progression.all.push({
        rank: rank,
        isAchieved: isAchieved,
        starsNeeded: rank.starsRequired,
        progress:
          rank.starsRequired > 0
            ? Math.min(
                100,
                Math.round((currentStars / rank.starsRequired) * 100),
              )
            : 0,
      });

      if (isAchieved) {
        progression.achieved.push(rank);
      } else if (!progression.next) {
        progression.next = rank;
      }
    }

    return progression;
  }

  /**
   * Calculate rank salary for a user (monthly)
   *
   * This method ONLY calculates the salary.
   * It does not credit the wallet.
   */
  async calculateRankSalary(userId, tto) {
    const rank = await this.getCurrentRank(userId);

    if (!rank || !rank.salaryPercentage || rank.salaryPercentage === 0) {
      return 0;
    }

    return tto * rank.salaryPercentage;
  }

  /**
   * Calculate and credit rank salary for a user
   *
   * Called monthly for all users with rank salary.
   */
  async calculateAndCreditRankSalary(userId, tto, period = null) {
    try {
      // Get user's current rank
      const rank = await this.getCurrentRank(userId);

      if (!rank || !rank.salaryPercentage || rank.salaryPercentage === 0) {
        return {
          success: false,
          message: "No rank salary applicable",
        };
      }

      // Get user's TTO for the period
      const ttoAmount =
        tto !== null && tto !== undefined
          ? Number(tto)
          : await this.getUserTTO(userId, period);

      if (!Number.isFinite(ttoAmount) || ttoAmount <= 0) {
        return {
          success: false,
          message: "No TTO available for this period",
        };
      }

      // Calculate salary
      const salaryAmount = ttoAmount * rank.salaryPercentage;

      if (!Number.isFinite(salaryAmount) || salaryAmount <= 0) {
        return {
          success: false,
          message: "Salary amount is zero",
        };
      }

      // Credit salary to wallet
      const WalletService = require("./wallet.service");

      const creditResult = await WalletService.credit(
        userId,
        salaryAmount,
        "RANK_SALARY",
        null,
        {
          description: `${rank.name} Salary - ${
            rank.salaryPercentage * 100
          }% on TTO`,
          sourceModel: "User",
          kbp: ttoAmount,
          rate: rank.salaryPercentage,
          rankName: rank.name,
          rankLevel: rank.level,
          period: period || new Date().toISOString().slice(0, 7),
        },
      );

      // Create income transaction
      const IncomeTransaction = require("../models/IncomeTransaction");

      const incomeTransaction = new IncomeTransaction({
        userId: userId,
        transactionId: `SAL-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 6)}`.toUpperCase(),
        type: "RANK_SALARY",
        sourceId: userId,
        sourceModel: "User",
        kbp: ttoAmount,
        rate: rank.salaryPercentage,
        grossAmount: salaryAmount,
        capAdjustment: 0,
        creditedAmount: salaryAmount,
        walletType: "INCOME",
        walletId:
          creditResult && creditResult.transaction
            ? creditResult.transaction.walletId
            : null,
        status: "CREDITED",
        processedAt: new Date(),
        metadata: {
          rankName: rank.name,
          rankLevel: rank.level,
          salaryPercentage: rank.salaryPercentage,
          ttoAmount: ttoAmount,
          period: period || new Date().toISOString().slice(0, 7),
        },
      });

      await incomeTransaction.save();

      console.log(
        `💰 Rank Salary credited: ₹${salaryAmount.toFixed(
          2,
        )} to user ${userId} (${rank.name})`,
      );

      return {
        success: true,
        rankName: rank.name,
        salaryPercentage: rank.salaryPercentage,
        ttoAmount: ttoAmount,
        salaryAmount: salaryAmount,
        transaction: incomeTransaction,
      };
    } catch (error) {
      console.error("❌ Error calculating rank salary:", error);

      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Get user's TTO for a period
   */
  async getUserTTO(userId, period = null) {
    const TTORecord = require("../models/TTORecord");

    let query = {
      userId: userId,
    };

    if (period) {
      query.period = period;
    } else {
      // Get current month
      const now = new Date();

      const currentPeriod = `${now.getFullYear()}-${String(
        now.getMonth() + 1,
      ).padStart(2, "0")}`;

      query.period = currentPeriod;
    }

    const record = await TTORecord.findOne(query);

    return record ? record.totalKBP || 0 : 0;
  }

  /**
   * Process rank salaries for all eligible users
   *
   * Monthly job.
   */
  async processAllRankSalaries(period = null) {
    // Get all users with achieved ranks
    const usersWithSalary = await RankAchievement.aggregate([
      {
        $match: {
          status: "ACHIEVED",
        },
      },
      {
        $group: {
          _id: "$userId",
          highestRank: {
            $max: "$rankLevel",
          },
        },
      },
    ]);

    // Get ranks with salary
    const salaryRanks = await Rank.find({
      salaryPercentage: {
        $gt: 0,
      },
      isActive: true,
    });

    // If there are no salary ranks, nothing to process
    if (!salaryRanks.length) {
      return [];
    }

    const results = [];

    for (const userData of usersWithSalary) {
      const userId = userData._id;

      // Get user's achieved ranks
      const userRanks = await RankAchievement.find({
        userId: userId,
        status: "ACHIEVED",
        rankLevel: {
          $lte: userData.highestRank,
        },
      }).populate("rankId");

      // Find highest achieved rank that has salary
      const highestSalaryRank = userRanks
        .filter(
          (achievement) =>
            achievement.rankId && achievement.rankId.salaryPercentage > 0,
        )
        .sort((a, b) => b.rankLevel - a.rankLevel)[0];

      if (!highestSalaryRank) {
        continue;
      }

      // Calculate and credit salary
      const result = await this.calculateAndCreditRankSalary(
        userId,
        null,
        period,
      );

      results.push({
        userId,
        rankName: highestSalaryRank.rankName,
        rankLevel: highestSalaryRank.rankLevel,
        ...result,
      });
    }

    return results;
  }

  /**
   * Process rewards for achieved ranks
   */
  async processReward(achievementId) {
    const achievement = await RankAchievement.findById(achievementId);

    if (!achievement) {
      throw new Error("Achievement not found");
    }

    if (achievement.rewardStatus === "DELIVERED") {
      throw new Error("Reward already delivered");
    }

    achievement.rewardStatus = "PROCESSED";
    achievement.rewardDeliveredAt = new Date();

    await achievement.save();

    return achievement;
  }

  /**
   * Admin: Award manual stars
   */
  async adminAddStars(userId, count, reason, adminId) {
    return await this.addKuwiStars(
      userId,
      count,
      "ADMIN_ADJUSTMENT",
      adminId,
      "User",
      reason,
    );
  }

  /**
   * Process all ranks for all users
   *
   * Admin batch job.
   */
  async processAllRanks() {
    const users = await User.find({
      status: "ACTIVE",
    });

    let processed = 0;
    let achievements = 0;

    for (const user of users) {
      processed++;

      const result = await this.checkAndAwardRanks(user._id);

      if (result) {
        achievements++;
      }
    }

    return {
      processed,
      achievements,
    };
  }
}

module.exports = new RankService();
