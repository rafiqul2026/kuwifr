const mongoose = require('mongoose');
require('dotenv').config();

console.log('📡 Testing MongoDB Connection...');
console.log(`🔗 Connection String: ${process.env.MONGODB_URI}`);

async function testConnection() {
  try {
    // Try to connect
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connection successful!');
    console.log(`   Host: ${conn.connection.host}`);
    console.log(`   Database: ${conn.connection.name}`);
    console.log(`   ReadyState: ${conn.connection.readyState}`);
    
    // List all collections
    const collections = await conn.connection.db.listCollections().toArray();
    console.log(`📚 Collections found: ${collections.length}`);
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    
    await mongoose.disconnect();
    console.log('✅ Disconnected successfully');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 MongoDB is not running!');
      console.log('   To start MongoDB:');
      console.log('   - Windows: net start MongoDB');
      console.log('   - Mac: brew services start mongodb-community');
      console.log('   - Linux: sudo systemctl start mongod');
    }
  }
}

testConnection();