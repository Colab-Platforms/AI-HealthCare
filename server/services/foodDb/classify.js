/**
 * Rules that fill fields a source file (or the AI fallback) does not have (docs/FOOD_DB_FLOW.md section 4.5).
 *  - Anuvaad foods have no ingredient list → classified from the food NAME (keywords).
 *  - Independent-schema dishes have recipe lines → allergens/tags from INGREDIENT IDs,
 *    plus the same name keywords (union) for things a recipe cannot show (e.g. deep frying).
 * Everything produced here is recorded in dataQuality.estimatedFields by the build script.
 */
const { normalize } = require('./normalize');

// ── keyword helper ──────────────────────────────────────────────────────────
// Keywords are written in normalised form (lowercase, singular, folded spellings).
const padded = (name) => ` ${normalize(name)} `;
const hasAny = (p, words) => words.some((w) => p.includes(` ${w} `));

// ── keyword lists ───────────────────────────────────────────────────────────
const KW = {
  meat: ['chicken', 'mutton', 'lamb', 'goat', 'meat', 'keema', 'pork', 'beef', 'ham', 'bacon', 'sausage',
    'salami', 'liver', 'gosht', 'murgh', 'nihari', 'haleem', 'paya', 'trotter', 'kaleji', 'gushtaba', 'rista',
    'rogan josh', 'laal maa', 'turkey', 'duck'],
  fish: ['fish', 'tuna', 'salmon', 'pomfret', 'rohu', 'surmai', 'basa', 'sardine', 'mackerel', 'bangda', 'hilsa',
    'machli', 'machhli', 'cod', 'anchovy', 'bombil', 'rawas', 'katla'],
  shellfish: ['prawn', 'shrimp', 'crab', 'lobster', 'jhinga', 'squid', 'calamari', 'oyster', 'mussel', 'clam'],
  egg: ['egg', 'omelette', 'anda', 'mayonnaise', 'mayo', 'meringue', 'eclair', 'souffle', 'flan', 'aigrette'],
  dairy: ['milk', 'curd', 'yogurt', 'dahi', 'paneer', 'cheese', 'butter', 'ghee', 'cream', 'khoa', 'mawa', 'malai',
    'kheer', 'payasam', 'payesh', 'rabri', 'rabdi', 'kulfi', 'lassi', 'chaas', 'buttermilk', 'raita', 'shrikhand',
    'rasmalai', 'rasgulla', 'sandesh', 'chhena', 'kalakand', 'peda', 'barfi', 'basundi', 'custard', 'milkshake',
    'shake', 'latte', 'cappuccino', 'coffee', 'tea', 'chai', 'cheesecake', 'creamy', 'makhani', 'gulab jamun',
    'phirni', 'firni', 'doodh', 'ice cream', 'sundae', 'thandai', 'kadhi', 'pudding', 'mousse', 'korma'],
  noMilkTea: ['black tea', 'green tea', 'lemon tea', 'black coffee', 'herbal tea', 'iced tea', 'ice tea'],
  treeNuts: ['almond', 'badam', 'cashew', 'kaju', 'walnut', 'akhrot', 'pistachio', 'pista', 'nut', 'dry fruit',
    'dryfruit', 'hazelnut', 'pecan', 'praline', 'marzipan'],
  peanut: ['peanut', 'chikki'],
  gluten: ['wheat', 'atta', 'maida', 'roti', 'chapati', 'paratha', 'puri', 'naan', 'kulcha', 'bhatura', 'thepla',
    'bread', 'toast', 'sandwich', 'burger', 'pizza', 'pasta', 'spaghetti', 'macaroni', 'lasagne', 'lasagna',
    'noodle', 'chowmein', 'vermicelli', 'semiya', 'sevai', 'seviyan', 'suji', 'sooji', 'rava', 'rawa', 'semolina',
    'upma', 'dalia', 'biscuit', 'cookie', 'cake', 'pastry', 'muffin', 'pie', 'tart', 'puff', 'pancake', 'waffle',
    'croissant', 'bun', 'pav', 'rusk', 'khakhra', 'mathri', 'samosa', 'kachori', 'momo', 'spring roll',
    'manchurian', 'crumb', 'cutlet', 'patty', 'jalebi', 'balushahi', 'shakarpara', 'namak para', 'gujiya',
    'gunjia', 'malpua', 'doughnut', 'luchi', 'missi', 'rumali', 'parotta', 'tortilla', 'pita', 'scone',
    'swiss roll', 'gingerman', 'gingerbread', 'tukra', 'tukda', 'kathi', 'kaathi', 'frankie', 'hot dog',
    'barley', 'dumpling', 'crouton', 'straw', 'horn', 'golgappa', 'pani puri', 'sev puri',
    'dahi puri', 'bhel', 'papdi', 'pasta'],
  soy: ['soy', 'soya', 'tofu', 'soybean'],
  sesame: ['til', 'sesame', 'gajak', 'gingelly', 'tahini', 'rewari', 'revdi'],
  mustard: ['mustard', 'sarson', 'kasundi'],
  eggless: ['eggless', 'egg free', 'without egg', 'vegetarian egg', 'vegeterian egg', 'vegetarian scotch egg',
    'vegeterian scotch egg', 'mayonnaise without egg'],
  noOnionGarlic: ['jain', 'without onion', 'no onion', 'satvik', 'sattvik'],
  onionGarlic: ['onion', 'pyaz', 'pyaaz', 'garlic', 'lahsun', 'lehsun', 'lasun', 'do pyaza', 'dopiaza', 'spring onion'],
  rootVeg: ['potato', 'aloo', 'carrot', 'gajar', 'radish', 'mooli', 'beetroot', 'beet', 'chukandar', 'sweet potato',
    'shakarkandi', 'arbi', 'colocasia', 'yam', 'suran', 'jimikand', 'turnip', 'shalgam', 'ginger', 'adrak'],

  deepFried: ['pakora', 'samosa', 'kachori', 'puri', 'bhatura', 'vada', 'bonda', 'jalebi', 'gulab jamun', 'malpua',
    'namak para', 'mathri', 'chakli', 'murukku', 'kofta', 'nugget', 'fritter', 'spring roll', 'koliwada',
    'manchurian', 'deep fried', 'fry', 'frie', 'chip', 'sev', 'boondi', 'balushahi', 'shakarpara', 'gujiya',
    'gunjia', 'luchi', 'golgappa', 'pani puri', 'crispy', 'mulik', 'aigrette', 'doughnut', 'chakri', 'kurkure',
    'lollipop', 'pakoda'],
  fried: ['fried', 'cutlet', 'tikki', 'shallow fried', 'pan fried', 'tawa fry', 'chop', 'croquette'],
  notFried: ['stir fry', 'stir fried', 'fried rice', 'air fried', 'chop suey', 'baked'],
  gheeHeavy: ['ghee', 'makhani', 'butter', 'malai', 'shahi', 'korma', 'nihari', 'pasanda', 'mughlai', 'rich',
    'cream', 'creamy', 'biryani', 'halwa', 'lababdar', 'rezala', 'khurchan', 'kalia'],
  spicy: ['chilli', 'mirchi', 'mirch', 'schezwan', 'vindaloo', 'chettinad', 'kolhapuri', 'laal maa', 'pepper',
    'achari', 'hot sour', 'thecha', 'andhra', 'chatpata', 'tikha', 'spicy', '65', 'jalfrezi', 'xacuti', 'peri peri',
    'piri piri', 'sukka'],
  rice: ['rice', 'biryani', 'pulao', 'khichdi', 'idli', 'dosa', 'uttapam', 'appam', 'puttu', 'poha', 'idiyappam',
    'murmura', 'bhel', 'pongal', 'paniyaram', 'bisi bele bath', 'risotto'],
  wholeGrainRice: ['brown rice', 'red rice', 'khichdi', 'pongal'],
  refinedCarb: ['maida', 'bread', 'toast', 'sandwich', 'burger', 'pizza', 'naan', 'kulcha', 'bhatura', 'pav', 'bun',
    'croissant', 'cake', 'pastry', 'biscuit', 'cookie', 'muffin', 'doughnut', 'pasta', 'spaghetti', 'macaroni',
    'noodle', 'chowmein', 'sabudana', 'suji', 'rava', 'semolina', 'upma', 'jalebi', 'candy', 'cornflake',
    'rusk', 'puff', 'momo', 'vermicelli', 'semiya', 'luchi', 'rumali'],
  redMeat: ['mutton', 'lamb', 'goat', 'beef', 'pork', 'gosht', 'ham', 'bacon', 'sausage', 'salami', 'nihari',
    'rogan josh', 'laal maa', 'paya', 'trotter', 'gushtaba', 'rista', 'kaleji'],
  processed: ['sausage', 'salami', 'ham', 'bacon', 'nugget', 'instant', 'canned', 'tinned', 'processed',
    'cornflake', 'hot dog', 'cheese spread', 'ketchup', 'mayonnaise', 'jam', 'squash', 'cola', 'chip', 'packaged'],
  goitrogen: ['soy', 'soya', 'tofu', 'cabbage', 'cauliflower', 'gobhi', 'broccoli', 'kale', 'sarson', 'mustard green',
    'radish', 'mooli', 'turnip', 'shalgam', 'brussels sprout', 'kohlrabi', 'ganth gobhi', 'knol khol'],

  indoChinese: ['manchurian', 'chowmein', 'fried rice', 'schezwan', 'chilli chicken', 'chilli paneer', 'hakka',
    'spring roll', 'chop suey', 'sweet corn soup', 'hot sour', 'talaumein', 'momo', 'dimsum', 'sweet sour',
    'chinese', 'chilli potato', 'chilli mushroom', 'dragon'],
  global: ['pasta', 'spaghetti', 'macaroni', 'lasagne', 'lasagna', 'pizza', 'burger', 'hot dog', 'sandwich', 'cake',
    'muffin', 'pancake', 'waffle', 'pudding', 'custard', 'souffle', 'mousse', 'aspic', 'chowder', 'consomme',
    'cream of', 'minestrone', 'coleslaw', 'croissant', 'scone', 'pie', 'tart', 'eclair', 'meringue', 'brownie',
    'cookie', 'sundae', 'french', 'italian', 'mexican', 'risotto', 'casserole', 'au gratin', 'gratin', 'bolognese',
    'quiche', 'continental', 'stew', 'roast', 'steak', 'bake', 'baked', 'sauce', 'cheese straw', 'swiss roll',
    'trifle', 'flan', 'jelly', 'biscuit', 'gingerman', 'salad', 'mashed', 'fritter', 'hot pot', 'canape',
    'aigrette', 'tortilla', 'nachos', 'hummus', 'falafel', 'pita', 'smoothie'],
};

// ── category rules (first match wins) ───────────────────────────────────────
const CATEGORY_RULES = [
  ['soup', ['soup', 'consomme', 'shorba', 'rasam', 'stock', 'broth', 'chowder', 'bisque', 'thukpa', 'talaumein', 'mulligatawny', 'minestrone']],
  ['raita or curd side', ['raita', 'pachadi']],
  ['beverage', ['infused water', 'water', 'mintade', 'lem o gin', 'gingo']],
  ['dessert', ['ice cream', 'mal pua', 'chum chum', 'cham cham', 'rajbhog', 'dil bahar', 'chhena poda', 'chenna murki',
    'pavlova', 'gateau', 'icing', 'frosting', 'fool', 'whip', 'bavarian', 'charlotte', 'snowball', 'sundae',
    'butterscotch', 'shahi tukre', 'putharekulu', 'dessert', 'curd filling']],
  ['chutney or condiment', ['preserve', 'baghar', 'puree', 'spice blend', 'masala powder']],
  ['chutney or condiment', ['chutney', 'pickle', 'pickled', 'achar', 'achaar', 'sauce', 'dip', 'jam', 'ketchup', 'mayonnaise', 'dressing', 'relish', 'murabba', 'marmalade', 'thecha', 'podi', 'gunpowder', 'salsa', 'peanut butter', 'spread', 'chunda', 'gulkand']],
  ['salad', ['salad', 'kachumber', 'coleslaw', 'slaw', 'aspic', 'koshimbir']],
  ['beverage', ['tea', 'chai', 'coffee', 'lassi', 'shake', 'milkshake', 'smoothie', 'juice', 'sharbat', 'sherbet', 'punch', 'lemonade', 'nimbu pani', 'cooler', 'drink', 'squash', 'mocktail', 'thandai', 'jaljeera', 'jal jeera', 'panna', 'chaas', 'buttermilk', 'cocoa', 'hot chocolate', 'soda', 'latte', 'cappuccino', 'kadha', 'kanji', 'nectar', 'cola', 'float', 'frappe', 'eggnog', 'falooda']],
  ['dessert', ['halwa', 'kheer', 'payasam', 'payesh', 'ladoo', 'barfi', 'pudding', 'custard', 'ice cream', 'kulfi', 'cake', 'pastry', 'gulab jamun', 'jalebi', 'rasgulla', 'rasmalai', 'sandesh', 'shrikhand', 'phirni', 'firni', 'mousse', 'souffle', 'trifle', 'jelly', 'kesari', 'gajak', 'chikki', 'peda', 'malpua', 'rabri', 'rabdi', 'sheera', 'tart', 'brownie', 'sundae', 'meringue', 'eclair', 'flan', 'fudge', 'toffee', 'candy', 'mithai', 'meetha', 'gujiya', 'gunjia', 'balushahi', 'shakarpara', 'basundi', 'kalakand', 'modak', 'pie', 'doughnut', 'sorbet', 'compote', 'stewed', 'mishti', 'pithe', 'puran poli', 'tukra', 'tukda', 'swiss roll', 'cupcake', 'cheesecake', 'parfait', 'praline', 'marzipan', 'shahi tukda', 'sewaiyan', 'cream horn', 'gingerman', 'gingerbread', 'chocolate']],
  ['bakery', ['biscuit', 'cookie', 'bun', 'rusk', 'scone', 'croissant', 'muffin', 'bread roll', 'straw', 'loaf', 'crouton', 'cracker', 'melting moment', 'ginger bread']],
  ['soup', ['canjee', 'kanjee']],
  ['plain rice', []], // handled specially below
  ['one-dish meal or breakfast item', ['rice', 'biryani', 'pulao', 'khichdi', 'poha', 'upma', 'idli', 'dosa', 'uttapam', 'appam', 'puttu', 'pesarattu', 'cheela', 'chilla', 'pancake', 'waffle', 'porridge', 'dalia', 'oat', 'oatmeal', 'cornflake', 'muesli', 'cereal', 'granola', 'sandwich', 'pasta', 'spaghetti', 'macaroni', 'lasagne', 'lasagna', 'noodle', 'chowmein', 'pizza', 'burger', 'hot dog', 'wrap', 'pav bhaji', 'chole bhatura', 'bisi bele bath', 'bath', 'pongal', 'risotto', 'casserole', 'hot pot', 'thali', 'misal', 'sabudana', 'paniyaram', 'idiyappam', 'french toast', 'quiche', 'bolognese', 'au gratin', 'gratin', 'pulav', 'tahari', 'tahar', 'bisibele', 'semiya', 'vermicelli', 'chop suey', 'moussaka',
    'murmura', 'puffed', 'flake', 'penne']],
  ['egg dish', []], // handled specially below
  ['meat or fish', []], // handled specially below
  ['flatbread', ['roti', 'chapati', 'paratha', 'naan', 'kulcha', 'puri', 'bhatura', 'thepla', 'missi', 'makki', 'bhakri', 'luchi', 'rumali', 'parotta', 'poli', 'bhakhri', 'rotla', 'tortilla', 'pita', 'khakhra', 'dhebra', 'kachori roti']],
  ['vegetable or paneer dish', ['french bean', 'green bean', 'cluster bean', 'broad bean', 'string bean']],
  ['lentil or legume dish', ['dal', 'sambar', 'chole', 'chana', 'rajma', 'lobia', 'moong', 'masoor', 'urad', 'kadhi', 'sprout', 'sprouted', 'usal', 'amti', 'ghugni', 'sundal', 'bean', 'chickpea', 'lentil', 'pulse', 'kulthi', 'matki', 'dhansak', 'panchmel', 'besan', 'gatte', 'hummus', 'moth', 'dalma']],
  ['snack', ['pakora', 'samosa', 'kachori', 'tikki', 'cutlet', 'vada', 'bonda', 'chaat', 'bhel', 'pani puri', 'golgappa', 'sev puri', 'dahi puri', 'dhokla', 'khandvi', 'mathri', 'namak para', 'chip', 'frie', 'nugget', 'roll', 'frankie', 'kathi', 'kaathi', 'momo', 'spring roll', 'toast', 'popcorn', 'chivda', 'chiwda', 'mixture', 'namkeen', 'sev', 'muthia', 'handvo', 'patty', 'puff', 'finger', 'nachos', 'fritter', 'mulik', 'kebab', 'tikka', 'manchurian', 'croquette', 'bite', 'canape', 'chop', 'falafel', 'aigrette', 'horn', 'shell', 'pattice', 'papdi', 'makhana', 'murukku', 'chakli', 'cheese ball']],
  ['vegetable or paneer dish', ['sabzi', 'bhaji', 'curry', 'masala', 'kofta', 'paneer', 'aloo', 'gobhi', 'bhindi', 'baingan', 'palak', 'saag', 'methi', 'matar', 'mushroom', 'korma', 'jalfrezi', 'bharta', 'poriyal', 'thoran', 'avial', 'kootu', 'stir fry', 'stuffed', 'vegetable', 'veg', 'lauki', 'tinda', 'karela', 'tori', 'kaddu', 'arbi', 'kathal', 'cabbage', 'capsicum', 'cauliflower', 'potato', 'carrot', 'pea', 'spinach', 'tofu', 'soya', 'kadhai', 'makhani', 'pasanda', 'bhurji', 'steak', 'stew', 'mashed', 'pumpkin', 'gourd', 'beetroot', 'brinjal', 'okra', 'corn', 'jackfruit', 'yam', 'sarson', 'dum', 'bhujia', 'sajina', 'broccoli',
    'yakhni']],
];

const MEAT_CURRY = ['curry', 'gravy', 'masala', 'korma', 'stew', 'kadhai', 'karahi', 'makhani', 'butter', 'rogan josh',
  'do pyaza', 'dopiaza', 'vindaloo', 'xacuti', 'kalia', 'salan', 'qorma', 'nihari', 'haleem', 'keema', 'jhol',
  'moilee', 'molee', 'yakhni', 'gushtaba', 'rista', 'kofta', 'saag', 'methi', 'chettinad', 'kolhapuri', 'handi',
  'tariwala', 'rezala', 'laal maa', 'paya', 'dhansak', 'shahi', 'malai', 'mughlai', 'lababdar', 'tikka masala'];
const BREAKFAST_ITEMS = ['poha', 'upma', 'idli', 'dosa', 'uttapam', 'appam', 'puttu', 'pesarattu', 'cheela', 'chilla',
  'pancake', 'waffle', 'porridge', 'dalia', 'oat', 'oatmeal', 'cornflake', 'muesli', 'cereal', 'granola', 'sandwich',
  'toast', 'french toast', 'sabudana', 'pongal', 'bath', 'idiyappam', 'paniyaram', 'semiya', 'vermicelli',
  'flake', 'murmura', 'puffed'];
const SWEET_BREAKFAST = ['pancake', 'waffle', 'porridge', 'oat', 'oatmeal', 'cornflake', 'muesli', 'cereal', 'granola', 'french toast'];
const PLAIN_RICE_TOKENS = new Set(['plain', 'steamed', 'boiled', 'white', 'brown', 'red', 'basmati', 'rice', 'cooked', 'jeera', 'parboiled']);

function isMeatName(p) { return hasAny(p, KW.meat) || hasAny(p, KW.fish) || hasAny(p, KW.shellfish); }
function isEggName(p) { return hasAny(p, ['egg', 'omelette', 'anda']) && !hasAny(p, KW.eggless); }

function categoryFromName(name) {
  const p = padded(name);
  const toks = normalize(name).split(' ').filter(Boolean);
  for (const [cat, words] of CATEGORY_RULES) {
    if (cat === 'plain rice') {
      if (toks.includes('rice') && toks.every((t) => PLAIN_RICE_TOKENS.has(t))) return 'plain rice';
      continue;
    }
    if (cat === 'egg dish') {
      if (isEggName(p) && !isMeatName(p)) return 'egg dish';
      continue;
    }
    if (cat === 'meat or fish') {
      if (isMeatName(p)) return hasAny(p, MEAT_CURRY) ? 'meat or fish curry' : 'meat or fish (dry)';
      continue;
    }
    if (cat === 'beverage') {
      // "milk" only counts as a drink when it ends a short name: "badam milk", "turmeric milk".
      const milkDrink = (toks[toks.length - 1] === 'milk' || toks[toks.length - 1] === 'doodh') && toks.length <= 3;
      const notDrink = hasAny(p, ['cake', 'biscuit', 'cookie', 'sandwich', 'bun', 'bread', 'pudding', 'mousse',
        'custard', 'souffle', 'ice cream', 'kulfi', 'barfi', 'ladoo', 'halwa', 'kheer', 'jelly', 'tart', 'pie', 'fudge']);
      if (!notDrink && (milkDrink || hasAny(p, words))) return 'beverage';
      continue;
    }
    if (cat === 'dessert' && isMeatName(p)) continue; // "chicken pie" is not a dessert
    if (hasAny(p, words)) return cat;
  }
  return 'other';
}

const COURSE_BY_CATEGORY = {
  soup: 'side', 'raita or curd side': 'side', salad: 'side', 'chutney or condiment': 'condiment',
  dessert: 'dessert', bakery: 'snack', snack: 'snack', beverage: 'drink', flatbread: 'main',
};

function mealSlotsFor(category, p) {
  switch (category) {
    case 'beverage': return ['breakfast', 'snack'];
    case 'bakery': return ['breakfast', 'snack'];
    case 'snack': return ['snack'];
    case 'dessert': return ['lunch', 'dinner', 'snack'];
    case 'flatbread':
    case 'egg dish': return ['breakfast', 'lunch', 'dinner'];
    case 'one-dish meal or breakfast item':
      return hasAny(p, BREAKFAST_ITEMS) ? ['breakfast', 'snack'] : ['lunch', 'dinner'];
    case 'other': return ['lunch', 'dinner', 'snack'];
    default: return ['lunch', 'dinner'];
  }
}

function cuisineFromName(p) {
  if (hasAny(p, KW.indoChinese)) return 'indo_chinese';
  if (hasAny(p, KW.global)) return 'global';
  return 'indian';
}

// ── name-based allergens / diet / tags ──────────────────────────────────────
function hasDairy(p) {
  if (hasAny(p, KW.noMilkTea)) return false;
  const pb = p.replace(/ peanut butter /g, ' ');
  return hasAny(pb, KW.dairy);
}

function allergensFromName(name, cuisine) {
  const p = padded(name);
  const out = new Set();
  if (hasDairy(p)) out.add('milk');
  if (isEggName(p) || (hasAny(p, ['mayonnaise', 'mayo', 'meringue', 'eclair', 'souffle', 'flan', 'aigrette']) && !hasAny(p, KW.eggless))) out.add('egg');
  if (hasAny(p, KW.peanut)) out.add('peanut');
  if (hasAny(p, KW.treeNuts)) out.add('tree_nuts');
  if (hasAny(p, KW.gluten)) out.add('gluten');
  if (hasAny(p, KW.soy) || cuisine === 'indo_chinese') out.add('soy'); // Indo-Chinese dishes use soy sauce
  if (hasAny(p, KW.fish)) out.add('fish');
  if (hasAny(p, KW.shellfish)) out.add('shellfish');
  if (hasAny(p, KW.sesame)) out.add('sesame');
  if (hasAny(p, KW.mustard)) out.add('mustard');
  return out;
}

/** Diet type from the name. Conservative: never claims "vegan" unless the food is clearly plant-only. */
function dietTypeFromName(name, category, allergens) {
  const p = padded(name);
  if (isMeatName(p)) return 'non_vegetarian';
  if (allergens.has('egg')) return 'eggetarian';
  if (allergens.has('milk') || hasAny(p, ['honey', 'gelatin'])) return 'vegetarian';
  if (hasAny(p, ['vegan'])) return 'vegan';
  if (['salad', 'chutney or condiment', 'beverage'].includes(category)) return 'vegan';
  return 'vegetarian';
}

const SAVOURY = new Set(['vegetable or paneer dish', 'lentil or legume dish', 'meat or fish curry', 'meat or fish (dry)',
  'egg dish', 'soup', 'one-dish meal or breakfast item', 'snack']);

function tagsFromName(name, category) {
  const p = padded(name);
  const t = new Set();
  const notFried = hasAny(p, KW.notFried);
  if (!notFried && hasAny(p, KW.deepFried)) { t.add('deep_fried'); t.add('fried'); }
  if (!notFried && hasAny(p, KW.fried)) t.add('fried');
  if (hasAny(p, KW.gheeHeavy) && !p.includes(' peanut butter ')) t.add('ghee_heavy');
  if (hasAny(p, KW.spicy) && !hasAny(p, ['bell pepper', 'sweet pepper'])) t.add('spicy');
  if (hasAny(p, KW.rice)) t.add('rice_based');
  if ((hasAny(p, KW.rice) && !hasAny(p, KW.wholeGrainRice)) || hasAny(p, KW.refinedCarb)) t.add('refined_carb');
  if (hasAny(p, KW.redMeat) || (hasAny(p, ['meat', 'keema']) && !hasAny(p, ['chicken', 'fish', ...KW.shellfish]))) t.add('red_meat');
  if (hasAny(p, KW.processed)) t.add('processed');
  if (hasAny(p, KW.goitrogen)) t.add('goitrogen');
  const jain = hasAny(p, KW.noOnionGarlic);
  const sweetBreakfast = hasAny(p, SWEET_BREAKFAST);
  if (!jain && (hasAny(p, KW.onionGarlic) || (SAVOURY.has(category) && !sweetBreakfast))) {
    // Conservative: savoury Indian dishes are assumed to contain onion/garlic unless marked Jain.
    t.add('contains_onion_garlic');
    t.add('contains_root_veg');
  }
  // "aloo bukhara" is plum, not potato.
  if (!jain && hasAny(p.replace(/ aloo bukhara /g, ' '), KW.rootVeg)) t.add('contains_root_veg');
  return t;
}

// ── glycemic index estimate (only when carbs ≥ 5 g / 100 g) ────────────────
const GI_RULES = [
  [['brown rice', 'red rice', 'khichdi', 'pongal', 'curd rice'], 55],
  [['jalebi', 'gulab jamun', 'ladoo', 'barfi', 'halwa', 'candy', 'toffee', 'fudge', 'sharbat', 'sherbet', 'squash', 'soda', 'cola', 'cornflake', 'mithai', 'meetha', 'jam', 'murabba'], 68],
  [['bread', 'toast', 'sandwich', 'burger', 'pizza', 'naan', 'kulcha', 'bhatura', 'pav', 'bun', 'croissant', 'rusk'], 68],
  [['idli', 'dosa', 'uttapam', 'appam', 'puttu', 'poha', 'rice', 'biryani', 'pulao', 'murmura', 'bhel', 'sabudana', 'idiyappam'], 65],
  [['cake', 'pastry', 'biscuit', 'cookie', 'muffin', 'doughnut', 'eclair', 'tart', 'pie', 'brownie', 'pudding', 'custard'], 62],
  [['upma', 'suji', 'rava', 'semolina', 'vermicelli', 'semiya'], 62],
  [['potato', 'aloo', 'frie', 'chip', 'mashed', 'sweet potato'], 60],
  [['roti', 'chapati', 'paratha', 'puri', 'thepla', 'missi', 'luchi', 'parotta', 'wheat', 'atta'], 57],
  [['bajra', 'jowar', 'ragi', 'nachni', 'makki', 'millet', 'dalia', 'oat', 'oatmeal', 'porridge', 'muesli'], 55],
  [['pasta', 'spaghetti', 'macaroni', 'noodle', 'chowmein', 'lasagne'], 50],
  [['juice', 'fruit', 'banana', 'mango', 'apple', 'orange', 'papaya', 'grape', 'pineapple', 'chikoo', 'guava'], 45],
  [['dal', 'sambar', 'chole', 'chana', 'rajma', 'lobia', 'moong', 'masoor', 'urad', 'sprout', 'bean', 'chickpea', 'lentil', 'besan', 'dhokla', 'cheela', 'chilla', 'kadhi'], 35],
  [['milk', 'curd', 'yogurt', 'dahi', 'raita', 'lassi', 'chaas', 'buttermilk', 'paneer', 'shrikhand', 'kheer'], 35],
];
const GI_BY_CATEGORY = { soup: 40, salad: 35, 'vegetable or paneer dish': 45, 'raita or curd side': 35,
  'chutney or condiment': 45, dessert: 62, bakery: 65, beverage: 50 };

function estimateGI(name, category, carbsPer100g) {
  if (carbsPer100g == null || carbsPer100g < 5) return null;
  const p = padded(name);
  for (const [words, gi] of GI_RULES) if (hasAny(p, words)) return gi;
  return GI_BY_CATEGORY[category] ?? 50;
}

// ── ingredient-based rules (independent-schema recipe lines) ───────────────
const ING = {
  milk: ['I045', 'I046', 'I047', 'I048', 'I049', 'I050', 'I051', 'I052', 'I053'],
  egg: ['I121', 'I101'],
  peanut: ['I038'],
  tree_nuts: ['I041', 'I042', 'I043'],
  gluten: ['I001', 'I002', 'I009', 'I015', 'I016', 'I018', 'I019', 'I020', 'I021', 'I022', 'I099'],
  soy: ['I036', 'I037', 'I099'],
  fish: ['I118', 'I119'],
  shellfish: ['I120'],
  sesame: ['I039'],
  mustard: ['I057', 'I107'],
};
const ING_REFINED = new Set(['I002', 'I003', 'I004', 'I005', 'I006', 'I007', 'I009', 'I015', 'I017', 'I018', 'I019', 'I020', 'I021', 'I022', 'I023', 'I054', 'I055']);
const ING_RICE = new Set(['I003', 'I004', 'I005', 'I006', 'I007']);
const ING_GHEE = new Set(['I051', 'I052', 'I053']);
const ING_RED_MEAT = new Set(['I116', 'I117']);
const ING_GOITROGEN = new Set(['I036', 'I037', 'I062', 'I063', 'I065']);
const ING_ONION_GARLIC = new Set(['I059', 'I088', 'I091', 'I092']);
const ING_ROOT = new Set(['I059', 'I061', 'I068', 'I079', 'I080', 'I081', 'I082', 'I083', 'I084', 'I090', 'I091', 'I092']);
const ING_CHILLI = new Set(['I089', 'I103']);
const ING_PROCESSED = new Set(['I048', 'I098', 'I101']);
const ING_WATER = 'I126';

/** lines: [{ ingredient_id, grams_per_serving, calc_carbs_g }] */
function allergensFromIngredients(lines) {
  const ids = new Set(lines.map((l) => l.ingredient_id));
  const out = new Set();
  for (const [allergen, list] of Object.entries(ING)) if (list.some((id) => ids.has(id))) out.add(allergen);
  return out;
}

function tagsFromIngredients(lines) {
  const t = new Set();
  const sumG = (set) => lines.filter((l) => set.has(l.ingredient_id)).reduce((s, l) => s + (l.grams_per_serving || 0), 0);
  const sumCarbs = (set) => lines.filter((l) => set.has(l.ingredient_id)).reduce((s, l) => s + (l.calc_carbs_g || 0), 0);
  const totalCarbs = lines.reduce((s, l) => s + (l.calc_carbs_g || 0), 0);
  const solidGrams = lines.filter((l) => l.ingredient_id !== ING_WATER).reduce((s, l) => s + (l.grams_per_serving || 0), 0);

  if (sumG(ING_GHEE) >= 10) t.add('ghee_heavy');
  if (sumG(ING_CHILLI) >= 8) t.add('spicy');
  if (totalCarbs >= 15 && sumCarbs(ING_REFINED) / totalCarbs >= 0.5) t.add('refined_carb');
  if (totalCarbs > 0 && sumCarbs(ING_RICE) / totalCarbs >= 0.5) t.add('rice_based');
  if (sumG(ING_RED_MEAT) > 0) t.add('red_meat');
  if (solidGrams > 0 && sumG(ING_GOITROGEN) / solidGrams >= 0.25) t.add('goitrogen');
  if (sumG(ING_ONION_GARLIC) > 0) { t.add('contains_onion_garlic'); t.add('contains_root_veg'); }
  if (sumG(ING_ROOT) > 0) t.add('contains_root_veg');
  if (sumG(ING_PROCESSED) > 0) t.add('processed');
  return t;
}

/** Name tags that a recipe cannot show (cooking method, heat). */
function methodTagsFromName(name) {
  const p = padded(name);
  const t = new Set();
  const notFried = hasAny(p, KW.notFried);
  if (!notFried && hasAny(p, KW.deepFried)) { t.add('deep_fried'); t.add('fried'); }
  if (!notFried && hasAny(p, KW.fried)) t.add('fried');
  if (hasAny(p, KW.spicy) && !hasAny(p, ['bell pepper', 'sweet pepper'])) t.add('spicy');
  if (hasAny(p, KW.processed)) t.add('processed');
  return t;
}

/** Key protein, used so "chicken X" never merges with "mutton X". */
function proteinKey(name) {
  const p = padded(name);
  if (hasAny(p, KW.shellfish)) return 'shellfish';
  if (hasAny(p, KW.fish)) return 'fish';
  if (hasAny(p, ['chicken', 'murgh'])) return 'chicken';
  if (hasAny(p, ['mutton', 'lamb', 'goat', 'gosht', 'keema', 'meat'])) return 'mutton';
  if (isEggName(p)) return 'egg';
  if (hasAny(p, ['paneer'])) return 'paneer';
  if (hasAny(p, KW.soy)) return 'soy';
  if (hasAny(p, ['mushroom'])) return 'mushroom';
  return 'none';
}

module.exports = {
  categoryFromName, mealSlotsFor, cuisineFromName, allergensFromName, dietTypeFromName, tagsFromName,
  estimateGI, allergensFromIngredients, tagsFromIngredients, methodTagsFromName, proteinKey,
  COURSE_BY_CATEGORY, ING_WATER, padded,
};
