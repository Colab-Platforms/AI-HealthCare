const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const WearableData = require('../models/WearableData');
const Workout = require('../models/Workout');

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
  let skippedNoId = 0;

  try {
    const cursor = WearableData.find({ 'workouts.0': { $exists: true } })
      .select('user deviceType workouts')
      .cursor();

    for await (const wearable of cursor) {
      for (const entry of wearable.workouts || []) {
        if (!entry.workoutId) { skippedNoId++; continue; } // unique key requires one
        const result = await Workout.updateOne(
          { user: wearable.user, deviceType: wearable.deviceType, workoutId: entry.workoutId },
          {
            $setOnInsert: {
              user: wearable.user,
              deviceType: wearable.deviceType,
              workoutId: entry.workoutId,
              type: entry.type,
              startTime: entry.startTime,
              endTime: entry.endTime,
              durationSeconds: entry.durationSeconds,
              caloriesKcal: entry.caloriesKcal,
              distanceMeters: entry.distanceMeters,
              avgHeartRateBpm: entry.avgHeartRateBpm,
              maxHeartRateBpm: entry.maxHeartRateBpm,
              elevationGainMeters: entry.elevationGainMeters,
              provider: entry.provider
            }
          },
          { upsert: true }
        );
        if (result.upsertedCount) copied++;
      }
    }

    console.log(`Workout migration complete: ${copied} workouts copied, ${skippedNoId} skipped (no workoutId).`);
  } finally {
    await mongoose.disconnect();
  }
})().catch((error) => {
  console.error('Workout migration failed:', error);
  process.exit(1);
});
