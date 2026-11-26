const mongoose = require('mongoose');

// One invoice per paid subscription Payment. Everything printed on the PDF is
// snapshotted here at issue time, so a later name/address/plan change never
// alters an invoice that was already issued.
const invoiceSchema = new mongoose.Schema({
    invoiceNumber: { type: String, required: true }, // e.g. TL/26-27/000001 (sequential per financial year)
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    billedTo: {
        name: String,
        email: { type: String, required: true },
    },
    seller: {
        name: { type: String, required: true },
        addressLines: [String],
        gstin: String,
    },
    item: {
        planKey: String,
        planName: { type: String, required: true },
        billingCycle: String,
        autoRenew: Boolean,
    },
    amount: { type: Number, required: true }, // INR
    currency: { type: String, default: 'INR' },
    razorpayPaymentId: String,
    issuedAt: { type: Date, required: true },

    // Archived PDF on Cloudinary (private "authenticated" asset — only the public ID is stored, never a URL).
    pdfPublicId: String,
    pdfStatus: { type: String, enum: ['pending', 'uploaded', 'failed'], default: 'pending' },

    // 'skipped' = deliberately not emailed (test/admin-issued); never retried.
    emailStatus: { type: String, enum: ['pending', 'sent', 'failed', 'skipped'], default: 'pending' },
    emailSentAt: Date,

    // Delivery bookkeeping: a short lease stops the QStash job and the cron sweep
    // from working on the same invoice at once (which could double-send the email).
    attempts: { type: Number, default: 0 },
    lastError: String,
    lockedUntil: Date,
}, { timestamps: true });

invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ payment: 1 }, { unique: true });
invoiceSchema.index({ user: 1, issuedAt: -1 });
// Sweep: invoices whose PDF upload or email still has to go through.
invoiceSchema.index({ emailStatus: 1, pdfStatus: 1, createdAt: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
