require('dotenv').config();
const mongoose = require('mongoose');
const HealthScoreConfig = require('../models/HealthScoreConfig');

// Usage:
//   node scripts/seedHealthScoreConfig.js               → create v1 only if no active config exists
//   node scripts/seedHealthScoreConfig.js --new-version → create the next version from the CURRENT
//                                                         schema defaults and make it the active one
//
// --new-version is how a formula change in HealthScoreConfig's defaults (e.g. the
// v2 daily score: 4 equal pillars + smoking/alcohol penalties) reaches the DB.
// The old version is deactivated, not deleted — every DailyHealthScore row keeps
// the configVersion that produced it, so history stays explainable.
(async () => {
  const newVersion = process.argv.includes('--new-version');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const existing = await HealthScoreConfig.findOne({ isActive: true });
  if (existing && !newVersion) {
    console.log(`Active config already exists (version ${existing.version}). Skipping. Pass --new-version to replace it.`);
    process.exit(0);
  }

  const highestVersion = await HealthScoreConfig.findOne().sort({ version: -1 }).select('version');
  const nextVersion = (highestVersion?.version || 0) + 1;

  // Activate the new one BEFORE deactivating the old, so there is never a
  // moment with zero active configs (the engine throws without one).
  const config = await HealthScoreConfig.create({ version: nextVersion, isActive: true });
  await HealthScoreConfig.updateMany({ _id: { $ne: config._id }, isActive: true }, { isActive: false });

  console.log(`Active HealthScoreConfig is now version ${config.version}${existing ? ` (was ${existing.version})` : ''}`);
  console.log('Running servers pick it up within 60s (scoreConfig cache TTL).');
  process.exit(0);
})().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
