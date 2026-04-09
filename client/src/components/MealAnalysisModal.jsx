import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Zap, CheckCircle2, Lightbulb, FlaskConical, Utensils, Plus, Info, Flame, Heart, Activity, TrendingUp } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';

// Circular score gauge
function ScoreCircle({ score, size = 72 }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = ((score || 0) / 100) * circumference;
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth="5" />
        <motion.circle
          cx={size/2} cy={size/2} r={radius} fill="none"
          stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span 
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="text-xl font-black text-slate-900 leading-none"
        >
          {score || 0}
        </motion.span>
        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">/100</span>
      </div>
    </div>
  );
}

// Macro icon component
function MacroIcon({ type, className = '' }) {
  const configs = {
    calories: { bg: 'bg-orange-50', icon: <Flame className="w-4 h-4 text-orange-500" />, border: 'border-orange-100' },
    protein: { bg: 'bg-blue-50', icon: <Zap className="w-4 h-4 text-blue-500" />, border: 'border-blue-100' },
    carbs: { bg: 'bg-emerald-50', icon: <Activity className="w-4 h-4 text-emerald-500" />, border: 'border-emerald-100' },
    fats: { bg: 'bg-pink-50', icon: <Heart className="w-4 h-4 text-pink-500" />, border: 'border-pink-100' }
  };
  const config = configs[type] || configs.calories;
  
  return (
    <div className={`w-10 h-10 rounded-full ${config.bg} border ${config.border} flex items-center justify-center ${className}`}>
      {config.icon}
    </div>
  );
}

/**
 * Extract a consistent food name from the meal data.
 * Priority: user-typed input > foodItems[0].name > foodItem.name > foodName > title
 * This ensures the same name is shown during analysis AND when viewing later from timeline.
 */
function extractFoodName(meal) {
  return (
    meal._userInput ||
    meal.foodItems?.[0]?.name ||
    meal.foodItem?.name ||
    meal.foodName ||
    meal.name ||
    meal.title ||
    'Analyzed Meal'
  );
}

/**
 * Extract ALL micronutrients from all possible sources in the meal data:
 * 1. meal.micronutrients array (from AI analysis)
 * 2. meal.totalNutrition / meal.foodItems[0].nutrition (fiber, sugar, sodium, vitamins)
 * 3. meal.foodItem.nutrition (from analysis result)
 */
function extractAllMicronutrients(meal) {
  const micros = new Map(); // Use map to deduplicate by name

  // Source 1: micronutrients array (from AI analysis or DB)
  const microArr = meal.micronutrients || meal.foodItem?.micronutrients || [];
  microArr.forEach(m => {
    const name = (m.name || m.nutrient || '').trim();
    if (name) {
      micros.set(name.toLowerCase(), {
        label: name,
        value: m.value || m.amount || 0,
        unit: m.unit || '',
        percentage: m.percentage || m.dailyValue || null
      });
    }
  });

  // Source 2: Nutrition schema fields (fiber, sugar, sodium from DB)
  const nutrition = meal.totalNutrition || meal.foodItems?.[0]?.nutrition || meal.foodItem?.nutrition || meal.nutrition || {};
  
  if (nutrition.fiber && Number(nutrition.fiber) > 0) {
    micros.set('fiber', { label: 'Fiber', value: nutrition.fiber, unit: 'g', percentage: null });
  }
  if (nutrition.sugar && Number(nutrition.sugar) > 0) {
    micros.set('sugar', { label: 'Sugar', value: nutrition.sugar, unit: 'g', percentage: null });
  }
  if (nutrition.sodium && Number(nutrition.sodium) > 0) {
    micros.set('sodium', { label: 'Sodium', value: nutrition.sodium, unit: 'mg', percentage: null });
  }

  // Source 3: Vitamins from nutrition schema
  const vitamins = nutrition.vitamins || {};
  const vitaminMap = {
    vitaminA: { label: 'Vitamin A', unit: 'mcg' },
    vitaminC: { label: 'Vitamin C', unit: 'mg' },
    vitaminD: { label: 'Vitamin D', unit: 'mcg' },
    vitaminB12: { label: 'Vitamin B12', unit: 'mcg' },
    iron: { label: 'Iron', unit: 'mg' },
    calcium: { label: 'Calcium', unit: 'mg' }
  };

  Object.entries(vitamins).forEach(([key, val]) => {
    if (val && Number(val) > 0 && vitaminMap[key]) {
      const info = vitaminMap[key];
      micros.set(key.toLowerCase(), { label: info.label, value: val, unit: info.unit, percentage: null });
    }
  });

  return Array.from(micros.values());
}

export function MealAnalysisModal({ meal, onClose, onAdd, source }) {
  if (!meal) return null;

  // Use consistent name extraction
  const foodName = extractFoodName(meal);
  const quantity = meal.foodItems?.[0]?.quantity || meal.foodItem?.quantity || meal.quantity || '1 serving';
  const healthScore = meal.healthScore || (meal.healthScore10 ? meal.healthScore10 * 10 : 0) || 50;
  
  const calories = meal.foodItems?.[0]?.nutrition?.calories || meal.foodItem?.nutrition?.calories || meal.totalNutrition?.calories || meal.nutrition?.calories || meal.calories || 0;
  const protein = meal.foodItems?.[0]?.nutrition?.protein || meal.foodItem?.nutrition?.protein || meal.totalNutrition?.protein || meal.nutrition?.protein || meal.protein || 0;
  const carbs = meal.foodItems?.[0]?.nutrition?.carbs || meal.foodItem?.nutrition?.carbs || meal.totalNutrition?.carbs || meal.nutrition?.carbs || meal.carbs || 0;
  const fats = meal.foodItems?.[0]?.nutrition?.fats || meal.foodItem?.nutrition?.fats || meal.totalNutrition?.fats || meal.nutrition?.fats || meal.fats || 0;

  // Get the stored image URL (from scan/upload) — keeps consistent across views
  const storedImage = meal.imageUrl || meal.image || meal.foodItems?.[0]?.imageUrl || null;

  // Extract ALL micronutrients from all sources
  const allMicronutrients = extractAllMicronutrients(meal);

  // Generate a primary tag from analysis
  const generateTag = () => {
    if (protein >= 25) return 'HIGH PROTEIN';
    const fiberMicro = allMicronutrients.find(m => /fiber/i.test(m.label));
    if (fiberMicro && parseFloat(fiberMicro.value) >= 4) return 'HIGH FIBER';
    if (calories <= 200) return 'LOW CALORIE';
    if (carbs <= 15) return 'LOW CARB';
    if (fats <= 5) return 'LOW FAT';
    if (healthScore >= 85) return 'SUPER FOOD';
    if (healthScore >= 70) return 'NUTRITIOUS';
    return 'BALANCED';
  };

  const primaryTag = generateTag();
  const tagColor = {
    'HIGH PROTEIN': 'bg-blue-50 text-blue-700 border-blue-200',
    'HIGH FIBER': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'LOW CALORIE': 'bg-violet-50 text-violet-700 border-violet-200',
    'LOW CARB': 'bg-amber-50 text-amber-700 border-amber-200',
    'LOW FAT': 'bg-teal-50 text-teal-700 border-teal-200',
    'SUPER FOOD': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'NUTRITIOUS': 'bg-green-50 text-green-700 border-green-200',
    'BALANCED': 'bg-slate-50 text-slate-700 border-slate-200',
  }[primaryTag] || 'bg-slate-50 text-slate-700 border-slate-200';

  return (
    <div className="fixed inset-0 z-[1001] flex items-end md:items-center justify-center p-0 md:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, y: 80, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 80, scale: 0.97 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative w-full max-w-md bg-[#f7f8f4] rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-[0_-10px_60px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col max-h-[92vh] md:max-h-[90vh]"
      >
        {/* ─── HEADER: Score + Name + Tag ─── */}
        <div className="px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {/* Score Circle */}
              <ScoreCircle score={healthScore} size={68} />
              
              <div className="flex-1 min-w-0">
                {/* Tag Badge */}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${tagColor}`}>
                    <Info className="w-2.5 h-2.5" /> {primaryTag}
                  </span>
                </div>
                {/* Food Name — always uses user-typed name first for consistency */}
                <h2 className="text-lg font-black text-slate-900 tracking-tight leading-tight line-clamp-2">
                  {foodName}
                </h2>
                {/* Serving */}
                <div className="flex items-center gap-1.5 mt-1">
                  <Zap className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">{quantity}</span>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button 
              onClick={onClose} 
              className="w-9 h-9 bg-white hover:bg-slate-50 rounded-full flex items-center justify-center transition-all border border-slate-200 shadow-sm shrink-0 ml-3"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* ─── SCROLLABLE BODY ─── */}
        <div className="overflow-y-auto flex-1 scrollbar-hide px-6 pb-6 space-y-4">

          {/* ─── FOOD IMAGE ─── */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="relative w-full h-52 md:h-56 rounded-[1.5rem] overflow-hidden shadow-lg"
          >
            {/* Use storedImage first for consistency, fallback to name-based search */}
            <ImageWithFallback 
              src={storedImage}
              query={foodName}
              alt={foodName}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg text-[9px] font-black text-slate-700 uppercase tracking-wider shadow-md border border-white/60">
                <Sparkles className="w-3 h-3 text-emerald-500" /> Analyzed Image
              </span>
            </div>
          </motion.div>

          {/* ─── MACROS CARD ─── */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-slate-100/80"
          >
            <div className="grid grid-cols-4 gap-3">
              {[
                { type: 'calories', label: 'KCAL', value: calories, unit: '' },
                { type: 'protein', label: 'PROTEIN', value: protein, unit: 'g' },
                { type: 'carbs', label: 'CARBS', value: carbs, unit: 'g' },
                { type: 'fats', label: 'FATS', value: fats, unit: 'g' }
              ].map((macro, i) => (
                <motion.div 
                  key={macro.type}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + i * 0.08 }}
                  className="flex flex-col items-center text-center gap-2"
                >
                  <MacroIcon type={macro.type} />
                  <div>
                    <p className="text-lg font-black text-slate-900 leading-none tracking-tight">
                      {Math.round(macro.value)}{macro.unit && <span className="text-xs font-bold text-slate-400">{macro.unit}</span>}
                    </p>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{macro.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* ALL Micronutrients — show everything available, wrapped in a grid */}
            {allMicronutrients.length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                  {allMicronutrients.map((micro, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                      <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                        {micro.label}: <span className="font-bold text-slate-700">{micro.value}{micro.unit}</span>
                        {micro.percentage ? <span className="text-slate-400 ml-0.5">({micro.percentage}%)</span> : null}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* ─── HEALTH SUMMARY ─── */}
          {(meal.analysis || meal.healthBenefitsSummary) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-slate-100/80"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                  <Lightbulb className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Health Summary</span>
              </div>
              <p className="text-[13px] text-slate-600 font-medium leading-relaxed">
                {meal.analysis || meal.healthBenefitsSummary}
              </p>
            </motion.div>
          )}

          {/* ─── WARNINGS ─── */}
          {meal.warnings && meal.warnings.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="bg-amber-50/50 rounded-[1.5rem] p-5 border border-amber-200/50"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center border border-amber-200">
                  <Info className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Alerts</span>
              </div>
              <div className="space-y-2">
                {meal.warnings.slice(0, 3).map((warn, i) => (
                  <p key={i} className="text-[12px] text-amber-800 font-medium leading-relaxed flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                    {typeof warn === 'string' ? warn : warn.message || warn.text || JSON.stringify(warn)}
                  </p>
                ))}
              </div>
            </motion.div>
          )}

          {/* ─── ENHANCEMENT TIPS ─── */}
          {meal.enhancementTips && meal.enhancementTips.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enhancement Tips</span>
              </div>
              <div className="space-y-2.5">
                {meal.enhancementTips.slice(0, 4).map((tip, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.55 + i * 0.06 }}
                    className="flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <p className="text-[12px] font-semibold text-slate-700 leading-snug">
                      {typeof tip === 'string' ? tip : tip.name || tip.tip || 'Nutritional optimization'}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ─── ALTERNATIVES ─── */}
          {meal.alternatives && meal.alternatives.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                  <Utensils className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Better Alternatives</span>
              </div>
              <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
                {meal.alternatives.slice(0, 4).map((alt, i) => (
                  <div key={i} className="flex-shrink-0 px-4 py-2.5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
                      {typeof alt === 'string' ? alt : alt.name || alt.food || 'Alternative'}
                    </p>
                    {alt.calories && (
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">{alt.calories} kcal</p>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* ─── BOTTOM ACTION ─── */}
        {onAdd && (
          <div className="px-6 pb-6 pt-2 shrink-0 bg-gradient-to-t from-[#f7f8f4] via-[#f7f8f4] to-transparent">
            <button 
              onClick={onAdd}
              className="w-full py-4 bg-[#69A38D] hover:bg-[#5B9A80] text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" /> Add to Meal Log
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
