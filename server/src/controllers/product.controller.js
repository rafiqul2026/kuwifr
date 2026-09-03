// server/src/controllers/product.controller.js
const Product = require('../models/Product');

const ALL_30_STORE_PRODUCTS = [
  // --- Category: Hair Care & Serums (5 Products) ---
  {
    name: 'Instant Magic Hair Colour Shampoo (500ml)',
    sku: 'MBC-001',
    category: 'Hair Care & Serums',
    mrp: 1999,
    ksp: 1500,
    price: 1500,
    kbp: 1000,
    stock: 1000,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=500&auto=format&fit=crop&q=80',
    description: 'Premium black hair color shampoo with natural herbal extracts for vibrant grey hair coverage.'
  },
  {
    name: 'Kuwi Gold Magic Black Hair Oil (200ml)',
    sku: 'MBC-002',
    category: 'Hair Care & Serums',
    mrp: 2100,
    ksp: 1500,
    price: 1500,
    kbp: 1000,
    stock: 850,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1608248597359-3221946894c2?w=500&auto=format&fit=crop&q=80',
    description: 'Organic cold-pressed root activating oil enriched with bhringraj and amla.'
  },
  {
    name: 'Herbal Anti-Dandruff Scalp Treatment Serum',
    sku: 'HCS-003',
    category: 'Hair Care & Serums',
    mrp: 1850,
    ksp: 1400,
    price: 1400,
    kbp: 900,
    stock: 450,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=500&auto=format&fit=crop&q=80',
    description: 'Targeted salicylic acid and tea tree clarifying scalp treatment serum.'
  },
  {
    name: 'Kuwi Keratin Silk Restorative Conditioner',
    sku: 'HCS-004',
    category: 'Hair Care & Serums',
    mrp: 1650,
    ksp: 1250,
    price: 1250,
    kbp: 800,
    stock: 600,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500&auto=format&fit=crop&q=80',
    description: 'Hydrolyzed keratin conditioner for intense hydration and frizz defense.'
  },
  {
    name: 'Botanical Hair Fall Defense Tonic Spray',
    sku: 'HCS-005',
    category: 'Hair Care & Serums',
    mrp: 2200,
    ksp: 1600,
    price: 1600,
    kbp: 1100,
    stock: 350,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=500&auto=format&fit=crop&q=80',
    description: 'Redensyl and biotin enriched active leave-in follicle spray.'
  },

  // --- Category: Health & Wellness (6 Products) ---
  {
    name: 'Kuwi Shilajit 99 (Pure Himalayan Resin 30g)',
    sku: 'HW-101',
    category: 'Health & Wellness',
    mrp: 5910,
    ksp: 5000,
    price: 5000,
    kbp: 4000,
    stock: 500,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&auto=format&fit=crop&q=80',
    description: 'Gold-grade purified fulvic acid mineral resin sourced from high-altitude Himalayan cliffs.'
  },
  {
    name: 'Kuwi Living Sea Buckthorn Juice (Pack of 3)',
    sku: 'HW-102',
    category: 'Health & Wellness',
    mrp: 5997,
    ksp: 5000,
    price: 5000,
    kbp: 4000,
    stock: 400,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=500&auto=format&fit=crop&q=80',
    description: 'Rich in rare Omega 3, 6, 7 and 9 fatty acids for systemic cellular immunity.'
  },
  {
    name: 'Kuwi Pro+ 100% Whey Protein Powder (1kg)',
    sku: 'HW-103',
    category: 'Health & Wellness',
    mrp: 5750,
    ksp: 5000,
    price: 5000,
    kbp: 4000,
    stock: 320,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=500&auto=format&fit=crop&q=80',
    description: '24g bioavailable clean whey protein with digestive enzyme complex.'
  },
  {
    name: 'Kuwimul 77 Daily Multi-Nutrient Formula',
    sku: 'HW-104',
    category: 'Health & Wellness',
    mrp: 1860,
    ksp: 1500,
    price: 1500,
    kbp: 1000,
    stock: 900,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1550572017-ed200f5e5a43?w=500&auto=format&fit=crop&q=80',
    description: 'Complete antioxidant spectrum of essential vitamins and chelated trace minerals.'
  },
  {
    name: 'Organic Ashwagandha KSM-66 Vitality Capsules',
    sku: 'HW-105',
    category: 'Health & Wellness',
    mrp: 2400,
    ksp: 1800,
    price: 1800,
    kbp: 1200,
    stock: 650,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80',
    description: 'Standardized full-spectrum root extract for stress adaptation and energy vitality.'
  },
  {
    name: 'Kuwi Pure Spirulina & Moringa Green Blend',
    sku: 'HW-106',
    category: 'Health & Wellness',
    mrp: 1950,
    ksp: 1450,
    price: 1450,
    kbp: 950,
    stock: 480,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=80',
    description: 'Superfood green chlorophyll powder for gut balance and everyday detox.'
  },

  // --- Category: Alkaline Water Devices (5 Products) ---
  {
    name: 'Alkaline Water Ionizer Device (15k Ltr Capacity)',
    sku: 'ALK-201',
    category: 'Alkaline Water Devices',
    mrp: 13000,
    ksp: 10000,
    price: 10000,
    kbp: 7500,
    stock: 45,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80',
    description: 'Continuous active hydrogen antioxidant ionizer neutralizing water acidity.'
  },
  {
    name: 'Alkaline Mobile Travel Water Purifier',
    sku: 'ALK-202',
    category: 'Alkaline Water Devices',
    mrp: 13300,
    ksp: 10000,
    price: 10000,
    kbp: 7500,
    stock: 60,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80',
    description: 'Portable titanium electrode alkalizer with rechargeable lithium battery.'
  },
  {
    name: 'Alkaline Water Device Premium (30k Ltr Capacity)',
    sku: 'ALK-203',
    category: 'Alkaline Water Devices',
    mrp: 18000,
    ksp: 15000,
    price: 15000,
    kbp: 10000,
    stock: 30,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80',
    description: 'Dual platinum-plated electrolytic plates with automatic self-cleaning cycle.'
  },
  {
    name: 'Alkaline Water Device with Copper Jar Container',
    sku: 'ALK-204',
    category: 'Alkaline Water Devices',
    mrp: 18500,
    ksp: 15000,
    price: 15000,
    kbp: 10000,
    stock: 35,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80',
    description: 'Infused pure copper reservoir combined with active negative ORP ionization.'
  },
  {
    name: 'Alkaline Jug Filter Care Device (3.5L)',
    sku: 'ALK-205',
    category: 'Alkaline Water Devices',
    mrp: 5450,
    ksp: 5000,
    price: 5000,
    kbp: 4000,
    stock: 250,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80',
    description: 'BPA-free daily gravity pitcher maintaining 8.5 to 9.5 alkaline pH.'
  },

  // --- Category: Designer Modern Sarees (5 Products) ---
  {
    name: 'Modern Saree (Ready-Made Drape Edition)',
    sku: 'SAR-301',
    category: 'Designer Modern Sarees',
    mrp: 2499,
    ksp: 1500,
    price: 1500,
    kbp: 1000,
    stock: 80,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500&auto=format&fit=crop&q=80',
    description: 'Instant 1-minute pre-stitched pleated designer modern saree.'
  },
  {
    name: 'Festival Wear Premium Modern Saree',
    sku: 'SAR-302',
    category: 'Designer Modern Sarees',
    mrp: 7250,
    ksp: 5000,
    price: 5000,
    kbp: 4000,
    stock: 65,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=500&auto=format&fit=crop&q=80',
    description: 'Intricate zari border with woven banarasi pallu and lightweight drape.'
  },
  {
    name: 'Handcrafted Assam Tussar Silk Saree',
    sku: 'SAR-303',
    category: 'Designer Modern Sarees',
    mrp: 8900,
    ksp: 6500,
    price: 6500,
    kbp: 4800,
    stock: 40,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500&auto=format&fit=crop&q=80',
    description: 'Authentic pure wild silk directly loomed by master artisans of Guwahati.'
  },
  {
    name: 'Royal Organza Embroidered Floral Saree',
    sku: 'SAR-304',
    category: 'Designer Modern Sarees',
    mrp: 6200,
    ksp: 4500,
    price: 4500,
    kbp: 3200,
    stock: 55,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=500&auto=format&fit=crop&q=80',
    description: 'Sheer breathable organza adorned with delicate resham thread embroidery.'
  },
  {
    name: 'Contemporary Georgette Partywear Saree',
    sku: 'SAR-305',
    category: 'Designer Modern Sarees',
    mrp: 3800,
    ksp: 2700,
    price: 2700,
    kbp: 1900,
    stock: 90,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500&auto=format&fit=crop&q=80',
    description: 'Flowy georgette silhouette with satin hem piping for evening receptions.'
  },

  // --- Category: Gents Premium Wear (5 Products) ---
  {
    name: 'Gents Premium Clothes Combo (Shirt & Trousers)',
    sku: 'GPW-401',
    category: 'Gents Premium Wear',
    mrp: 6500,
    ksp: 5000,
    price: 5000,
    kbp: 4000,
    stock: 120,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=500&auto=format&fit=crop&q=80',
    description: 'Tailored executive cotton formal shirt paired with flex-fit trousers.'
  },
  {
    name: 'Royal Heritage Kurta Pajama Set',
    sku: 'GPW-402',
    category: 'Gents Premium Wear',
    mrp: 4999,
    ksp: 3800,
    price: 3800,
    kbp: 2800,
    stock: 90,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=500&auto=format&fit=crop&q=80',
    description: 'Pure linen textured ethnic set with mandarin collar and mother-of-pearl buttons.'
  },
  {
    name: 'Executive Italian Wool Blend Blazer',
    sku: 'GPW-403',
    category: 'Gents Premium Wear',
    mrp: 11900,
    ksp: 8900,
    price: 8900,
    kbp: 6500,
    stock: 35,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=500&auto=format&fit=crop&q=80',
    description: 'Structured single-breasted classic navy blazer with notch lapels.'
  },
  {
    name: 'Egyptian Giza Cotton Formal Shirt (Twin Pack)',
    sku: 'GPW-404',
    category: 'Gents Premium Wear',
    mrp: 4200,
    ksp: 3200,
    price: 3200,
    kbp: 2200,
    stock: 180,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=500&auto=format&fit=crop&q=80',
    description: 'Long-staple breathable cotton white and powder blue executive shirts.'
  },
  {
    name: 'Premium Nehru Bandhgala Jacket',
    sku: 'GPW-405',
    category: 'Gents Premium Wear',
    mrp: 5400,
    ksp: 4100,
    price: 4100,
    kbp: 3000,
    stock: 75,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=500&auto=format&fit=crop&q=80',
    description: 'Textured jacquard sleeveless bundi jacket for celebratory occasions.'
  },

  // --- Category: Smart EV Scooty (4 Products) ---
  {
    name: 'KUWIFR Electric Scooty (Executive Mobility Edition)',
    sku: 'EV-501',
    category: 'Smart EV Scooty',
    mrp: 120500,
    ksp: 110000,
    price: 110000,
    kbp: 50000,
    stock: 25,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500&auto=format&fit=crop&q=80',
    description: '85km range, removable lithium battery, regenerative braking, digital instrument cluster.'
  },
  {
    name: 'KUWIFR Pro Urban EV Scooter (110km Long Range)',
    sku: 'EV-502',
    category: 'Smart EV Scooty',
    mrp: 145000,
    ksp: 128000,
    price: 128000,
    kbp: 60000,
    stock: 15,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500&auto=format&fit=crop&q=80',
    description: 'Dual fast-charge battery technology with Bluetooth navigation and anti-theft GPS.'
  },
  {
    name: 'Fast-Charge Domestic Home EV Charging Station',
    sku: 'EV-503',
    category: 'Smart EV Scooty',
    mrp: 18000,
    ksp: 14500,
    price: 14500,
    kbp: 8000,
    stock: 50,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80',
    description: 'Weatherproof 16A smart surge-protected home wallbox for rapid electric 2-wheeler charging.'
  },
  {
    name: 'Smart Aerodynamic Helmet with Integrated Tail Lamp',
    sku: 'EV-504',
    category: 'Smart EV Scooty',
    mrp: 3500,
    ksp: 2500,
    price: 2500,
    kbp: 1500,
    stock: 200,
    isInStock: true,
    isActive: true,
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500&auto=format&fit=crop&q=80',
    description: 'DOT-certified high impact composite helmet with USB-rechargeable rear safety strobe.'
  }
];

// Forces insertion of any missing products among the 30
const syncAll30Products = async () => {
  try {
    for (const item of ALL_30_STORE_PRODUCTS) {
      await Product.findOneAndUpdate(
        { sku: item.sku },
        { $setOnInsert: item },
        { upsert: true, new: true }
      );
    }
  } catch (err) {
    console.error('Error synchronizing 30 products:', err.message);
  }
};

/**
 * Public catalog: GET /api/products
 */
const getAllProducts = async (req, res, next) => {
  try {
    await syncAll30Products();
    const { category, search, page = 1, limit = 100 } = req.query;
    const query = { isActive: true };

    if (category && category !== 'ALL') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [products, total] = await Promise.all([
      Product.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Product.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        products: products && products.length > 0 ? products : ALL_30_STORE_PRODUCTS,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      },
      products: products && products.length > 0 ? products : ALL_30_STORE_PRODUCTS
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: GET /api/admin/products or GET /api/products/admin/all
 */
const adminGetAllProducts = async (req, res, next) => {
  try {
    await syncAll30Products();
    const products = await Product.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json({
      success: true,
      data: { products: products && products.length > 0 ? products : ALL_30_STORE_PRODUCTS },
      products: products && products.length > 0 ? products : ALL_30_STORE_PRODUCTS
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Force manual sync: POST /api/products/seed-all
 */
const seedAllProductsManual = async (req, res, next) => {
  try {
    await syncAll30Products();
    const products = await Product.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json({
      success: true,
      message: `Successfully synchronized ${products.length} products in database.`,
      data: { products },
      products
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/products/:id
 */
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    return res.status(200).json({ success: true, data: { product }, product });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/products/categories
 */
const getCategories = async (req, res, next) => {
  try {
    const categories = await Product.distinct('category', { isActive: true });
    return res.status(200).json({
      success: true,
      data: { categories: categories || [] }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/products or POST /api/admin/products
 */
const createProduct = async (req, res, next) => {
  try {
    const b = { ...req.body };
    if (!b.name || (!b.ksp && !b.price)) {
      return res.status(400).json({
        success: false,
        message: 'Product name and Selling Price (KSP) are required.'
      });
    }

    const price = Number(b.ksp || b.price);
    const newProduct = await Product.create({
      ...b,
      name: b.name.trim(),
      sku: (b.sku || `KWF-${Date.now().toString().slice(-6)}`).toUpperCase(),
      mrp: Number(b.mrp || price),
      ksp: price,
      price: price,
      kbp: Number(b.kbp || 0),
      stock: Number(b.stock !== undefined ? b.stock : 100),
      isInStock: Number(b.stock !== undefined ? b.stock : 100) > 0,
      isActive: b.isActive !== undefined ? Boolean(b.isActive) : true,
      image: b.image || 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80'
    });

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product: newProduct },
      product: newProduct
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/products/:id or PUT /api/admin/products/:id
 */
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.mrp !== undefined) updates.mrp = Number(updates.mrp);
    if (updates.ksp !== undefined) {
      updates.ksp = Number(updates.ksp);
      updates.price = updates.ksp;
    }
    if (updates.price !== undefined && updates.ksp === undefined) {
      updates.price = Number(updates.price);
      updates.ksp = updates.price;
    }
    if (updates.kbp !== undefined) updates.kbp = Number(updates.kbp);
    if (updates.stock !== undefined) {
      updates.stock = Number(updates.stock);
      updates.isInStock = updates.stock > 0;
    }
    if (updates.isActive !== undefined) {
      updates.isActive = Boolean(updates.isActive);
    }

    const updated = await Product.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: { product: updated },
      product: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/products/:id or DELETE /api/admin/products/:id
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    return res.status(200).json({
      success: true,
      message: 'Product deleted permanently from database'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllProducts,
  adminGetAllProducts,
  seedAllProductsManual,
  getProductById,
  getCategories,
  createProduct,
  updateProduct,
  deleteProduct
};