const mongoose = require('mongoose');

const waitlistUserEmailSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    source: {
        type: String,
        default: 'waitlist_page'
    },
    ip: String,
    userAgent: String
}, { timestamps: true });

module.exports = mongoose.model('WaitlistUserEmail', waitlistUserEmailSchema);
