const express = require('express');
const router = express.Router();
const shopifyOfferService = require('../services/shopifyOfferService');
const { protect } = require('../middleware/auth');
const { apiLimiter, offerRedeemLimiter } = require('../middleware/rateLimit');

const { OfferError } = shopifyOfferService;

router.use(protect);

const fail = (res, label, err) => {
    if (err instanceof OfferError) {
        return res.status(err.status).json({ success: false, code: err.code, message: err.message });
    }
    console.error(`[Offers] ${label} error:`, err);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
};

// GET /api/offers/shopify — has this user claimed the store offer? (to hide/show the Redeem screen)
router.get('/shopify', apiLimiter, async (req, res) => {
    try {
        res.json({ success: true, data: await shopifyOfferService.getStatusForUser(req.user._id) });
    } catch (err) {
        fail(res, 'status', err);
    }
});

// POST /api/offers/shopify/redeem  { "orderNumber": "TAKE11005", "checkoutEmail": "buyer@gmail.com" }
// checkoutEmail is optional: needed only when the order was placed with a
// different email than the one on the app account.
router.post('/shopify/redeem', offerRedeemLimiter, async (req, res) => {
    try {
        const { orderNumber, checkoutEmail } = req.body || {};
        res.json({ success: true, data: await shopifyOfferService.redeemForUser(req.user._id, orderNumber, checkoutEmail) });
    } catch (err) {
        fail(res, 'redeem', err);
    }
});

module.exports = router;
