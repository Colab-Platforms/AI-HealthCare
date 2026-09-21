const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const WearableData = require('../models/WearableData');
const WearableMetricSample = require('../models/WearableMetricSample');

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
    // WearableMetricSample is a time-series collection — MongoDB only allows
    // multi-document updates on those, not the per-sample updateOne/upsert
    // this used to do. Instead: load each user's existing samples once, dedupe
    // in memory against the same key the old upsert matched on, and insertMany
    // just the new ones. insertMany is fully supported on time-series
    // collections and re-running this script stays safe (already-migrated
    // samples are skipped).
    //
    // This is the array most likely to be large (every OpenWearables series
    // type lands here) — batch fetch is fine since it's the one we're
    // migrating away from precisely because per-doc growth is the problem.
    const cursor = WearableData.find({ 'metrics.0': { $exists: true } })
      .select('user deviceType metrics')
      .cursor();

    const keyOf = (deviceType, seriesType, entry) =>
      `${deviceType}|${seriesType}|${entry.timestamp?.getTime()}|${entry.value}`;

    for await (const wearable of cursor) {
      if (!wearable.metrics?.length) continue;

      const existing = await WearableMetricSample.find({ user: wearable.user })
        .select('meta.deviceType meta.seriesType timestamp value -_id')
        .lean();
      const seen = new Set(existing.map((e) => keyOf(e.meta?.deviceType, e.meta?.seriesType, e)));

      const toInsert = [];
      for (const entry of wearable.metrics) {
        const key = keyOf(wearable.deviceType, entry.seriesType, entry);
        if (seen.has(key)) continue;
        seen.add(key);
        toInsert.push({
          user: wearable.user,
          meta: { deviceType: wearable.deviceType, seriesType: entry.seriesType, provider: entry.provider, device: entry.device },
          timestamp: entry.timestamp,
          value: entry.value,
          unit: entry.unit
        });
      }

      if (toInsert.length) {
        await WearableMetricSample.insertMany(toInsert, { ordered: false });
        copied += toInsert.length;
      }
    }

    console.log(`Generic metric migration complete: ${copied} samples copied.`);
  } finally {
    await mongoose.disconnect();
  }
})().catch((error) => {
  console.error('Generic metric migration failed:', error);
  process.exit(1);
});
