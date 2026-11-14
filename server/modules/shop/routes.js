// Shop routes, mounted at /api/shop.
// Everything is under /api because on Vercel only /api/* reaches the backend —
// anything else is rewritten to the web app's index.html.
//
//   Public (catalog)   GET  /products, /products/:handle, /collections
//   Logged-in (cart)   GET/DELETE /cart, POST /cart/items, PATCH/DELETE /cart/items/:variantId
//   Fastrr pull        GET  /fastrr/products, /fastrr/collections, /fastrr/collection-products
//   QStash schedule    POST /internal/catalog-sync

const express = require('express');
const router = express.Router();

const { protect } = require('../../middleware/auth');
const { verifyQStash } = require('../../middleware/qstashAuth');
const { apiLimiter, shopWriteLimiter } = require('../../middleware/rateLimit');
const catalog = require('./controllers/catalogController');
const cart = require('./controllers/cartController');

// Catalog
router.get('/products', apiLimiter, catalog.listProducts);
router.get('/products/:handle', apiLimiter, catalog.getProduct);
router.get('/collections', apiLimiter, catalog.listCollections);

// Fastrr catalog pull. Public product data only (what the app shows anyway).
router.get('/fastrr/products', apiLimiter, catalog.fastrrProducts);
router.get('/fastrr/collections', apiLimiter, catalog.fastrrCollections);
router.get('/fastrr/collection-products', apiLimiter, catalog.fastrrCollectionProducts);

// Cart
router.get('/cart', protect, apiLimiter, cart.getCart);
router.delete('/cart', protect, shopWriteLimiter, cart.clearCart);
router.post('/cart/items', protect, shopWriteLimiter, cart.addItem);
router.patch('/cart/items/:variantId', protect, shopWriteLimiter, cart.setQuantity);
router.delete('/cart/items/:variantId', protect, shopWriteLimiter, cart.removeItem);

// Internal
router.post('/internal/catalog-sync', verifyQStash, catalog.runCatalogSync);

module.exports = router;
