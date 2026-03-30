const mongoose = require('mongoose');

// Use the same global cache as the Vercel serverless handler
if (!global._mongooseCache) {
  global._mongooseCache = { conn: null, promise: null };
}

const cached = global._mongooseCache;

const connectDB = async () => {
  try {
    // Check if already connected
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }

    // If connection dropped, reset cache
    if (cached.conn && mongoose.connection.readyState !== 1) {
      cached.conn = null;
      cached.promise = null;
    }

    // If no connection promise, create one
    if (!cached.promise) {
      const options = {
        serverSelectionTimeoutMS: process.env.VERCEL ? 20000 : 30000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: process.env.VERCEL ? 20000 : 30000,
        retryWrites: true,
        w: 'majority',
        maxPoolSize: process.env.VERCEL ? 3 : 10,
        minPoolSize: process.env.VERCEL ? 0 : 2,
        maxIdleTimeMS: process.env.VERCEL ? 10000 : 30000,
        family: 4,
        autoIndex: !process.env.VERCEL && !process.env.RAILWAY_ENVIRONMENT_ID,
      };

      console.log('Connecting to MongoDB Atlas...');
      cached.promise = mongoose.connect(process.env.MONGODB_URI, options)
        .then((conn) => {
          console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
          return conn;
        })
        .catch((error) => {
          console.error(`❌ MongoDB Connection Error during handshake: ${error.message}`);
          cached.promise = null;
          throw error;
        });
    }

    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    console.error(`✗ MongoDB Connection Error: ${error.message}`);
    cached.conn = null;
    cached.promise = null;

    // Don't exit in serverless environment
    if (process.env.VERCEL) {
      throw error;
    } else {
      console.error(`\n📋 To fix this, you need MongoDB running. Options:`);
      console.error(`   1. Install MongoDB locally: https://www.mongodb.com/try/download/community`);
      console.error(`   2. Use MongoDB Atlas (free): https://www.mongodb.com/cloud/atlas`);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
