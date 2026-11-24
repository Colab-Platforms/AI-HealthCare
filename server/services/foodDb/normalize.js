/**
 * Food-name normalisation and similarity.
 * Shared by the seed build script (scripts/foodDb) and the runtime food matcher,
 * so a name is folded the same way when it is stored and when it is searched.
 */

// Spelling variants → one canonical token (applied after lowercasing/tokenising).
const TOKEN_FOLD = {
  biriyani: 'biryani', biriani: 'biryani', briyani: 'biryani', biryanee: 'biryani',
  parantha: 'paratha', paronta: 'paratha', prantha: 'paratha', parathe: 'paratha',
  chhole: 'chole', chholey: 'chole', choley: 'chole', cholle: 'chole', chhola: 'chole',
  daal: 'dal', dhal: 'dal', dahl: 'dal',
  panir: 'paneer', paner: 'paneer',
  alu: 'aloo', aaloo: 'aloo', aalu: 'aloo', allu: 'aloo',
  gobi: 'gobhi', gobee: 'gobhi',
  pakoda: 'pakora', pakode: 'pakora', pakore: 'pakora', pakodi: 'pakora', bhajia: 'pakora', bhajiya: 'pakora',
  laddu: 'ladoo', ladu: 'ladoo', laddoo: 'ladoo', laddo: 'ladoo',
  poori: 'puri', poories: 'puri',
  chapatti: 'chapati', chapathi: 'chapati', chappati: 'chapati', phulka: 'chapati',
  kofte: 'kofta',
  masaala: 'masala',
  sabji: 'sabzi', subzi: 'sabzi', sabzee: 'sabzi', subji: 'sabzi', subzee: 'sabzi',
  khichri: 'khichdi', khichadi: 'khichdi', khichuri: 'khichdi', kichdi: 'khichdi',
  kheema: 'keema', qeema: 'keema', kima: 'keema',
  kabab: 'kebab', kabob: 'kebab', kebap: 'kebab',
  chili: 'chilli', chilly: 'chilli', chile: 'chilli',
  mutter: 'matar', mattar: 'matar',
  piaza: 'pyaza', pyaaza: 'pyaza', piyaza: 'pyaza',
  channa: 'chana', chane: 'chana', chanay: 'chana',
  bhartha: 'bharta', bhurtha: 'bharta',
  kaathi: 'kathi', kati: 'kathi',
  roghan: 'rogan', yakhani: 'yakhni', paaner: 'paneer', khitchdi: 'khichdi',
  ghujia: 'gujiya', gujia: 'gujiya', pattie: 'patty', sunday: 'sundae', rajbogh: 'rajbhog',
  yoghurt: 'yogurt', yoghourt: 'yogurt',
  idly: 'idli', dosai: 'dosa', vadai: 'vada', wada: 'vada',
  bhature: 'bhatura', bhatoora: 'bhatura', bhatoore: 'bhatura',
  jeera: 'jeera', zeera: 'jeera',
  pulav: 'pulao', pilaf: 'pulao', pulaw: 'pulao',
  dhokala: 'dhokla',
  halwa: 'halwa', halva: 'halwa', halua: 'halwa',
  burfi: 'barfi', barfee: 'barfi',
  kulcha: 'kulcha', kulche: 'kulcha',
  raitha: 'raita', rayta: 'raita',
  moongfali: 'peanut', mungfali: 'peanut', moongphali: 'peanut', groundnut: 'peanut',
  bhindi: 'bhindi', bindi: 'bhindi', okra: 'bhindi',
  baigan: 'baingan', brinjal: 'baingan', eggplant: 'baingan',
  palak: 'palak',
  kaju: 'kaju', cashewnut: 'cashew',
  omlet: 'omelette', omelet: 'omelette', omlette: 'omelette',
  sandwhich: 'sandwich',
  chowmin: 'chowmein', chaumin: 'chowmein',
  momo: 'momo', momos: 'momo',
  manchurian: 'manchurian', manchoorian: 'manchurian',
  schezwan: 'schezwan', szechuan: 'schezwan', sichuan: 'schezwan',
  gulabjamun: 'gulab jamun',
};

// Words that carry no identity for matching.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'with', 'and', 'in', 'on', 'for', 'some', 'style', 'homemade',
  'home', 'made', 'recipe', 'fresh', 'plate', 'bowl', 'piece', 'pieces', 'serving',
  'ka', 'ki', 'ke', 'kay', 'aur', 'wala', 'wali', 'saath', 'indian',
]);

function stripDiacritics(s) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

function singular(t) {
  // Symmetric, so it is safe even when the result is not a real word.
  if (t.length > 4 && t.endsWith('oes')) return t.slice(0, -2); // potatoes → potato
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

/** Lowercase, strip punctuation, fold spelling variants, drop stopwords. Returns tokens. */
function tokens(text) {
  if (!text) return [];
  const cleaned = stripDiacritics(String(text).toLowerCase())
    .replace(/�/g, 'e')
    .replace(/\b\d+\s*(pieces?|pcs?|nos?|numbers?)\b/g, ' ') // "(2 pieces)" is a portion, not identity
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!cleaned) return [];
  const out = [];
  for (let t of cleaned.split(/\s+/)) {
    t = singular(t);
    t = TOKEN_FOLD[t] || t;
    for (const part of t.split(' ')) {
      if (part && !STOPWORDS.has(part)) out.push(part);
    }
  }
  return out;
}

/** Normalised string (tokens joined by a space). */
function normalize(text) {
  return tokens(text).join(' ');
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  let cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

function ratio(a, b) {
  if (!a && !b) return 1;
  const len = a.length + b.length;
  return len ? (len - levenshtein(a, b)) / len : 0;
}

/**
 * Token-sort similarity in [0, 1]: word order does not matter, spelling variants are folded.
 * "Biryani chicken dum" vs "chicken dum biriyani" → 1.
 */
function similarity(a, b) {
  const ta = tokens(a).sort().join(' ');
  const tb = tokens(b).sort().join(' ');
  return ratio(ta, tb);
}

/**
 * Count words of `ta` that match a distinct word of `tb` (token arrays, already normalised).
 * Two words match when equal, or when both are ≥ 5 letters with spelling ratio ≥ tokenMin
 * (so "chai" ≠ "chat"). With prefixLast, the last word of `ta` may also match as a prefix
 * (≥ 3 letters) — used by the search box while the user is still typing ("biry" → "biryani").
 */
function countTokenMatches(ta, tb, { tokenMin = 0.9, prefixLast = false } = {}) {
  const used = new Set();
  let matches = 0;
  ta.forEach((x, i) => {
    let bestJ = -1;
    let best = 0;
    const allowPrefix = prefixLast && i === ta.length - 1 && x.length >= 3;
    tb.forEach((y, j) => {
      if (used.has(j)) return;
      let s = 0;
      if (x === y) s = 1;
      else if (allowPrefix && y.startsWith(x)) s = 0.95;
      else if (x.length >= 5 && y.length >= 5) s = ratio(x, y);
      if (s > best) { best = s; bestJ = j; }
    });
    if (best >= tokenMin) { matches += 1; used.add(bestJ); }
  });
  return matches;
}

/**
 * Word-level overlap in [0, 1] (fuzzy Jaccard).
 * Stops "palak chicken" ≈ "chicken pulao" passing on letters alone.
 */
function tokenOverlap(a, b, tokenMin = 0.9) {
  const ta = [...new Set(tokens(a))];
  const tb = [...new Set(tokens(b))];
  if (!ta.length || !tb.length) return 0;
  const matches = countTokenMatches(ta, tb, { tokenMin });
  return matches / (ta.length + tb.length - matches);
}

module.exports = {
  TOKEN_FOLD, STOPWORDS, tokens, normalize, similarity, tokenOverlap, countTokenMatches, ratio, levenshtein,
};
