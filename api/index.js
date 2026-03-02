// Vercel serverless function handler
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables from .env file (for local dev)
// On Vercel, env vars are set in the dashboard, so this is a fallback
const envPath = path.join(__dirname, '../server/.env');
dotenv.config({ path: envPath });

// Verify critical env vars
if (!process.env.MONGODB_URI) {
  console.error('CRITICAL ERROR: MONGODB_URI not set in environment!');
  console.error('Make sure MONGODB_URI is set in Vercel Environment Variables dashboard');
}
if (!process.env.JWT_SECRET) {
  console.error('CRITICAL ERROR: JWT_SECRET not set in environment!');
}

// Set Vercel environment
process.env.VERCEL = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

console.log('Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  VERCEL: process.env.VERCEL,
  MONGODB_URI: process.env.MONGODB_URI ? `SET (${process.env.MONGODB_URI.substring(0, 20)}...)` : 'NOT SET',
  JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? 'SET' : 'NOT SET',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? 'SET' : 'NOT SET',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'NOT SET'
});

// ============================================================
// GLOBAL MongoDB connection - shared across all serverless calls
// ============================================================
let connectionPromise = null;

const connectToDatabase = async () => {
  // If already connected, return immediately
  if (mongoose.connection.readyState === 1) {
    console.log('♻️ Reusing existing MongoDB connection');
    return mongoose.connection;
  }

  // If connection is in progress, wait for it
  if (connectionPromise) {
    console.log('⏳ MongoDB connection in progress, waiting for existing promise...');
    try {
      return await connectionPromise;
    } catch (e) {
      console.error('Existing connection promise failed:', e.message);
      connectionPromise = null;
    }
  }

  if (!process.env.MONGODB_URI) {
    const error = 'MONGODB_URI is not set. Configure it in Vercel Environment Variables.';
    console.error('❌ CRITICAL:', error);
    throw new Error(error);
  }

  console.log('🔄 Connecting to MongoDB...');
  console.log('MongoDB URI:', process.env.MONGODB_URI.substring(0, 30) + '...');

  const options = {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 30000,
    bufferTimeoutMS: 30000,
    retryWrites: true,
    w: 'majority',
    maxPoolSize: 5,
    minPoolSize: 0,
    maxIdleTimeMS: 10000,
  };

  // Create connection promise to avoid multiple simultaneous connections
  connectionPromise = (async () => {
    let attempts = 0;
    const maxAttempts = 5; // Increased from 3 to 5 for Vercel

    while (attempts < maxAttempts) {
      try {
        attempts++;
        console.log(`🔄 Connection attempt ${attempts}/${maxAttempts}`);
        console.log('MongoDB URI format check:', process.env.MONGODB_URI ? `Valid (${process.env.MONGODB_URI.substring(0, 30)}...)` : 'MISSING');
        
        const conn = await mongoose.connect(process.env.MONGODB_URI, options);
        
        console.log('✅ MongoDB Connected:', conn.connection.host);
        console.log('Connection state:', mongoose.connection.readyState);
        connectionPromise = null; // Clear promise on success
        return conn;
      } catch (error) {
        console.error(`❌ Connection attempt ${attempts} failed:`, error.message);
        console.error('Error code:', error.code);
        console.error('Error name:', error.name);
        console.error('Full error:', error);
        
        if (attempts < maxAttempts) {
          const delay = 2000 * attempts; // Increased delay: 2s, 4s, 6s, 8s, 10s
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('❌ All connection attempts failed after', maxAttempts, 'tries');
          connectionPromise = null; // Clear promise on failure
          throw error;
        }
      }
    }
  })();

  return connectionPromise;
};

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
// CRITICAL: Database connection middleware - runs BEFORE all routes
// This ensures DB is connected before any route handler tries to query
// ============================================================
app.use('/api', async (req, res, next) => {
  // Skip DB connection for health check
  if (req.path === '/health-check' || req.originalUrl === '/api/health-check') {
    return next();
  }

  try {
    // If already connected, skip connection attempt
    if (mongoose.connection.readyState === 1) {
      console.log(`[DB Middleware] ${req.method} ${req.path} - Using existing connection`);
      return next();
    }

    console.log(`[DB Middleware] ${req.method} ${req.path} - Connecting to database...`);
    console.log('[DB Middleware] Current connection state:', mongoose.connection.readyState);
    
    await connectToDatabase();
    
    console.log(`[DB Middleware] ${req.method} ${req.path} - Database connected, proceeding to route`);
    console.log('[DB Middleware] Connection state after connect:', mongoose.connection.readyState);
    next();
  } catch (error) {
    console.error(`[DB Middleware] ${req.method} ${req.path} - Connection failed:`, error.message);
    console.error('[DB Middleware] Error details:', {
      code: error.code,
      name: error.name,
      mongooseState: mongoose.connection.readyState,
      fullError: error.toString()
    });
    
    // Return 503 Service Unavailable for database connection errors
    return res.status(503).json({
      message: 'Database connection failed. Please try again.',
      error: 'Service temporarily unavailable',
      details: process.env.NODE_ENV === 'development' ? {
        errorMessage: error.message,
        errorCode: error.code,
        errorName: error.name
      } : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint (no auth or DB required)
app.get('/api/health-check', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    dbConnected: mongoose.connection.readyState === 1,
    dbState: mongoose.connection.readyState,
    dbStateDescription: {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    }[mongoose.connection.readyState],
    envVars: {
      MONGODB_URI: !!process.env.MONGODB_URI,
      JWT_SECRET: !!process.env.JWT_SECRET,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
      CLOUDINARY_CLOUD_NAME: !!process.env.CLOUDINARY_CLOUD_NAME
    }
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

// Load and mount routes
console.log('🚀 Mounting routes...');

try {
  console.log('📍 Loading auth routes...');
  const authRoutes = require('../server/routes/authRoutes');
  app.use('/api/auth', authRoutes);
  console.log('✅ Auth routes mounted successfully');
} catch (e) {
  console.error('❌ Auth routes error:', e.message, e.stack);
}

try {
  console.log('📍 Loading health routes...');
  const healthRoutes = require('../server/routes/healthRoutes');
  app.use('/api/health', healthRoutes);
  console.log('✅ Health routes mounted successfully');
} catch (e) {
  console.error('❌ Health routes error:', e.message, e.stack);
}

try {
  console.log('📍 Loading nutrition routes...');
  const nutritionRoutes = require('../server/routes/nutritionRoutes');
  app.use('/api/nutrition', nutritionRoutes);
  console.log('✅ Nutrition routes mounted successfully');
} catch (e) {
  console.error('❌ Nutrition routes error:', e.message, e.stack);
}

try {
  console.log('📍 Loading diet recommendation routes...');
  const dietRecommendationRoutes = require('../server/routes/dietRecommendationRoutes');
  app.use('/api/diet-recommendations', dietRecommendationRoutes);
  console.log('✅ Diet recommendation routes mounted successfully');
} catch (e) {
  console.error('❌ Diet recommendation routes error:', e.message, e.stack);
}

try {
  console.log('📍 Loading metric routes...');
  const metricRoutes = require('../server/routes/metricRoutes');
  app.use('/api/metrics', metricRoutes);
  console.log('✅ Metric routes mounted successfully');
} catch (e) {
  console.error('❌ Metric routes error:', e.message, e.stack);
}

try {
  console.log('📍 Loading doctor routes...');
  const doctorRoutes = require('../server/routes/doctorRoutes');
  app.use('/api/doctors', doctorRoutes);
  console.log('✅ Doctor routes mounted successfully');
} catch (e) {
  console.error('❌ Doctor routes error:', e.message, e.stack);
}

try {
  console.log('📍 Loading admin routes...');
  const adminRoutes = require('../server/routes/adminRoutes');
  app.use('/api/admin', adminRoutes);
  console.log('✅ Admin routes mounted successfully');
} catch (e) {
  console.error('❌ Admin routes error:', e.message, e.stack);
}

try {
  console.log('📍 Loading wearable routes...');
  const wearableRoutes = require('../server/routes/wearableRoutes');
  app.use('/api/wearables', wearableRoutes);
  console.log('✅ Wearable routes mounted successfully');
} catch (e) {
  console.error('❌ Wearable routes error:', e.message, e.stack);
}

try {
  console.log('📍 Loading user routes...');
  const userRoutes = require('../server/routes/userRoutes');
  app.use('/api/users', userRoutes);
  console.log('✅ User routes mounted successfully');
} catch (e) {
  console.error('❌ User routes error:', e.message, e.stack);
}

try {
  console.log('📍 Loading notification routes...');
  const notificationRoutes = require('../server/routes/notificationRoutes');
  app.use('/api/notifications', notificationRoutes);
  console.log('✅ Notification routes mounted successfully');
} catch (e) {
  console.error('❌ Notification routes error:', e.message, e.stack);
}

try {
  console.log('📍 Loading chat routes...');
  const chatRoutes = require('../server/routes/chatRoutes');
  app.use('/api', chatRoutes);
  console.log('✅ Chat routes mounted successfully');
} catch (e) {
  console.error('❌ Chat routes error:', e.message, e.stack);
}

try {
  console.log('📍 Loading chat history routes...');
  const chatHistoryRoutes = require('../server/routes/chatHistoryRoutes');
  app.use('/api/chat', chatHistoryRoutes);
  console.log('✅ Chat history routes mounted successfully');
} catch (e) {
  console.error('❌ Chat history routes error:', e.message, e.stack);
}

console.log('🎉 All routes mounted. Ready to handle requests.');

// 404 handler
app.use('/api/*', (req, res) => {
  console.log('❌ 404 - Route not found:', {
    method: req.method,
    path: req.originalUrl,
    url: req.url,
    baseUrl: req.baseUrl,
    dbConnected: mongoose.connection.readyState === 1
  });
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.originalUrl,
    dbConnected: mongoose.connection.readyState === 1,
    availableRoutes: [
      '/api/auth',
      '/api/health',
      '/api/nutrition',
      '/api/diet-recommendations',
      '/api/metrics',
      '/api/doctors',
      '/api/admin',
      '/api/wearables',
      '/api/users',
      '/api/notifications',
      '/api/chat',
      '/api/health-check'
    ]
  });
});

// Error handler - must be last
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', {
    message: err.message,
    code: err.code,
    name: err.name,
    stack: err.stack
  });
  
  // Determine appropriate status code
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

// Serverless handler - Express app handles all routing
const handler = async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    return app(req, res);
  } catch (error) {
    console.error('Serverless handler error:', error.message);
    res.status(500).json({
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = handler;
module.exports.default = handler;
