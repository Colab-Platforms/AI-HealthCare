const Razorpay = require('razorpay');

let client = null;

function getClient() {
    if (!client) {
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            throw new Error('Razorpay keys not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)');
        }
        client = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
    }
    return client;
}

module.exports = { getClient };
