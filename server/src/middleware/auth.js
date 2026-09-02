const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */
const auth = async (req, res, next) => {
  try {
    // Get token from cookie or Authorization header
    let token = req.cookies.token;

    if (!token) {
      // Check Authorization header
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.userId)
      .select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Authentication failed.'
      });
    }

    // Check if user is active
    if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
      return res.status(403).json({
        success: false,
        message: 'Account is suspended or deactivated. Contact support.'
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id;

    next();
  } catch (error) {
    // Handle specific JWT errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }

    // Generic error
    return res.status(401).json({
      success: false,
      message: 'Authentication failed.'
    });
  }
};

/**
 * Admin Authorization Middleware
 * Checks if user has admin role
 */
const adminAuth = async (req, res, next) => {
  // First run auth middleware
  auth(req, res, async () => {
    try {
      // Check if user exists and has admin role
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      next();
    } catch (error) {
      res.status(403).json({
        success: false,
        message: 'Authorization failed'
      });
    }
  });
};

/**
 * Super Admin Authorization Middleware
 * Checks if user has super admin role
 */
const superAdminAuth = async (req, res, next) => {
  auth(req, res, async () => {
    try {
      if (!req.user || req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Super admin access required'
        });
      }

      next();
    } catch (error) {
      res.status(403).json({
        success: false,
        message: 'Authorization failed'
      });
    }
  });
};

/**
 * Optional Authentication
 * Tries to authenticate but continues even if not authenticated
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token = req.cookies.token;

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      if (user && user.status === 'ACTIVE') {
        req.user = user;
        req.userId = user._id;
      }
    }
  } catch (error) {
    // Optional auth fails silently
  }

  next();
};

module.exports = { auth, adminAuth, superAdminAuth, optionalAuth };