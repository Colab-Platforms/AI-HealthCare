const mongoose = require('mongoose');

// Named sequences (e.g. "invoice-2026-27"). Incremented with an atomic $inc, so
// two concurrent callers can never get the same number.
const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
}, { versionKey: false });

counterSchema.statics.next = async function next(name) {
    const doc = await this.findOneAndUpdate(
        { _id: name },
        { $inc: { seq: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return doc.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
