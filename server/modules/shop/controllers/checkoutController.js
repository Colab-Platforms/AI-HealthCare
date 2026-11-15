const checkoutService = require('../services/checkoutService');
const orderService = require('../services/orderService');
const fastrrOrderService = require('../services/fastrrOrderService');
const config = require('../config');
const { sendError } = require('../lib/shopError');

// Public origin of this backend. SHOP_PUBLIC_BASE_URL in production; locally /
// in tests, whatever host the request came in on.
const baseUrlOf = (req) => {
    const configured = config.publicBaseUrl();
    if (configured) return configured;
    const proto = String(req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
    return `${proto}://${req.get('host')}`;
};

// The page HTML holds a payment token: never cache it, never leak it via Referer.
const sendPage = (res, { status, html }) => {
    res.set({
        'Cache-Control': 'no-store, max-age=0',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow',
        'Content-Type': 'text/html; charset=utf-8',
    });
    res.status(status).send(html);
};

// ── App (protect) ──────────────────────────────────────────────────────────

// POST /api/shop/checkout   header: Idempotency-Key   (body.idempotencyKey also accepted)
exports.startCheckout = async (req, res) => {
    try {
        const idempotencyKey = req.get('Idempotency-Key') || req.body?.idempotencyKey;
        res.json(await checkoutService.startCheckout(req.user._id, { idempotencyKey, baseUrl: baseUrlOf(req) }));
    } catch (err) {
        sendError(res, err, 'Shop/startCheckout');
    }
};

// GET /api/shop/orders?cursor=&limit=
exports.listOrders = async (req, res) => {
    try {
        res.json(await orderService.listOrders(req.user._id, { cursor: req.query.cursor, limit: req.query.limit }));
    } catch (err) {
        sendError(res, err, 'Shop/listOrders');
    }
};

// GET /api/shop/orders/:orderId
exports.getOrder = async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store');
        res.json(await orderService.getOrder(req.user._id, req.params.orderId));
    } catch (err) {
        sendError(res, err, 'Shop/getOrder');
    }
};

// ── WebView (no Bearer token: the page link is signed instead) ─────────────

// GET /api/shop/checkout/:orderId/page?exp=&sig=
exports.checkoutPage = async (req, res) => {
    try {
        sendPage(res, await checkoutService.checkoutPage({
            orderId: req.params.orderId, exp: req.query.exp, sig: req.query.sig, baseUrl: baseUrlOf(req),
        }));
    } catch (err) {
        console.error('[Shop/checkoutPage]', err.message);
        res.status(500).type('text/plain').send('Something went wrong');
    }
};

// GET /api/shop/checkout/:orderId/return?oid=&ost=   (Fastrr redirect_url)
exports.checkoutReturn = async (req, res) => {
    try {
        sendPage(res, await checkoutService.checkoutReturn({ orderId: req.params.orderId, oid: req.query.oid }));
    } catch (err) {
        console.error('[Shop/checkoutReturn]', err.message);
        res.status(500).type('text/plain').send('Something went wrong');
    }
};

// ── Fastrr -> us ───────────────────────────────────────────────────────────

// POST /api/shop/fastrr/webhook   (unsigned; see fastrrOrderService.handleWebhook)
exports.fastrrWebhook = async (req, res) => {
    try {
        const r = await fastrrOrderService.handleWebhook(req.body);
        const tag = r.ignored ? `ignored (${r.ignored})` : r.duplicate ? 'duplicate' : `${r.result} -> ${r.status}`;
        console.log(`[Shop/fastrrWebhook] ${r.orderId || String(req.body?.order_id || '-').slice(0, 64)}: ${tag}`);
        if (r.httpStatus === 400) {
            return res.status(400).json({ received: false, code: 'INVALID_ORDER_ID', message: 'order_id is missing or malformed' });
        }
        res.status(200).json({ received: true });
    } catch (err) {
        // Non-2xx so Fastrr retries; the reconciliation cron is the backup.
        console.error('[Shop/fastrrWebhook] failed:', err.message);
        res.status(500).json({ received: false });
    }
};

// ── Internal (QStash schedule) ─────────────────────────────────────────────

// POST /api/shop/internal/reconcile-orders
exports.runReconciliation = async (req, res) => {
    try {
        res.json({ ok: true, stats: await fastrrOrderService.reconcile() });
    } catch (err) {
        console.error('[Shop/reconcile] failed:', err.message);
        res.status(500).json({ ok: false }); // QStash retries
    }
};

exports._internal = { baseUrlOf };
