// Read side of the catalog — served entirely from our DB (never a live Shopify
// call), so browsing is fast and keeps working if Shopify is slow or down.

const mongoose = require('mongoose');
const Product = require('../models/Product');
const Collection = require('../models/Collection');
const config = require('../config');
const { ShopError } = require('../lib/shopError');
const {
    toAppProductSummary, toAppProductDetail, toAppCollection, toFastrrProduct, toFastrrCollection,
} = require('../lib/catalogMapper');

const LIST_SORT = { shopifyCreatedAt: -1, _id: -1 };

// ── Cursor (opaque to the app): base64url of { t: createdAt, id: _id } ─────

const encodeCursor = (doc) =>
    Buffer.from(JSON.stringify({ t: doc.shopifyCreatedAt?.toISOString() || null, id: String(doc._id) })).toString('base64url');

const decodeCursor = (cursor) => {
    try {
        const { t, id } = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
        if (!mongoose.isValidObjectId(id)) return null;
        return { t: t ? new Date(t) : null, id: new mongoose.Types.ObjectId(id) };
    } catch {
        return null;
    }
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const clampInt = (value, { min, max, fallback }) => {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
};

// ── App ────────────────────────────────────────────────────────────────────

const resolveCollectionId = async (collection) => {
    const c = await Collection.findOne({
        status: 'active',
        $or: [{ handle: collection }, { shopifyCollectionId: collection }],
    }).select('shopifyCollectionId').lean();
    return c?.shopifyCollectionId || null;
};

const listProducts = async ({ cursor, limit, q, collection } = {}) => {
    const pageSize = clampInt(limit, { min: 1, max: config.maxPageSize, fallback: config.defaultPageSize });
    const filter = { status: 'active' };

    if (q) {
        const term = String(q).trim().slice(0, 100);
        if (term) filter.title = { $regex: escapeRegex(term), $options: 'i' };
    }
    if (collection) {
        const id = await resolveCollectionId(String(collection));
        if (!id) return { items: [], nextCursor: null };
        filter['collections.shopifyCollectionId'] = id;
    }
    if (cursor) {
        const c = decodeCursor(cursor);
        if (!c) throw new ShopError(400, 'INVALID_CURSOR', 'Invalid cursor');
        filter.$or = [
            { shopifyCreatedAt: { $lt: c.t } },
            { shopifyCreatedAt: c.t, _id: { $lt: c.id } },
        ];
    }

    // Fetch one extra to know whether another page exists.
    const docs = await Product.find(filter).sort(LIST_SORT).limit(pageSize + 1).lean();
    const hasMore = docs.length > pageSize;
    const page = hasMore ? docs.slice(0, pageSize) : docs;
    return {
        items: page.map(toAppProductSummary),
        nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
    };
};

const getProduct = async (handleOrId) => {
    const key = String(handleOrId);
    const doc = await Product.findOne({
        status: 'active',
        $or: [{ handle: key }, { shopifyProductId: key }],
    }).lean();
    if (!doc) throw new ShopError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
    return toAppProductDetail(doc);
};

const listCollections = async () => {
    const docs = await Collection.find({ status: 'active' }).sort({ title: 1 }).lean();
    return docs.map(toAppCollection);
};

// ── Fastrr catalog APIs (page / limit, page starts at 1) ───────────────────

const fastrrPaging = ({ page, limit }) => {
    const p = clampInt(page, { min: 1, max: 100000, fallback: 1 });
    const l = clampInt(limit, { min: 1, max: config.fastrrMaxLimit, fallback: 100 });
    return { skip: (p - 1) * l, limit: l };
};

// Deleted products are left out; draft/archived are sent with status "draft"
// so Fastrr stops selling them.
const FASTRR_PRODUCT_FILTER = { status: { $ne: 'deleted' } };

const fastrrProducts = async ({ page, limit, collectionId } = {}) => {
    const { skip, limit: l } = fastrrPaging({ page, limit });
    const filter = { ...FASTRR_PRODUCT_FILTER };
    if (collectionId !== undefined) filter['collections.shopifyCollectionId'] = String(collectionId);
    const [total, docs] = await Promise.all([
        Product.countDocuments(filter),
        Product.find(filter).sort({ _id: 1 }).skip(skip).limit(l).lean(),
    ]);
    return { data: { total, products: docs.map(toFastrrProduct) } };
};

const fastrrCollections = async ({ page, limit } = {}) => {
    const { skip, limit: l } = fastrrPaging({ page, limit });
    const filter = { status: 'active' };
    const [total, docs] = await Promise.all([
        Collection.countDocuments(filter),
        Collection.find(filter).sort({ _id: 1 }).skip(skip).limit(l).lean(),
    ]);
    return { data: { total, collections: docs.map(toFastrrCollection) } };
};

module.exports = {
    listProducts,
    getProduct,
    listCollections,
    fastrrProducts,
    fastrrCollections,
    _internal: { encodeCursor, decodeCursor, escapeRegex, clampInt, fastrrPaging },
};
