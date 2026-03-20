const express = require('express');
const router = express.Router();
const ChatHistory = require('../models/ChatHistory');
const { protect } = require('../middleware/auth');

// Get chat history for user
router.get('/history', protect, async (req, res) => {
  try {
    let chatHistory = await ChatHistory.findOne({ userId: req.user.userId });
    
    if (!chatHistory) {
      return res.json({ success: true, messages: [] });
    }

    res.json({ 
      success: true, 
      messages: chatHistory.messages 
    });
  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load chat history',
      error: error.message 
    });
  }
});

// Save messages to chat history
router.post('/history', protect, async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Messages array is required' 
      });
    }

    let chatHistory = await ChatHistory.findOne({ userId: req.user.userId });

    if (!chatHistory) {
      chatHistory = new ChatHistory({
        userId: req.user.userId,
        messages: messages
      });
    } else {
      chatHistory.messages.push(...messages);
      // Keep only last 100 messages
      if (chatHistory.messages.length > 100) {
        chatHistory.messages = chatHistory.messages.slice(-100);
      }
    }

    await chatHistory.save();

    res.json({ 
      success: true, 
      message: 'Chat history saved' 
    });
  } catch (error) {
    console.error('Save chat history error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save chat history',
      error: error.message 
    });
  }
});

// Clear chat history
router.delete('/history', protect, async (req, res) => {
  try {
    await ChatHistory.findOneAndDelete({ userId: req.user.userId });

    res.json({ 
      success: true, 
      message: 'Chat history cleared' 
    });
  } catch (error) {
    console.error('Clear chat history error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to clear chat history',
      error: error.message 
    });
  }
});

module.exports = router;
