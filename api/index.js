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
let cachedConnection = null;

const connectToDatabase = async () => {
  // If already connected, return immediately
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log('♻️ Reusing existing MongoDB connection');
    return cachedConnection;
  }

  // If connection is in progress, wait for it
  if (mongoose.connection.readyState === 2) {
    console.log('⏳ MongoDB connection in progress, waiting...');
    await new Promise((resolve) => {
      const check = setInterval(() => {
        if (mongoose.connection.readyState !== 2) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      // Safety timeout for waiting
      setTimeout(() => {
        clearInterval(check);
        resolve();
      }, 10000);
    });

    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }
  }

  // ONLY disconnect if state is definitely broken (not 0, 1, or 2)
  if (mongoose.connection.readyState !== 0 && mongoose.connection.readyState !== 1 && mongoose.connection.readyState !== 2) {
    try {
      console.log('🧹 Cleaning up broken connection state:', mongoose.connection.readyState);
      await mongoose.disconnect();
    } catch (e) {
      console.log('Disconnect cleanup error:', e.message);
    }
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set. Configure it in Vercel Environment Variables.');
  }

  console.log('🔄 Connecting to MongoDB...');

  const options = {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 30000,
    // CRITICAL: Increase buffer timeout to prevent "buffering timed out" errors
    bufferTimeoutMS: 30000,
    retryWrites: true,
    w: 'majority',
    maxPoolSize: 5,  // Reduced for serverless
    minPoolSize: 0,  // 0 for serverless to allow cold starts
    maxIdleTimeMS: 10000, // Close idle connections quickly in serverless
  };

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, options);
    cachedConnection = conn;
    console.log('✅ MongoDB Connected:', conn.connection.host);
    return conn;
  } catch (error) {
    cachedConnection = null;
    console.error('❌ MongoDB Connection Error:', error.message);
    throw error;
  }
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
  if (req.path === '/health-check') {
    return next();
  }

  try {
    await connectToDatabase();
    next();
  } catch (error) {
    console.error('DB middleware connection failed:', error.message);
    return res.status(503).json({
      message: 'Database connection failed. Please try again.',
      error: 'Service temporarily unavailable'
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
    envVars: {
      MONGODB_URI: !!process.env.MONGODB_URI,
      JWT_SECRET: !!process.env.JWT_SECRET,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
      CLOUDINARY_CLOUD_NAME: !!process.env.CLOUDINARY_CLOUD_NAME
    }
  });
});

// Load and mount routes
console.log('Mounting routes...');

try {
  const authRoutes = require('../server/routes/authRoutes');
  app.use('/api/auth', authRoutes);
  console.log('✓ Auth routes mounted');
} catch (e) {
  console.error('✗ Auth routes error:', e.message);
}

try {
  const healthRoutes = require('../server/routes/healthRoutes');
  app.use('/api/health', healthRoutes);
  console.log('✓ Health routes mounted');
} catch (e) {
  console.error('✗ Health routes error:', e.message);
}

try {
  const nutritionRoutes = require('../server/routes/nutritionRoutes');
  app.use('/api/nutrition', nutritionRoutes);
  console.log('✓ Nutrition routes mounted');
} catch (e) {
  console.error('✗ Nutrition routes error:', e.message);
}

try {
  const dietRecommendationRoutes = require('../server/routes/dietRecommendationRoutes');
  app.use('/api/diet-recommendations', dietRecommendationRoutes);
  console.log('✓ Diet recommendation routes mounted');
} catch (e) {
  console.error('✗ Diet recommendation routes error:', e.message);
}

try {
  const metricRoutes = require('../server/routes/metricRoutes');
  app.use('/api/metrics', metricRoutes);
  console.log('✓ Metric routes mounted');
} catch (e) {
  console.error('✗ Metric routes error:', e.message);
}

try {
  const doctorRoutes = require('../server/routes/doctorRoutes');
  app.use('/api/doctors', doctorRoutes);
  console.log('✓ Doctor routes mounted');
} catch (e) {
  console.error('✗ Doctor routes error:', e.message);
}

try {
  const adminRoutes = require('../server/routes/adminRoutes');
  app.use('/api/admin', adminRoutes);
  console.log('✓ Admin routes mounted');
} catch (e) {
  console.error('✗ Admin routes error:', e.message);
}

try {
  const wearableRoutes = require('../server/routes/wearableRoutes');
  app.use('/api/wearables', wearableRoutes);
  console.log('✓ Wearable routes mounted');
} catch (e) {
  console.error('✗ Wearable routes error:', e.message);
}

try {
  const userRoutes = require('../server/routes/userRoutes');
  app.use('/api/users', userRoutes);
  console.log('✓ User routes mounted');
} catch (e) {
  console.error('✗ User routes error:', e.message);
}

try {
  const notificationRoutes = require('../server/routes/notificationRoutes');
  app.use('/api/notifications', notificationRoutes);
  console.log('✓ Notification routes mounted');
} catch (e) {
  console.error('✗ Notification routes error:', e.message);
}

try {
  const chatRoutes = require('../server/routes/chatRoutes');
  app.use('/api', chatRoutes);
  console.log('✓ Chat routes mounted');
} catch (e) {
  console.error('✗ Chat routes error:', e.message);
}

try {
  const chatHistoryRoutes = require('../server/routes/chatHistoryRoutes');
  app.use('/api/chat', chatHistoryRoutes);
  console.log('✓ Chat history routes mounted');
} catch (e) {
  console.error('✗ Chat history routes error:', e.message);
}

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.originalUrl
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.message);
  console.error('Stack:', err.stack);
  res.status(500).json({
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Serverless handler - simplified since DB connection is handled by middleware
const handler = async (req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  return app(req, res);
};

module.exports = handler;
module.exports.default = handler;
