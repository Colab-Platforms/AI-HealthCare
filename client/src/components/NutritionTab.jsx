import React, { useState, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Camera, Mic, Utensils, Droplet, Minus, CheckCircle2, AlertTriangle, X, Coffee, Apple, Calendar as CalendarIcon, Image as ImageIcon, Type, History, ArrowLeft, Flame, UtensilsCrossed, Zap, Search } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

import { MealAnalysisModal } from './MealAnalysisModal';

const LOG_METHODS = [
  { id: 'voice', label: 'Voice Log', icon: Mic },
  { id: 'photo', label: 'Add Food via Photo', icon: Camera },
  { id: 'import', label: 'Import Image', icon: ImageIcon },
  { id: 'text', label: 'Text Only', icon: Type }
];


export function NutritionTab({ 
  onLogFood, 
  loggedMeals = [], 
  dailySummary = {},
  waterIntake = { current: 0, target: 8 },
  onWaterUpdate,
  selectedDate,
  onDateChange,
  weeklyTrendsData = [],
  recentMeals = [],
  frequentFoods = [],
  aiInsights = ""
}) {
  const [activeSuggestion, setActiveSuggestion] = useState('Recommended');
  const [showRecipe, setShowRecipe] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [logMethodSection, setLogMethodSection] = useState(null);
  const [activeMealForImport, setActiveMealForImport] = useState(null);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const headerCameraRef = useRef(null);
  const activeMealRef = useRef(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const mealPool = {
    'Recommended': [
      {
        title: "Home-style Dal Tadka & Jeera Rice",
        protein: "14g", calories: "340 kcal", time: "25 min",
        image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?q=80&w=1080",
        ingredients: ["1/2 cup Toor Dal", "1/2 cup Basmati Rice", "1 tsp Cumin", "1 tbsp Ghee", "Fresh Coriander"],
        instructions: ["Wash and soak dal for 20 mins.", "Pressure cook dal with turmeric and salt.", "Sauté cumin and dried chilies in ghee to make the tadka.", "Mix tadka with dal and serve with steamed jeera rice."]
      },
      {
        title: "Whole Wheat Roti & Mix Veg",
        protein: "12g", calories: "290 kcal", time: "20 min",
        image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbf?q=80&w=1080",
        ingredients: ["2 Whole wheat rotis", "Carrots", "Beans", "Potatoes", "Indian spices"],
        instructions: ["Cook vegetables with mild spices until tender.", "Prepare soft dough and roll out rotis.", "Cook rotis on a tawa until puffed.", "Serve hot with a side of yogurt."]
      }
    ],
    'High Protein': [
      {
        title: "Paneer Bhurji with Multigrain Roti",
        protein: "24g", calories: "420 kcal", time: "15 min",
        image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?q=80&w=1080",
        ingredients: ["150g Crumbled Paneer", "Capsicum", "Onions", "2 Multigrain Rotis"],
        instructions: ["Sauté onions and capsicum in minimal oil.", "Add crumbled paneer and spice mix.", "Cook for 5 mins.", "Serve with hot multigrain rotis."]
      },
      {
        title: "Spicy Chana Masala",
        protein: "18g", calories: "380 kcal", time: "30 min",
        image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?q=80&w=1080",
        ingredients: ["1 cup Boiled Chickpeas", "Tomato puree", "Ginger-Garlic", "Garam Masala"],
        instructions: ["Sauté ginger-garlic and tomato puree until oil separates.", "Add spices and boiled chickpeas.", "Simmer for 10 mins until thick.", "Garnish with fresh ginger juliens."]
      }
    ],
    'Balanced': [
      {
        title: "Vegetable Pulao & Cucumber Raita",
        protein: "10g", calories: "360 kcal", time: "20 min",
        image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=1080",
        ingredients: ["Long grain rice", "Green peas", "Carrots", "Yogurt", "Cucumbers"],
        instructions: ["Cook rice with mixed vegetables and whole spices.", "Whisk yogurt with grated cucumber and roasted cumin.", "Serve pulao warm with chilled raita."]
      }
    ],
    'Low Carb': [
      {
        title: "Tandoori Paneer Tikka Salad",
        protein: "20g", calories: "310 kcal", time: "20 min",
        image: "https://images.unsplash.com/photo-1599481238640-4c1288750d7a?q=80&w=1080",
        ingredients: ["200g Paneer cubes", "Bell peppers", "Onion petals", "Lemon", "Curd marinade"],
        instructions: ["Marinate paneer and veggies in spiced curd.", "Grill or sauté until charred.", "Toss with a squeeze of lemon and fresh greens."]
      },
      {
        title: "Smoked Baingan Bharta",
        protein: "8g", calories: "240 kcal", time: "25 min",
        image: "https://images.unsplash.com/photo-1464306208223-e0b4495a5553?q=80&w=1080",
        ingredients: ["1 Large Eggplant", "Tomatoes", "Green chilies", "Mustard oil"],
        instructions: ["Roast eggplant over open flame until charred.", "Peel and mash.", "Sauté with onions, tomatoes, and chilies in mustard oil."]
      }
    ]
  };

  const currentSuggestion = useMemo(() => {
    const category = activeSuggestion || 'Recommended';
    const pool = mealPool[category] || mealPool['Recommended'];
    // Rotate weekly (or daily) based on date
    const dayIndex = new Date().getDay() % pool.length;
    return pool[dayIndex];
  }, [activeSuggestion]);

  const totalTodayKcal = useMemo(() => {
    return loggedMeals.reduce((acc, meal) => {
      return acc + (meal.foodItems?.reduce((a, b) => a + (b.nutrition?.calories || 0), 0) || meal.calories || 0);
    }, 0);
  }, [loggedMeals]);

  // Dynamic Frequent Foods calculation
  const dynamicFrequentFoods = useMemo(() => {
    if (!loggedMeals.length) return frequentFoods.length > 0 ? frequentFoods : ['Oats', 'Eggs', 'Rice'];
    const counts = {};
    loggedMeals.forEach(meal => {
      meal.foodItems?.forEach(item => {
        if (item.name) {
          counts[item.name] = (counts[item.name] || 0) + 1;
        }
      });
      if (meal.mealName && (!meal.foodItems || meal.foodItems.length === 0)) {
        counts[meal.mealName] = (counts[meal.mealName] || 0) + 1;
      }
    });
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);
    
    return sorted.length > 0 ? sorted.slice(0, 4) : (frequentFoods.length > 0 ? frequentFoods : ['Oats', 'Eggs', 'Rice']);
  }, [loggedMeals, frequentFoods]);

  // Dynamic Weekly Trends derivation
  const weeklyData = useMemo(() => {
    const base = weeklyTrendsData.length > 0 ? weeklyTrendsData : [
      { day: 'Mon', value: 1850 },
      { day: 'Tue', value: 2100 },
      { day: 'Wed', value: 1950 },
      { day: 'Thu', value: 2050 },
      { day: 'Fri', value: 1800 },
      { day: 'Sat', value: 2200 },
      { day: 'Sun', value: totalTodayKcal }
    ];
    
    const updated = [...base];
    if (updated.length > 0) {
      updated[updated.length - 1].value = totalTodayKcal;
    }
    return updated;
  }, [weeklyTrendsData, totalTodayKcal]);

  const maxWeeklyKcal = Math.max(2500, ...weeklyData.map(d => d.value || 0));
  const avgKcal = Math.round(weeklyData.reduce((acc, curr) => acc + (curr.value || 0), 0) / (weeklyData.length || 7));
  const diffFromLastWeek = Math.round(((avgKcal - 1900) / 1900) * 100);

  const progressPercent = Math.min(100, (totalTodayKcal / (dailySummary.calorieTarget || 1800)) * 100);

  return (
    <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8 max-w-5xl mx-auto w-full">
      {/* Top Nutrition Tracker Header */}
      <div className="flex flex-row items-center justify-between gap-2 mb-2 mt-1">
        <div className="flex flex-col gap-0.5 w-[42%] min-w-0">
          <h1 className="text-[16px] md:text-[32px] font-black text-[#1a2138] tracking-tight dark:text-white leading-none whitespace-nowrap">
            Nutrition Tracker
          </h1>
          <p className="text-[10px] md:text-[14px] font-medium text-slate-500/80 dark:text-slate-400">
            Achieve wellness goals..
          </p>
        </div>
        
        <div className="flex items-center gap-2 w-[58%] justify-end shrink-0">
          <button 
            onClick={() => onLogFood('Scan')} 
            className="bg-[#6FAF95] hover:bg-[#5B9A80] text-white px-3 md:px-4 py-1.5 md:py-2.5 h-9 md:h-11 rounded-full text-[11px] md:text-[14px] font-bold flex items-center gap-1 shadow-lg active:scale-95 transition-all justify-center whitespace-nowrap"
          >
            <Plus size={14} md:size={18} strokeWidth={3} /> Log Meal
          </button>
          
          <button 
            onClick={() => {
              // Directly open native camera
              if (headerCameraRef.current) headerCameraRef.current.value = '';
              headerCameraRef.current?.click();
            }}
            className="w-9 h-9 md:w-11 md:h-11 shrink-0 rounded-full bg-white dark:bg-[#1A221E] flex items-center justify-center text-slate-500 border border-slate-100 dark:border-white/10 hover:bg-slate-50 transition-all shadow-sm active:scale-90"
          >
            <Camera className="w-4 h-4 md:w-5 md:h-5 text-slate-500" strokeWidth={2} />
          </button>
          
          <button 
            onClick={() => onLogFood('Voice Log')}
            className="w-9 h-9 md:w-11 md:h-11 shrink-0 rounded-full bg-white dark:bg-[#1A221E] flex items-center justify-center text-slate-500 border border-slate-100 dark:border-white/10 hover:bg-slate-50 transition-all shadow-sm active:scale-90"
          >
            <Mic className="w-4 h-4 md:w-5 md:h-5 text-slate-500" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
        <div className="flex flex-col gap-6">
          {/* Daily Calorie Intake Card */}
          <div className="bg-white/60 backdrop-blur-xl rounded-[32px] p-6 shadow-sm border border-white relative overflow-hidden dark:bg-[#1A221E]/90 dark:border-white/10">
            <div className="absolute top-[-40px] right-[-40px] w-32 h-32 bg-[#558FE6]/20 rounded-full blur-2xl pointer-events-none"></div>
            
            <h3 className="text-[13px] font-bold text-[#64748b] dark:text-slate-400 mb-2">Daily Calorie Intake</h3>
            
            <div className="flex items-end justify-between mb-1.5">
              <div className="flex items-baseline gap-1">
                <span className={`text-[32px] md:text-[40px] font-bold tracking-tight leading-none ${totalTodayKcal > (dailySummary.calorieTarget || 1800) ? 'text-red-500' : 'text-[#1a2138] dark:text-white'}`}>{totalTodayKcal}</span>
                <span className="text-[16px] md:text-[20px] font-semibold text-[#64748b]/70 dark:text-slate-500">/ {dailySummary.calorieTarget || 1800}</span>
              </div>
              <div className="flex flex-col items-end pb-1">
                <span className={`text-[16px] font-bold tracking-tight ${totalTodayKcal > (dailySummary.calorieTarget || 1800) ? 'text-red-500' : 'text-[#1a2138] dark:text-white'}`}>{Math.round(progressPercent)}% <span className="text-[10px] font-semibold text-[#64748b]/70 dark:text-slate-500 uppercase tracking-wider ml-0.5">Of Goal</span></span>
              </div>
            </div>
            {totalTodayKcal > (dailySummary.calorieTarget || 1800) ? (
              <p className="text-[12px] font-black text-red-500 mb-5 flex items-center gap-1.5 uppercase tracking-tight">
                <AlertTriangle size={12} /> {totalTodayKcal - (dailySummary.calorieTarget || 1800)} kcal over limit
              </p>
            ) : (
              <p className="text-[12px] font-bold text-[#558FE6] mb-5">{(dailySummary.calorieTarget || 1800) - totalTodayKcal} kcal remaining</p>
            )}
            
            {/* Progress Bar */}
            <div className="w-full h-3.5 bg-white/50 dark:bg-black/20 rounded-full overflow-hidden mb-8 shadow-inner border border-white/50 dark:border-white/5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, progressPercent)}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-full rounded-full relative overflow-hidden ${totalTodayKcal > (dailySummary.calorieTarget || 1800) ? 'bg-red-500' : 'bg-[#69A38D]'}`} 
              >
                <div className="absolute inset-0 bg-white/10 w-full h-full"></div>
              </motion.div>
            </div>
            
            {/* Macros */}
            <div className="flex gap-3 w-full">
              {/* Protein */}
              <div className="flex-1 flex flex-col gap-1.5">
                <span className="text-[9px] font-black text-[#64748b]/70 dark:text-slate-500 uppercase tracking-widest">Protein</span>
                <div className="flex items-baseline gap-1">
                  <span className={`text-[13px] font-bold tracking-tight ${dailySummary.protein > dailySummary.proteinTarget ? 'text-red-500' : 'text-[#1a2138] dark:text-white'}`}>{dailySummary.protein}g</span>
                  <span className="text-[10px] font-bold text-[#64748b]/70 dark:text-slate-500">/ {dailySummary.proteinTarget}g</span>
                </div>
                <div className="w-full h-1.5 bg-white/50 dark:bg-black/20 border border-white/50 dark:border-white/5 rounded-full overflow-hidden">
                  <motion.div className={`h-full rounded-full ${dailySummary.protein > dailySummary.proteinTarget ? 'bg-red-500' : 'bg-[#5D5589]'}`} initial={{ width: 0 }} animate={{ width: `${Math.min(100, (dailySummary.protein / dailySummary.proteinTarget) * 100)}%` }}></motion.div>
                </div>
                <span className={`text-[9px] font-bold ${dailySummary.protein > dailySummary.proteinTarget ? 'text-red-500' : 'text-[#64748b]/70 dark:text-slate-500'}`}>
                  {dailySummary.protein > dailySummary.proteinTarget ? `${(dailySummary.protein - dailySummary.proteinTarget).toFixed(1)}g over` : `${(dailySummary.proteinTarget - dailySummary.protein).toFixed(1)}g left`}
                </span>
              </div>
              
              {/* Carbs */}
              <div className="flex-1 flex flex-col gap-1.5">
                <span className="text-[9px] font-black text-[#64748b]/70 dark:text-slate-500 uppercase tracking-widest">Carbs</span>
                <div className="flex items-baseline gap-1">
                  <span className={`text-[13px] font-bold tracking-tight ${dailySummary.carbs > dailySummary.carbsTarget ? 'text-red-500' : 'text-[#1a2138] dark:text-white'}`}>{dailySummary.carbs}g</span>
                  <span className="text-[10px] font-bold text-[#64748b]/70 dark:text-slate-500">/ {dailySummary.carbsTarget}g</span>
                </div>
                <div className="w-full h-1.5 bg-white/50 dark:bg-black/20 border border-white/50 dark:border-white/5 rounded-full overflow-hidden">
                  <motion.div className={`h-full rounded-full ${dailySummary.carbs > dailySummary.carbsTarget ? 'bg-red-500' : 'bg-[#558FE6]'}`} initial={{ width: 0 }} animate={{ width: `${Math.min(100, (dailySummary.carbs / dailySummary.carbsTarget) * 100)}%` }}></motion.div>
                </div>
                <span className={`text-[9px] font-bold ${dailySummary.carbs > dailySummary.carbsTarget ? 'text-red-500' : 'text-[#64748b]/70 dark:text-slate-500'}`}>
                  {dailySummary.carbs > dailySummary.carbsTarget ? `${(dailySummary.carbs - dailySummary.carbsTarget).toFixed(1)}g over` : `${(dailySummary.carbsTarget - dailySummary.carbs).toFixed(1)}g left`}
                </span>
              </div>

              {/* Fats */}
              <div className="flex-1 flex flex-col gap-1.5">
                <span className="text-[9px] font-black text-[#64748b]/70 dark:text-slate-500 uppercase tracking-widest">Fats</span>
                <div className="flex items-baseline gap-1">
                  <span className={`text-[13px] font-bold tracking-tight ${dailySummary.fats > dailySummary.fatsTarget ? 'text-red-500' : 'text-[#1a2138] dark:text-white'}`}>{dailySummary.fats}g</span>
                  <span className="text-[10px] font-bold text-[#64748b]/70 dark:text-slate-500">/ {dailySummary.fatsTarget}g</span>
                </div>
                <div className="w-full h-1.5 bg-white/50 dark:bg-black/20 border border-white/50 dark:border-white/5 rounded-full overflow-hidden">
                  <motion.div className={`h-full rounded-full ${dailySummary.fats > dailySummary.fatsTarget ? 'bg-red-500' : 'bg-[#69A38D]'}`} initial={{ width: 0 }} animate={{ width: `${Math.min(100, (dailySummary.fats / dailySummary.fatsTarget) * 100)}%` }}></motion.div>
                </div>
                <span className={`text-[9px] font-bold ${dailySummary.fats > dailySummary.fatsTarget ? 'text-red-500' : 'text-[#64748b]/70 dark:text-slate-500'}`}>
                  {dailySummary.fats > dailySummary.fatsTarget ? `${(dailySummary.fats - dailySummary.fatsTarget).toFixed(1)}g over` : `${(dailySummary.fatsTarget - dailySummary.fats).toFixed(1)}g left`}
                </span>
              </div>
            </div>
          </div>

          {/* Today's Insights with Dynamic Alerts */}
          <div className="bg-[#E88F4A]/10 rounded-[24px] p-5 shadow-sm border border-[#E88F4A]/20 flex items-start gap-4 dark:bg-[#E88F4A]/5 dark:border-[#E88F4A]/10 transition-all duration-300">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
              <AlertTriangle size={20} className={(totalTodayKcal > (dailySummary.calorieTarget || 1800) || dailySummary.protein > dailySummary.proteinTarget || dailySummary.carbs > dailySummary.carbsTarget || dailySummary.fats > dailySummary.fatsTarget) ? "text-red-500" : "text-[#E88F4A]"} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col justify-center py-0.5 w-full">
              <h4 className="text-[14px] font-bold text-[#1a2138] mb-1 flex items-center gap-2 dark:text-white uppercase tracking-tight">
                Nutrition Insight
                <span className="bg-[#E88F4A] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">AI Analysis</span>
              </h4>
              <div className="text-[13px] text-[#1a2138]/80 font-medium leading-relaxed dark:text-slate-400">
                {(() => {
                  const alerts = [];
                  const dailyCalorieTarget = dailySummary.calorieTarget || 1800;
                  
                  if (totalTodayKcal > dailyCalorieTarget) {
                    const over = totalTodayKcal - dailyCalorieTarget;
                    let suggest = "Consider a 30-minute swim or an hour of brisk walking to balance your total intake.";
                    if (over > 500) suggest = "Try 45 minutes of HIIT or a 60-minute jog to manage this significant overflow.";
                    else if (over < 150) suggest = "A short 15-minute jog or playing tennis for 20 minutes will help burn this off.";
                    
                    alerts.push({
                      type: 'Calories',
                      msg: `Exceeded by ${over} kcal. ${suggest}`
                    });
                  }
                  if (dailySummary.protein > dailySummary.proteinTarget) {
                    alerts.push({
                      type: 'Protein',
                      msg: `${dailySummary.protein}g / ${dailySummary.proteinTarget}g. You've exceeded your daily protein limit.`
                    });
                  }
                  if (dailySummary.carbs > dailySummary.carbsTarget) {
                    alerts.push({
                      type: 'Carbs',
                      msg: `${dailySummary.carbs}g / ${dailySummary.carbsTarget}g. Your carbohydrate intake is higher than the recommended limit.`
                    });
                  }
                  if (dailySummary.fats > dailySummary.fatsTarget) {
                    alerts.push({
                      type: 'Fats',
                      msg: `${dailySummary.fats}g / ${dailySummary.fatsTarget}g. You've gone over your fat quota for today.`
                    });
                  }

                  if (alerts.length > 0) {
                    return (
                      <div className="flex flex-col gap-2 mt-1">
                        {alerts.map((alert, i) => (
                          <div key={i} className="flex gap-2 items-start">
                            <span className="font-black text-red-600 dark:text-red-400 uppercase text-[10px] mt-0.5 tracking-tight shrink-0 flex items-center gap-1 border border-red-200 dark:border-red-900/50 px-1.5 py-0.5 rounded-md bg-red-50 dark:bg-red-900/10">
                              <AlertTriangle size={10} /> {alert.type}
                            </span>
                            <p className="text-red-600 dark:text-red-400 font-bold leading-snug">{alert.msg}</p>
                          </div>
                        ))}
                      </div>
                    );
                  }

                  return <p>{aiInsights || "Your nutrition is perfectly balanced today. Keep it up!"}</p>;
                })()}
              </div>
            </div>
          </div>

            {/* Meal Timeline Section */}
            <div className="flex flex-col gap-5 mt-4">
              {/* Meal Timeline Header: Date and Calendar */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex flex-col gap-0.5 mt-1">
                  <h2 className="text-[20px] font-black text-[#1a2138] dark:text-white leading-tight tracking-tight uppercase tracking-[-0.02em]">
                    Today, {new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </h2>
                </div>
                
                <button 
                  onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                  className="w-11 h-11 rounded-full bg-white dark:bg-[#222B26] flex items-center justify-center text-[#64748b] dark:text-slate-400 hover:bg-slate-50 transition-colors shadow-sm border border-slate-100 dark:border-white/10 shrink-0"
                >
                  <CalendarIcon size={18} />
                </button>
              </div>

              {[
                { name: 'Breakfast', target: Math.round((dailySummary.calorieTarget || 1800) * 0.20), icon: Coffee, time: '09:00' },
                { name: 'Mid-morning', target: Math.round((dailySummary.calorieTarget || 1800) * 0.10), icon: Apple, time: '11:30' },
                { name: 'Lunch', target: Math.round((dailySummary.calorieTarget || 1800) * 0.35), icon: Utensils, time: '13:30' },
                { name: 'Evening Snack', target: Math.round((dailySummary.calorieTarget || 1800) * 0.15), icon: Zap, time: '16:45' },
                { name: 'Dinner', target: Math.round((dailySummary.calorieTarget || 1800) * 0.20), icon: UtensilsCrossed, time: '20:15' }
              ].map((meal, idx) => {
                const mealTypeMatch = meal.name === 'Evening Snack' ? 'Snack' : (meal.name === 'Mid-morning' ? 'Mid-morning' : meal.name);
                const mealsForThisType = loggedMeals.filter(m => 
                  m.mealType?.toLowerCase() === mealTypeMatch.toLowerCase() || 
                  m.mealType?.toLowerCase() === meal.name.toLowerCase()
                );
                const consumedKcal = mealsForThisType.reduce((acc, curr) => 
                  acc + (curr.foodItems?.[0]?.nutrition?.calories || curr.calories || 0), 0
                );
                const isCompleted = consumedKcal > 0;
                const isExceeded = consumedKcal > meal.target;
                const excessKcal = consumedKcal - meal.target;
                
                // Exercise suggestion based on excess calories
                const getExerciseSuggestion = (excess) => {
                  if (excess <= 50) return "Take a 10-minute leisurely walk around the office or home.";
                  if (excess <= 150) return "Try a 15-minute brisk walk to burn off the extra energy.";
                  if (excess <= 300) return "Go for a 20-minute jog or try 10 minutes of jumping jacks.";
                  return "A 30-minute brisk walk or 15 minutes of HIIT is recommended to balance this meal.";
                };
                
                // Get dynamic time from first logged meal of this type
                const loggedTime = mealsForThisType.length > 0 && mealsForThisType[0].createdAt
                  ? new Date(mealsForThisType[0].createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
                  : meal.time;

                return (
                  <div key={idx} className={`mb-4 animate-in fade-in slide-in-from-bottom-2 relative ${logMethodSection === meal.name ? 'z-[60]' : 'z-10'}`}>
                    {/* Meal Card */}
                    <div className="w-full bg-white/70 dark:bg-[#1A221E]/90 backdrop-blur-xl rounded-[2.25rem] p-5 shadow-sm border border-white dark:border-white/10 transition-all hover:shadow-md relative">
                      <div className="flex items-center justify-between mb-4 gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-[#FEF4EB] dark:bg-[#2D241E] flex items-center justify-center text-[#E88F4A] transition-all group-hover:scale-110 shrink-0">
                            <meal.icon size={20} strokeWidth={2.5} />
                          </div>
                          <div>
                            <span className="text-[15px] font-black text-[#1a2138] dark:text-white tracking-tight whitespace-nowrap">{meal.name}</span>
                            {isCompleted && (
                                <p className="text-[10px] font-bold text-[#6FAF95]/60 block -mt-1">
                                  Logged at {loggedTime}
                                </p>
                              )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          <div className="flex flex-col items-end">
                            <div className="flex items-center gap-1.5">
                              {isExceeded && <AlertTriangle size={14} className="text-red-500 animate-pulse" />}
                              <span className={`text-[14px] font-black leading-none ${isExceeded ? 'text-red-500' : (consumedKcal > 0 ? 'text-[#69A38D]' : 'text-slate-400')} tracking-tight`}>
                                {consumedKcal}
                              </span>
                            </div>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-tight">
                              of {meal.target} kcal
                            </span>
                          </div>
                          
                          <div className="relative">
                            <button 
                              onClick={() => setLogMethodSection(logMethodSection === meal.name ? null : meal.name)}
                              className="w-10 h-10 rounded-full bg-slate-50 dark:bg-[#222B26] flex items-center justify-center text-slate-400 hover:text-[#69A38D] transition-colors border border-slate-100 dark:border-white/5 active:scale-95 shadow-sm"
                            >
                              <Plus size={16} strokeWidth={3} />
                            </button>
                            
                            {logMethodSection === meal.name && (
                              <div className="absolute right-0 top-12 w-[280px] p-0 rounded-[28px] border border-white/20 bg-gradient-to-b from-[#69A38D] to-[#2E5244] dark:from-[#2E5244] dark:to-[#111815] shadow-2xl overflow-hidden z-[100] outline-none animate-in zoom-in-95 duration-200">
                                <div className="relative overflow-hidden flex flex-col p-5">
                                    <motion.div 
                                      key="methods"
                                      initial={{ x: -20, opacity: 0 }}
                                      animate={{ x: 0, opacity: 1 }}
                                      exit={{ x: -20, opacity: 0 }}
                                      className="flex flex-col relative z-10 w-full"
                                    >
                                      <h3 className="text-[18px] font-bold text-white mb-1 tracking-tight">Add {meal.name}</h3>
                                      <p className="text-[12px] text-white/80 font-medium mb-5">Select a convenient method</p>
                                      
                                      <div className="flex flex-col gap-3">
                                        {LOG_METHODS.map((method, mIdx) => {
                                          const Icon = method.icon;
                                          return (
                                            <button
                                              key={method.id}
                                              onClick={() => {
                                                if (method.id === 'voice') {
                                                  setLogMethodSection(null);
                                                  onLogFood('Voice Log', meal.name);
                                                }
                                                else if (method.id === 'photo') {
                                                  setActiveMealForImport(meal.name);
                                                  activeMealRef.current = meal.name;
                                                  // Reset input so same file can be re-selected
                                                  if (cameraInputRef.current) cameraInputRef.current.value = '';
                                                  // Close popup BEFORE opening camera to avoid re-render conflicts
                                                  setLogMethodSection(null);
                                                  // Small delay to let popup close before opening camera
                                                  setTimeout(() => cameraInputRef.current?.click(), 100);
                                                  return; // Don't call setLogMethodSection again
                                                }
                                                else if (method.id === 'text') {
                                                  setLogMethodSection(null);
                                                  onLogFood('Type', meal.name);
                                                }
                                                else if (method.id === 'import') {
                                                  setActiveMealForImport(meal.name);
                                                  activeMealRef.current = meal.name;
                                                  if (fileInputRef.current) fileInputRef.current.value = '';
                                                  setLogMethodSection(null);
                                                  setTimeout(() => fileInputRef.current?.click(), 100);
                                                  return; // Don't call setLogMethodSection again
                                                }
                                              }}
                                              className="w-full py-3.5 px-4 bg-white/10 hover:bg-white/20 rounded-[16px] flex items-center justify-between group transition-all active:scale-95 border border-white/10"
                                            >
                                              <span className="text-white font-bold text-[14px]">{method.label}</span>
                                              <div className="w-8 h-8 rounded-[10px] bg-white/10 flex items-center justify-center text-white transition-all group-hover:scale-110">
                                                <Icon size={16} strokeWidth={2.5} />
                                              </div>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </motion.div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Calorie Exceed Alert */}
                      {isExceeded && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mx-0 mb-4 p-3.5 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-900/30 flex gap-3 items-start"
                        >
                          <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                            <AlertTriangle size={16} className="text-red-600 dark:text-red-400" />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <p className="text-[12px] font-black text-red-700 dark:text-red-400 uppercase tracking-tight">Calorie Limit Exceeded</p>
                            <p className="text-[11px] font-bold text-red-600/80 dark:text-red-400/80 leading-snug">
                              You've exceeded the {meal.name} target by {excessKcal} kcal. {getExerciseSuggestion(excessKcal)}
                            </p>
                          </div>
                        </motion.div>
                      )}

                      {/* Logged Detail List */}
                      {mealsForThisType.length > 0 && (
                        <div className="flex flex-col gap-4 pl-2 mt-2">
                          {mealsForThisType.map((m, mIdx) => (
                            <div key={mIdx} className="flex items-center justify-between group">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0">
                                  <ImageWithFallback 
                                    src={m.foodItems?.[0]?.image || m.image} 
                                    query={m.foodItems?.[0]?.name || m.name}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform" 
                                  />
                                </div>
                                <span className="text-[14px] font-bold text-[#5D6B82] dark:text-slate-300 tracking-tight line-clamp-1">{m.foodItems?.[0]?.name || m.name}</span>
                              </div>
                              <span className="text-[12px] font-black text-[#5D6B82]/70 dark:text-slate-500">{m.foodItems?.[0]?.nutrition?.calories || m.calories} kcal</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Smart Meal Suggestions */}
          <div className="bg-white/60 backdrop-blur-xl rounded-[32px] p-6 shadow-sm border border-white dark:bg-[#1A221E]/90 dark:border-white/10">
            <h3 className="text-[16px] font-black text-[#1a2138] mb-4 tracking-tight dark:text-white">Smart Meal Suggestions</h3>
            
            {/* Tabs */}
            <div className="flex gap-4 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {['Recommended', 'High Protein', 'Balanced', 'Low Carb'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveSuggestion(tab)}
                  className={`text-[12px] font-bold whitespace-nowrap transition-colors relative pb-1.5 ${activeSuggestion === tab ? 'text-[#1a2138] dark:text-white' : 'text-[#64748b]/70 hover:text-[#64748b] dark:hover:text-slate-300'}`}
                >
                  {tab}
                  {activeSuggestion === tab && (
                    <motion.div layoutId="suggestion-underline" className="absolute bottom-0 left-0 w-full h-[2px] bg-[#69A38D] rounded-full"></motion.div>
                  )}
                </button>
              ))}
            </div>

            {/* Suggestion Card */}
            <div className="rounded-[24px] overflow-hidden border border-white/80 bg-white/50 shadow-sm dark:bg-[#111815] dark:border-white/10 transition-all duration-500 animate-in fade-in slide-in-from-right-4">
              <div className="relative h-[160px] w-full group overflow-hidden">
                <ImageWithFallback 
                  src={currentSuggestion.image} 
                  alt={currentSuggestion.title} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm">
                  <span className="text-[9px] font-black text-[#1a2138] tracking-wide">Based on your goals today</span>
                </div>
              </div>
              <div className="p-5">
                <h4 className="text-[16px] font-semibold text-[#1a2138] mb-2 tracking-tight dark:text-white line-clamp-1">{currentSuggestion.title}</h4>
                <div className="flex items-center gap-3 mb-4 text-[11px] font-bold text-[#64748b] dark:text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#5D5589]"></span> {currentSuggestion.protein} Protein</span>
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#E88F4A]"></span> {currentSuggestion.calories}</span>
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#69A38D]"></span> {currentSuggestion.time}</span>
                </div>
                <button onClick={() => setShowRecipe(true)} className="w-full py-3 rounded-xl border border-[#6FAF95]/50 bg-[#6FAF95] font-bold text-[13px] text-white hover:bg-[#5B9A80] transition-all shadow-md active:scale-[0.98]">
                  View Recipe
                </button>
              </div>
            </div>
          </div>

          {/* Quick Access */}
          <div className="grid grid-cols-2 gap-3">
            {/* Recent Meals */}
            <div className="bg-white/95 backdrop-blur-xl rounded-[28px] p-4 shadow-sm border border-white dark:bg-[#1A221E]/90 dark:border-white/10">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-[13px] font-black text-[#1a2138] dark:text-white tracking-tight">Recent</h3>
                <button className="text-[9px] font-bold text-[#6FAF95] uppercase tracking-widest">View</button>
              </div>
              <div className="flex flex-col gap-2">
                {recentMeals.slice(0, 2).map((m, i) => (
                  <div key={i} className="bg-slate-50 dark:bg-black/20 rounded-xl p-2 border border-slate-100 dark:border-white/5">
                    <p className="text-[11px] font-bold text-[#1a2138] dark:text-white truncate">{m.foodItems?.[0]?.name}</p>
                    <p className="text-[9px] text-[#64748b]">{m.foodItems?.[0]?.nutrition?.calories} kcal</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Frequent */}
            <div className="bg-white/95 backdrop-blur-xl rounded-[28px] p-4 shadow-sm border border-white dark:bg-[#1A221E]/90 dark:border-white/10">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-[13px] font-black text-[#1a2138] dark:text-white tracking-tight">Frequent</h3>
                <button className="text-[9px] font-bold text-[#6FAF95] uppercase tracking-widest">More</button>
              </div>
              <div className="flex flex-wrap gap-1.5 overflow-hidden max-h-[80px]">
                {dynamicFrequentFoods.map(f => (
                  <span key={f} className="text-[10px] font-bold bg-[#6FAF95]/10 text-[#6FAF95] px-2.5 py-1 rounded-lg border border-[#6FAF95]/20 animate-in fade-in zoom-in-75 duration-300">{f}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Water Intake */}
          <div className="bg-gradient-to-br from-[#E8F1F9]/90 to-white/60 dark:from-[#1A221E] dark:to-[#111815] backdrop-blur-xl rounded-[32px] p-5 shadow-sm border border-white mt-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#558FE6]/10 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div>
                <h3 className="text-[16px] font-bold text-[#1a2138] dark:text-white tracking-tight">Hydration Tracker</h3>
                <p className="text-[11px] font-black text-[#64748b] dark:text-slate-400 mt-0.5 uppercase tracking-wider">Daily Goal: {waterIntake.target} Glasses ({waterIntake.target * 250} ml)</p>
              </div>
              <div className="w-11 h-11 rounded-[16px] bg-white dark:bg-[#1A221E] flex items-center justify-center shadow-sm text-[#558FE6] relative border border-white dark:border-white/10">
                <div className="relative flex items-center justify-center">
                  <Droplet size={26} strokeWidth={2} className="fill-[#558FE6]/20" />
                  <div className="absolute top-[11px] flex flex-col items-center">
                    <div className="flex gap-[4px]">
                      <div className="w-[3px] h-[4px] bg-[#558FE6] rounded-full"></div>
                      <div className="w-[3px] h-[4px] bg-[#558FE6] rounded-full"></div>
                    </div>
                    <div className="w-[8px] h-[4px] border-b-[2px] border-[#558FE6] rounded-full mt-[1px]"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-3 relative z-10 bg-white/50 p-2 sm:p-3 rounded-[24px] border border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] dark:bg-[#1A221E]/60 dark:border-white/10 overflow-hidden">
              <button 
                onClick={() => onWaterUpdate(-1)}
                className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#64748b] hover:text-[#6FAF95] active:scale-90 transition-all shadow-sm shrink-0 dark:bg-[#0F1412] dark:border dark:border-white/10 dark:text-white/80 z-20"
              >
                <Minus size={16} strokeWidth={3} />
              </button>
              
              <div className="flex flex-1 justify-center gap-1 sm:gap-1.5 px-2">
                {[...Array(waterIntake.target)].map((_, i) => {
                  const isFilled = i < waterIntake.current;
                  return (
                    <button
                      key={i}
                      onClick={() => onWaterUpdate((i + 1) - waterIntake.current)}
                      className="group relative pt-1 pb-1 transition-transform hover:-translate-y-1 active:scale-95 duration-300 w-[16px] sm:w-[20px] shrink-0"
                    >
                      <div className={`relative w-full h-[30px] rounded-b-[10px] rounded-t-[2px] border-[2px] transition-all duration-500 overflow-hidden ${
                        isFilled 
                          ? 'border-[#558FE6] bg-[#558FE6]/20 shadow-[0_4px_8px_rgba(85,143,230,0.2)] dark:bg-[#1A221E] dark:border-[#558FE6]' 
                          : 'border-white/80 bg-white/60 shadow-sm dark:border-white/20 dark:bg-[#1A221E]'
                      }`}>
                        {/* The Water */}
                        <div 
                          className={`absolute bottom-0 left-0 right-0 bg-[#558FE6] transition-all duration-300 ease-in-out ${
                            isFilled ? 'h-[100%] opacity-100' : 'h-0 opacity-0'
                          }`}
                        >
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => onWaterUpdate(1)}
                className="w-8 h-8 rounded-full bg-[#6FAF95] flex items-center justify-center text-white active:scale-90 transition-all shadow-sm shadow-[#6FAF95]/30 shrink-0 z-20"
              >
                <Plus size={16} strokeWidth={3} />
              </button>
            </div>

            <div className="flex justify-between items-center px-2 relative z-10">
              <span className="text-[12px] font-black text-[#558FE6] tracking-tight">{waterIntake.current * 250} ml consumed</span>
              <span className="text-[11px] font-black text-[#64748b] dark:text-slate-400 uppercase tracking-tight">{Math.max(0, (waterIntake.target - waterIntake.current) * 250)} ml left</span>
            </div>
          </div>

          {/* Weekly Trends */}
          <div className="bg-white/60 backdrop-blur-xl rounded-[32px] p-6 shadow-sm border border-white dark:bg-[#1A221E]/90 dark:border-white/10">
            <h3 className="text-[16px] font-semibold text-[#1a2138] dark:text-white mb-6">Weekly Trends</h3>
            <div className="h-[120px] flex items-end justify-between gap-1.5 mb-4 px-1">
              {weeklyData.map((data, i) => {
                const heightPercent = Math.max(15, ((data.value || 0) / maxWeeklyKcal) * 100);
                return (
                  <div key={i} className="flex flex-col items-center gap-2 flex-1 h-full justify-end group relative">
                    <div className="w-full bg-[#1a2138]/5 dark:bg-white/10 rounded-t-lg transition-all duration-500 hover:bg-[#6FAF95]/40" style={{ height: `${heightPercent}%` }}>
                      {i === (weeklyData.length - 1) && <div className="w-full h-full bg-[#6FAF95] rounded-t-lg"></div>}
                    </div>
                    <span className="text-[9px] font-bold text-[#64748b]">{data.day ? data.day[0] : ''}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Recipe Modal (High Fidelity) */}
      <AnimatePresence>
        {showRecipe && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowRecipe(false)}></motion.div>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="relative bg-white dark:bg-[#0F1412] w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="relative h-[240px] shrink-0">
                <div className="absolute top-0 left-0 right-0 p-4 flex justify-end z-20">
                  <button 
                    onClick={() => setShowRecipe(false)}
                    className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/60 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10"></div>
                <ImageWithFallback 
                  src={currentSuggestion.image} 
                  alt={currentSuggestion.title} 
                  className="w-full h-full object-cover"
                />
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 pt-6">
                <h2 className="text-[24px] font-black text-[#1a2138] dark:text-white leading-tight mb-3">{currentSuggestion.title}</h2>
                <div className="flex gap-2 mb-8">
                  <span className="bg-[#64748b]/10 text-[#64748b] dark:text-slate-400 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider">HIGH PROTEIN ({currentSuggestion.protein})</span>
                  <span className="bg-[#E88F4A]/10 text-[#E88F4A] text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider">{currentSuggestion.calories}</span>
                </div>

                <div className="space-y-8">
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-xl bg-[#6FAF95]/10 flex items-center justify-center text-[#6FAF95]">
                        <Utensils size={18} />
                      </div>
                      <h3 className="text-[18px] font-bold text-[#1a2138] dark:text-white">Ingredients</h3>
                    </div>
                    <ul className="space-y-3">
                      {currentSuggestion.ingredients.map((ing, i) => (
                        <li key={i} className="flex gap-3 text-[14px] text-[#5D6B82] dark:text-slate-400 items-start">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#6FAF95] mt-1.5 shrink-0 opacity-60"></span>
                          {ing}
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-xl bg-[#5D5589]/10 flex items-center justify-center text-[#5D5589]">
                        <CheckCircle2 size={18} />
                      </div>
                      <h3 className="text-[18px] font-bold text-[#1a2138] dark:text-white">Step-by-Step Instructions</h3>
                    </div>
                    <div className="space-y-6">
                      {currentSuggestion.instructions.map((step, i) => (
                        <div key={i} className="flex gap-4">
                          <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0">
                            <span className="text-[12px] font-black text-slate-500">{i + 1}</span>
                          </div>
                          <p className="text-[14px] text-[#5D6B82] dark:text-slate-400 leading-relaxed font-medium">
                            {step}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>

              <div className="p-6 pt-2 shrink-0">
                <button 
                  onClick={() => setShowRecipe(false)} 
                  className="w-full h-14 bg-[#69A38D] hover:bg-[#5B9A80] text-white rounded-2xl font-black text-[15px] shadow-lg shadow-[#69A38D]/20 transition-all active:scale-[0.98]"
                >
                  Got it!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Hidden inputs for Image/Camera */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            // Use ref for meal name since state may be stale after camera backgrounding
            const mealName = activeMealRef.current || activeMealForImport;
            onLogFood('Scan', mealName, file);
          }
          // Reset so same file can be selected again
          if (e.target) e.target.value = '';
        }}
      />
      <input
        type="file"
        ref={cameraInputRef}
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            // Use ref for meal name since state may be stale after camera backgrounding
            const mealName = activeMealRef.current || activeMealForImport;
            onLogFood('Scan', mealName, file);
          }
          // Reset so same file can be selected again
          if (e.target) e.target.value = '';
        }}
      />
      {/* Hidden input for header camera - directly opens native camera */}
      <input
        type="file"
        ref={headerCameraRef}
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onLogFood('Scan', null, file);
          }
          if (e.target) e.target.value = '';
        }}
      />
    </div>
  );
}
