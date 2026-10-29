const mongoose = require('mongoose');

// One document per platform — the admin-set version-gate the app reads on
// every launch (via POST /app-version/report's response) to decide whether
// to show a soft "update available" nudge or a hard force-update block.
// These only move when an admin explicitly pushes a new release — never
// auto-advanced by a device merely running a newer build, since that alone
// doesn't mean the build is safe to force everyone onto (a staged rollout
// may still be validating).
const appVersionConfigSchema = new mongoose.Schema({
  platform: { type: String, enum: ['android', 'ios'], required: true, unique: true },
  version: { type: String, required: true },                   // "2.5.0" — display text only
  minBuild: { type: Number, required: true, default: 1 },      // below this, app should hard-block
  latestBuild: { type: Number, required: true, default: 1 },   // latestBuild >= minBuild, always
  message: { type: String, default: 'A new version of Take Health is available. Please update the app.' },
  storeUrl: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('AppVersionConfig', appVersionConfigSchema);
