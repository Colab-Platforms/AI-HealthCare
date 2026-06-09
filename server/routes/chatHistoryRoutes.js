const express = require('express');
const router = express.Router();
const ChatHistory = require('../models/ChatHistory');
const { protect } = require('../middleware/auth');

router.get('/history', protect, async (req, res) => {
  try {
    const chatHistory = await ChatHistory.findOne({ userId: req.user._id })
      .select('messages')
      .lean();

    return res.json({ success: true, messages: chatHistory?.messages || [] });
  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({ success: false, message: 'Failed to load chat history' });
  }
});

router.post('/history', protect, async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, message: 'Messages array is required' });
    }

    await ChatHistory.findOneAndUpdate(
      { userId: req.user._id },
      {
        $push: {
          messages: {
            $each: messages,
            $slice: -100  // keep last 100 messages max
          }
        },
        $set: { lastUpdated: new Date() }
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Chat history saved' });
  } catch (error) {
    console.error('Save chat history error:', error);
    res.status(500).json({ success: false, message: 'Failed to save chat history' });
  }
});

router.delete('/history', protect, async (req, res) => {
  try {
    await ChatHistory.findOneAndDelete({ userId: req.user._id });
    res.json({ success: true, message: 'Chat history cleared' });
  } catch (error) {
    console.error('Clear chat history error:', error);
    res.status(500).json({ success: false, message: 'Failed to clear chat history' });
  }
});

module.exports = router;
