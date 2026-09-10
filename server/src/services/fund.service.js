// server/src/services/fund.service.js
const Fund = require('../models/Fund');
const FundQualification = require('../models/FundQualification');
const BinaryNode = require('../models/BinaryNode');
const User = require('../models/User');
const Order = require('../models/Order');

const FUND_PLANS = [
  {
    code: 'SCHOOL',
    name: 'School Fund',
    requiredLeftKBP: 25000,
    requiredRightKBP: 25000,
    benefitPercentage: 0.02, // 2% on TTO Monthly
    maintenanceLeftKBP: 2500,
    maintenanceRightKBP: 2500,
    order: 1
  },
  {
    code: 'FAMILY',
    name: 'Family Fund',
    requiredLeftKBP: 100000,
    requiredRightKBP: 100000,
    benefitPercentage: 0.02, // 2% on TTO Monthly
    maintenanceLeftKBP: 10000,
    maintenanceRightKBP: 10000,
    order: 2
  },
  {
    code: 'TRAVELLING',
    name: 'Travelling Fund',
    requiredLeftKBP: 250000,
    requiredRightKBP: 250000,
    benefitPercentage: 0.02, // 2% on TTO Monthly
    maintenanceLeftKBP: 25000,
    maintenanceRightKBP: 25000,
    order: 3
  },
  {
    code: 'LIFESTYLE',
    name: 'Lifestyle Fund',
    requiredLeftKBP: 500000,
    requiredRightKBP: 500000,
    benefitPercentage: 0.02, // 2% on TTO Monthly
    maintenanceLeftKBP: 50000,
    maintenanceRightKBP: 50000,
    order: 4
  },
  {
    code: 'FOREIGN_TRIP',
    name: 'Foreign Trip Fund',
    requiredLeftKBP: 1000000,
    requiredRightKBP: 1000000,
    benefitPercentage: 0.02, // 2% on TTO Monthly
    maintenanceLeftKBP: 100000,
    maintenanceRightKBP: 100000,
    order: 5
  },
  {
    code: 'PENSION',
    name: 'Pension Fund',
    requiredLeftKBP: 1000000,
    requiredRightKBP: 1000000,
    benefitPercentage: 0.01, // 1% Lifetime on TTO
    maintenanceLeftKBP: 0,
    maintenanceRightKBP: 0,
    order: 6
  }
];

class FundService {
  /**
   * Seed all 6 Fund Definitions in Database
   */
  static async initializeFunds() {
    for (const item of FUND_PLANS) {
      await Fund.findOneAndUpdate(
        { code: item.code },
        { ...item, isActive: true },
        { upsert: true, new: true }
      );
    }
    return { success: true };
  }

  /**
   * Called whenever a user places a Repurchase Order.
   * Passes the KBP up the tree and checks qualification.
   */
  static async processRepurchaseKBPForFunds(userId, totalOrderKBP) {
    if (!totalOrderKBP || totalOrderKBP <= 0) return;

    let currentNode = await BinaryNode.findOne({ userId });
    if (!currentNode || !currentNode.parentId) return;

    let currentUserId = currentNode.userId;
    let parentId = currentNode.parentId;
    // BinaryNode.parentId stores a *User* id (see BinaryNode.js / binary.service.js),
    // not the parent BinaryNode's own _id — must look it up by userId, matching the
    // pattern used everywhere else in the tree (binary.service.updateVolumes etc).
    // Using findById(parentId) here previously always returned null, so funds could
    // never accumulate repurchase KBP or qualify at all.
    const visited = new Set([String(currentUserId)]);

    while (parentId) {
      if (visited.has(String(parentId))) break; // cycle guard
      visited.add(String(parentId));

      const parentNode = await BinaryNode.findOne({ userId: parentId });
      if (!parentNode) break;

      // leftChildId / rightChildId (not "leftChild") are the actual schema fields.
      const isLeft = String(parentNode.leftChildId) === String(currentUserId);
      if (isLeft) {
        parentNode.leftRepurchaseKBP = (parentNode.leftRepurchaseKBP || 0) + totalOrderKBP;
      } else {
        parentNode.rightRepurchaseKBP = (parentNode.rightRepurchaseKBP || 0) + totalOrderKBP;
      }
      await parentNode.save();

      // Check if this parent now qualifies for a new fund, and roll the
      // monthly "new business" maintenance counters on their existing funds.
      await this.evaluateFundQualification(parentNode.userId, { isLeft, amount: totalOrderKBP });

      currentUserId = parentNode.userId;
      parentId = parentNode.parentId;
    }
  }

  /** Format the current calendar month as "YYYY-MM". */
  static currentPeriodKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Check if a member qualifies for any of the 6 Funds, and roll forward the
   * monthly maintenance counters ("New Business Matching") on funds they are
   * already qualified for.
   *
   * @param {object} [incoming] - the repurchase KBP delta that triggered this
   *   evaluation ({ isLeft, amount }). When provided, that amount is added to
   *   the current calendar month's maintenance counter for every fund the
   *   member already holds ACTIVE — this is what distributeMonthlyTTO checks
   *   before paying that month's salary (business plan: "Maintain: X:X New
   *   Business Matching to getting the salary every month continuously").
   */
  static async evaluateFundQualification(userId, incoming = null) {
    const binaryNode = await BinaryNode.findOne({ userId });
    if (!binaryNode) return;

    // Funds are qualified strictly on REPURCHASE KBP matching (business plan
    // section 6: "Life Tension Free Income/Fund on Repurchase Target full fill
    // from Team"), not on package-purchase binary volume.
    const leftKBP = binaryNode.leftRepurchaseKBP || 0;
    const rightKBP = binaryNode.rightRepurchaseKBP || 0;
    const currentPeriod = this.currentPeriodKey();

    let allFoundationAchieved = true;

    for (const plan of FUND_PLANS) {
      const isPension = plan.code === 'PENSION';
      const meetsTarget = leftKBP >= plan.requiredLeftKBP && rightKBP >= plan.requiredRightKBP;
      const qualifiesNow = isPension ? (allFoundationAchieved && meetsTarget) : meetsTarget;
      if (!isPension && !meetsTarget) allFoundationAchieved = false;

      if (qualifiesNow) {
        await FundQualification.findOneAndUpdate(
          { userId, fundCode: plan.code },
          {
            userId,
            fundCode: plan.code,
            matchedLeftKBP: leftKBP,
            matchedRightKBP: rightKBP,
            status: 'ACTIVE'
          },
          { upsert: true, new: true }
        );
      }

      // Roll the monthly maintenance counter for any fund already ACTIVE,
      // regardless of whether it just qualified this call.
      if (incoming && incoming.amount > 0) {
        const existing = await FundQualification.findOne({ userId, fundCode: plan.code });
        if (existing && existing.status === 'ACTIVE') {
          const resetNeeded = existing.maintenancePeriod !== currentPeriod;
          const inc = incoming.isLeft
            ? { maintenancePeriodLeftKBP: incoming.amount }
            : { maintenancePeriodRightKBP: incoming.amount };

          if (resetNeeded) {
            await FundQualification.updateOne(
              { _id: existing._id },
              {
                $set: {
                  maintenancePeriod: currentPeriod,
                  maintenancePeriodLeftKBP: incoming.isLeft ? incoming.amount : 0,
                  maintenancePeriodRightKBP: incoming.isLeft ? 0 : incoming.amount
                }
              }
            );
          } else {
            await FundQualification.updateOne({ _id: existing._id }, { $inc: inc });
          }
        }
      }
    }
  }

  /**
   * Whether a fund qualification has met this month's "new business" maintenance
   * requirement. Funds with no maintenance requirement (e.g. Pension: "No
   * Business Matching" needed) always pass.
   */
  static meetsMaintenance(qualification, plan, currentPeriod) {
    if (!plan.maintenanceLeftKBP && !plan.maintenanceRightKBP) return true;
    if (qualification.maintenancePeriod !== currentPeriod) return false;
    return (
      (qualification.maintenancePeriodLeftKBP || 0) >= plan.maintenanceLeftKBP &&
      (qualification.maintenancePeriodRightKBP || 0) >= plan.maintenanceRightKBP
    );
  }

  /**
   * Get Live Fund Status for the Logged-in User
   */
  static async getFundStatus(userId) {
    await this.initializeFunds();
    await this.evaluateFundQualification(userId);

    const binaryNode = await BinaryNode.findOne({ userId });
    const leftKBP = binaryNode?.leftRepurchaseKBP || 0;
    const rightKBP = binaryNode?.rightRepurchaseKBP || 0;

    const qualifications = await FundQualification.find({ userId, status: 'ACTIVE' }).lean();
    const qualifiedCodes = new Set(qualifications.map(q => q.fundCode));

    const funds = FUND_PLANS.map(fund => {
      const isQualified = qualifiedCodes.has(fund.code);
      return {
        fund,
        qualified: isQualified,
        current: {
          leftKBP,
          rightKBP
        }
      };
    });

    const allFundsAchieved = ['SCHOOL', 'FAMILY', 'TRAVELLING', 'LIFESTYLE', 'FOREIGN_TRIP'].every(c => qualifiedCodes.has(c));
    const pensionActive = qualifiedCodes.has('PENSION');

    return {
      funds,
      allFundsAchieved,
      pensionActive
    };
  }

  /**
   * Calculate and Distribute Monthly TTO Royalty to Qualified Members
   * (Run at the end of each month via Cron / Admin)
   */
  static async distributeMonthlyTTO(period = null) {
    const now = new Date();
    const currentPeriod = period || this.currentPeriodKey(now);

    // 1. Calculate Total Turnover (TTO) in KBP from all completed orders this
    // month. Order documents use `kbpGenerated` (not `totalKBP`) for KBP —
    // using the wrong field name here previously made this aggregate always
    // sum to 0, so no Fund salary was ever distributed.
    //
    // "Completed" itself is inconsistent across the codebase's several
    // order-creation paths: some write orderStatus 'DELIVERED', others
    // 'COMPLETED', and all of them also set the generic `status` field to
    // 'COMPLETED'. Match all three so a real completed order — created via
    // any of those paths — is never missed here.
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthlyOrders = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
          $or: [
            { orderStatus: { $in: ['COMPLETED', 'DELIVERED'] } },
            { status: 'COMPLETED' }
          ]
        }
      },
      { $group: { _id: null, totalTTO: { $sum: '$kbpGenerated' }, totalSales: { $sum: '$totalAmount' } } }
    ]);

    const totalCompanyTTO = monthlyOrders[0]?.totalTTO || 0;
    if (totalCompanyTTO <= 0) {
      return { message: 'No company Team Turn Over (TTO) this month to distribute.' };
    }

    const WalletService = require('./wallet.service');
    const IncomeTransaction = require('../models/IncomeTransaction');
    const results = { period: currentPeriod, totalCompanyTTO, paid: 0, skippedMaintenance: 0, funds: [] };

    // 2. Distribute Royalty for each Fund Tier
    for (const plan of FUND_PLANS) {
      const qualifiedMembers = await FundQualification.find({
        fundCode: plan.code,
        status: 'ACTIVE',
        lastPayoutPeriod: { $ne: currentPeriod }
      });

      if (qualifiedMembers.length === 0) continue;

      // Only members who met this month's "New Business Matching" maintenance
      // requirement are eligible (Pension requires none, per the business plan).
      const eligible = qualifiedMembers.filter((q) => this.meetsMaintenance(q, plan, currentPeriod));
      if (eligible.length === 0) continue;

      // Pool for this fund = TTO * benefitPercentage (e.g. 2% or 1%), split evenly.
      const poolAmountInRupees = totalCompanyTTO * plan.benefitPercentage;
      const perMemberPayout = Math.round((poolAmountInRupees / eligible.length) * 100) / 100;

      for (const qual of eligible) {
        if (perMemberPayout > 0) {
          const creditResult = await WalletService.creditSalary(
            qual.userId,
            perMemberPayout,
            qual._id,
            {
              description: `${plan.name} Salary - ${(plan.benefitPercentage * 100).toFixed(2)}% on TTO`,
              sourceModel: 'FundQualification',
              fundCode: plan.code,
              period: currentPeriod
            },
            'FUND_SALARY'
          );

          await IncomeTransaction.create({
            userId: qual.userId,
            transactionId: `FUNDSAL-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`.toUpperCase(),
            type: 'FUND_SALARY',
            sourceId: qual._id,
            sourceModel: 'User',
            kbp: totalCompanyTTO,
            rate: plan.benefitPercentage,
            grossAmount: perMemberPayout,
            capAdjustment: 0,
            creditedAmount: perMemberPayout,
            walletType: 'SALARY',
            walletId: creditResult?.transaction?.walletId || null,
            status: 'CREDITED',
            processedAt: new Date(),
            metadata: { fundCode: plan.code, fundName: plan.name, period: currentPeriod }
          });

          results.paid += 1;
        }

        qual.lastPayoutPeriod = currentPeriod;
        await qual.save();
      }

      results.skippedMaintenance += qualifiedMembers.length - eligible.length;
      results.funds.push({ code: plan.code, eligible: eligible.length, perMemberPayout });
    }

    return { success: true, message: `TTO distributed for period ${currentPeriod}`, ...results };
  }
}

module.exports = FundService;