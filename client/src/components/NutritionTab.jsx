import React, { useState, useRef, useMemo } from 'react';
import { 
  ChevronLeft, ChevronRight, Plus, Camera, Mic, Utensils, Droplet, Minus, CheckCircle2, 
  AlertTriangle, AlertCircle, X, Coffee, Apple, Calendar, Image as ImageIcon, 
  Type, History, ArrowLeft, Flame, UtensilsCrossed, Zap, Search, Trash2, MoreHorizontal 
} from 'lucide-react';
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
  triggerRefresh,
  selectedDate,
  onDateChange,
  weeklyTrendsData = [],
  recentMeals = [],
  frequentFoods = [],
  aiInsights = "",
  onDeleteFood,
  onMoveFood,
  onViewFood
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
  const dateInputRef = useRef(null);
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
    <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8 max-w-5xl mx-auto w-full pt-1">
      {/* Primary Header - Compact & Refined */}
      <div className="flex flex-row items-center justify-between gap-2 mb-2">
        <div className="flex flex-col gap-0 min-w-0">
          <h1 className="text-[20px] md:text-[24px] font-black text-[#1a2138] tracking-tight dark:text-white leading-tight whitespace-nowrap">
            Nutrition Tracker
          </h1>
          <p className="text-[11px] md:text-[13px] font-bold text-slate-400 dark:text-slate-500">
            Achieve wellness goals..
          </p>
        </div>
        
        <div className="flex items-center gap-1.5 justify-end shrink-0">
          <button 
            onClick={() => onLogFood('Scan')} 
            className="bg-[#6FAF95] hover:bg-[#5B9A80] text-white px-3 py-1.5 h-9 md:h-10 rounded-full text-[12px] md:text-[13px] font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all justify-center whitespace-nowrap"
          >
            <Plus size={15} strokeWidth={3} /> Log Meal
          </button>
          <button 
            onClick={() => onLogFood('photo')}
            className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white dark:bg-[#1A221E] flex items-center justify-center text-slate-500 border border-slate-100 dark:border-white/10 hover:shadow-xs transition-all active:scale-90"
          >
            <Camera size={17} strokeWidth={2} className="text-slate-400" />
          </button>
          <button 
            onClick={() => onLogFood('voice')}
            className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white dark:bg-[#1A221E] flex items-center justify-center text-slate-500 border border-slate-100 dark:border-white/10 hover:shadow-xs transition-all active:scale-90"
          >
            <Mic size={17} strokeWidth={2} className="text-slate-400" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
        {/* Left Column */}
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
            <div className="w-full h-3.5 bg-white/50 dark:bg-black/20 rounded-full overflow-hidden mb-8 shadow-inner border border-white/50 dark:border-white/5">
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, progressPercent)}%` }} transition={{ duration: 1, ease: "easeOut" }} className={`h-full rounded-full relative overflow-hidden ${totalTodayKcal > (dailySummary.calorieTarget || 1800) ? 'bg-red-500' : 'bg-[#69A38D]'}`}><div className="absolute inset-0 bg-white/10 w-full h-full"></div></motion.div>
            </div>
            <div className="flex gap-3 w-full">
              <div className="flex-1 flex flex-col gap-1.5">
                <span className="text-[9px] font-black text-[#64748b]/70 dark:text-slate-500 uppercase tracking-widest">Protein</span>
                <div className="flex items-baseline gap-1"><span className={`text-[13px] font-bold ${dailySummary.protein > dailySummary.proteinTarget ? 'text-red-500' : 'text-[#1a2138] dark:text-white'}`}>{dailySummary.protein}g</span><span className="text-[10px] font-bold text-[#64748b]/70">/ {dailySummary.proteinTarget}g</span></div>
                <div className="w-full h-1.5 bg-white/50 dark:bg-black/20 rounded-full overflow-hidden self-stretch"><motion.div className={`h-full rounded-full ${dailySummary.protein > dailySummary.proteinTarget ? 'bg-red-500' : 'bg-[#5D5589]'}`} initial={{ width: 0 }} animate={{ width: `${Math.min(100, (dailySummary.protein / dailySummary.proteinTarget) * 100)}%` }}></motion.div></div>
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <span className="text-[9px] font-black text-[#64748b]/70 uppercase tracking-widest">Carbs</span>
                <div className="flex items-baseline gap-1"><span className={`text-[13px] font-bold ${dailySummary.carbs > dailySummary.carbsTarget ? 'text-red-500' : 'text-[#1a2138] dark:text-white'}`}>{dailySummary.carbs}g</span><span className="text-[10px] font-bold text-[#64748b]/70">/ {dailySummary.carbsTarget}g</span></div>
                <div className="w-full h-1.5 bg-white/50 dark:bg-black/20 rounded-full overflow-hidden self-stretch"><motion.div className={`h-full rounded-full ${dailySummary.carbs > dailySummary.carbsTarget ? 'bg-red-500' : 'bg-[#558FE6]'}`} initial={{ width: 0 }} animate={{ width: `${Math.min(100, (dailySummary.carbs / dailySummary.carbsTarget) * 100)}%` }}></motion.div></div>
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <span className="text-[9px] font-black text-[#64748b]/70 uppercase tracking-widest">Fats</span>
                <div className="flex items-baseline gap-1"><span className={`text-[13px] font-bold ${dailySummary.fats > dailySummary.fatsTarget ? 'text-red-500' : 'text-[#1a2138] dark:text-white'}`}>{dailySummary.fats}g</span><span className="text-[10px] font-bold text-[#64748b]/70">/ {dailySummary.fatsTarget}g</span></div>
                <div className="w-full h-1.5 bg-white/50 dark:bg-black/20 rounded-full overflow-hidden self-stretch"><motion.div className={`h-full rounded-full ${dailySummary.fats > dailySummary.fatsTarget ? 'bg-red-500' : 'bg-[#69A38D]'}`} initial={{ width: 0 }} animate={{ width: `${Math.min(100, (dailySummary.fats / dailySummary.fatsTarget) * 100)}%` }}></motion.div></div>
              </div>
            </div>
          </div>

          {/* Today's Insights */}
          <div className="bg-[#FCEEE3] rounded-[32px] p-6 shadow-sm border border-[#F5D6C1] flex flex-col gap-5 dark:bg-[#1A221E]/10 dark:border-[#E88F4A]/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md"><AlertTriangle size={20} className="text-[#E88F4A]" strokeWidth={2.5} /></div>
                <h4 className="text-[16px] font-black text-[#1a2138] dark:text-white uppercase tracking-tight">Nutrition Insight</h4>
              </div>
              <span className="bg-[#E88F4A] text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest whitespace-nowrap">AI ANALYSIS</span>
            </div>
            <div className="flex flex-col gap-3">
              {(() => {
                const alerts = [];
                const target = dailySummary.calorieTarget || 1800;
                if (totalTodayKcal > target) alerts.push({ type: 'CALORIES', msg: `Exceeded by ${totalTodayKcal - target} kcal. ${totalTodayKcal - target > 500 ? 'Try 45 mins of HIIT.' : 'A 20-min jog will help.'}` });
                if (dailySummary.protein > dailySummary.proteinTarget) alerts.push({ type: 'PROTEIN', msg: `Exceeded target by ${(dailySummary.protein - dailySummary.proteinTarget).toFixed(1)}g.` });
                if (alerts.length > 0) {
                  return alerts.map((a, i) => (
                    <div key={i} className="flex gap-4 items-start">
                      <div className="flex items-center gap-1.5 font-black text-[#EF4444] uppercase text-[9px] px-2.5 py-1.5 rounded-full bg-[#FFE7E7] border border-[#FFCFCF]">{a.type}</div>
                      <p className="text-[#991B1B] font-bold text-[14px] leading-tight flex-1 pt-1.5">{a.msg}</p>
                    </div>
                  ));
                }
                return <p className="text-[#1a2138]/80 text-[13px] font-medium leading-relaxed dark:text-slate-400">{aiInsights || "Your nutrition is perfectly balanced today. Keep it up!"}</p>;
              })()}
            </div>
          </div>

          {/* Meal Timeline Section */}
          <div className="flex flex-col gap-5 mt-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="text-[20px] font-black text-[#1a2138] dark:text-white leading-tight uppercase tracking-tight">
                {(() => {
                  const today = new Date().toISOString().split('T')[0];
                  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                  if (selectedDate === today) return "Today";
                  if (selectedDate === yesterday) return "Yesterday";
                  return new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long' });
                })()}, {new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </h2>
              <div className="relative">
                <button onClick={() => { if (dateInputRef.current?.showPicker) dateInputRef.current.showPicker(); else dateInputRef.current?.click(); }} className="w-11 h-11 rounded-full bg-white dark:bg-[#222B26] flex items-center justify-center text-[#64748b] shadow-sm border border-slate-100 dark:border-white/10"><Calendar size={18} /></button>
                <input type="date" ref={dateInputRef} className="absolute inset-0 opacity-0 pointer-events-none" value={selectedDate} onChange={(e) => onDateChange && onDateChange(e.target.value)} max={new Date().toISOString().split('T')[0]} />
              </div>
            </div>

            {[
              { name: 'Breakfast', target: Math.round((dailySummary.calorieTarget || 1800) * 0.30), icon: Coffee, time: '09:00' },
              { name: 'Lunch', target: Math.round((dailySummary.calorieTarget || 1800) * 0.40), icon: Utensils, time: '13:30' },
              { name: 'Dinner', target: Math.round((dailySummary.calorieTarget || 1800) * 0.30), icon: UtensilsCrossed, time: '20:15' }
            ].map((meal, idx) => {
              const typeKey = 
                meal.name === 'Breakfast' ? 'breakfast' :
                meal.name === 'Lunch' ? 'lunch' :
                meal.name === 'Dinner' ? 'dinner' : 'other';

              const meals = (loggedMeals || []).filter(m => {
                if (!m.mealType) return false;
                const mt = String(m.mealType).toLowerCase();
                const target = typeKey.toLowerCase();
                
                // Direct match
                if (mt === target) return true;
                
                // Flexible match for snacks and common names
                if (target === 'breakfast' && (mt.includes('breakfast') || mt === 'morning')) return true;
                if (target === 'lunch' && mt.includes('lunch')) return true;
                if (target === 'dinner' && mt.includes('dinner')) return true;
                if (target === 'midmorningsnack' && (mt.includes('mid') || mt.includes('morning'))) return true;
                if (target === 'eveningsnack' && (mt.includes('evening') || mt === 'snack' || mt === 'afternoon')) return true;
                
                return false;
              });

              const consumed = meals.reduce((acc, curr) => {
                const cal = curr.calories || curr.foodItems?.[0]?.nutrition?.calories || 0;
                return acc + Number(cal);
              }, 0);
              
              const isExceeded = consumed > meal.target;

              return (
                <div key={idx} className={`mb-4 relative ${logMethodSection === meal.name ? 'z-[60]' : 'z-10'}`}>
                  <div className="w-full bg-white/70 dark:bg-[#1A221E]/90 backdrop-blur-xl rounded-[2.25rem] p-5 shadow-sm border border-white dark:border-white/10 transition-all hover:shadow-md">
                    <div className="flex items-center justify-between mb-4 gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-[#FEF4EB] dark:bg-[#2D241E] flex items-center justify-center text-[#E88F4A] group-hover:scale-110 shrink-0"><meal.icon size={20} strokeWidth={2.5} /></div>
                        <div>
                          <span className="text-[15px] font-black text-[#1a2138] dark:text-white tracking-tight">{meal.name}</span>
                          {consumed > 0 && <p className="text-[10px] font-bold text-[#6FAF95]/60 -mt-1 uppercase tracking-tight">Logged • {meals.length} items</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-2">
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1.5">
                            {isExceeded && <AlertTriangle size={14} className="text-red-500 animate-pulse" />}
                            <span className={`text-[14px] font-black ${isExceeded ? 'text-red-500' : (consumed > 0 ? 'text-[#69A38D]' : 'text-slate-400')}`}>{consumed}</span>
                          </div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">of {meal.target} kcal</span>
                        </div>
                        <div className="relative">
                          <button onClick={() => setLogMethodSection(logMethodSection === meal.name ? null : meal.name)} className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#69A38D] border border-slate-100 shadow-sm"><Plus size={16} strokeWidth={3} /></button>
                        </div>
                      </div>
                    </div>

                    {isExceeded && (
                      <div className="mb-4 p-3.5 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-900/30 flex gap-3 items-start">
                        <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0"><AlertCircle size={16} className="text-red-600" /></div>
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[12px] font-black text-red-700 uppercase tracking-tight">Limit Exceeded</p>
                          <p className="text-[11px] font-bold text-red-600/80 leading-snug">Target exceeded by {consumed - meal.target} kcal. A 30-min walk is recommended.</p>
                        </div>
                      </div>
                    )}

                    {meals.length > 0 && (
                      <div className="flex flex-col gap-3 mt-2 border-t border-slate-50 dark:border-white/5 pt-4">
                        {meals.map((log, lIdx) => (
                          <div key={lIdx} onClick={() => onViewFood && onViewFood(log)} className="group bg-slate-50/50 dark:bg-black/20 rounded-[1.75rem] p-4 flex items-center gap-4 hover:bg-white transition-all cursor-pointer border border-transparent hover:border-slate-100">
                            <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 border border-white">
                              <ImageWithFallback 
                                src={log.imageUrl || log.foodItems?.[0]?.imageUrl} 
                                query={log.name || log.foodItems?.[0]?.name}
                                alt={log.name} 
                                className="w-full h-full object-cover" 
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-[14px] font-black text-[#1a2138] dark:text-white uppercase truncate">{log.name || log.foodItems?.[0]?.name}</h4>
                              <div className="flex items-center gap-2 mt-0.5"><span className="text-[11px] font-bold text-[#6FAF95] uppercase">{log.calories || log.foodItems?.[0]?.nutrition?.calories} kcal</span><span className="w-1 h-1 rounded-full bg-slate-200" /><span className="text-[10px] font-black text-slate-400">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                            </div>
                            <div className="flex items-center gap-1.5 ml-auto">
                              <div className="relative group/move">
                                <button className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-[#6FAF95] hover:bg-[#6FAF95]/5 rounded-full transition-all border border-slate-100 bg-white shadow-sm">
                                  <MoreHorizontal size={14} strokeWidth={2.5} />
                                </button>
                                <select 
                                  onClick={(e) => e.stopPropagation()} 
                                  onChange={(e) => onMoveFood && onMoveFood(log._id, e.target.value)} 
                                  value={log.mealType} 
                                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                >
                                  {[
                                    { label: 'Breakfast', value: 'breakfast' },
                                    { label: 'Lunch', value: 'lunch' },
                                    { label: 'Dinner', value: 'dinner' }
                                  ].map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); onDeleteFood && onDeleteFood(log._id); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all border border-slate-100 bg-white"><Trash2 size={13} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {logMethodSection === meal.name && (
                      <div className="absolute right-0 top-12 w-[280px] p-5 rounded-[28px] border border-white/20 bg-gradient-to-b from-[#69A38D] to-[#2E5244] dark:from-[#2E5244] shadow-2xl z-[100] animate-in zoom-in-95 duration-200">
                        <h3 className="text-[18px] font-bold text-white mb-1 tracking-tight">Add {meal.name}</h3>
                        <p className="text-[12px] text-white/80 font-medium mb-5">Select a method</p>
                        <div className="flex flex-col gap-3">
                          {LOG_METHODS.map((method) => (
                            <button key={method.id} onClick={() => { if (method.id === 'photo') { setActiveMealForImport(meal.name); activeMealRef.current = meal.name; setLogMethodSection(null); setTimeout(() => cameraInputRef.current?.click(), 100); } else { setLogMethodSection(null); onLogFood(method.label, meal.name); } }} className="w-full py-3.5 px-4 bg-white/10 hover:bg-white/20 rounded-[16px] flex items-center justify-between group transition-all active:scale-95 border border-white/10">
                              <span className="text-white font-bold text-[14px]">{method.label}</span>
                              <div className="w-8 h-8 rounded-[10px] bg-white/10 flex items-center justify-center text-white"><method.icon size={16} /></div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6">
          {/* Smart Meal Suggestions */}
          <div className="bg-white/60 backdrop-blur-xl rounded-[32px] p-6 shadow-sm border border-white dark:bg-[#1A221E]/90 dark:border-white/10">
            <h3 className="text-[16px] font-black text-[#1a2138] mb-4 tracking-tight dark:text-white">Smart Meal Suggestions</h3>
            <div className="flex gap-4 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {['Recommended', 'High Protein', 'Balanced', 'Low Carb'].map(tab => (
                <button key={tab} onClick={() => setActiveSuggestion(tab)} className={`text-[12px] font-bold whitespace-nowrap relative pb-1.5 ${activeSuggestion === tab ? 'text-[#1a2138] dark:text-white' : 'text-[#64748b]/70'}`}>
                  {tab}
                  {activeSuggestion === tab && <motion.div layoutId="suggestion-underline" className="absolute bottom-0 left-0 w-full h-[2px] bg-[#69A38D] rounded-full" />}
                </button>
              ))}
            </div>
            <div className="rounded-[24px] overflow-hidden border border-white/80 bg-white/50 shadow-sm dark:bg-[#111815] transition-all">
              <div className="relative h-[160px] w-full group overflow-hidden"><ImageWithFallback src={currentSuggestion.image} alt={currentSuggestion.title} className="w-full h-full object-cover transition-transform group-hover:scale-110" /></div>
              <div className="p-5">
                <h4 className="text-[16px] font-semibold text-[#1a2138] mb-2 dark:text-white truncate">{currentSuggestion.title}</h4>
                <div className="flex items-center gap-3 mb-4 text-[11px] font-bold text-[#64748b] dark:text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#5D5589]"></span> {currentSuggestion.protein} Protein</span>
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#E88F4A]"></span> {currentSuggestion.calories}</span>
                </div>
                <button onClick={() => setShowRecipe(true)} className="w-full py-3 rounded-xl border border-[#6FAF95]/50 bg-[#6FAF95] font-bold text-[13px] text-white hover:bg-[#5B9A80] shadow-md transition-all">View Recipe</button>
              </div>
            </div>
          </div>

          {/* Quick Access */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/95 rounded-[28px] p-4 border border-white dark:bg-[#1A221E]/90 dark:border-white/10">
              <h3 className="text-[13px] font-black text-[#1a2138] dark:text-white mb-3">Recent</h3>
              <div className="flex flex-col gap-2">{recentMeals.slice(0, 2).map((m, i) => <div key={i} className="bg-slate-50 dark:bg-black/20 rounded-xl p-2 border border-slate-100 dark:border-white/5"><p className="text-[11px] font-bold dark:text-white truncate">{m.foodItems?.[0]?.name}</p><p className="text-[9px] text-[#64748b]">{m.foodItems?.[0]?.nutrition?.calories} kcal</p></div>)}</div>
            </div>
            <div className="bg-white/95 rounded-[28px] p-4 border border-white dark:bg-[#1A221E]/90 dark:border-white/10">
              <h3 className="text-[13px] font-black text-[#1a2138] dark:text-white mb-3">Frequent</h3>
              <div className="flex flex-wrap gap-1.5 overflow-hidden">{dynamicFrequentFoods.map(f => <span key={f} className="text-[10px] font-bold bg-[#6FAF95]/10 text-[#6FAF95] px-2.5 py-1 rounded-lg border border-[#6FAF95]/20">{f}</span>)}</div>
            </div>
          </div>

          {/* Water Intake */}
          <div className="bg-gradient-to-br from-[#E8F1F9]/90 to-white/60 dark:from-[#1A221E] rounded-[32px] p-5 shadow-sm border border-white mt-4 relative">
            <h3 className="text-[16px] font-bold text-[#1a2138] dark:text-white">Hydration Tracker</h3>
            <p className="text-[11px] font-black text-[#64748b] mt-0.5 uppercase tracking-wider">Goal: {waterIntake.target} glasses</p>
            <div className="flex items-center justify-between mt-4 bg-white/50 p-2 rounded-[24px] border border-white dark:bg-[#1A221E]/60 dark:border-white/10">
              <button onClick={() => onWaterUpdate(-1)} className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#64748b] shadow-sm"><Minus size={16} /></button>
              <div className="flex gap-1">{[...Array(waterIntake.target)].map((_, i) => <div key={i} className={`w-4 h-[30px] rounded-b-lg border-2 transition-all ${i < waterIntake.current ? 'border-[#558FE6] bg-[#558FE6]' : 'border-white bg-white/40'}`}></div>)}</div>
              <button onClick={() => onWaterUpdate(1)} className="w-8 h-8 rounded-full bg-[#6FAF95] flex items-center justify-center text-white"><Plus size={16} /></button>
            </div>
            <div className="flex justify-between items-center mt-2 px-2"><span className="text-[12px] font-black text-[#558FE6]">{waterIntake.current * 250} ml</span><span className="text-[11px] font-black text-[#64748b]">{Math.max(0, (waterIntake.target - waterIntake.current) * 250)} ml left</span></div>
          </div>

          <div className="bg-white/60 rounded-[32px] p-6 border border-white dark:bg-[#1A221E]/90 dark:border-white/10">
            <h3 className="text-[16px] font-semibold text-[#1a2138] dark:text-white mb-6">Weekly Trends</h3>
            <div className="h-[100px] flex items-end justify-between gap-2 px-1">
              {weeklyData.map((data, i) => (
                <div 
                  key={i} 
                  onClick={() => toast.success(`${data.day}: ${Math.round(data.value)} kcal`, {
                    icon: '🔥',
                    style: { borderRadius: '16px', fontWeight: 'bold' }
                  })}
                  className="group relative flex-1 h-full flex flex-col justify-end"
                >
                  <div 
                    className="w-full bg-[#6FAF95]/20 dark:bg-white/10 rounded-t-[6px] transition-all duration-300 group-hover:bg-[#6FAF95] cursor-pointer relative" 
                    style={{ height: `${Math.max(4, (data.value / maxWeeklyKcal) * 100)}%` }}
                  >
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1a2138] text-white text-[10px] font-bold py-0.5 px-2 rounded-full pointer-events-none whitespace-nowrap z-10">
                      {Math.round(data.value)} kcal
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter text-center mt-2">
                    {data.day}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-8 pt-4 border-t border-slate-100 dark:border-white/5 flex gap-4 items-center">
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Average</span>
                <span className="text-[15px] font-black text-[#1a2138] dark:text-white">{avgKcal} kcal</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Variation</span>
                <span className={`text-[15px] font-black ${diffFromLastWeek > 0 ? 'text-red-500' : 'text-[#6FAF95]'}`}>
                  {diffFromLastWeek > 0 ? '+' : ''}{diffFromLastWeek}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recipe Modal */}
      <AnimatePresence>
        {showRecipe && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowRecipe(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white dark:bg-[#0F1412] w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
              <div className="relative h-[200px] shrink-0">
                <button onClick={() => setShowRecipe(false)} className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center"><X size={20} /></button>
                <ImageWithFallback src={currentSuggestion.image} alt={currentSuggestion.title} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 overflow-y-auto p-8">
                <h2 className="text-[24px] font-black text-[#1a2138] dark:text-white mb-3">{currentSuggestion.title}</h2>
                <div className="space-y-6">
                  <section>
                    <h3 className="text-[18px] font-bold mb-3 dark:text-white">Ingredients</h3>
                    <ul className="space-y-2">{currentSuggestion.ingredients.map((ing, i) => <li key={i} className="text-[14px] text-[#5D6B82] dark:text-slate-400 flex gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#6FAF95] mt-1.5 shrink-0" />{ing}</li>)}</ul>
                  </section>
                  <section>
                    <h3 className="text-[18px] font-bold mb-3 dark:text-white">Instructions</h3>
                    <div className="space-y-4">{currentSuggestion.instructions.map((step, i) => <div key={i} className="flex gap-4"><div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-black text-[12px]">{i + 1}</div><p className="text-[14px] text-[#5D6B82] dark:text-slate-400 leading-relaxed">{step}</p></div>)}</div>
                  </section>
                </div>
              </div>
              <div className="p-6 shrink-0"><button onClick={() => setShowRecipe(false)} className="w-full h-14 bg-[#69A38D] text-white rounded-2xl font-black shadow-lg">Got it!</button></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden Inputs */}
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) onLogFood('Scan', activeMealRef.current || activeMealForImport, file); if (e.target) e.target.value = ''; }} />
      <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => { const file = e.target.files?.[0]; if (file) onLogFood('Scan', activeMealRef.current || activeMealForImport, file); if (e.target) e.target.value = ''; }} />
      <input type="file" ref={headerCameraRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => { const file = e.target.files?.[0]; if (file) onLogFood('Scan', null, file); if (e.target) e.target.value = ''; }} />
    </div>
  );
}
