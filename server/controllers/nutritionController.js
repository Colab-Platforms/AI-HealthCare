const FoodLog = require('../models/FoodLog');
const HealthGoal = require('../models/HealthGoal');
const NutritionSummary = require('../models/NutritionSummary');
const User = require('../models/User');
const HealthMetric = require('../models/HealthMetric');
const nutritionAI = require('../services/nutritionAI');
const { uploadImage } = require('../services/cloudinary');
const QuickFoodCheck = require('../models/QuickFoodCheck');
const fs = require('fs');
const cache = require('../utils/cache');

// Helper function to add timeout to all queries for Vercel compatibility
const withTimeout = (query, timeoutMs = 30000) => {
  return query.maxTimeMS(timeoutMs);
};

// --- HARDCODED NUTRITIONAL STANDARDS FOR 100% ACCURACY ---
const STANDARDS = {
  egg: { calories: 70, protein: 6, fats: 5, carbs: 0.5, unit: 'egg' },
  chicken: { calories: 165, protein: 31, fats: 3.6, carbs: 0, unit: '100g' },
  paneer: { calories: 265, protein: 18, fats: 20, carbs: 1.2, unit: '100g' },
  apple: { calories: 95, protein: 0.5, fats: 0.3, carbs: 25, unit: 'apple' },
  chapati: { calories: 104, protein: 3, fats: 0.4, carbs: 22, unit: 'chapati' },
  roti: { calories: 104, protein: 3, fats: 0.4, carbs: 22, unit: 'roti' },
  rice: { calories: 130, protein: 2.7, fats: 0.3, carbs: 28, unit: '100g' },
  biryani: { calories: 180, protein: 9, fats: 8, carbs: 22, unit: '100g' },
  dal: { calories: 116, protein: 9, fats: 0.4, carbs: 20, unit: '100g' }
};

const applyStandards = (foodName, description, data) => {
  const name = String(foodName || '').toLowerCase();
  const desc = String(description || '').toLowerCase();
  const combined = `${name} ${desc}`;
  
  // Supported units for matching
  const weightUnits = ['g', 'gram', 'ml', 'milliliter'];

  // 1. Identify if this is a composite food (Biryani, Burger, etc.)
  // We prioritize composite standards over component standards.
  const compositeKeywords = ['biryani', 'pizza', 'sandwich', 'burger', 'roll', 'wrap', 'curry', 'masala', 'fried rice', 'pulao'];
  const isComposite = compositeKeywords.some(comp => combined.includes(comp));

  // 2. Extract Quantity from either the analyzed name or original query
  const { qty, unit: detectedUnit } = extractQuantity(combined);
  
  for (const [key, std] of Object.entries(STANDARDS)) {
    // Check if the staple name exists
    if (combined.includes(key)) {
      
      // STAPLE PROTECTION: 
      // If we are matching 'chicken' but it's a 'chicken biryani', skip if key is just 'chicken'.
      if (isComposite && key !== 'biryani' && combined.includes('biryani')) continue;
      if (isComposite && key !== 'rice' && combined.includes('rice') && key === 'rice') { /* rice is okay for rice dishes */ }
      else if (isComposite && !key.includes(combined.split(' ').find(w => compositeKeywords.includes(w)) || '')) {
         // Generic component matching protection
         if (key === 'chicken' || key === 'paneer' || key === 'egg') {
           if (!name.startsWith(key) && name.length > key.length + 3) continue;
         }
      }

      let factor = qty;
      const usesGrams = weightUnits.some(u => combined.includes(u));

      // FIXED FACTOR MATH
      if (std.unit === '100g') {
        if (usesGrams) {
          factor = qty / 100;
        } else {
          // If no grams specified (e.g. "Chicken Biryani"), assume a standard serving (e.g. 250g)
          // or just 1.0 if we want to stick to base.
          factor = 1.0; 
        }
      } else {
        // For unit-based (eggs, chapatis), factor is just the quantity
        factor = qty;
      }
      
      console.log(`🎯 [Rigid Standard] Applied: "${key}" | Qty: ${qty} | Factor: ${factor.toFixed(2)}`);
      
      const standardized = {
        ...data,
        calories: parseFloat((std.calories * factor).toFixed(1)),
        protein: parseFloat((std.protein * factor).toFixed(1)),
        fats: parseFloat((std.fats * factor).toFixed(1)),
        carbs: parseFloat((std.carbs * factor).toFixed(1)),
        _isStandardized: true
      };

      // Ensure all UI paths get the same data
      const macroKeys = ['calories', 'protein', 'fats', 'carbs'];
      if (standardized.foodItem?.nutrition) {
         macroKeys.forEach(k => standardized.foodItem.nutrition[k] = standardized[k]);
      }
      if (standardized.nutrition) {
         macroKeys.forEach(k => standardized.nutrition[k] = standardized[k]);
      }
       if (standardized.totalNutrition) {
         macroKeys.forEach(k => standardized.totalNutrition[k] = standardized[k]);
      }

      return standardized;
    }
  }
  return data;
};
// Helper to safely convert to Number (handles strings with units like "50 kcal" or "20g")
const getNum = (val) => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).match(/([0-9.]+)/);
  if (cleaned) {
    const num = parseFloat(cleaned[1]);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

// --- DATA SANITIZERS (ENSURE CONSISTENT STRUCTURE FOR CACHE & UI) ---
const sanitizeMicronutrients = (data) => {
  if (!data) return [];
  const items = Array.isArray(data) ? data : [data];
  const flat = [];
  items.forEach(item => {
    if (typeof item === 'string' && (item.trim().startsWith('[') || item.trim().startsWith('{'))) {
      try {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed)) flat.push(...parsed);
        else flat.push(parsed);
      } catch (e) { flat.push(item); }
    } else flat.push(item);
  });
  return flat.map(item => {
    if (typeof item === 'string') return { name: item, value: 'Included', percentage: 0 };
    return {
      name: item.name || item.nutrient || 'Unknown',
      value: String(item.value || item.amount || 'Unknown'),
      percentage: Number(item.percentage) || 0
    };
  });
};

const sanitizeTips = (data) => {
  if (!data) return [];
  const items = Array.isArray(data) ? data : [data];
  const flat = [];
  items.forEach(item => {
    if (typeof item === 'string' && (item.trim().startsWith('[') || item.trim().startsWith('{'))) {
      try {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed)) flat.push(...parsed);
        else flat.push(parsed);
      } catch (e) { flat.push(item); }
    } else flat.push(item);
  });
  return flat.map(item => {
    if (typeof item === 'string') return { name: 'Tip', benefit: item };
    return {
      name: item.name || 'Tip',
      benefit: String(item.benefit || item.description || item.tip || '')
    };
  });
};

const sanitizeBenefits = (data) => {
  if (!data) return [];
  const items = Array.isArray(data) ? data : [data];
  const flat = [];
  items.forEach(item => {
    if (typeof item === 'string' && (item.trim().startsWith('[') || item.trim().startsWith('{'))) {
      try {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed)) flat.push(...parsed);
        else flat.push(parsed);
      } catch (e) { flat.push(item); }
    } else flat.push(item);
  });
  return flat.map(item => {
    if (typeof item === 'string') return { name: 'Health', benefit: item };
    return {
      name: item.name || 'Health',
      benefit: String(item.benefit || item.description || '')
    };
  });
};

const sanitizeAlternatives = (data) => {
  if (!data) return [];
  const items = Array.isArray(data) ? data : [data];
  const flat = [];
  items.forEach(item => {
    if (typeof item === 'string' && (item.trim().startsWith('[') || item.trim().startsWith('{'))) {
      try {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed)) flat.push(...parsed);
        else flat.push(parsed);
      } catch (e) { flat.push(item); }
    } else flat.push(item);
  });
  return flat.map(item => {
    if (typeof item === 'string') return { name: item, description: '', benefits: '' };
    return {
      name: item.name || 'Alternative',
      description: String(item.description || item.benefits || ''),
      benefits: String(item.benefits || item.benefit || '')
    };
  });
};

// --- DATA NORMALIZATION (FIX MISSING FIELDS FOR CACHE HITS) ---
const normalizeAnalysisResult = (item) => {
  if (!item) return null;
  const pojo = typeof item.toObject === 'function' ? item.toObject() : item;

  // Macro 0 Fix: Look everywhere for nutrition data (Defensive Fallback)
  // We prioritize any NON-ZERO value found in the hierarchy
  const findValue = (...paths) => {
    for (const val of paths) {
      const num = getNum(val);
      if (num > 0) return num;
    }
    // Fallback to whatever first number we find if all are zero
    for (const val of paths) {
      const num = getNum(val);
      if (!isNaN(num)) return num;
    }
    return 0;
  };

  const macroData = {
    calories: findValue(pojo.calories, pojo.nutrition?.calories, pojo.totalNutrition?.calories, pojo.foodItem?.nutrition?.calories, pojo.nutritionalInfo?.calories),
    protein: findValue(pojo.protein, pojo.nutrition?.protein, pojo.totalNutrition?.protein, pojo.foodItem?.nutrition?.protein, pojo.nutritionalInfo?.protein),
    carbs: findValue(pojo.carbs, pojo.nutrition?.carbs, pojo.totalNutrition?.carbs, pojo.foodItem?.nutrition?.carbs, pojo.nutritionalInfo?.carbs),
    fats: findValue(pojo.fats, pojo.nutrition?.fats, pojo.totalNutrition?.fats, pojo.foodItem?.nutrition?.fats, pojo.nutritionalInfo?.fats),
    fiber: findValue(pojo.fiber, pojo.nutrition?.fiber, pojo.totalNutrition?.fiber, pojo.foodItem?.nutrition?.fiber, pojo.nutritionalInfo?.fiber),
    sugar: findValue(pojo.sugar, pojo.nutrition?.sugar, pojo.totalNutrition?.sugar, pojo.foodItem?.nutrition?.sugar, pojo.nutritionalInfo?.sugar),
    sodium: findValue(pojo.sodium, pojo.nutrition?.sodium, pojo.totalNutrition?.sodium, pojo.foodItem?.nutrition?.sodium, pojo.nutritionalInfo?.sodium)
  };

  const base = {
    ...pojo,
    ...macroData, // CRITICAL: Ensure top-level fields are populated for the UI
    foodItem: {
      name: pojo.foodName || pojo.foodItem?.name || 'Analyzed Food',
      quantity: pojo.quantity || pojo.foodItem?.quantity || '1 serving',
      nutrition: macroData
    },
    // Ensure all possible UI access paths work
    nutrition: macroData,
    totalNutrition: macroData,
    analysis: pojo.analysis || pojo.healthBenefitsSummary || 'Food analysis completed.',
    healthScore: getNum(pojo.healthScore || (pojo.healthScore10 * 10) || 50),
    healthScore10: getNum(pojo.healthScore10 || (pojo.healthScore / 10) || 5),
    micronutrients: sanitizeMicronutrients(pojo.micronutrients || pojo.foodItem?.micronutrients),
    enhancementTips: sanitizeTips(pojo.enhancementTips || pojo.foodItem?.enhancementTips),
    benefits: sanitizeBenefits(pojo.benefits || pojo.foodItem?.benefits || pojo.healthBenefits),
    warnings: Array.isArray(pojo.warnings) ? pojo.warnings : [], // Fixed: Missing mapping for Considerations
    alternatives: sanitizeAlternatives(pojo.alternatives),
    _isFromCache: true
  };

  // APPLY RIGID STANDARDS (Override AI and Cached variance)
  // BUT SKIP for image-based scans — the AI vision model has already computed
  // portion-accurate nutrition by actually seeing the food. Standards are only
  // useful for text-based queries where quantity/portion is ambiguous.
  if (pojo.scanType === 'image') {
    return base;
  }
  return applyStandards(base.foodItem.name, base.foodItem.quantity, base);
};

// --- SMART PROPORTIONAL SCALING (NEW) ---
const scaleNutrition = (pojo, factor) => {
  if (factor === 1) return pojo;
  
  // Create a deep copy
  const scaled = JSON.parse(JSON.stringify(pojo));
  const keys = ['calories', 'protein', 'carbs', 'fats', 'fiber', 'sugar', 'sodium'];
  
  const applyScale = (obj) => {
    if (!obj) return;
    keys.forEach(k => {
      if (typeof obj[k] === 'number') obj[k] = parseFloat((obj[k] * factor).toFixed(2));
    });
  };

  applyScale(scaled);
  applyScale(scaled.nutrition);
  applyScale(scaled.totalNutrition);
  if (scaled.foodItem) applyScale(scaled.foodItem.nutrition);

  // Scale micronutrients
  if (Array.isArray(scaled.micronutrients)) {
    scaled.micronutrients.forEach(m => {
      if (m.value) {
        const valMatch = String(m.value).match(/^([0-9.]+)\s*(.*)$/);
        if (valMatch) {
          const val = parseFloat(valMatch[1]);
          const unit = valMatch[2];
          m.value = `${parseFloat((val * factor).toFixed(2))}${unit ? ' ' + unit : ''}`;
        }
      }
    if (typeof m.percentage === 'number') m.percentage = parseFloat((m.percentage * factor).toFixed(1));
    });
  }

  return scaled;
};// Helper to extract numeric quantity, unit, and the base food name
// Helper to extract numeric quantity, unit, and the base food name anywhere in string
const extractQuantity = (str) => {
  if (!str) return { qty: 1, food: '', unit: '' };
  const s = String(str).toLowerCase().trim();
  
  const units = ['g', 'gram', 'kg', 'ml', 'litre', 'l', 'oz', 'lbs', 'cup', 'bowl', 'plate', 'serving', 'piece', 'pcs', 'unit', 'glass', 'egg', 'chapati', 'roti'];
  const unitRegex = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${units.join('|')})s?\\b`, 'i');

  const unitMatch = s.match(unitRegex);
  if (unitMatch) {
    const qty = parseFloat(unitMatch[1]);
    const unit = unitMatch[2].toLowerCase().replace(/s$/, '');
    let food = s.replace(unitMatch[0], '').trim();
    
    // If food becomes empty (e.g. search was just "2 eggs"), use the unit as the food name
    if (!food) food = unit;
    
    return { qty, unit, food };
  }

  const numMatch = s.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) {
    const qty = parseFloat(numMatch[1]);
    let food = s.replace(numMatch[1], '').trim();
    if (!food) food = 'serving'; // Fallback
    return { qty, unit: '', food };
  }
  
  return { qty: 1, food: s, unit: '' };
};

const findAndScaleCachedFood = async (description) => {
  if (!description) return null;
  const query = description.trim().toLowerCase();

  const { qty: searchQty, food: searchFood, unit: searchUnit } = extractQuantity(query);
  console.log(`🔍 [Cache Search] "${searchFood}" | Quantity: ${searchQty}${searchUnit}`);

  // 1. Exact Match Check (Stricter about quantity)
  const exactMatch = await QuickFoodCheck.findOne({
    $or: [
      { searchDescription: query }, 
      { foodName: { $regex: new RegExp(`^${description.trim()}$`, 'i') } }
    ]
  }).sort({ timestamp: -1 });

  if (exactMatch) {
    let result = normalizeAnalysisResult(exactMatch);
    const { qty: matchQty, unit: matchUnit } = extractQuantity(exactMatch.searchDescription || exactMatch.foodName || exactMatch.quantity || '');
    
    // If quantities match and units match, return it
    if (Math.abs(matchQty - searchQty) < 0.01 && matchUnit === searchUnit && (result.calories > 0 || query.includes('water'))) {
      console.log('✅ [Cache Hit] Exact match found with correct quantity.');
      return result;
    }

    // NEW: If string matches but quantity differs, scale EXACT MATCH result immediately
    const factor = searchQty / (matchQty || 1);
    console.log(`⚖️ [Smart Scale] Exact string match but quantity mismatch (${matchQty} vs ${searchQty}). Auto-scaling by ${factor.toFixed(2)}x`);
    result = scaleNutrition(result, factor);
    result.quantity = description;
    
    // Re-apply standards to ensure accuracy after scaling
    const finalResult = applyStandards(description, description, result);
    finalResult._isScaled = true;
    return finalResult;
  }

  // 2. Proportional Scaling Match (e.g., "200g chicken" -> scale from "100g")
  const cleanSuffix = searchFood.replace(/^g\s+/, '').replace(/s$/, '').replace(/ies$/, 'y').replace(/^(plate|bowl|cup|serving)\s+of\s+/, '');
  console.log(`⚖️ [Smart Scale] Attempting to find base items for: "${cleanSuffix}"`);
  
  const baseItems = await QuickFoodCheck.find({
    $or: [
      { foodName: { $regex: new RegExp(`^${cleanSuffix}$`, 'i') } },
      { searchDescription: { $regex: new RegExp(`^\\d*\\s*[a-zA-Z]*\\s*${cleanSuffix}$`, 'i') } },
      { searchDescription: cleanSuffix }
    ]
  }).sort({ timestamp: -1 }).limit(15);

  for (const item of baseItems) {
    const { qty: itemQty, unit: itemUnit } = extractQuantity(item.searchDescription || item.foodName || item.quantity);
    
    if (itemQty > 0) {
      let factor = searchQty / itemQty;
      
      // Unit Normalization
      if ((searchUnit === 'g' || searchUnit === 'ml') && (!itemUnit || itemUnit === 'serving' || itemUnit === 'unit')) {
        factor = searchQty / 100; // Assume base unit is 100g for staples
      } else if (searchUnit !== itemUnit && searchUnit && itemUnit) {
        continue; // Mismatch - skip
      }

      let result = normalizeAnalysisResult(item);
      if (result.calories < 10 && !query.includes('water')) continue;

      console.log(`⚖️ [Smart Scale] Match: "${item.foodName}" (${itemQty}${itemUnit}). Factor: ${factor.toFixed(2)}x`);
      let scaled = scaleNutrition(result, factor);
      scaled.quantity = description;
      
      // Final Force-override with Standards
      scaled = applyStandards(description, description, scaled);
      scaled._isScaled = true;
      return scaled;
    }
  }
  return null;
};

// Analyze food from image or text
exports.analyzeFood = async (req, res) => {
  try {
    const { foodDescription, imageBase64, additionalContext } = req.body;

    console.log('Analyzing food:', {
      hasDescription: !!foodDescription,
      hasImage: !!imageBase64,
      userId: req.user._id
    });

    if (!foodDescription && !imageBase64) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either a food description or image'
      });
    }

    let imageUrl = null;
    let analysis = null;

    if (imageBase64) {
      // Analyze from image and upload to Cloudinary in PARALLEL to save time
      console.log('Analyzing from image and uploading to Cloudinary in parallel...');
      
      const [analysisResult, uploadedUrl] = await Promise.all([
        nutritionAI.analyzeFromImage(imageBase64, additionalContext),
        uploadImage(`data:image/jpeg;base64,${imageBase64}`, 'logged_meals').catch(e => {
          console.error('Cloudinary upload in analyzeFood failed:', e.message);
          return null;
        })
      ]);

      analysis = analysisResult;
      imageUrl = uploadedUrl;
    } else {
      // Analyze from text
      console.log('Analyzing from text...');

      // ─── BUILD QUANTITY-AWARE SEARCH KEY ───
      const { additionalContext: ctx } = req.body;
      let qtyFromCtx = '';
      if (ctx) {
        const qtyMatch = String(ctx).match(/Quantity:\s*([^.]+)/i);
        if (qtyMatch) qtyFromCtx = qtyMatch[1].trim();
      }
      
      const hasLeadingNumber = /^\d/.test(foodDescription || '');
      const searchKey = qtyFromCtx && !hasLeadingNumber
        ? `${qtyFromCtx} ${foodDescription}`
        : foodDescription;
        
      console.log('🔑 [Cache Key]:', searchKey);
      
      // ─── GLOBAL INTELLIGENCE CACHE (NOW WITH SMART SCALING) ───
      const cachedResult = await findAndScaleCachedFood(searchKey);

      if (cachedResult) {
        console.log('📦 Global Intelligence Cache Hit (Exact or Scaled):', foodDescription);
        analysis = { success: true, data: cachedResult, source: 'global_history' };
      } else {
        analysis = await nutritionAI.quickFoodCheck(foodDescription, additionalContext);
        
        // Save to cache for future use
        if (analysis?.success && analysis?.data?.foodItem) {
          const aiData = analysis.data;
          const nutrition = {
            calories: getNum(aiData.foodItem?.nutrition?.calories || aiData.totalNutrition?.calories || aiData.calories),
            protein: getNum(aiData.foodItem?.nutrition?.protein || aiData.totalNutrition?.protein || aiData.protein),
            carbs: getNum(aiData.foodItem?.nutrition?.carbs || aiData.totalNutrition?.carbs || aiData.carbs),
            fats: getNum(aiData.foodItem?.nutrition?.fats || aiData.totalNutrition?.fats || aiData.fats),
            fiber: getNum(aiData.foodItem?.nutrition?.fiber || aiData.totalNutrition?.fiber || aiData.fiber),
            sugar: getNum(aiData.foodItem?.nutrition?.sugar || aiData.totalNutrition?.sugar || aiData.sugar),
            sodium: getNum(aiData.foodItem?.nutrition?.sodium || aiData.totalNutrition?.sodium || aiData.sodium)
          };
          
          const cacheEntry = new QuickFoodCheck({
            userId: req.user._id,
            foodName: (aiData.foodItem.name || foodDescription).trim(),
            searchDescription: searchKey.trim().toLowerCase(),
            quantity: searchKey.trim().toLowerCase(),
            calories: nutrition.calories,
            protein: nutrition.protein,
            carbs: nutrition.carbs,
            fats: nutrition.fats,
            nutrition: nutrition,
            healthScore: getNum(aiData.healthScore),
            healthScore10: getNum(aiData.healthScore10 || (getNum(aiData.healthScore) / 10)),
            analysis: aiData.analysis || aiData.healthBenefitsSummary || '',
            micronutrients: sanitizeMicronutrients(aiData.micronutrients),
            enhancementTips: sanitizeTips(aiData.enhancementTips),
            warnings: Array.isArray(aiData.warnings) ? aiData.warnings.map(w => typeof w === 'string' ? w : (w.message || w.text || JSON.stringify(w))) : [],
            benefits: sanitizeBenefits(aiData.benefits || aiData.healthBenefits),
            healthBenefitsSummary: aiData.healthBenefitsSummary || aiData.analysis || '',
            alternatives: sanitizeAlternatives(aiData.alternatives),
            scanType: 'text',
            timestamp: new Date()
          });
          await cacheEntry.save().catch(e => console.error('Cache save error in analyzeFood:', e.message));
        }
      }
    }

    console.log('Food analysis completed successfully');
    res.json({
      success: true,
      analysis: {
        ...analysis.data,
        imageUrl
      },
      message: 'Food analyzed successfully'
    });
  } catch (error) {
    console.error('Analyze food error:', error.message, error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze food',
      error: error.message
    });
  }
};

// Log a meal
exports.logMeal = async (req, res) => {
  try {
    const {
      mealType,
      foodItems,
      imageUrl,
      notes,
      timestamp,
      healthScore,
      healthScore10,
      micronutrients,
      enhancementTips,
      healthBenefitsSummary,
      warnings,
      alternatives,
      source
    } = req.body;

    if (!mealType || !foodItems || foodItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Meal type and food items are required'
      });
    }

    // Sanitize metadata
    const sanitizedMicronutrients = sanitizeMicronutrients(micronutrients);
    const sanitizedTips = sanitizeTips(enhancementTips);
    const sanitizedAlternatives = sanitizeAlternatives(alternatives);

    // Calculate total nutrition explicitly before saving to ensure summary is correct
    const totalNutrition = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fats: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0
    };

    foodItems.forEach(item => {
      if (item.nutrition) {
        totalNutrition.calories += Number(item.nutrition.calories) || 0;
        totalNutrition.protein += Number(item.nutrition.protein) || 0;
        totalNutrition.carbs += Number(item.nutrition.carbs) || 0;
        totalNutrition.fats += Number(item.nutrition.fats) || 0;
        totalNutrition.fiber += Number(item.nutrition.fiber) || 0;
        totalNutrition.sugar += Number(item.nutrition.sugar) || 0;
        totalNutrition.sodium += Number(item.nutrition.sodium) || 0;
      }
    });

    // Extract vitamins and minerals from micronutrients array into totalNutrition
    // This ensures they are tracked in the summary and dashboard correctly
    totalNutrition.vitamins = {
      vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB12: 0, iron: 0, calcium: 0
    };
    
    sanitizedMicronutrients.forEach(m => {
      const name = (m.name || '').toLowerCase();
      const val = Number(parseFloat(String(m.value || '0').replace(/[^0-9.]/g, ''))) || 0;
      if (name.includes('vitamin a')) totalNutrition.vitamins.vitaminA += val;
      else if (name.includes('vitamin c')) totalNutrition.vitamins.vitaminC += val;
      else if (name.includes('vitamin d')) totalNutrition.vitamins.vitaminD += val;
      else if (name.includes('vitamin b12')) totalNutrition.vitamins.vitaminB12 += val;
      else if (name.includes('iron')) totalNutrition.vitamins.iron += val;
      else if (name.includes('calcium')) totalNutrition.vitamins.calcium += val;
      
      // Backup sync for fiber/sugar/sodium if they weren't in the main nutrition block
      if (name.includes('fiber') && totalNutrition.fiber === 0) totalNutrition.fiber = val;
      if (name.includes('sugar') && totalNutrition.sugar === 0) totalNutrition.sugar = val;
      if (name.includes('sodium') && totalNutrition.sodium === 0) totalNutrition.sodium = val;
    });

    const foodLog = new FoodLog({
      userId: req.user._id,
      mealType,
      foodItems,
      totalNutrition,
      imageUrl,
      notes,
      healthScore,
      healthScore10,
      micronutrients: sanitizedMicronutrients,
      enhancementTips: sanitizedTips,
      healthBenefitsSummary,
      warnings: Array.isArray(warnings) ? warnings : [],
      alternatives: sanitizedAlternatives,
      source,
      timestamp: (() => {
        const inputDate = timestamp || req.body.date;
        if (inputDate && typeof inputDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inputDate)) {
          const [y, m, d] = inputDate.split('-').map(Number);
          return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
        }
        return inputDate ? new Date(inputDate) : new Date();
      })()
    });

    await foodLog.save();

    // Update daily summary
    await updateDailySummary(req.user._id, foodLog.timestamp);

    res.json({
      success: true,
      foodLog,
      message: 'Meal logged successfully'
    });
  } catch (error) {
    console.error('Log meal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log meal',
      error: error.message
    });
  }
};

// Get food logs
exports.getFoodLogs = async (req, res) => {
  try {
    const { startDate, endDate, mealType, date } = req.query;

    const query = { userId: req.user._id };

    if (date) {
      // Parse YYYY-MM-DD as UTC to avoid timezone shift in different environments
      const [y, m, d_num] = date.split('-').map(Number);
      const d = new Date(Date.UTC(y, m - 1, d_num, 0, 0, 0, 0));
      const nextDay = new Date(d);
      nextDay.setUTCDate(d.getUTCDate() + 1);
      query.timestamp = { $gte: d, $lt: nextDay };
    } else if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    if (mealType) {
      query.mealType = mealType;
    }

    const foodLogs = await withTimeout(FoodLog.find(query)
      .sort({ timestamp: -1 })
      .limit(100));

    res.json({
      success: true,
      foodLogs,
      count: foodLogs.length
    });
  } catch (error) {
    console.error('Get food logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get food logs',
      error: error.message
    });
  }
};

// Get today's food logs
exports.getTodayLogs = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const foodLogs = await withTimeout(FoodLog.find({
      userId: req.user._id,
      timestamp: {
        $gte: today,
        $lt: tomorrow
      }
    }).sort({ timestamp: 1 }));

    res.json({
      success: true,
      foodLogs,
      count: foodLogs.length
    });
  } catch (error) {
    console.error('Get today logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get today\'s logs',
      error: error.message
    });
  }
};

// Update food log
exports.updateFoodLog = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const foodLog = await FoodLog.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!foodLog) {
      return res.status(404).json({
        success: false,
        message: 'Food log not found'
      });
    }

    Object.assign(foodLog, updates);
    await foodLog.save();

    // Update daily summary
    await updateDailySummary(req.user._id, foodLog.timestamp);

    res.json({
      success: true,
      foodLog,
      message: 'Food log updated successfully'
    });
  } catch (error) {
    console.error('Update food log error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update food log',
      error: error.message
    });
  }
};

// Delete food log
exports.deleteFoodLog = async (req, res) => {
  try {
    const { id } = req.params;

    const foodLog = await FoodLog.findOneAndDelete({
      _id: id,
      userId: req.user._id
    });

    if (!foodLog) {
      return res.status(404).json({
        success: false,
        message: 'Food log not found'
      });
    }

    // Update daily summary
    await updateDailySummary(req.user._id, foodLog.timestamp);

    res.json({
      success: true,
      message: 'Food log deleted successfully'
    });
  } catch (error) {
    console.error('Delete food log error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete food log',
      error: error.message
    });
  }
};

// Set health goal
exports.setHealthGoal = async (req, res) => {
  try {
    // Explicitly cast to numbers to prevent NaN crashes
    const sanitizedData = {
      ...req.body,
      currentWeight: Number(req.body.currentWeight) || 0,
      targetWeight: Number(req.body.targetWeight) || 0,
      height: Number(req.body.height) || 0,
      age: Number(req.body.age) || 0,
      gender: req.body.gender || 'male',
      userId: req.user._id
    };

    let healthGoal = await withTimeout(HealthGoal.findOne({ userId: req.user._id }));

    if (healthGoal) {
      Object.assign(healthGoal, sanitizedData);
    } else {
      healthGoal = new HealthGoal(sanitizedData);
    }

    // Safety: Trigger recalculations and check for NaNs before save
    if (isNaN(healthGoal.currentWeight)) healthGoal.currentWeight = 70;
    if (isNaN(healthGoal.targetWeight)) healthGoal.targetWeight = 70;
    if (isNaN(healthGoal.height)) healthGoal.height = 170;
    if (isNaN(healthGoal.age)) healthGoal.age = 25;

    await healthGoal.save({ maxTimeMS: 30000 });
    
    // SYNC: Update user's nutritionGoal in User model to keep dashboard in sync
    // Ensure macroTargets exist before accessing them to avoid crashes
    const proteinGoal = healthGoal.macroTargets?.protein || 150;
    const carbsGoal = healthGoal.macroTargets?.carbs || 200;
    const fatGoal = healthGoal.macroTargets?.fats || 65;

    await User.findByIdAndUpdate(req.user._id, {
      nutritionGoal: {
        goal: healthGoal.goalType,
        targetWeight: healthGoal.targetWeight,
        calorieGoal: healthGoal.dailyCalorieTarget,
        proteinGoal: proteinGoal,
        carbsGoal: carbsGoal,
        fatGoal: fatGoal,
        lastUpdated: new Date()
      },
      'profile.age': Number(healthGoal.age) || 0,
      'profile.height': Number(healthGoal.height) || 0,
      'profile.weight': Number(healthGoal.currentWeight) || 0
    });

    // Invalidate server-side dashboard cache
    cache.delete(`dashboard:${req.user._id}`);

    res.json({
      success: true,
      healthGoal,
      message: 'Health goal set successfully'
    });
  } catch (error) {
    console.error('SET_HEALTH_GOAL_CRITICAL:', error);
    
    // EMERGENCY LOG TO FILE for diagnostics
    try {
      const fs = require('fs');
      const path = require('path');
      const logEntry = `\n[${new Date().toISOString()}] SET_HEALTH_GOAL_ERROR: ${error.message}\nStack: ${error.stack}\nBody: ${JSON.stringify(req.body)}\n`;
      fs.appendFileSync(path.join(__dirname, '../error.log'), logEntry);
    } catch (e) {
      console.error('Failed to write to log file:', e.message);
    }

    // Check if it's a Mongoose validation error
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid goal data provided: ' + Object.values(error.errors).map(e => e.message).join(', ')
      });
    }

    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to set health goal',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get health goal
exports.getHealthGoal = async (req, res) => {
  try {
    const user = await withTimeout(require('../models/User').findById(req.user._id));

    // PRIORITIZE user's nutritionGoal from profile
    if (user && user.nutritionGoal && user.nutritionGoal.calorieGoal) {
      return res.json({
        success: true,
        healthGoal: {
          userId: req.user._id,
          dailyCalorieTarget: user.nutritionGoal.calorieGoal,
          macroTargets: {
            protein: user.nutritionGoal.proteinGoal || 150,
            carbs: user.nutritionGoal.carbsGoal || 200,
            fats: user.nutritionGoal.fatGoal || 65
          },
          goal: user.nutritionGoal.goal,
          targetWeight: user.nutritionGoal.targetWeight,
          source: 'user_profile'
        }
      });
    }

    // Fallback to HealthGoal model
    const healthGoal = await withTimeout(HealthGoal.findOne({ userId: req.user._id }));

    if (!healthGoal) {
      return res.status(404).json({
        success: false,
        message: 'No health goal found. Please set your goals first.'
      });
    }

    res.json({
      success: true,
      healthGoal
    });
  } catch (error) {
    console.error('Get health goal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get health goal',
      error: error.message
    });
  }
};

// Update health goal (alias for setHealthGoal for PUT requests)
exports.updateHealthGoal = async (req, res) => {
  try {
    const goalData = {
      ...req.body,
      userId: req.user._id
    };

    let healthGoal = await withTimeout(HealthGoal.findOne({ userId: req.user._id }));
    
    if (healthGoal) {
      Object.assign(healthGoal, goalData);
    } else {
      healthGoal = new HealthGoal(goalData);
    }

    await healthGoal.save({ maxTimeMS: 30000 });

    // SYNC: Update user's nutritionGoal in User model
    const proteinGoal = healthGoal.macroTargets?.protein || 150;
    const carbsGoal = healthGoal.macroTargets?.carbs || 200;
    const fatGoal = healthGoal.macroTargets?.fats || 65;

    await User.findByIdAndUpdate(req.user._id, {
      nutritionGoal: {
        goal: healthGoal.goalType,
        targetWeight: healthGoal.targetWeight,
        calorieGoal: healthGoal.dailyCalorieTarget,
        proteinGoal: proteinGoal,
        carbsGoal: carbsGoal,
        fatGoal: fatGoal,
        lastUpdated: new Date()
      },
      'profile.age': Number(healthGoal.age),
      'profile.height': Number(healthGoal.height),
      'profile.weight': Number(healthGoal.currentWeight)
    });

    // Invalidate server-side dashboard cache
    cache.delete(`dashboard:${req.user._id}`);

    res.json({
      success: true,
      healthGoal,
      message: 'Health goal updated successfully'
    });
  } catch (error) {
    console.error('Update health goal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update health goal',
      error: error.message
    });
  }
};

// Log weight
exports.logWeight = async (req, res) => {
  try {
    const { weight, notes, date } = req.body;

    console.log('Logging weight:', { userId: req.user._id, weight, notes, date });

    if (!weight) {
      return res.status(400).json({
        success: false,
        message: 'Weight value is required'
      });
    }

    // IMPORTANT: Parse date strings like "2026-03-13" as UTC directly to avoid timezone shift
    let recordedDate;
    if (date && typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [y, m, d] = date.split('-').map(Number);
      recordedDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    } else {
      recordedDate = date ? new Date(date) : new Date();
    }
    
    // Check if entry exists for this date, if so update it to avoid duplicates
    let metric = await HealthMetric.findOne({ 
      userId: req.user._id, 
      type: 'weight',
      recordedAt: {
        $gte: new Date(new Date(recordedDate).setUTCHours(0,0,0,0)),
        $lt: new Date(new Date(recordedDate).setUTCHours(23,59,59,999))
      }
    });

    if (metric) {
      metric.value = Number(weight);
      metric.notes = notes;
    } else {
      metric = new HealthMetric({
        userId: req.user._id,
        type: 'weight',
        value: Number(weight),
        unit: 'kg',
        readingContext: 'general',
        recordedAt: recordedDate,
        notes
      });
    }

    console.log('Saving weight metric to database...');
    await metric.save({ maxTimeMS: 30000 });
    console.log('Weight metric saved successfully');

    // Also update user profile weight and BMI
    const user = await withTimeout(User.findById(req.user._id));
    if (user) {
      user.profile = user.profile || {};
      user.profile.weight = Number(weight);

      // Recalculate BMI if height exists
      if (user.profile.height) {
        const heightInMeters = user.profile.height / 100;
        const bmi = Number((Number(weight) / (heightInMeters * heightInMeters)).toFixed(1));
        user.healthMetrics = user.healthMetrics || {};
        user.healthMetrics.bmi = bmi;
      }

      user.markModified('profile');
      user.markModified('healthMetrics');
      await user.save({ maxTimeMS: 30000 });
      console.log('User profile weight and BMI updated');
    }

    // Update health goal if exists
    const healthGoal = await withTimeout(HealthGoal.findOne({ userId: req.user._id }));

    if (healthGoal) {
      healthGoal.currentWeight = Number(weight);
      healthGoal.weeklyWeightLogs.push({
        weight: Number(weight),
        date: new Date(),
        notes
      });
      // Recalculate targets based on new weight
      await healthGoal.save({ maxTimeMS: 30000 });
      console.log('Health goal weight updated');

      // Ensure macroTargets exist before accessing them to avoid crashes
      const proteinGoal = healthGoal.macroTargets?.protein || 150;
      const carbsGoal = healthGoal.macroTargets?.carbs || 200;
      const fatGoal = healthGoal.macroTargets?.fats || 65;

      await User.findByIdAndUpdate(req.user._id, {
        nutritionGoal: {
          goal: healthGoal.goalType,
          targetWeight: healthGoal.targetWeight,
          calorieGoal: healthGoal.dailyCalorieTarget,
          proteinGoal: proteinGoal,
          carbsGoal: carbsGoal,
          fatGoal: fatGoal,
          lastUpdated: new Date()
        }
      });
    }

    // Invalidate server-side dashboard cache so next fetch returns fresh data
    cache.delete(`dashboard:${req.user._id}`);

    res.json({
      success: true,
      message: 'Weight logged successfully',
      metric,
      healthGoal
    });
  } catch (error) {
    console.error('Log weight error detailed:', {
      message: error.message,
      stack: error.stack,
      body: req.body,
      userId: req.user?._id
    });
    res.status(500).json({
      success: false,
      message: 'Failed to log weight',
      error: error.message
    });
  }
};

// Log water
exports.logWater = async (req, res) => {
  try {
    const { waterIntake, date } = req.body;
    const queryDate = date ? new Date(date) : new Date();
    const targetDate = new Date(queryDate.toISOString().split('T')[0]);
    targetDate.setUTCHours(0, 0, 0, 0);

    console.log('Logging water:', { userId: req.user._id, waterIntake, date: targetDate });

    // Update NutritionSummary
    let summary = await NutritionSummary.findOne({
      userId: req.user._id,
      date: targetDate
    });

    if (!summary) {
      summary = new NutritionSummary({
        userId: req.user._id,
        date: targetDate
      });
    }

    summary.waterIntake = Number(waterIntake);
    await summary.save();

    // Also update DailyProgress for dashboard metrics
    const dateStr = targetDate.toISOString().split('T')[0];
    const DailyProgress = require('../models/DailyProgress');
    await DailyProgress.findOneAndUpdate(
      { userId: req.user._id, date: dateStr },
      { waterIntake: Number(waterIntake) },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      waterIntake: summary.waterIntake,
      message: 'Water intake logged successfully'
    });
  } catch (error) {
    console.error('Log water error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log water',
      error: error.message
    });
  }
};

// Get daily nutrition summary
exports.getDailySummary = async (req, res) => {
  try {
    const { date } = req.query;
    // Use UTC date part for consistency
    const queryDate = date ? new Date(date) : new Date();
    const targetDate = new Date(queryDate.toISOString().split('T')[0]);
    targetDate.setUTCHours(0, 0, 0, 0);

    console.log(`Fetching summary for user ${req.user._id} on ${targetDate.toISOString()}`);

    const isToday = targetDate.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
    
    let summary;
    if (isToday) {
      summary = await updateDailySummary(req.user._id, targetDate);
    } else {
      summary = await withTimeout(NutritionSummary.findOne({
        userId: req.user._id,
        date: targetDate
      }));
      
      if (!summary) {
        summary = await createDailySummary(req.user._id, targetDate);
      }
    }

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Get daily summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get daily summary',
      error: error.message
    });
  }
};

// Get weekly summary
exports.getWeeklySummary = async (req, res) => {
  try {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const summaries = await NutritionSummary.find({
      userId: req.user._id,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    // Calculate weekly averages
    const weeklyStats = {
      avgCalories: 0,
      avgProtein: 0,
      avgCarbs: 0,
      avgFats: 0,
      daysLogged: summaries.length,
      dailySummaries: summaries
    };

    if (summaries.length > 0) {
      summaries.forEach(summary => {
        weeklyStats.avgCalories += summary.totalCalories;
        weeklyStats.avgProtein += summary.totalProtein;
        weeklyStats.avgCarbs += summary.totalCarbs;
        weeklyStats.avgFats += summary.totalFats;
      });

      weeklyStats.avgCalories = Math.round(weeklyStats.avgCalories / summaries.length);
      weeklyStats.avgProtein = Math.round(weeklyStats.avgProtein / summaries.length);
      weeklyStats.avgCarbs = Math.round(weeklyStats.avgCarbs / summaries.length);
      weeklyStats.avgFats = Math.round(weeklyStats.avgFats / summaries.length);
    }

    res.json({
      success: true,
      weeklyStats
    });
  } catch (error) {
    console.error('Get weekly summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get weekly summary',
      error: error.message
    });
  }
};

// Get 7 days activity data for chart (relative to selected date)
exports.getActivityWeek = async (req, res) => {
  try {
    const { date } = req.query;
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const summaries = await NutritionSummary.find({
      userId: req.user._id,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    // Create array with all 7 days, filling in missing days with 0 calories
    const weekData = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);

      const summary = summaries.find(s => {
        const sDate = new Date(s.date);
        sDate.setHours(0, 0, 0, 0);
        return sDate.getTime() === date.getTime();
      });

      weekData.push({
        date: date.toISOString().split('T')[0],
        calories: summary?.totalCalories || 0,
        protein: summary?.totalProtein || 0,
        carbs: summary?.totalCarbs || 0,
        fats: summary?.totalFats || 0
      });
    }

    res.json({
      success: true,
      weekData
    });
  } catch (error) {
    console.error('Get activity week error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get activity data',
      error: error.message
    });
  }
};

// Get meal recommendations
exports.getRecommendations = async (req, res) => {
  try {
    const healthGoal = await HealthGoal.findOne({ userId: req.user._id });

    if (!healthGoal) {
      return res.status(404).json({
        success: false,
        message: 'Please set your health goal first'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let todaySummary = await NutritionSummary.findOne({
      userId: req.user._id,
      date: today
    });

    if (!todaySummary) {
      todaySummary = await createDailySummary(req.user._id, today);
    }

    // Get user's deficiencies from latest health report
    const User = require('../models/User');
    const user = await User.findById(req.user._id);
    const deficiencies = user.healthMetrics?.deficiencies || [];

    const recommendations = await nutritionAI.getMealRecommendations(
      healthGoal,
      todaySummary,
      deficiencies
    );

    res.json({
      success: true,
      recommendations: recommendations.data
    });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recommendations',
      error: error.message
    });
  }
};

// Helper function to update daily summary
exports.updateDailySummaryInternal = updateDailySummary;
async function updateDailySummary(userId, date) {
  try {
    // Normalize date to UTC midnight for consistency
    let targetDate;
    if (date instanceof Date) {
      targetDate = new Date(date.toISOString().split('T')[0]);
    } else if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
      targetDate = new Date(date.split('T')[0]);
    } else {
      targetDate = new Date(new Date(date).toISOString().split('T')[0]);
    }
    targetDate.setUTCHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    console.log(`Updating daily summary for ${userId} from ${targetDate.toISOString()} to ${nextDay.toISOString()}`);

    // Get all food logs for the day
    const foodLogs = await FoodLog.find({
      userId,
      timestamp: {
        $gte: targetDate,
        $lt: nextDay
      }
    });

    // Calculate totals
    const totals = {
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFats: 0,
      totalFiber: 0,
      totalSugar: 0,
      totalSodium: 0,
      totalVitaminA: 0,
      totalVitaminC: 0,
      totalVitaminD: 0,
      totalVitaminB12: 0,
      totalIron: 0,
      totalCalcium: 0,
      averageHealthScore: 0
    };

    const mealsLogged = {
      breakfast: false,
      lunch: false,
      dinner: false,
      snacks: 0
    };

    let totalWeight = 0;
    let weightedHealthScoreSum = 0;

    foodLogs.forEach(log => {
      // Use totalNutrition if available, otherwise sum foodItems as fallback
      const logNutrition = log.totalNutrition || { calories: 0, protein: 0, carbs: 0, fats: 0 };

      // Fallback: If totalNutrition is all 0 but foodItems are not, sum them
      let calories = Number(logNutrition.calories) || 0;
      let protein = Number(logNutrition.protein) || 0;
      let carbs = Number(logNutrition.carbs) || 0;
      let fats = Number(logNutrition.fats) || 0;
      let fiber = Number(logNutrition.fiber) || 0;

      if (calories === 0 && log.foodItems && log.foodItems.length > 0) {
        log.foodItems.forEach(item => {
          if (item.nutrition) {
            calories += Number(item.nutrition.calories) || 0;
            protein += Number(item.nutrition.protein) || 0;
            carbs += Number(item.nutrition.carbs) || 0;
            fats += Number(item.nutrition.fats) || 0;
            fiber += Number(item.nutrition.fiber) || 0;
          }
        });
      }

      totals.totalCalories += calories;
      totals.totalProtein += protein;
      totals.totalCarbs += carbs;
      totals.totalFats += fats;
      totals.totalFiber += fiber;
      totals.totalSugar += Number(logNutrition.sugar) || 0;
      totals.totalSodium += Number(logNutrition.sodium) || 0;

      if (logNutrition.vitamins) {
        totals.totalVitaminA += Number(logNutrition.vitamins.vitaminA) || 0;
        totals.totalVitaminC += Number(logNutrition.vitamins.vitaminC) || 0;
        totals.totalVitaminD += Number(logNutrition.vitamins.vitaminD) || 0;
        totals.totalVitaminB12 += Number(logNutrition.vitamins.vitaminB12) || 0;
        totals.totalIron += Number(logNutrition.vitamins.iron) || 0;
        totals.totalCalcium += Number(logNutrition.vitamins.calcium) || 0;
      } else if (log.micronutrients && log.micronutrients.length > 0) {
        // Fallback: Parse micronutrients array if vitamins object is missing
        log.micronutrients.forEach(m => {
          const name = (m.name || '').toLowerCase();
          const val = Number(parseFloat(String(m.value || '0').replace(/[^0-9.]/g, ''))) || 0;
          
          if (name.includes('vitamin a')) totals.totalVitaminA += val;
          else if (name.includes('vitamin c')) totals.totalVitaminC += val;
          else if (name.includes('vitamin d')) totals.totalVitaminD += val;
          else if (name.includes('vitamin b12')) totals.totalVitaminB12 += val;
          else if (name.includes('iron')) totals.totalIron += val;
          else if (name.includes('calcium')) totals.totalCalcium += val;
          else if (name.includes('fiber')) totals.totalFiber += val;
          else if (name.includes('sugar')) totals.totalSugar += val;
          else if (name.includes('sodium')) totals.totalSodium += val;
        });
      }

      // Weight the health score by calories of the item
      const healthScore = log.healthScore10 !== undefined ? log.healthScore10 * 10 : (log.healthScore || 50);
      weightedHealthScoreSum += healthScore * (calories || 100);
      totalWeight += (calories || 100);

      if (log.mealType === 'snack') {
        mealsLogged.snacks++;
      } else if (['breakfast', 'lunch', 'dinner'].includes(log.mealType)) {
        mealsLogged[log.mealType] = true;
      }
    });

    if (totalWeight > 0) {
      const avg = weightedHealthScoreSum / totalWeight;
      totals.averageHealthScore = isNaN(avg) ? 0 : Math.round(avg);
    } else if (foodLogs.length > 0) {
      const totalScore = foodLogs.reduce((sum, log) => sum + (log.healthScore10 !== undefined ? log.healthScore10 * 10 : (log.healthScore || 50)), 0);
      const avg = totalScore / foodLogs.length;
      totals.averageHealthScore = isNaN(avg) ? 0 : Math.round(avg);
    }

    // Get user's latest health goal
    const healthGoal = await HealthGoal.findOne({ userId, isActive: true }).sort({ createdAt: -1 });

    let summary = await NutritionSummary.findOne({ userId, date: targetDate });

    if (!summary) {
      console.log(`Summary not found for ${userId} on ${targetDate.toISOString()}, creating new one.`);
      const newSummary = new NutritionSummary({
        userId,
        date: targetDate,
        totalCalories: totals.totalCalories,
        totalProtein: totals.totalProtein,
        totalCarbs: totals.totalCarbs,
        totalFats: totals.totalFats,
        totalFiber: totals.totalFiber,
        totalSugar: totals.totalSugar,
        totalSodium: totals.totalSodium,
        totalVitaminA: totals.totalVitaminA,
        totalVitaminC: totals.totalVitaminC,
        totalVitaminD: totals.totalVitaminD,
        totalVitaminB12: totals.totalVitaminB12,
        totalIron: totals.totalIron,
        totalCalcium: totals.totalCalcium,
        averageHealthScore: totals.averageHealthScore,
        mealsLogged
      });

      // Try to get goals from active diet plan first
      const PersonalizedDietPlan = require('../models/PersonalizedDietPlan');
      const activePlan = await PersonalizedDietPlan.findOne({
        userId,
        isActive: true,
        validUntil: { $gt: new Date() }
      }).sort({ generatedAt: -1 });

      if (activePlan && (activePlan.nutritionGoals || activePlan.dailyCalorieTarget)) {
        newSummary.calorieGoal = activePlan.nutritionGoals?.dailyCalorieTarget || activePlan.dailyCalorieTarget || 2000;
        newSummary.proteinGoal = activePlan.nutritionGoals?.macroTargets?.protein || activePlan.macroTargets?.protein || 150;
        newSummary.carbsGoal = activePlan.nutritionGoals?.macroTargets?.carbs || activePlan.macroTargets?.carbs || 200;
        newSummary.fatsGoal = activePlan.nutritionGoals?.macroTargets?.fats || activePlan.macroTargets?.fats || 65;
        console.log('✅ Daily goals synced from active PersonalizedDietPlan');
      } else if (healthGoal) {
        newSummary.calorieGoal = healthGoal.dailyCalorieTarget;
        newSummary.proteinGoal = healthGoal.macroTargets?.protein || 150;
        newSummary.carbsGoal = healthGoal.macroTargets?.carbs || 200;
        newSummary.fatsGoal = healthGoal.macroTargets?.fats || 65;
        console.log('✅ Daily goals synced from HealthGoal model');
      }

      await newSummary.save();
      return newSummary;
    }

    // Update existing summary
    summary.totalCalories = totals.totalCalories;
    summary.totalProtein = totals.totalProtein;
    summary.totalCarbs = totals.totalCarbs;
    summary.totalFats = totals.totalFats;
    summary.totalFiber = totals.totalFiber;
    summary.totalSugar = totals.totalSugar;
    summary.totalSodium = totals.totalSodium;
    summary.totalVitaminA = totals.totalVitaminA;
    summary.totalVitaminC = totals.totalVitaminC;
    summary.totalVitaminD = totals.totalVitaminD;
    summary.totalVitaminB12 = totals.totalVitaminB12;
    summary.totalIron = totals.totalIron;
    summary.totalCalcium = totals.totalCalcium;
    summary.averageHealthScore = totals.averageHealthScore;
    summary.mealsLogged = mealsLogged;
    // Keep waterIntake as is, unless we want to reset it (unlikely)

    // Refresh goals if needed (in case they changed)
    const PersonalizedDietPlan = require('../models/PersonalizedDietPlan');
    const activePlan = await PersonalizedDietPlan.findOne({
      userId,
      isActive: true,
      validUntil: { $gt: new Date() }
    }).sort({ generatedAt: -1 });

    if (activePlan && (activePlan.nutritionGoals || activePlan.dailyCalorieTarget)) {
      summary.calorieGoal = activePlan.nutritionGoals?.dailyCalorieTarget || activePlan.dailyCalorieTarget || 2000;
      summary.proteinGoal = activePlan.nutritionGoals?.macroTargets?.protein || activePlan.macroTargets?.protein || 150;
      summary.carbsGoal = activePlan.nutritionGoals?.macroTargets?.carbs || activePlan.macroTargets?.carbs || 200;
      summary.fatsGoal = activePlan.nutritionGoals?.macroTargets?.fats || activePlan.macroTargets?.fats || 65;
    } else if (healthGoal) {
      summary.calorieGoal = healthGoal.dailyCalorieTarget;
      summary.proteinGoal = healthGoal.macroTargets?.protein || 150;
      summary.carbsGoal = healthGoal.macroTargets?.carbs || 200;
      summary.fatsGoal = healthGoal.macroTargets?.fats || 65;
    }

    // Force recalculation of status and percentages
    if (typeof summary.calculateStatus === 'function') {
      summary.calculateStatus();
    }

    await summary.save();
    console.log(`Daily summary updated successfully for ${userId} on ${targetDate.toISOString()}. Total Cals: ${summary.totalCalories}`);
    return summary;
  } catch (error) {
    console.error('Update daily summary error:', error);
    return null;
  }
}

// Helper function to create daily summary
async function createDailySummary(userId, date) {
  return await updateDailySummary(userId, date);
}

// Quick food check without logging - with complete details persistence
exports.quickFoodCheck = async (req, res) => {
  try {
    let { foodDescription, imageBase64, additionalContext, quantity, prepMethod } = req.body;

    let cloudinaryUrl = null;

    console.log('🏁 [QuickCheck] Start - User ID:', req.user?._id);
    console.log('📑 [QuickCheck] Headers:', req.headers['content-type']);
    console.log('📦 [QuickCheck] Body keys:', Object.keys(req.body));

    // BUILD QUANTITY-AWARE SEARCH KEY (defined early so save logic can use it)
    const hasLeadingNumber = /^\d/.test(foodDescription || '');
    let searchKey = foodDescription || '';
    if (quantity && !hasLeadingNumber) {
      searchKey = `${quantity} ${foodDescription}`;
    } else if (additionalContext) {
      const qtyMatch = additionalContext.match(/Quantity:\s*([^.]+)/i);
      if (qtyMatch && !hasLeadingNumber) {
        searchKey = `${qtyMatch[1].trim()} ${foodDescription}`;
      }
    }

    // ─── STEP 1: Extract base64 from uploaded file ───
    if (req.file) {
      console.log('📷 [QuickCheck] File received:', req.file.originalname, 'Type:', req.file.mimetype, 'Size:', req.file.size);

      try {
        if (req.file.buffer) {
          // Memory storage (Vercel)
          imageBase64 = req.file.buffer.toString('base64');
        } else if (req.file.path) {
          // Disk storage (local)
          imageBase64 = fs.readFileSync(req.file.path, { encoding: 'base64' });
          // Delete temp file after reading
          fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting temp file:', err);
          });
        }
      } catch (fileError) {
        console.error('❌ [QuickCheck] File process error:', fileError);
        return res.status(500).json({
          success: false,
          message: 'Failed to process uploaded image',
          error: fileError.message
        });
      }
    }

    if (!foodDescription && !imageBase64) {
      console.log('⚠️ [QuickCheck] No input provided');
      return res.status(400).json({
        success: false,
        message: 'Please provide a food description or image'
      });
    }

    // ─── STEP 2 & 3: Upload to Cloudinary & AI Analysis in PARALLEL ───
    if (imageBase64) {
      try {
        console.log('🔄 [QuickCheck] Starting parallel Upload & AI Analysis...');
        const mimeType = req.file?.mimetype || 'image/jpeg';
        const dataUri = `data:${mimeType};base64,${imageBase64}`;

        // Combine description and additional context for more accurate AI analysis
        const combinedContext = [foodDescription, additionalContext]
          .filter(c => c && c !== 'Food from image')
          .join('. ') || 'Food from image';

        const [uploadResult, analysisResult] = await Promise.all([
          // Task 1: Upload to Cloudinary (wrapped in try/catch to not block AI)
          uploadImage(dataUri, 'food_scans').catch(err => {
            console.error('☁️ [QuickCheck] Cloudinary upload background error:', err.message);
            return null;
          }),
          // Task 2: AI Analysis
          nutritionAI.analyzeFromImage(imageBase64, combinedContext)
        ]);

        cloudinaryUrl = uploadResult;
        analysis = analysisResult;

        console.log('🧠 [QuickCheck] Image analysis successful:', analysis.data?.foodItem?.name || 'Unknown food');
        console.log('☁️ [QuickCheck] Cloudinary finished:', cloudinaryUrl ? 'Success' : 'Failed');

        // Check if AI couldn't detect food but returned 200 (special AI-rejection case)
        if (analysis.data?.error === 'UNABLE_TO_DETECT_FOOD') {
          return res.status(400).json({
            success: false,
            message: analysis.data.message || 'Could not detect food in image',
            error: 'UNABLE_TO_DETECT_FOOD'
          });
        }
      } catch (imageError) {
        console.error('❌ [QuickCheck] Parallel processing failed:', imageError.message);
        console.log('⚠️ [QuickCheck] Falling back to text-only analysis...');
        // Fallback to text analysis if image fails completely
        const fallbackContext = [foodDescription, additionalContext]
          .filter(c => c && c !== 'Food from image')
          .join('. ') || 'Food from image';
        analysis = await nutritionAI.quickFoodCheck(fallbackContext);
      }
    } else {
      console.log('📝 Using text analysis for:', foodDescription);
      console.log('🔑 [Cache Key]:', searchKey, '| Original:', foodDescription, '| Quantity:', quantity);

      // ─── GLOBAL INTELLIGENCE CACHE (NOW WITH SMART SCALING) ───
      const cachedResult = await findAndScaleCachedFood(searchKey);

      if (cachedResult && !imageBase64) {
        console.log('♻️ [Cache Hit] Global Intelligence reused (Exact or Scaled) for:', foodDescription);
        
        return res.json({
          success: true,
          data: cachedResult,
          isCached: true,
          source: 'global_cache',
          message: 'Retrieved from Global Intelligence Cache'
        });
      }

      analysis = await nutritionAI.quickFoodCheck(foodDescription, additionalContext);
    }

    if (!analysis.success || !analysis.data) {
      throw new Error('AI failed to return valid data');
    }

    console.log('💾 [QuickCheck] Saving to DB...');

    // Consolidate alternatives logic
    const alternativesArray = sanitizeAlternatives(analysis.data.alternatives);

    // ─── STEP 4: Construct final image URL ───
    let finalImageUrl = cloudinaryUrl;
    if (!finalImageUrl && imageBase64) {
      // Use truncated base64 for small images or just skip if too large
      if (imageBase64.length < 200000) {
        finalImageUrl = `data:image/jpeg;base64,${imageBase64}`;
      }
    }

    // ─── STEP 5: Save to MongoDB (Optimized with structured data) ───
    const aiData = analysis.data;
    const nutrition = {
      calories: getNum(aiData.foodItem?.nutrition?.calories || aiData.totalNutrition?.calories || aiData.calories),
      protein: getNum(aiData.foodItem?.nutrition?.protein || aiData.totalNutrition?.protein || aiData.protein),
      carbs: getNum(aiData.foodItem?.nutrition?.carbs || aiData.totalNutrition?.carbs || aiData.carbs),
      fats: getNum(aiData.foodItem?.nutrition?.fats || aiData.totalNutrition?.fats || aiData.fats),
      fiber: getNum(aiData.foodItem?.nutrition?.fiber || aiData.totalNutrition?.fiber || aiData.fiber),
      sugar: getNum(aiData.foodItem?.nutrition?.sugar || aiData.totalNutrition?.sugar || aiData.sugar),
      sodium: getNum(aiData.foodItem?.nutrition?.sodium || aiData.totalNutrition?.sodium || aiData.sodium)
    };
    
    const foodCheck = new QuickFoodCheck({
      userId: req.user._id,
      foodName: aiData.foodItem?.name || foodDescription || 'Analyzed Food',
      // CRITICAL FIX: Store the FULL quantity-aware search key, not just the food name
      searchDescription: searchKey.trim().toLowerCase(),
      quantity: searchKey.trim().toLowerCase(),
      calories: nutrition.calories,
      protein: nutrition.protein,
      carbs: nutrition.carbs,
      fats: nutrition.fats,
      nutrition: nutrition,
      healthScore: getNum(aiData.healthScore),
      healthScore10: getNum(aiData.healthScore10 || (getNum(aiData.healthScore) / 10)),
      isHealthy: aiData.isHealthy || false,
      analysis: aiData.analysis || aiData.healthBenefitsSummary || '',
      micronutrients: sanitizeMicronutrients(aiData.micronutrients),
      enhancementTips: sanitizeTips(aiData.enhancementTips),
      warnings: Array.isArray(aiData.warnings) ? aiData.warnings.map(w => typeof w === 'string' ? w : (w.message || w.text || JSON.stringify(w))) : [],
      benefits: sanitizeBenefits(aiData.benefits || aiData.healthBenefits),
      healthBenefitsSummary: aiData.healthBenefitsSummary || aiData.analysis || '',
      alternatives: alternativesArray,
      imageUrl: finalImageUrl,
      scanType: imageBase64 ? 'image' : 'text',
      timestamp: new Date()
    });

    try {
      await foodCheck.save();
    } catch (saveError) {
      console.warn('⚠️ [QuickCheck] Initial save failed, retrying with deep-clean...', saveError.message);
      // Force string conversion for all array elements to prevent "Cast to [string] failed" or object-in-string errors
      foodCheck.benefits = foodCheck.benefits.map(b => ({ name: String(b.name || 'Health'), benefit: String(b.benefit || '') }));
      foodCheck.micronutrients = foodCheck.micronutrients.map(m => ({ ...m, name: String(m.name), value: String(m.value) }));
      foodCheck.enhancementTips = foodCheck.enhancementTips.map(t => ({ name: String(t.name || 'Tip'), benefit: String(t.benefit || '') }));
      foodCheck.warnings = foodCheck.warnings.map(w => String(typeof w === 'object' ? JSON.stringify(w) : w));
      await foodCheck.save();
    }

    console.log('✅ Food check saved. Cloudinary URL:', cloudinaryUrl || 'N/A');
    res.json({
      success: true,
      data: normalizeAnalysisResult(foodCheck),
      isCached: false,
      message: 'Analysis complete and cached'
    });
  } catch (error) {
    console.error('❌ [QuickCheck] Fatal error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to analyze food',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get healthy alternatives for a food
exports.getHealthyAlternatives = async (req, res) => {
  try {
    const { foodName } = req.body;

    if (!foodName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a food name'
      });
    }

    // Get user's preferences
    const healthGoal = await HealthGoal.findOne({ userId: req.user._id });
    const User = require('../models/User');
    const user = await User.findById(req.user._id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySummary = await NutritionSummary.findOne({
      userId: req.user._id,
      date: today
    });

    const userPreferences = {
      dietaryPreference: healthGoal?.dietaryPreference || user.profile?.dietaryPreference,
      allergies: healthGoal?.allergies || user.profile?.allergies || [],
      goal: healthGoal?.goalType,
      remainingCalories: healthGoal && todaySummary
        ? healthGoal.dailyCalorieTarget - todaySummary.totalCalories
        : null
    };

    const result = await nutritionAI.getHealthyAlternatives(foodName, userPreferences);

    res.json({
      success: true,
      ...result.data,
      message: 'Alternatives generated successfully'
    });
  } catch (error) {
    console.error('Get alternatives error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get alternatives',
      error: error.message
    });
  }
};

module.exports = exports;


// Save a pre-analyzed food check (e.g. from barcode)
exports.saveQuickCheck = async (req, res) => {
  try {
    const {
      foodName, quantity, nutrition, healthScore, healthScore10,
      isHealthy, analysis, micronutrients, enhancementTips,
      warnings, benefits, healthBenefitsSummary, alternatives, imageUrl, scanType
    } = req.body;

    const QuickFoodCheck = require('../models/QuickFoodCheck');

    const foodCheck = new QuickFoodCheck({
      userId: req.user._id,
      foodName: foodName || 'Unknown Food',
      searchDescription: (foodName || '').trim().toLowerCase(), // New field for cache hits
      quantity: quantity || 'Standard Serving',
      nutrition: nutrition || {},
      calories: getNum(nutrition?.calories),
      protein: getNum(nutrition?.protein),
      carbs: getNum(nutrition?.carbs),
      fats: getNum(nutrition?.fats),
      healthScore: getNum(healthScore),
      healthScore10: getNum(healthScore10 || (getNum(healthScore) / 10)),
      isHealthy: isHealthy || false,
      analysis: analysis || healthBenefitsSummary || '',
      micronutrients: micronutrients || [],
      enhancementTips: enhancementTips || [],
      warnings: warnings || [],
      benefits: benefits || [],
      healthBenefitsSummary: healthBenefitsSummary || analysis || '',
      alternatives: alternatives || [],
      imageUrl: imageUrl || '',
      scanType: scanType || 'barcode'
    });

    await foodCheck.save();

    res.json({
      success: true,
      check: foodCheck,
      message: 'Scan saved to history'
    });
  } catch (error) {
    console.error('Save quick check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save scan result',
      error: error.message
    });
  }
};

// Get all saved quick food checks for user
exports.getQuickFoodChecks = async (req, res) => {
  try {
    const { limit = 50, skip = 0, date } = req.query;
    const QuickFoodCheck = require('../models/QuickFoodCheck');

    const query = { userId: req.user._id };

    // Filter by date if provided
    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);

      query.timestamp = {
        $gte: targetDate,
        $lt: nextDate
      };
    }

    const checks = await QuickFoodCheck.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await QuickFoodCheck.countDocuments(query);

    res.json({
      success: true,
      checks,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
  } catch (error) {
    console.error('Get quick food checks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get food checks',
      error: error.message
    });
  }
};

// Get single quick food check
exports.getQuickFoodCheck = async (req, res) => {
  try {
    const { id } = req.params;
    const QuickFoodCheck = require('../models/QuickFoodCheck');

    const check = await QuickFoodCheck.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!check) {
      return res.status(404).json({
        success: false,
        message: 'Food check not found'
      });
    }

    res.json({
      success: true,
      check
    });
  } catch (error) {
    console.error('Get quick food check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get food check',
      error: error.message
    });
  }
};

// Delete quick food check
exports.deleteQuickFoodCheck = async (req, res) => {
  try {
    const { id } = req.params;
    const QuickFoodCheck = require('../models/QuickFoodCheck');

    const check = await QuickFoodCheck.findOneAndDelete({
      _id: id,
      userId: req.user._id
    });

    if (!check) {
      return res.status(404).json({
        success: false,
        message: 'Food check not found'
      });
    }

    res.json({
      success: true,
      message: 'Food check deleted successfully'
    });
  } catch (error) {
    console.error('Delete quick food check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete food check',
      error: error.message
    });
  }
};

// Get food check history for a specific date
exports.getFoodCheckHistory = async (req, res) => {
  try {
    const { date } = req.query;
    const QuickFoodCheck = require('../models/QuickFoodCheck');

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required'
      });
    }

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const checks = await QuickFoodCheck.find({
      userId: req.user._id,
      timestamp: {
        $gte: targetDate,
        $lt: nextDate
      }
    }).sort({ timestamp: -1 });

    // Calculate daily stats
    const stats = {
      totalChecks: checks.length,
      healthyCount: checks.filter(c => c.isHealthy).length,
      unhealthyCount: checks.filter(c => !c.isHealthy).length,
      avgHealthScore: checks.length > 0
        ? Math.round(checks.reduce((sum, c) => sum + (c.healthScore || 0), 0) / checks.length)
        : 0,
      checks
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get food check history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get food check history',
      error: error.message
    });
  }
};

// Get weekly food check summary
exports.getWeeklyFoodCheckSummary = async (req, res) => {
  try {
    const QuickFoodCheck = require('../models/QuickFoodCheck');

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const checks = await QuickFoodCheck.find({
      userId: req.user._id,
      timestamp: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: -1 });

    // Group by date
    const byDate = {};
    checks.forEach(check => {
      const dateKey = check.timestamp.toISOString().split('T')[0];
      if (!byDate[dateKey]) {
        byDate[dateKey] = [];
      }
      byDate[dateKey].push(check);
    });

    // Calculate weekly stats
    const weeklyStats = {
      totalChecks: checks.length,
      healthyCount: checks.filter(c => c.isHealthy).length,
      unhealthyCount: checks.filter(c => !c.isHealthy).length,
      avgHealthScore: checks.length > 0
        ? Math.round(checks.reduce((sum, c) => sum + (c.healthScore || 0), 0) / checks.length)
        : 0,
      daysActive: Object.keys(byDate).length,
      byDate,
      topUnhealthyFoods: checks
        .filter(c => !c.isHealthy)
        .slice(0, 5)
        .map(c => ({ name: c.foodName, healthScore: c.healthScore })),
      topHealthyFoods: checks
        .filter(c => c.isHealthy)
        .slice(0, 5)
        .map(c => ({ name: c.foodName, healthScore: c.healthScore }))
    };

    res.json({
      success: true,
      weeklyStats
    });
  } catch (error) {
    console.error('Get weekly food check summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get weekly summary',
      error: error.message
    });
  }
};

// Get food image visually using Free AI Image Generation
exports.getFoodImage = async (req, res) => {
  try {
    const { foodName } = req.query;

    if (!foodName) {
      return res.status(400).json({
        success: false,
        message: 'Food name is required'
      });
    }

    // Using Bing Thumbnail API for highly accurate, free, lifetime image fetching
    const cleanFoodName = foodName.replace(/[^a-zA-Z0-9 ]/g, '');
    const encodedQuery = encodeURIComponent(cleanFoodName + ' food meal');
    
    // c=7 ensures proper cropping, w & h define quality constraints
    const imageUrl = `https://tse1.mm.bing.net/th?q=${encodedQuery}&w=500&h=500&c=7&rs=1&p=0`;

    res.json({
      success: true,
      imageUrl,
      source: 'BingThumb'
    });

  } catch (error) {
    console.error('Get food image error:', error);
    res.json({
      success: false,
      message: 'Failed to generate food image',
      error: error.message
    });
  }
};
