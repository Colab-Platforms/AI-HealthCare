const cartService = require('../services/cartService');
const { sendError } = require('../lib/shopError');

// All cart routes are behind `protect`; the cart always belongs to req.user.

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
        res.json(await cartService.addItem(req.user._id, { variantId, quantity: quantity ?? 1 }));
    } catch (err) {
        sendError(res, err, 'Shop/addItem');
    }
};

// PATCH /api/shop/cart/items/:variantId   { quantity }   (0 removes the line)
exports.setQuantity = async (req, res) => {
    try {
        res.json(await cartService.setQuantity(req.user._id, req.params.variantId, req.body?.quantity));
    } catch (err) {
        sendError(res, err, 'Shop/setQuantity');
    }
};

// DELETE /api/shop/cart/items/:variantId
exports.removeItem = async (req, res) => {
    try {
        res.json(await cartService.removeItem(req.user._id, req.params.variantId));
    } catch (err) {
        sendError(res, err, 'Shop/removeItem');
    }
};

// DELETE /api/shop/cart
exports.clearCart = async (req, res) => {
    try {
        res.json(await cartService.clearCart(req.user._id));
    } catch (err) {
        sendError(res, err, 'Shop/clearCart');
    }
};
