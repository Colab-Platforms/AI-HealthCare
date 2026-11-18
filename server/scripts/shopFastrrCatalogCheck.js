// Checks our Fastrr catalog APIs against Fastrr's "SRC Custom Integration"
// Postman doc (Fetch Products / Fetch Collections / Fetch Products by Collection).
// Read-only: only GET requests to the public catalog endpoints.
//
// Usage (from server/):
//   node scripts/shopFastrrCatalogCheck.js                       -> http://localhost:5000
//   node scripts/shopFastrrCatalogCheck.js https://www.take.health
//   node scripts/shopFastrrCatalogCheck.js https://ai-healthcare-1-0i51.onrender.com
//
// Exit code 0 = everything matches the doc, 1 = at least one error.

const BASE = (process.argv[2] || 'http://localhost:5000').replace(/\/+$/, '');
const LIMIT = 100;
const MAX_PAGES = 50; // safety stop

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

const isStr = (v) => typeof v === 'string';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isLong = (v) => Number.isSafeInteger(v) && v > 0;
const isDecimalStr = (v) => isStr(v) && /^\d+(\.\d{1,2})?$/.test(v);
const isIsoDate = (v) => isStr(v) && !Number.isNaN(Date.parse(v));

const get = async (path) => {
    const url = `${BASE}${path}`;
    const started = Date.now();
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const ms = Date.now() - started;
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = null; }
    return { url, status: res.status, ms, body, type: res.headers.get('content-type') || '' };
};

// Shape of one GET page: { data: { total, <key>[] } }
const checkPage = (r, key) => {
    if (r.status !== 200) { err(r.url, `HTTP ${r.status} (expected 200)`); return null; }
    if (!r.type.includes('application/json')) err(r.url, `content-type "${r.type}" (expected application/json)`);
    if (!r.body || typeof r.body !== 'object') { err(r.url, 'body is not JSON'); return null; }
    if (!r.body.data || typeof r.body.data !== 'object') { err(r.url, 'missing "data" wrapper'); return null; }
    if (!isNum(r.body.data.total)) err(r.url, '"data.total" is not a number');
    if (!Array.isArray(r.body.data[key])) { err(r.url, `"data.${key}" is not an array`); return null; }
    if (r.ms > 5000) warn(r.url, `slow response: ${r.ms} ms`);
    return r.body.data;
};

const checkImage = (where, img, required) => {
    if (img === null || img === undefined) {
        (required ? err : warn)(where, 'image is null (set SHOP_PLACEHOLDER_IMAGE_URL so it is always an object)');
        return;
    }
    if (typeof img !== 'object' || !isStr(img.src) || !/^https?:\/\//.test(img.src)) err(where, 'image must be { src: "https://..." }');
};

const checkVariant = (pw, v, variantIds) => {
    const w = `${pw} variant ${v?.id}`;
    if (!isLong(v.id)) err(w, 'id must be a long integer');
    else if (variantIds.has(v.id)) err(w, 'duplicate variant id');
    else variantIds.add(v.id);
    if (!isStr(v.title)) err(w, 'title must be a string');
    if (!isDecimalStr(v.price)) err(w, `price must be a decimal string, got ${JSON.stringify(v.price)}`);
    if (!isDecimalStr(v.compare_at_price)) err(w, `compare_at_price must be a decimal string, got ${JSON.stringify(v.compare_at_price)}`);
    if (isDecimalStr(v.price) && isDecimalStr(v.compare_at_price) && Number(v.compare_at_price) < Number(v.price)) err(w, 'compare_at_price is below price');
    if (!isStr(v.sku)) err(w, 'sku must be a string');
    else if (!v.sku) warn(w, 'empty sku');
    if (!Number.isInteger(v.quantity) || v.quantity < 0) err(w, 'quantity must be an integer >= 0');
    if (!isIsoDate(v.created_at)) err(w, 'created_at is not a date');
    if (!isIsoDate(v.updated_at)) err(w, 'updated_at is not a date');
    if (typeof v.taxable !== 'boolean') err(w, 'taxable must be true/false');
    if (!v.option_values || typeof v.option_values !== 'object' || Array.isArray(v.option_values)) err(w, 'option_values must be an object like { Size: "M" }');
    if (!isNum(v.grams)) err(w, 'grams must be a number');
    else if (v.grams === 0) warn(w, 'grams = 0 (no weight in Shopify -> shipping estimate may be off)');
    if (!isNum(v.weight)) err(w, 'weight must be a number');
    if (!isStr(v.weight_unit) || !v.weight_unit) err(w, 'weight_unit must be a string');
    checkImage(w, v.image, true);
};

const checkProduct = (p, productIds, variantIds) => {
    const w = `product ${p?.id} (${p?.handle})`;
    if (!isLong(p.id)) err(w, 'id must be a long integer');
    else if (productIds.has(p.id)) err(w, 'duplicate product id');
    else productIds.add(p.id);
    for (const k of ['title', 'body_html', 'vendor', 'product_type', 'handle', 'tags', 'status']) {
        if (!isStr(p[k])) err(w, `${k} must be a string`);
    }
    if (isStr(p.title) && !p.title) err(w, 'empty title');
    if (isStr(p.status) && !['active', 'draft', 'archived'].includes(p.status)) err(w, `unknown status "${p.status}"`);
    if (!isIsoDate(p.created_at)) err(w, 'created_at is not a date');
    if (!isIsoDate(p.updated_at)) err(w, 'updated_at is not a date');
    checkImage(w, p.image, true);
    if (!Array.isArray(p.options)) err(w, 'options must be an array');
    else for (const o of p.options) {
        if (!isStr(o?.name) || !Array.isArray(o?.values)) err(w, 'each option must be { name, values[] }');
    }
    if (!Array.isArray(p.variants)) { err(w, 'variants must be an array'); return; }
    if (!p.variants.length && p.status === 'active') warn(w, 'active product with no variants');
    for (const v of p.variants) {
        checkVariant(w, v, variantIds);
        // option_values keys must be option names from the product's options list
        if (Array.isArray(p.options) && v.option_values && typeof v.option_values === 'object') {
            const names = new Set(p.options.map((o) => o.name));
            for (const [k, val] of Object.entries(v.option_values)) {
                if (!names.has(k)) err(`${w} variant ${v.id}`, `option_values key "${k}" not in product options`);
                else if (!p.options.find((o) => o.name === k).values.includes(val)) err(`${w} variant ${v.id}`, `option value "${val}" not in options["${k}"].values`);
            }
        }
    }
};

const checkCollection = (c, ids) => {
    const w = `collection ${c?.id} (${c?.handle})`;
    if (!isLong(c.id)) err(w, 'id must be a long integer');
    else if (ids.has(c.id)) err(w, 'duplicate collection id');
    else ids.add(c.id);
    for (const k of ['body_html', 'handle', 'title']) if (!isStr(c[k])) err(w, `${k} must be a string`);
    if (!isIsoDate(c.created_at)) err(w, 'created_at is not a date');
    if (!isIsoDate(c.updated_at)) err(w, 'updated_at is not a date');
    checkImage(w, c.image, false);
};

// Walks every page of a list endpoint and checks total == items returned.
const walk = async (path, key, eachItem) => {
    const items = [];
    let total = null;
    for (let page = 1; page <= MAX_PAGES; page++) {
        const sep = path.includes('?') ? '&' : '?';
        const data = checkPage(await get(`${path}${sep}page=${page}&limit=${LIMIT}`), key);
        if (!data) break;
        total = data.total;
        data[key].forEach(eachItem);
        items.push(...data[key]);
        if (data[key].length < LIMIT || items.length >= total) break;
    }
    if (isNum(total) && total !== items.length) err(path, `data.total = ${total} but pages returned ${items.length} items`);
    return { items, total };
};

const main = async () => {
    console.log(`Checking Fastrr catalog APIs on ${BASE}\n`);

    // 1. Fetch Products
    const productIds = new Set();
    const variantIds = new Set();
    const products = await walk('/api/shop/fastrr/products', 'products', (p) => checkProduct(p, productIds, variantIds));
    const variantCount = products.items.reduce((n, p) => n + (p.variants?.length || 0), 0);
    console.log(`1. Products:     total=${products.total}, got ${products.items.length} products / ${variantCount} variants`);

    // 2. Fetch Collections
    const collectionIds = new Set();
    const collections = await walk('/api/shop/fastrr/collections', 'collections', (c) => checkCollection(c, collectionIds));
    console.log(`2. Collections:  total=${collections.total}, got ${collections.items.length}`);

    // 3. Products by Collection (every collection)
    let linked = 0;
    for (const c of collections.items) {
        const seen = new Set();
        const r = await walk(`/api/shop/fastrr/collection-products?collection_id=${c.id}`, 'products', (p) => checkProduct(p, seen, new Set()));
        linked += r.items.length;
        for (const p of r.items) {
            if (!productIds.has(p.id)) err(`collection ${c.id}`, `product ${p.id} is not in /fastrr/products`);
        }
        console.log(`3. Collection "${c.title}" (${c.id}): ${r.items.length} products`);
    }
    if (!collections.items.length) warn('collections', 'no collections -> products-by-collection not tested');

    // Missing collection_id must be a 400, not a crash
    const bad = await get('/api/shop/fastrr/collection-products?page=1&limit=1');
    if (bad.status !== 400) err(bad.url, `without collection_id expected 400, got ${bad.status}`);

    // Print one sample so it can be eyeballed against the doc
    if (products.items[0]) {
        const s = { ...products.items[0], body_html: `${String(products.items[0].body_html).slice(0, 60)}...`, variants: products.items[0].variants.slice(0, 1) };
        console.log('\nSample product (first variant only):\n' + JSON.stringify(s, null, 2));
    }
    if (collections.items[0]) {
        console.log('\nSample collection:\n' + JSON.stringify({ ...collections.items[0], body_html: `${String(collections.items[0].body_html).slice(0, 60)}...` }, null, 2));
    }

    console.log(`\nWarnings (${warnings.length}):`);
    [...new Set(warnings)].slice(0, 40).forEach((w) => console.log(`  ! ${w}`));
    console.log(`\nErrors (${errors.length}):`);
    [...new Set(errors)].slice(0, 40).forEach((e) => console.log(`  x ${e}`));
    console.log(errors.length ? '\nRESULT: FAIL - fix the errors above before sharing with Fastrr' : '\nRESULT: PASS - matches the Fastrr doc format');
    process.exit(errors.length ? 1 : 0);
};

main().catch((e) => {
    console.error(`Could not reach ${BASE}: ${e.message}`);
    process.exit(1);
});
