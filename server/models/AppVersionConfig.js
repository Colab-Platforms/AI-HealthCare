const mongoose = require('mongoose');

// One document per platform — the single source of truth for "what's the
// latest build we've seen reported." buildNumber (not the display version
// string) is the authoritative comparison key: both Apple and Google require
// it to strictly increase with every single store submission, so a plain
// integer comparison is always correct — no semver string parsing needed.
const appVersionConfigSchema = new mongoose.Schema({
  platform: { type: String, enum: ['android', 'ios'], required: true, unique: true },
  version: { type: String, required: true },       // "2.5.0" — display/notification text only
  buildNumber: { type: Number, required: true },    // 42 — comparison happens on this
}, { timestamps: true });

module.exports = mongoose.model('AppVersionConfig', appVersionConfigSchema);
