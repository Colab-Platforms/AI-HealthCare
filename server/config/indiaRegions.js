/**
 * Canonical Indian state list, and the state -> cuisine-region mapping.
 *
 * Why this exists: `region` used to be a second thing we asked the user for,
 * alongside `state`. Two independent inputs describing the same fact can
 * disagree — a user could pick region "south" and type state "Rajasthan" — and
 * both then went into the diet prompt, which made the cuisine signal worse than
 * sending nothing. So `state` is the only thing collected now, and `region` is
 * derived from it here.
 *
 * Derivation keys off `state` rather than `city` deliberately. There are 36
 * states/UTs from a closed list, so a lookup is exact. Cities are free text and
 * arrive as "Jaipur", "jaipur", "Jaipur, Raj" or a typo, which no map can match
 * reliably — and a failed match would silently produce no region.
 *
 * An unmatched state is NOT a failure mode that loses the signal: the raw state
 * string still goes into the prompt verbatim (see dietRecommendationAI), so the
 * model reads "User is from Rajsthan" even when this map has never heard of it.
 * `region` is only a fallback for when no state was given at all.
 *
 * `region` must stay inside the User schema's enum:
 * ['north', 'south', 'east', 'west', 'northeast', 'other'].
 */

// Display-cased list, alphabetical — the order users expect to scan in a
// dropdown. The app renders this same list, so anything the app can submit is
// by construction a key this module resolves.
const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

// Zonal Council groupings, with the north-eastern states split out because the
// diet prompt treats "northeast" as its own cuisine, which it is.
// Keys are normalised (see normalizeStateName), not display-cased.
const STATE_TO_REGION = {
  // North
  'jammu and kashmir': 'north',
  ladakh: 'north',
  'himachal pradesh': 'north',
  punjab: 'north',
  haryana: 'north',
  chandigarh: 'north',
  delhi: 'north',
  uttarakhand: 'north',
  'uttar pradesh': 'north',
  rajasthan: 'north',

  // West
  goa: 'west',
  gujarat: 'west',
  maharashtra: 'west',
  'dadra and nagar haveli and daman and diu': 'west',

  // South
  'andhra pradesh': 'south',
  karnataka: 'south',
  kerala: 'south',
  'tamil nadu': 'south',
  telangana: 'south',
  puducherry: 'south',
  lakshadweep: 'south',
  'andaman and nicobar islands': 'south',

  // East
  bihar: 'east',
  jharkhand: 'east',
  odisha: 'east',
  'west bengal': 'east',
  // Central states have no enum value of their own; they sit with the eastern
  // zone, whose everyday staples (wheat, rice, mustard) are the closer match.
  'madhya pradesh': 'east',
  chhattisgarh: 'east',

  // Northeast
  'arunachal pradesh': 'northeast',
  assam: 'northeast',
  manipur: 'northeast',
  meghalaya: 'northeast',
  mizoram: 'northeast',
  nagaland: 'northeast',
  sikkim: 'northeast',
  tripura: 'northeast',
};

// Spellings, renames and short forms that already exist in stored records or
// that users type. Keys and values are both normalised form.
const STATE_ALIASES = {
  orissa: 'odisha',
  pondicherry: 'puducherry',
  'new delhi': 'delhi',
  'nct of delhi': 'delhi',
  'delhi ncr': 'delhi',
  uttaranchal: 'uttarakhand',
  'j and k': 'jammu and kashmir',
  'daman and diu': 'dadra and nagar haveli and daman and diu',
  'dadra and nagar haveli': 'dadra and nagar haveli and daman and diu',
  up: 'uttar pradesh',
  mp: 'madhya pradesh',
  hp: 'himachal pradesh',
  ap: 'andhra pradesh',
  tn: 'tamil nadu',
  wb: 'west bengal',
};

/**
 * Lowercase, spell out "&", drop punctuation, collapse whitespace.
 * "Tamil  Nadu ", "tamil-nadu" and "J & K" all have to reach a stable key.
 *
 * @param {unknown} value
 * @returns {string}
 */
function normalizeStateName(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[._\-,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolve any spelling to the normalised key used by STATE_TO_REGION.
 *
 * @param {unknown} state
 * @returns {string} normalised key, or '' for empty input
 */
function resolveStateKey(state) {
  const key = normalizeStateName(state);
  if (!key) return '';
  return STATE_ALIASES[key] || key;
}

/**
 * Derive the cuisine region for a state name.
 *
 * Returns 'other' for anything unrecognised — including every non-Indian state,
 * which is correct: 'other' is the schema default and the prompt treats it as
 * "no region signal" rather than "pick from anywhere".
 *
 * @param {unknown} state
 * @returns {'north'|'south'|'east'|'west'|'northeast'|'other'}
 */
function deriveRegionFromState(state) {
  const key = resolveStateKey(state);
  if (!key) return 'other';
  return STATE_TO_REGION[key] || 'other';
}

/**
 * Canonical display name for a state, so "tamil nadu", "TN" and "Tamil  Nadu"
 * all store as "Tamil Nadu" — otherwise the same place produces several
 * distinct stored values and the prompt text varies run to run.
 *
 * Unrecognised input is returned trimmed but otherwise untouched: the schema
 * field is free-form on purpose so users outside India can use it.
 *
 * @param {unknown} state
 * @returns {string}
 */
function canonicalizeStateName(state) {
  if (typeof state !== 'string') return '';
  const key = resolveStateKey(state);
  if (!key) return '';
  if (!STATE_TO_REGION[key]) return state.trim();

  return INDIAN_STATES.find((s) => normalizeStateName(s) === key) || state.trim();
}

module.exports = {
  INDIAN_STATES,
  deriveRegionFromState,
  canonicalizeStateName,
  normalizeStateName,
};
