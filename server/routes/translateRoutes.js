const express = require('express');
const router = express.Router();
const { translateWithAI } = require('../services/translationService');

// POST /api/translate
router.post('/', async (req, res) => {
    try {
        const { text, targetLanguage = 'hi' } = req.body;

        if (!text) {
            return res.status(400).json({ message: 'Text is required' });
        }

        console.log(`🌐 Translation request: ${text.length} chars → ${targetLanguage}`);

        const translatedText = await translateWithAI(text, targetLanguage);

        res.json({ translatedText });
    } catch (error) {
        console.error('Translation route error:', error.message);
        res.status(500).json({ message: 'Translation failed', error: error.message });
    }
});

module.exports = router;
