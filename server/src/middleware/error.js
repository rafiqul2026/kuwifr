/**
 * Global Error Handler Middleware
 * This catches all errors and formats them consistently
 */
const errorHandler = (err, req, res, next) => {
  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Log error for debugging
  console.error('Error Details:');
  console.error(`  Message: ${err.message}`);
  console.error(`  Path: ${req.path}`);
  console.error(`  Method: ${req.method}`);
  console.error(`  IP: ${req.ip}`);
  if (err.stack) {
    console.error(`  Stack: ${err.stack}`);
  }

  // ============ HANDLE SPECIFIC ERROR TYPES ============

  // 1. Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message
    }));
    return res.status(statusCode).json({
      success: false,
      message,
      errors
    });
  }

  // 2. Mongoose Duplicate Key Error (e.g., duplicate email)
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyPattern)[0];
    message = `Duplicate value for field: ${field}`;
    return res.status(statusCode).json({
      success: false,
      message,
      errors: [{
        field,
        message: `${field} already exists`
      }]
    });
  }

  // 3. JWT Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token. Please login again.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired. Please login again.';
  }

  // 4. Multer File Upload Errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = 'File is too large. Maximum size is 5MB.';
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    message = 'Unexpected file field.';
  }

  // ============ SEND RESPONSE ============

  // Build response object
  const response = {
    success: false,
    message
  };

  // In development, include error details
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.errors = err.errors || [];
  }

  res.status(statusCode).json(response);
};

/**
 * 404 Not Found Handler
 * This catches requests to routes that don't exist
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
};

module.exports = { errorHandler, notFoundHandler };