const mongoose = require('mongoose');

/**
 * Connect to MongoDB Database
 * Updated to remove deprecated options
 */
const connectDB = async () => {
  try {
    // Removed useNewUrlParser and useUnifiedTopology as they are deprecated
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`📍 Connection State: ${conn.connection.readyState}`);

    // Listen for connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    
    // Provide helpful error messages
    if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Make sure MongoDB is running!');
      console.error('   To start MongoDB:');
      console.error('   - Windows: net start MongoDB');
      console.error('   - Mac: brew services start mongodb-community');
      console.error('   - Linux: sudo systemctl start mongod');
    }
    
    if (error.message.includes('Authentication failed')) {
      console.error('💡 Check your MongoDB username and password in .env');
    }
    
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDB;