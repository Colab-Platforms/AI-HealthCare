require('dotenv').config();
const mongoose = require('mongoose');
const HealthScoreConfig = require('../models/HealthScoreConfig');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const existing = await HealthScoreConfig.findOne({ isActive: true });
  if (existing) {
    console.log(`Active config already exists (version ${existing.version}). Skipping.`);
    process.exit(0);
  }

  const highestVersion = await HealthScoreConfig.findOne().sort({ version: -1 }).select('version');
  const nextVersion = (highestVersion?.version || 0) + 1;

  const config = await HealthScoreConfig.create({ version: nextVersion, isActive: true });
  console.log(`Created active HealthScoreConfig version ${config.version}`);
  process.exit(0);
})().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
