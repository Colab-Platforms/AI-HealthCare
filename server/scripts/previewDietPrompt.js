/**
 * Print the location block that diet generation would send to the model, for a
 * few representative users. No database, no API key, no network — it just calls
 * the same pure function the real prompt is built from.
 *
 * Use it to see what a change to the location logic actually does to the
 * instructions, instead of generating a plan and guessing from the dishes.
 *
 *   node scripts/previewDietPrompt.js
 */
const { buildLocationInstructions } = require('../services/dietRecommendationAI');
const { deriveRegionFromState } = require('../config/indiaRegions');

const CASES = [
  {
    label: 'Before this feature: nothing set (the Pesarattu case)',
    location: { country: 'India', region: 'other', state: null, city: null },
  },
  {
    label: 'State picked from the dropdown',
    location: { country: 'India', state: 'Rajasthan', city: null },
  },
  {
    label: 'State + city',
    location: { country: 'India', state: 'Rajasthan', city: 'Jaipur' },
  },
  {
    label: 'Misspelt state — not in the map, still reaches the model',
    location: { country: 'India', state: 'Rajsthan', city: null },
  },
  {
    label: 'Legacy user: region only, no state',
    location: { country: 'India', region: 'south', state: null, city: null },
  },
  {
    label: 'City only, no state',
    location: { country: 'India', state: null, city: 'Kochi' },
  },
  {
    label: 'Outside India',
    location: { country: 'USA', state: 'California', city: 'San Jose' },
  },
];

for (const { label, location } of CASES) {
  // Mirrors what the controller stores: region is derived from state unless the
  // record predates `state`, in which case the stored region is kept.
  const region = location.state
    ? deriveRegionFromState(location.state)
    : location.region || 'other';

  const block = buildLocationInstructions({ ...location, region });

  console.log('='.repeat(72));
  console.log(label);
  console.log(
    `  country=${location.country}  state=${location.state || '-'}  ` +
      `city=${location.city || '-'}  region=${region}  (derived)`
  );
  console.log('-'.repeat(72));
  console.log(block.trim() || '(no location instructions — the model falls back to diet type and favourites)');
  console.log('');
}
