const express = require('express');
const router = express.Router();
const shopifyOfferService = require('../services/shopifyOfferService');
const { verifyShopifyHmac } = require('../utils/shopifyOrder');

/**
 * POST /api/shopify/webhooks
 * Shopify order webhooks (orders/create, orders/paid, orders/cancelled,
 * refunds/create) for the card offer. Not behind `protect` — Shopify has no user
 * session — so the HMAC signature is the only gate, and it fails closed.
 *
 * Which secret signs them depends on where the webhook was created:
 *   - Shopify Admin > Settings > Notifications > Webhooks -> the store's webhook
 *     signing key shown on that page (SHOPIFY_WEBHOOK_SECRET)
 *   - via an app / the API (scripts/registerShopifyWebhooks.js) -> that app's
 *     client secret (SHOPIFY_CLIENT_SECRET)
 *
 * The signature covers the exact raw bytes; server.js's express.json `verify`
 * hook stores them on req.rawBody.
 */
router.post('/webhooks', async (req, res) => {
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_CLIENT_SECRET;
    if (!secret) {
        console.error('[Shopify webhook] SHOPIFY_WEBHOOK_SECRET / SHOPIFY_CLIENT_SECRET not set — rejecting');
        return res.status(503).json({ message: 'Webhook verification unavailable' });
    }
    const topic = req.get('X-Shopify-Topic');
    if (!verifyShopifyHmac(req.rawBody, req.get('X-Shopify-Hmac-Sha256'), secret)) {
        // Logged because a wrong/rotated secret otherwise fails silently on every delivery.
        console.warn(`[Shopify webhook] ${topic || '?'} rejected: invalid signature`);
        return res.status(401).json({ message: 'Invalid signature' });
    }
    const expectedShop = process.env.SHOPIFY_ADMIN_STORE_DOMAIN; // the retail store, not the Fastrr one
    const shop = req.get('X-Shopify-Shop-Domain');
    if (expectedShop && shop && shop.toLowerCase() !== expectedShop.toLowerCase()) {
        console.warn(`[Shopify webhook] ${topic || '?'} rejected: unknown shop ${shop}`);
        return res.status(401).json({ message: 'Unknown shop' });
    }

    try {
        const result = await shopifyOfferService.handleWebhook({
            topic,
            webhookId: req.get('X-Shopify-Webhook-Id') || req.get('X-Shopify-Event-Id'),
            rawBody: req.rawBody,
            body: req.body,
        });
        // One line per delivery, so "did Shopify's webhook arrive and what did it
        // do" can be read from the host logs. Order number and outcome only — no
        // customer data.
        const outcome = result.duplicate ? 'duplicate'
            : result.ignored ? `ignored${typeof result.ignored === 'string' ? ` (${result.ignored})` : ''}`
                : `eligible=${result.eligible} granted=${Boolean(result.granted)} revoked=${Boolean(result.revoked)}`;
        console.log(`[Shopify webhook] ${topic} ${result.orderName || '-'} -> ${outcome}`);
        res.status(200).json({ received: true, ...result });
    } catch (error) {
        console.error(`[Shopify webhook] ${topic} processing failed:`, error.message);
        // Non-2xx so Shopify retries; processing is idempotent.
        res.status(500).json({ received: false });
    }
});

module.exports = router;
