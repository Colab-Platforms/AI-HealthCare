const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const WearableData = require('../models/WearableData');
const DailyActivityMetric = require('../models/DailyActivityMetric');

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
    const cursor = WearableData.find({ 'dailyMetrics.0': { $exists: true } })
      .select('user deviceType dailyMetrics')
      .cursor();

    for await (const wearable of cursor) {
      for (const entry of wearable.dailyMetrics || []) {
        const result = await DailyActivityMetric.updateOne(
          { user: wearable.user, deviceType: wearable.deviceType, date: entry.date },
          {
            $setOnInsert: {
              user: wearable.user,
              deviceType: wearable.deviceType,
              date: entry.date,
              steps: entry.steps,
              caloriesBurned: entry.caloriesBurned,
              activeMinutes: entry.activeMinutes,
              distance: entry.distance,
              floorsClimbed: entry.floorsClimbed,
              source: entry.source,
              sourceRecordId: entry.sourceRecordId
            }
          },
          { upsert: true }
        );
        if (result.upsertedCount) copied++;
      }
    }

    console.log(`Daily activity migration complete: ${copied} day-records copied.`);
  } finally {
    await mongoose.disconnect();
  }
})().catch((error) => {
  console.error('Daily activity migration failed:', error);
  process.exit(1);
});
