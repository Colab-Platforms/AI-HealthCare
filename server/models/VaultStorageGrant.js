const mongoose = require('mongoose');

/**
 * Ledger of storage a user has earned. One row per successful paid payment
 * (or one-off backfill/admin grant). `key` is unique, which makes granting
 * idempotent: a retried webhook, or Razorpay sending both payment.captured and
 * subscription.charged for the same payment, can never credit twice.
 *
 * Keys:  rzp:<razorpayPaymentId>
 *        sub:<razorpaySubscriptionId>:<periodEndEpoch>   (no payment id available)
 *        pay:<Payment _id>                               (old rows with neither)
 *        backfill:<userId>                               (paid user with no Payment rows)
 *        admin:<anything>                                (manual grant)
 */
const vaultStorageGrantSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bytes: { type: Number, required: true, min: 1 },
  source: { type: String, enum: ['payment', 'backfill', 'admin'], required: true },
  key: { type: String, required: true, unique: true },
  planKey: { type: String, default: '' },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: undefined },
}, { timestamps: true });

vaultStorageGrantSchema.index({ userId: 1, createdAt: 1 });

module.exports = mongoose.model('VaultStorageGrant', vaultStorageGrantSchema);
