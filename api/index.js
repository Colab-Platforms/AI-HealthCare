const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../server/.env') });

// Set Vercel flag
process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

const app = express();

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database connection
let dbConnected = false;
const connectDB = require('../server/config/db');

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

// Initialize DB
initDB();

// Health check
app.get('/api/health-check', (req, res) => {
  res.json({ status: 'ok', message: 'FitCure API', dbConnected, timestamp: new Date().toISOString() });
});

// Load routes
try {
  app.use('/api/auth', require('../server/routes/authRoutes'));
  app.use('/api/health', require('../server/routes/healthRoutes'));
  app.use('/api/doctors', require('../server/routes/doctorRoutes'));
  app.use('/api/admin', require('../server/routes/adminRoutes'));
  app.use('/api/wearables', require('../server/routes/wearableRoutes'));
  app.use('/api/nutrition', require('../server/routes/nutritionRoutes'));
  app.use('/api/diet-recommendations', require('../server/routes/dietRecommendationRoutes'));
  app.use('/api', require('../server/routes/chatRoutes'));
  app.use('/api/chat', require('../server/routes/chatHistoryRoutes'));
  console.log('✅ All routes loaded');
} catch (error) {
  console.error('❌ Route loading error:', error.message);
}

// Error handlers
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ message: err.message || 'Server error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Export for Vercel
module.exports = app;
