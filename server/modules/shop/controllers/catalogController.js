const catalogService = require('../services/catalogService');
const catalogSyncService = require('../services/catalogSyncService');
const { sendError } = require('../lib/shopError');

// ── App ────────────────────────────────────────────────────────────────────

// GET /api/shop/products?cursor=&limit=&q=&collection=
exports.listProducts = async (req, res) => {
    try {
        const { cursor, limit, q, collection } = req.query;
        res.json(await catalogService.listProducts({ cursor, limit, q, collection }));
    } catch (err) {
        sendError(res, err, 'Shop/listProducts');
    }
};

// GET /api/shop/products/:handle   (handle or Shopify product id)
exports.getProduct = async (req, res) => {
    try {
        res.json(await catalogService.getProduct(req.params.handle));
    } catch (err) {
        sendError(res, err, 'Shop/getProduct');
    }
};

// GET /api/shop/collections
exports.listCollections = async (req, res) => {
    try {
        res.json({ items: await catalogService.listCollections() });
    } catch (err) {
        sendError(res, err, 'Shop/listCollections');
    }
};

// ── Fastrr catalog pull (shape fixed by Fastrr's docs) ────────────────────

// GET /api/shop/fastrr/products?page=&limit=
exports.fastrrProducts = async (req, res) => {
    try {
        res.json(await catalogService.fastrrProducts({ page: req.query.page, limit: req.query.limit }));
    } catch (err) {
        sendError(res, err, 'Shop/fastrrProducts');
    }
};

// GET /api/shop/fastrr/collections?page=&limit=
exports.fastrrCollections = async (req, res) => {
    try {
        res.json(await catalogService.fastrrCollections({ page: req.query.page, limit: req.query.limit }));
    } catch (err) {
        sendError(res, err, 'Shop/fastrrCollections');
    }
};

// GET /api/shop/fastrr/collection-products?collection_id=&page=&limit=
exports.fastrrCollectionProducts = async (req, res) => {
    const collectionId = String(req.query.collection_id || '');
    if (!/^\d+$/.test(collectionId)) {
        return res.status(400).json({ code: 'COLLECTION_ID_REQUIRED', message: 'collection_id is required' });
    }
    try {
        res.json(await catalogService.fastrrProducts({ page: req.query.page, limit: req.query.limit, collectionId }));
    } catch (err) {
        sendError(res, err, 'Shop/fastrrCollectionProducts');
    }
};

// ── Internal (QStash daily schedule) ───────────────────────────────────────

// POST /api/shop/internal/catalog-sync
exports.runCatalogSync = async (req, res) => {
    try {
        const stats = await catalogSyncService.fullSync();
        res.json({ ok: true, stats });
    } catch (err) {
        console.error('[Shop/catalogSync] failed:', err.message);
        res.status(500).json({ ok: false }); // non-2xx so QStash retries
    }
};
