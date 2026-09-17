// server/src/scripts/seedRepurchaseProducts.js
//
// One-time migration: moves the 30 Repurchase Store products that used to
// live as a hardcoded REPURCHASE_PRODUCTS array inside
// repurchase.controller.js into the new RepurchaseProduct collection, so
// they become admin-editable (including per-product image uploads) instead
// of requiring a code change + redeploy to update. Idempotent — upserts by
// `id`, safe to run more than once (e.g. after adding new products to this
// list by hand before re-running).
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const RepurchaseProduct = require('../models/RepurchaseProduct');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kuwifr';

const REPURCHASE_PRODUCTS = [
  { id: 'kfr-p01', name: 'Instant Magic Hair Color Shampoo', mrp: 1999, ksp: 1500, kbp: 1000, category: 'Hair Care' },
  { id: 'kfr-p02', name: 'Kuwi Gold Magic Black Hair oil', mrp: 2100, ksp: 1500, kbp: 1000, category: 'Hair Care' },
  { id: 'kfr-p03', name: 'Modern Saree (Ready Made Wear)', mrp: 2499, ksp: 1500, kbp: 1000, category: 'Apparel' },
  { id: 'kfr-p04', name: 'Kuwi Pro+ Protein Powder (500gm)', mrp: 3130, ksp: 1500, kbp: 1000, category: 'Health & Nutrition' },
  { id: 'kfr-p05', name: 'Kuwimul 77 Multi Vitamin', mrp: 1860, ksp: 1500, kbp: 1000, category: 'Health & Nutrition' },
  { id: 'kfr-p06', name: 'Kuwi Living Sea buckthorn', mrp: 1999, ksp: 1500, kbp: 1000, category: 'Health & Nutrition' },
  { id: 'kfr-p07', name: 'Kuwi Shilajit 99', mrp: 5910, ksp: 5000, kbp: 4000, category: 'Wellness' },
  { id: 'kfr-p08', name: 'Kuwi Magic Berries Juice (All Solutions)', mrp: 2100, ksp: 1500, kbp: 1000, category: 'Beverages' },
  { id: 'kfr-p09', name: 'Festival Wear Premium Modern Saree', mrp: 7250, ksp: 5000, kbp: 4000, category: 'Apparel' },
  { id: 'kfr-p10', name: 'Kuwi Pro+ Protein Powder (1KG)', mrp: 5750, ksp: 5000, kbp: 4000, category: 'Health & Nutrition' },
  { id: 'kfr-p11', name: 'Gents Premium Clothes', mrp: 6500, ksp: 5000, kbp: 4000, category: 'Apparel' },
  { id: 'kfr-p12', name: 'Alkaline Jug', mrp: 5450, ksp: 5000, kbp: 4000, category: 'Home & Kitchen' },
  { id: 'kfr-p13', name: 'Alkaline Drop', mrp: 5550, ksp: 5000, kbp: 4000, category: 'Health & Wellness' },
  { id: 'kfr-p14', name: 'Alkaline Water Device (15k Ltr Capacity)', mrp: 13000, ksp: 10000, kbp: 7500, category: 'Appliances' },
  { id: 'kfr-p15', name: 'Alkaline Mobile Water Device', mrp: 13300, ksp: 10000, kbp: 7500, category: 'Appliances' },
  { id: 'kfr-p16', name: 'Alkaline Water Device Premium (30k Ltr Capacity)', mrp: 18000, ksp: 15000, kbp: 10000, category: 'Appliances' },
  { id: 'kfr-p17', name: 'Alkaline Water Device of Copper Jar', mrp: 18500, ksp: 15000, kbp: 10000, category: 'Appliances' },
  { id: 'kfr-p18', name: 'Electric Scooty (Growth Special)', mrp: 120500, ksp: 110000, kbp: 50000, category: 'Automotive / Package' },
  { id: 'kfr-p19', name: 'Kuwi Gold Face Wash', mrp: 299, ksp: 249, kbp: 186, category: 'Personal Care' },
  { id: 'kfr-p20', name: 'Kuwi Glow Soap', mrp: 299, ksp: 249, kbp: 190, category: 'Personal Care' },
  { id: 'kfr-p21', name: 'Kuwi Glow Cream', mrp: 349, ksp: 299, kbp: 220, category: 'Personal Care' },
  { id: 'kfr-p22', name: 'Kuwi Diabetic White Rice (1Kg)', mrp: 225, ksp: 210, kbp: 50, category: 'Grocery' },
  { id: 'kfr-p23', name: 'Electric Burner', mrp: 9350, ksp: 8000, kbp: 2000, category: 'Appliances' },
  { id: 'kfr-p24', name: 'Electric Geyser', mrp: 4500, ksp: 4000, kbp: 1700, category: 'Appliances' },
  { id: 'kfr-p25', name: 'Premium Kurti Set', mrp: 2999, ksp: 2499, kbp: 1000, category: 'Apparel' },
  { id: 'kfr-p26', name: 'Anno Fresh Salt', mrp: 30, ksp: 25, kbp: 12, category: 'Grocery' },
  { id: 'kfr-p27', name: 'Kuwi Mustard Oil', mrp: 210, ksp: 200, kbp: 70, category: 'Grocery' },
  { id: 'kfr-p28', name: 'Kuwi Fresh Kitchen King Masala (250gm)', mrp: 279, ksp: 249, kbp: 70, category: 'Grocery' },
  { id: 'kfr-p29', name: 'Kuwi Body Spray Perfume', mrp: 279, ksp: 210, kbp: 100, category: 'Personal Care' },
  { id: 'kfr-p30', name: 'Kuwi Toothpaste (100gm)', mrp: 249, ksp: 220, kbp: 80, category: 'Oral Care' }
];

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected successfully.');

    let created = 0;
    let updated = 0;

    for (let i = 0; i < REPURCHASE_PRODUCTS.length; i++) {
      const p = REPURCHASE_PRODUCTS[i];
      const existing = await RepurchaseProduct.findOne({ id: p.id });

      if (existing) {
        // Only sync catalog fields (name/category/mrp/ksp/kbp/sortOrder) —
        // never touch images/isActive here, since admin may have already
        // uploaded photos or deactivated a product before a re-run.
        existing.name = p.name;
        existing.category = p.category;
        existing.mrp = p.mrp;
        existing.ksp = p.ksp;
        existing.kbp = p.kbp;
        existing.sortOrder = i;
        await existing.save();
        updated++;
      } else {
        await RepurchaseProduct.create({ ...p, sortOrder: i, images: [], isActive: true });
        created++;
      }
    }

    const total = await RepurchaseProduct.countDocuments();
    console.log('=========================================');
    console.log(`SUCCESS! ${created} created, ${updated} updated, ${total} total Repurchase Store products.`);
    console.log('=========================================');
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed Repurchase Store products:', error);
    process.exit(1);
  }
}

seed();
