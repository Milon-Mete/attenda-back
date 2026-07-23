const mongoose = require('mongoose');

const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGODB_URI, {
    // Mongoose 8+ uses new defaults, no need for deprecated options
  });

  console.log(`MongoDB Connected: ${conn.connection.host}`);

  // Create 2dsphere index on Logs collection
  const db = conn.connection.db;
  const logsCollection = db.collection('logs');
  
  try {
    await logsCollection.createIndex({ location: '2dsphere' });
    console.log('2dsphere index on logs.location created/verified');
  } catch (err) {
    // Index may already exist, that's fine
    if (err.code !== 85) {
      console.warn('Index creation warning:', err.message);
    }
  }

  return conn;
};

module.exports = connectDB;
