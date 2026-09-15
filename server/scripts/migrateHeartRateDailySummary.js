const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const WearableData = require('../models/WearableData');
const HeartRateDailySummary = require('../models/HeartRateDailySummary');

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
    const cursor = WearableData.find({ 'heartRateDailySummary.0': { $exists: true } })
      .select('user deviceType heartRateDailySummary')
      .cursor();

    for await (const wearable of cursor) {
      for (const entry of wearable.heartRateDailySummary || []) {
        // Historical rollups never tracked WHEN the min/max happened, only the
        // value — timestamp is left null for these migrated rows. Every
        // rollup written from here on (via wearableIngestService) fills it in.
        const result = await HeartRateDailySummary.updateOne(
          { user: wearable.user, deviceType: wearable.deviceType, date: entry.date },
          {
            $setOnInsert: {
              user: wearable.user,
              deviceType: wearable.deviceType,
              date: entry.date,
              avgBpm: entry.avgBpm,
              min: { value: entry.minBpm, timestamp: null },
              max: { value: entry.maxBpm, timestamp: null },
              readingCount: entry.readingCount,
              restingBpm: entry.restingBpm != null ? { value: entry.restingBpm, timestamp: null } : undefined
            }
          },
          { upsert: true }
        );
        if (result.upsertedCount) copied++;
      }
    }

    console.log(`Heart-rate daily summary migration complete: ${copied} day-rollups copied.`);
  } finally {
    await mongoose.disconnect();
  }
})().catch((error) => {
  console.error('Heart-rate daily summary migration failed:', error);
  process.exit(1);
});
