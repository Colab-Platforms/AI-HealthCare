/**
 * Hard constraints on what a user may be served, beyond veg/non-veg:
 * Jain food, personal exclusions, allergies.
 *
 * Jain is a DIET TYPE ('jain' in profile.dietaryPreference), not a tag. It used
 * to be a free-text entry beside the diet type, and the two disagreed in both
 * directions: a user who moved from Jain to non-veg kept getting Jain food
 * (the stale tag still went into the prompt), and a non-veg user who typed
 * "Jain" was ignored. Two inputs for one fact will always conflict, so now
 * there is one: the diet type alone decides, and a Jain free-text tag on any
 * other diet is ignored. Whatever the user picks is the only thing served —
 * nothing is mixed.
 *
 * Pure functions only, so it is unit-testable and every generation path can
 * share one implementation.
 */

const JAIN_RE = /\bjain(?:ism|s)?\b/i;
const JAIN_DIET = 'jain';

// Jain food excludes onion/garlic and root vegetables, plus mushrooms and fresh
// ginger. Whole-word, lowercase, English + the Hindi/Marathi names that appear
// in dish names ("Kanda Poha", "Lasun Chutney").
const JAIN_FORBIDDEN_TERMS = [
  'onion', 'onions', 'kanda', 'pyaaz', 'pyaz', 'garlic', 'lehsun', 'lasun', 'lasuni',
  'potato', 'potatoes', 'aloo', 'batata', 'carrot', 'carrots', 'gajar',
  'radish', 'mooli', 'beetroot', 'beet', 'turnip', 'shalgam', 'sweet potato', 'shakarkandi',
  'colocasia', 'arbi', 'yam', 'suran', 'jimikand', 'ginger', 'adrak', 'mushroom', 'mushrooms',
];
// Dried ginger (sonth) is permitted in Jain cooking.
const JAIN_ALLOWED_PHRASES = ['sonth', 'dry ginger', 'dried ginger', 'ginger powder', 'ginger-free', 'onion-free', 'garlic-free'];

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isJainTag(value) {
  return typeof value === 'string' && JAIN_RE.test(value);
}

function isJainDiet(diet) {
  return diet === JAIN_DIET;
}

// Every free-text list a stray "Jain" tag can live in.
const TAG_LISTS = ['dietaryRestrictions', 'dietaryDo', 'dietaryDont', 'preferredFoods', 'foodsToAvoid'];
const MEAL_SLOTS = ['breakfast', 'lunch', 'snacks', 'dinner'];

function toPlainPrefs(foodPreferences) {
  if (!foodPreferences) return {};
  return typeof foodPreferences.toObject === 'function' ? foodPreferences.toObject() : foodPreferences;
}

/**
 * Settle Jain for one generation: the diet type decides.
 *
 *   diet === 'jain'  -> Jain rules are enforced; the preferences are untouched
 *                       (a rejected "Jain ..." dish in foodsToAvoid stays rejected).
 *   any other diet   -> every free-text Jain tag is removed, so it can neither
 *                       reach a prompt nor be enforced by a guard.
 *
 * Returns a new object — the input is never mutated, because the caller may be
 * holding a cached lean user shared across requests (see middleware/auth).
 *
 * @param {string} diet normalized diet type
 * @param {object} foodPreferences
 * @returns {{ prefs: object, jain: boolean, dropped: string[] }}
 */
function reconcileFoodPreferences(diet, foodPreferences) {
  const prefs = { ...toPlainPrefs(foodPreferences) };
  if (isJainDiet(diet)) return { prefs, jain: true, dropped: [] };

  const dropped = [];
  const strip = (list) =>
    Array.isArray(list)
      ? list.filter((v) => {
          if (isJainTag(v)) { dropped.push(v); return false; }
          return true;
        })
      : list;

  for (const k of TAG_LISTS) {
    if (Array.isArray(prefs[k])) prefs[k] = strip(prefs[k]);
  }
  if (prefs.mealPreferences) {
    prefs.mealPreferences = { ...prefs.mealPreferences };
    for (const s of MEAL_SLOTS) {
      if (Array.isArray(prefs.mealPreferences[s])) prefs.mealPreferences[s] = strip(prefs.mealPreferences[s]);
    }
  }
  return { prefs, jain: false, dropped };
}

// "No dairy" has to catch paneer and ghee, and "No eggs" has to catch omelette:
// the user means the food group, but a dish name only contains the member.
const GROUP_EXPANSIONS = {
  dairy: ['milk', 'paneer', 'curd', 'dahi', 'ghee', 'butter', 'cheese', 'cream', 'yogurt', 'yoghurt', 'lassi', 'chaas', 'buttermilk', 'raita', 'khoya', 'mawa'],
  egg: ['egg', 'eggs', 'omelette', 'omelet', 'anda'],
  nut: ['peanut', 'peanuts', 'almond', 'almonds', 'cashew', 'cashews', 'walnut', 'walnuts', 'pistachio', 'pistachios', 'moongfali', 'nuts'],
  gluten: ['wheat', 'roti', 'chapati', 'phulka', 'paratha', 'atta', 'maida', 'bread', 'naan', 'semolina', 'suji', 'rava', 'sooji', 'dalia', 'daliya', 'toast', 'thepla', 'puri', 'bhatura', 'kulcha', 'vermicelli', 'seviyan', 'sandwich', 'upma'],
  onion: ['onion', 'onions', 'kanda', 'pyaaz', 'pyaz'],
  garlic: ['garlic', 'lehsun', 'lasun'],
  tomato: ['tomato', 'tomatoes', 'tamatar'],
  potato: ['potato', 'potatoes', 'aloo', 'batata'],
};
const GROUP_ALIASES = { eggs: 'egg', nuts: 'nut', tomatoes: 'tomato', potatoes: 'potato', onions: 'onion', 'dairy product': 'dairy', 'dairy products': 'dairy' };

const NEGATION_PREFIX = /^(?:no|avoid|without|exclude|excluding|never|dont eat|don't eat|do not eat|dont use|don't use|do not use)\s+/i;

const DISH_PREFIX = 'dish:';

/**
 * Comparable form of a dish name: lowercase, parentheticals and a spaced
 * "- Alibag Style" tail removed, punctuation flattened. Both the stored
 * rejection and the new meal go through it, so decoration cannot hide a match.
 */
function normalizeDishName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s[-–—]\s.*$/, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function singularVariants(term) {
  const out = new Set([term]);
  if (term.endsWith('ies') && term.length > 4) out.add(`${term.slice(0, -3)}y`);
  if (term.endsWith('es') && term.length > 4) out.add(term.slice(0, -2));
  if (term.endsWith('s') && term.length > 3) out.add(term.slice(0, -1));
  return [...out];
}

/**
 * Turn the user's free-text exclusions into matchable terms.
 *
 * Instruction-shaped entries ("No eating after 8pm") are skipped on purpose:
 * they are not ingredients, would never match a dish name, and are already in
 * the prompt for the model to follow.
 *
 * @param {{foodsToAvoid?: string[], dietaryDont?: string[], dietaryRestrictions?: string[], allergies?: string[]}} src
 * @returns {string[]} lowercase terms, deduped
 */
function buildAvoidTerms({ foodsToAvoid = [], dietaryDont = [], dietaryRestrictions = [], allergies = [] } = {}) {
  const terms = new Set();
  // A rejected dish is stored under its full generated name ("Surmai Curry with
  // Steamed Rice and Koshimbir - Alibag Coastal Style"). Too long to be an
  // ingredient keyword, so it is matched as a whole dish instead — against the
  // normalised name, because the same dish now comes back without the suffix.
  const addDish = (raw) => {
    if (typeof raw !== 'string') return;
    const n = normalizeDishName(raw);
    if (n.split(' ').length >= 2) terms.add(`${DISH_PREFIX}${n}`);
  };
  const add = (raw) => {
    if (typeof raw !== 'string') return;
    let t = raw.trim().toLowerCase().replace(NEGATION_PREFIX, '').replace(/[-\s]?free$/, '').trim();
    if (!t || t.length > 40 || t.split(/\s+/).length > 4) return;
    t = GROUP_ALIASES[t] || t;
    const group = GROUP_EXPANSIONS[t] || GROUP_EXPANSIONS[t.replace(/s$/, '')];
    if (group) group.forEach((g) => terms.add(g));
    else singularVariants(t).forEach((v) => terms.add(v));
  };

  foodsToAvoid.forEach((v) => (typeof v === 'string' && v.trim().split(/\s+/).length > 4 ? addDish(v) : add(v)));
  dietaryDont.forEach(add);
  allergies.forEach(add);
  // Only the "<thing>-free" style entries are matchable; "Low Sodium" is a target.
  dietaryRestrictions.filter((r) => typeof r === 'string' && /-?\s?free$/i.test(r.trim())).forEach(add);
  return [...terms];
}

function mealText(meal, { includeDescription = false } = {}) {
  return [
    meal?.name,
    includeDescription ? meal?.description : '',
    Array.isArray(meal?.ingredients) ? meal.ingredients.join(' ') : meal?.ingredients,
    Array.isArray(meal?.foodItems) ? meal.foodItems.map((f) => f?.name).join(' ') : '',
  ].filter(Boolean).join(' ').toLowerCase();
}

function stripPhrases(text, phrases) {
  let out = text;
  for (const p of phrases) out = out.replace(new RegExp(`\\b${escapeRe(p)}\\b`, 'gi'), ' ');
  return out;
}

// Name + ingredients only, never the description: "prepared without onion" in a
// description would otherwise reject the very dish that complies.

/** @returns {{ok: boolean, hits: string[]}} */
function checkMealForJain(meal) {
  const text = stripPhrases(mealText(meal), JAIN_ALLOWED_PHRASES);
  const hits = JAIN_FORBIDDEN_TERMS.filter((t) => new RegExp(`\\b${escapeRe(t)}\\b`).test(text));
  return { ok: hits.length === 0, hits };
}

/** @returns {{ok: boolean, hits: string[]}} */
function checkMealForAvoids(terms, meal) {
  if (!terms?.length) return { ok: true, hits: [] };
  const text = mealText(meal);
  const dishName = normalizeDishName(meal?.name || '');
  const hits = terms.filter((t) => {
    if (t.startsWith(DISH_PREFIX)) {
      const dish = t.slice(DISH_PREFIX.length);
      // Same dish = nearly the same words ("X" vs "X and Papad"). Overlap is
      // measured against the LONGER name, so a short dish that merely appears
      // inside a rejected one ("Steamed Rice") is not blocked.
      if (dishName === dish) return true;
      const a = new Set(dishName.split(' '));
      const b = new Set(dish.split(' '));
      const common = [...a].filter((w) => b.has(w)).length;
      return common / Math.max(a.size, b.size) >= 0.8;
    }
    return new RegExp(`\\b${escapeRe(t)}\\b`).test(text);
  });
  return { ok: hits.length === 0, hits: hits.map((h) => h.replace(DISH_PREFIX, '')) };
}

module.exports = {
  isJainTag,
  isJainDiet,
  reconcileFoodPreferences,
  buildAvoidTerms,
  checkMealForJain,
  checkMealForAvoids,
  mealText,
  JAIN_FORBIDDEN_TERMS,
};
