const express = require('express');
const router = express.Router();
const ChatHistory = require('../models/ChatHistory');
const { protect } = require('../middleware/auth');
const chatHistoryService = require('../services/chatHistoryService');
const { Receiver } = require('@upstash/qstash');

/**
 * GET /api/chat/history
 * Get user's chat history with Redis caching
 */
router.get('/history', protect, async (req, res) => {
  try {
    const history = await chatHistoryService.getHistory(req.user.userId);
    
    res.json({
      success: true,
      messages: history.messages || [],
      version: history.version,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load chat history'
    });
  }
});

/**
 * POST /api/chat/history
 * Save chat messages - Redis immediately + QStash async persistence
 */
router.post('/history', protect, async (req, res) => {
  try {
    const { messages } = req.body;

    // Validate messages array
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid messages array required',
        errorType: 'VALIDATION_ERROR'
      });
    }

    // Validate message structure
    const validMessages = messages.every(msg => {
      if (!msg) return false;
      if (!msg.role || !msg.content) return false;
      if (typeof msg.role !== 'string' || typeof msg.content !== 'string') return false;
      return true;
    });

    if (!validMessages) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message structure - each message must have role and content',
        errorType: 'VALIDATION_ERROR'
      });
    }

    // Validate userId
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
        errorType: 'AUTH_ERROR'
      });
    }

    // Save messages
    const result = await chatHistoryService.saveMessages(
      req.user.userId,
      messages
    );

    res.json({
      success: true,
      version: result.version,
      messageCount: messages.length,
      message: 'Chat saved successfully'
    });
  } catch (error) {
    console.error('Save history error:', error.message);
    console.error('Stack:', error.stack);
    
    // Provide specific error info for debugging
    res.status(500).json({
      success: false,
      message: 'Failed to save chat history',
      errorType: 'SERVER_ERROR',
      errorMessage: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/queue/save-chat-history
 * QStash webhook - Persists chat to MongoDB (background task)
 */
router.post('/queue/save-chat-history', async (req, res) => {
  try {
    // Verify QStash signature
    const receiver = new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY
    });

    const body = await receiver.verify({
      signature: req.headers['upstash-signature'],
      body: JSON.stringify(req.body)
    });

    const { userId, messages, version } = JSON.parse(body);

    console.log(`📝 QStash Processing: Saving chat for ${userId} (v${version})`);

    // Persist to MongoDB
    await chatHistoryService.saveToDB(userId, messages);

    res.json({ success: true });
  } catch (error) {
    console.error('QStash handler error:', error);
    // Return 500 so QStash retries
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/chat/history
 * Clear user's chat history
 */
router.delete('/history', protect, async (req, res) => {
  try {
    await ChatHistory.findOneAndDelete({ userId: req.user.userId });
    await chatHistoryService.invalidateCache(req.user.userId);

    res.json({
      success: true,
      message: 'Chat history cleared'
    });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear chat history'
    });
  }
});

module.exports = router;
