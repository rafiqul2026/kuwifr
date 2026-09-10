// server/src/services/salary.service.js
const User = require('../models/User');
const DownlineService = require('./downline.service');
const Wallet = require('../models/Wallet');
const SalaryLog = require('../models/SalaryLog');
const TTORecord = require('../models/TTORecord');
const WalletService = require('./wallet.service');
const BinaryNode = require('../models/BinaryNode');
const Order = require('../models/Order');

// "Real, completed order" — this codebase writes two different completion
// signals depending on which checkout path created the order (see
// user.controller.js / fund.service.js's identical condition); match both
// so a real order is never missed.
const REAL_ORDER_MATCH = {
  $or: [
    { orderStatus: { $in: ['COMPLETED', 'DELIVERED'] } },
    { status: 'COMPLETED' }
  ]
};

// "Uncommon Ranks and Rewards" — the Kuwi Star's 15-day qualification
// window (3 directs, 2:1/1:2 split, >=3,000 KBP, all within 15 days of the
// member's own join date) is enforced ONLY for members who join on or
// after this date. Existing members who joined earlier are grandfathered —
// their qualification, once met, has no deadline. This avoids retroactively
// stripping already-earned Kuwi Star status (and everything built on it —
// every higher rank depends on downline members counting as verified
// stars) for a deadline the system never actually enforced before now.
const KUWI_STAR_TIME_LIMIT_ENFORCED_FROM = new Date('2026-09-10T00:00:00.000Z');

/**
 * 📦 5-Tier Official Package KBP Resolution
 */
const resolveUserKbp = (userDoc) => {
  if (!userDoc || (userDoc.status || '').toUpperCase() !== 'ACTIVE') return 0;

  if (userDoc.activePackageId && typeof userDoc.activePackageId === 'object') {
    if (typeof userDoc.activePackageId.kbp === 'number' && userDoc.activePackageId.kbp > 0) {
      return userDoc.activePackageId.kbp;
    }
  }

  const pkgName = (userDoc.activePackageId?.name || userDoc.currentPackage || '').toUpperCase();
  if (pkgName.includes('TITANIUM')) return 50000;
  if (pkgName.includes('ELITE')) return 10000;
  if (pkgName.includes('LIFESAFE') || pkgName.includes('LIFE SAFE')) return 7500;
  if (pkgName.includes('GROWTH')) return 5000;
  return 1000; // Starter Package default
};

/**
 * 🏆 Strictly checks if a specific user qualifies as a Kuwi Star
 * Requirement: 3 active direct referrals, 2:1 or 1:2 ratio, minimum 3,000 KBP total
 *
 * This is the SHARED star definition — it is called both to evaluate a
 * member's own status and, via countVerifiedSubtreeStars() below, once per
 * DOWNLINE member to decide whether THEY count as one of someone else's
 * Left/Right stars. It deliberately does NOT include the "1st Pair
 * Matching" or "15-day window" conditions — those describe when a member
 * becomes eligible for THEIR OWN rank (see
 * RankService.checkSelfEntryGate below, which layers them on top of this
 * check) and were briefly folded in here directly. That broke downline star
 * counting network-wide: a downline member who genuinely meets the
 * 3-direct/ratio/KBP bar but hasn't personally triggered their own binary
 * pair match yet (most leaf-level members never do) stopped counting as a
 * star for their upline, so real accounts with a real, previously-verified
 * team (e.g. 12 matched stars, Bronze Star achieved) suddenly showed 0/0
 * stars and "Not Achieved" again. Keeping this function to just the star
 * definition, and applying the pair-match/time-limit gate only to the
 * member being evaluated for their OWN rank, fixes that regression.
 */
const checkIsKuwiStar = async (userId) => {
  const directActives = await User.find({
    sponsorId: userId,
    status: 'ACTIVE'
  }).populate('activePackageId').lean();

  if (!directActives || directActives.length < 3) return false;

  let leftDirects = 0;
  let rightDirects = 0;
  let totalDirectKbp = 0;

  for (const direct of directActives) {
    const kbp = resolveUserKbp(direct);
    if (kbp > 0) {
      totalDirectKbp += kbp;
      const side = String(direct.binarySide || '').toLowerCase();
      if (side === 'left') leftDirects++;
      else if (side === 'right') rightDirects++;
    }
  }

  const isRatioMet = (leftDirects >= 2 && rightDirects >= 1) || (leftDirects >= 1 && rightDirects >= 2);
  const isVolumeMet = totalDirectKbp >= 3000;

  return isRatioMet && isVolumeMet;
};

/**
 * Additional gate for a member's OWN Kuwi Star / rank eligibility only —
 * NOT used when counting a downline member as someone else's star (see
 * checkIsKuwiStar's comment above for why).
 *
 *   - "Rank and Reward starts from 1st Pair Matching only": the member must
 *     already have at least one real binary pair match (BinaryNode.pairCount
 *     >= 1).
 *   - "Time Limit: 15 days from the date of joining": only enforced for
 *     members who join on/after KUWI_STAR_TIME_LIMIT_ENFORCED_FROM above;
 *     earlier members are grandfathered (no deadline).
 */
const checkKuwiStarSelfEntryGate = async (userId) => {
  const node = await BinaryNode.findOne({ userId }).select('pairCount').lean();
  if (!node || (node.pairCount || 0) < 1) return false;

  const user = await User.findById(userId).select('joinedDate createdAt').lean();
  const joinedDate = new Date(user?.joinedDate || user?.createdAt || 0);
  if (joinedDate >= KUWI_STAR_TIME_LIMIT_ENFORCED_FROM) {
    const daysSinceJoin = Math.floor((Date.now() - joinedDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceJoin > 15) return false;
  }

  return true;
};

/**
 * 🔢 Counts actual verified Kuwi Star qualified downlines in Left and Right branches
 *
 * Real-money-relevant: this feeds Gold Star (and above) monthly salary
 * qualification below. It used to walk the `Referral` collection, which is
 * a best-effort mirror of User.sponsorId written once at registration
 * inside a try/catch that can silently fail (see referral.service.js) — so
 * a member with a genuinely large downline could be under-counted here and
 * wrongly denied (or short-paid) their monthly rank salary. Now computed
 * from the live, always-correct User.sponsorId graph via DownlineService
 * (a single $graphLookup query), so there is no separate, driftable
 * collection this financial calculation depends on.
 */
const countVerifiedSubtreeStars = async (userId) => {
  const downlineMembers = await DownlineService.getFullDownlineIds(userId);
  let leftStars = 0;
  let rightStars = 0;

  for (const member of downlineMembers) {
    const isStar = await checkIsKuwiStar(member._id);
    if (isStar) {
      const side = String(member.binarySide || '').toLowerCase();
      if (side === 'left') leftStars++;
      else if (side === 'right') rightStars++;
    }
  }

  return { leftStars, rightStars };
};

// ============================================================================
// MONTHLY SALARY (GOLD STAR) SETTLEMENT ENGINE
//
// Implements the rules implied by the SalaryLog schema:
//   - Gold Star threshold: 200 total qualified-star downline count
//   - Monthly growth requirement: >= 10% growth in total stars vs prior month
//   - 50:50 leg balance: left/right star growth must be reasonably even
//   - Payout: 1% of that month's Team Turn Over (TTO) if all conditions pass
//
// ASSUMPTIONS MADE (please verify against your actual comp-plan document —
// these were not fully specified in the existing code and had to be inferred
// from field names in SalaryLog.js and wallet.controller.js):
//   1. "Star" count = number of star-qualified downline members on each leg,
//      as computed by countVerifiedSubtreeStars() (already existed).
//   2. "Starting" baseline for a month = the currentLeftStar/currentRightStar
//      recorded in the PREVIOUS month's SalaryLog. If no prior log exists
//      (first-ever evaluation for this user), growth can't be measured, so
//      the growth requirement is waived for that first month only.
//   3. "50:50 balanced" = neither leg's growth is less than half the other
//      leg's growth (i.e. smaller/larger growth ratio >= 0.5). Adjust
//      REQUIRED_BALANCE_RATIO below if your real rule is stricter/looser.
//   4. "TTO" (Team Turn Over) = the totalKBP field on the TTORecord document
//      for that user+month, since no separate currency-based TTO figure
//      exists anywhere in the schema. If you track TTO in ₹ elsewhere,
//      swap the lookup in getTeamTurnoverForMonth() below.
//   5. If no TTORecord exists for the month, the member can still be marked
//      "qualified" on stars/growth/balance, but salaryAmount is ₹0 (we never
//      fabricate a payout amount from missing turnover data).
// ============================================================================

const GOLD_STAR_THRESHOLD = 200;
const REQUIRED_GROWTH_PERCENT = 10;
const REQUIRED_BALANCE_RATIO = 0.5;
const SALARY_PERCENTAGE = 1; // 1% of TTO

/**
 * Format a Date as "YYYY-MM".
 */
function getMonthString(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Returns the "YYYY-MM" string for the month immediately before `monthString`.
 */
function getPreviousMonthString(monthString) {
  const [year, month] = monthString.split('-').map(Number);
  const prevDate = new Date(year, month - 2, 1); // month is 1-indexed in the string
  return getMonthString(prevDate);
}

/**
 * Sum real Order.kbpGenerated for a set of user IDs within a date range.
 */
async function aggregateTeamKbp(userIds, periodStart, periodEnd) {
  if (!userIds || userIds.length === 0) return 0;
  const agg = await Order.aggregate([
    {
      $match: {
        userId: { $in: userIds },
        createdAt: { $gte: periodStart, $lte: periodEnd },
        ...REAL_ORDER_MATCH
      }
    },
    { $group: { _id: null, total: { $sum: '$kbpGenerated' } } }
  ]);
  return agg[0]?.total || 0;
}

/**
 * Compute this member's real Team (self + full downline) Turn Over in KBP
 * for a "YYYY-MM" period from real Order records, and persist it to
 * TTORecord.
 *
 * WHY THIS EXISTS: nothing in this codebase ever wrote a TTORecord — it was
 * a schema with zero producers, only readers (this function's old body,
 * rank.service.js#getUserTTO, and the Admin TTO history endpoint). Every
 * "Team Turn Over" figure — this live dashboard/wallet card, and the actual
 * monthly Gold-Star-and-above 1% salary settlement — was silently reading
 * an always-empty collection and showing/paying ₹0 regardless of how much
 * real business the team did. Order documents carry `createdAt` and
 * `kbpGenerated`, so real turnover for any month (current or already
 * closed) can be computed straight from them.
 */
async function computeAndPersistTTO(userId, monthString) {
  const [year, month] = monthString.split('-').map(Number);
  const periodStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const BinaryService = require('./binary.service');
  const { leftIds, rightIds } = await BinaryService.getBranchUserIds(userId);

  const [leftTeamKBP, rightTeamKBP, selfKBP] = await Promise.all([
    aggregateTeamKbp(leftIds, periodStart, periodEnd),
    aggregateTeamKbp(rightIds, periodStart, periodEnd),
    aggregateTeamKbp([userId], periodStart, periodEnd)
  ]);

  const totalKBP = leftTeamKBP + rightTeamKBP + selfKBP;
  const teamIds = [userId, ...leftIds, ...rightIds];
  const activeMembers = await User.countDocuments({ _id: { $in: teamIds }, status: 'ACTIVE' });

  const record = await TTORecord.findOneAndUpdate(
    { userId, period: monthString },
    {
      userId,
      period: monthString,
      periodStart,
      periodEnd,
      totalKBP,
      leftTeamKBP,
      rightTeamKBP,
      activeMembers,
      status: 'CALCULATED',
      calculatedAt: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return record;
}

/**
 * Look up this member's Team Turn Over for a given month — computing and
 * persisting it first if there's no record yet, or if `monthString` is the
 * CURRENT (still in-progress) month, so this always reflects real, live
 * business rather than a stale or missing snapshot. An already-closed past
 * month that has already been computed (and possibly already paid out via
 * processMonthlySalaryPayout) is read as-is and never silently recalculated,
 * so a historical payout figure can't shift under it.
 */
async function getTeamTurnoverForMonth(userId, monthString) {
  const currentMonth = getMonthString(new Date());
  let record = await TTORecord.findOne({ userId, period: monthString }).lean();

  if (!record || monthString === currentMonth) {
    record = await computeAndPersistTTO(userId, monthString);
  }

  return record ? (record.totalKBP || 0) : 0;
}

/**
 * Core, side-effect-free evaluation shared by both the live dashboard preview
 * and the actual monthly settlement. Does NOT read/write SalaryLog itself for
 * the "current" baseline lookup beyond reading the previous month's log.
 */
async function evaluateStarQualification(userId, month) {
  // 1. Current star counts for this evaluation period.
  const { leftStars: currentLeftStar, rightStars: currentRightStar } =
    await countVerifiedSubtreeStars(userId);
  const totalStarAtEvaluation = currentLeftStar + currentRightStar;

  // 2. Baseline from the previous month's log, if any.
  const previousMonth = getPreviousMonthString(month);
  const previousLog = await SalaryLog.findOne({ userId, month: previousMonth }).lean();
  const startingLeftStar = previousLog ? (previousLog.currentLeftStar || 0) : 0;
  const startingRightStar = previousLog ? (previousLog.currentRightStar || 0) : 0;
  const isFirstEvaluation = !previousLog;

  // 3. Growth.
  const leftGrowth = currentLeftStar - startingLeftStar;
  const rightGrowth = currentRightStar - startingRightStar;
  const totalGrowth = leftGrowth + rightGrowth;
  const startingTotal = startingLeftStar + startingRightStar;

  let growthPercentageAchieved;
  if (startingTotal > 0) {
    growthPercentageAchieved = (totalGrowth / startingTotal) * 100;
  } else {
    // No baseline to measure growth against (first-ever evaluation).
    growthPercentageAchieved = totalStarAtEvaluation > 0 ? 100 : 0;
  }

  // 4. 50:50 leg balance on this month's growth.
  let isRatioBalanced;
  if (isFirstEvaluation) {
    isRatioBalanced = true; // nothing to compare yet
  } else if (leftGrowth <= 0 || rightGrowth <= 0) {
    isRatioBalanced = false; // one leg had zero/negative growth — not balanced
  } else {
    const ratio = Math.min(leftGrowth, rightGrowth) / Math.max(leftGrowth, rightGrowth);
    isRatioBalanced = ratio >= REQUIRED_BALANCE_RATIO;
  }

  // 5. Qualification checks.
  const meetsStarThreshold = totalStarAtEvaluation >= GOLD_STAR_THRESHOLD;
  const meetsGrowthRequirement = isFirstEvaluation || growthPercentageAchieved >= REQUIRED_GROWTH_PERCENT;

  const failureReasons = [];
  if (!meetsStarThreshold) {
    failureReasons.push(`Total stars ${totalStarAtEvaluation} below required ${GOLD_STAR_THRESHOLD}`);
  }
  if (!meetsGrowthRequirement) {
    failureReasons.push(`Monthly growth ${growthPercentageAchieved.toFixed(2)}% below required ${REQUIRED_GROWTH_PERCENT}%`);
  }
  if (!isRatioBalanced) {
    failureReasons.push('Left/Right growth is not balanced 50:50');
  }

  const isQualified = meetsStarThreshold && meetsGrowthRequirement && isRatioBalanced;

  // 6. Team Turn Over and the salary that would result if qualified.
  const teamTurnoverAmount = await getTeamTurnoverForMonth(userId, month);
  const salaryAmount = isQualified ? Math.round(teamTurnoverAmount * (SALARY_PERCENTAGE / 100)) : 0;

  return {
    month,
    currentLeftStar,
    currentRightStar,
    totalStarAtEvaluation,
    startingLeftStar,
    startingRightStar,
    isFirstEvaluation,
    leftGrowth,
    rightGrowth,
    totalGrowth,
    growthPercentageAchieved,
    isRatioBalanced,
    meetsStarThreshold,
    meetsGrowthRequirement,
    isQualified,
    failureReasons,
    teamTurnoverAmount,
    salaryAmount
  };
}

/**
 * 📊 Live Salary Progress for Dashboard (1% TTO)
 * Read-only preview of the CURRENT (in-progress) month's evaluation —
 * nothing is persisted or paid here. Field names match what
 * wallet.controller.js's getSalaryWalletDetails expects.
 */
const getLiveSalaryProgress = async (userId) => {
  const currentMonth = getMonthString(new Date());
  const evaluation = await evaluateStarQualification(userId, currentMonth);

  return {
    isGoldStarAchieved: evaluation.meetsStarThreshold,
    currentTotalStar: evaluation.totalStarAtEvaluation,
    // Left/right star split, so dashboard cards can show live "X Left : Y Right"
    // instead of always rendering the zero defaults (previously dropped here
    // even though evaluateStarQualification already computes them).
    currentLeftStar: evaluation.currentLeftStar,
    currentRightStar: evaluation.currentRightStar,
    requiredMinStar: GOLD_STAR_THRESHOLD,
    startingTotalStar: evaluation.startingLeftStar + evaluation.startingRightStar,
    requiredTotalGrowth: REQUIRED_GROWTH_PERCENT,
    leftGrowth: evaluation.leftGrowth,
    rightGrowth: evaluation.rightGrowth,
    requiredPerLegGrowth: REQUIRED_BALANCE_RATIO,
    has5050Balance: evaluation.isRatioBalanced,
    has10PercentGrowth: evaluation.meetsGrowthRequirement,
    isCurrentlyQualified: evaluation.isQualified,
    currentMonthTTO: evaluation.teamTurnoverAmount,
    estimatedSalary: evaluation.salaryAmount
  };
};

/**
 * Evaluate and (if qualified) pay out a member's Gold Star monthly salary
 * for the given month. Idempotent: re-running for a month that was already
 * PROCESSED simply returns the existing log without paying twice.
 */
async function processMonthlySalaryPayout(userId, targetMonth) {
  const month = targetMonth || getMonthString(getPreviousMonthMarker());

  // Idempotency guard — never pay the same member for the same month twice.
  const existingLog = await SalaryLog.findOne({ userId, month });
  if (existingLog && existingLog.status === 'PROCESSED') {
    return {
      success: true,
      qualified: existingLog.isQualified,
      alreadyProcessed: true,
      salaryAmount: existingLog.salaryAmount,
      message: `Salary for ${month} was already processed.`,
      log: existingLog
    };
  }

  const evaluation = await evaluateStarQualification(userId, month);

  const logData = {
    userId,
    month,
    rankAtEvaluation: 'Gold Star',
    totalStarAtEvaluation: evaluation.totalStarAtEvaluation,
    startingLeftStar: evaluation.startingLeftStar,
    startingRightStar: evaluation.startingRightStar,
    currentLeftStar: evaluation.currentLeftStar,
    currentRightStar: evaluation.currentRightStar,
    leftGrowth: evaluation.leftGrowth,
    rightGrowth: evaluation.rightGrowth,
    totalGrowth: evaluation.totalGrowth,
    growthPercentageAchieved: evaluation.growthPercentageAchieved,
    isRatioBalanced: evaluation.isRatioBalanced,
    isQualified: evaluation.isQualified,
    disqualificationReason: evaluation.isQualified ? '' : evaluation.failureReasons.join('; '),
    teamTurnoverAmount: evaluation.teamTurnoverAmount,
    salaryPercentage: SALARY_PERCENTAGE,
    salaryAmount: evaluation.salaryAmount,
    status: evaluation.isQualified ? 'PROCESSED' : 'DISQUALIFIED',
    processedAt: new Date()
  };

  const salaryLog = await SalaryLog.findOneAndUpdate(
    { userId, month },
    { $set: logData },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Pay out to the Salary wallet if qualified and there's an actual amount.
  if (evaluation.isQualified && evaluation.salaryAmount > 0) {
    try {
      await WalletService.creditSalary(userId, evaluation.salaryAmount, salaryLog._id, {
        month,
        description: `Gold Star monthly salary for ${month}`
      });
    } catch (payErr) {
      // Don't silently mark PROCESSED if the actual payout failed.
      salaryLog.status = 'PENDING';
      salaryLog.disqualificationReason = `Payout failed: ${payErr.message}`;
      await salaryLog.save();
      throw payErr;
    }
  }

  return {
    success: true,
    qualified: evaluation.isQualified,
    salaryAmount: evaluation.salaryAmount,
    message: evaluation.isQualified
      ? (evaluation.salaryAmount > 0
        ? `Qualified! ₹${evaluation.salaryAmount} credited for ${month}.`
        : `Qualified for ${month}, but no Team Turn Over record was found — ₹0 paid.`)
      : `Not qualified for ${month}: ${evaluation.failureReasons.join('; ')}`,
    log: salaryLog
  };
}

/**
 * Helper: "one month ago" — used only as the default when no targetMonth is
 * explicitly passed to processMonthlySalaryPayout (matches the cron, which
 * always settles the month that just completed).
 */
function getPreviousMonthMarker() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

module.exports = {
  getLiveSalaryProgress,
  checkIsKuwiStar,
  checkKuwiStarSelfEntryGate,
  countVerifiedSubtreeStars,
  getMonthString,
  processMonthlySalaryPayout,
  getTeamTurnoverForMonth,
  computeAndPersistTTO
};