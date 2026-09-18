const mongoose = require('mongoose');

const creatorResponseSchema = new mongoose.Schema({
    // About you
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        lowercase: true,
        trim: true,
        index: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email']
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true
    },
    address: {
        type: String,
        required: [true, 'Address is required'],
        trim: true
    },
    aptSuite: {
        type: String,
        trim: true,
        default: ''
    },

    // Channels
    instagramLink: { type: String, trim: true, default: '' },
    youtubeLink: { type: String, trim: true, default: '' },
    twitterLink: { type: String, trim: true, default: '' },

    // Content
    bestVideoLink: {
        type: String,
        required: [true, 'Best performing video link is required'],
        trim: true
    },
    whyCreator: {
        type: String,
        required: [true, 'This field is required'],
        trim: true,
        maxlength: [2000, 'Response cannot exceed 2000 characters']
    },
    instagramIsCreatorAccount: {
        type: String,
        required: [true, 'This field is required'],
        enum: ['yes', 'no']
    },
    canPostThreePerMonth: {
        type: String,
        required: [true, 'This field is required'],
        enum: ['yes', 'no']
    },
    followerCount: {
        type: Number,
        required: [true, 'Follower count is required'],
        min: [0, 'Follower count cannot be negative']
    },
    contentCategory: {
        type: String,
        trim: true,
        default: ''
    },

    // Agreement
    signature: {
        type: String,
        required: [true, 'Signature is required'],
        trim: true
    },
    agreedToAgreement: {
        type: Boolean,
        required: [true, 'You must agree to the Creator Program Agreement'],
        validate: {
            validator: (v) => v === true,
            message: 'You must agree to the Creator Program Agreement'
        }
    },

    // Consents
    wantsUpdates: {
        type: Boolean,
        default: false
    },
    agreedToPolicies: {
        type: Boolean,
        required: [true, 'You must agree to the policy consent'],
        validate: {
            validator: (v) => v === true,
            message: 'You must agree to the policy consent'
        }
    },

    // Review workflow
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        index: true
    }
}, {
    timestamps: true,
    strict: true
});

creatorResponseSchema.index({ email: 1, createdAt: -1 });
creatorResponseSchema.index({ createdAt: -1 });

module.exports = mongoose.model('CreatorResponse', creatorResponseSchema, 'creatorResponses');
