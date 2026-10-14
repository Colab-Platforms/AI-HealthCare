// Maps a device's raw workout-type string to our own cardio/strength/
// flexibility/other taxonomy (config/activityCatalog.js's ACTIVITY_CATEGORY).
//
// Two source vocabularies feed this: Apple HealthKit's HKWorkoutActivityType
// (e.g. "coreTraining", "traditionalStrengthTraining", "running") and
// Android Health Connect's ExerciseSessionRecord exercise type strings
// (e.g. "running", "weightlifting", "yoga"). Both are normalized the same
// way before lookup — lowercased, non-letters stripped — so "Core Training",
// "core_training", and "CORETRAINING" all resolve to the same key, since we
// don't control exactly how the client forwards the OS's own string.
//
// Deliberately NOT a hard enum/throw on an unknown type: a wearable SDK adds
// new workout types over time, and a workout this app has never seen before
// must still save (as 'other', visible in the UI, countable toward total
// exercise minutes) rather than fail the whole sync batch.
const TYPE_TO_CATEGORY = {
  // --- cardio ---
  running: 'cardio',
  walking: 'cardio',
  hiking: 'cardio',
  cycling: 'cardio',
  swimming: 'cardio',
  rowing: 'cardio',
  elliptical: 'cardio',
  stairclimbing: 'cardio',
  stairs: 'cardio',
  dance: 'cardio',
  dancing: 'cardio',
  hiit: 'cardio',
  highintensityintervaltraining: 'cardio',
  cardio: 'cardio',
  mixedcardio: 'cardio',
  mixedmetaboliccardiotraining: 'cardio',
  jumprope: 'cardio',
  kickboxing: 'cardio',
  stepcount: 'cardio', // Health Connect step-based session type
  wheelchairwalkpace: 'cardio',
  wheelchairrunpace: 'cardio',

  // --- strength ---
  traditionalstrengthtraining: 'strength',
  functionalstrengthtraining: 'strength',
  coretraining: 'strength',
  weighttraining: 'strength',
  weightlifting: 'strength',
  strengthtraining: 'strength',
  crosstraining: 'strength',
  crossfit: 'strength',

  // --- flexibility ---
  yoga: 'flexibility',
  pilates: 'flexibility',
  stretching: 'flexibility',
  flexibility: 'flexibility',
  cooldown: 'flexibility',
  preparationandrecovery: 'flexibility',
  taichi: 'flexibility',

  // --- explicitly generic/unclassified ---
  generic: 'other',
  other: 'other',
  mixedcardiostrength: 'other', // genuinely both — see note below
};

// A handful of real workout types are legitimately BOTH cardio and strength
// in roughly equal measure (CrossFit-style circuits, some HIIT formats).
// Classifying those as 'other' rather than guessing one pillar keeps the
// Activity Score honest — they still count toward total logged-exercise
// minutes, just not toward either specific pillar's target.

function mapWorkoutTypeToCategory(rawType) {
  if (!rawType || typeof rawType !== 'string') return 'other';
  const key = rawType.toLowerCase().replace(/[^a-z]/g, '');
  return TYPE_TO_CATEGORY[key] || 'other';
}

module.exports = { mapWorkoutTypeToCategory, TYPE_TO_CATEGORY };
