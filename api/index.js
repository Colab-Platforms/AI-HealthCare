// Vercel serverless function handler
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables
const envPath = path.join(__dirname, '../server/.env');
dotenv.config({ path: envPath });

// Set Vercel environment
process.env.VERCEL = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// ============================================================
// Official Vercel + MongoDB connection pattern
// Uses global object to persist connection across warm invocations
// See: https://vercel.com/guides/deploying-a-mongodb-powered-api
// ============================================================
const MONGODB_URI = process.env.MONGODB_URI;

if (!global._mongooseCache) {
  global._mongooseCache = { conn: null, promise: null };
}

const cached = global._mongooseCache;

async function connectToDatabase() {
  // Already connected and connection is alive
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // Connection dropped - reset cache
  if (cached.conn && mongoose.connection.readyState !== 1) {
    console.log('⚠️ MongoDB connection dropped (state:', mongoose.connection.readyState, '), reconnecting...');
    cached.conn = null;
    cached.promise = null;
  }

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in environment variables');
  }

  // If no connection promise exists, create one
  if (!cached.promise) {
    console.log('🔄 Creating new MongoDB connection...');
    const opts = {
      serverSelectionTimeoutMS: 20000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 20000,
      retryWrites: true,
      w: 'majority',
      maxPoolSize: 3,
      minPoolSize: 0,
      maxIdleTimeMS: 10000,
      family: 4,
      bufferCommands: true,
      autoIndex: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then((mongooseInstance) => {
        console.log('✅ MongoDB connected:', mongooseInstance.connection.host);
        return mongooseInstance;
      })
      .catch((err) => {
        console.error('❌ MongoDB connection error:', err.message);
        // Reset promise so next invocation can retry
        cached.promise = null;
        throw err;
      });
  } else {
    console.log('⏳ Awaiting existing MongoDB connection promise...');
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // Reset everything on failure
    cached.conn = null;
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}

// ============================================================
// PRE-WARM: Start DB connection at module load time
// ============================================================
if (MONGODB_URI) {
  connectToDatabase().catch(err => {
    console.error('Pre-warm failed (will retry on request):', err.message);
  });
}

// Import Express and middleware
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ============================================================
// Database connection middleware
// Ensures DB is connected before any route handler runs
// ============================================================
app.use('/api', async (req, res, next) => {
  // Skip DB connection for health check and debug endpoints
  if (req.path === '/health-check' || req.path === '/debug-connection') {
    return next();
  }

  try {
    await connectToDatabase();
    return next();
  } catch (error) {
    console.error(`[DB Middleware] ${req.method} ${req.originalUrl} FAILED:`, error.message);
    return res.status(503).json({
      message: 'Database connection failed. Please try again in a moment.',
      error: 'Service temporarily unavailable',
      debug: {
        readyState: mongoose.connection.readyState,
        errorMessage: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// ============================================================
// Health check endpoint
// ============================================================
app.get('/api/health-check', async (req, res) => {
  let dbConnected = mongoose.connection.readyState === 1;
  let connectionError = null;

  if (!dbConnected) {
    try {
      await connectToDatabase();
      dbConnected = mongoose.connection.readyState === 1;
    } catch (error) {
      connectionError = error.message;
    }
  }

  res.json({
    status: 'ok',
    message: 'API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    dbConnected,
    dbState: mongoose.connection.readyState,
    dbStateDescription: {
      0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting'
    }[mongoose.connection.readyState],
    envVars: {
      MONGODB_URI: process.env.MONGODB_URI ? 'SET' : 'NOT SET',
      JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? 'SET' : 'NOT SET',
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? 'SET' : 'NOT SET',
      CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'NOT SET',
    },
    connectionError
  });
});

// ============================================================
// Debug endpoint - tests the full login-like DB flow
// Hit this to diagnose if DB queries work after connection
// ============================================================
app.get('/api/debug-connection', async (req, res) => {
  const results = {
    timestamp: new Date().toISOString(),
    steps: []
  };

  // Step 1: Check current state
  results.steps.push({
    step: 'initial_state',
    readyState: mongoose.connection.readyState,
    cachedConn: !!cached.conn,
    cachedPromise: !!cached.promise
  });

  // Step 2: Try to connect
  try {
    const startConnect = Date.now();
    await connectToDatabase();
    results.steps.push({
      step: 'connect',
      success: true,
      durationMs: Date.now() - startConnect,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      dbName: mongoose.connection.name
    });
  } catch (err) {
    results.steps.push({
      step: 'connect',
      success: false,
      error: err.message,
      readyState: mongoose.connection.readyState
    });
    return res.status(503).json(results);
  }

  // Step 3: Try a simple DB query (like login would do)
  try {
    const startQuery = Date.now();
    const userCount = await mongoose.connection.db.collection('users').countDocuments();
    results.steps.push({
      step: 'query_test',
      success: true,
      durationMs: Date.now() - startQuery,
      userCount
    });
  } catch (err) {
    results.steps.push({
      step: 'query_test',
      success: false,
      error: err.message
    });
  }

  // Step 4: Try loading User model (like auth routes do)
  try {
    const startModel = Date.now();
    const User = require('../server/models/User');
    const user = await User.findOne({}).select('email name').lean().maxTimeMS(10000);
    results.steps.push({
      step: 'model_query',
      success: true,
      durationMs: Date.now() - startModel,
      foundUser: !!user,
      userEmail: user ? user.email : null
    });
  } catch (err) {
    results.steps.push({
      step: 'model_query',
      success: false,
      error: err.message
    });
  }

  results.overall = results.steps.every(s => s.success !== false) ? 'ALL_PASSED' : 'SOME_FAILED';
  res.json(results);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Healthcare AI Platform API',
    status: 'running',
    version: '1.0.0'
  });
});

// ============================================================
// Load and mount routes
// ============================================================
const routeConfigs = [
  { path: '/api/auth', module: '../server/routes/authRoutes' },
  { path: '/api/health', module: '../server/routes/healthRoutes' },
  { path: '/api/nutrition', module: '../server/routes/nutritionRoutes' },
  { path: '/api/diet-recommendations', module: '../server/routes/dietRecommendationRoutes' },
  { path: '/api/metrics', module: '../server/routes/metricRoutes' },
  { path: '/api/doctors', module: '../server/routes/doctorRoutes' },
  { path: '/api/admin', module: '../server/routes/adminRoutes' },
  { path: '/api/wearables', module: '../server/routes/wearableRoutes' },
  { path: '/api/users', module: '../server/routes/userRoutes' },
  { path: '/api/notifications', module: '../server/routes/notificationRoutes' },
  { path: '/api', module: '../server/routes/chatRoutes' },
  { path: '/api/chat', module: '../server/routes/chatHistoryRoutes' },
];

for (const route of routeConfigs) {
  try {
    app.use(route.path, require(route.module));
  } catch (e) {
    console.error(`❌ Failed to load route ${route.path}:`, e.message);
  }
}

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.originalUrl,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.message, err.stack);

  let statusCode = 500;
  let errorMessage = 'Internal server error';

  if (err.name === 'MongooseError' || err.name === 'MongoError' || err.name === 'MongoServerError') {
    statusCode = 503;
    errorMessage = 'Database error. Please try again.';
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    errorMessage = 'Validation error';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    errorMessage = 'Invalid ID format';
  }

  res.status(statusCode).json({
    message: errorMessage,
    error: err.message,
    timestamp: new Date().toISOString()
  });
});

// Serverless handler
module.exports = (req, res) => {
  try {
    return app(req, res);
  } catch (error) {
    console.error('Serverless handler error:', error.message, error.stack);
    res.status(500).json({
      message: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
};
