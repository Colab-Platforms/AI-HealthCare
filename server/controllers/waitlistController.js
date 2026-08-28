const WaitlistUserEmail = require('../models/WaitlistUserEmail');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.joinWaitlist = async (req, res) => {
    try {
        const name = (req.body.name || '').trim();
        const email = (req.body.email || '').trim().toLowerCase();

        if (!name) {
            return res.status(400).json({ success: false, message: 'Please enter your name.' });
        }

        if (!email || !EMAIL_REGEX.test(email)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
        }

        const existing = await WaitlistUserEmail.findOne({ email });
        if (existing) {
            return res.json({ success: true, message: "You're already on the waitlist." });
        }

        await WaitlistUserEmail.create({
            name,
            email,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ success: true, message: "You're on the waitlist!" });
    } catch (error) {
        if (error.code === 11000) {
            return res.json({ success: true, message: "You're already on the waitlist." });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};
