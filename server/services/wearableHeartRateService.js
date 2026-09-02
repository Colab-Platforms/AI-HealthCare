const WearableData = require('../models/WearableData');

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

  const devices = await WearableData.find({ user: userId })
    .select('heartRate')
    .lean();

  const samples = [];
  for (const device of devices) {
    for (const sample of device.heartRate || []) {
      const ts = new Date(sample.timestamp);
      if (ts >= startDate && ts <= endDate) {
        samples.push({ timestamp: ts, bpm: sample.bpm, type: sample.type });
      }
    }
  }

  samples.sort((a, b) => a.timestamp - b.timestamp);
  return samples;
}

module.exports = { getHeartRateSamplesInRange };
