// Health profile routes, mounted at /api/health-profile.
//
//   GET    /                               full profile + version
//   GET    /completeness                   percent, per-section percent, missing fields with labels (most important first)
//   GET    /history?field=&before=&limit=  change log, newest first
//   PATCH  /:section                       basic | body | lifestyle | diet | fitness | goals | coachPreferences
//   POST   /:section/items                 conditions | medications | allergies | surgeries | familyHistory
//   PATCH  /:section/items/:itemId
//   DELETE /:section/items/:itemId
//   POST   /:section/none                  "I have none" for a list
//   POST   /undo/:historyId
//
// Auth: protect only. The profile is the user's own data: DPDPA gives them the
// right to see and correct it even after withdrawing consent for AI
// processing. The consent gate belongs on the AI features that READ it
// (profileContextService callers), not here.

const express = require('express');
const router = express.Router();

const { protect } = require('../../middleware/auth');
const { apiLimiter, profileWriteLimiter } = require('../../middleware/rateLimit');
const { createHealthProfileController } = require('./controllers/healthProfileController');

const c = createHealthProfileController();

router.use(protect);

router.get('/', apiLimiter, c.getProfile);
router.get('/completeness', apiLimiter, c.getCompleteness);
router.get('/history', apiLimiter, c.getHistory);

// Before /:section/* so "undo" is never read as a section name.
router.post('/undo/:historyId', profileWriteLimiter, c.undo);

router.patch('/:section', profileWriteLimiter, c.updateSection);
router.post('/:section/items', profileWriteLimiter, c.addItem);
router.patch('/:section/items/:itemId', profileWriteLimiter, c.updateItem);
router.delete('/:section/items/:itemId', profileWriteLimiter, c.removeItem);
router.post('/:section/none', profileWriteLimiter, c.markNone);

module.exports = router;
