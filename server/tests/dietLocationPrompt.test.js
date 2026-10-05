/**
 * Tests for the location block of the diet prompt.
 *
 * These exist because of a real production symptom: users with no location set
 * were served dishes from the far side of the country (an Andhra breakfast for a
 * user in Rajasthan). The cause was a prompt line — "focus on diverse Indian
 * cuisine from all regions" — that fired on the schema default and told the
 * model to range over everything, and which also contradicted the state line
 * when both were present. The first two tests pin that line down for good.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { buildLocationInstructions } = require('../services/dietRecommendationAI');

const ALL_REGIONS_HINT = 'diverse Indian cuisine from all regions';

test('never tells the model to range over all regions, whatever the input', () => {
  const inputs = [
    {},
    { country: 'India' },
    { country: 'India', region: 'other' },
    { country: 'India', region: 'other', state: '', city: '' },
    { country: 'India', region: 'north', state: 'Rajasthan', city: 'Jaipur' },
    { country: 'India', region: 'other', state: 'Rajsthan' }, // misspelt -> region 'other'
  ];

  for (const input of inputs) {
    const out = buildLocationInstructions(input);
    assert.ok(
      !out.includes(ALL_REGIONS_HINT),
      `"${ALL_REGIONS_HINT}" leaked back in for ${JSON.stringify(input)}`
    );
  }
});

test('says nothing at all when no location is known', () => {
  // Better to stay silent than to invite the model to pick from anywhere: with
  // no location it should lean on dietary preference and preferred foods.
  assert.equal(buildLocationInstructions({ country: 'India', region: 'other' }), '');
  assert.equal(buildLocationInstructions({}), '');
});

test('a state suppresses the broader region line instead of contradicting it', () => {
  const out = buildLocationInstructions({
    country: 'India',
    region: 'north',
    state: 'Rajasthan',
  });

  assert.ok(out.includes('STATE FOCUS'));
  assert.ok(out.includes('Rajasthan'));
  assert.ok(!out.includes('REGION FOCUS'), 'region line is redundant once a state is known');
});

test('region is used as a fallback only when there is no state or city', () => {
  const out = buildLocationInstructions({ country: 'India', region: 'south' });

  assert.ok(out.includes('REGION FOCUS'));
  assert.ok(out.includes('south'));
});

test('an unmapped or misspelt state still reaches the model', () => {
  // config/indiaRegions resolves "Rajsthan" to region 'other', but the raw
  // string must survive — the model understands it even when our map does not.
  const out = buildLocationInstructions({ country: 'India', region: 'other', state: 'Rajsthan' });

  assert.ok(out.includes('STATE FOCUS'));
  assert.ok(out.includes('Rajsthan'));
});

test('city is included and is described as the most specific signal', () => {
  const out = buildLocationInstructions({
    country: 'India',
    region: 'north',
    state: 'Rajasthan',
    city: 'Jaipur',
  });

  assert.ok(out.includes('CITY FOCUS'));
  assert.ok(out.includes('Jaipur, Rajasthan, India'));
});

test('city alone works without a state', () => {
  const out = buildLocationInstructions({ country: 'India', city: 'Jaipur' });

  assert.ok(out.includes('CITY FOCUS'));
  assert.ok(out.includes('Jaipur, India'));
  assert.ok(!out.includes('STATE FOCUS'));
});

test('specific lines come after broad ones so the model resolves to the narrowest', () => {
  const out = buildLocationInstructions({
    country: 'USA',
    region: 'other',
    state: 'California',
    city: 'San Jose',
  });

  assert.ok(out.indexOf('COUNTRY FOCUS') < out.indexOf('STATE FOCUS'));
  assert.ok(out.indexOf('STATE FOCUS') < out.indexOf('CITY FOCUS'));
});

test('non-India countries still get a country line', () => {
  const out = buildLocationInstructions({ country: 'USA', region: 'other' });

  assert.ok(out.includes('COUNTRY FOCUS'));
  assert.ok(out.includes('USA'));
});

test('whitespace-only state and city are treated as absent', () => {
  assert.equal(buildLocationInstructions({ country: 'India', state: '   ', city: '  ' }), '');
});

test('non-string state and city do not throw', () => {
  assert.doesNotThrow(() => buildLocationInstructions({ state: null, city: undefined }));
  assert.doesNotThrow(() => buildLocationInstructions({ state: 42, city: {} }));
  assert.equal(buildLocationInstructions({ country: 'India', state: 42, city: {} }), '');
});

test('called with no argument at all does not throw', () => {
  assert.doesNotThrow(() => buildLocationInstructions());
});
