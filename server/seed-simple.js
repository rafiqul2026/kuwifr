const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Define Product Schema (simplified)
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

// Define Package Schema (simplified)
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
  features: [String],
  benefits: [String],
  isPopular: Boolean,
  isActive: Boolean
}, { timestamps: true });

// Create models
const Product = mongoose.model('Product', productSchema);
const Package = mongoose.model('Package', packageSchema);

// ============ DATA ============

const products = [
  {
    name: "Magic Black Hair Color Shampoo",
    sku: "MBC-001",
    description: "Premium black hair color shampoo with natural ingredients",
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
  {
    name: "Modern Designer Saree",
    sku: "MDS-002",
    description: "Elegant modern designer saree for all occasions",
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
    name: "Protein Powder 1KG",
    sku: "PP-003",
    description: "Premium protein powder for muscle growth and recovery",
    shortDescription: "100% Pure Protein Powder",
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
    name: "Multi Vitamin Complex",
    sku: "MVC-004",
    description: "Complete multivitamin supplement for daily needs",
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
    name: "Health Product Premium",
    sku: "HP-005",
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
    name: "Kuwi Shilajit 99",
    sku: "KS-006",
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
    sku: "SBJ-007",
    description: "Premium seabuckthorn juice pack of 3",
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
  {
    name: "Gents Premium Clothes",
    sku: "GPC-008",
    description: "Premium quality clothing for men",
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
  {
    name: "Alkaline Jug or Drop",
    sku: "AJD-009",
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
    sku: "AWD-010",
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
    sku: "AMW-011",
    description: "Portable alkaline water device for on-the-go",
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
    sku: "AWP-012",
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
    sku: "CJD-013",
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
  {
    name: "Electric Scooty",
    sku: "ES-014",
    description: "Electric scooter - eco-friendly transportation",
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
      {
        name: "Magic Black Hair Color Shampoo",
        sku: "MBC-001",
        quantity: 1,
        price: 1500,
        kbp: 1000
      }
    ],
    features: ["One product from the package", "Low investment, high returns"],
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
      {
        name: "Kuwi Shilajit 99",
        sku: "KS-006",
        quantity: 1,
        price: 2000,
        kbp: 1500
      }
    ],
    features: ["Multiple product options", "Higher income potential"],
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
      {
        name: "Alkaline Water Device (15k Alkaline Water Capacity)",
        sku: "AWD-010",
        quantity: 1,
        price: 8000,
        kbp: 5000
      }
    ],
    features: ["Alkaline Water Device", "Health benefits"],
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
      {
        name: "Alkaline Water Device Premium (30k Alkaline Capacity)",
        sku: "AWP-012",
        quantity: 1,
        price: 12000,
        kbp: 8000
      }
    ],
    features: ["Premium Alkaline Device", "Premium benefits"],
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
      {
        name: "Electric Scooty",
        sku: "ES-014",
        quantity: 1,
        price: 88000,
        kbp: 50000
      }
    ],
    features: ["Electric Scooty", "VIP support"],
    benefits: ["Daily capping of ₹50,000", "Weekly capping of ₹350,000", "Monthly capping of ₹1,500,000"],
    isPopular: false,
    isActive: true
  }
];

// ============ SEED FUNCTION ============

async function seedDatabase() {
  try {
    // Clear existing data
    await Product.deleteMany({});
    await Package.deleteMany({});
    console.log('🗑️  Cleared existing products and packages');

    // Insert products
    const createdProducts = await Product.insertMany(products);
    console.log(`✅ Inserted ${createdProducts.length} products`);

    // Insert packages
    const createdPackages = await Package.insertMany(packages);
    console.log(`✅ Inserted ${createdPackages.length} packages`);

    console.log('\n🎉 Database seeded successfully!');
    console.log('📊 Products:', createdProducts.length);
    console.log('📦 Packages:', createdPackages.length);

    // Verify
    const productCount = await Product.countDocuments();
    const packageCount = await Package.countDocuments();
    console.log(`\n📊 Total Products: ${productCount}`);
    console.log(`📦 Total Packages: ${packageCount}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

// Run the seed
seedDatabase();