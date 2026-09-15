const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const WearableData = require('../models/WearableData');
const HeartRateSample = require('../models/HeartRateSample');

dotenv.config();
dotenv.config({ path: path.join(__dirname, '..', '.env') });

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000, family: 4 });
  let copied = 0;

  try {
    const cursor = WearableData.find({ 'heartRate.0': { $exists: true } })
      .select('user deviceType heartRate')
      .cursor();

    for await (const wearable of cursor) {
      for (const sample of wearable.heartRate || []) {
        const result = await HeartRateSample.updateOne(
          {
            user: wearable.user,
            deviceType: wearable.deviceType,
            timestamp: sample.timestamp,
            bpm: sample.bpm,
            sourceRecordId: sample.sourceRecordId
          },
          {
            $setOnInsert: {
              user: wearable.user,
              deviceType: wearable.deviceType,
              timestamp: sample.timestamp,
              bpm: sample.bpm,
              type: sample.type || 'resting',
              source: sample.source,
              sourceRecordId: sample.sourceRecordId
            }
          },
          { upsert: true }
        );
        if (result.upsertedCount) copied++;
      }
    }

    console.log(`Heart-rate migration complete: ${copied} samples copied.`);
  } finally {
    await mongoose.disconnect();
  }
})().catch((error) => {
  console.error('Heart-rate migration failed:', error);
  process.exit(1);
});
