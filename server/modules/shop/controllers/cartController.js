const cartService = require('../services/cartService');
const events = require('../services/eventService');
const { sendError } = require('../lib/shopError');

// All cart routes are behind `protect`; the cart always belongs to req.user.
// Successful changes are also recorded in the shop event log (customer journey).

// GET /api/shop/cart
exports.getCart = async (req, res) => {
    try {
        res.json(await cartService.getCart(req.user._id));
    } catch (err) {
        sendError(res, err, 'Shop/getCart');
    }
};

// POST /api/shop/cart/items   { variantId, quantity }
exports.addItem = async (req, res) => {
    try {
        const { variantId, quantity } = req.body || {};
        const cart = await cartService.addItem(req.user._id, { variantId, quantity: quantity ?? 1 });
        res.json(cart);
        const line = cart.lines.find((l) => l.variantId === String(variantId));
        events.track('cart_add', {
            user: req.user._id, productId: line?.productId, variantId,
            meta: { quantity: Number(quantity ?? 1), lineQuantity: line?.quantity, cartValuePaise: cart.summary.subtotal.paise },
        });
    } catch (err) {
        sendError(res, err, 'Shop/addItem');
    }
};

// PATCH /api/shop/cart/items/:variantId   { quantity }   (0 removes the line)
exports.setQuantity = async (req, res) => {
    try {
        const cart = await cartService.setQuantity(req.user._id, req.params.variantId, req.body?.quantity);
        res.json(cart);
        const qty = Number(req.body?.quantity);
        events.track(qty === 0 ? 'cart_remove' : 'cart_update', {
            user: req.user._id, variantId: req.params.variantId, meta: { quantity: qty, cartValuePaise: cart.summary.subtotal.paise },
        });
    } catch (err) {
        sendError(res, err, 'Shop/setQuantity');
    }
};

// DELETE /api/shop/cart/items/:variantId
exports.removeItem = async (req, res) => {
    try {
        const cart = await cartService.removeItem(req.user._id, req.params.variantId);
        res.json(cart);
        events.track('cart_remove', { user: req.user._id, variantId: req.params.variantId, meta: { cartValuePaise: cart.summary.subtotal.paise } });
    } catch (err) {
        sendError(res, err, 'Shop/removeItem');
    }
};

// DELETE /api/shop/cart
exports.clearCart = async (req, res) => {
    try {
        res.json(await cartService.clearCart(req.user._id));
        events.track('cart_clear', { user: req.user._id });
    } catch (err) {
        sendError(res, err, 'Shop/clearCart');
    }
};
