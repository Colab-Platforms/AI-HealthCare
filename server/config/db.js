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
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 60000,
        connectTimeoutMS: 30000,
        retryWrites: true,
        w: 'majority',
        maxPoolSize: process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT_ID ? 10 : 20, 
        minPoolSize: 0,
        maxIdleTimeMS: 15000,
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

    // Never crash the process on transient DB failures.
    // Let callers (middleware/routes) return a 503 while the app stays up.
    console.error(`\n📋 DB is currently unavailable. Options:`);
    console.error(`   1. Ensure your MongoDB Atlas IP access list allows this network`);
    console.error(`   2. Ensure DNS/SRV is not blocked (or use a non-SRV Mongo URI)`);
    console.error(`   3. Or run MongoDB locally: https://www.mongodb.com/try/download/community`);
    throw error;
  }
};

module.exports = connectDB;
