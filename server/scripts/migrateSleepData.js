const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const WearableData = require('../models/WearableData');
const SleepSession = require('../models/SleepSession');

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
    const cursor = WearableData.find({ 'sleepData.0': { $exists: true } })
      .select('user deviceType sleepData')
      .cursor();

    for await (const wearable of cursor) {
      for (const entry of wearable.sleepData || []) {
        const result = await SleepSession.updateOne(
          { user: wearable.user, deviceType: wearable.deviceType, date: entry.date },
          {
            $setOnInsert: {
              user: wearable.user,
              deviceType: wearable.deviceType,
              date: entry.date,
              totalSleepMinutes: entry.totalSleepMinutes,
              deepSleepMinutes: entry.deepSleepMinutes,
              lightSleepMinutes: entry.lightSleepMinutes,
              remSleepMinutes: entry.remSleepMinutes,
              awakeMinutes: entry.awakeMinutes,
              sleepScore: entry.sleepScore,
              bedTime: entry.bedTime,
              wakeTime: entry.wakeTime,
              source: entry.source,
              sourceRecordId: entry.sourceRecordId
            }
          },
          { upsert: true }
        );
        if (result.upsertedCount) copied++;
      }
    }

    console.log(`Sleep session migration complete: ${copied} nights copied.`);
  } finally {
    await mongoose.disconnect();
  }
})().catch((error) => {
  console.error('Sleep session migration failed:', error);
  process.exit(1);
});
