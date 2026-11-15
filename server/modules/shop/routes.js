// Shop routes, mounted at /api/shop.
// Everything is under /api because on Vercel only /api/* reaches the backend —
// anything else is rewritten to the web app's index.html.
//
//   Public (catalog)   GET  /products, /products/:handle, /collections
//   Logged-in (cart)   GET/DELETE /cart, POST /cart/items, PATCH/DELETE /cart/items/:variantId
//   Logged-in (orders) POST /checkout, GET /orders, GET /orders/:orderId, POST /orders/:orderId/cancel
//   Admin              /admin/* (admin / superadmin role) — cancel + refunds (M4)
//   WebView (signed)   GET  /checkout/:orderId/page, /checkout/:orderId/return
//   Fastrr pull        GET  /fastrr/products, /fastrr/collections, /fastrr/collection-products
//   Fastrr push        POST /fastrr/webhook
//   QStash             POST /internal/catalog-sync, /internal/reconcile-orders, /internal/shopify-sync

const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../middleware/auth');
const { verifyQStash } = require('../../middleware/qstashAuth');
const { apiLimiter, shopWriteLimiter, shopCheckoutLimiter, shopWebhookLimiter } = require('../../middleware/rateLimit');
const catalog = require('./controllers/catalogController');
const cart = require('./controllers/cartController');
const checkout = require('./controllers/checkoutController');
const admin = require('./controllers/shopAdminController');
const optionalUser = require('./lib/optionalUser');

// Catalog
// optionalUser: if the app sends its token, searches / views are linked to the shopper (event log only).
router.get('/products', apiLimiter, optionalUser, catalog.listProducts);
router.get('/products/:handle', apiLimiter, optionalUser, catalog.getProduct);
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
router.post('/orders/:orderId/cancel', protect, shopWriteLimiter, checkout.cancelOrder);

// Admin (dashboard, orders, products, carts, customers, refunds + M4 actions)
const adminRouter = express.Router();
adminRouter.use(protect, authorize('admin', 'superadmin'));
adminRouter.get('/overview', admin.overview);
adminRouter.get('/attention', admin.attention);
adminRouter.get('/orders', admin.listOrders);
adminRouter.get('/orders/:orderId', admin.getOrder);
adminRouter.post('/orders/:orderId/retry-sync', admin.retrySync);
adminRouter.post('/orders/:orderId/review/resolve', admin.resolveReview);
adminRouter.get('/products', admin.products);
adminRouter.post('/products/sync', admin.syncCatalog);
adminRouter.get('/carts', admin.carts);
adminRouter.get('/customers', admin.customers);
adminRouter.get('/customers/:userId', admin.customerJourney);
adminRouter.get('/refunds', admin.refunds);
adminRouter.post('/orders/:orderId/cancel', admin.cancelOrder);
adminRouter.post('/orders/:orderId/refunds', admin.createRefund);
adminRouter.post('/orders/:orderId/refunds/manual', admin.markManualRefund);
adminRouter.post('/orders/:orderId/refunds/:refundId/approve', admin.approveRefund);
adminRouter.post('/orders/:orderId/refunds/:refundId/retry', admin.retryRefund);
adminRouter.post('/orders/:orderId/refunds/:refundId/mark-paid', admin.markManualRefund);
router.use('/admin', adminRouter);

// Internal
router.post('/internal/catalog-sync', verifyQStash, catalog.runCatalogSync);
router.post('/internal/reconcile-orders', verifyQStash, checkout.runReconciliation);
router.post('/internal/shopify-sync', verifyQStash, checkout.runShopifySync);

module.exports = router;
