const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const fs = require('fs');
const path = require('path');

dotenv.config(); // Works for local dev (CWD = server/)
dotenv.config({ path: path.join(__dirname, '.env') }); // Works for Railway (CWD = repo root)

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

// Improved Database Middleware
app.use(async (req, res, next) => {
  const skipPaths = ['/api/health-check', '/api/ping', '/api/debug-connection'];
  if (skipPaths.some(p => req.path === p || req.originalUrl === p)) return next();

  try {
    if (mongoose.connection.readyState !== 1) {
      if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not defined');
      await connectDB();
    }
    next();
  } catch (error) {
    console.error('[DB Middleware] Critical Failure:', error.message);
    res.status(503).json({
      message: 'Database connection failed. Please try again in a few seconds.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Service Unavailable',
      hint: 'The server is currently establishing database links.',
      timestamp: new Date().toISOString()
    });
  }
});

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    // Allow all localhost origins for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('192.168.')) {
      return callback(null, true);
    }
    // Allow Vercel frontend domains
    if (origin.includes('.vercel.app') || origin.includes('fitcure') || origin.includes('healthcare')) {
      return callback(null, true);
    }
    // Allow any origin set in CLIENT_URL env var
    if (process.env.CLIENT_URL && origin.includes(new URL(process.env.CLIENT_URL).hostname)) {
      return callback(null, true);
    }
    // Default: allow all (for now)
    callback(null, true);
  },
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

// 🛠️ Global Request Logger (For Debugging 404s)
app.use((req, res, next) => {
  console.log(`[Incoming Request] ${req.method} ${req.path} | Host: ${req.headers.host}`);
  next();
});

// 🔍 Direct Debug Routes (Bypass all routers/auth)
app.get('/api/ping', (req, res) => res.json({ status: 'pong', domain: req.headers.host }));
// 🛡️ Admin Deep-Trace (Releasing trap into the router)
app.use('/api/admin', (req, res, next) => {
  console.log(`[Admin Trace Stage 1] Request: ${req.method} ${req.originalUrl}`);
  // If it's a diagnostic ping, just handle it here to keep it simple
  if (req.path === '/ping' || req.path === '/ping-internal') {
    return res.json({ status: 'admin-diagnostic-ok', msg: 'Trace hit the admin mount point!' });
  }
  next();
});

try {
  // 🛡️ ADMIN ROUTER
  try {
    const adminRouter = require('./routes/adminRoutes');
    app.use('/api/admin', adminRouter);
    console.log('[Server] ✅ Admin Router mounted at /api/admin');
    
    // Support Railway/Vercel fallbacks
    app.use('/admin', adminRouter); 
  } catch (adminErr) {
    console.error('[Server] ❌ CRITICAL FAIL: adminRouter loading error:', adminErr.message);
    console.error(adminErr.stack);
  }

  const routes = [
    { path: '/api/auth', module: './routes/authRoutes' },
    { path: '/api/health', module: './routes/healthRoutes' },
    { path: '/api/metrics', module: './routes/metricRoutes' },
    { path: '/api/doctors', module: './routes/doctorRoutes' },
    { path: '/api/wearables', module: './routes/wearableRoutes' },
    { path: '/api/wearable', module: './routes/wearableRoutes' },
    { path: '/api/nutrition', module: './routes/nutritionRoutes' },
    { path: '/api/diet-recommendations', module: './routes/dietRecommendationRoutes' },
    { path: '/api/users', module: './routes/userRoutes' },
    { path: '/api/notifications', module: './routes/notificationRoutes' },
    { path: '/api/chat', module: './routes/chatHistoryRoutes' },
    { path: '/api/translate', module: './routes/translateRoutes' },
    { path: '/api/food-safety', module: './routes/foodSafetyRoutes' },
    { path: '/api/documents', module: './routes/documentRoutes' },
    { path: '/api', module: './routes/chatRoutes' } // 🔚 Generic catch-all goes last
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
  console.error('[Server Error Handler]:', err.message);
  res.status(err.status || 500).json({
    message: err.message || 'Something went wrong!',
    path: req.originalUrl,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 🕵️ 404 FALLBACK TRAP
app.use((req, res) => {
  console.warn(`[404 NOT FOUND] ${req.method} ${req.originalUrl} | Host: ${req.headers.host} | UserAgent: ${req.headers['user-agent']}`);
  res.status(404).json({
    message: "Route not found in FitCure API",
    requestedPath: req.originalUrl,
    hint: "Check if the path starts with /api"
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
  
  // Set up Daily Food Safety Sync Cron (Runs at midnight daily)
  const cron = require('node-cron');
  const { syncFoodSafetyDatabase } = require('./services/foodSafetyService');
  cron.schedule('0 0 * * *', async () => {
    console.log('⏰ Running scheduled Food Safety Sync...');
    await syncFoodSafetyDatabase();
  });
  
  // Optional: Run on startup to ensure fresh data
  // syncFoodSafetyDatabase();
}

// Export app for Vercel or start local server
if (process.env.VERCEL) {
  module.exports = app;
} else {
  const PORT = process.env.PORT || 5001;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    if (process.env.RAILWAY_ENVIRONMENT_ID) {
      console.log(`🚂 Railway deployment detected: ${process.env.RAILWAY_PUBLIC_DOMAIN || 'Ready'}`);
    }
    if (process.env.RENDER) {
      console.log(`🚀 Render deployment detected: ${process.env.RENDER_EXTERNAL_URL || 'Ready'}`);
    }
  });
}
