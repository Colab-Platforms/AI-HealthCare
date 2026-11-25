/**
 * Find a licensed photo for each food, copy it to Cloudinary and save it on the Food document.
 *
 *   node scripts/foodDb/fetchFoodImages.js                      # dry run: search only, writes the report, no uploads/DB writes
 *   node scripts/foodDb/fetchFoodImages.js --apply              # upload to Cloudinary + save `image` on each food
 *   node scripts/foodDb/fetchFoodImages.js --limit 20           # only the first 20 eligible foods (by hitCount)
 *   node scripts/foodDb/fetchFoodImages.js --food THF-00248,THF-00420
 *   node scripts/foodDb/fetchFoodImages.js --all                # include desserts, drinks, chutneys, bakery
 *   node scripts/foodDb/fetchFoodImages.js --retry-missing      # also retry foods marked missing or rejected
 *   node scripts/foodDb/fetchFoodImages.js --force              # also replace admin-approved images
 *   node scripts/foodDb/fetchFoodImages.js --sources wikimedia,openverse --min-match 0.75 --delay 1500
 *
 * Sources, all with licences that allow commercial use and re-hosting:
 *   - Openverse (api.openverse.org): CC-licensed images from Wikimedia, Flickr and others. No key needed;
 *     set OPENVERSE_CLIENT_ID / OPENVERSE_CLIENT_SECRET for higher rate limits.
 *   - Wikimedia Commons API. Set FOOD_IMAGE_USER_AGENT to include a contact (Wikimedia's UA policy).
 *   - Pexels: only when PEXELS_API_KEY is set. Pexels licence, no attribution required (credit stored anyway).
 *   Unsplash is deliberately NOT used: its API terms require hotlinking Unsplash URLs, not re-hosting.
 * Accepted licences: cc0, pdm (public domain), by, by-sa, pexels. NC and ND licences are rejected.
 *
 * Every image is saved with status "pending". Nothing should be shown to users until an admin approves it.
 * Safe to re-run: foods that already have a pending/approved image are skipped (see flags above).
 * Report: data/foodDb/foods.images.report.json (chosen photo, alternatives and score per food).
 *
 * Database: USE_STAGING_DB=true in .env -> staging, otherwise production. Printed first.
 */
const path = require('path');
const fs = require('fs');
const dns = require('dns');
const axios = require('axios');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { tokens, countTokenMatches } = require('../../services/foodDb/normalize');

// ─── Config ──────────────────────────────────────────────────────────────────

// Plan-relevant foods first: these categories rarely appear in a diet plan, so they need --all.
const NON_PLAN_CATEGORIES = ['dessert', 'beverage', 'chutney or condiment', 'bakery', 'other'];
const ALLOWED_LICENSES = new Set(['cc0', 'pdm', 'by', 'by-sa', 'pexels']);
const ATTRIBUTION_REQUIRED = new Set(['by', 'by-sa']);
// Real food photos from Commons/Openverse beat stock photos for Indian home dishes.
const SOURCE_PRIORITY = { wikimedia: 3, openverse: 2, pexels: 1 };
// A photo whose title/tags contain these is almost never a plain photo of the dish.
const REJECT_WORDS = new Set([
  'logo', 'menu', 'map', 'sign', 'signboard', 'poster', 'label', 'packet', 'package', 'packaging', 'box',
  'diagram', 'drawing', 'illustration', 'cartoon', 'icon', 'vector', 'clipart', 'stamp', 'advertisement',
  'restaurant', 'stall', 'shop', 'market', 'vendor', 'seller', 'raw', 'plant', 'field', 'farm', 'tree',
]);
// Words that say how a dish is made or served, not what it is. The DB names variants like
// "Aloo Gobhi Sabzi (Dry)" / "Aloo Gobhi Masala (Gravy)" / "Aloo Gobhi (Restaurant Style)", but
// photos are titled "Aloo gobi": searching and matching on these words found almost nothing.
const DESCRIPTOR_WORDS = new Set(tokens(
  'sabzi sabji subzi masala gravy dry restaurant style curry fry tadka homemade home made plain recipe special',
));
// A one-word dish ("Lauki Sabzi" → "lauki") would otherwise match a photo of the raw vegetable,
// so its photo must also say it is cooked food.
const DISH_HINT_WORDS = new Set(tokens(
  'sabzi sabji subzi curry masala fry gravy dish cooked recipe bhaji bhujia tarkari torkari poriyal thoran palya dal daal stir food meal tadka',
));
const MIN_WIDTH = 500;
const MIN_HEIGHT = 400;
const MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024;
const CLOUDINARY_FOLDER = 'takehealth/food_db';
const REPORT_FILE = path.join(__dirname, '..', '..', 'data', 'foodDb', 'foods.images.report.json');
// Generic client name: no project or personal details are sent to third parties unless set in .env.
const USER_AGENT = process.env.FOOD_IMAGE_USER_AGENT || 'food-image-fetch-script/1.0 (one-time licensed image import)';

// ─── Pure helpers (exported for tests) ──────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stripHtml(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

/** Openverse already uses short codes (cc0, pdm, by, by-sa, by-nc…). */
function openverseLicense(raw) {
  const s = String(raw || '').toLowerCase().trim();
  return ALLOWED_LICENSES.has(s) ? s : null;
}

/** Wikimedia extmetadata "License" values: cc0, pd, cc-by-sa-4.0, cc-by-2.0, gfdl… */
function wikimediaLicense(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (!s) return null;
  if (s.startsWith('cc0')) return 'cc0';
  if (s === 'pd' || s.startsWith('pd-') || s.startsWith('public domain')) return 'pdm';
  if (/-nc\b|-nd\b|-nc-|-nd-/.test(s)) return null;
  if (s.startsWith('cc-by-sa')) return 'by-sa';
  if (s.startsWith('cc-by')) return 'by';
  return null; // GFDL-only, fair use, unknown: not safe to re-host
}

/** "(Dry)" and other parentheticals removed: "Aloo Gobhi Sabzi (Dry)" → "Aloo Gobhi Sabzi". */
function stripParens(name) {
  return String(name || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
}

/** What the dish is, without how it is made: "Aloo Gobhi Sabzi (Dry)" → ['aloo', 'gobhi']. */
function coreTokens(name) {
  const all = [...new Set(tokens(stripParens(name)))];
  const core = all.filter((t) => !DESCRIPTOR_WORDS.has(t));
  return core.length ? core : all; // "Masala Dosa"-style names keep their words
}

/**
 * Share of the dish's core words (best of name and aliases) found in the photo's title/tags, 0–1.
 * "Lauki Chana Dal" vs a photo titled "Chana dal with lauki" → 1; vs "Chana masala" → 0.33.
 * "Aloo Gobhi Sabzi (Dry)" vs "Aloo gobi" → 1. A one-word core also needs a cooked-dish word in
 * the photo ("Lauki sabzi" yes, "Lauki" on a market stall no) when descriptors were stripped from
 * the name or `requireCooked` is set (vegetable dishes: "Bhindi" must not match "Fresh okra").
 */
function matchScore(names, matchText, { requireCooked = false } = {}) {
  const cand = [...new Set(tokens(matchText))];
  if (!cand.length) return 0;
  const cooked = cand.some((t) => DISH_HINT_WORDS.has(t));
  let best = 0;
  for (const name of names) {
    const dish = coreTokens(name);
    if (!dish.length) continue;
    const stripped = dish[0] !== tokens(stripParens(name)).join(' ');
    if (dish.length === 1 && !cooked && (stripped || requireCooked)) continue;
    best = Math.max(best, countTokenMatches(dish, cand) / dish.length);
  }
  return Math.round(best * 1000) / 1000;
}

/**
 * Share of the photo title's words that belong to the dish, 0–1 (numbers ignored).
 * Breaks ties between full matches: "Chicken Dum Biryani 03" (1) beats
 * "Thalassery style Dum Chicken Biriyani from Kottayam" (0.6) and
 * "Gobi manchurian and palak paneer" (0.5) for Palak Paneer.
 */
function titlePrecision(names, title) {
  const words = [...new Set(tokens(title))].filter((w) => !/^\d+$/.test(w) && !DESCRIPTOR_WORDS.has(w));
  if (!words.length) return 0;
  let best = 0;
  for (const name of names) {
    const dish = coreTokens(name);
    if (!dish.length) continue;
    best = Math.max(best, countTokenMatches(words, dish) / words.length);
  }
  return Math.round(best * 1000) / 1000;
}

/** Why a candidate is unusable, or null if it is fine. */
function rejectReason(c) {
  if (!c.imageUrl) return 'no image url';
  if (!c.license) return 'licence not allowed';
  if ((c.width && c.width < MIN_WIDTH) || (c.height && c.height < MIN_HEIGHT)) return 'too small';
  if (c.width && c.height) {
    const ratio = c.width / c.height;
    if (ratio < 0.5 || ratio > 2.2) return 'odd aspect ratio';
  }
  const words = tokens(c.matchText);
  const bad = words.find((w) => REJECT_WORDS.has(w));
  if (bad) return `title mentions "${bad}"`;
  return null;
}

// Everything is resized to fit 1200 px, so extra resolution beyond that is no reason to prefer a photo.
const usefulPixels = (c) => Math.min(c.width || 0, 1200) * Math.min(c.height || 0, 1200);

/** Best first: match score, then fewest extra title words, then source, then (capped) resolution. */
function rankCandidates(candidates) {
  return [...candidates].sort((a, b) =>
    (b.matchScore - a.matchScore)
    || ((b.precision || 0) - (a.precision || 0))
    || ((SOURCE_PRIORITY[b.source] || 0) - (SOURCE_PRIORITY[a.source] || 0))
    || (usefulPixels(b) - usefulPixels(a)));
}

/**
 * Search phrases, most specific first, max 3: the name without parentheticals, then just the dish
 * ("Aloo Gobhi" — search engines need every word to match, and photos are not titled "…Sabzi (Dry)"),
 * then aliases.
 */
function queriesFor(food) {
  const seen = new Set();
  const out = [];
  const core = (name) => {
    const words = coreTokens(name);
    // Back to the original spelling and case for the search engine.
    return stripParens(name).split(/\s+/).filter((w) => words.includes(tokens(w)[0])).join(' ');
  };
  const phrases = [stripParens(food.name), core(food.name), ...(food.aliases || []).slice(0, 4).map(stripParens)];
  for (const q of phrases) {
    const key = tokens(q).sort().join(' ');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(q);
    if (out.length === 3) break;
  }
  return out;
}

function attributionLine(c) {
  if (c.source === 'pexels') return `Photo by ${c.creator || 'unknown'} on Pexels`;
  const lic = c.license === 'cc0' ? 'CC0' : c.license === 'pdm' ? 'Public domain'
    : `CC ${c.license.toUpperCase()}${c.licenseVersion ? ` ${c.licenseVersion}` : ''}`;
  return `"${c.title || 'Photo'}" by ${c.creator || 'unknown'}, ${lic}`;
}

// ─── HTTP ────────────────────────────────────────────────────────────────────

async function getJson(url, { params, headers } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await axios.get(url, { params, headers: { 'User-Agent': USER_AGENT, ...headers }, timeout: 20000 });
      return res.data;
    } catch (err) {
      const status = err.response?.status;
      if ((status === 429 || status >= 500) && attempt < 2) {
        const wait = 10000 * (attempt + 1);
        console.warn(`     ${new URL(url).host} ${status}, waiting ${wait / 1000}s…`);
        await sleep(wait);
        continue;
      }
      throw new Error(`${new URL(url).host}: ${status || err.code || err.message}`);
    }
  }
}

// ─── Sources ─────────────────────────────────────────────────────────────────

let openverseToken = null;

async function openverseAuth() {
  const id = process.env.OPENVERSE_CLIENT_ID;
  const secret = process.env.OPENVERSE_CLIENT_SECRET;
  if (!id || !secret) return null;
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret });
  const { data } = await axios.post('https://api.openverse.org/v1/auth_tokens/token/', body, {
    headers: { 'User-Agent': USER_AGENT }, timeout: 20000,
  });
  return data.access_token || null;
}

async function searchOpenverse(query) {
  const data = await getJson('https://api.openverse.org/v1/images/', {
    params: { q: query, license_type: 'commercial', page_size: 20, mature: false },
    headers: openverseToken ? { Authorization: `Bearer ${openverseToken}` } : {},
  });
  return (data.results || []).map((r) => {
    // Machine-generated tags carry an `accuracy`; they are generic ("food", "dish") so only human tags count.
    const humanTags = (r.tags || []).filter((t) => t && t.name && t.accuracy == null).map((t) => t.name);
    return {
      source: 'openverse',
      provider: r.provider || r.source || null,
      title: stripHtml(r.title),
      matchText: [stripHtml(r.title), ...humanTags].join(' '),
      imageUrl: r.url,
      sourceUrl: r.foreign_landing_url || null,
      license: openverseLicense(r.license),
      licenseVersion: r.license_version || null,
      licenseUrl: r.license_url || null,
      creator: stripHtml(r.creator) || null,
      width: r.width || null,
      height: r.height || null,
    };
  });
}

/**
 * A thumbnail URL, never the original file. For a photo narrower than the 1200 px we ask for,
 * the API returns the ORIGINAL as "thumburl" (…?utm_content=thumbnail_unscaled), and Wikimedia
 * rate-limits automated downloads of originals hard (429, even when Cloudinary fetches them).
 * Thumbnails at its standard widths are served from cache and were not throttled.
 */
function wikimediaThumbUrl(ii) {
  const thumb = ii.thumburl || '';
  if (thumb.includes('/thumb/')) return thumb;
  // Only Wikimedia's standard thumbnail steps; other widths (e.g. 640) are refused with 400.
  const width = [1280, 960, 500, 330].find((w) => w < (ii.width || 0));
  const m = String(ii.url || '').split('?')[0].match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/);
  if (!width || !m) return thumb || ii.url;
  return `${m[1]}/thumb/${m[2]}/${m[3]}/${m[4]}/${width}px-${m[4]}`;
}

async function searchWikimedia(query) {
  const data = await getJson('https://commons.wikimedia.org/w/api.php', {
    params: {
      action: 'query',
      format: 'json',
      generator: 'search',
      gsrsearch: `${query} filetype:bitmap`,
      gsrnamespace: 6,
      gsrlimit: 15,
      prop: 'imageinfo',
      iiprop: 'url|size|mime|extmetadata',
      iiurlwidth: 1200,
    },
  });
  return Object.values(data.query?.pages || {}).map((p) => {
    const ii = p.imageinfo?.[0];
    if (!ii || !/^image\/(jpeg|png|webp)$/.test(ii.mime || '')) return null;
    const meta = (k) => stripHtml(ii.extmetadata?.[k]?.value);
    const title = String(p.title || '').replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ');
    const short = meta('LicenseShortName');
    return {
      source: 'wikimedia',
      provider: 'wikimedia',
      title,
      matchText: [title, meta('ObjectName')].join(' '), // not the long description: too many incidental words
      imageUrl: wikimediaThumbUrl(ii),
      sourceUrl: ii.descriptionurl || null,
      license: wikimediaLicense(meta('License') || short),
      licenseVersion: (short.match(/\d\.\d/) || [null])[0],
      licenseUrl: meta('LicenseUrl') || null,
      creator: meta('Artist') || null,
      width: ii.width || null,
      height: ii.height || null,
    };
  }).filter(Boolean);
}

async function searchPexels(query) {
  if (!process.env.PEXELS_API_KEY) return [];
  const data = await getJson('https://api.pexels.com/v1/search', {
    params: { query, per_page: 15 },
    headers: { Authorization: process.env.PEXELS_API_KEY },
  });
  return (data.photos || []).map((p) => {
    // The page slug often names the dish better than `alt`: /photo/dal-makhani-in-a-bowl-12345/
    const slug = (String(p.url || '').split('/photo/')[1] || '').replace(/-?\d+\/?$/, '').replace(/-/g, ' ');
    return {
      source: 'pexels',
      provider: 'pexels',
      title: p.alt || slug,
      matchText: `${p.alt || ''} ${slug}`,
      imageUrl: p.src?.large2x || p.src?.original,
      sourceUrl: p.url || null,
      license: 'pexels',
      licenseVersion: null,
      licenseUrl: 'https://www.pexels.com/license/',
      creator: p.photographer || null,
      width: p.width || null,
      height: p.height || null,
    };
  });
}

const SEARCHERS = { openverse: searchOpenverse, wikimedia: searchWikimedia, pexels: searchPexels };

// One run searches "Aloo Gobhi" once, not once per variant (Dry / Gravy / Restaurant Style).
const searchCache = new Map();

async function cachedSearch(source, query) {
  const key = `${source}|${tokens(query).sort().join(' ')}`;
  if (searchCache.has(key)) return { results: searchCache.get(key), cached: true };
  const results = await SEARCHERS[source](query);
  searchCache.set(key, results);
  return { results, cached: false };
}

// ─── Download + upload ───────────────────────────────────────────────────────

/** Downloaded straight into memory; never written to disk or executed. */
async function download(url) {
  let res;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: MAX_DOWNLOAD_BYTES,
        maxRedirects: 5,
        headers: { 'User-Agent': USER_AGENT },
      });
      break;
    } catch (err) {
      // Wikimedia renders a thumbnail size on first request and answers 429 while it does; the
      // same URL is a normal 200 shortly after. So: two retries (honouring Retry-After), then the
      // caller tries Cloudinary. A food that still fails gets no status and the next batch retries
      // it, by which time the thumbnail exists.
      const status = err.response?.status;
      if ((status === 429 || status >= 500) && attempt < 2) {
        const retryAfter = Number(err.response?.headers?.['retry-after']);
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : 10000 * (attempt + 1);
        console.warn(`     ${new URL(url).host} ${status} on download, waiting ${wait / 1000}s…`);
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
  const type = String(res.headers['content-type'] || '').split(';')[0].trim();
  if (!/^image\/(jpeg|png|webp)$/.test(type)) throw new Error(`not an image (${type || 'no content-type'})`);
  return Buffer.from(res.data);
}

/** Public delivery (type "upload"): dish photos are reference content, unlike private scan photos. */
const UPLOAD_OPTIONS = (foodId) => ({
  folder: CLOUDINARY_FOLDER,
  public_id: foodId,
  overwrite: true,
  invalidate: true,
  resource_type: 'image',
  type: 'upload',
  transformation: [{ width: 1200, height: 1200, crop: 'limit' }],
});

function uploadToCloudinary(buffer, foodId) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(UPLOAD_OPTIONS(foodId), (err, result) => (err ? reject(err) : resolve(result))).end(buffer);
  });
}

/** Cloudinary downloads the file itself (its servers, not this machine's rate-limited IP). */
function uploadFromUrl(url, foodId) {
  return cloudinary.uploader.upload(url, UPLOAD_OPTIONS(foodId));
}

/** Download here and upload; if the source rate-limits this machine, let Cloudinary fetch it. */
async function copyToCloudinary(url, foodId) {
  try {
    return await uploadToCloudinary(await download(url), foodId);
  } catch (err) {
    if (err.response?.status !== 429) throw err;
    console.warn('     rate-limited here, asking Cloudinary to fetch it…');
    return uploadFromUrl(url, foodId);
  }
}

// ─── Per food ────────────────────────────────────────────────────────────────

function isEligible(food, { force, retryMissing, explicit }) {
  const status = food.image?.status;
  if (!status) return true;
  if (status === 'approved') return force;
  if (status === 'pending') return force || explicit;
  return retryMissing || explicit; // missing | rejected
}

async function findCandidates(food, opts) {
  const names = [food.name, ...(food.aliases || [])];
  // A vegetable dish's photo must show it cooked: one-word "Bhindi" otherwise matches raw okra.
  const requireCooked = food.classification?.category === 'vegetable or paneer dish';
  const exclude = food.image?.status === 'rejected' ? food.image.sourceUrl : null; // never re-pick a rejected photo
  const pool = new Map(); // dedupe by image url across sources/queries
  const errors = [];
  const rejected = {};

  let best = 0;
  for (const source of opts.sources) {
    for (const query of queriesFor(food)) {
      let cached = false;
      try {
        const res = await cachedSearch(source, query);
        cached = res.cached;
        // Copies: the same search result is scored separately for each food.
        for (const c of res.results.map((r) => ({ ...r }))) {
          if (pool.has(c.imageUrl) || (exclude && c.sourceUrl === exclude)) continue;
          const reason = rejectReason(c);
          if (reason) { rejected[reason] = (rejected[reason] || 0) + 1; continue; }
          c.matchScore = matchScore(names, c.matchText, { requireCooked });
          c.precision = titlePrecision(names, c.title);
          c.query = query;
          pool.set(c.imageUrl, c);
          best = Math.max(best, c.matchScore);
        }
      } catch (err) {
        errors.push(`${source} "${query}": ${err.message}`);
      }
      if (!cached) await sleep(opts.delayMs);
      if (best >= 1) break; // every dish word matched: stop spending calls
    }
    if (best >= 1) break;
  }

  const ranked = rankCandidates([...pool.values()].filter((c) => c.matchScore >= opts.minMatch));
  return { ranked, errors, rejected, seen: pool.size };
}

function summarise(c) {
  return c && {
    source: c.source, provider: c.provider, title: c.title, matchScore: c.matchScore, precision: c.precision, license: c.license,
    creator: c.creator, imageUrl: c.imageUrl, sourceUrl: c.sourceUrl, width: c.width, height: c.height, query: c.query,
  };
}

async function processFood(Food, food, opts) {
  const { ranked, errors, rejected, seen } = await findCandidates(food, opts);
  const row = {
    foodId: food.foodId, name: food.name, category: food.classification?.category, hitCount: food.stats?.hitCount || 0,
    candidatesSeen: seen, rejected, errors,
  };

  if (!ranked.length) {
    row.result = errors.length && !seen ? 'error' : 'missing';
    if (opts.apply && row.result === 'missing') {
      await Food.updateOne({ foodId: food.foodId }, {
        $set: { image: { status: 'missing', searchedAt: new Date(), alternatives: [] } },
      });
    }
    return row;
  }

  if (!opts.apply) {
    row.result = 'found';
    row.chosen = summarise(ranked[0]);
    row.alternatives = ranked.slice(1, 4).map(summarise);
    return row;
  }

  // Try the best few in order: a host can refuse the download or serve something that is not an image.
  for (let i = 0; i < Math.min(3, ranked.length); i++) {
    const c = ranked[i];
    try {
      const up = await copyToCloudinary(c.imageUrl, food.foodId);
      const alternatives = ranked.filter((x) => x !== c).slice(0, 3).map((x) => ({
        source: x.source, imageUrl: x.imageUrl, sourceUrl: x.sourceUrl, license: x.license,
        creator: x.creator, title: x.title, matchScore: x.matchScore,
      }));
      await Food.updateOne({ foodId: food.foodId }, {
        $set: {
          image: {
            status: 'pending',
            url: up.secure_url,
            publicId: up.public_id,
            source: c.source,
            provider: c.provider,
            license: c.license,
            licenseVersion: c.licenseVersion,
            licenseUrl: c.licenseUrl,
            attributionRequired: ATTRIBUTION_REQUIRED.has(c.license),
            creator: c.creator,
            attribution: attributionLine(c),
            title: c.title,
            sourceUrl: c.sourceUrl,
            originalUrl: c.imageUrl,
            width: up.width,
            height: up.height,
            matchScore: c.matchScore,
            query: c.query,
            searchedAt: new Date(),
            reviewedBy: null,
            reviewedAt: null,
            alternatives,
          },
        },
      });
      row.result = 'uploaded';
      row.chosen = { ...summarise(c), cloudinaryUrl: up.secure_url };
      row.alternatives = alternatives;
      return row;
    } catch (err) {
      errors.push(`download/upload ${c.imageUrl}: ${err.message}`);
    }
  }
  row.result = 'error';
  return row;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const has = (n) => argv.includes(n);
  const val = (n, d) => {
    const i = argv.indexOf(n);
    return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
  };
  const sources = val('--sources', 'wikimedia,openverse,pexels').split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = sources.filter((s) => !SEARCHERS[s]);
  if (unknown.length) throw new Error(`Unknown source(s): ${unknown.join(', ')} (use openverse, wikimedia, pexels)`);
  return {
    apply: has('--apply'),
    force: has('--force'),
    retryMissing: has('--retry-missing'),
    all: has('--all'),
    limit: Number(val('--limit', 0)) || 0,
    foodIds: val('--food', '').split(',').map((s) => s.trim()).filter(Boolean),
    sources,
    delayMs: Number(val('--delay', 1500)), // Wikimedia answered 429 at 1000 ms
    minMatch: Number(val('--min-match', 0.6)),
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.apply) {
    for (const k of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
      if (!process.env[k]) throw new Error(`${k} missing in .env (needed for --apply)`);
    }
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
  if (opts.sources.includes('pexels') && !process.env.PEXELS_API_KEY) {
    console.log('Note: PEXELS_API_KEY not set, Pexels is skipped.');
  }
  if (opts.sources.includes('openverse')) {
    try {
      openverseToken = await openverseAuth();
      console.log(`Openverse: ${openverseToken ? 'authenticated' : 'anonymous (lower rate limit)'}`);
    } catch (err) {
      console.warn(`Openverse auth failed (${err.message}), continuing anonymously.`);
    }
  }

  // Same DB switch as importFoodSeed.js and config/db.js.
  if (!process.env.RENDER && !process.env.VERCEL && !process.env.RAILWAY_ENVIRONMENT_ID && process.env.FORCE_PUBLIC_DNS !== 'false') {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }
  mongoose.set('autoIndex', false);
  const Food = require('../../models/Food');
  const useStaging = process.env.USE_STAGING_DB === 'true';
  const uri = useStaging ? process.env.MONGODB_URI_STAGING : process.env.MONGODB_URI;
  if (!uri) throw new Error('No Mongo URI resolved — check MONGODB_URI / MONGODB_URI_STAGING / USE_STAGING_DB in .env');
  await mongoose.connect(uri);
  const { host, name } = mongoose.connection;
  console.log(`\n>>> Connected to ${useStaging ? 'STAGING' : 'PRODUCTION'} database (${host}/${name})`);

  const filter = { isActive: true, mergedInto: null, 'dataQuality.status': { $ne: 'rejected' } };
  if (opts.foodIds.length) filter.foodId = { $in: opts.foodIds };
  else if (!opts.all) filter['classification.category'] = { $nin: NON_PLAN_CATEGORIES };

  const foods = await Food.find(filter, { foodId: 1, name: 1, aliases: 1, classification: 1, stats: 1, image: 1 })
    .sort({ 'stats.hitCount': -1, foodId: 1 })
    .lean();
  const explicit = opts.foodIds.length > 0;
  let todo = foods.filter((f) => isEligible(f, { ...opts, explicit }));
  if (opts.limit) todo = todo.slice(0, opts.limit);

  console.log(`${opts.apply ? 'APPLYING' : 'DRY RUN'} | sources: ${opts.sources.join(', ')} | min match ${opts.minMatch}`);
  console.log(`  foods matching filter: ${foods.length}`);
  console.log(`  to process:            ${todo.length}${opts.limit ? ` (--limit ${opts.limit})` : ''}`);
  console.log(`  skipped (already have an image or marked missing): ${foods.length - foods.filter((f) => isEligible(f, { ...opts, explicit })).length}\n`);

  const report = [];
  const counts = {};
  const writeReport = () => {
    fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
    fs.writeFileSync(REPORT_FILE, JSON.stringify({
      generatedAt: new Date().toISOString(), mode: opts.apply ? 'apply' : 'dry-run', options: opts, counts, foods: report,
    }, null, 2));
  };

  let stopping = false;
  process.on('SIGINT', () => {
    if (stopping) process.exit(130);
    stopping = true;
    console.log('\nStopping after the current food (Ctrl+C again to quit now)…');
  });

  for (let i = 0; i < todo.length && !stopping; i++) {
    const food = todo[i];
    let row;
    try {
      row = await processFood(Food, food, opts);
    } catch (err) {
      row = { foodId: food.foodId, name: food.name, result: 'error', errors: [err.message] };
    }
    report.push(row);
    counts[row.result] = (counts[row.result] || 0) + 1;
    const detail = row.chosen
      ? `${row.chosen.source} ${row.chosen.license} score ${row.chosen.matchScore} "${row.chosen.title}"`
      : (row.errors?.[0] || 'no usable photo');
    console.log(`  [${i + 1}/${todo.length}] ${row.result.padEnd(8)} ${food.foodId} ${food.name} → ${detail}`);
    if ((i + 1) % 25 === 0) writeReport(); // survive a crash halfway through a long run
  }

  writeReport();
  console.log(`\nDone. ${Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(', ') || 'nothing processed'}`);
  console.log(`Report: ${path.relative(process.cwd(), REPORT_FILE)}`);
  if (!opts.apply) console.log('Dry run only: nothing uploaded or saved. Check the report, then re-run with --apply.');
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = {
  findCandidates,
  coreTokens,
  wikimediaThumbUrl,
  openverseLicense, wikimediaLicense, matchScore, titlePrecision, rejectReason, rankCandidates, queriesFor, attributionLine, isEligible,
};
