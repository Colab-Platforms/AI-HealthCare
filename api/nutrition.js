// Vercel serverless function for nutrition routes
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../server/.env') });
process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

const express = require('express');
const cors = require('cors');
const connectDB = require('../server/config/db');
const nutritionRoutes = require('../server/routes/nutritionRoutes');

const app = express();

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize database
let dbInitialized = false;
const initDB = async () => {
  if (dbInitialized) return;
  try {
    await connectDB();
    dbInitialized = true;
    console.log('✅ DB connected for nutrition');
  } catch (error) {
    console.error('❌ DB error:', error.message);
  }
};

// DB middleware
app.use((req, res, next) => {
  if (!dbInitialized) {
    initDB().then(() => next()).catch(() => next());
  } else {
    next();
  }
});

// Mount nutrition routes
app.use('/api/nutrition', nutritionRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ message: err.message });
});

module.exports = app;
