// server/src/controllers/fund.controller.js
const Fund = require('../models/Fund');
const BinaryNode = require('../models/BinaryNode');
const User = require('../models/User');

const FUND_PLANS = [
  {
    code: 'SCHOOL',
    name: 'School Fund',
    requiredLeftKBP: 25000,
    requiredRightKBP: 25000,
    benefitPercentage: 0.02,
    maintenanceLeftKBP: 2500,
    maintenanceRightKBP: 2500,
    order: 1
  },
  {
    code: 'FAMILY',
    name: 'Family Fund',
    requiredLeftKBP: 100000,
    requiredRightKBP: 100000,
    benefitPercentage: 0.02,
    maintenanceLeftKBP: 10000,
    maintenanceRightKBP: 10000,
    order: 2
  },
  {
    code: 'TRAVELLING',
    name: 'Travelling Fund',
    requiredLeftKBP: 250000,
    requiredRightKBP: 250000,
    benefitPercentage: 0.02,
    maintenanceLeftKBP: 25000,
    maintenanceRightKBP: 25000,
    order: 3
  },
  {
    code: 'LIFESTYLE',
    name: 'Lifestyle Fund',
    requiredLeftKBP: 500000,
    requiredRightKBP: 500000,
    benefitPercentage: 0.02,
    maintenanceLeftKBP: 50000,
    maintenanceRightKBP: 50000,
    order: 4
  },
  {
    code: 'FOREIGN_TRIP',
    name: 'Foreign Trip Fund',
    requiredLeftKBP: 1000000,
    requiredRightKBP: 1000000,
    benefitPercentage: 0.02,
    maintenanceLeftKBP: 100000,
    maintenanceRightKBP: 100000,
    order: 5
  },
  {
    code: 'PENSION',
    name: 'Pension Fund',
    requiredLeftKBP: 1000000,
    requiredRightKBP: 1000000,
    benefitPercentage: 0.01,
    maintenanceLeftKBP: 0,
    maintenanceRightKBP: 0,
    order: 6
  }
];

const initializeFunds = async (req, res, next) => {
  try {
    for (const item of FUND_PLANS) {
      await Fund.findOneAndUpdate(
        { code: item.code },
        { ...item, isActive: true },
        { upsert: true, new: true }
      );
    }
    res.json({ success: true, message: 'Funds initialized successfully' });
  } catch (error) {
    next(error);
  }
};

const getAllFunds = async (req, res, next) => {
  try {
    let funds = await Fund.find({ isActive: true }).sort({ order: 1 });
    if (!funds.length) {
      for (const item of FUND_PLANS) {
        await Fund.findOneAndUpdate({ code: item.code }, { ...item, isActive: true }, { upsert: true });
      }
      funds = await Fund.find({ isActive: true }).sort({ order: 1 });
    }
    res.json({ success: true, data: { funds } });
  } catch (error) {
    next(error);
  }
};

const getFundStatus = async (req, res, next) => {
  try {
    const userId = req.userId;
    const binaryNode = await BinaryNode.findOne({ userId });
    const currentLeftKBP = binaryNode?.leftVolume || 0;
    const currentRightKBP = binaryNode?.rightVolume || 0;

    let allPreviousAchieved = true;
    const fundsStatus = FUND_PLANS.map((fund) => {
      const isQualified = currentLeftKBP >= fund.requiredLeftKBP && currentRightKBP >= fund.requiredRightKBP;
      if (!isQualified && fund.code !== 'PENSION') {
        allPreviousAchieved = false;
      }

      const isPension = fund.code === 'PENSION';
      const pensionActive = isPension && allPreviousAchieved && isQualified;

      return {
        fund,
        qualified: isPension ? pensionActive : isQualified,
        current: {
          leftKBP: currentLeftKBP,
          rightKBP: currentRightKBP
        }
      };
    });

    res.json({
      success: true,
      data: {
        funds: fundsStatus,
        allFundsAchieved: allPreviousAchieved,
        pensionActive: fundsStatus.find(f => f.fund.code === 'PENSION')?.qualified || false
      }
    });
  } catch (error) {
    next(error);
  }
};

const processFundQualification = async (req, res, next) => {
  try {
    return getFundStatus(req, res, next);
  } catch (error) {
    next(error);
  }
};

const getFundBenefits = async (req, res, next) => {
  try {
    res.json({ success: true, data: { benefits: [] } });
  } catch (error) {
    next(error);
  }
};

const calculateTTO = async (req, res, next) => {
  try {
    res.json({ success: true, data: { totalKBP: 0 } });
  } catch (error) {
    next(error);
  }
};

const getTTORecords = async (req, res, next) => {
  try {
    res.json({ success: true, data: { records: [] } });
  } catch (error) {
    next(error);
  }
};

const getCurrentTTO = async (req, res, next) => {
  try {
    res.json({ success: true, data: { tto: null } });
  } catch (error) {
    next(error);
  }
};

const processFundMaintenance = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'Maintenance processed' });
  } catch (error) {
    next(error);
  }
};

const processAllTTO = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'All TTO processed' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  initializeFunds,
  getAllFunds,
  getFundStatus,
  processFundQualification,
  getFundBenefits,
  calculateTTO,
  getTTORecords,
  getCurrentTTO,
  processFundMaintenance,
  processAllTTO
};