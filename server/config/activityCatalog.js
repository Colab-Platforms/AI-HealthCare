// Single source of truth for activity types. The original 9 ids
// (running, cycling, walking, swimming, gym_strength, yoga, hiit, sports, other)
// are kept unchanged so existing ExerciseLog docs stay valid with no migration —
// everything past that is additive.
const ACTIVITY_CATALOG = [
  // MET values sourced from the 2024 Adult Compendium of Physical Activities
  // (Ainsworth et al.) — "stretching, mild" and "walking, strolling <2mph"
  // are both listed at 2.5 MET. Added specifically to give the Recovery
  // feature's low/very_low bands real light-intensity (<3.0 MET, ACSM)
  // suggestions beyond Yoga, which was previously the catalog's only entry
  // in that range.
  { id: 'stretching_mobility', label: 'Stretching / Mobility', category: 'flexibility', metValue: 2.5 },
  { id: 'slow_walk', label: 'Slow Walk', category: 'cardio', metValue: 2.5 },
  { id: 'archery', label: 'Archery', category: 'other', metValue: 3.5 },
  { id: 'badminton', label: 'Badminton', category: 'cardio', metValue: 5.5 },
  { id: 'basketball', label: 'Basketball', category: 'cardio', metValue: 6.5 },
  { id: 'boxing', label: 'Boxing', category: 'cardio', metValue: 8.0 },
  { id: 'climbing', label: 'Climbing', category: 'strength', metValue: 8.0 },
  { id: 'cricket', label: 'Cricket', category: 'cardio', metValue: 5.0 },
  { id: 'cycling', label: 'Cycling', category: 'cardio', metValue: 7.5 },
  { id: 'dancing', label: 'Dancing', category: 'cardio', metValue: 4.8 },
  { id: 'elliptical', label: 'Elliptical', category: 'cardio', metValue: 5.0 },
  { id: 'football', label: 'Football', category: 'cardio', metValue: 7.0 },
  { id: 'golf', label: 'Golf', category: 'cardio', metValue: 4.3 },
  { id: 'gym_strength', label: 'Gym / Strength', category: 'strength', metValue: 5.0 },
  { id: 'hiking', label: 'Hiking', category: 'cardio', metValue: 6.0 },
  { id: 'hiit', label: 'HIIT', category: 'cardio', metValue: 8.0 },
  { id: 'ice_skating', label: 'Ice Skating', category: 'cardio', metValue: 7.0 },
  { id: 'jump_rope', label: 'Jump Rope', category: 'cardio', metValue: 10.0 },
  { id: 'kayaking', label: 'Kayaking', category: 'cardio', metValue: 5.0 },
  { id: 'kickboxing', label: 'Kickboxing', category: 'cardio', metValue: 8.0 },
  { id: 'martial_arts', label: 'Martial Arts', category: 'cardio', metValue: 7.0 },
  { id: 'pickleball', label: 'Pickleball', category: 'cardio', metValue: 5.0 },
  { id: 'pilates', label: 'Pilates', category: 'flexibility', metValue: 3.0 },
  { id: 'rowing', label: 'Rowing', category: 'cardio', metValue: 7.0 },
  { id: 'running', label: 'Running', category: 'cardio', metValue: 9.8 },
  { id: 'skiing', label: 'Skiing', category: 'cardio', metValue: 7.0 },
  { id: 'spinning', label: 'Spinning', category: 'cardio', metValue: 8.5 },
  { id: 'squash', label: 'Squash', category: 'cardio', metValue: 7.3 },
  { id: 'swimming', label: 'Swimming', category: 'cardio', metValue: 8.3 },
  { id: 'sports', label: 'Sports', category: 'cardio', metValue: 7.0 },
  { id: 'table_tennis', label: 'Table Tennis', category: 'cardio', metValue: 4.0 },
  { id: 'tennis', label: 'Tennis', category: 'cardio', metValue: 7.3 },
  { id: 'volleyball', label: 'Volleyball', category: 'cardio', metValue: 4.0 },
  { id: 'walking', label: 'Walking', category: 'cardio', metValue: 3.8 },
  { id: 'weightlifting', label: 'Weightlifting', category: 'strength', metValue: 6.0 },
  { id: 'wrestling', label: 'Wrestling', category: 'cardio', metValue: 6.0 },
  { id: 'yoga', label: 'Yoga', category: 'flexibility', metValue: 2.5 },
  { id: 'zumba', label: 'Zumba', category: 'cardio', metValue: 6.5 },
  { id: 'other', label: 'Other', category: 'other', metValue: 4.0 },
];

const ACTIVITY_IDS = new Set(ACTIVITY_CATALOG.map((a) => a.id));
const MET_VALUES = Object.fromEntries(ACTIVITY_CATALOG.map((a) => [a.id, a.metValue]));
const ACTIVITY_CATEGORY = Object.fromEntries(ACTIVITY_CATALOG.map((a) => [a.id, a.category]));
const ACTIVITY_LABEL = Object.fromEntries(ACTIVITY_CATALOG.map((a) => [a.id, a.label]));

function isValidActivityId(id) {
  return ACTIVITY_IDS.has(id);
}

function getActivityMeta(id) {
  return ACTIVITY_CATALOG.find((a) => a.id === id) || null;
}

// Buckets activities by the first letter of their label into A-C/D-H/I-O/P-S/T-Z
// ranges, matching the picker UI's grouping. "Other" is excluded from the
// alphabetical groups and returned separately, same as the mockup.
const LETTER_RANGES = [
  { key: 'A-C', test: (c) => c >= 'A' && c <= 'C' },
  { key: 'D-H', test: (c) => c >= 'D' && c <= 'H' },
  { key: 'I-O', test: (c) => c >= 'I' && c <= 'O' },
  { key: 'P-S', test: (c) => c >= 'P' && c <= 'S' },
  { key: 'T-Z', test: (c) => c >= 'T' && c <= 'Z' },
];

function groupCatalog() {
  const groups = LETTER_RANGES.map((r) => ({ key: r.key, activities: [] }));
  let other = null;

  for (const activity of ACTIVITY_CATALOG) {
    if (activity.id === 'other') {
      other = activity;
      continue;
    }
    const firstLetter = activity.label[0].toUpperCase();
    const range = LETTER_RANGES.find((r) => r.test(firstLetter));
    const group = groups.find((g) => g.key === range.key);
    group.activities.push(activity);
  }

  return { groups, other };
}

// Published ACSM/CDC MET-intensity classification (physical activity
// guidelines): light <3.0 METs, moderate 3.0-5.9 METs, vigorous >=6.0 METs.
// These two boundary numbers (3.0, 6.0) are the ONLY thresholds used below —
// nothing here is an invented split.
const LIGHT_MODERATE_BOUNDARY = 3.0;
const MODERATE_VIGOROUS_BOUNDARY = 6.0;

function intensityLabel(metValue) {
  if (metValue < LIGHT_MODERATE_BOUNDARY) return 'Light intensity';
  if (metValue < MODERATE_VIGOROUS_BOUNDARY) return 'Moderate intensity';
  return 'Vigorous intensity';
}

// Recovery band -> allowed ACSM intensity category. Low/very_low both map to
// the same "Light" category (recovery guidance is "rest or light activity"
// for both, not a graded MET cutoff between them); moderate and optimal map
// 1:1 onto the Moderate and Vigorous categories respectively.
//
// NOTE: our current catalog's Light bucket (<3.0 MET) is thin — mostly just
// Yoga — so very_low/low may return only 1-2 suggestions today. That is an
// honest reflection of the catalog's content coverage, not a logic bug;
// fixing it means adding more genuinely light-intensity catalog entries
// (e.g. stretching, slow walking), a content task separate from this filter.
function metRangeForBand(bandKey) {
  if (bandKey === 'optimal') return { min: MODERATE_VIGOROUS_BOUNDARY, max: Infinity };
  if (bandKey === 'moderate') return { min: LIGHT_MODERATE_BOUNDARY, max: MODERATE_VIGOROUS_BOUNDARY };
  return { min: 0, max: LIGHT_MODERATE_BOUNDARY }; // low, very_low
}

const RECOVERY_SUGGESTION_COUNT = 4;

function getRecoveryFriendlyActivities(bandKey) {
  const { min, max } = metRangeForBand(bandKey);
  return ACTIVITY_CATALOG
    .filter((a) => a.id !== 'other' && a.metValue >= min && a.metValue < max)
    .sort((a, b) => a.metValue - b.metValue)
    .slice(0, RECOVERY_SUGGESTION_COUNT)
    .map((a) => ({ id: a.id, label: a.label, category: a.category, metValue: a.metValue, intensity: intensityLabel(a.metValue) }));
}

module.exports = {
  ACTIVITY_CATALOG,
  MET_VALUES,
  ACTIVITY_CATEGORY,
  ACTIVITY_LABEL,
  isValidActivityId,
  getActivityMeta,
  groupCatalog,
  getRecoveryFriendlyActivities,
};
