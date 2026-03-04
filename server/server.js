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
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? 'SET' : 'NOT SET',
      CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'NOT SET',
    },
    connectionError
  });
});

try {
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/health', require('./routes/healthRoutes'));
  app.use('/api/metrics', require('./routes/metricRoutes'));
  app.use('/api/doctors', require('./routes/doctorRoutes'));
  app.use('/api/admin', require('./routes/adminRoutes'));
  app.use('/api/wearables', require('./routes/wearableRoutes'));
  app.use('/api/nutrition', require('./routes/nutritionRoutes'));
  app.use('/api/diet-recommendations', require('./routes/dietRecommendationRoutes'));
  app.use('/api/users', require('./routes/userRoutes'));
  app.use('/api/notifications', require('./routes/notificationRoutes'));
  app.use('/api', require('./routes/chatRoutes'));
  app.use('/api/chat', require('./routes/chatHistoryRoutes'));
} catch (error) {
  console.error('Error loading routes:', error);
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
