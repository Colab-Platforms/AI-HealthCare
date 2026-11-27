/**
 * Thresholds for the meal-warnings rule engine (docs/FOOD_DB_FLOW.md sections 9.4 and 9.7).
 *
 * These are DEFAULTS from general nutrition guidance, pending nutritionist sign-off.
 * To change them without a deploy, insert an active FoodWarningConfig document holding only the
 * values to override; it is deep-merged over these defaults and cached for CONFIG_TTL_MS.
 */
const CONFIG_TTL_MS = 10 * 60 * 1000;

const DEFAULT_WARNING_CONFIG = Object.freeze({
  dailyLimits: { sodiumMg: 2300, satFatG: 20 },
  rules: {
    // All amounts are per meal (sum of the scanned dishes) unless they say "dish".
    diabetes: { carbsG: 60, sugarG: 15, giHigh: 55, giDishCarbsG: 30 },
    hypertension: { sodiumMg: 800 },
    highCholesterol: { satFatG: 7, cholesterolMg: 100, tags: ['deep_fried'] },
    heartDisease: { sodiumMg: 800, satFatG: 7, tags: ['deep_fried'] },
    pcos: { giHigh: 60, giDishCarbsG: 20, refinedSugarG: 10 },
    thyroid: { tags: ['goitrogen'] },
    gutHealth: { tags: ['deep_fried', 'spicy'] },
    kidney: { sodiumMg: 800, potassiumMg: 800 },
    medications: { vitaminKUg: 90, potassiumMg: 1000 },
  },
  maxConditionWarnings: 2,
});

const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

function deepMerge(base, override) {
  if (!isPlainObject(override)) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = isPlainObject(v) && isPlainObject(base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

let cache = { config: null, loadedAt: 0 };

/** Active config merged over the defaults. Never throws: falls back to the defaults. */
async function getWarningConfig() {
  if (cache.config && Date.now() - cache.loadedAt < CONFIG_TTL_MS) return cache.config;
  let config = DEFAULT_WARNING_CONFIG;
  try {
    const FoodWarningConfig = require('../../models/FoodWarningConfig');
    const active = await FoodWarningConfig.findOne({ isActive: true }).sort({ version: -1 }).lean();
    if (active?.config) config = deepMerge(DEFAULT_WARNING_CONFIG, active.config);
  } catch (err) {
    console.error('[foodWarnings] could not load FoodWarningConfig, using defaults:', err.message);
  }
  cache = { config, loadedAt: Date.now() };
  return config;
}

function invalidateWarningConfig() {
  cache = { config: null, loadedAt: 0 };
}

module.exports = { DEFAULT_WARNING_CONFIG, getWarningConfig, invalidateWarningConfig, deepMerge };
