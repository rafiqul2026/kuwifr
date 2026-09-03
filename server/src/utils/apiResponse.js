// server/src/utils/apiResponse.js

/**
 * Standard Success Response
 */
const sendSuccess = (res, statusCode = 200, message = 'Operation successful', data = null, meta = null) => {
  const response = {
    success: true,
    message,
    data
  };

  if (meta) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

/**
 * Standard Error Response
 */
const sendError = (res, statusCode = 500, message = 'Internal server error', error = null) => {
  const response = {
    success: false,
    message
  };

  if (process.env.NODE_ENV !== 'production' && error) {
    response.error = error.message || error;
  }

  return res.status(statusCode).json(response);
};

module.exports = {
  sendSuccess,
  sendError
};