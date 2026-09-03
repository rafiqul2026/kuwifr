// server/src/scripts/seedAll30Products.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kuwifr';

const createSlug = (name, sku) => {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${sku.toLowerCase()}`;
};

const REALISTIC_30_PRODUCTS = [
  // --- Hair Care & Serums (5 Products) ---
  {
    name: 'Instant Magic Hair Colour Shampoo (500ml)',
    sku: 'MBC-001',
    category: 'HAIR_CARE',
    mrp: 1999,
    ksp: 1500,
    price: 1500,
    kbp: 1000,
    stock: 65,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=500&auto=format&fit=crop&q=80',
    description: 'Natural herbal formula with active argan oil for rapid grey hair coverage without ammonia.',
    shortDescription: 'Herbal Instant Grey Hair Color Shampoo'
  },
  {
    name: 'Kuwi Gold Magic Black Hair Oil (200ml)',
    sku: 'MBC-002',
    category: 'HAIR_CARE',
    mrp: 2100,
    ksp: 1500,
    price: 1500,
    kbp: 1000,
    stock: 50,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1608248597359-3221946894c2?w=500&auto=format&fit=crop&q=80',
    description: 'Organic cold-pressed root activating oil enriched with bhringraj and amla.',
    shortDescription: 'Restorative Hair Growth Root Oil'
  },
  {
    name: 'Herbal Anti-Dandruff Scalp Treatment Serum',
    sku: 'HCS-003',
    category: 'HAIR_CARE',
    mrp: 1850,
    ksp: 1400,
    price: 1400,
    kbp: 900,
    stock: 40,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=500&auto=format&fit=crop&q=80',
    description: 'Targeted salicylic acid and tea tree clarifying scalp treatment serum.',
    shortDescription: 'Anti-Dandruff Scalp Clarifying Serum'
  },
  {
    name: 'Kuwi Keratin Silk Restorative Conditioner',
    sku: 'HCS-004',
    category: 'HAIR_CARE',
    mrp: 1650,
    ksp: 1250,
    price: 1250,
    kbp: 800,
    stock: 35,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500&auto=format&fit=crop&q=80',
    description: 'Hydrolyzed keratin conditioner for intense hydration and frizz defense.',
    shortDescription: 'Deep Conditioning Keratin Moisture'
  },
  {
    name: 'Botanical Hair Fall Defense Tonic Spray',
    sku: 'HCS-005',
    category: 'HAIR_CARE',
    mrp: 2200,
    ksp: 1600,
    price: 1600,
    kbp: 1100,
    stock: 25,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=500&auto=format&fit=crop&q=80',
    description: 'Redensyl and biotin enriched active leave-in follicle spray.',
    shortDescription: 'Redensyl & Biotin Scalp Tonic'
  },

  // --- Health & Wellness (6 Products) ---
  {
    name: 'Kuwi Shilajit 99 (Pure Himalayan Resin 30g)',
    sku: 'HW-101',
    category: 'HEALTH_SUPPLEMENT',
    mrp: 5910,
    ksp: 5000,
    price: 5000,
    kbp: 4000,
    stock: 30,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&auto=format&fit=crop&q=80',
    description: 'Gold-grade purified fulvic acid mineral resin sourced from high-altitude Himalayan cliffs.',
    shortDescription: 'Pure Grade Himalayan Shilajit Resin'
  },
  {
    name: 'Kuwi Living Sea Buckthorn Juice (Pack of 3)',
    sku: 'HW-102',
    category: 'HEALTH_SUPPLEMENT',
    mrp: 5997,
    ksp: 5000,
    price: 5000,
    kbp: 4000,
    stock: 25,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=500&auto=format&fit=crop&q=80',
    description: 'Rich in rare Omega 3, 6, 7 and 9 fatty acids for systemic cellular immunity.',
    shortDescription: 'Pure Wild Sea Buckthorn Berry Juice'
  },
  {
    name: 'Kuwi Pro+ 100% Whey Protein Powder (1kg)',
    sku: 'HW-103',
    category: 'HEALTH_SUPPLEMENT',
    mrp: 5750,
    ksp: 5000,
    price: 5000,
    kbp: 4000,
    stock: 20,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=500&auto=format&fit=crop&q=80',
    description: '24g bioavailable clean whey protein with digestive enzyme complex.',
    shortDescription: '100% Clean Bioavailable Whey Protein'
  },
  {
    name: 'Kuwimul 77 Daily Multi-Nutrient Formula',
    sku: 'HW-104',
    category: 'HEALTH_SUPPLEMENT',
    mrp: 1860,
    ksp: 1500,
    price: 1500,
    kbp: 1000,
    stock: 45,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1550572017-ed200f5e5a43?w=500&auto=format&fit=crop&q=80',
    description: 'Complete antioxidant spectrum of essential vitamins and chelated trace minerals.',
    shortDescription: '77 Essential Multivitamins & Minerals'
  },
  {
    name: 'Organic Ashwagandha KSM-66 Vitality Capsules',
    sku: 'HW-105',
    category: 'HEALTH_SUPPLEMENT',
    mrp: 2400,
    ksp: 1800,
    price: 1800,
    kbp: 1200,
    stock: 40,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80',
    description: 'Standardized full-spectrum root extract for stress adaptation and energy vitality.',
    shortDescription: 'Standardized KSM-66 Ashwagandha Extract'
  },
  {
    name: 'Kuwi Pure Spirulina & Moringa Green Blend',
    sku: 'HW-106',
    category: 'HEALTH_SUPPLEMENT',
    mrp: 1950,
    ksp: 1450,
    price: 1450,
    kbp: 950,
    stock: 35,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=80',
    description: 'Superfood green chlorophyll powder for gut balance and everyday detox.',
    shortDescription: 'Organic Spirulina & Moringa Superfood'
  },

  // --- Alkaline Water Devices (5 Products) ---
  {
    name: 'Alkaline Water Ionizer Device (15k Ltr Capacity)',
    sku: 'ALK-201',
    category: 'WATER_PURIFIER',
    mrp: 13000,
    ksp: 10000,
    price: 10000,
    kbp: 7500,
    stock: 12,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80',
    description: 'Continuous active hydrogen antioxidant ionizer neutralizing water acidity.',
    shortDescription: '15,000L Active Alkaline Water Ionizer'
  },
  {
    name: 'Alkaline Mobile Travel Water Purifier',
    sku: 'ALK-202',
    category: 'WATER_PURIFIER',
    mrp: 13300,
    ksp: 10000,
    price: 10000,
    kbp: 7500,
    stock: 15,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80',
    description: 'Portable titanium electrode alkalizer with rechargeable lithium battery.',
    shortDescription: 'Portable Rechargeable Alkaline Ionizer'
  },
  {
    name: 'Alkaline Water Device Premium (30k Ltr Capacity)',
    sku: 'ALK-203',
    category: 'WATER_PURIFIER',
    mrp: 18000,
    ksp: 15000,
    price: 15000,
    kbp: 10000,
    stock: 8,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80',
    description: 'Dual platinum-plated electrolytic plates with automatic self-cleaning cycle.',
    shortDescription: 'Commercial 30,000L Platinum Ionizer'
  },
  {
    name: 'Alkaline Water Device with Copper Jar Container',
    sku: 'ALK-204',
    category: 'WATER_PURIFIER',
    mrp: 18500,
    ksp: 15000,
    price: 15000,
    kbp: 10000,
    stock: 10,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80',
    description: 'Infused pure copper reservoir combined with active negative ORP ionization.',
    shortDescription: 'Copper Infused Active Alkaline Ionizer'
  },
  {
    name: 'Alkaline Jug Filter Care Device (3.5L)',
    sku: 'ALK-205',
    category: 'WATER_PURIFIER',
    mrp: 5450,
    ksp: 5000,
    price: 5000,
    kbp: 4000,
    stock: 30,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80',
    description: 'BPA-free daily gravity pitcher maintaining 8.5 to 9.5 alkaline pH.',
    shortDescription: '3.5L Daily Alkaline Water Filter Pitcher'
  },

  // --- Designer Modern Sarees (5 Products) ---
  {
    name: 'Modern Saree (Ready-Made Drape Edition)',
    sku: 'SAR-301',
    category: 'CLOTHING',
    mrp: 2499,
    ksp: 1500,
    price: 1500,
    kbp: 1000,
    stock: 25,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500&auto=format&fit=crop&q=80',
    description: 'Instant 1-minute pre-stitched pleated designer modern saree.',
    shortDescription: 'Ready-to-Wear Instant Pre-Pleated Saree'
  },
  {
    name: 'Festival Wear Premium Modern Saree',
    sku: 'SAR-302',
    category: 'CLOTHING',
    mrp: 7250,
    ksp: 5000,
    price: 5000,
    kbp: 4000,
    stock: 18,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=500&auto=format&fit=crop&q=80',
    description: 'Intricate zari border with woven banarasi pallu and lightweight drape.',
    shortDescription: 'Banarasi Zari Border Festive Saree'
  },
  {
    name: 'Handcrafted Assam Tussar Silk Saree',
    sku: 'SAR-303',
    category: 'CLOTHING',
    mrp: 8900,
    ksp: 6500,
    price: 6500,
    kbp: 4800,
    stock: 12,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500&auto=format&fit=crop&q=80',
    description: 'Authentic pure wild silk directly loomed by master artisans of Guwahati.',
    shortDescription: 'Guwahati Artisan Handloom Tussar Silk'
  },
  {
    name: 'Royal Organza Embroidered Floral Saree',
    sku: 'SAR-304',
    category: 'CLOTHING',
    mrp: 6200,
    ksp: 4500,
    price: 4500,
    kbp: 3200,
    stock: 15,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=500&auto=format&fit=crop&q=80',
    description: 'Sheer breathable organza adorned with delicate resham thread embroidery.',
    shortDescription: 'Sheer Floral Embroidered Organza Drape'
  },
  {
    name: 'Contemporary Georgette Partywear Saree',
    sku: 'SAR-305',
    category: 'CLOTHING',
    mrp: 3800,
    ksp: 2700,
    price: 2700,
    kbp: 1900,
    stock: 22,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500&auto=format&fit=crop&q=80',
    description: 'Flowy georgette silhouette with satin hem piping for evening receptions.',
    shortDescription: 'Flowy Contemporary Evening Georgette'
  },

  // --- Gents Premium Wear (5 Products) ---
  {
    name: 'Gents Premium Clothes Combo (Shirt & Trousers)',
    sku: 'GPW-401',
    category: 'CLOTHING',
    mrp: 6500,
    ksp: 5000,
    price: 5000,
    kbp: 4000,
    stock: 30,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=500&auto=format&fit=crop&q=80',
    description: 'Tailored executive cotton formal shirt paired with flex-fit trousers.',
    shortDescription: 'Executive Tailored Shirt & Trousers Set'
  },
  {
    name: 'Royal Heritage Kurta Pajama Set',
    sku: 'GPW-402',
    category: 'CLOTHING',
    mrp: 4999,
    ksp: 3800,
    price: 3800,
    kbp: 2800,
    stock: 25,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=500&auto=format&fit=crop&q=80',
    description: 'Pure linen textured ethnic set with mandarin collar and mother-of-pearl buttons.',
    shortDescription: 'Pure Linen Heritage Kurta Set'
  },
  {
    name: 'Executive Italian Wool Blend Blazer',
    sku: 'GPW-403',
    category: 'CLOTHING',
    mrp: 11900,
    ksp: 8900,
    price: 8900,
    kbp: 6500,
    stock: 10,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=500&auto=format&fit=crop&q=80',
    description: 'Structured single-breasted classic navy blazer with notch lapels.',
    shortDescription: 'Structured Single-Breasted Navy Blazer'
  },
  {
    name: 'Egyptian Giza Cotton Formal Shirt (Twin Pack)',
    sku: 'GPW-404',
    category: 'CLOTHING',
    mrp: 4200,
    ksp: 3200,
    price: 3200,
    kbp: 2200,
    stock: 35,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=500&auto=format&fit=crop&q=80',
    description: 'Long-staple breathable cotton white and powder blue executive shirts.',
    shortDescription: 'Giza Cotton Executive Shirts (Pack of 2)'
  },
  {
    name: 'Premium Nehru Bandhgala Jacket',
    sku: 'GPW-405',
    category: 'CLOTHING',
    mrp: 5400,
    ksp: 4100,
    price: 4100,
    kbp: 3000,
    stock: 15,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=500&auto=format&fit=crop&q=80',
    description: 'Textured jacquard sleeveless bundi jacket for celebratory occasions.',
    shortDescription: 'Textured Jacquard Sleeveless Bundi Jacket'
  },

  // --- Smart EV Scooty (4 Products) ---
  {
    name: 'KUWIFR Electric Scooty (Executive Mobility Edition)',
    sku: 'EV-501',
    category: 'VEHICLE',
    mrp: 120500,
    ksp: 110000,
    price: 110000,
    kbp: 50000,
    stock: 3,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500&auto=format&fit=crop&q=80',
    description: '85km range, removable lithium battery, regenerative braking, digital instrument cluster.',
    shortDescription: 'Smart EV Two-Wheeler (85km Range)'
  },
  {
    name: 'KUWIFR Pro Urban EV Scooter (110km Long Range)',
    sku: 'EV-502',
    category: 'VEHICLE',
    mrp: 145000,
    ksp: 128000,
    price: 128000,
    kbp: 60000,
    stock: 2,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500&auto=format&fit=crop&q=80',
    description: 'Dual fast-charge battery technology with Bluetooth navigation and anti-theft GPS.',
    shortDescription: 'Pro Urban EV Scooter (110km Long Range)'
  },
  {
    name: 'Fast-Charge Domestic Home EV Charging Station',
    sku: 'EV-503',
    category: 'ELECTRONICS',
    mrp: 18000,
    ksp: 14500,
    price: 14500,
    kbp: 8000,
    stock: 10,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80',
    description: 'Weatherproof 16A smart surge-protected home wallbox for rapid electric 2-wheeler charging.',
    shortDescription: '16A Smart Home EV Fast Charging Wallbox'
  },
  {
    name: 'Smart Aerodynamic Helmet with Integrated Tail Lamp',
    sku: 'EV-504',
    category: 'OTHER',
    mrp: 3500,
    ksp: 2500,
    price: 2500,
    kbp: 1500,
    stock: 35,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500&auto=format&fit=crop&q=80',
    description: 'DOT-certified high impact composite helmet with USB-rechargeable rear safety strobe.',
    shortDescription: 'DOT Certified Smart LED Helmet'
  }
];

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected successfully.');

    const collection = mongoose.connection.collection('products');

    // Drop legacy or conflicting indexes on slug
    try {
      const indexes = await collection.indexes();
      const hasSlug = indexes.some(idx => idx.name === 'slug_1');
      if (hasSlug) {
        await collection.dropIndex('slug_1');
        console.log('Dropped legacy slug_1 index.');
      }
    } catch (e) {
      console.log('Index note:', e.message);
    }

    let updatedCount = 0;
    for (const p of REALISTIC_30_PRODUCTS) {
      const itemWithSlugAndImages = {
        ...p,
        slug: createSlug(p.name, p.sku),
        images: [p.image] // Ensure both image and images array are populated
      };

      await collection.updateOne(
        { sku: p.sku },
        { $set: itemWithSlugAndImages },
        { upsert: true }
      );
      updatedCount++;
    }

    const total = await collection.countDocuments();
    console.log(`=========================================`);
    console.log(`SUCCESS! Synchronized all ${total} products.`);
    console.log(`=========================================`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed:', error);
    process.exit(1);
  }
}

seed();