// Subscription invoices: issue -> archive PDF on Cloudinary -> email it to the user.
//
// Flow
//   1. Razorpay webhook (subscription.charged / payment.captured) calls issueInvoice():
//      takes the next sequential number, snapshots the invoice into Mongo. Fast, DB only.
//   2. enqueueInvoice() hands the slow part to a QStash job (survives the serverless
//      request ending; QStash retries on failure). Local dev without QStash runs inline.
//   3. processInvoice(): render PDF -> upload (private) -> email with the PDF attached.
//      Each step is skipped once done, so a retry never re-uploads or re-sends.
//   4. sweepInvoices() (Render cron) is the safety net for anything the above missed.

const axios = require('axios');
const Invoice = require('../models/Invoice');
const Counter = require('../models/Counter');
const Payment = require('../models/Payment');
const { cloudinary } = require('./cloudinary');
const emailService = require('./emailService');
const queueService = require('./queueService');
const {
    COMPANY_INFO,
    financialYear,
    formatInvoiceNumber,
    invoiceFileName,
    sellerSnapshot,
    viewFromInvoice,
    viewFromLegacyPayment,
    renderInvoiceBuffer,
    setPdfHeaders,
    streamInvoicePDF,
} = require('./invoiceService');

const LEASE_MS = 2 * 60 * 1000;          // one worker at a time per invoice
const MAX_ATTEMPTS = 6;                   // after this the invoice needs a manual look
const SWEEP_GRACE_MS = 3 * 60 * 1000;     // let the QStash job have the first go
const ORPHAN_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const CLOUDINARY_FOLDER = 'takehealth/invoices';
const DELIVERY_TYPE = 'authenticated';    // private: only reachable through a signed URL

const EMAIL_DONE = ['sent', 'skipped'];  // nothing left to send

const log = (stage, data = {}) => console.log(`[Invoice] ${stage}`, JSON.stringify(data));

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// ── 1. Issue ──────────────────────────────────────────────────────────────

/**
 * Creates the Invoice for a paid Payment (idempotent: one invoice per payment)
 * and copies its number onto the Payment so existing list/download code sees it.
 * Returns null for zero-amount payments, which get no invoice.
 */
async function issueInvoice({ payment, user, plan }) {
    if (!(Number(payment.amount) > 0)) {
        log('issue:skipped_zero_amount', { paymentId: String(payment._id) });
        return null;
    }

    let invoice = await Invoice.findOne({ payment: payment._id });
    if (!invoice) {
        const issuedAt = payment.createdAt || new Date();
        const fy = financialYear(issuedAt);
        const seq = await Counter.next(`invoice-${fy.key}`);
        try {
            invoice = await Invoice.create({
                invoiceNumber: formatInvoiceNumber(fy.short, seq),
                payment: payment._id,
                user: user._id,
                billedTo: { name: user.name, email: user.email },
                seller: sellerSnapshot(),
                item: {
                    planKey: plan.key,
                    planName: plan.name,
                    billingCycle: plan.billingCycle,
                    autoRenew: !!payment.razorpaySubscriptionId,
                },
                amount: payment.amount,
                razorpayPaymentId: payment.razorpayPaymentId,
                issuedAt,
            });
            log('issue:created', { invoiceNumber: invoice.invoiceNumber, paymentId: String(payment._id) });
        } catch (err) {
            // Same payment issued concurrently (webhook retry racing the sweep) —
            // the other writer won; its number is used and this seq is simply skipped.
            if (err.code !== 11000) throw err;
            invoice = await Invoice.findOne({ payment: payment._id });
            if (!invoice) throw err;
        }
    }

    await Payment.updateOne(
        { _id: payment._id, invoiceNumber: null },
        { $set: { invoiceNumber: invoice.invoiceNumber } }
    );
    payment.invoiceNumber = payment.invoiceNumber || invoice.invoiceNumber;
    return invoice;
}

// ── 2. Enqueue ────────────────────────────────────────────────────────────

/** Never throws — whatever doesn't go through here is picked up by the sweep. */
async function enqueueInvoice(invoice, baseUrl) {
    if (!invoice) return 'none';
    try {
        if (process.env.QSTASH_TOKEN) {
            const queued = await queueService.enqueueTask('process-invoice', { invoiceId: String(invoice._id) }, baseUrl);
            if (queued) return 'queued';
        }
        // No queue (local dev) or QStash down. A long-running server can finish it
        // in the background; on serverless the process may be frozen, so leave it to the sweep.
        if (!process.env.VERCEL) {
            setImmediate(() => processInvoice(invoice._id).catch((e) => log('inline:error', { message: e.message })));
            return 'inline';
        }
        return 'deferred';
    } catch (err) {
        log('enqueue:error', { invoiceId: String(invoice._id), message: err.message });
        return 'deferred';
    }
}

// ── 3. Process ────────────────────────────────────────────────────────────

function uploadPdf(invoice, buffer) {
    const publicId = `${CLOUDINARY_FOLDER}/${financialYear(invoice.issuedAt).key}/${invoiceFileName(invoice.invoiceNumber)}.pdf`;
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                public_id: publicId,
                resource_type: 'raw',
                type: DELIVERY_TYPE,
                overwrite: true, // a retry after a lost response rewrites the same file, never a second one
            },
            (error, result) => (error ? reject(error) : resolve(result.public_id))
        );
        stream.end(buffer);
    });
}

function invoiceEmailHtml(invoice) {
    const name = escapeHtml(invoice.billedTo?.name || 'there');
    const amount = Number.isInteger(invoice.amount) ? invoice.amount : Number(invoice.amount).toFixed(2);
    return `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;line-height:1.5">
        <p>Hi ${name},</p>
        <p>Thank you for your payment. We've received <strong>INR ${amount}</strong>
           for your <strong>${escapeHtml(invoice.item.planName)}</strong> (${escapeHtml(invoice.item.billingCycle)}) subscription.</p>
        <p>Your invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> is attached to this email.
           You can also download it any time from the Subscription page in the app.</p>
        <p style="color:#666;font-size:13px">For billing queries, write to
           <a href="mailto:${COMPANY_INFO.supportEmail}">${COMPANY_INFO.supportEmail}</a>
           and mention the invoice number.</p>
        <p>— Team ${COMPANY_INFO.brand}</p>
      </div>`;
}

/**
 * Archives and emails one invoice. Returns { status: 'done' | 'failed' | 'skipped' }.
 * 'skipped' = already fully delivered, or another worker holds the lease.
 */
async function processInvoice(invoiceId) {
    const now = new Date();
    const invoice = await Invoice.findOneAndUpdate(
        {
            _id: invoiceId,
            $and: [
                { $or: [{ pdfStatus: { $ne: 'uploaded' } }, { emailStatus: { $nin: EMAIL_DONE } }] },
                { $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }] },
            ],
        },
        { $set: { lockedUntil: new Date(now.getTime() + LEASE_MS) }, $inc: { attempts: 1 } },
        { new: true }
    );
    if (!invoice) return { status: 'skipped' };

    const errors = [];
    try {
        const buffer = await renderInvoiceBuffer(viewFromInvoice(invoice));

        if (invoice.pdfStatus !== 'uploaded') {
            try {
                invoice.pdfPublicId = await uploadPdf(invoice, buffer);
                invoice.pdfStatus = 'uploaded';
            } catch (err) {
                invoice.pdfStatus = 'failed';
                errors.push(`upload: ${err.message || err.error?.message || 'unknown'}`);
            }
            await invoice.save();
        }

        // Email goes out even if the upload failed — the user needs it more than the archive does.
        if (!EMAIL_DONE.includes(invoice.emailStatus)) {
            const result = await emailService.sendEmail({
                to: invoice.billedTo.email,
                subject: `Your ${COMPANY_INFO.brand} invoice ${invoice.invoiceNumber}`,
                html: invoiceEmailHtml(invoice),
                attachments: [{
                    filename: `${invoiceFileName(invoice.invoiceNumber)}.pdf`,
                    content: buffer,
                    contentType: 'application/pdf',
                }],
            });
            if (result?.success) {
                invoice.emailStatus = 'sent';
                invoice.emailSentAt = new Date();
            } else {
                invoice.emailStatus = 'failed';
                errors.push(`email: ${result?.error || 'unknown'}`);
            }
            await invoice.save();
        }
    } catch (err) {
        errors.push(err.message);
    }

    invoice.lastError = errors.length ? errors.join(' | ').slice(0, 500) : undefined;
    invoice.lockedUntil = undefined;
    await invoice.save();

    const status = errors.length ? 'failed' : 'done';
    log(`process:${status}`, {
        invoiceNumber: invoice.invoiceNumber,
        attempts: invoice.attempts,
        pdfStatus: invoice.pdfStatus,
        emailStatus: invoice.emailStatus,
        ...(errors.length ? { errors } : {}),
    });
    if (status === 'failed' && invoice.attempts >= MAX_ATTEMPTS) {
        console.error('[Invoice] needs_attention: delivery gave up', { invoiceNumber: invoice.invoiceNumber, lastError: invoice.lastError });
    }
    return { status, attempts: invoice.attempts, giveUp: invoice.attempts >= MAX_ATTEMPTS };
}

// ── 4. Sweep (Render cron) ────────────────────────────────────────────────

async function sweepInvoices({ limit = 20 } = {}) {
    const stats = { issued: 0, processed: 0, failed: 0 };

    // Paid payments whose invoice was never issued (webhook crashed between the two writes).
    // Payments from before this feature all carry an INV-… number, so they're never picked up.
    const orphans = await Payment.find({
        status: 'paid',
        invoiceNumber: null,
        amount: { $gt: 0 },
        createdAt: { $gte: new Date(Date.now() - ORPHAN_LOOKBACK_MS) },
    }).populate('plan').populate('user', 'name email').limit(limit);

    for (const payment of orphans) {
        if (!payment.plan || !payment.user) continue;
        try {
            const invoice = await issueInvoice({ payment, user: payment.user, plan: payment.plan });
            if (invoice) stats.issued += 1;
        } catch (err) {
            log('sweep:issue_error', { paymentId: String(payment._id), message: err.message });
        }
    }

    const now = Date.now();
    const due = await Invoice.find({
        $and: [
            { $or: [{ pdfStatus: { $ne: 'uploaded' } }, { emailStatus: { $nin: EMAIL_DONE } }] },
            { $or: [{ lockedUntil: null }, { lockedUntil: { $lt: new Date(now) } }] },
        ],
        attempts: { $lt: MAX_ATTEMPTS },
        createdAt: { $lt: new Date(now - SWEEP_GRACE_MS) },
    }).select('_id').sort({ createdAt: 1 }).limit(limit).lean();

    for (const { _id } of due) {
        try {
            const r = await processInvoice(_id);
            if (r.status === 'done') stats.processed += 1;
            else if (r.status === 'failed') stats.failed += 1;
        } catch (err) {
            stats.failed += 1;
            log('sweep:process_error', { invoiceId: String(_id), message: err.message });
        }
    }

    if (stats.issued || stats.processed || stats.failed) log('sweep:done', stats);
    return stats;
}

// ── Download ──────────────────────────────────────────────────────────────

/**
 * Sends the PDF for a payment the caller is already allowed to see.
 * Order: archived Cloudinary copy -> re-render from the Invoice snapshot ->
 * legacy render (payments from before Invoice documents existed).
 * Returns { ok: false, status, message } when there is nothing to send.
 */
async function sendInvoiceForPayment(res, { payment, user }) {
    if (payment.status !== 'paid') {
        return { ok: false, status: 400, message: 'No invoice available for this payment' };
    }

    const invoice = await Invoice.findOne({ payment: payment._id });
    if (invoice) {
        if (invoice.pdfPublicId) {
            try {
                const url = cloudinary.utils.private_download_url(invoice.pdfPublicId, '', {
                    resource_type: 'raw',
                    type: DELIVERY_TYPE,
                    expires_at: Math.floor(Date.now() / 1000) + 60,
                });
                const upstream = await axios.get(url, { responseType: 'stream', timeout: 10000 });
                setPdfHeaders(res, invoice.invoiceNumber);
                upstream.data.pipe(res);
                return { ok: true };
            } catch (err) {
                log('download:archive_unavailable', { invoiceNumber: invoice.invoiceNumber, message: err.message });
            }
        }
        streamInvoicePDF(res, viewFromInvoice(invoice));
        return { ok: true };
    }

    if (!payment.invoiceNumber) {
        return { ok: false, status: 400, message: 'Invoice is still being generated — please try again in a few minutes' };
    }
    if (!payment.plan || !user) {
        return { ok: false, status: 410, message: 'The plan or user for this invoice no longer exists' };
    }
    streamInvoicePDF(res, viewFromLegacyPayment(payment, user, payment.plan));
    return { ok: true };
}

// ── Retention (8-year statutory, alongside Payments) ───────────────────────

async function purgeInvoicesBefore(cutoff, { limit = 500 } = {}) {
    const old = await Invoice.find({ issuedAt: { $lte: cutoff } }).select('_id pdfPublicId').limit(limit).lean();
    for (const inv of old) {
        if (!inv.pdfPublicId) continue;
        try {
            await cloudinary.uploader.destroy(inv.pdfPublicId, { resource_type: 'raw', type: DELIVERY_TYPE, invalidate: true });
        } catch (err) {
            log('retention:destroy_error', { invoiceId: String(inv._id), message: err.message });
        }
    }
    if (!old.length) return 0;
    const r = await Invoice.deleteMany({ _id: { $in: old.map((i) => i._id) } });
    return r.deletedCount;
}

module.exports = {
    issueInvoice,
    enqueueInvoice,
    processInvoice,
    sweepInvoices,
    sendInvoiceForPayment,
    purgeInvoicesBefore,
    MAX_ATTEMPTS,
};
