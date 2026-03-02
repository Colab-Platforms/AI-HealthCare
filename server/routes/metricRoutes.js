const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const HealthMetric = require('../models/HealthMetric');

// Helper function to add timeout to all queries for Vercel compatibility
const withTimeout = (query, timeoutMs = 30000) => {
  return query.maxTimeMS(timeoutMs);
};

// Log a new health metric
router.post('/', protect, async (req, res) => {
    try {
        const { type, value, unit, readingContext, recordedAt, notes } = req.body;

        // Create new metric
        const metric = new HealthMetric({
            userId: req.user._id,
            type,
            value: Number(value),
            unit,
            readingContext,
            recordedAt: recordedAt ? new Date(recordedAt) : Date.now(),
            notes
        });

        await metric.save({ maxTimeMS: 30000 });

        res.status(201).json(metric);
    } catch (error) {
        console.error('Error logging metric:', error);
        res.status(500).json({ message: 'Server error saving health metric' });
    }
});

// Get metrics by type
router.get('/:type', protect, async (req, res) => {
    try {
        const { type } = req.params;
        const limit = parseInt(req.query.limit) || 50;

        const metrics = await withTimeout(HealthMetric.find({ userId: req.user._id, type })
            .sort({ recordedAt: -1 })
            .limit(limit));

        res.json(metrics);
    } catch (error) {
        console.error(`Error fetching ${req.params.type} metrics:`, error);
        res.status(500).json({ message: 'Server error fetching health metrics' });
    }
});

// Get latest reading for each specified type (comma separated)
router.get('/summary/latest', protect, async (req, res) => {
    try {
        const types = req.query.types ? req.query.types.split(',') : ['blood_sugar', 'hba1c', 'weight'];
        const summary = {};

        for (const type of types) {
            const latest = await withTimeout(HealthMetric.findOne({ userId: req.user._id, type })
                .sort({ recordedAt: -1 }));
            if (latest) {
                summary[type] = latest;
            }
        }

        res.json(summary);
    } catch (error) {
        console.error('Error fetching metric summary:', error);
        res.status(500).json({ message: 'Server error fetching metric summary' });
    }
});

module.exports = router;
