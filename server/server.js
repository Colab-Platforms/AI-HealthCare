const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const fs = require('fs');
const path = require('path');

dotenv.config();

// Create uploads dir (skip on Vercel - uses memory/cloudinary)
if (!process.env.VERCEL) {
  const uploadsDir = path.join(__dirname, 'uploads');
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (error) {
    console.error('Error creating uploads directory:', error);
  }
}

const app = express();

// Ensure database connection for every request
app.use(async (req, res, next) => {
  // Skip DB for health check
  if (req.path === '/api/health-check' || req.originalUrl === '/api/health-check') {
    return next();
  }
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('[DB Middleware] Connection failed:', error.message);
    res.status(503).json({
      message: 'Database connection failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Service temporarily unavailable',
      timestamp: new Date().toISOString()
    });
  }
});

app.use(cors({
  origin: process.env.VERCEL ? '*' : (process.env.CLIENT_URL || '*'),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

if (!process.env.VERCEL) {
  const uploadsDir = path.join(__dirname, 'uploads');
  app.use('/uploads', express.static(uploadsDir));
}

// Debug endpoint for diagnostic purposes
app.get('/api/debug-connection', async (req, res) => {
  const results = {
    timestamp: new Date().toISOString(),
    steps: []
  };

  try {
    const startConnect = Date.now();
    await connectDB();
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
      error: err.message
    });
    return res.status(503).json(results);
  }

  // Raw DB query
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

  // Mongoose Model query (This failed previously)
  try {
    const startModel = Date.now();
    const User = require('./models/User');
    const user = await User.findOne({}).select('email name').lean().maxTimeMS(10000);
    results.steps.push({
      step: 'model_query',
      success: true,
      durationMs: Date.now() - startModel,
      foundUser: !!user
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

// Health check endpoint
app.get('/api/health-check', async (req, res) => {
  let dbConnected = mongoose.connection.readyState === 1;
  let connectionError = null;

  if (!dbConnected) {
    try {
      await connectDB();
      dbConnected = mongoose.connection.readyState === 1;
    } catch (error) {
      connectionError = error.message;
    }
  }

  res.json({
    status: 'ok',
    message: 'FitCure API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    dbConnected,
    dbState: mongoose.connection.readyState,
    envVars: {
      MONGODB_URI: process.env.MONGODB_URI ? 'SET' : 'NOT SET',
      JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? 'SET' : 'NOT SET',
      CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'NOT SET',
    },
    connectionError
  });
});

try {
  const routes = [
    { path: '/api/auth', module: './routes/authRoutes' },
    { path: '/api/health', module: './routes/healthRoutes' },
    { path: '/api/metrics', module: './routes/metricRoutes' },
    { path: '/api/doctors', module: './routes/doctorRoutes' },
    { path: '/api/admin', module: './routes/adminRoutes' },
    { path: '/api/wearables', module: './routes/wearableRoutes' },
    { path: '/api/nutrition', module: './routes/nutritionRoutes' },
    { path: '/api/diet-recommendations', module: './routes/dietRecommendationRoutes' },
    { path: '/api/users', module: './routes/userRoutes' },
    { path: '/api/notifications', module: './routes/notificationRoutes' },
    { path: '/api', module: './routes/chatRoutes' },
    { path: '/api/chat', module: './routes/chatHistoryRoutes' },
    { path: '/api/translate', module: './routes/translateRoutes' }
  ];

  routes.forEach(route => {
    try {
      const router = require(route.module);
      app.use(route.path, router);
      console.log(`[Server] Mounted: ${route.path}`);

      // Support direct access on Vercel (fallback if /api is stripped)
      if (process.env.VERCEL && route.path.startsWith('/api/')) {
        const fallbackPath = route.path.replace('/api', '');
        if (fallbackPath && fallbackPath !== '/') {
          app.use(fallbackPath, router);
          console.log(`[Server] Mounted Vercel fallback: ${fallbackPath}`);
        }
      }
    } catch (err) {
      console.error(`Error loading route ${route.path}:`, err.message);
    }
  });
} catch (error) {
  console.error('Critical error in route registration:', error);
}

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    message: err.message || 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Pre-warm database connection at module load
connectDB().catch(err => {
  console.error('Initial DB connection failed:', err.message);
});

// Initialize services (only if not on Vercel)
if (!process.env.VERCEL) {
  require('./services/reminderService');
  try { require('./services/notificationService'); } catch (e) { console.error('Notification service error:', e); }
}

// Export app for Vercel or start local server
if (process.env.VERCEL) {
  module.exports = app;
} else {
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}
