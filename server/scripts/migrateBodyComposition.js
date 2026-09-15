const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const WearableData = require('../models/WearableData');
const BodyCompositionSample = require('../models/BodyCompositionSample');

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
    const cursor = WearableData.find({ 'bodyComposition.0': { $exists: true } })
      .select('user deviceType bodyComposition')
      .cursor();

    for await (const wearable of cursor) {
      for (const entry of wearable.bodyComposition || []) {
        const result = await BodyCompositionSample.updateOne(
          {
            user: wearable.user,
            deviceType: wearable.deviceType,
            timestamp: entry.timestamp,
            weightKg: entry.weightKg,
            sourceRecordId: entry.sourceRecordId
          },
          {
            $setOnInsert: {
              user: wearable.user,
              deviceType: wearable.deviceType,
              timestamp: entry.timestamp,
              weightKg: entry.weightKg,
              bodyFatPercentage: entry.bodyFatPercentage,
              bmi: entry.bmi,
              leanBodyMassKg: entry.leanBodyMassKg,
              source: entry.source,
              sourceRecordId: entry.sourceRecordId
            }
          },
          { upsert: true }
        );
        if (result.upsertedCount) copied++;
      }
    }

    console.log(`Body composition migration complete: ${copied} readings copied.`);
  } finally {
    await mongoose.disconnect();
  }
})().catch((error) => {
  console.error('Body composition migration failed:', error);
  process.exit(1);
});
