// server/src/middleware/adminAuth.js
const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/apiResponse');

/**
 * Verifies JWT token and enforces administrative privileges
 */
const requireAdmin = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'Access denied. No authorization token provided.');
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'kuwifr_super_secret_jwt_key_2026';

    const decoded = jwt.verify(token, secret);
    req.user = decoded;

    const normalizedRole = (decoded.role || '').toUpperCase();
    if (normalizedRole !== 'ADMIN' && normalizedRole !== 'SUPER_ADMIN') {
      return sendError(res, 403, 'Forbidden. Administrator credentials required.');
    }

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 401, 'Session expired. Please log in again.');
    }
    return sendError(res, 401, 'Invalid authentication token.');
  }
};

module.exports = {
  requireAdmin
};