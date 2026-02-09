// Vercel serverless function entry point
process.env.VERCEL = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../server/.env') });

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize database connection
let dbInitialized = false;
const initDB = async () => {
  if (dbInitialized) return;

  try {
    const connectDB = require('../server/config/db');
    await connectDB();
    dbInitialized = true;
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
  }
};

// Initialize DB on first request
app.use((req, res, next) => {
  if (!dbInitialized) {
    initDB().then(() => next()).catch(() => next());
  } else {
    next();
  }
});

// Health check
app.get('/api/health-check', (req, res) => {
  res.json({
    status: 'ok',
    message: 'FitCure API - Vercel',
    env: process.env.NODE_ENV,
    dbConnected: dbInitialized,
    timestamp: new Date().toISOString()
  });
});

// Load routes
try {
  const authRoutes = require('../server/routes/authRoutes');
  const healthRoutes = require('../server/routes/healthRoutes');
  const doctorRoutes = require('../server/routes/doctorRoutes');
  const adminRoutes = require('../server/routes/adminRoutes');
  const wearableRoutes = require('../server/routes/wearableRoutes');
  const nutritionRoutes = require('../server/routes/nutritionRoutes');
  const dietRecommendationRoutes = require('../server/routes/dietRecommendationRoutes');
  const chatRoutes = require('../server/routes/chatRoutes');
  const chatHistoryRoutes = require('../server/routes/chatHistoryRoutes');

  app.use('/api/auth', authRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/api/doctors', doctorRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/wearables', wearableRoutes);
  app.use('/api/nutrition', nutritionRoutes);
  app.use('/api/diet-recommendations', dietRecommendationRoutes);
  app.use('/api', chatRoutes);
  app.use('/api/chat', chatHistoryRoutes);

  console.log('✅ All routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading routes:', error.message);
  console.error(error.stack);
}

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    message: err.message || 'Something went wrong!',
    path: req.path
  });
});

// 404 handler
app.use((req, res) => {
  console.log('404 - Route not found:', req.method, req.path);
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.path,
    message: 'The requested endpoint does not exist'
  });
});

// Export for Vercel
module.exports = app;
