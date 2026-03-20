const mongoose = require('mongoose');
const { syncFoodSafetyDatabase } = require('./services/foodSafetyService');
require('dotenv').config();

async function runSync() {
  try {
    console.log('Connecting to DB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected. Running Sync...');
    const result = await syncFoodSafetyDatabase();
    console.log('Sync result:', result);
    process.exit(0);
  } catch (err) {
    console.error('Sync error:', err);
    process.exit(1);
  }
}

runSync();
