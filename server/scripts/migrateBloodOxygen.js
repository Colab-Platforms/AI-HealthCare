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
    const cursor = WearableData.find({ 'bloodOxygen.0': { $exists: true } })
      .select('user deviceType bloodOxygen')
      .cursor();

    for await (const wearable of cursor) {
      for (const entry of wearable.bloodOxygen || []) {
        const result = await BloodOxygenSample.updateOne(
          {
            user: wearable.user,
            'meta.deviceType': wearable.deviceType,
            timestamp: entry.timestamp,
            percentage: entry.percentage,
            sourceRecordId: entry.sourceRecordId
          },
          {
            $setOnInsert: {
              user: wearable.user,
              meta: { deviceType: wearable.deviceType, source: entry.source },
              timestamp: entry.timestamp,
              percentage: entry.percentage,
              sourceRecordId: entry.sourceRecordId
            }
          },
          { upsert: true }
        );
        if (result.upsertedCount) copied++;
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
