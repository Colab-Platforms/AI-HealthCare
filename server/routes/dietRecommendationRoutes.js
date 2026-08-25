const express = require('express');
const router = express.Router();
const dietRecommendationController = require('../controllers/dietRecommendationController');
const { protect } = require('../middleware/auth');
const { verifyQStash } = require('../middleware/qstashAuth');
const { requireFeature } = require('../middleware/subscriptionAccess');
const { countDietPlansThisMonth } = require('../utils/featureUsage');

// Background callback route — called by QStash, so no user session to `protect`.
// Authenticated by signature instead; without it, anyone knowing the URL could
// trigger diet generation (and AI spend) against any userId.
router.post('/process-diet-bg', verifyQStash, dietRecommendationController.processDietBG);

// All other routes require authentication
router.use(protect);

// Diet plan routes
router.post('/diet-plan/generate', requireFeature('dietPlansPerMonth', countDietPlansThisMonth), dietRecommendationController.generatePersonalizedDietPlan);
router.get('/diet-plan/active', dietRecommendationController.getActiveDietPlan);
router.get('/diet-plan/history', dietRecommendationController.getDietPlanHistory);
router.get('/diet-plan/:planId', dietRecommendationController.getDietPlanById);
router.get('/diet-plan/:planId/status', dietRecommendationController.getDietPlanStatus);
router.post('/diet-plan/:planId/rate', dietRecommendationController.rateDietPlan);

// Supplement recommendation routes — boolean feature, no usage counter needed
router.post('/supplements/generate', requireFeature('supplementRecommendations'), dietRecommendationController.generateSupplementRecommendations);
router.get('/supplements/active', dietRecommendationController.getActiveSupplementRecommendations);
router.post('/supplements/:recommendationId/track', dietRecommendationController.trackSupplementUsage);

module.exports = router;
