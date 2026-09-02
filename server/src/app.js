// server/src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import config
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

// Validate environment variables
validateEnv();

// Connect to database
connectDB();

// ============================================================
// ✅ INITIALIZE APP
// ============================================================
const app = express();

// ==================== MIDDLEWARE ====================

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Rate limiting (configured with higher limit to prevent 429 errors during dashboard sync)
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

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Request logger
app.use(requestLogger);

// ==================== ROUTES ====================

// 🌐 WELCOME ROUTE (Root URL)
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
// ✅ MOUNTED API ENDPOINTS
// ============================================================

// Authentication
app.use('/api/auth', authRoutes);

// Users & Binary Tree
app.use('/api/users', userRoutes);

// Ranks & Kuwi Stars Progression
app.use('/api/ranks', rankRoutes);

// Products
app.use('/api/products', productRoutes);

// Membership Packages
app.use('/api/packages', packageRoutes);

// Payment Gateway Integration
app.use('/api/payment', paymentRoutes);

// Orders
app.use('/api/orders', orderRoutes);

// Wallets
app.use('/api/wallet', walletRoutes);

// Income & Overrides
app.use('/api/income', incomeRoutes);

// Bonanza Offers
app.use('/api/bonanza', bonanzaRoutes);

// Repurchase Store & 10-Level Matrix
app.use('/api/repurchase', repurchaseRoutes);

// Life Tension Free Funds
app.use('/api/funds', fundRoutes);

// Withdrawals
app.use('/api/withdrawals', withdrawalRoutes);

// Notifications
app.use('/api/notifications', notificationRoutes);

// Reports & Statistics
app.use('/api/reports', reportRoutes);

// Contact & Support
app.use('/api/contact', contactRoutes);

// Mount under /api/support
app.use('/api/support', supportRoutes);

// Admin Control Panel
app.use('/api/admin', adminRoutes);

// ==================== ERROR HANDLING ====================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

module.exports = app;