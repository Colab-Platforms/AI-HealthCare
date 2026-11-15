// Fastrr (Shiprocket Checkout) API client — "SRC Custom Integration" docs:
// https://documenter.getpostman.com/view/25617008/2sB34bL3ig
//
// Auth on every call: X-Api-Key + X-Api-HMAC-SHA256 (base64 HMAC-SHA256 of the
// exact raw body with the API secret). Bodies carry an ISO `timestamp`.
//   staging  https://fastrr-api-dev.pickrr.com
//   prod     https://checkout-api.shiprocket.com
//
// Retries (network error / timeout / 429 / 5xx) only where repeating is safe.
// Creating a checkout token is NOT retried after a timeout: the first request
// may have created a Fastrr order already; the caller retries with the same
// idempotency key instead.

const config = require('../config');
const { signBody } = require('../../../utils/fastrrHmac');

class FastrrApiError extends Error {
    /**
     * @param {string}  message
     * @param {object}  [p]
     * @param {number}  [p.status]     HTTP status (0 = no response)
     * @param {string}  [p.code]       Fastrr errorCode / ours
     * @param {boolean} [p.retryable]
     */
    constructor(message, { status = 0, code = null, retryable = false } = {}) {
        super(message);
        this.name = 'FastrrApiError';
        this.status = status;
        this.code = code;
        this.retryable = retryable;
    }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const assertConfigured = () => {
    if (!config.fastrr.isConfigured()) {
        throw new FastrrApiError('Fastrr is not configured (FASTRR_API_KEY / FASTRR_API_SECRET)', { code: 'NOT_CONFIGURED' });
    }
};

/**
 * One signed POST. Returns the parsed JSON body of a 2xx response.
 */
const postOnce = async (url, payload, timeoutMs) => {
    const raw = JSON.stringify(payload);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': config.fastrr.apiKey(),
                'X-Api-HMAC-SHA256': signBody(raw, config.fastrr.apiSecret()),
            },
            body: raw,
            signal: controller.signal,
        });
    } catch (err) {
        const timedOut = err.name === 'AbortError';
        throw new FastrrApiError(timedOut ? `Fastrr timed out after ${timeoutMs}ms` : `Fastrr unreachable: ${err.message}`, {
            code: timedOut ? 'TIMEOUT' : 'NETWORK', retryable: true,
        });
    } finally {
        clearTimeout(timer);
    }

    const text = await res.text().catch(() => '');
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }

    if (!res.ok) {
        // 511 = bad key / HMAC (Fastrr's own status for auth failures).
        const retryable = res.status === 429 || res.status >= 500 && res.status !== 511;
        const msg = json?.error?.message || json?.error || json?.message || text.slice(0, 200) || res.statusText;
        throw new FastrrApiError(`Fastrr HTTP ${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`, {
            status: res.status, code: json?.errorCode || (res.status === 511 ? 'AUTH' : null), retryable,
        });
    }
    if (!json) throw new FastrrApiError('Fastrr returned a non-JSON response', { status: res.status, code: 'BAD_RESPONSE', retryable: true });
    return json;
};

const post = async (path, payload, { maxAttempts = 3, retryTimeouts = true, timeoutMs = config.fastrr.timeoutMs(), timestamp = true } = {}) => {
    assertConfigured();
    const url = `${config.fastrr.baseUrl()}${path}`;
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            // Fresh timestamp (and so a fresh signature) per attempt.
            const body = timestamp ? { ...payload, timestamp: new Date().toISOString() } : payload;
            return await postOnce(url, body, timeoutMs);
        } catch (err) {
            lastErr = err;
            const canRetry = err.retryable && (retryTimeouts || err.code !== 'TIMEOUT');
            if (!canRetry || attempt === maxAttempts) throw err;
            await sleep(250 * attempt);
        }
    }
    throw lastErr;
};

// Fastrr wraps results as { ok, result, error }. ok:false is an application error.
const unwrap = (json, what) => {
    if (json?.ok === false || !json?.result) {
        const e = json?.error;
        const msg = (e && (e.message || (typeof e === 'string' ? e : JSON.stringify(e)))) || `${what} failed`;
        throw new FastrrApiError(`Fastrr ${what}: ${msg}`, { code: json?.errorCode || 'REJECTED' });
    }
    return json.result;
};

// ── Checkout ───────────────────────────────────────────────────────────────

/**
 * @param {object} payload  from lib/checkoutLogic.buildCheckoutTokenPayload
 * @returns {Promise<{ token: string, expiresAt: Date, fastrrOrderId: string }>}
 */
const createCheckoutToken = async (payload) => {
    // Retry only failures where Fastrr surely did nothing (connection refused,
    // 429, 5xx). A timeout might have created an order — don't double up.
    const json = await post('/api/v1/access-token/checkout', payload, { maxAttempts: 2, retryTimeouts: false });
    const result = unwrap(json, 'access-token');
    const token = result.token;
    const fastrrOrderId = result.data?.order_id;
    const expiresAt = result.expires_at ? new Date(result.expires_at) : null;
    if (!token || !fastrrOrderId || !expiresAt || Number.isNaN(expiresAt.getTime())) {
        throw new FastrrApiError('Fastrr access-token response is missing token / order_id / expires_at', { code: 'BAD_RESPONSE' });
    }
    return { token, expiresAt, fastrrOrderId: String(fastrrOrderId) };
};

/** Order Details — the only source we trust for payment state. */
const getOrderDetails = async (fastrrOrderId) => {
    const json = await post('/api/v1/custom-platform-order/details', { order_id: String(fastrrOrderId) });
    return unwrap(json, 'order details');
};

/** Order List (ids + status) for a UTC date window. */
const listOrders = async ({ startDate, endDate, status, page = 0, limit = 250 }) => {
    const body = { startDate: new Date(startDate).toISOString(), endDate: new Date(endDate).toISOString(), page, limit };
    if (status) body.status = status;
    const json = await post('/api/v1/custom-platform-order/details/list', body);
    return unwrap(json, 'order list');
};

// ── Catalog push (best effort; Fastrr also pulls our catalog APIs) ─────────

const pushCatalog = async (path, body) => {
    // Short timeout, one attempt: this runs inside a Shopify webhook request,
    // which Shopify gives ~5s in total.
    const json = await post(path, body, { maxAttempts: 1, timeoutMs: 3000, timestamp: false });
    if (json?.ok === false) throw new FastrrApiError(`Fastrr catalog push rejected: ${JSON.stringify(json.error || json.errorCode)}`, { code: 'REJECTED' });
    return json;
};

const pushProduct = (fastrrProduct) => pushCatalog('/wh/v1/custom/product', fastrrProduct);
const pushCollection = (fastrrCollection) => pushCatalog('/wh/v1/custom/collection', fastrrCollection);

module.exports = {
    FastrrApiError,
    isConfigured: () => config.fastrr.isConfigured(),
    createCheckoutToken,
    getOrderDetails,
    listOrders,
    pushProduct,
    pushCollection,
};
