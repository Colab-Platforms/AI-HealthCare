const mongoose = require('mongoose');

// One document per platform — the single source of truth for both:
//  1. version/buildNumber: what's the latest build we've seen a real device
//     actually report (organic detection, used for the push-notification
//     broadcast in appUpdateNotificationService.js).
//  2. minBuild/latestBuild/message/storeUrl: the explicit, admin-set gate the
//     app itself reads on every launch (via POST /app-version/report's
//     response) to decide whether to show a soft "update available" nudge or
//     a hard force-update block. This half is deliberately NOT
//     auto-advanced by device reports — minBuild/latestBuild only move when
//     someone with release knowledge says so (a device merely running a
//     newer build doesn't mean that build is safe to force everyone onto;
//     the dev may still be validating a staged rollout).
const appVersionConfigSchema = new mongoose.Schema({
  platform: { type: String, enum: ['android', 'ios'], required: true, unique: true },
  version: { type: String, required: true },       // "2.5.0" — display/notification text only
  buildNumber: { type: Number, required: true },    // 42 — latest build organically seen in the wild

  // Version-gate fields the app reads on every launch:
  minBuild: { type: Number, required: true, default: 1 },      // below this, app should hard-block
  latestBuild: { type: Number, required: true, default: 1 },   // latestBuild >= minBuild, always
  message: { type: String, default: 'A new version of Take Health is available. Please update the app.' },
  storeUrl: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('AppVersionConfig', appVersionConfigSchema);
