const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Check if already connected
    if (mongoose.connection.readyState === 1) {
      console.log('✓ MongoDB already connected');
      return mongoose.connection;
    }

    const options = {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      bufferTimeoutMS: 30000, // Increase from default 10s to 30s
      retryWrites: true,
      w: 'majority',
      maxPoolSize: process.env.VERCEL ? 5 : 10,
      minPoolSize: process.env.VERCEL ? 0 : 2,
      maxIdleTimeMS: process.env.VERCEL ? 10000 : 30000,
    };

    console.log('Connecting to MongoDB...');

    const conn = await mongoose.connect(process.env.MONGODB_URI, options);
    console.log(`✓ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`✗ MongoDB Connection Error: ${error.message}`);

    // Don't exit in serverless environment
    if (process.env.VERCEL) {
      console.error('Running in Vercel - continuing without database');
      throw error; // Throw but don't exit
    } else {
      console.error(`\n📋 To fix this, you need MongoDB running. Options:`);
      console.error(`   1. Install MongoDB locally: https://www.mongodb.com/try/download/community`);
      console.error(`   2. Use MongoDB Atlas (free): https://www.mongodb.com/cloud/atlas`);
      console.error(`      - Create a free cluster`);
      console.error(`      - Get connection string and update MONGODB_URI in .env`);
      console.error(`\n   Example Atlas URI: mongodb+srv://user:pass@cluster.mongodb.net/healthcare-ai\n`);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
