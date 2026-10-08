// server/src/scripts/add_standard_package.js
//
// Adds the "Standard Package" (business rule, Oct 2026):
//   Price / KSP Rs 1,000 · KBP 600 · Daily cap Rs 1,000 · Weekly Rs 7,000 ·
//   Monthly Rs 30,000 · member chooses ONE of:
//     Anti-Radiation Chip (2 pcs), Sugar Care, Magic Hair Colour Shampoo
//     (12 pcs), Gents Clothes, Multi Vitamin.
//
// Multi Vitamin already exists in the catalog at exactly this value
// (kfr-p05, KSP 1000 / KBP 600). The other four are created as catalog
// products at KSP 1,000 / KBP 600. Their MRP is set to the KSP (no offer
// shown) until the admin sets the real MRP and uploads photos under
// Admin > Products — no MRP is invented here.
//
// Idempotent: existing products are matched by name, the package by type,
// so re-running never duplicates anything.
//
// Usage (from /server):
//   node src/scripts/add_standard_package.js          # dry run, writes nothing
//   node src/scripts/add_standard_package.js --apply  # writes
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Package = require('../models/Package');
const RepurchaseProduct = require('../models/RepurchaseProduct');

const APPLY = process.argv.includes('--apply');
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kuwifr';

const KSP = 1000;
const KBP = 600;

// In the order the business listed them (the order members see them).
const PRODUCTS = [
  { name: 'Anti-Radiation Chip (2 Pcs)', category: 'Health & Wellness', description: 'Anti-radiation chip, pack of 2 pieces.' },
  { name: 'Sugar Care', category: 'Health & Nutrition', description: 'Sugar care health supplement.' },
  { name: 'Magic Hair Colour Shampoo (12 Pcs)', category: 'Hair Care', description: 'Magic hair colour shampoo, pack of 12 pieces.' },
  { name: 'Gents Clothes', category: 'Apparel', description: "Gents clothes." },
  // Existing catalog product — reused, not created.
  { existingId: 'kfr-p05' }
];

const PACKAGE = {
  name: 'Standard Package',
  type: 'STANDARD',
  description: 'Affordable entry package to activate your KUWIFR ID and start earning.',
  price: KSP,
  kbp: KBP,
  dailyCap: 1000,
  weeklyCap: 7000,
  monthlyCap: 30000,
  badge: 'Entry Plan',
  isActive: true,
  isPopular: false
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Next free kfr-pNN slug (two-digit series, like kfr-p01..kfr-p30).
const nextProductId = async (taken) => {
  const all = await RepurchaseProduct.find({ id: /^kfr-p\d+$/ }).select('id').lean();
  const used = new Set([...all.map((p) => p.id), ...taken]);
  let n = 1;
  while (used.has(`kfr-p${String(n).padStart(2, '0')}`)) n += 1;
  return `kfr-p${String(n).padStart(2, '0')}`;
};

const run = async () => {
  await mongoose.connect(MONGO_URI);
  console.log(`Connected. Mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}\n`);

  const maxSort = await RepurchaseProduct.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
  let sortOrder = (maxSort?.sortOrder || 0) + 1;
  const productIds = [];
  const newIds = [];

  for (const spec of PRODUCTS) {
    if (spec.existingId) {
      const existing = await RepurchaseProduct.findOne({ id: spec.existingId }).lean();
      if (!existing) throw new Error(`Expected existing product ${spec.existingId} was not found.`);
      if (existing.ksp !== KSP || existing.kbp !== KBP) {
        console.warn(`! ${existing.id} "${existing.name}" is KSP ${existing.ksp} / KBP ${existing.kbp}, not ${KSP} / ${KBP} — check it under Admin > Products.`);
      }
      console.log(`= reuse   ${existing.id}  ${existing.name}`);
      productIds.push(existing.id);
      continue;
    }

    const found = await RepurchaseProduct.findOne({ name: new RegExp(`^${escapeRegex(spec.name)}$`, 'i') }).lean();
    if (found) {
      console.log(`= exists  ${found.id}  ${found.name}`);
      productIds.push(found.id);
      continue;
    }

    const id = await nextProductId(newIds);
    newIds.push(id);
    const doc = {
      id,
      name: spec.name,
      category: spec.category,
      description: spec.description,
      mrp: KSP,
      ksp: KSP,
      kbp: KBP,
      images: [],
      isActive: true,
      sortOrder: sortOrder++
    };
    console.log(`+ create  ${id}  ${spec.name}  (${spec.category}, KSP ${KSP}, KBP ${KBP})`);
    if (APPLY) await RepurchaseProduct.create(doc);
    productIds.push(id);
  }

  const existingPkg = await Package.findOne({ $or: [{ type: PACKAGE.type }, { name: PACKAGE.name }] }).lean();
  if (existingPkg) {
    console.log(`\n= package exists: ${existingPkg.name} (${existingPkg.type}) — setting its products only.`);
    if (APPLY) await Package.updateOne({ _id: existingPkg._id }, { $set: { includedProductIds: productIds } });
  } else {
    console.log(`\n+ create package: ${PACKAGE.name} (${PACKAGE.type}) Rs ${PACKAGE.price}, KBP ${PACKAGE.kbp}, caps ${PACKAGE.dailyCap}/${PACKAGE.weeklyCap}/${PACKAGE.monthlyCap}`);
    if (APPLY) await Package.create({ ...PACKAGE, includedProductIds: productIds });
  }
  console.log(`  products offered (choose 1): ${productIds.join(', ')}`);

  await mongoose.disconnect();
  console.log(APPLY ? '\nDone.' : '\nDry run only — re-run with --apply to write.');
};

run().catch(async (err) => {
  console.error('Failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
