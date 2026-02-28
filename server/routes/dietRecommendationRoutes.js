const express = require('express');
const router = express.Router();
const dietRecommendationController = require('../controllers/dietRecommendationController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Diet plan routes
router.post('/diet-plan/generate', dietRecommendationController.generatePersonalizedDietPlan);
router.get('/diet-plan/active', dietRecommendationController.getActiveDietPlan);
router.get('/diet-plan/history', dietRecommendationController.getDietPlanHistory);
router.get('/diet-plan/:planId', dietRecommendationController.getDietPlanById);
router.post('/diet-plan/:planId/rate', dietRecommendationController.rateDietPlan);

// Supplement recommendation routes
router.post('/supplements/generate', dietRecommendationController.generateSupplementRecommendations);
router.get('/supplements/active', dietRecommendationController.getActiveSupplementRecommendations);
router.post('/supplements/:recommendationId/track', dietRecommendationController.trackSupplementUsage);

module.exports = router;
