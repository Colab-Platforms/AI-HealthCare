const express = require('express');
const foodController = require('../controllers/foodController');
const { protect } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.use(protect);

// Food reference DB (docs/FOOD_DB_FLOW.md section 7)
router.get('/search', apiLimiter, foodController.searchFoods);
// Already-identified items → nutrition + warnings (no AI call, nothing saved)
router.post('/resolve', apiLimiter, foodController.resolve);

module.exports = router;
