// client/src/pages/member/packageProductCatalog.js
// Single source of truth for "included product" choices per package tier —
// shared by Buy Package and Upgrade Package so the two flows can never show
// different options for the same tier. Matches the canonical per-package
// product list (exactly one selectable item per package, per tier).
export const PRODUCT_TIERS = {
  STARTER: [
    {
      id: 'sp-1',
      name: 'Instant Magic Hair Color Shampoo',
      mrp: 1999,
      ksp: 1500,
      category: 'Hair Care',
      image: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'sp-2',
      name: 'Modern Saree (Ready Made Wear)',
      mrp: 2499,
      ksp: 1500,
      category: 'Apparel',
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'sp-3',
      name: 'Kuwi Pro+ Protein Powder (500gm)',
      mrp: 3130,
      ksp: 1500,
      category: 'Health & Nutrition',
      image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'sp-4',
      name: 'Kuwimul 77 Multi Vitamin',
      mrp: 1860,
      ksp: 1500,
      category: 'Health & Nutrition',
      image: 'https://images.unsplash.com/photo-1550572017-ed200f5e5a43?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'sp-5',
      name: 'Health Product (Wellness Combo Pack)',
      mrp: 2199,
      ksp: 1500,
      category: 'Health & Nutrition',
      image: 'https://images.unsplash.com/photo-1550572017-edd8b0fd9d20?w=500&auto=format&fit=crop&q=80'
    }
  ],
  GROWTH: [
    {
      id: 'gp-1',
      name: 'Kuwi Shilajit 99 (Pure Himalayan Extract)',
      mrp: 5910,
      ksp: 5000,
      category: 'Wellness',
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'gp-2',
      name: 'Kuwi Living Sea Buckthorn Juice (All Solutions, Pack of 3)',
      mrp: 5997,
      ksp: 5000,
      category: 'Health & Beverages',
      image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'gp-3',
      name: 'Premium Modern Saree (Festival Wear)',
      mrp: 7250,
      ksp: 5000,
      category: 'Apparel',
      image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'gp-4',
      name: 'Kuwi Pro+ Protein Powder (1KG)',
      mrp: 5750,
      ksp: 5000,
      category: 'Health & Nutrition',
      image: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'gp-5',
      name: 'Health Products (Premium Wellness Combo)',
      mrp: 5750,
      ksp: 5000,
      category: 'Health & Nutrition',
      image: 'https://images.unsplash.com/photo-1550572017-edd8b0fd9d20?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'gp-6',
      name: 'Gents Premium Clothes Combo',
      mrp: 6500,
      ksp: 5000,
      category: 'Apparel',
      image: 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'gp-7',
      name: 'Alkaline Jug or Drop',
      mrp: 5450,
      ksp: 5000,
      category: 'Home & Kitchen',
      image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80'
    }
  ],
  LIFE_SAFE: [
    {
      id: 'ls-1',
      name: 'Alkaline Water Device (15k Ltr Capacity)',
      mrp: 13000,
      ksp: 10000,
      category: 'Appliances',
      image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'ls-2',
      name: 'Alkaline Mobile Water Device',
      mrp: 13300,
      ksp: 10000,
      category: 'Appliances',
      image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80'
    }
  ],
  LIFE_SAFE_ELITE: [
    {
      id: 'lse-1',
      name: 'Alkaline Water Device Premium (30k Ltr Capacity)',
      mrp: 18000,
      ksp: 15000,
      category: 'Appliances',
      image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80'
    },
    {
      id: 'lse-2',
      name: 'Alkaline Water Device with Copper Jar Container',
      mrp: 18500,
      ksp: 15000,
      category: 'Appliances',
      image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80'
    }
  ],
  TITANIUM: [
    {
      id: 'tit-1',
      name: 'KUWIFR Electric Scooty (Executive Mobility Edition)',
      mrp: 120500,
      ksp: 110000,
      category: 'Automotive / EV',
      image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500&auto=format&fit=crop&q=80'
    }
  ]
};

// Every tier — including Life Safe Elite — requires choosing exactly 1
// product from its list; no tier bundles both automatically.
export const SELECTION_MODE = {
  STARTER: 'ONE',
  GROWTH: 'ONE',
  LIFE_SAFE: 'ONE',
  LIFE_SAFE_ELITE: 'ONE',
  TITANIUM: 'ONE'
};

export const getSelectionMode = (type) => SELECTION_MODE[(type || '').toUpperCase()] || 'ONE';

// Resolves the right tier's product list off a package's `type` (falling
// back to a price-bracket guess for packages whose type doesn't match one
// of the 5 known enum values, matching the original inline heuristic).
export const getProductsForPackage = (pkg) => {
  const typeUpper = (pkg?.type || '').toUpperCase();
  if (PRODUCT_TIERS[typeUpper]) return PRODUCT_TIERS[typeUpper];

  const price = Number(pkg?.price || 0);
  if (typeUpper.includes('STARTER') || price <= 3000) return PRODUCT_TIERS.STARTER;
  if (typeUpper.includes('GROWTH') || price <= 8000) return PRODUCT_TIERS.GROWTH;
  if (typeUpper.includes('ELITE') || price === 15000) return PRODUCT_TIERS.LIFE_SAFE_ELITE;
  if (typeUpper.includes('TITANIUM') || price >= 50000) return PRODUCT_TIERS.TITANIUM;
  return PRODUCT_TIERS.LIFE_SAFE;
};
