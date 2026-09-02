// server/src/constants/funds.js (or inside fund controller seed)
const FUND_PLANS = [
  {
    code: 'SCHOOL',
    name: 'School Fund',
    requiredLeftKBP: 25000,
    requiredRightKBP: 25000,
    benefitPercentage: 0.02, // 2% on TTO Monthly
    maintenanceLeftKBP: 2500,
    maintenanceRightKBP: 2500,
    description: '25K : 25K KBP Matching = 2% on TTO Monthly',
    maintenanceDescription: 'Maintain 2.5K : 2.5K New Business Matching to get salary monthly continuously'
  },
  {
    code: 'FAMILY',
    name: 'Family Fund',
    requiredLeftKBP: 100000,
    requiredRightKBP: 100000,
    benefitPercentage: 0.02, // 2% on TTO Monthly
    maintenanceLeftKBP: 10000,
    maintenanceRightKBP: 10000,
    description: '100K : 100K KBP Matching = 2% on TTO Monthly',
    maintenanceDescription: 'Maintain 10K : 10K New Business Matching to get salary monthly continuously'
  },
  {
    code: 'TRAVELLING',
    name: 'Travelling Fund',
    requiredLeftKBP: 250000,
    requiredRightKBP: 250000,
    benefitPercentage: 0.02, // 2% on TTO Monthly
    maintenanceLeftKBP: 25000,
    maintenanceRightKBP: 25000,
    description: '250K : 250K KBP Matching = 2% on TTO Monthly',
    maintenanceDescription: 'Maintain 25K : 25K New Business Matching to get salary monthly continuously'
  },
  {
    code: 'LIFESTYLE',
    name: 'Lifestyle Fund',
    requiredLeftKBP: 500000,
    requiredRightKBP: 500000,
    benefitPercentage: 0.02, // 2% on TTO Monthly
    maintenanceLeftKBP: 50000,
    maintenanceRightKBP: 50000,
    description: '500K : 500K KBP Matching = 2% on TTO Monthly',
    maintenanceDescription: 'Maintain 50K : 50K New Business Matching to get salary monthly continuously'
  },
  {
    code: 'FOREIGN_TRIP',
    name: 'Foreign Trip Fund',
    requiredLeftKBP: 1000000,
    requiredRightKBP: 1000000,
    benefitPercentage: 0.02, // 2% on TTO Monthly
    maintenanceLeftKBP: 100000,
    maintenanceRightKBP: 100000,
    description: '1000K : 1000K KBP Matching = 2% on TTO Monthly',
    maintenanceDescription: 'Maintain 100K : 100K New Business Matching to get salary monthly continuously'
  },
  {
    code: 'PENSION',
    name: 'Pension Fund',
    requiredLeftKBP: 1000000,
    requiredRightKBP: 1000000,
    benefitPercentage: 0.01, // 1% lifetime on TTO
    maintenanceLeftKBP: 0,
    maintenanceRightKBP: 0,
    description: 'After achieving all targeted funds = 1% Lifetime on TTO (Team Turn Over)',
    maintenanceDescription: 'No Business Matching required to receive salary monthly continuously'
  }
];

module.exports = FUND_PLANS;