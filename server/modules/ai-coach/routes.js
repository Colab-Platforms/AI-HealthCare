// AI coach routes, mounted at /api/coach. The chat itself stays on
// POST /api/chat (routes/chatRoutes.js -> chatHandler).
//
//   POST /opener   the coach's first message when the user OPENS the coach
//                  screen (call it from that screen only, not on app launch).
//                  200 { success, opener: { text, language, question } | null, reason? }
//                  POST, not GET: it records that the opener (and its question) went out.
//
// The app shows `opener.text` as the first coach bubble and saves it to the
// chat history like any assistant message. `opener: null` = show nothing.

const express = require('express');
const router = express.Router();

const { protect } = require('../../middleware/auth');
const { requireHealthConsent } = require('../../middleware/consentAccess');
const { requireFeature } = require('../../middleware/subscriptionAccess');
const { isEnabled } = require('./config');
const { createOpenerService } = require('./opener/openerService');

let openerService;
function getOpenerService() {
    if (!openerService) {
        const { mongoRepo } = require('./orchestrator/coachStateRepo');
        const { createSymptomTools } = require('./tools/symptomTools');
        const { getProfileContext } = require('../health-profile/services/profileContextService');
        const { progressSpecialist } = require('./specialists/progress');
        openerService = createOpenerService({
            coachStateRepo: mongoRepo,
            symptomTools: createSymptomTools(),
            getProfileContext: (userId) => getProfileContext(userId),
            progress: ({ userId, now }) => progressSpecialist({ userId, now }),
            logger: console,
        });
    }
    return openerService;
}

router.post('/opener', protect, requireHealthConsent, requireFeature('aiHealthCoach'), async (req, res) => {
    if (!isEnabled()) return res.json({ success: true, opener: null, reason: 'disabled' });
    try {
        const result = await getOpenerService().buildOpener({ userId: req.user._id, userName: req.user.name, now: new Date() });
        return res.json({ success: true, ...result });
    } catch (err) {
        // Never break the coach screen: no opener is a fine outcome.
        console.error('[AICoach] opener failed:', err.message);
        return res.json({ success: true, opener: null, reason: 'error' });
    }
});

module.exports = router;
