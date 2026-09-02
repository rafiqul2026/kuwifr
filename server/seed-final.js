const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Define Product Schema
const productSchema = new mongoose.Schema({
  name: String,
  sku: String,
  description: String,
  shortDescription: String,
  mrp: Number,
  ksp: Number,
  kbp: Number,
  category: String,
  stock: Number,
  isInStock: Boolean,
  isActive: Boolean,
  countryOfOrigin: String
}, { timestamps: true });

// Define Package Schema
const packageSchema = new mongoose.Schema({
  name: String,
  type: String,
  price: Number,
  kbp: Number,
  dailyCap: Number,
  weeklyCap: Number,
  monthlyCap: Number,
  description: String,
  products: Array,
  productNote: String,
  features: [String],
  benefits: [String],
  isPopular: Boolean,
  isActive: Boolean
}, { timestamps: true });

// Create models
const Product = mongoose.model('Product', productSchema);
const Package = mongoose.model('Package', packageSchema);

// ============ PRODUCTS DATA ============
const products = [
  // Hair Care Products
  {
    name: "Instant/Magic Hair Colour Shampoo",
    sku: "MBC-001",
    description: "Premium black hair color shampoo with natural ingredients for vibrant hair color",
    shortDescription: "Natural black hair color shampoo",
    mrp: 1999,
    ksp: 1500,
    kbp: 1000,
    category: "HAIR_CARE",
    stock: 100,
    isInStock: true,
    isActive: true,
    countryOfOrigin: "India"
  },
  // Clothing Products
  {
    name: "Modern Saree",
    sku: "MDS-002",
    description: "Elegant modern designer saree with traditional touch for all occasions",
    shortDescription: "Designer saree for all occasions",
    mrp: 2499,
    ksp: 2000,
    kbp: 1200,
    category: "CLOTHING",
    stock: 50,
    isInStock: true,
    isActive: true,
    countryOfOrigin: "India"
  },
  {
    name: "Premium Modern Saree",
    sku: "PMS-003",
    description: "Premium quality modern saree with exquisite design",
    shortDescription: "Premium modern saree",
    mrp: 2999,
    ksp: 2400,
    kbp: 1400,
    category: "CLOTHING",
    stock: 40,
    isInStock: true,
    isActive: true,
    countryOfOrigin: "India"
  },
  {
    name: "Gents Premium Clothes",
    sku: "GPC-004",
    description: "Premium quality clothing for men - stylish and comfortable",
    shortDescription: "Premium men's clothing",
    mrp: 2000,
    ksp: 1600,
    kbp: 1000,
    category: "CLOTHING",
    stock: 40,
    isInStock: true,
    isActive: true,
    countryOfOrigin: "India"
  },
  // Health Supplement Products
  {
    name: "Protein Powder",
    sku: "PP-005",
    description: "Premium protein powder for muscle growth and recovery",
    shortDescription: "Protein powder",
    mrp: 3500,
    ksp: 2800,
    kbp: 1800,
    category: "HEALTH_SUPPLEMENT",
    stock: 200,
    isInStock: true,
    isActive: true,
    countryOfOrigin: "India"
  },
  {
    name: "Protein Powder 1KG",
    sku: "PPK-006",
    description: "Premium protein powder 1KG pack for muscle growth",
    shortDescription: "1KG Protein Powder",
    mrp: 3500,
    ksp: 2800,
    kbp: 1800,
    category: "HEALTH_SUPPLEMENT",
    stock: 200,
    isInStock: true,
    isActive: true,
    countryOfOrigin: "India"
  },
  {
    name: "Multi Vitamin",
    sku: "MV-007",
    description: "Complete multivitamin supplement for daily nutritional needs",
    shortDescription: "Complete multivitamin supplement",
    mrp: 1500,
    ksp: 1200,
    kbp: 800,
    category: "HEALTH_SUPPLEMENT",
    stock: 150,
    isInStock: true,
    isActive: true,
    countryOfOrigin: "India"
  },
  {
    name: "Health Product",
    sku: "HP-008",
    description: "Premium health product for overall wellness",
    shortDescription: "Premium health product",
    mrp: 1000,
    ksp: 800,
    kbp: 500,
    category: "HEALTH_SUPPLEMENT",
    stock: 120,
    isInStock: true,
    isActive: true,
    countryOfOrigin: "India"
  },
  {
    name: "Health Products",
    sku: "HPS-009",
    description: "Premium health products for overall wellness",
    shortDescription: "Premium health products",
    mrp: 1500,
    ksp: 1200,
    kbp: 800,
    category: "HEALTH_SUPPLEMENT",
    stock: 120,
    isInStock: true,
    isActive: true,
    countryOfOrigin: "India"
  },
  {
    name: "Kuwi Shilajit 99",
    sku: "KS-010",
    description: "Pure Shilajit extract for energy and vitality",
    shortDescription: "Pure Shilajit extract",
    mrp: 2500,
    ksp: 2000,
    kbp: 1500,
    category: "HEALTH_SUPPLEMENT",
    stock: 80,
    isInStock: true,
    isActive: true,
    countryOfOrigin: "India"
  },
  {
    name: "Seabuckthorn Juice (All Solutions) × 3 Pcs",
    sku: "SBJ-011",
    description: "Premium seabuckthorn juice pack of 3 for overall health",
    shortDescription: "Seabuckthorn juice pack of 3",
    mrp: 3000,
    ksp: 2400,
    kbp: 1600,
    category: "HEALTH_SUPPLEMENT",
    stock: 60,
    isInStock: true,
    isActive: true,
    countryOfOrigin: "India"
  },
  // Water Purifier Products
  {
    name: "Alkaline Jug or Drop",
    sku: "AJD-012",
    description: "Alkaline water jug or drop for healthy alkaline water",
    shortDescription: "Alkaline water jug/drop",
    mrp: 1500,
    ksp: 1200,
    kbp: 800,
    category: "WATER_PURIFIER",
    stock: 30,
    isInStock: true,
    isActive: true,
    countryOfOrigin: "India"
  },
  {
    name: "Alkaline Water Device (15k Alkaline Water Capacity)",
    sku: "AWD-013",
    description: "Premium alkaline water device with 15,000 liters capacity",
    shortDescription: "15K Alkaline Water Device",
    mrp: 10000,
    ksp: 8000,
    kbp: 5000,
    category: "WATER_PURIFIER",
    stock: 20,
    isInStock: true,
    isActive: true,
    countryOfOrigin: "India"
  },
  {
    name: "Alkaline Mobile Water Device",
    sku: "AMW-014",
    description: "Portable alkaline water device for on-the-go healthy water",
    shortDescription: "Portable alkaline water device",
    mrp: 3000,
    ksp: 2400,
    kbp: 1500,
    category: "WATER_PURIFIER",
    stock: 25,
    isInStock: true,
    isActive: true,
    countryOfOrigin: "India"
  },
  {
    name: "Alkaline Water Device Premium (30k Alkaline Capacity)",
    sku: "AWP-015",
    description: "Premium alkaline water device with 30,000 liters capacity",
    shortDescription: "30K Premium Alkaline Device",
    mrp: 15000,
    ksp: 12000,
    kbp: 8000,
    category: "WATER_PURIFIER",
    stock: 15,
    isInStock: true,
    isActive: true,
    countryOfOrigin: "India"
  },
  {
    name: "Alkaline Water Device of Copper Jar",
    sku: "CJD-016",
    description: "Traditional copper jar with alkaline water technology",
    shortDescription: "Copper Jar Alkaline Device",
    mrp: 12000,
    ksp: 9600,
    kbp: 6000,
    category: "WATER_PURIFIER",
    stock: 10,
    isInStock: true,
    isActive: true,
    countryOfOrigin: "India"
  },
  // Vehicle Products
  {
    name: "Electric Scooty",
    sku: "ES-017",
    description: "Electric scooter - eco-friendly and cost-effective transportation",
    shortDescription: "Electric Scooter",
    mrp: 110000,
    ksp: 88000,
    kbp: 50000,
    category: "VEHICLE",
    stock: 5,
    isInStock: true,
    isActive: true,
    countryOfOrigin: "India"
  }
];

// ============ PACKAGES DATA ============
const packages = [
  {
    name: "Starter Package",
    type: "STARTER",
    price: 1500,
    kbp: 1000,
    dailyCap: 1500,
    weeklyCap: 10500,
    monthlyCap: 45000,
    description: "Perfect for beginners to start their journey with KUWIFR",
    products: [
      { name: "Instant/Magic Hair Colour Shampoo", sku: "MBC-001", quantity: 1, price: 1500, kbp: 1000 },
      { name: "Modern Saree", sku: "MDS-002", quantity: 1, price: 2000, kbp: 1200 },
      { name: "Protein Powder", sku: "PP-005", quantity: 1, price: 2800, kbp: 1800 },
      { name: "Multi Vitamin", sku: "MV-007", quantity: 1, price: 1200, kbp: 800 },
      { name: "Health Product", sku: "HP-008", quantity: 1, price: 800, kbp: 500 }
    ],
    productNote: "NB: One Product any of them...",
    features: ["One product from the package", "Low investment, high returns", "Perfect for beginners"],
    benefits: ["Daily capping of ₹1,500", "Weekly capping of ₹10,500", "Monthly capping of ₹45,000"],
    isPopular: true,
    isActive: true
  },
  {
    name: "Growth Package",
    type: "GROWTH",
    price: 5000,
    kbp: 5000,
    dailyCap: 7000,
    weeklyCap: 49000,
    monthlyCap: 210000,
    description: "For those ready to scale their business",
    products: [
      { name: "Kuwi Shilajit 99", sku: "KS-010", quantity: 1, price: 2000, kbp: 1500 },
      { name: "Seabuckthorn Juice (All Solutions) × 3 Pcs", sku: "SBJ-011", quantity: 1, price: 2400, kbp: 1600 },
      { name: "Premium Modern Saree", sku: "PMS-003", quantity: 1, price: 2400, kbp: 1400 },
      { name: "Protein Powder 1KG", sku: "PPK-006", quantity: 1, price: 2800, kbp: 1800 },
      { name: "Health Products", sku: "HPS-009", quantity: 1, price: 1200, kbp: 800 },
      { name: "Gents Premium Clothes", sku: "GPC-004", quantity: 1, price: 1600, kbp: 1000 },
      { name: "Alkaline Jug or Drop", sku: "AJD-012", quantity: 1, price: 1200, kbp: 800 }
    ],
    productNote: "NB: One Product any of them...",
    features: ["Multiple product options", "Higher income potential", "Business growth focused"],
    benefits: ["Daily capping of ₹7,000", "Weekly capping of ₹49,000", "Monthly capping of ₹210,000"],
    isPopular: false,
    isActive: true
  },
  {
    name: "Life Safe Package",
    type: "LIFE_SAFE",
    price: 10000,
    kbp: 7500,
    dailyCap: 15000,
    weeklyCap: 105000,
    monthlyCap: 450000,
    description: "Comprehensive package for health and wellness",
    products: [
      { name: "Alkaline Water Device (15k Alkaline Water Capacity)", sku: "AWD-013", quantity: 1, price: 8000, kbp: 5000 },
      { name: "Alkaline Mobile Water Device", sku: "AMW-014", quantity: 1, price: 2400, kbp: 1500 }
    ],
    productNote: "NB: One Product any of them...",
    features: ["Alkaline Water Device", "Mobile Water Device", "Health benefits"],
    benefits: ["Daily capping of ₹15,000", "Weekly capping of ₹105,000", "Monthly capping of ₹450,000"],
    isPopular: false,
    isActive: true
  },
  {
    name: "Life Safe Elite Package",
    type: "LIFE_SAFE_ELITE",
    price: 15000,
    kbp: 10000,
    dailyCap: 20000,
    weeklyCap: 140000,
    monthlyCap: 600000,
    description: "Premium package for elite performers",
    products: [
      { name: "Alkaline Water Device Premium (30k Alkaline Capacity)", sku: "AWP-015", quantity: 1, price: 12000, kbp: 8000 },
      { name: "Alkaline Water Device of Copper Jar", sku: "CJD-016", quantity: 1, price: 9600, kbp: 6000 }
    ],
    productNote: "",
    features: ["Premium Alkaline Water Device", "Copper Jar Device", "Premium benefits"],
    benefits: ["Daily capping of ₹20,000", "Weekly capping of ₹140,000", "Monthly capping of ₹600,000"],
    isPopular: false,
    isActive: true
  },
  {
    name: "Titanium Package",
    type: "TITANIUM",
    price: 110000,
    kbp: 50000,
    dailyCap: 50000,
    weeklyCap: 350000,
    monthlyCap: 1500000,
    description: "The ultimate package for business leaders",
    products: [
      { name: "Electric Scooty", sku: "ES-017", quantity: 1, price: 88000, kbp: 50000 }
    ],
    productNote: "",
    features: ["Electric Scooty", "Premium products", "VIP support"],
    benefits: ["Daily capping of ₹50,000", "Weekly capping of ₹350,000", "Monthly capping of ₹1,500,000"],
    isPopular: false,
    isActive: true
  }
];

// ============ SEED FUNCTION ============

async function seedDatabase() {
  try {
    console.log('🔄 Starting database seed...\n');

    // Clear existing data
    await Product.deleteMany({});
    await Package.deleteMany({});
    console.log('🗑️  Cleared existing products and packages\n');

    // Insert products
    const createdProducts = await Product.insertMany(products);
    console.log(`✅ Inserted ${createdProducts.length} products`);
    console.log('   Product list:');
    createdProducts.forEach((p, i) => {
      console.log(`   ${i+1}. ${p.name} (₹${p.ksp}) - KBP: ${p.kbp}`);
    });

    console.log('');

    // Insert packages
    const createdPackages = await Package.insertMany(packages);
    console.log(`✅ Inserted ${createdPackages.length} packages`);
    console.log('   Package list:');
    createdPackages.forEach((p, i) => {
      console.log(`   ${i+1}. ${p.name} (₹${p.price}) - KBP: ${p.kbp}`);
      console.log(`      Products: ${p.products.length} options`);
      if (p.productNote) {
        console.log(`      ${p.productNote}`);
      }
    });

    console.log('\n🎉 Database seeded successfully!');
    console.log(`📊 Total Products: ${createdProducts.length}`);
    console.log(`📦 Total Packages: ${createdPackages.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

// Run the seed
seedDatabase();