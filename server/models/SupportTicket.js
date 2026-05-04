const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['bug', 'feature_request', 'general_help', 'account_issue', 'other'],
        default: 'general_help'
    },
    status: {
        type: String, 
        enum: ['open', 'in_progress', 'resolved', 'closed'],
        default: 'open'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    attachments: [String],
    adminResponse: String,
    respondedAt: Date,
    resolvedAt: Date
}, { timestamps: true });


module.exports = mongoose.model('SupportTicket', supportTicketSchema);