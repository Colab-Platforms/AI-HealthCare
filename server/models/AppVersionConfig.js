const mongoose = require('mongoose');

// One document per platform — the admin-set version gate the app reads on
// every launch (via POST /app-version/report's response). The app compares its
// own build number against:
//   minBuild    -> below this: forced update (blocking popup)
//   latestBuild -> below this: optional "update available" popup
// Only moves when an admin saves it from the admin screen.
const appVersionConfigSchema = new mongoose.Schema({
  platform: { type: String, enum: ['android', 'ios'], required: true, unique: true },
  version: { type: String, required: true },                   // "2.5.0" — display text only
  minBuild: { type: Number, default: 1 },                      // hard update below this (1 = never forced)
  latestBuild: { type: Number, required: true, default: 1 },   // optional update below this
  message: { type: String, default: 'A new version of Take Health is available. Please update the app.' },
  storeUrl: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('AppVersionConfig', appVersionConfigSchema);
