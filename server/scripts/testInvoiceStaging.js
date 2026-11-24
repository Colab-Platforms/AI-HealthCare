/**
 * STAGING ONLY: checks the invoice flow without Razorpay. Creates a dummy paid
 * Payment for a user and runs the same code the payment webhook runs:
 * issueInvoice (Mongo) -> processInvoice (PDF -> Cloudinary -> email).
 * Run from server/:
 *
 *   node scripts/testInvoiceStaging.js --email=<user email>
 *   node scripts/testInvoiceStaging.js --email=<user email> --send-to=<real inbox>
 *   node scripts/testInvoiceStaging.js --email=<user email> --no-email --save=C:/Users/me/Desktop
 *   node scripts/testInvoiceStaging.js --email=<user email> --cleanup
 *
 *   --no-email  issue + upload the PDF but never email it (not now, not by the cron sweep)
 *   --save      folder to save a copy of the PDF, downloaded back from Cloudinary
 *   --send-to   deliver the invoice email here instead of the user's own address
 *               (needed for test users like *@example.invalid, which can't receive mail)
 *   --cleanup   delete this user's dummy payments, their invoices and Cloudinary PDFs
 *
 * Safety: refuses unless USE_STAGING_DB=true and the database name ends with
 * "staging". Dummy payments use razorpayPaymentId "pay_TEST_…" so they are easy to find.
 * Invoice numbers used here are taken from the staging counter only.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

if (process.env.USE_STAGING_DB !== 'true' || !process.env.MONGODB_URI_STAGING) {
    console.error('Refusing to run: needs USE_STAGING_DB=true and MONGODB_URI_STAGING (staging only).');
    process.exit(1);
}

const crypto = require('crypto');
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const arg = (name) => (args.find((a) => a.startsWith(`--${name}=`)) || '').slice(name.length + 3).trim();
const EMAIL = arg('email').toLowerCase();
const SEND_TO = arg('send-to').toLowerCase();
const CLEANUP = args.includes('--cleanup');
const NO_EMAIL = args.includes('--no-email');
const SAVE_DIR = arg('save');
const TEST_PREFIX = 'pay_TEST_';

async function main() {
    if (!EMAIL) throw new Error('Pass --email=<user email>');
    if (SEND_TO && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(SEND_TO)) throw new Error('--send-to is not a valid email');

    const connectDB = require('../config/db');
    await connectDB();
    const dbName = mongoose.connection.name;
    if (!/staging$/i.test(dbName)) throw new Error(`Connected database "${dbName}" is not a staging database.`);
    console.log(`\nDB: ${mongoose.connection.host} / ${dbName}\n`);

    const User = require('../models/User');
    const Plan = require('../models/Plan');
    const Payment = require('../models/Payment');
    const Invoice = require('../models/Invoice');
    const { cloudinary } = require('../services/cloudinary');
    const { issueInvoice, processInvoice, MAX_ATTEMPTS } = require('../services/invoiceDeliveryService');
    const { invoiceFileName } = require('../services/invoiceService');
    if (SAVE_DIR && !require('fs').existsSync(SAVE_DIR)) throw new Error(`--save folder not found: ${SAVE_DIR}`);

    const user = await User.findOne({ email: EMAIL }).select('name email');
    if (!user) throw new Error(`No user with email ${EMAIL}`);

    if (CLEANUP) {
        const payments = await Payment.find({ user: user._id, razorpayPaymentId: { $regex: `^${TEST_PREFIX}` } }).select('_id');
        const ids = payments.map((p) => p._id);
        const invoices = await Invoice.find({ payment: { $in: ids } }).select('invoiceNumber pdfPublicId');
        for (const inv of invoices) {
            if (inv.pdfPublicId) {
                await cloudinary.uploader.destroy(inv.pdfPublicId, { resource_type: 'raw', type: 'authenticated', invalidate: true })
                    .catch((e) => console.warn(`  Cloudinary delete failed for ${inv.invoiceNumber}: ${e.message}`));
            }
        }
        await Invoice.deleteMany({ payment: { $in: ids } });
        await Payment.deleteMany({ _id: { $in: ids } });
        console.log(`Removed ${ids.length} dummy payment(s) and ${invoices.length} invoice(s) for ${EMAIL}.`);
        return;
    }

    const plan = await Plan.findOne({ key: 'take_plus', billingCycle: 'monthly', isActive: true })
        || await Plan.findOne({ key: 'take_plus', isActive: true });
    if (!plan) throw new Error('No active take_plus plan on staging.');

    const tag = crypto.randomBytes(6).toString('hex');
    const payment = await Payment.create({
        user: user._id,
        plan: plan._id,
        razorpayPaymentId: `${TEST_PREFIX}${tag}`,
        razorpaySubscriptionId: `sub_TEST_${tag}`,
        razorpayEventId: `test-invoice-${tag}`,
        amount: plan.price,
        status: 'paid',
    });
    console.log(`1. Dummy payment  ${payment._id}  INR ${payment.amount}  (${plan.name}, ${plan.billingCycle})`);

    const invoice = await issueInvoice({ payment, user, plan });
    if (SEND_TO) invoice.billedTo.email = SEND_TO;
    if (NO_EMAIL) invoice.emailStatus = 'skipped';
    await invoice.save();
    console.log(`2. Invoice issued ${invoice.invoiceNumber}  -> ${NO_EMAIL ? 'email skipped' : `email to ${invoice.billedTo.email}`}`);

    const result = await processInvoice(invoice._id);
    if (NO_EMAIL) {
        // Servers still on code that predates 'skipped' would retry the email;
        // their sweep only picks invoices under MAX_ATTEMPTS.
        await Invoice.updateOne({ _id: invoice._id }, { $max: { attempts: MAX_ATTEMPTS } });
    }
    const fresh = await Invoice.findById(invoice._id).lean();
    console.log(`3. Delivery       ${result.status}`);
    console.log(`     pdfStatus:   ${fresh.pdfStatus}${fresh.pdfPublicId ? `  (${fresh.pdfPublicId})` : ''}`);
    console.log(`     emailStatus: ${fresh.emailStatus}`);
    if (fresh.lastError) console.log(`     lastError:   ${fresh.lastError}`);

    if (SAVE_DIR && fresh.pdfPublicId) {
        const axios = require('axios');
        const url = cloudinary.utils.private_download_url(fresh.pdfPublicId, '', {
            resource_type: 'raw', type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 60,
        });
        const { data } = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
        const file = path.join(SAVE_DIR, `${invoiceFileName(fresh.invoiceNumber)}.pdf`);
        require('fs').writeFileSync(file, data);
        console.log(`4. Saved          ${file}  (downloaded from Cloudinary)`);
    }

    console.log('\nNow check: the inbox, Cloudinary folder above, and Payment History on staging web (log in as this user).');
    console.log(`Clean up later: node scripts/testInvoiceStaging.js --email=${EMAIL} --cleanup\n`);
}

main()
    .catch((err) => {
        console.error('\nFailed:', err.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect().catch(() => {});
        process.exit(process.exitCode || 0); // SMTP pool would otherwise keep the process alive
    });
