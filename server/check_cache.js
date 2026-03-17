
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const QuickFoodCheck = require('./models/QuickFoodCheck');

const sanitizeMicronutrients = (data) => {
  if (!Array.isArray(data)) return [];
  return data.map(item => {
    let obj = item;
    if (typeof item === 'string') {
      try { obj = JSON.parse(item); } catch (e) { obj = { name: item }; }
    }
    return {
      name: obj.name || 'Unknown',
      value: obj.value || obj.amount || 'Unknown',
      percentage: Number(obj.percentage) || 0
    };
  });
};

const sanitizeTips = (data) => {
  if (!Array.isArray(data)) return [];
  return data.map(item => {
    let obj = item;
    if (typeof item === 'string') {
      try { obj = JSON.parse(item); } catch (e) { obj = { name: 'Tip', benefit: item }; }
    }
    return {
      name: obj.name || 'Tip',
      benefit: obj.benefit || obj.description || (typeof obj === 'string' ? obj : '')
    };
  });
};

const sanitizeBenefits = (data) => {
  if (!Array.isArray(data)) return [];
  return data.map(item => {
    let obj = item;
    if (typeof item === 'string') {
      try { obj = JSON.parse(item); } catch (e) { obj = { name: 'Health', benefit: item }; }
    }
    return {
      name: obj.name || 'Health',
      benefit: obj.benefit || obj.description || (typeof obj === 'string' ? obj : '')
    };
  });
};

const sanitizeAlternatives = (data) => {
  if (!Array.isArray(data)) return [];
  return data.map(item => {
    let obj = item;
    if (typeof item === 'string') {
      try { obj = JSON.parse(item); } catch (e) { obj = { name: item }; }
    }
    return {
      name: obj.name || 'Alternative',
      description: obj.description || obj.benefits || '',
      benefits: obj.benefits || ''
    };
  });
};

const normalizeAnalysisResult = (item) => {
  if (!item) return null;
  const pojo = typeof item.toObject === 'function' ? item.toObject() : item;

  const findValue = (...paths) => {
    for (const val of paths) {
      const num = Number(val);
      if (!isNaN(num) && num > 0) return num;
    }
    for (const val of paths) {
      const num = Number(val);
      if (!isNaN(num)) return num;
    }
    return 0;
  };

  const macroData = {
    calories: findValue(pojo.calories, pojo.nutrition?.calories, pojo.totalNutrition?.calories, pojo.nutritionalInfo?.calories),
    protein: findValue(pojo.protein, pojo.nutrition?.protein, pojo.totalNutrition?.protein, pojo.nutritionalInfo?.protein),
    carbs: findValue(pojo.carbs, pojo.nutrition?.carbs, pojo.totalNutrition?.carbs, pojo.nutritionalInfo?.carbs),
    fats: findValue(pojo.fats, pojo.nutrition?.fats, pojo.totalNutrition?.fats, pojo.nutritionalInfo?.fats),
    fiber: findValue(pojo.fiber, pojo.nutrition?.fiber, pojo.totalNutrition?.fiber, pojo.nutritionalInfo?.fiber),
    sugar: findValue(pojo.sugar, pojo.nutrition?.sugar, pojo.totalNutrition?.sugar, pojo.nutritionalInfo?.sugar),
    sodium: findValue(pojo.sodium, pojo.nutrition?.sodium, pojo.totalNutrition?.sodium, pojo.nutritionalInfo?.sodium)
  };

  return {
    foodName: pojo.foodName,
    foodItem: {
      name: pojo.foodName || pojo.foodItem?.name || 'Analyzed Food',
      quantity: pojo.quantity || pojo.foodItem?.quantity || '1 serving',
      nutrition: macroData
    },
    nutrition: macroData,
    healthScore: findValue(pojo.healthScore, pojo.healthScore10 * 10, 50),
    healthScore10: findValue(pojo.healthScore10, pojo.healthScore / 10, 5),
    benefits: sanitizeBenefits(pojo.benefits),
    enhancementTips: sanitizeTips(pojo.enhancementTips)
  };
};

async function run() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/healthcare-platform';
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to DB');

  const latest = await QuickFoodCheck.find().sort({ timestamp: -1 }).limit(1);
  if (latest.length === 0) {
    console.log('No checks found');
  } else {
    const raw = latest[0];
    console.log('RAW DATA:', JSON.stringify(raw, null, 2));
    const normalized = normalizeAnalysisResult(raw);
    console.log('NORMALIZED DATA:', JSON.stringify(normalized, null, 2));
  }

  await mongoose.disconnect();
}

run().catch(console.error);
