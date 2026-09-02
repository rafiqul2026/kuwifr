// client/src/constants/productsData.js
export const KUWIFR_PRODUCTS = [
  // Health & Wellness
  {
    id: 'prod-001',
    name: 'Kuwi Shilajit 99',
    category: 'HEALTH_SUPPLEMENT',
    categoryLabel: 'Health & Wellness',
    mrp: 1999,
    ksp: 1499,
    kbp: 300,
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80',
    description: 'Pure Himalayan Shilajit 99 resin for strength, stamina, and overall vitality.',
    inStock: true,
    tag: 'Best Seller'
  },
  {
    id: 'prod-002',
    name: 'Protein Powder (1KG)',
    category: 'HEALTH_SUPPLEMENT',
    categoryLabel: 'Health & Wellness',
    mrp: 2999,
    ksp: 2499,
    kbp: 500,
    image: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=500&auto=format&fit=crop&q=80',
    description: 'High-grade whey isolate protein powder for muscle growth and fast recovery.',
    inStock: true,
    tag: 'Popular'
  },
  {
    id: 'prod-003',
    name: 'Seabuckthorn Juice (All Solutions) × 3 Pcs',
    category: 'HEALTH_SUPPLEMENT',
    categoryLabel: 'Health & Wellness',
    mrp: 2499,
    ksp: 1899,
    kbp: 400,
    image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&auto=format&fit=crop&q=80',
    description: 'Triple pack immunity-boosting organic Seabuckthorn juice rich in Omega 7 and Vitamin C.',
    inStock: true,
    tag: 'Value Pack'
  },
  {
    id: 'prod-004',
    name: 'Multi Vitamin Daily Shield',
    category: 'HEALTH_SUPPLEMENT',
    categoryLabel: 'Health & Wellness',
    mrp: 999,
    ksp: 799,
    kbp: 150,
    image: 'https://images.unsplash.com/photo-1550572017-ed200f5e6343?w=500&auto=format&fit=crop&q=80',
    description: 'Essential daily vitamins and minerals for active metabolism and immune strength.',
    inStock: true
  },
  {
    id: 'prod-005',
    name: 'Herbal Health Care Pack',
    category: 'HEALTH_SUPPLEMENT',
    categoryLabel: 'Health & Wellness',
    mrp: 1499,
    ksp: 1199,
    kbp: 250,
    image: 'https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?w=500&auto=format&fit=crop&q=80',
    description: 'Ayurvedic wellness formulation for holistic body balance and detox.',
    inStock: true
  },

  // Personal & Hair Care
  {
    id: 'prod-006',
    name: 'Instant Magic Hair Color Shampoo',
    category: 'HAIR_CARE',
    categoryLabel: 'Personal Care',
    mrp: 1299,
    ksp: 899,
    kbp: 200,
    image: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=500&auto=format&fit=crop&q=80',
    description: 'Natural ammonia-free 5-minute instant gray hair coverage shampoo.',
    inStock: true,
    tag: 'Trending'
  },

  // Fashion & Apparel
  {
    id: 'prod-007',
    name: 'Premium Modern Saree',
    category: 'CLOTHING',
    categoryLabel: 'Fashion & Apparel',
    mrp: 3499,
    ksp: 2499,
    kbp: 500,
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500&auto=format&fit=crop&q=80',
    description: 'Designer handcrafted luxury saree with elegant border detailing.',
    inStock: true,
    tag: 'Premium'
  },
  {
    id: 'prod-008',
    name: 'Classic Modern Saree',
    category: 'CLOTHING',
    categoryLabel: 'Fashion & Apparel',
    mrp: 2199,
    ksp: 1699,
    kbp: 350,
    image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=500&auto=format&fit=crop&q=80',
    description: 'Lightweight, stylish daily and festive wear modern saree.',
    inStock: true
  },
  {
    id: 'prod-009',
    name: "Gents Premium Clothes Collection",
    category: 'CLOTHING',
    categoryLabel: 'Fashion & Apparel',
    mrp: 2799,
    ksp: 1999,
    kbp: 400,
    image: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=500&auto=format&fit=crop&q=80',
    description: 'High-thread cotton blend formal and casual attire for men.',
    inStock: true
  },

  // Alkaline Water Devices
  {
    id: 'prod-010',
    name: 'Alkaline Water Device Premium (30K L)',
    category: 'WATER_PURIFIER',
    categoryLabel: 'Alkaline Tech',
    mrp: 18999,
    ksp: 14999,
    kbp: 3000,
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80',
    description: '30,000 Liters high capacity mineralizer and antioxidant pH balance device.',
    inStock: true,
    tag: 'High KBP'
  },
  {
    id: 'prod-011',
    name: 'Alkaline Water Device (15K L)',
    category: 'WATER_PURIFIER',
    categoryLabel: 'Alkaline Tech',
    mrp: 11999,
    ksp: 8999,
    kbp: 1800,
    image: 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=500&auto=format&fit=crop&q=80',
    description: '15,000 Liters capacity home antioxidant alkaline generator.',
    inStock: true
  },
  {
    id: 'prod-012',
    name: 'Alkaline Water Device with Copper Jar',
    category: 'WATER_PURIFIER',
    categoryLabel: 'Alkaline Tech',
    mrp: 8499,
    ksp: 5999,
    kbp: 1200,
    image: 'https://images.unsplash.com/photo-1589365278144-c9e705f843ba?w=500&auto=format&fit=crop&q=80',
    description: 'Combines traditional copper benefits with advanced alkaline ionization.',
    inStock: true,
    tag: 'Special'
  },
  {
    id: 'prod-013',
    name: 'Alkaline Mobile Water Device',
    category: 'WATER_PURIFIER',
    categoryLabel: 'Alkaline Tech',
    mrp: 3999,
    ksp: 2799,
    kbp: 600,
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&auto=format&fit=crop&q=80',
    description: 'Portable on-the-go alkaline flask with instant ionization filter.',
    inStock: true
  },
  {
    id: 'prod-014',
    name: 'Alkaline Mineral Jug & Drop Kit',
    category: 'WATER_PURIFIER',
    categoryLabel: 'Alkaline Tech',
    mrp: 2499,
    ksp: 1699,
    kbp: 350,
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&auto=format&fit=crop&q=80',
    description: 'Concentrated alkaline drops with BPA-free filter jug for daily dining.',
    inStock: true
  },

  // Green Mobility
  {
    id: 'prod-015',
    name: 'KUWIFR Smart Electric Scooty',
    category: 'VEHICLE',
    categoryLabel: 'EV Mobility',
    mrp: 89999,
    ksp: 74999,
    kbp: 15000,
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500&auto=format&fit=crop&q=80',
    description: 'Zero emission high-performance EV scooty with 85km range and fast charging.',
    inStock: true,
    tag: 'Eco Friendly'
  }
];