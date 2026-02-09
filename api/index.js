const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../server/.env') });

// Set environment flags
process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

const app = express();

// Middleware
app.use(cors({ 
  origin: process.env.CLIENT_URL || '*',
  credentials: true 
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database connection
const connectDB = require('../server/config/db');
let dbConnected = false;

const initDB = async () => {
  if (dbConnected) return;
  try {
    await connectDB();
    dbConnected = true;
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database error:', error.message);
  }
};

// Initialize DB immediately
initDB();

// Health check
app.get('/api/health-check', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'FitCure API',
    dbConnected,
    timestamp: new Date().toISOString()
  });
});

// Load all routes
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
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

// Export for Vercel serverless
module.exports = app;
