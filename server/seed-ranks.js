const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Define Rank Schema
const rankSchema = new mongoose.Schema({
  name: String,
  level: Number,
  code: String,
  starsRequired: Number,
  reward: String,
  rewardValue: Number,
  salaryPercentage: Number,
  benefits: [String],
  icon: String,
  color: String,
  isActive: Boolean
});

const Rank = mongoose.model('Rank', rankSchema);

// ============ ALL 12 RANKS FROM BUSINESS PLAN ============
const ranks = [
  {
    name: "Kuwi Star",
    level: 1,
    code: "KUWI_STAR",
    starsRequired: 0,
    reward: "Diary + Pen",
    rewardValue: 500,
    salaryPercentage: 0,
    benefits: ["Entry level recognition"],
    icon: "⭐",
    color: "#f59e0b",
    isActive: true
  },
  {
    name: "Bronze Star",
    level: 2,
    code: "BRONZE_STAR",
    starsRequired: 6,
    reward: "Executive Bag",
    rewardValue: 1500,
    salaryPercentage: 0,
    benefits: ["Professional recognition"],
    icon: "🥉",
    color: "#cd7f32",
    isActive: true
  },
  {
    name: "Silver Star",
    level: 3,
    code: "SILVER_STAR",
    starsRequired: 20,
    reward: "Branded Watch",
    rewardValue: 5000,
    salaryPercentage: 0,
    benefits: ["Leadership recognition"],
    icon: "🥈",
    color: "#c0c0c0",
    isActive: true
  },
  {
    name: "Platinum Star",
    level: 4,
    code: "PLATINUM_STAR",
    starsRequired: 70,
    reward: "Android Mobile",
    rewardValue: 15000,
    salaryPercentage: 0,
    benefits: ["High achiever recognition"],
    icon: "💎",
    color: "#e5e4e2",
    isActive: true
  },
  {
    name: "Gold Star",
    level: 5,
    code: "GOLD_STAR",
    starsRequired: 200,
    reward: "Laptop",
    rewardValue: 50000,
    salaryPercentage: 0.01,
    benefits: ["Salary: 1% on TTO monthly"],
    icon: "🥇",
    color: "#ffd700",
    isActive: true
  },
  {
    name: "Sapphire Star",
    level: 6,
    code: "SAPPHIRE_STAR",
    starsRequired: 700,
    reward: "Electric Bike",
    rewardValue: 80000,
    salaryPercentage: 0.0075,
    benefits: ["Salary: 0.75% on TTO monthly"],
    icon: "💙",
    color: "#0f52ba",
    isActive: true
  },
  {
    name: "Emerald Star",
    level: 7,
    code: "EMERALD_STAR",
    starsRequired: 2200,
    reward: "Alto 800",
    rewardValue: 350000,
    salaryPercentage: 0.005,
    benefits: ["Salary: 0.50% on TTO monthly"],
    icon: "💚",
    color: "#50c878",
    isActive: true
  },
  {
    name: "Ruby Star",
    level: 8,
    code: "RUBY_STAR",
    starsRequired: 7000,
    reward: "Venue/Bolero",
    rewardValue: 800000,
    salaryPercentage: 0.004,
    benefits: ["Salary: 0.40% on TTO monthly"],
    icon: "❤️",
    color: "#e0115f",
    isActive: true
  },
  {
    name: "Diamond Star",
    level: 9,
    code: "DIAMOND_STAR",
    starsRequired: 15000,
    reward: "Thar Roxx",
    rewardValue: 1500000,
    salaryPercentage: 0.003,
    benefits: ["Salary: 0.30% on TTO monthly"],
    icon: "💎",
    color: "#b9f2ff",
    isActive: true
  },
  {
    name: "Sales Director",
    level: 10,
    code: "SALES_DIRECTOR",
    starsRequired: 35000,
    reward: "Fortuner",
    rewardValue: 3500000,
    salaryPercentage: 0.0025,
    benefits: ["Salary: 0.25% on TTO monthly"],
    icon: "🏆",
    color: "#ff6b35",
    isActive: true
  },
  {
    name: "Ambassador",
    level: 11,
    code: "AMBASSADOR",
    starsRequired: 75000,
    reward: "BMW X5",
    rewardValue: 7500000,
    salaryPercentage: 0.002,
    benefits: ["Salary: 0.20% on TTO monthly"],
    icon: "👑",
    color: "#8b008b",
    isActive: true
  },
  {
    name: "Crown",
    level: 12,
    code: "CROWN",
    starsRequired: 160000,
    reward: "Bungalow",
    rewardValue: 25000000,
    salaryPercentage: 0.0015,
    benefits: ["Salary: 0.15% on TTO monthly"],
    icon: "👑",
    color: "#ffd700",
    isActive: true
  }
];

async function seedRanks() {
  try {
    // Clear existing ranks
    await Rank.deleteMany({});
    console.log('🗑️  Cleared existing ranks');

    // Insert ranks
    const inserted = await Rank.insertMany(ranks);
    console.log(`✅ Inserted ${inserted.length} ranks`);
    console.log('\n📊 Ranks:');
    inserted.forEach(r => {
      console.log(`   ${r.icon} ${r.name} - ${r.starsRequired} stars required`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

seedRanks();