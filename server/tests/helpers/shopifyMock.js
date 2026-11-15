// Local stand-in for the Shopify Admin GraphQL API — just the order calls the
// shop makes (orderCreate, orders(query: "tag:..."), order(id)). Behaves like
// the real API where it matters for us:
//   - X-Shopify-Access-Token required (401 otherwise)
//   - unknown variant / bad phone / bad province -> userErrors (order not created)
//   - inventoryBehaviour DECREMENT_* reduces stock, BYPASS doesn't
//   - test, tags, transactions / financialStatus recorded as sent
// Tests script it via state.next (forced failures), and the helpers
// fulfil / deliver / cancel / markPaid to simulate the warehouse.

const http = require('http');

const TOKEN = 'test-shopify-token';
const PROVINCES = new Set(['AN', 'AP', 'AR', 'AS', 'BR', 'CH', 'CG', 'DN', 'DD', 'DL', 'GA', 'GJ', 'HR', 'HP', 'JK', 'JH', 'KA', 'KL', 'LA', 'LD', 'MP', 'MH', 'MN', 'ML', 'MZ', 'NL', 'OR', 'PY', 'PB', 'RJ', 'SK', 'TN', 'TS', 'TR', 'UP', 'UK', 'WB']);

const legacy = (gid) => String(gid).split('/').pop();

const startShopifyMock = async ({ variants = {} } = {}) => {
    const state = {
        calls: [],             // { op, variables }
        orders: [],            // created order nodes (+ _variables)
        inventory: { ...variants }, // variantId -> qty
        next: [],              // { op: 'create'|'search'|'fetch', status, body, createThenFail }
        seq: 0,
    };

    const findNext = (op) => {
        const i = state.next.findIndex((n) => n.op === op);
        return i >= 0 ? state.next.splice(i, 1)[0] : null;
    };

    const createOrder = ({ order, options }) => {
        const userErrors = [];
        (order.lineItems || []).forEach((li, i) => {
            if (!(legacy(li.variantId) in state.inventory)) userErrors.push({ field: ['order', 'lineItems', String(i), 'variantId'], message: 'Variant not found', code: 'INVALID' });
            if (!(li.quantity > 0)) userErrors.push({ field: ['order', 'lineItems', String(i), 'quantity'], message: 'Quantity must be positive', code: 'INVALID' });
        });
        for (const [k, a] of [['shippingAddress', order.shippingAddress], ['billingAddress', order.billingAddress]]) {
            if (a?.provinceCode && !PROVINCES.has(a.provinceCode)) userErrors.push({ field: ['order', k, 'provinceCode'], message: 'Province is invalid', code: 'INVALID' });
            if (a?.phone && !/^\+\d{10,15}$/.test(a.phone)) userErrors.push({ field: ['order', k, 'phone'], message: 'Phone is invalid', code: 'INVALID' });
        }
        if (order.phone && !/^\+\d{10,15}$/.test(order.phone)) userErrors.push({ field: ['order', 'phone'], message: 'Phone is invalid', code: 'INVALID' });
        if (!Array.isArray(order.tags)) userErrors.push({ field: ['order', 'tags'], message: 'Tags must be a list', code: 'INVALID' });
        if (order.transactions && order.financialStatus) userErrors.push({ field: ['order'], message: 'Use transactions or financialStatus, not both', code: 'INVALID' });
        if (userErrors.length) return { order: null, userErrors };

        if (options?.inventoryBehaviour && options.inventoryBehaviour !== 'BYPASS') {
            for (const li of order.lineItems) state.inventory[legacy(li.variantId)] -= li.quantity;
        }
        state.seq += 1;
        const id = 6000000000000 + state.seq;
        const node = {
            id: `gid://shopify/Order/${id}`,
            legacyResourceId: String(id),
            name: `#TAKE${11000 + state.seq}`,
            tags: [...order.tags],
            test: Boolean(order.test),
            cancelledAt: null,
            displayFinancialStatus: order.transactions?.length ? 'PAID' : (order.financialStatus || 'PENDING'),
            displayFulfillmentStatus: 'UNFULFILLED',
            fulfillments: [],
            _variables: { order, options },
        };
        state.orders.push(node);
        return { order: node, userErrors: [] };
    };

    const publicNode = (n) => { const { _variables, ...rest } = n; return rest; };

    const server = http.createServer((req, res) => {
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', () => {
            const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
            if (req.headers['x-shopify-access-token'] !== TOKEN) return send(401, { errors: '[API] Invalid API key or access token' });
            if (!/\/admin\/api\/[^/]+\/graphql\.json$/.test(req.url)) return send(404, { errors: 'Not Found' });
            const { query = '', variables = {} } = JSON.parse(raw || '{}');
            const op = query.includes('orderCreate(') ? 'create' : query.includes('orders(') ? 'search' : query.includes('order(') ? 'fetch' : 'other';
            state.calls.push({ op, variables });

            const forced = findNext(op);
            if (forced?.createThenFail) {
                createOrder(variables); // Shopify made it, but we never hear back
                return send(forced.status || 502, { errors: 'Bad gateway' });
            }
            if (forced) return send(forced.status ?? 200, forced.body ?? {});

            switch (op) {
                case 'create': {
                    const r = createOrder(variables);
                    return send(200, { data: { orderCreate: { order: r.order && publicNode(r.order), userErrors: r.userErrors } } });
                }
                case 'search': {
                    const m = /tag:'([^']+)'/.exec(variables.q || '');
                    const nodes = m ? state.orders.filter((o) => o.tags.includes(m[1])) : [];
                    return send(200, { data: { orders: { nodes: nodes.slice(0, 5).map(publicNode) } } });
                }
                case 'fetch': {
                    const o = state.orders.find((x) => x.id === variables.id);
                    return send(200, { data: { order: o ? publicNode(o) : null } });
                }
                default:
                    return send(200, { errors: [{ message: 'unsupported in mock' }] });
            }
        });
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));

    const byTag = (tag) => state.orders.find((o) => o.tags.includes(tag));
    return {
        baseUrl: `http://127.0.0.1:${server.address().port}`,
        state,
        byTag,
        callsOf: (op) => state.calls.filter((c) => c.op === op),
        // warehouse actions
        fulfil: (tag, { company = 'Delhivery', number = 'AWB123', url = 'https://track/AWB123', partial = false } = {}) => {
            const o = byTag(tag);
            o.fulfillments.push({ createdAt: new Date().toISOString(), displayStatus: 'IN_TRANSIT', deliveredAt: null, trackingInfo: [{ company, number, url }] });
            o.displayFulfillmentStatus = partial ? 'PARTIALLY_FULFILLED' : 'FULFILLED';
            return o;
        },
        deliver: (tag) => {
            const o = byTag(tag);
            o.fulfillments.forEach((f) => { f.displayStatus = 'DELIVERED'; f.deliveredAt = new Date().toISOString(); });
            o.displayFulfillmentStatus = 'FULFILLED';
            return o;
        },
        cancel: (tag) => { const o = byTag(tag); o.cancelledAt = new Date().toISOString(); return o; },
        markPaid: (tag) => { const o = byTag(tag); o.displayFinancialStatus = 'PAID'; return o; },
        reset: () => { state.calls.length = 0; state.orders.length = 0; state.next.length = 0; state.seq = 0; state.inventory = { ...variants }; },
        close: () => new Promise((r) => server.close(r)),
    };
};

module.exports = { startShopifyMock, TOKEN };
