const mongoose = require('mongoose');

const medicalDocumentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    category: {
        type: String,
        enum: ['prescription', 'lab_report', 'scan', 'discharge_summary', 'vaccination', 'insurance', 'other'],
        default: 'other'
    },
    documentDate: { type: Date, default: Date.now }, // The date the document was actually issued
    notes: { type: String },
    fileUrl: { type: String, required: true }, // The secure Cloudinary URL
    originalName: { type: String },
    mimetype: { type: String },
    size: { type: Number }
}, { timestamps: true });

medicalDocumentSchema.index({ userId: 1, category: 1 });
medicalDocumentSchema.index({ userId: 1, documentDate: -1 });

module.exports = mongoose.model('MedicalDocument', medicalDocumentSchema);
