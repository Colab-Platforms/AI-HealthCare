// Vercel serverless function handler
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables from .env file (for local dev)
const envPath = path.join(__dirname, '../server/.env');
dotenv.config({ path: envPath });

// Set Vercel environment
process.env.VERCEL = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// ============================================================
// GLOBAL MongoDB connection - shared across all serverless calls
// ============================================================
let cachedConnection = null;

const connectToDatabase = async () => {
  // If already connected, return immediately
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set. Configure it in Vercel Environment Variables.');
  }

  // Use cached promise to avoid multiple simultaneous connections
  if (cachedConnection && mongoose.connection.readyState === 2) {
    // State 2 = connecting, wait for it
    await cachedConnection;
    return cachedConnection;
  }

  console.log('🔄 Connecting to MongoDB...');

  const options = {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 30000,
    connectTimeoutMS: 15000,
    retryWrites: true,
    w: 'majority',
    maxPoolSize: 3,
    minPoolSize: 0,
    maxIdleTimeMS: 10000,
    family: 4, // Force IPv4
    bufferCommands: true,
    autoIndex: false, // Don't build indexes on serverless
  };

  try {
    cachedConnection = await mongoose.connect(process.env.MONGODB_URI, options);
    console.log('✅ MongoDB Connected:', mongoose.connection.host);
    return cachedConnection;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    cachedConnection = null;
    throw error;
  }
};

// ============================================================
// PRE-WARM: Start connecting to DB at module load time (cold start)
// This runs during cold start BEFORE any request arrives
// ============================================================
const dbWarmupPromise = process.env.MONGODB_URI
  ? connectToDatabase().catch(err => {
    console.error('Pre-warm DB connection failed:', err.message);
    return null;
  })
  : Promise.resolve(null);

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
// Database connection middleware - ensures DB is ready before routes
// Uses the pre-warmed connection from cold start
// ============================================================
app.use('/api', async (req, res, next) => {
  // Skip DB connection for health check
  if (req.path === '/health-check' || req.originalUrl === '/api/health-check') {
    return next();
  }

  try {
    // If already connected, proceed immediately
    if (mongoose.connection.readyState === 1) {
      return next();
    }

    // Wait for the pre-warm connection first
    await dbWarmupPromise;

    // If still not connected after warmup, try one more time
    if (mongoose.connection.readyState !== 1) {
      console.log(`[DB Middleware] ${req.method} ${req.path} - Connecting...`);
      await connectToDatabase();
    }

    return next();
  } catch (error) {
    console.error(`[DB Middleware] ${req.method} ${req.path} - Failed:`, error.message);
    return res.status(503).json({
      message: 'Database connection failed. Please try again.',
      error: 'Service temporarily unavailable',
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint (no auth or DB required)
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

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Healthcare AI Platform API',
    status: 'running',
    version: '1.0.0'
  });
});

// ============================================================
// Load and mount routes - using lazy loading pattern
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

// Error handler - must be last
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.message);

  let statusCode = 500;
  let errorMessage = 'Internal server error';

  if (err.name === 'MongooseError' || err.name === 'MongoError') {
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
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    timestamp: new Date().toISOString()
  });
});

// Serverless handler
const handler = async (req, res) => {
  try {
    return app(req, res);
  } catch (error) {
    console.error('Serverless handler error:', error.message);
    res.status(500).json({
      message: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = handler;
module.exports.default = handler;
