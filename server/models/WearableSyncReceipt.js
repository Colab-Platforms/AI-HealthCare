const mongoose = require('mongoose');

const wearableSyncReceiptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  syncId: { type: String, required: true },
  source: { type: String, enum: ['health_connect', 'healthkit'], required: true },
  provider: { type: String, required: true },
  syncMode: { type: String, enum: ['initial', 'incremental'], default: 'incremental' },
  cursor: { type: String, maxlength: 4096 },
  batchSequence: { type: Number, min: 0 },
  isFinalBatch: { type: Boolean, default: true },
  receivedAt: { type: Date, default: Date.now }
}, { timestamps: true });

wearableSyncReceiptSchema.index({ user: 1, source: 1, syncId: 1 }, { unique: true });

module.exports = mongoose.model('WearableSyncReceipt', wearableSyncReceiptSchema);