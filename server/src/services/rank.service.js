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
   * Check if user qualifies for Kuwi Star (special case).
   *
   * Business rule (KUWIFR compensation plan): "Rank and Reward starts from
   * 1st Pair Matching only" + "2:1 or 1:2 Pair Matching, but Member has to
   * be Required 3 Direct Sponsor under the Left and Right side" within a
   * time limit (default 15 days) from joining. Thresholds are read live from
   * the KUWI_STAR Rank document (kuwiStarRequirements) so an admin can change
   * them from the admin panel without a code change — they are NOT hardcoded.
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

    // Pull dynamic requirements from the KUWI_STAR rank document (admin-editable).
    const starRank = await Rank.findOne({ code: "KUWI_STAR" });
    const requiredDirects = starRank?.kuwiStarRequirements?.directSponsors ?? 3;
    const timeLimitDays = starRank?.kuwiStarRequirements?.timeLimit ?? 15;

    // Rank & Reward starts from 1st Pair Matching only — a first pair must
    // have actually formed in the real binary tree (2:1 or 1:2), not merely
    // "enough KBP purchased".
    const node = await BinaryNode.findOne({ userId });
    if (!node || (node.pairCount || 0) < 1) {
      return false;
    }

    // Direct sponsors must be split across both legs (2:1 or 1:2) and total
    // at least the configured requirement (default 3).
    const [leftDirects, rightDirects] = await Promise.all([
      User.countDocuments({ sponsorId: userId, binarySide: "left" }),
      User.countDocuments({ sponsorId: userId, binarySide: "right" }),
    ]);
    const totalDirects = leftDirects + rightDirects;

    if (totalDirects < requiredDirects) {
      return false;
    }
    const hasSplitRatio =
      (leftDirects >= 2 && rightDirects >= 1) ||
      (leftDirects >= 1 && rightDirects >= 2);
    if (!hasSplitRatio) {
      return false;
    }

    // Check time limit from joining (0 / falsy disables the time limit).
    if (timeLimitDays) {
      const daysSinceJoin = Math.floor(
        (Date.now() - new Date(user.joinedDate || user.createdAt)) / (1000 * 60 * 60 * 24),
      );
      if (daysSinceJoin > timeLimitDays) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check all rank achievements for a user — and PERSIST them (permanent
   * RankAchievement records with a real achieved-on date), so the Admin
   * panel has real history to show.
   *
   * WHY THIS CHANGED: this used to gate everything on `user.kuwiStars` (a
   * counter incremented +1 only by the member's OWN package purchase,
   * via addKuwiStars()) and a separate `checkKuwiStarQualification()`
   * definition of "Kuwi Star". Neither has anything to do with what the
   * rank tiers (Bronze:6, Silver:20, ... Gold Star:200) actually measure —
   * the member's live, verified LEFT/RIGHT downline star count — which is
   * exactly why a member with a real, large, genuinely-qualifying downline
   * (e.g. 56 members, 12 matched stars) could sit at "Member (No Rank Yet)"
   * forever even after their own purchase counter had long since caught up
   * with a low tier's threshold, while a member who bought several
   * packages themselves (but built no real team) could rack up
   * `kuwiStars` and wrongly "achieve" high tiers.
   *
   * Now uses the exact same live entry-gate + subtree-star computation as
   * getCurrentRank() below (SalaryService.checkIsKuwiStar +
   * countVerifiedSubtreeStars) — the source of truth already proven
   * correct for the Dashboard/Remuneration cards — so the persisted
   * achievement history and the live "current rank" display can never
   * disagree with each other again.
   */
  async checkAndAwardRanks(userId) {
    const SalaryService = require("./salary.service");
    const user = await User.findById(userId);

    if (!user) {
      return false;
    }

    // Entry gate ("Rank and Reward starts from 1st Pair Matching only"): no
    // rank — not even the entry-level Kuwi Star tier (starsRequired: 0) —
    // is awarded until the member themselves meets the live Kuwi Star bar.
    const isSelfQualified = await SalaryService.checkIsKuwiStar(userId);
    if (!isSelfQualified) {
      return false;
    }

    const { leftStars, rightStars } =
      await SalaryService.countVerifiedSubtreeStars(userId);
    const currentStars = leftStars + rightStars;

    // Get all ranks sorted by level
    const allRanks = await Rank.find({
      isActive: true,
    }).sort({
      level: 1,
    });

    // Get already achieved ranks — achievements are permanent once
    // recorded, so a rank never "un-achieves" even if the live star count
    // were to later dip.
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

      if (currentStars >= (rank.starsRequired || 0)) {
        await this.achieveRank(userId, rank, currentStars);
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
        user.rankAchievedAt = user.rankAchievedAt || new Date();

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
   * Achieve a rank for a user.
   *
   * `starsAtAchievement` should be the caller's already-computed LIVE star
   * count (SalaryService.countVerifiedSubtreeStars left+right) — passed in
   * explicitly rather than re-read here via the old `user.kuwiStars`
   * counter, which is disconnected from what actually qualifies a rank.
   */
  async achieveRank(userId, rank, starsAtAchievement = null) {
    // Check if already achieved
    const existing = await RankAchievement.findOne({
      userId: userId,
      rankId: rank._id,
    });

    if (existing) {
      return existing;
    }

    const resolvedStars =
      typeof starsAtAchievement === "number"
        ? starsAtAchievement
        : await this.getTotalKuwiStars(userId);

    // Create achievement
    const achievement = new RankAchievement({
      userId: userId,
      rankId: rank._id,
      rankName: rank.name,
      rankLevel: rank.level,
      starsAtAchievement: resolvedStars,
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

    console.log(`🌟 User ${userId} achieved rank: ${rank.name}`);

    return achievement;
  }

  /**
   * Get current rank for a user — LIVE evaluation from the real Left/Right
   * downline Kuwi-Star count, the same metric SalaryService already uses
   * for the Remuneration (Gold Star) progress card, e.g. "12 Matched Stars
   * (4 Left : 8 Right)".
   *
   * WHY THIS CHANGED: this used to trust `user.currentRankId`, which is
   * only ever set by checkAndAwardRanks() — and that method is only
   * invoked when the member THEMSELVES places an order
   * (product.service.js), where it compares `user.kuwiStars` (a counter
   * that increments by exactly 1 per the member's OWN package purchase)
   * against each rank's starsRequired. That has nothing to do with "how
   * many of your downline are themselves Kuwi-Star qualified, split
   * Left/Right" — the metric the compensation plan's rank tiers
   * (Bronze:6, Silver:20, Platinum:70, Gold Star:200, ...) actually
   * describe, and the one already proven correct on the Remuneration
   * card. A member with a large, genuinely qualifying downline (e.g. 56
   * members, 12 matched stars) could show "Not Achieved" forever, because
   * their own purchase counter never moved — this is the exact bug
   * reported against the live dashboard. Fixing it here also fixes
   * Leadership/Cheque Match Bonus (income.service.js#isLeadershipQualified
   * and #processLeadershipBonusForMatch both gate on getCurrentRank), which
   * was silently never qualifying anyone for the same reason.
   */
  async getCurrentRank(userId) {
    const SalaryService = require("./salary.service");

    // Entry gate ("Rank and Reward starts from 1st Pair Matching only"): a
    // member must themselves meet the Kuwi Star bar — 3+ active directs in
    // a 2:1/1:2 split with >=3,000 KBP, no time limit — before any tier
    // applies. This is the same self-qualification check already used to
    // count a member as a "star" inside someone else's downline.
    const isSelfQualified = await SalaryService.checkIsKuwiStar(userId);
    if (!isSelfQualified) return null;

    const { leftStars, rightStars } =
      await SalaryService.countVerifiedSubtreeStars(userId);
    const totalStars = leftStars + rightStars;

    const allRanks = await Rank.find({ isActive: true })
      .sort({ level: -1 })
      .lean();
    const qualifiedRank = allRanks.find(
      (r) => totalStars >= (r.starsRequired || 0),
    );

    // Falls back to the lowest-level active rank (Kuwi Star, starsRequired
    // 0) if no higher tier's threshold is met yet — never null once the
    // entry gate above has been passed.
    return qualifiedRank || allRanks[allRanks.length - 1] || null;
  }

  /**
   * Get all rank achievements for a user — for the Member "Ranks &
   * Progression" page and the Admin per-member lookup.
   *
   * Self-heals before reading: re-runs checkAndAwardRanks() so a member
   * whose downline grew since their last match/order event (or who has
   * simply never triggered one) still sees fully live, correct data the
   * moment they open the page — the achievement history doesn't depend on
   * a background job having already run for them.
   */
  async getUserRanks(userId) {
    const SalaryService = require("./salary.service");

    await this.checkAndAwardRanks(userId).catch((err) => {
      console.error(`Rank sync failed for user ${userId}:`, err.message);
    });

    const [achievements, currentRank, { leftStars, rightStars }] =
      await Promise.all([
        RankAchievement.find({ userId: userId, status: "ACHIEVED" })
          .populate("rankId")
          .sort({ rankLevel: -1 }),
        this.getCurrentRank(userId),
        SalaryService.countVerifiedSubtreeStars(userId),
      ]);

    return {
      current: currentRank,
      currentStars: leftStars + rightStars,
      currentLeftStars: leftStars,
      currentRightStars: rightStars,
      achievements: achievements,
      totalRanks: achievements.length,
    };
  }

  /**
   * Get rank progression for a user
   */
  async getRankProgression(userId) {
    const SalaryService = require("./salary.service");
    const { leftStars, rightStars } =
      await SalaryService.countVerifiedSubtreeStars(userId);
    const currentStars = leftStars + rightStars;

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

      // Credit salary to the dedicated Salary wallet (NOT the income wallet —
      // rank salary is a % on Team Turn Over, distinct from referral/matching/
      // leadership income and from repurchase income).
      const WalletService = require("./wallet.service");

      const creditResult = await WalletService.creditSalary(
        userId,
        salaryAmount,
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
        "RANK_SALARY",
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
        walletType: "SALARY",
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