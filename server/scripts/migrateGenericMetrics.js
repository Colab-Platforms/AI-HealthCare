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
    // This is the array most likely to be large (every OpenWearables series
    // type lands here) — batch fetch is fine since it's the one we're
    // migrating away from precisely because per-doc growth is the problem.
    const cursor = WearableData.find({ 'metrics.0': { $exists: true } })
      .select('user deviceType metrics')
      .cursor();

    for await (const wearable of cursor) {
      for (const entry of wearable.metrics || []) {
        const result = await WearableMetricSample.updateOne(
          {
            user: wearable.user,
            'meta.deviceType': wearable.deviceType,
            'meta.seriesType': entry.seriesType,
            timestamp: entry.timestamp,
            value: entry.value
          },
          {
            $setOnInsert: {
              user: wearable.user,
              meta: { deviceType: wearable.deviceType, seriesType: entry.seriesType, provider: entry.provider, device: entry.device },
              timestamp: entry.timestamp,
              value: entry.value,
              unit: entry.unit
            }
          },
          { upsert: true }
        );
        if (result.upsertedCount) copied++;
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
