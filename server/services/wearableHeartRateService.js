const WearableData = require('../models/WearableData');
const HeartRateSample = require('../models/HeartRateSample');

/**
 * Flattens heart-rate samples from all of a user's connected wearable devices
 * that fall within [start, end], sorted ascending by timestamp.
 * @returns {Promise<Array<{timestamp: Date, bpm: number, type: string}>>}
 */
async function getHeartRateSamplesInRange(userId, start, end) {
  if (!start || !end) return [];
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return [];

  const [storedSamples, legacyDevices] = await Promise.all([
    HeartRateSample.find({
      user: userId,
      timestamp: { $gte: startDate, $lte: endDate }
    }).select('timestamp bpm type source').sort({ timestamp: 1 }).lean(),
    // Read the old embedded samples during the rollout/migration window.
    WearableData.find({ user: userId }).select('deviceType heartRate').lean()
  ]);

  const samples = storedSamples.map((sample) => ({
    timestamp: new Date(sample.timestamp),
    bpm: sample.bpm,
    type: sample.type,
    source: sample.source
  }));
  const storedKeys = new Set(samples.map((sample) => `${sample.timestamp.toISOString()}|${sample.bpm}`));
  for (const device of legacyDevices) {
    for (const sample of device.heartRate || []) {
      const ts = new Date(sample.timestamp);
      const key = `${ts.toISOString()}|${sample.bpm}`;
      if (ts >= startDate && ts <= endDate && !storedKeys.has(key)) {
        samples.push({ timestamp: ts, bpm: sample.bpm, type: sample.type, source: sample.source });
      }
    }
  }

  samples.sort((a, b) => a.timestamp - b.timestamp);
  return samples;
}

module.exports = { getHeartRateSamplesInRange };
