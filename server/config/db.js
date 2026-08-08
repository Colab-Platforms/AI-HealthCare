const mongoose = require('mongoose');
const dns = require('dns');
const { isProduction, isServerless } = require('./env');

// Some dev machines fall back to a 127.0.0.1 resolver, which fails
// mongodb+srv:// SRV lookups with ECONNREFUSED. Forcing public resolvers works
// around that locally — but in a hosted environment it overrides the platform's
// own (usually faster and more reliable) resolver and adds an external
// dependency to every SRV lookup, so keep it to development only.
// Set FORCE_PUBLIC_DNS=true to re-enable it in a deployed environment.
if (!isProduction || process.env.FORCE_PUBLIC_DNS === 'true') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

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
      // Serverless (Vercel) and long-lived servers (Render/Railway/bare node)
      // want opposite pool behaviour. On serverless each invocation is short and
      // may be frozen, so a small pool that expires idle sockets is right. On a
      // persistent server, expiring idle sockets means paying a fresh TCP + TLS +
      // SCRAM auth handshake to Atlas on the next burst of traffic — so keep a
      // warm floor of connections and never let them idle out.
      const options = {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 60000,
        connectTimeoutMS: 30000,
        retryWrites: true,
        w: 'majority',
        maxPoolSize: isServerless ? 10 : 20,
        minPoolSize: isServerless ? 0 : 5,
        maxIdleTimeMS: isServerless ? 15000 : 0, // 0 = never expire idle sockets
        family: 4,
        // Index builds must never run on boot in production: Mongoose issues a
        // createIndex for every index on every model at startup, which on grown
        // collections makes the app slow (or unresponsive) until it completes.
        // Create indexes deliberately via `npm run sync-indexes` after deploy.
        autoIndex: !isProduction,
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
