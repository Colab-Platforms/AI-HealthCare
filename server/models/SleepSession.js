const mongoose = require('mongoose');

// Replaces WearableData.sleepData[]. One doc per user+deviceType+night.
const sleepSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  deviceType: { type: String, required: true },
  date: { type: Date, required: true },
  totalSleepMinutes: Number,
  deepSleepMinutes: Number,
  lightSleepMinutes: Number,
  remSleepMinutes: Number,
  awakeMinutes: Number,
  sleepScore: { type: Number, min: 0, max: 100 },
  bedTime: Date,
  wakeTime: Date,
  source: String,
  sourceRecordId: String
}, { timestamps: true });

sleepSessionSchema.index({ user: 1, deviceType: 1, date: 1 }, { unique: true });
sleepSessionSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('SleepSession', sleepSessionSchema);
