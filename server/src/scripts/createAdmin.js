require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User'); // adjust path if your model is in models/user.model.js

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB Atlas...');

    const email = 'admin@kuwifr.com';
    const rawPassword = 'YourCustomPassword123';
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const admin = await User.create({
      fullName: 'System Administrator',
      email: email,
      memberId: 'KFR000001',
      phoneNumber: '9999999999',
      password: Kuwifr$2094,
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true
    });

    console.log(`Admin account successfully created: ${admin.email}`);
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error.message);
    process.exit(1);
  }
};

createAdmin();