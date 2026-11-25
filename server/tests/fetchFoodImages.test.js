const test = require('node:test');
const assert = require('node:assert');
const {
  coreTokens, openverseLicense, wikimediaLicense, matchScore, titlePrecision, rejectReason, rankCandidates, queriesFor, attributionLine, isEligible,
} = require('../scripts/foodDb/fetchFoodImages');

test('licences: only commercial-use, re-hostable licences pass', () => {
  assert.strictEqual(openverseLicense('by-sa'), 'by-sa');
  assert.strictEqual(openverseLicense('CC0'), 'cc0');
  assert.strictEqual(openverseLicense('by-nc'), null);
  assert.strictEqual(openverseLicense('by-nd'), null);

  assert.strictEqual(wikimediaLicense('cc-by-sa-4.0'), 'by-sa');
  assert.strictEqual(wikimediaLicense('cc-by-2.0'), 'by');
  assert.strictEqual(wikimediaLicense('cc0'), 'cc0');
  assert.strictEqual(wikimediaLicense('pd'), 'pdm');
  assert.strictEqual(wikimediaLicense('cc-by-nc-sa-2.0'), null);
  assert.strictEqual(wikimediaLicense('cc-by-nd-4.0'), null);
  assert.strictEqual(wikimediaLicense('gfdl'), null);
  assert.strictEqual(wikimediaLicense(''), null);
});

test('matchScore: share of dish words found, order and spelling tolerant', () => {
  assert.strictEqual(matchScore(['Lauki Chana Dal'], 'Chana dal with lauki'), 1);
  assert.ok(matchScore(['Lauki Chana Dal'], 'Chana masala') < 0.6);
  assert.strictEqual(matchScore(['Chicken Dum Biryani'], 'chicken biriyani dum'), 1);
  // An alias can carry the match when the name does not.
  assert.strictEqual(matchScore(['Bottle Gourd Curry', 'lauki sabzi'], 'Lauki sabzi in a steel bowl'), 1);
  assert.strictEqual(matchScore(['Poha'], ''), 0);
});

test('matchScore: cooking descriptors in the DB name do not block a match', () => {
  // Real misses from the first dry run: photos are titled "Aloo gobi", not "Aloo Gobhi Sabzi (Dry)".
  assert.strictEqual(matchScore(['Aloo Gobhi Sabzi (Dry)'], 'Aloo gobi'), 1);
  assert.strictEqual(matchScore(['Aloo Gobhi Masala (Gravy)'], 'Aloo Gobi 2'), 1);
  assert.strictEqual(matchScore(['Bhindi (Restaurant Style)'], 'Bhindi'), 1);
  // A one-word dish needs proof it is cooked: a raw bottle gourd is not Lauki Sabzi.
  assert.strictEqual(matchScore(['Lauki Sabzi (Dry)'], 'Lauki sabzi'), 1);
  assert.strictEqual(matchScore(['Lauki Sabzi (Dry)'], 'Lauki at a vegetable stall'), 0);
  assert.deepStrictEqual(coreTokens('Aloo Gobhi Sabzi (Dry)'), ['aloo', 'gobhi']);
  // Vegetable dishes: "Bhindi (Restaurant Style)" picked "Fresh okra" in a live test.
  assert.strictEqual(matchScore(['Bhindi (Restaurant Style)'], 'Fresh okra', { requireCooked: true }), 0);
  assert.strictEqual(matchScore(['Bhindi (Restaurant Style)'], 'Bhindi fry', { requireCooked: true }), 1);
  // Not a vegetable dish: a plain photo of the dish is fine.
  assert.strictEqual(matchScore(['Poha'], 'Poha 4'), 1);
});

test('queriesFor: searches the dish without cooking descriptors', () => {
  assert.deepStrictEqual(queriesFor({ name: 'Aloo Gobhi Sabzi (Dry)', aliases: [] }), ['Aloo Gobhi Sabzi', 'Aloo Gobhi']);
  assert.deepStrictEqual(queriesFor({ name: 'Bhindi (Restaurant Style)', aliases: [] }), ['Bhindi']);
});

test('rejectReason: filters non-dish photos and unusable files', () => {
  const ok = { imageUrl: 'https://x/a.jpg', license: 'by', width: 1200, height: 800, matchText: 'Poha breakfast' };
  assert.strictEqual(rejectReason(ok), null);
  assert.strictEqual(rejectReason({ ...ok, license: null }), 'licence not allowed');
  assert.strictEqual(rejectReason({ ...ok, width: 300 }), 'too small');
  assert.strictEqual(rejectReason({ ...ok, width: 3000, height: 800 }), 'odd aspect ratio');
  assert.match(rejectReason({ ...ok, matchText: 'Poha stall at a market' }), /stall/);
});

test('titlePrecision: plain dish titles beat variants and multi-dish photos', () => {
  assert.strictEqual(titlePrecision(['Chicken Dum Biryani'], 'Chicken Dum Biryani 03'), 1);
  assert.ok(titlePrecision(['Chicken Dum Biryani'], 'Thalassery style Dum Chicken Biriyani from Kottayam') < 1);
  assert.strictEqual(titlePrecision(['Palak Paneer'], 'Gobi manchurian and palak paneer'), 0.5);
});

test('rankCandidates: score, then title precision, then source, then capped resolution', () => {
  const ranked = rankCandidates([
    { id: 'pexels-hi', source: 'pexels', matchScore: 1, precision: 1, width: 4000, height: 3000 },
    { id: 'wiki', source: 'wikimedia', matchScore: 1, precision: 1, width: 1200, height: 900 },
    { id: 'wiki-variant-huge', source: 'wikimedia', matchScore: 1, precision: 0.6, width: 16000, height: 12000 },
    { id: 'ov-low', source: 'openverse', matchScore: 0.67, precision: 1, width: 4000, height: 3000 },
  ]);
  assert.deepStrictEqual(ranked.map((c) => c.id), ['wiki', 'pexels-hi', 'wiki-variant-huge', 'ov-low']);
  // Above 1200 px, size no longer decides.
  const sameSize = rankCandidates([
    { id: 'big', source: 'wikimedia', matchScore: 1, precision: 1, width: 9000, height: 7000 },
    { id: 'ok', source: 'wikimedia', matchScore: 1, precision: 1, width: 1300, height: 1250 },
  ]);
  assert.strictEqual(sameSize.length, 2);
});

test('queriesFor: name plus distinct aliases, max 3', () => {
  const q = queriesFor({ name: 'Aloo Paratha', aliases: ['aloo paratha', 'alu parantha', 'potato paratha', 'aloo ka paratha'] });
  // "alu parantha" folds to the same words as the name; "ka" is a stopword, so "aloo ka paratha" is a duplicate too.
  assert.deepStrictEqual(q, ['Aloo Paratha', 'potato paratha']);
});

test('attributionLine', () => {
  assert.strictEqual(
    attributionLine({ source: 'wikimedia', title: 'Poha', creator: 'A. User', license: 'by-sa', licenseVersion: '4.0' }),
    '"Poha" by A. User, CC BY-SA 4.0',
  );
  assert.strictEqual(attributionLine({ source: 'pexels', creator: 'B' }), 'Photo by B on Pexels');
});

test('isEligible: never touches approved images without --force', () => {
  const base = { force: false, retryMissing: false, explicit: false };
  assert.strictEqual(isEligible({}, base), true);
  assert.strictEqual(isEligible({ image: { status: 'approved' } }, base), false);
  assert.strictEqual(isEligible({ image: { status: 'approved' } }, { ...base, explicit: true }), false);
  assert.strictEqual(isEligible({ image: { status: 'approved' } }, { ...base, force: true }), true);
  assert.strictEqual(isEligible({ image: { status: 'pending' } }, base), false);
  assert.strictEqual(isEligible({ image: { status: 'missing' } }, base), false);
  assert.strictEqual(isEligible({ image: { status: 'missing' } }, { ...base, retryMissing: true }), true);
  assert.strictEqual(isEligible({ image: { status: 'rejected' } }, { ...base, retryMissing: true }), true);
});
