const mongoose = require('mongoose');

// One document per platform — the admin-set version the app reads on every
// launch (via POST /app-version/report's response) to decide whether to show
// a dismissible "update available" nudge. Only moves when an admin
// explicitly pushes a new release via the admin screen.
const appVersionConfigSchema = new mongoose.Schema({
  platform: { type: String, enum: ['android', 'ios'], required: true, unique: true },
  version: { type: String, required: true },                   // "2.5.0" — display text only
  latestBuild: { type: Number, required: true, default: 1 },   // below this, app shows the update nudge
  message: { type: String, default: 'A new version of Take Health is available. Please update the app.' },
  storeUrl: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('AppVersionConfig', appVersionConfigSchema);
