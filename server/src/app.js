// server/src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import configuration
const { validateEnv } = require('./config/env');
const connectDB = require('./config/db');

// Import middleware
const { errorHandler, notFoundHandler } = require('./middleware/error');
const { requestLogger } = require('./middleware/logger');

// ============================================================
// ✅ ROUTE IMPORTS
// ============================================================
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const campaignRoutes = require('./routes/campaign.routes');
const productRoutes = require('./routes/product.routes');
const packageRoutes = require('./routes/package.routes');
const paymentRoutes = require('./routes/payment.routes');
const orderRoutes = require('./routes/order.routes');
const walletRoutes = require('./routes/wallet.routes');
const incomeRoutes = require('./routes/income.routes');
const rankRoutes = require('./routes/rank.routes');
const fundRoutes = require('./routes/fund.routes');
const withdrawalRoutes = require('./routes/withdrawal.routes');
const repurchaseRoutes = require('./routes/repurchase.routes');
const bonanzaRoutes = require('./routes/bonanza.routes');
const notificationRoutes = require('./routes/notification.routes');
const reportRoutes = require('./routes/report.routes');
const contactRoutes = require('./routes/contact.routes');
const supportRoutes = require('./routes/support.routes');
const adminRoutes = require('./routes/admin.routes');
const settingRoutes = require('./routes/setting.routes');
const auditLogRoutes = require('./routes/auditLog.routes');

// Validate environment variables
validateEnv();

// Connect to MongoDB
connectDB();

// ============================================================
// ✅ INITIALIZE APP
// ============================================================
const app = express();

// Enable proxy trust for Render / Cloudflare reverse proxies
app.set('trust proxy', 1);

// ==================== CORS CONFIGURATION ====================
const defaultAllowedOrigins = [
  'https://www.kuwifr.in',
  'https://kuwifr.in',
  'https://kuwifr.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000'
];

const envAllowedOrigins = [
  process.env.CLIENT_URL,
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [])
].filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envAllowedOrigins]));

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g. mobile apps, curl, Postman, server-to-server)
    if (!origin) return callback(null, true);

    // Check if origin matches allowed domains or any Vercel preview deployment
    const isAllowed =
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.kuwifr.in') ||
      /^https:\/\/kuwifr.*\.vercel\.app$/.test(origin);

    if (isAllowed) {
      return callback(null, true);
    }

    // Do not throw an error (prevents Express crashes on preflights)
    console.warn(`[CORS Blocked] Origin: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'X-Requested-With',
    'Origin'
  ],
  exposedHeaders: ['Set-Cookie']
};

// Apply CORS before any route or middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle all HTTP preflight requests globally

// ==================== SECURITY & PARSING ====================
// Configure Helmet without blocking cross-origin API assets
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});
app.use('/api', limiter);

// Body parsers (support base64 images and large JSON payloads)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Request logger
app.use(requestLogger);

// ==================== SYSTEM ROUTES ====================

// 🌐 ROOT STATUS ROUTE
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to KUWIFR API Server',
    version: '1.0.0',
    status: 'Running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    endpoints: {
      health: '/api/health',
      test: '/api/test'
    }
  });
});

// 🔍 HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    mongodb: {
      status: 'Connected',
      database: 'kuwifrdb'
    }
  });
});

// 🧪 TEST ROUTE
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Backend is working!',
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// ✅ MOUNTED API ROUTERS
// ============================================================

// Authentication
app.use('/api/auth', authRoutes);

// Users & Binary Tree
app.use('/api/users', userRoutes);

// Ranks & Kuwi Stars Progression
app.use('/api/ranks', rankRoutes);
app.use('/api/admin/ranks', rankRoutes);

// Products
app.use('/api/products', productRoutes);
app.use('/api/admin/products', productRoutes);

// Membership Packages
app.use('/api/packages', packageRoutes);
app.use('/api/admin/packages', packageRoutes);

// Payment Gateway Integration
app.use('/api/payment', paymentRoutes);

// Orders
app.use('/api/orders', orderRoutes);
app.use('/api/admin/orders', orderRoutes);

// Wallets (Income, Repurchase, and Salary 1% TTO)
app.use('/api/wallet', walletRoutes);

// Income & Overrides
app.use('/api/income', incomeRoutes);

// Bonanza Offers
app.use('/api/bonanza', bonanzaRoutes);

// Repurchase Store & Matrix
app.use('/api/repurchase', repurchaseRoutes);

// Life Tension Free Funds
app.use('/api/funds', fundRoutes);
app.use('/api/admin/funds', fundRoutes);

// Withdrawals
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/admin/withdrawals', withdrawalRoutes);

// Notifications
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin/notifications', notificationRoutes);

// Reports & Statistics
app.use('/api/reports', reportRoutes);
app.use('/api/admin/reports', reportRoutes);

// Contact & Support
app.use('/api/contact', contactRoutes);
app.use('/api/support', supportRoutes);

// Admin Control Panel
app.use('/api/admin', adminRoutes);

// Campaigns
app.use('/api/campaigns', campaignRoutes);
app.use('/api/admin/campaigns', campaignRoutes);

// Settings
app.use('/api/settings', settingRoutes);
app.use('/api/admin/settings', settingRoutes);

// Audit Logs
app.use('/api/audit', auditLogRoutes);
app.use('/api/admin/audit', auditLogRoutes);

// ==================== ERROR HANDLING ====================

// 404 handler for unknown endpoints
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

module.exports = app;