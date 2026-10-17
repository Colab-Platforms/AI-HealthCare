/**
 * Deterministic audit of a generated meal.
 *
 * A prompt rule is a request to the model, not a guarantee. This runs on the
 * output and answers two different questions, kept apart on purpose:
 *
 *   hard — the meal is UNSAFE or breaks something the user told us outright:
 *          wrong diet type, Jain violation, an excluded food, an allergen.
 *          Never shown to the user; if it cannot be repaired the plan fails.
 *
 *   soft — the meal is WRONG FOR THE ROUTINE: a biryani breakfast, a 900 kcal
 *          breakfast, a dish named after the user's city, a non-Indian dish.
 *          Worth replacing, but a regional exception that survives repair is
 *          better kept than failing the whole plan over it.
 */
const { checkMealForDiet } = require('./dietGuard');
const { checkMealForJain, checkMealForAvoids } = require('./dietConstraints');
const {
  SLOT_FORBIDDEN_TERMS,
  SLOT_ALLOWED_PHRASES,
  FOREIGN_TERMS,
  slotCalorieRange,
} = require('../config/indianMealSlots');

const MAX_NAME_LENGTH = 60;

// "Authentic", "Homestyle", "X Style" etc. are menu decoration, never the dish.
const DECORATION_WORDS = 'style|special|authentic|homestyle|home-style|inspired|delight|fusion|signature';
// The dash must be a spaced separator ("Dal Baati - Jaipur Style"), not the
// hyphen inside "Jaipur-style Poha", which the location pass handles instead.
const SUFFIX_AFTER_DASH = new RegExp(`(?:\\s+[-–—]\\s+|\\s*[|:]\\s*)[^-–—|:]*\\b(?:${DECORATION_WORDS})\\b[^-–—|:]*$`, 'i');
const SUFFIX_IN_PARENS = new RegExp(`\\s*\\([^)]*\\b(?:${DECORATION_WORDS})\\b[^)]*\\)\\s*$`, 'i');
const TRAILING_DECORATION = new RegExp(`\\s+(?:${DECORATION_WORDS})$`, 'i');
const LEADING_DECORATION = new RegExp(`^(?:${DECORATION_WORDS})\\s+`, 'i');

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wholeWord(term) {
  return new RegExp(`\\b${escapeRe(term)}\\b`, 'i');
}

// Words from the user's place that must not appear in a dish name. Short
// tokens are skipped ("Goa" is fine at 3 but "UP"/"MP" would hit "upma").
function locationTokens({ city, state } = {}) {
  const tokens = new Set();
  for (const value of [city, state]) {
    if (typeof value !== 'string') continue;
    const v = value.trim();
    if (v.length < 3) continue;
    tokens.add(v.toLowerCase());
  }
  return [...tokens];
}

/**
 * Strip decoration the model adds despite being told not to: "Dal Baati -
 * Jaipur Style", "Poha (Authentic Style)", "Jaipur Special Kachori".
 * A name that would be emptied is returned untouched — a decorated name beats none.
 *
 * @param {string} name
 * @param {{city?: string, state?: string}} [location]
 * @returns {string}
 */
function sanitizeMealName(name, location = {}) {
  if (typeof name !== 'string') return name;
  let n = name.trim();

  n = n.replace(SUFFIX_AFTER_DASH, '').replace(SUFFIX_IN_PARENS, '').replace(TRAILING_DECORATION, '');

  for (const token of locationTokens(location)) {
    n = n.replace(new RegExp(`\\b${escapeRe(token)}(?:'s|-style)?\\b`, 'gi'), ' ');
  }
  n = n.replace(/\s{2,}/g, ' ').replace(/^[\s\-–—|:,]+|[\s\-–—|:,]+$/g, '').trim();
  // Removing a place can leave the decoration dangling at the front
  // ("Jaipur Special Kachori" -> "Special Kachori").
  n = n.replace(LEADING_DECORATION, '');

  return n || name.trim();
}

function findTerms(text, terms) {
  return terms.filter((t) => wholeWord(t).test(text));
}

function stripAllowedPhrases(text) {
  let out = text;
  for (const p of SLOT_ALLOWED_PHRASES) out = out.replace(wholeWord(p), ' ');
  return out;
}

/**
 * @param {object} args
 * @param {object} args.meal generated meal object
 * @param {'breakfast'|'lunch'|'dinner'} [args.slot]
 * @param {string} args.diet normalized diet type
 * @param {boolean} [args.jain] enforce Jain rules
 * @param {string[]} [args.avoidTerms] from buildAvoidTerms()
 * @param {{city?: string, state?: string}} [args.location]
 * @param {number} [args.dailyTarget] when given, the slot's calories are range-checked
 * @param {number} [args.slotTarget] when given, overrides the range check with ±25% of this budget (single-meal regen)
 * @returns {{ok: boolean, hard: string[], soft: string[]}}
 */
function checkMeal({ meal, slot, diet, jain = false, avoidTerms = [], location = {}, dailyTarget, slotTarget }) {
  const hard = [];
  const soft = [];
  if (!meal || typeof meal !== 'object') return { ok: false, hard: ['not a meal object'], soft };

  const dietCheck = checkMealForDiet(diet, meal);
  if (!dietCheck.ok) hard.push(`breaks the ${diet} diet (${dietCheck.hits.join(', ')})`);

  if (jain) {
    const j = checkMealForJain(meal);
    if (!j.ok) hard.push(`not Jain food (${j.hits.join(', ')})`);
  }

  const a = checkMealForAvoids(avoidTerms, meal);
  if (!a.ok) hard.push(`contains an excluded food (${a.hits.join(', ')})`);

  const name = typeof meal.name === 'string' ? meal.name : '';
  const nameText = name.toLowerCase();

  if (slot && SLOT_FORBIDDEN_TERMS[slot]) {
    const hits = findTerms(stripAllowedPhrases(nameText), SLOT_FORBIDDEN_TERMS[slot]);
    if (hits.length) soft.push(`not a normal Indian ${slot} (${hits.join(', ')})`);
  }

  const foreign = findTerms(nameText, FOREIGN_TERMS);
  if (foreign.length) soft.push(`not an Indian home dish (${foreign.join(', ')})`);

  const locHits = findTerms(nameText, locationTokens(location));
  if (locHits.length) soft.push(`dish name contains the user's location (${locHits.join(', ')})`);
  if (SUFFIX_AFTER_DASH.test(name) || SUFFIX_IN_PARENS.test(name) || TRAILING_DECORATION.test(name)) {
    soft.push('dish name carries menu decoration (Style/Special/Authentic)');
  }
  if (name.length > MAX_NAME_LENGTH) soft.push(`dish name is too long (${name.length} chars)`);

  const cals = Number(meal.calories);
  if (Number.isFinite(cals) && cals > 0) {
    if (slotTarget) {
      if (Math.abs(cals - slotTarget) / slotTarget > 0.25) soft.push(`calories ${Math.round(cals)} are far from the ${slotTarget} kcal budget`);
    } else if (slot && dailyTarget) {
      const { min, max } = slotCalorieRange(slot, dailyTarget);
      if (cals < min || cals > max) soft.push(`${Math.round(cals)} kcal is outside the ${min}-${max} kcal range for ${slot}`);
    }
  }

  return { ok: hard.length === 0 && soft.length === 0, hard, soft };
}

module.exports = { checkMeal, sanitizeMealName, locationTokens };
