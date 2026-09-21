const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const WearableData = require('../models/WearableData');
const BloodOxygenSample = require('../models/BloodOxygenSample');

dotenv.config();
dotenv.config({ path: path.join(__dirname, '..', '.env') });

(async () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_URI_STAGING;
  if (!mongoUri) {
    console.error('MONGODB_URI or MONGODB_URI_STAGING must be set');
    process.exit(1);
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 30000, family: 4 });
  let copied = 0;

  try {
    // BloodOxygenSample is a time-series collection — MongoDB only allows
    // multi-document updates on those, not the per-sample updateOne/upsert
    // this used to do. Instead: load each user's existing samples once, dedupe
    // in memory against the same key the old upsert matched on, and insertMany
    // just the new ones. insertMany is fully supported on time-series
    // collections and re-running this script stays safe (already-migrated
    // samples are skipped).
    const cursor = WearableData.find({ 'bloodOxygen.0': { $exists: true } })
      .select('user deviceType bloodOxygen')
      .cursor();

    const keyOf = (deviceType, entry) =>
      `${deviceType}|${entry.timestamp?.getTime()}|${entry.percentage}|${entry.sourceRecordId}`;

    for await (const wearable of cursor) {
      if (!wearable.bloodOxygen?.length) continue;

      const existing = await BloodOxygenSample.find({ user: wearable.user })
        .select('meta.deviceType timestamp percentage sourceRecordId -_id')
        .lean();
      const seen = new Set(existing.map((e) => keyOf(e.meta?.deviceType, e)));

      const toInsert = [];
      for (const entry of wearable.bloodOxygen) {
        const key = keyOf(wearable.deviceType, entry);
        if (seen.has(key)) continue;
        seen.add(key);
        toInsert.push({
          user: wearable.user,
          meta: { deviceType: wearable.deviceType, source: entry.source },
          timestamp: entry.timestamp,
          percentage: entry.percentage,
          sourceRecordId: entry.sourceRecordId
        });
      }

      if (toInsert.length) {
        await BloodOxygenSample.insertMany(toInsert, { ordered: false });
        copied += toInsert.length;
      }
    }

    console.log(`Blood oxygen migration complete: ${copied} readings copied.`);
  } finally {
    await mongoose.disconnect();
  }
})().catch((error) => {
  console.error('Blood oxygen migration failed:', error);
  process.exit(1);
});
