// Shop routes, mounted at /api/shop.
// Everything is under /api because on Vercel only /api/* reaches the backend —
// anything else is rewritten to the web app's index.html.
//
//   Public (catalog)   GET  /products, /products/:handle, /collections
//   Logged-in (cart)   GET/DELETE /cart, POST /cart/items, PATCH/DELETE /cart/items/:variantId
//   Logged-in (orders) POST /checkout, GET /orders, GET /orders/:orderId
//   WebView (signed)   GET  /checkout/:orderId/page, /checkout/:orderId/return
//   Fastrr pull        GET  /fastrr/products, /fastrr/collections, /fastrr/collection-products
//   Fastrr push        POST /fastrr/webhook
//   QStash             POST /internal/catalog-sync, /internal/reconcile-orders, /internal/shopify-sync

const express = require('express');
const router = express.Router();

const { protect } = require('../../middleware/auth');
const { verifyQStash } = require('../../middleware/qstashAuth');
const { apiLimiter, shopWriteLimiter, shopCheckoutLimiter, shopWebhookLimiter } = require('../../middleware/rateLimit');
const catalog = require('./controllers/catalogController');
const cart = require('./controllers/cartController');
const checkout = require('./controllers/checkoutController');

// Catalog
router.get('/products', apiLimiter, catalog.listProducts);
router.get('/products/:handle', apiLimiter, catalog.getProduct);
router.get('/collections', apiLimiter, catalog.listCollections);

// Fastrr catalog pull. Public product data only (what the app shows anyway).
router.get('/fastrr/products', apiLimiter, catalog.fastrrProducts);
router.get('/fastrr/collections', apiLimiter, catalog.fastrrCollections);
router.get('/fastrr/collection-products', apiLimiter, catalog.fastrrCollectionProducts);

// Fastrr order webhook (unsigned — only used as a pointer for a fetch-back).
router.post('/fastrr/webhook', shopWebhookLimiter, checkout.fastrrWebhook);

// Cart
router.get('/cart', protect, apiLimiter, cart.getCart);
router.delete('/cart', protect, shopWriteLimiter, cart.clearCart);
router.post('/cart/items', protect, shopWriteLimiter, cart.addItem);
router.patch('/cart/items/:variantId', protect, shopWriteLimiter, cart.setQuantity);
router.delete('/cart/items/:variantId', protect, shopWriteLimiter, cart.removeItem);

// Checkout + orders
router.post('/checkout', protect, shopCheckoutLimiter, checkout.startCheckout);
router.get('/checkout/:orderId/page', apiLimiter, checkout.checkoutPage);
router.get('/checkout/:orderId/return', apiLimiter, checkout.checkoutReturn);
router.get('/orders', protect, apiLimiter, checkout.listOrders);
router.get('/orders/:orderId', protect, apiLimiter, checkout.getOrder);

// Internal
router.post('/internal/catalog-sync', verifyQStash, catalog.runCatalogSync);
router.post('/internal/reconcile-orders', verifyQStash, checkout.runReconciliation);
router.post('/internal/shopify-sync', verifyQStash, checkout.runShopifySync);

module.exports = router;
