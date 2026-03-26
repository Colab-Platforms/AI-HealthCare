const express = require('express');
const router = express.Router();
const dietRecommendationController = require('../controllers/dietRecommendationController');
const { protect } = require('../middleware/auth');

// Background callback route (No Auth needed as it's called by QStash)
router.post('/process-diet-bg', dietRecommendationController.processDietBG);

// All other routes require authentication
router.use(protect);

// Diet plan routes
router.post('/diet-plan/generate', dietRecommendationController.generatePersonalizedDietPlan);
router.get('/diet-plan/active', dietRecommendationController.getActiveDietPlan);
router.get('/diet-plan/history', dietRecommendationController.getDietPlanHistory);
router.get('/diet-plan/:planId', dietRecommendationController.getDietPlanById);
router.get('/diet-plan/:planId/status', dietRecommendationController.getDietPlanStatus);
router.post('/diet-plan/:planId/rate', dietRecommendationController.rateDietPlan);

// Supplement recommendation routes
router.post('/supplements/generate', dietRecommendationController.generateSupplementRecommendations);
router.get('/supplements/active', dietRecommendationController.getActiveSupplementRecommendations);
router.post('/supplements/:recommendationId/track', dietRecommendationController.trackSupplementUsage);

module.exports = router;
