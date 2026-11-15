// Fire-and-forget shop event log (shop_events). Never throws, never awaited on
// the request path; a failed write is only logged. SHOP_EVENTS=false turns it off.

const mongoose = require('mongoose');
const ShopEvent = require('../models/ShopEvent');

const pending = new Set();
const enabled = () => String(process.env.SHOP_EVENTS ?? 'true').toLowerCase() !== 'false';

const asObjectId = (id) => (id && mongoose.isValidObjectId(String(id)) ? new mongoose.Types.ObjectId(String(id)) : null);

// Keep meta small and free of anything sensitive.
const cleanMeta = (meta = {}) => {
    const out = {};
    for (const [k, v] of Object.entries(meta)) {
        if (v === undefined || v === null) continue;
        out[k] = typeof v === 'string' ? v.slice(0, 120) : v;
    }
    return out;
};

/**
 * @param {string} type    one of ShopEvent.TYPES
 * @param {object} data    { user, orderId, productId, variantId, meta }
 */
const track = (type, { user = null, orderId = null, productId = null, variantId = null, meta = {} } = {}) => {
    if (!enabled() || !ShopEvent.TYPES.includes(type)) return;
    const p = new Promise((resolve) => setImmediate(resolve))
        .then(() => ShopEvent.create({
            type,
            user: asObjectId(user),
            orderId: orderId ? String(orderId) : null,
            productId: productId ? String(productId) : null,
            variantId: variantId ? String(variantId) : null,
            meta: cleanMeta(meta),
            createdAt: new Date(),
        }))
        .catch((err) => console.warn(`[Shop/events] ${type} not recorded: ${err.message}`))
        .finally(() => pending.delete(p));
    pending.add(p);
};

/** Tests / scripts: wait until queued events are written. */
const flush = () => Promise.all([...pending]);

module.exports = { track, flush };
