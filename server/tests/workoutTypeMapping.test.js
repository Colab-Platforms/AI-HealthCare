/**
 * Device workout type -> cardio/strength/flexibility/other classification.
 * This is the piece that lets a synced Apple Watch/Health Connect workout
 * (e.g. the "Core Training" session that prompted this fix — it never
 * reached the server at all before /os-sync gained a `workouts` field)
 * feed the right Activity Score pillar once it does.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { mapWorkoutTypeToCategory } = require('../utils/workoutTypeMapping');

test('the exact case from the screenshot: Core Training maps to strength', () => {
  assert.equal(mapWorkoutTypeToCategory('Core Training'), 'strength');
  assert.equal(mapWorkoutTypeToCategory('coreTraining'), 'strength');
  assert.equal(mapWorkoutTypeToCategory('CORE_TRAINING'), 'strength');
});

test('common cardio types', () => {
  assert.equal(mapWorkoutTypeToCategory('running'), 'cardio');
  assert.equal(mapWorkoutTypeToCategory('Swimming'), 'cardio');
  assert.equal(mapWorkoutTypeToCategory('cycling'), 'cardio');
});

test('common strength types', () => {
  assert.equal(mapWorkoutTypeToCategory('traditionalStrengthTraining'), 'strength');
  assert.equal(mapWorkoutTypeToCategory('functionalStrengthTraining'), 'strength');
  assert.equal(mapWorkoutTypeToCategory('weightlifting'), 'strength');
});

test('flexibility types', () => {
  assert.equal(mapWorkoutTypeToCategory('yoga'), 'flexibility');
  assert.equal(mapWorkoutTypeToCategory('Pilates'), 'flexibility');
});

test('unknown or missing type falls back to other, never throws', () => {
  assert.equal(mapWorkoutTypeToCategory('someBrandNewWorkoutType2027'), 'other');
  assert.equal(mapWorkoutTypeToCategory(undefined), 'other');
  assert.equal(mapWorkoutTypeToCategory(null), 'other');
  assert.equal(mapWorkoutTypeToCategory(''), 'other');
  assert.equal(mapWorkoutTypeToCategory(123), 'other');
});

test('generic (WHOOP\'s only type today) is other, not guessed as cardio or strength', () => {
  assert.equal(mapWorkoutTypeToCategory('generic'), 'other');
});
