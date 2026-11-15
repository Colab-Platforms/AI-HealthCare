// Pure numbers for the shop admin overview — no DB, unit-tested directly.
// Days are India days (IST). Money in paise, returned as { paise, rupees }.

const { money, displayStatus, PLACED_PAYMENT_STATES } = require('./orderView');

const IST_MS = 330 * 60 * 1000;
const dayKey = (d) => new Date(new Date(d).getTime() + IST_MS).toISOString().slice(0, 10);
const startOfIstDay = (ms) => {
    const ist = new Date(ms + IST_MS);
    return Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_MS;
};

const RANGES = { today: 1, '7d': 7, '30d': 30, '90d': 90 };

/** Window [from, now] for a range key; 'today' starts at IST midnight. */
const rangeWindow = (range, now = Date.now()) => {
    const days = RANGES[range] || RANGES['7d'];
    const from = startOfIstDay(now) - (days - 1) * 24 * 60 * 60 * 1000;
    return { from: new Date(from), to: new Date(now), days, range: RANGES[range] ? range : '7d' };
};

const total = (o) => o.pricing?.total ?? o.amount ?? 0;
const isPlaced = (o) => PLACED_PAYMENT_STATES.includes(o.paymentStatus) && o.placedAt;

/**
 * @param {object} p
 * @param {Array}  p.orders   orders created / placed / refunded in the window (lean)
 * @param {Array}  p.events   shop events in the window: { type, user }
 * @param {object} p.window   from rangeWindow()
 * @param {number} [p.now]
 */
const computeOverview = ({ orders, events, window, now = Date.now() }) => {
    const from = window.from.getTime();
    const inWin = (d) => d && new Date(d).getTime() >= from && new Date(d).getTime() <= now;

    const placed = orders.filter((o) => isPlaced(o) && inWin(o.placedAt));
    const gross = placed.reduce((n, o) => n + total(o), 0);
    const refunded = orders.flatMap((o) => o.refunds || [])
        .filter((r) => r.kind !== 'duplicate_payment' && r.status === 'completed' && inWin(r.completedAt))
        .reduce((n, r) => n + r.amount, 0);
    const cancelled = placed.filter((o) => o.fulfillmentStatus === 'cancelled' || o.paymentStatus === 'cancelled').length;

    const created = orders.filter((o) => inWin(o.createdAt));
    const abandoned = created.filter((o) => ['expired', 'failed'].includes(o.paymentStatus)
        || (o.paymentStatus === 'pending' && now - new Date(o.createdAt).getTime() > 60 * 60 * 1000)).length;

    const usersWith = (type) => new Set(events.filter((e) => e.type === type && e.user).map((e) => String(e.user))).size;

    const products = new Map();
    for (const o of placed) {
        if (o.fulfillmentStatus === 'cancelled' || o.paymentStatus === 'cancelled') continue;
        for (const i of o.items || []) {
            const key = i.productId || i.variantId;
            const p = products.get(key) || { productId: key, title: i.title || key, units: 0, revenuePaise: 0 };
            p.units += i.quantity;
            p.revenuePaise += i.priceSnapshot * i.quantity;
            products.set(key, p);
        }
    }

    const daily = [];
    for (let d = startOfIstDay(from); d <= now; d += 24 * 60 * 60 * 1000) {
        const key = dayKey(d);
        const dayOrders = placed.filter((o) => dayKey(o.placedAt) === key);
        daily.push({ date: key, orders: dayOrders.length, revenue: money(dayOrders.reduce((n, o) => n + total(o), 0)) });
    }

    const byStatus = {};
    for (const o of placed) {
        const s = displayStatus(o);
        byStatus[s] = (byStatus[s] || 0) + 1;
    }

    return {
        range: window.range,
        from: window.from,
        to: window.to,
        orders: {
            placed: placed.length,
            prepaid: placed.filter((o) => o.paymentMethod === 'prepaid').length,
            cod: placed.filter((o) => o.paymentMethod === 'cod').length,
            cancelled,
            byStatus,
        },
        revenue: {
            gross: money(gross),
            refunded: money(refunded),
            net: money(gross - refunded),
            averageOrder: money(placed.length ? Math.round(gross / placed.length) : 0),
        },
        checkouts: { started: created.length, abandoned },
        funnel: {
            viewedProduct: usersWith('product_view'),
            addedToCart: usersWith('cart_add'),
            startedCheckout: usersWith('checkout_start'),
            paid: usersWith('payment_success'),
            anonymousViews: events.filter((e) => e.type === 'product_view' && !e.user).length,
            searches: events.filter((e) => e.type === 'search').length,
        },
        topProducts: [...products.values()].sort((a, b) => b.revenuePaise - a.revenuePaise).slice(0, 5)
            .map((p) => ({ productId: p.productId, title: p.title, units: p.units, revenue: money(p.revenuePaise) })),
        daily,
    };
};

module.exports = { computeOverview, rangeWindow, dayKey, startOfIstDay, RANGES };
