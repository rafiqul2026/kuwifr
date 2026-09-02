/**
 * Simple validation middleware
 */
const validate = (type) => {
  return (req, res, next) => {
    const errors = [];
    const { body } = req;

    switch (type) {
      case 'register':
        if (!body.fullName) {
          errors.push({ field: 'fullName', message: 'Full name is required' });
        } else if (body.fullName.length < 2) {
          errors.push({ field: 'fullName', message: 'Name must be at least 2 characters' });
        }

        if (!body.email) {
          errors.push({ field: 'email', message: 'Email is required' });
        } else if (!/^\S+@\S+\.\S+$/.test(body.email)) {
          errors.push({ field: 'email', message: 'Invalid email format' });
        }

        if (!body.phoneNumber) {
          errors.push({ field: 'phoneNumber', message: 'Phone number is required' });
        } else if (!/^[0-9]{10}$/.test(body.phoneNumber)) {
          errors.push({ field: 'phoneNumber', message: 'Phone number must be 10 digits' });
        }

        if (!body.password) {
          errors.push({ field: 'password', message: 'Password is required' });
        } else if (body.password.length < 8) {
          errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
        }
        break;

      case 'login':
        if (!body.email) {
          errors.push({ field: 'email', message: 'Email is required' });
        }
        if (!body.password) {
          errors.push({ field: 'password', message: 'Password is required' });
        }
        break;

      case 'changePassword':
        if (!body.currentPassword) {
          errors.push({ field: 'currentPassword', message: 'Current password is required' });
        }
        if (!body.newPassword) {
          errors.push({ field: 'newPassword', message: 'New password is required' });
        } else if (body.newPassword.length < 8) {
          errors.push({ field: 'newPassword', message: 'New password must be at least 8 characters' });
        }
        break;

      // ============ NEW VALIDATION RULES ============
      
      case 'forgotPassword':
        if (!body.email) {
          errors.push({ field: 'email', message: 'Email is required' });
        } else if (!/^\S+@\S+\.\S+$/.test(body.email)) {
          errors.push({ field: 'email', message: 'Invalid email format' });
        }
        break;

      case 'resetPassword':
        if (!body.token) {
          errors.push({ field: 'token', message: 'Reset token is required' });
        }
        if (!body.newPassword) {
          errors.push({ field: 'newPassword', message: 'New password is required' });
        } else if (body.newPassword.length < 8) {
          errors.push({ field: 'newPassword', message: 'Password must be at least 8 characters' });
        }
        break;

      case 'resendVerification':
        if (!body.email) {
          errors.push({ field: 'email', message: 'Email is required' });
        } else if (!/^\S+@\S+\.\S+$/.test(body.email)) {
          errors.push({ field: 'email', message: 'Invalid email format' });
        }
        break;
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    next();
  };
};

module.exports = { validate };