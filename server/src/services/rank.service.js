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
   * "Uncommon Ranks and Rewards" — every tier requires the SAME verified
   * star count on BOTH legs, not just a combined total (e.g. Bronze Star =
   * "6 Kuwi Star, Left 3 Star : Right 3 Star" — a lopsided 6-Left/0-Right
   * downline does NOT qualify). starsRequired is always published as an
   * even split in the comp plan (6, 20, 70, 200, 700, 2200, 7000, 15000,
   * 35000, 75000, 160000 -> exactly half on each leg); Math.ceil guards
   * against a future odd/misconfigured value by never under-requiring.
   *
   * `requiredTotal` is the rank's OWN raw `starsRequired` — compared
   * directly against the member's live lifetime left/right star count, NOT
   * a cumulative sum across every prior tier. An earlier version of this
   * method compared against a running sum of every tier's requirement
   * (reading the comp plan's "Previous rank star will lock... only carry
   * forward star will count in the next rank" language as "this rank needs
   * that many stars ON TOP OF what the previous rank already used"). That
   * was wrong: the comp plan's own explicit per-rank numbers ("Left 10
   * Stars : Right 10 Stars" for Silver Star, etc.) are each already exactly
   * half of that rank's raw `starsRequired` — not half of a cumulative sum
   * — confirmed directly by a member-reported bug where Silver Star's page
   * showed "need 13 on each leg" (the cumulative Bronze+Silver figure)
   * instead of the correct 10. "Locks"/"carry forward" describes ranks
   * being permanent, ever-growing milestones on the SAME live star count —
   * not a per-rank-reset ledger.
   */
  isBalancedRankQualified(leftStars, rightStars, requiredTotal) {
    const requiredPerLeg = Math.ceil((requiredTotal || 0) / 2);
    return leftStars >= requiredPerLeg && rightStars >= requiredPerLeg;
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

    // Entry gate ("Rank and Reward starts from 1st Pair Matching only" +
    // the 15-day Kuwi Star window): applies ONLY to the member being
    // evaluated for their OWN rank here — NOT to how their downline members
    // are counted as stars (SalaryService.checkIsKuwiStar alone handles
    // that, deliberately without this stricter gate; see its docstring).
    const isSelfQualified =
      (await SalaryService.checkIsKuwiStar(userId)) &&
      (await SalaryService.checkKuwiStarSelfEntryGate(userId));
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

    // "All requirements of Rewards achieving will be calculated next to
    // next basis" — ranks are awarded strictly in level order within this
    // pass so a member can never be recorded as having a higher rank than
    // one they haven't also crossed on the way up. Each rank's own raw
    // starsRequired is itself monotonically increasing (6, 20, 70, 200,
    // ...), so this loop naturally never skips a tier: qualifying for rank
    // N's threshold always means rank N-1's smaller threshold was already
    // satisfied on the same live star count.
    for (const rank of allRanks) {
      // Skip if already achieved
      if (achievedRankIds.includes(rank._id.toString())) {
        continue;
      }

      if (this.isBalancedRankQualified(leftStars, rightStars, rank.starsRequired)) {
        await this.achieveRank(userId, rank, currentStars);
        newRankAchieved = true;
      } else {
        // Not qualified for this tier yet -> can't qualify for any higher
        // tier either this pass (requirements only increase with level).
        break;
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
   * Get current rank for a user — the highest rank on their PERMANENT
   * achievement record, after self-healing (picking up any newly-qualified
   * rank first).
   *
   * WHY THIS CHANGED (again): the previous version re-derived "current
   * rank" from scratch on every call — re-running the full live entry gate
   * (self 3-direct/2:1-1:2/KBP check, 1st-pair-match, 15-day window) and
   * the Left/Right star balance check every single time. But
   * RankAchievement is explicitly modeled as permanent ("once achieved,
   * ranks are permanent" — see the schema comment), and checkAndAwardRanks
   * already persists a record the moment a tier is earned. A live
   * re-derivation can only ever AGREE with that record or regress below
   * it — it can never show something MORE achieved than what's on file —
   * so re-deriving live bought nothing except a real failure mode: any
   * momentary dip in the member's OWN live qualification (e.g. one direct
   * referral briefly going inactive) made an already-earned, permanently
   * recorded rank vanish from the Dashboard, even while the Rank & Rewards
   * page — reading the same permanent achievement list — kept correctly
   * showing it as Achieved. That exact split (2 ranks Achieved on the Rank
   * page, "Not Achieved" on the Dashboard) is the bug this fixes.
   *
   * Now both surfaces read the same source of truth: self-heal via
   * checkAndAwardRanks (idempotent — awards anything newly qualified,
   * never revokes anything already recorded), then return the highest
   * ACHIEVED record. This also fixes Leadership/Cheque Match Bonus
   * (income.service.js#isLeadershipQualified and
   * #processLeadershipBonusForMatch both gate on getCurrentRank) and the
   * Gold-Star-and-above monthly TTO salary — both now correctly stay
   * qualified once a rank is earned, instead of silently lapsing.
   */
  async getCurrentRank(userId) {
    await this.checkAndAwardRanks(userId).catch((err) => {
      console.error(`Rank sync failed for user ${userId}:`, err.message);
    });

    const highestAchieved = await RankAchievement.findOne({
      userId,
      status: "ACHIEVED",
    })
      .sort({ rankLevel: -1 })
      .populate("rankId")
      .lean();

    return highestAchieved ? highestAchieved.rankId : null;
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

    // Progress toward each tier is measured against that tier's OWN raw
    // starsRequired (halved per leg) — NOT a cumulative sum across prior
    // tiers (see isBalancedRankQualified's docstring for why that was
    // reverted) — and against the smaller (limiting) leg, matching what
    // actually gates achievement in checkAndAwardRanks, not the combined
    // total, which would read misleadingly high for a lopsided downline.
    const limitingLegStars = Math.min(leftStars, rightStars);

    const progression = {
      currentStars,
      currentLeftStars: leftStars,
      currentRightStars: rightStars,
      achieved: [],
      next: null,
      all: [],
    };

    for (const rank of allRanks) {
      const isAchieved = achievedIds.includes(rank._id.toString());
      const requiredPerLeg = Math.ceil((rank.starsRequired || 0) / 2);

      progression.all.push({
        rank: rank,
        isAchieved: isAchieved,
        starsNeeded: rank.starsRequired,
        requiredPerLeg,
        progress: isAchieved
          ? 100
          : requiredPerLeg > 0
            ? Math.min(100, Math.round((limitingLegStars / requiredPerLeg) * 100))
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
   * Get user's TTO for a period — delegates to
   * SalaryService.getTeamTurnoverForMonth(), which computes real Team Turn
   * Over from Order records and persists it to TTORecord on first read
   * (nothing else in this codebase ever wrote that collection, so a plain
   * TTORecord.findOne() here always returned nothing and every rank-salary
   * payout was silently ₹0 regardless of real team business).
   */
  async getUserTTO(userId, period = null) {
    const SalaryService = require("./salary.service");
    const monthString = period || SalaryService.getMonthString(new Date());
    return SalaryService.getTeamTurnoverForMonth(userId, monthString);
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
    return this.updateRewardStatus(achievementId, "PROCESSED");
  }

  /**
   * Admin: move a physical/one-time reward (Diary+Pen, Executive Bag,
   * Branded Watch, ... up to Bungalow) through its fulfillment lifecycle —
   * PENDING -> PROCESSED -> DELIVERED. Used by the Admin "Member
   * Achievements" panel so reward fulfillment can actually be tracked
   * instead of every achievement sitting at PENDING forever.
   */
  async updateRewardStatus(achievementId, newStatus, adminId = null, notes = "") {
    const VALID_STATUSES = ["PENDING", "PROCESSED", "DELIVERED", "NOT_APPLICABLE"];
    if (!VALID_STATUSES.includes(newStatus)) {
      throw new Error(`Invalid reward status: ${newStatus}`);
    }

    const achievement = await RankAchievement.findById(achievementId);

    if (!achievement) {
      throw new Error("Achievement not found");
    }

    achievement.rewardStatus = newStatus;
    achievement.rewardDeliveredAt = newStatus === "DELIVERED" ? new Date() : achievement.rewardDeliveredAt;
    if (adminId) achievement.verifiedBy = adminId;
    if (notes) achievement.notes = `${achievement.notes ? achievement.notes + " | " : ""}${notes}`;

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