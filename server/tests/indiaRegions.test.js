/**
 * Tests for the state -> region derivation.
 *
 * The important one here is "every dropdown state resolves to a real region".
 * The app renders INDIAN_STATES, so if a state is ever added to that list
 * without a matching entry in the region map, users picking it would silently
 * fall back to 'other' — which is the state the whole feature exists to avoid.
 * That guarantee has to be mechanical, not a promise in a comment.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  INDIAN_STATES,
  deriveRegionFromState,
  canonicalizeStateName,
  normalizeStateName,
} = require('../config/indiaRegions');

const VALID_REGIONS = ['north', 'south', 'east', 'west', 'northeast', 'other'];

test('every state in the dropdown list resolves to a non-other region', () => {
  const unmapped = INDIAN_STATES.filter((s) => deriveRegionFromState(s) === 'other');

  assert.deepEqual(
    unmapped,
    [],
    `These states are offered in the app but have no region mapping: ${unmapped.join(', ')}`
  );
});

test('every derived region is inside the User schema enum', () => {
  for (const state of INDIAN_STATES) {
    const region = deriveRegionFromState(state);
    assert.ok(
      VALID_REGIONS.includes(region),
      `${state} derived "${region}", which is not a valid region`
    );
  }
});

test('the dropdown list has no duplicates', () => {
  assert.equal(new Set(INDIAN_STATES).size, INDIAN_STATES.length);
});

test('derives the expected region for each zone', () => {
  assert.equal(deriveRegionFromState('Rajasthan'), 'north');
  assert.equal(deriveRegionFromState('Kerala'), 'south');
  assert.equal(deriveRegionFromState('West Bengal'), 'east');
  assert.equal(deriveRegionFromState('Gujarat'), 'west');
  assert.equal(deriveRegionFromState('Assam'), 'northeast');
});

test('matching is insensitive to case, spacing and punctuation', () => {
  for (const variant of ['tamil nadu', 'TAMIL NADU', '  Tamil  Nadu  ', 'tamil-nadu']) {
    assert.equal(deriveRegionFromState(variant), 'south', `failed for "${variant}"`);
  }
});

test('resolves renamed states and common short forms', () => {
  assert.equal(deriveRegionFromState('Orissa'), 'east'); // renamed to Odisha
  assert.equal(deriveRegionFromState('Pondicherry'), 'south'); // renamed to Puducherry
  assert.equal(deriveRegionFromState('Uttaranchal'), 'north'); // renamed to Uttarakhand
  assert.equal(deriveRegionFromState('UP'), 'north');
  assert.equal(deriveRegionFromState('J & K'), 'north');
});

test('unknown and empty input falls back to other rather than throwing', () => {
  // A misspelling, a non-Indian state, and junk types all have to be safe:
  // this runs on every preferences save.
  assert.equal(deriveRegionFromState('Rajsthan'), 'other');
  assert.equal(deriveRegionFromState('California'), 'other');
  assert.equal(deriveRegionFromState(''), 'other');
  assert.equal(deriveRegionFromState('   '), 'other');
  assert.equal(deriveRegionFromState(null), 'other');
  assert.equal(deriveRegionFromState(undefined), 'other');
  assert.equal(deriveRegionFromState(42), 'other');
  assert.equal(deriveRegionFromState({}), 'other');
});

test('canonicalizes known states to their display spelling', () => {
  assert.equal(canonicalizeStateName('tamil nadu'), 'Tamil Nadu');
  assert.equal(canonicalizeStateName('TN'), 'Tamil Nadu');
  assert.equal(canonicalizeStateName('  kerala '), 'Kerala');
  assert.equal(canonicalizeStateName('Orissa'), 'Odisha');
});

test('canonicalize leaves unknown states intact but trimmed', () => {
  // The schema field is free-form on purpose so users outside India can use it,
  // so an unrecognised value must survive rather than being blanked.
  assert.equal(canonicalizeStateName('  California '), 'California');
  assert.equal(canonicalizeStateName('Bavaria'), 'Bavaria');
  assert.equal(canonicalizeStateName(''), '');
  assert.equal(canonicalizeStateName(null), '');
});

test('canonicalizing is idempotent', () => {
  for (const state of INDIAN_STATES) {
    assert.equal(canonicalizeStateName(canonicalizeStateName(state)), state);
  }
});

test('normalizeStateName collapses the variants that reach it', () => {
  assert.equal(normalizeStateName('  Jammu & Kashmir '), 'jammu and kashmir');
  assert.equal(normalizeStateName('West-Bengal'), 'west bengal');
  assert.equal(normalizeStateName(123), '');
});
