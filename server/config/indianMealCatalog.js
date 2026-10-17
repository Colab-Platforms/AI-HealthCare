/**
 * Everyday Indian dishes by slot and place — the grounding for the diet prompt.
 *
 * Why this exists: asked for "Indian meals for a user in X", a model improvises
 * from memory and tends to reach for restaurant dishes, city-branded names and
 * festival food. A short list of what people in that region actually cook on an
 * ordinary day pulls it back to the genuine routine. The prompt presents these
 * as a reference ("draw most options from these or equally common dishes"), not
 * a closed menu, so variety and the user's own favourites still work.
 *
 * Shape: each pool has b/l/d (breakfast/lunch/dinner, vegetarian) and
 * nb/nl/nd (extra non-vegetarian). Dish names are the ordinary names — no
 * place, no "style". Resolution is state -> region -> pan-India default, and
 * every list is filtered through the same guards as the output, so a vegan
 * never sees paneer in the reference and a Jain user never sees aloo.
 */
const { canonicalizeStateName, normalizeStateName, deriveRegionFromState } = require('./indiaRegions');
const { checkMealForDiet } = require('../utils/dietGuard');
const { checkMealForJain, checkMealForAvoids } = require('../utils/dietConstraints');

const DEFAULT_POOL = {
  b: [
    'Poha with Peanuts', 'Vegetable Upma', 'Moong Dal Chilla with Green Chutney', 'Besan Chilla with Curd',
    'Idli with Sambar', 'Plain Dosa with Sambar and Chutney', 'Vegetable Dalia', 'Methi Paratha with Curd',
    'Paneer Paratha with Curd', 'Sprouts Salad with Roti', 'Vegetable Sandwich', 'Ragi Dosa with Chutney',
  ],
  l: [
    'Roti, Dal Tadka and Seasonal Sabzi with Salad', 'Rice, Dal and Bhindi Sabzi', 'Rajma Chawal with Salad',
    'Chole with Roti and Salad', 'Moong Dal Khichdi with Curd', 'Kadhi Chawal', 'Palak Paneer with Roti',
    'Mixed Vegetable Sabzi, Roti and Raita', 'Lauki Chana Dal with Roti', 'Sambar Rice with Papad',
  ],
  d: [
    'Roti with Lauki Sabzi and Dal', 'Moong Dal Khichdi with Ghee', 'Dal Palak with Roti', 'Paneer Bhurji with Roti',
    'Tinda Sabzi with Roti and Dal', 'Vegetable Dalia Khichdi', 'Methi Thepla with Curd', 'Masoor Dal with Roti and Salad',
    'Bhindi Masala with Roti and Dal', 'Mixed Vegetable Soup with Roti',
  ],
  nb: ['Egg Bhurji with Roti', 'Masala Omelette with Roti', 'Boiled Eggs with Multigrain Toast'],
  nl: ['Chicken Curry with Roti', 'Fish Curry with Rice', 'Egg Curry with Rice', 'Chicken Curry with Rice'],
  nd: ['Egg Curry with Roti', 'Tandoori Chicken with Roti and Salad', 'Light Fish Curry with Roti', 'Egg Bhurji with Roti and Sabzi'],
};

const REGION_POOLS = {
  north: {
    b: ['Aloo Paratha with Curd', 'Gobhi Paratha with Curd', 'Mooli Paratha with Curd', 'Paneer Paratha with Curd', 'Missi Roti with Curd', 'Besan Chilla with Chutney', 'Chole with Kulcha', 'Vegetable Dalia', 'Poha with Peanuts'],
    l: ['Rajma Chawal with Salad', 'Kadhi Pakora with Rice', 'Chole with Roti', 'Aloo Gobhi with Roti and Dal', 'Palak Paneer with Roti', 'Bhindi Sabzi, Dal Tadka and Roti', 'Dal Makhani with Roti'],
    d: ['Dal Tadka with Roti and Lauki Sabzi', 'Mixed Dal Khichdi with Ghee', 'Paneer Bhurji with Roti', 'Tinda Masala with Roti', 'Vegetable Pulao with Raita', 'Roti with Matar Paneer'],
    nb: ['Egg Bhurji Paratha', 'Masala Omelette with Roti'],
    nl: ['Chicken Curry with Roti', 'Fish Curry with Rice', 'Egg Curry with Rice'],
    nd: ['Tandoori Chicken with Roti and Salad', 'Chicken Curry with Roti', 'Anda Bhurji with Roti'],
  },
  south: {
    b: ['Idli with Sambar and Chutney', 'Plain Dosa with Sambar', 'Pesarattu with Ginger Chutney', 'Ven Pongal with Sambar', 'Ragi Dosa with Chutney', 'Vegetable Upma', 'Uttapam with Sambar', 'Idiyappam with Vegetable Kurma', 'Akki Roti with Chutney', 'Vermicelli Upma'],
    l: ['Rice with Sambar, Poriyal and Rasam', 'Rice with Dal and Vegetable Kootu', 'Curd Rice with Pickle and Poriyal', 'Bisi Bele Bath with Raita', 'Lemon Rice with Sundal', 'Rice with Rasam and Beans Poriyal', 'Sambar Rice with Papad'],
    d: ['Idli with Sambar', 'Dosa with Chutney', 'Chapati with Vegetable Kurma', 'Ragi Mudde with Sambar', 'Rava Upma with Chutney', 'Adai with Avial', 'Vegetable Pongal'],
    nb: ['Egg Dosa', 'Appam with Egg Roast'],
    nl: ['Fish Curry with Rice', 'Chicken Curry with Rice', 'Egg Curry with Rice'],
    nd: ['Chapati with Chicken Curry', 'Egg Curry with Chapati', 'Fish Fry (shallow) with Rice and Rasam'],
  },
  east: {
    b: ['Moong Dal Chilla', 'Ghugni with Roti', 'Poha with Peanuts', 'Vegetable Dalia', 'Sattu Paratha with Curd', 'Chura Dahi with Banana', 'Roti with Lauki Sabzi and Curd'],
    l: ['Rice, Dal and Lau Ghonto', 'Rice, Masoor Dal and Begun Bhaja', 'Rice, Dal and Mixed Vegetable Sabzi', 'Rice with Shukto and Dal', 'Dal Bhat Sabzi', 'Kadhi Bari with Rice'],
    d: ['Roti with Lau Sabzi and Dal', 'Khichdi with Mixed Vegetables', 'Roti with Potol Torkari', 'Roti with Mixed Veg and Dal'],
    nb: ['Egg Toast', 'Egg Roll (whole wheat)'],
    nl: ['Rice with Machher Jhol (Fish Curry)', 'Rice with Egg Curry', 'Rice with Chicken Curry'],
    nd: ['Roti with Egg Curry', 'Light Machher Jhol with Rice', 'Roti with Chicken Curry'],
  },
  west: {
    b: ['Kanda Poha', 'Methi Thepla with Curd', 'Khaman Dhokla', 'Thalipeeth with Curd', 'Vegetable Upma', 'Sabudana Khichdi', 'Handvo', 'Dudhi Muthia'],
    l: ['Varan Bhaat with Ghee', 'Roti, Dal and Bhindi Sabzi', 'Pithla Bhakri', 'Kadhi Khichdi', 'Rotli, Shaak and Dal', 'Usal with Chapati', 'Amti with Rice and Sabzi'],
    d: ['Bhakri with Pithla', 'Moong Dal Khichdi with Kadhi', 'Phulka with Bharli Bhendi', 'Masoor Amti with Roti', 'Dudhi Thepla with Curd'],
    nb: ['Anda Bhurji with Pav', 'Masala Omelette with Roti'],
    nl: ['Fish Curry with Rice', 'Chicken Curry with Bhakri', 'Egg Curry with Rice'],
    nd: ['Chicken Sukka with Bhakri', 'Light Fish Curry with Rice', 'Egg Curry with Roti'],
  },
  northeast: {
    b: ['Vegetable Poha', 'Roti with Mixed Vegetable Stir-fry', 'Steamed Vegetable Momos with Chutney', 'Moong Dal Chilla', 'Vegetable Dalia', 'Rice Flakes with Curd and Jaggery'],
    l: ['Rice, Dal and Aloo Pitika', 'Rice with Lai Xaak Stir-fry and Dal', 'Rice with Mixed Vegetable Curry', 'Khichdi with Seasonal Vegetables', 'Rice, Dal and Pumpkin Sabzi'],
    d: ['Vegetable Thukpa', 'Roti with Lai Xaak and Dal', 'Rice with Dal and Stir-fried Greens', 'Khichdi with Mixed Vegetables'],
    nb: ['Egg Roll (whole wheat)', 'Boiled Eggs with Toast'],
    nl: ['Rice with Fish Curry', 'Rice with Chicken Curry', 'Rice with Egg Curry'],
    nd: ['Fish Curry with Rice', 'Light Chicken Stew with Rice', 'Egg Curry with Roti'],
  },
};

// States whose everyday food differs enough from their region to be worth
// listing. Keys are normalised state names. Anything not here uses its region.
const STATE_POOLS = {
  rajasthan: {
    b: ['Bajra Roti with Curd and Chutney', 'Moong Dal Chilla with Green Chutney', 'Missi Roti with Curd', 'Poha with Peanuts', 'Besan Chilla with Chutney', 'Vegetable Dalia'],
    l: ['Gatte ki Sabzi with Roti', 'Rajasthani Kadhi with Rice', 'Dal Baati with Sabzi', 'Moong Dal with Bajra Roti', 'Lauki Chana Dal with Roti', 'Mixed Dal with Roti and Salad'],
    d: ['Bajra Khichdi with Kadhi', 'Moong Dal with Roti', 'Tinda Sabzi with Roti', 'Mixed Dal with Phulka', 'Besan Gatte with Roti'],
    nl: ['Laal Maas with Roti'], nd: ['Chicken Curry with Roti'],
  },
  gujarat: {
    b: ['Methi Thepla with Curd', 'Khaman Dhokla', 'Handvo', 'Dudhi Muthia', 'Khakhra with Chaas', 'Poha with Peanuts', 'Vegetable Upma'],
    l: ['Rotli, Shaak and Dal', 'Gujarati Dal, Rice and Bhindi Sabzi', 'Kadhi Khichdi', 'Undhiyu with Rotli', 'Dal Dhokli', 'Rotli with Ringan Bharta and Dal'],
    d: ['Khichdi with Kadhi', 'Bajra Rotla with Ringan Bharta', 'Moong Dal Khichdi with Ghee', 'Dudhi Thepla with Curd', 'Vegetable Handvo'],
    nb: [], nl: [], nd: [],
  },
  maharashtra: {
    b: ['Kanda Poha', 'Sabudana Khichdi', 'Thalipeeth with Curd', 'Upma', 'Misal with Pav (small portion)', 'Akki Roti with Chutney', 'Sheera (small portion)'],
    l: ['Varan Bhaat with Ghee', 'Bharli Vangi with Bhakri', 'Pithla Bhakri', 'Zunka Bhakri', 'Usal with Chapati', 'Amti with Rice and Sabzi'],
    d: ['Bhakri with Pithla', 'Masoor Amti with Roti', 'Moong Dal Khichdi with Kadhi', 'Phulka with Bharli Bhendi'],
    nb: ['Anda Bhurji with Pav'], nl: ['Fish Curry with Rice', 'Chicken Curry with Bhakri'], nd: ['Chicken Sukka with Bhakri', 'Light Fish Curry with Rice'],
  },
  punjab: {
    b: ['Stuffed Paratha with Curd and a little Butter', 'Besan Chilla with Chutney', 'Chole with Kulcha', 'Paneer Bhurji with Roti', 'Vegetable Dalia', 'Moong Dal Chilla'],
    l: ['Rajma Chawal', 'Kadhi Chawal', 'Sarson da Saag with Makki di Roti', 'Dal Makhani with Roti', 'Chole with Roti', 'Palak Paneer with Roti'],
    d: ['Dal Tadka with Roti', 'Palak Paneer with Roti', 'Tandoori Roti with Mixed Veg', 'Lauki Kofta with Roti', 'Mixed Dal Khichdi with Ghee'],
    nb: ['Anda Bhurji with Paratha'], nl: ['Chicken Curry with Roti'], nd: ['Tandoori Chicken with Roti and Salad', 'Fish Tikka with Roti'],
  },
  bihar: {
    b: ['Sattu Paratha with Curd', 'Chura Dahi with Banana', 'Litti Chokha (baked, small portion)', 'Poha with Peanuts', 'Moong Dal Chilla', 'Vegetable Dalia'],
    l: ['Dal Bhat Sabzi', 'Arhar Dal, Rice and Aloo Gobhi', 'Kadhi Bari with Rice', 'Litti Chokha with Dal', 'Rice, Dal and Bhindi Bhujia'],
    d: ['Roti with Dal and Sabzi', 'Khichdi with Chokha', 'Roti with Lauki Sabzi and Dal'],
    nb: ['Anda Bhurji with Roti'], nl: ['Rice with Fish Curry', 'Rice with Egg Curry'], nd: ['Roti with Egg Curry', 'Light Fish Curry with Rice'],
  },
  'west bengal': {
    b: ['Ghugni with Roti', 'Moong Dal Chilla', 'Chire Doi with Banana', 'Roti with Aloo Posto', 'Vegetable Dalia', 'Poha with Peanuts'],
    l: ['Rice, Dal and Lau Ghonto', 'Rice, Masoor Dal and Begun Bhaja', 'Rice with Shukto and Dal', 'Rice with Cholar Dal and Posto Sabzi', 'Rice, Dal and Potol Torkari'],
    d: ['Roti with Lau Sabzi and Dal', 'Khichdi with Begun Bhaja', 'Roti with Potol Torkari', 'Roti with Mixed Veg and Dal'],
    nb: ['Egg Toast', 'Egg Roll (whole wheat)'], nl: ['Rice with Machher Jhol (Fish Curry)', 'Rice with Egg Curry', 'Rice with Chicken Curry'], nd: ['Roti with Egg Curry', 'Light Machher Jhol with Rice'],
  },
  kerala: {
    b: ['Puttu with Kadala Curry', 'Appam with Vegetable Stew', 'Idiyappam with Vegetable Kurma', 'Idli with Sambar and Chutney', 'Dosa with Coconut Chutney', 'Upma with Banana'],
    l: ['Rice with Sambar, Thoran and Pickle', 'Rice with Parippu Curry and Cabbage Thoran', 'Rice with Avial and Moru Curry', 'Rice with Olan and Vegetable Thoran'],
    d: ['Chapati with Vegetable Stew', 'Idiyappam with Kadala Curry', 'Dosa with Sambar', 'Chapati with Mixed Vegetable Kurma'],
    nb: ['Appam with Egg Roast', 'Puttu with Egg Curry'], nl: ['Rice with Fish Curry (Meen Curry)', 'Rice with Chicken Curry', 'Rice with Fish Fry (shallow) and Thoran'], nd: ['Chapati with Chicken Stew', 'Appam with Fish Curry', 'Chapati with Egg Roast'],
  },
  'tamil nadu': {
    b: ['Idli with Sambar and Chutney', 'Ven Pongal with Sambar', 'Plain Dosa with Sambar', 'Uttapam with Sambar', 'Kuzhi Paniyaram with Chutney', 'Vegetable Upma', 'Ragi Koozh'],
    l: ['Rice with Sambar, Poriyal and Rasam', 'Rice with Dal and Keerai Kootu', 'Curd Rice with Pickle and Poriyal', 'Lemon Rice with Sundal', 'Rice with Vathal Kuzhambu and Poriyal'],
    d: ['Idli with Sambar', 'Dosa with Chutney', 'Chapati with Vegetable Kurma', 'Adai with Avial', 'Ragi Dosa with Chutney'],
    nb: ['Egg Dosa'], nl: ['Rice with Fish Kuzhambu', 'Rice with Chicken Curry', 'Rice with Egg Curry'], nd: ['Chapati with Chicken Curry', 'Dosa with Egg Curry'],
  },
  karnataka: {
    b: ['Idli with Sambar', 'Akki Roti with Chutney', 'Ragi Dosa with Chutney', 'Vegetable Upma', 'Vangi Bath', 'Neer Dosa with Coconut Chutney', 'Ragi Mudde with Sambar'],
    l: ['Rice with Sambar and Palya', 'Bisi Bele Bath with Raita', 'Ragi Mudde with Soppu Saaru', 'Rice with Dal and Beans Palya', 'Curd Rice with Pickle'],
    d: ['Chapati with Palya and Dal', 'Ragi Rotti with Chutney', 'Dosa with Sambar', 'Vegetable Pulao with Raita'],
    nb: ['Egg Dosa'], nl: ['Rice with Fish Curry', 'Ragi Mudde with Chicken Saaru'], nd: ['Chapati with Chicken Curry', 'Egg Curry with Chapati'],
  },
  'andhra pradesh': {
    b: ['Pesarattu with Ginger Chutney', 'Idli with Sambar and Chutney', 'Upma with Chutney', 'Ragi Dosa', 'Ven Pongal', 'Plain Dosa with Chutney'],
    l: ['Rice with Pappu (Dal) and Vegetable Curry', 'Rice with Sambar and Beans Fry', 'Rice with Tomato Pappu and Poriyal', 'Curd Rice with Pickle', 'Rice with Gongura Pappu'],
    d: ['Chapati with Vegetable Kurma', 'Pulka with Dal and Sabzi', 'Ragi Sangati with Sambar', 'Dosa with Chutney'],
    nb: ['Egg Dosa'], nl: ['Rice with Fish Pulusu', 'Rice with Chicken Curry'], nd: ['Pulka with Chicken Curry', 'Pulka with Egg Curry'],
  },
  telangana: {
    b: ['Idli with Sambar and Chutney', 'Upma with Chutney', 'Pesarattu with Chutney', 'Plain Dosa with Chutney', 'Ragi Java', 'Vegetable Poha'],
    l: ['Rice with Dal and Vegetable Curry', 'Jowar Roti with Dal and Sabzi', 'Rice with Sambar and Beans Fry', 'Sarva Pindi with Salad', 'Curd Rice with Pickle'],
    d: ['Jowar Roti with Vegetable Curry', 'Pulka with Dal and Sabzi', 'Chapati with Vegetable Kurma', 'Ragi Sangati with Sambar'],
    nb: ['Egg Dosa'], nl: ['Rice with Chicken Curry', 'Rice with Fish Curry'], nd: ['Pulka with Chicken Curry', 'Pulka with Egg Curry'],
  },
  'madhya pradesh': {
    b: ['Poha with Peanuts', 'Sabudana Khichdi', 'Dal Bafla (baked)', 'Besan Chilla with Chutney', 'Vegetable Dalia', 'Moong Dal Chilla'],
    l: ['Dal Bafla with Sabzi', 'Roti, Dal and Bhindi Sabzi', 'Kadhi Chawal', 'Bhutte ka Kees with Roti', 'Rice, Dal and Lauki Sabzi'],
    d: ['Roti with Dal and Seasonal Sabzi', 'Moong Dal Khichdi with Ghee', 'Roti with Lauki Chana Dal', 'Paneer Bhurji with Roti'],
    nb: ['Anda Bhurji with Roti'], nl: ['Chicken Curry with Roti'], nd: ['Egg Curry with Roti'],
  },
};

const PER_SLOT_LIMIT = 8;

function dedupe(list) {
  const seen = new Set();
  return list.filter((d) => {
    const k = d.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Most specific pool first: state, then region, then the pan-India default. */
function poolsFor({ state, region } = {}) {
  const pools = [];
  const stateKey = typeof state === 'string' && state.trim() ? normalizeStateName(canonicalizeStateName(state)) : '';
  if (stateKey && STATE_POOLS[stateKey]) pools.push(STATE_POOLS[stateKey]);

  // Same precedence as the prompt: a known state decides the region; the stored
  // region only matters for legacy users who never had a state.
  const resolvedRegion = stateKey ? deriveRegionFromState(state) : region;
  if (resolvedRegion && REGION_POOLS[resolvedRegion]) pools.push(REGION_POOLS[resolvedRegion]);

  pools.push(DEFAULT_POOL);
  return pools;
}

/**
 * Reference dishes per slot for this user, already filtered to what they may eat.
 *
 * @param {object} p
 * @param {string} [p.state]
 * @param {string} [p.region]
 * @param {string} p.diet normalized diet type
 * @param {boolean} [p.jain]
 * @param {string[]} [p.avoidTerms]
 * @returns {{breakfast: string[], lunch: string[], dinner: string[]}}
 */
function getReferenceDishes({ state, region, diet, jain = false, avoidTerms = [] } = {}) {
  const pools = poolsFor({ state, region });
  // Non-veg lists feed non-vegetarian users and, filtered, eggetarians (egg
  // dishes pass the eggetarian guard; meat dishes do not). Plain 'other' stays
  // vegetarian-only — nothing was said that justifies meat.
  const includeNonVeg = diet === 'non-vegetarian' || diet === 'eggetarian';

  const allowed = (name) =>
    checkMealForDiet(diet, { name }).ok &&
    (!jain || checkMealForJain({ name }).ok) &&
    checkMealForAvoids(avoidTerms, { name }).ok;

  const build = (vegKey, nonVegKey) => {
    const vegDishes = pools.flatMap((p) => p[vegKey] || []);
    const nonVegDishes = includeNonVeg ? pools.flatMap((p) => p[nonVegKey] || []) : [];
    // Interleave so a non-veg user's list is not all-veg followed by one egg dish.
    const merged = [];
    const max = Math.max(vegDishes.length, nonVegDishes.length);
    for (let i = 0; i < max; i++) {
      if (vegDishes[i]) merged.push(vegDishes[i]);
      if (nonVegDishes[i]) merged.push(nonVegDishes[i]);
    }
    return dedupe(merged).filter(allowed).slice(0, PER_SLOT_LIMIT);
  };

  return {
    breakfast: build('b', 'nb'),
    lunch: build('l', 'nl'),
    dinner: build('d', 'nd'),
  };
}

/** Prompt fragment for the whole plan; '' when every list is empty. */
function buildCatalogInstructions(args) {
  const dishes = getReferenceDishes(args);
  const lines = Object.entries(dishes)
    .filter(([, list]) => list.length)
    .map(([slot, list]) => `  ${slot}: ${list.join(' | ')}`);
  if (!lines.length) return '';
  return (
    'REFERENCE DISHES (what people actually cook and eat on an ordinary day for this user — draw at least 5 of the 7 options per slot from these or from equally common, simple home dishes of the same kind; vary the sabzi/dal/chutney so days differ; never invent fancy or fusion dishes):\n' +
    lines.join('\n')
  );
}

/** Same, for one slot (single-meal regeneration). */
function buildSlotCatalogInstructions(slot, args) {
  const list = getReferenceDishes(args)[slot] || [];
  if (!list.length) return '';
  return `Typical everyday ${slot} dishes for this user (pick one of these or an equally common, simple home dish): ${list.join(' | ')}.`;
}

module.exports = { getReferenceDishes, buildCatalogInstructions, buildSlotCatalogInstructions };
