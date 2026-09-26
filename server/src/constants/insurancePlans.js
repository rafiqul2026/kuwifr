// server/src/constants/insurancePlans.js
//
// Insurance policy offered as a selectable "product" with each package —
// alongside the physical products a member can choose (Admin > Packages >
// Products), exactly one of which is picked at Buy / Upgrade time.
//
// Unlike a physical product (which is covered by the package price), picking
// the insurance plan means the member pays the policy's yearly installment
// instead of the package price. The package's KBP, caps and activation stay
// the same either way — only the amount payable changes.
//
// Keyed by Package.type. `id` is what the client submits as the selected
// product's productId; it is deliberately not a RepurchaseProduct slug, so
// insurance never appears in the Repurchase Store.
const INSURANCE_PLANS = {
  STARTER: {
    name: 'Non ULIP Guaranteed Plan – ₹10K/Year',
    installment: 10000
  },
  GROWTH: {
    name: 'ULIP Plan – ₹50K/Year',
    installment: 50000
  },
  LIFE_SAFE: {
    name: 'Non ULIP Guaranteed Plan – ₹75K/Year',
    installment: 75000
  },
  LIFE_SAFE_ELITE: {
    name: 'Non ULIP Guaranteed Plan – ₹1 Lakh/Year',
    installment: 100000
  },
  TITANIUM: {
    name: 'Table A1, ULIP / Non ULIP – Above ₹2 Lakh',
    installment: 200000
  }
};

const INSURERS = 'SBI / IndusInd-Nippon Life / Aditya Birla Capital and others';

/**
 * The insurance "product" for a package type, in the same shape the member
 * pages use for products, or null if that tier has no insurance plan.
 */
const getInsurancePlan = (packageType) => {
  const type = String(packageType || '').toUpperCase();
  const plan = INSURANCE_PLANS[type];
  if (!plan) return null;
  return {
    id: `insurance-${type.toLowerCase().replace(/_/g, '-')}`,
    name: `Insurance – ${plan.name}`,
    category: 'Insurance',
    provider: INSURERS,
    installment: plan.installment,
    ksp: plan.installment,
    mrp: plan.installment,
    isInsurance: true
  };
};

/** Attaches `insurancePlan` to a (lean) package object for API responses. */
const withInsurancePlan = (pkg) => (pkg ? { ...pkg, insurancePlan: getInsurancePlan(pkg.type) } : pkg);

/**
 * Amount the member must pay for `pkg` given their selected products: the
 * insurance installment if they picked this package's insurance plan,
 * otherwise the package price.
 */
const getAmountPayable = (pkg, selectedProducts = []) => {
  const plan = getInsurancePlan(pkg?.type);
  const pickedInsurance = plan && selectedProducts.some((p) => (p?.productId || p?.id) === plan.id);
  return {
    amount: pickedInsurance ? plan.installment : Number(pkg?.price || 0),
    isInsurance: !!pickedInsurance,
    plan: pickedInsurance ? plan : null
  };
};

module.exports = { INSURANCE_PLANS, getInsurancePlan, withInsurancePlan, getAmountPayable };
