import React, { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  ChevronLeft, ChevronRight, Plus, Camera, Mic, Utensils, Droplet, Minus, CheckCircle2, 
  AlertTriangle, AlertCircle, X, Coffee, Apple, Calendar, Image as ImageIcon, 
  Type, History, ArrowLeft, Flame, UtensilsCrossed, Zap, Search, Trash2, MoreHorizontal, Sparkles
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
  const dateBtnRef = useRef(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [datePickerPos, setDatePickerPos] = useState({ top: 0, right: 0 });

  React.useEffect(() => {
    if (!showDatePicker) return;
    const close = () => setShowDatePicker(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [showDatePicker]);

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

  // --- Healthy vs Junk Calculation ---
  const todayQuality = useMemo(() => {
    let healthy = 0;
    let junk = 0;
    let total = 0;
    
    loggedMeals.forEach(meal => {
      const score = meal.healthScore10 !== undefined ? meal.healthScore10 : (meal.healthScore / 10);
      if (score >= 7) healthy++;
      else if (score <= 4.5 && score > 0) junk++;
      total++;
    });

    return {
      healthy: total > 0 ? Math.round((healthy / total) * 100) : 0,
      junk: total > 0 ? Math.round((junk / total) * 100) : 0,
      total
    };
  }, [loggedMeals]);

  const overallQuality = useMemo(() => {
    let healthy = 0;
    let junk = 0;
    let total = 0;
    
    // Process historical days
    weeklyTrendsData.forEach(day => {
      healthy += (day.healthyFoodsCount || 0);
      junk += (day.junkFoodsCount || 0);
      total += (day.totalFoodsCount || 0);
    });

    // Add today's real-time logs
    let todayHealthy = 0;
    let todayJunk = 0;
    loggedMeals.forEach(meal => {
      const score = meal.healthScore10 !== undefined ? meal.healthScore10 : (meal.healthScore / 10);
      if (score >= 7) todayHealthy++;
      else if (score <= 4.5 && score > 0) todayJunk++;
    });

    healthy += todayHealthy;
    junk += todayJunk;
    total += loggedMeals.length;

    return {
      healthy: total > 0 ? Math.round((healthy / total) * 100) : 0,
      junk: total > 0 ? Math.round((junk / total) * 100) : 0,
      total
    };
  }, [weeklyTrendsData, loggedMeals]);

  const glassStyle = {
    background: "rgba(255,255,255,0.72)",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    border: "1px solid rgba(255,255,255,0.85)",
    boxShadow: "0 4px 24px rgba(16,185,129,0.06), 0 1px 0 rgba(255,255,255,0.9) inset",
  };

  return (
    <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8 max-w-5xl mx-auto w-full pt-1">

      {/* ── Header ── */}
      <div className="flex flex-row items-center justify-between gap-2">
        <div>
          <h1 className="text-[22px] md:text-[26px] font-black text-[#0d2b22] tracking-tight leading-tight">
            Nutrition
          </h1>
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">
            Daily Tracker
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onLogFood('photo')}
            className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-90"
            style={glassStyle}
          >
            <Camera size={17} strokeWidth={2} className="text-emerald-600" />
          </button>
          <button
            onClick={() => onLogFood('voice')}
            className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-90"
            style={glassStyle}
          >
            <Mic size={17} strokeWidth={2} className="text-emerald-600" />
          </button>
          <button
            onClick={() => onLogFood('Scan')}
            className="px-5 h-10 rounded-2xl text-[13px] font-black flex items-center gap-2 active:scale-95 transition-all text-white uppercase tracking-wide"
            style={{ background: "linear-gradient(135deg,#059669,#10b981)", boxShadow: "0 4px 14px rgba(5,150,105,0.3)" }}
          >
            <Plus size={16} strokeWidth={3} /> Log Meal
          </button>
        </div>
      </div>

      {/* ── Calorie Card + Weekly Trend side by side on desktop ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">

        {/* Calorie Card */}
        <div className="rounded-[28px] p-5 relative overflow-hidden" style={glassStyle}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Daily Calories</p>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest ${
              totalTodayKcal > (dailySummary.calorieTarget || 1800)
                ? 'bg-red-50 text-red-500 border border-red-100'
                : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
            }`}>
              {Math.round(progressPercent)}% of goal
            </span>
          </div>
          <div className="flex items-end gap-2 mb-1">
            <span className={`text-[38px] md:text-[44px] font-black tracking-tight leading-none ${totalTodayKcal > (dailySummary.calorieTarget || 1800) ? 'text-red-500' : 'text-[#0d2b22]'}`}>
              {totalTodayKcal}
            </span>
            <span className="text-[15px] font-bold text-slate-400 pb-1.5">/ {dailySummary.calorieTarget || 1800} kcal</span>
          </div>
          <p className={`text-[11px] font-black mb-4 ${totalTodayKcal > (dailySummary.calorieTarget || 1800) ? 'text-red-500' : 'text-emerald-600'}`}>
            {totalTodayKcal > (dailySummary.calorieTarget || 1800)
              ? `${totalTodayKcal - (dailySummary.calorieTarget || 1800)} kcal over limit`
              : `${(dailySummary.calorieTarget || 1800) - totalTodayKcal} kcal remaining`}
          </p>
          <div className="w-full h-2.5 rounded-full overflow-hidden mb-5" style={{ background: "rgba(255,255,255,0.5)" }}>
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${Math.min(100, progressPercent)}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={`h-full rounded-full ${totalTodayKcal > (dailySummary.calorieTarget || 1800) ? 'bg-red-500' : 'bg-emerald-500'}`}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Protein', val: dailySummary.protein, target: dailySummary.proteinTarget, color: '#7c3aed' },
              { label: 'Carbs', val: dailySummary.carbs, target: dailySummary.carbsTarget, color: '#2563eb' },
              { label: 'Fats', val: dailySummary.fats, target: dailySummary.fatsTarget, color: '#059669' },
            ].map(m => (
              <div key={m.label} className="flex flex-col gap-1.5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{m.label}</span>
                <div className="flex items-baseline gap-0.5">
                  <span className={`text-[13px] font-black ${m.val > m.target ? 'text-red-500' : 'text-[#0d2b22]'}`}>{m.val}g</span>
                  <span className="text-[9px] font-bold text-slate-400">/{m.target}g</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
                  <motion.div className="h-full rounded-full" style={{ background: m.val > m.target ? '#ef4444' : m.color }}
                    initial={{ width: 0 }} animate={{ width: `${Math.min(100, (m.val / m.target) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Trend — right side, prominent */}
        <div className="rounded-[28px] p-5" style={glassStyle}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Weekly Trend</p>
              <p className="text-[18px] font-black text-[#0d2b22] leading-tight">{avgKcal} <span className="text-[11px] font-bold text-slate-400">avg kcal</span></p>
            </div>
            <span className={`text-[11px] font-black px-2.5 py-1 rounded-full ${diffFromLastWeek > 0 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
              {diffFromLastWeek > 0 ? '+' : ''}{diffFromLastWeek}%
            </span>
          </div>
          <div className="h-[90px] flex items-end justify-between gap-1.5 px-1">
            {weeklyData.map((data, i) => (
              <div key={i} onClick={() => toast.success(`${data.day}: ${Math.round(data.value)} kcal`, { icon: '🔥', style: { borderRadius: '16px', fontWeight: 'bold' } })}
                className="group relative flex-1 h-full flex flex-col justify-end cursor-pointer">
                <div className="w-full rounded-t-[5px] transition-all duration-300 relative"
                  style={{
                    height: `${Math.max(6, (data.value / maxWeeklyKcal) * 100)}%`,
                    background: data.active ? 'linear-gradient(180deg,#059669,#10b981)' : 'rgba(5,150,105,0.15)',
                  }}>
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0d2b22] text-white text-[9px] font-black py-0.5 px-2 rounded-full pointer-events-none whitespace-nowrap z-10">
                    {Math.round(data.value)}
                  </div>
                </div>
                <span className={`text-[9px] font-black uppercase tracking-tighter text-center mt-1.5 ${data.active ? 'text-emerald-600' : 'text-slate-400'}`}>{data.day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Date Navigator ── */}
      <div className="flex items-center gap-2 rounded-[20px] p-1.5" style={glassStyle}>
        <button
          onClick={() => onDateChange && onDateChange(new Date(new Date(selectedDate).getTime() - 86400000).toISOString().split('T')[0])}
          className="w-9 h-9 rounded-[14px] flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
          style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.9)" }}
        >
          <ChevronLeft size={16} className="text-emerald-700" strokeWidth={2.5} />
        </button>

        <button
          ref={dateBtnRef}
          onClick={() => {
            const d = new Date(selectedDate + 'T12:00:00');
            setDatePickerMonth({ year: d.getFullYear(), month: d.getMonth() });
            if (dateBtnRef.current) {
              const rect = dateBtnRef.current.getBoundingClientRect();
              setDatePickerPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right + (rect.width / 2) - 140 });
            }
            setShowDatePicker(v => !v);
          }}
          className="flex-1 flex flex-col items-center py-1 transition-all active:scale-95"
        >
          <p className="text-[14px] font-black text-[#0d2b22] leading-tight tracking-tight">
            {(() => {
              const today = new Date().toISOString().split('T')[0];
              const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
              if (selectedDate === today) return "Today";
              if (selectedDate === yesterday) return "Yesterday";
              return new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long' });
            })()}
          </p>
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            <svg className={`w-2.5 h-2.5 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
          </p>
        </button>

        <button
          onClick={() => {
            const today = new Date().toISOString().split('T')[0];
            if (selectedDate < today) onDateChange && onDateChange(new Date(new Date(selectedDate + 'T12:00:00').getTime() + 86400000).toISOString().split('T')[0]);
          }}
          disabled={selectedDate >= new Date().toISOString().split('T')[0]}
          className="w-9 h-9 rounded-[14px] flex items-center justify-center flex-shrink-0 transition-all active:scale-90 disabled:opacity-30"
          style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.9)" }}
        >
          <ChevronRight size={16} className="text-emerald-700" strokeWidth={2.5} />
        </button>
      </div>

      {/* Custom Calendar Picker Portal */}
      {createPortal(
        <AnimatePresence>
          {showDatePicker && (
            <>
              <div className="fixed inset-0 z-[999]" onClick={() => setShowDatePicker(false)} />
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="fixed z-[1000] rounded-[20px] shadow-2xl border border-[#e0ede6] overflow-hidden"
                style={{ background: "linear-gradient(145deg,#ffffff 0%,#f4fbf7 100%)", width: 280, top: datePickerPos.top, right: datePickerPos.right }}
              >
                {/* Month Nav */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#edf5f0]">
                  <button onClick={() => setDatePickerMonth(prev => { const d = new Date(prev.year, prev.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[#e8f4ed] transition-colors text-[#5B8C6F]">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <span className="text-[13px] font-bold text-[#1a2e22]">
                    {new Date(datePickerMonth.year, datePickerMonth.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <button onClick={() => setDatePickerMonth(prev => { const d = new Date(prev.year, prev.month + 1); const now = new Date(); if (d.getFullYear() > now.getFullYear() || (d.getFullYear() === now.getFullYear() && d.getMonth() > now.getMonth())) return prev; return { year: d.getFullYear(), month: d.getMonth() }; })}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[#e8f4ed] transition-colors text-[#5B8C6F]">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
                {/* Day Headers */}
                <div className="grid grid-cols-7 px-3 pt-2 pb-1">
                  {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => (
                    <div key={d} className="text-center text-[9px] font-black text-[#a0bfae] uppercase tracking-wider py-1">{d}</div>
                  ))}
                </div>
                {/* Days Grid */}
                <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
                  {(() => {
                    const { year, month } = datePickerMonth;
                    const firstDay = new Date(year, month, 1).getDay();
                    const offset = firstDay === 0 ? 6 : firstDay - 1;
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const today = new Date().toISOString().split('T')[0];
                    const cells = [];
                    for (let i = 0; i < offset; i++) cells.push(<div key={`e${i}`} />);
                    for (let d = 1; d <= daysInMonth; d++) {
                      const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                      const isFuture = dateStr > today;
                      const isSelected = dateStr === selectedDate;
                      const isToday = dateStr === today;
                      cells.push(
                        <button key={d} disabled={isFuture}
                          onClick={() => { onDateChange && onDateChange(dateStr); setShowDatePicker(false); }}
                          className={`relative w-full aspect-square rounded-full text-[12px] font-semibold flex items-center justify-center transition-all ${isFuture ? 'text-[#d0d0d0] cursor-not-allowed' : 'hover:bg-[#e8f4ed] cursor-pointer'} ${isSelected ? 'text-white font-bold shadow-md' : isToday ? 'text-[#3d7a5e] font-black' : 'text-[#2a2a2a]'}`}
                          style={isSelected ? { background: 'linear-gradient(135deg,#059669 0%,#10b981 100%)' } : isToday && !isSelected ? { boxShadow: 'inset 0 0 0 1.5px #5B8C6F' } : {}}
                        >{d}</button>
                      );
                    }
                    return cells;
                  })()}
                </div>
                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#edf5f0]">
                  <button onClick={() => { onDateChange && onDateChange(new Date().toISOString().split('T')[0]); setShowDatePicker(false); }}
                    className="text-[11px] font-bold text-[#5B8C6F] hover:text-[#3d7a5e] transition-colors">Today</button>
                  <button onClick={() => setShowDatePicker(false)}
                    className="text-[11px] font-bold text-[#a0a0a0] hover:text-[#5B8C6F] transition-colors">Close</button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── Meal Timeline ── */}
      <div className="flex flex-col gap-4">
        {[
          { name: 'Breakfast', target: Math.round((dailySummary.calorieTarget || 1800) * 0.30), icon: Coffee, time: '09:00' },
          { name: 'Lunch', target: Math.round((dailySummary.calorieTarget || 1800) * 0.40), icon: Utensils, time: '13:30' },
          { name: 'Dinner', target: Math.round((dailySummary.calorieTarget || 1800) * 0.30), icon: UtensilsCrossed, time: '20:15' },
        ].map((meal, idx) => {
          const typeKey = meal.name.toLowerCase();
          const meals = (loggedMeals || []).filter(m => {
            if (!m.mealType) return false;
            const mt = String(m.mealType).toLowerCase();
            if (mt === typeKey) return true;
            if (typeKey === 'breakfast' && (mt.includes('breakfast') || mt === 'morning')) return true;
            if (typeKey === 'lunch' && mt.includes('lunch')) return true;
            if (typeKey === 'dinner' && mt.includes('dinner')) return true;
            return false;
          });
          const consumed = meals.reduce((acc, curr) => acc + Number(curr.calories || curr.foodItems?.[0]?.nutrition?.calories || 0), 0);
          const isExceeded = consumed > meal.target;

          return (
            <React.Fragment key={idx}>
              <div className={`relative ${logMethodSection === meal.name ? 'z-[60]' : 'z-10'}`}>
                <div className="rounded-[24px] p-5 transition-all" style={glassStyle}>
                  {/* Meal header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(5,150,105,0.08)", border: "1px solid rgba(5,150,105,0.12)" }}>
                        <meal.icon size={18} className="text-emerald-600" strokeWidth={2.5} />
                      </div>
                      <div>
                        <p className="text-[15px] font-black text-[#0d2b22] leading-tight tracking-tight">{meal.name}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          {consumed > 0 ? `${meals.length} item${meals.length > 1 ? 's' : ''} logged` : meal.time}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="text-right">
                        <p className={`text-[14px] font-black leading-tight ${isExceeded ? 'text-red-500' : consumed > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                          {consumed > 0 ? `${consumed}` : '—'}
                        </p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">of {meal.target} kcal</p>
                      </div>
                      <button
                        onClick={() => setLogMethodSection(logMethodSection === meal.name ? null : meal.name)}
                        className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90 text-white"
                        style={{ background: "linear-gradient(135deg,#059669,#10b981)", boxShadow: "0 2px 10px rgba(5,150,105,0.25)" }}
                      >
                        <Plus size={16} strokeWidth={3} />
                      </button>
                    </div>
                  </div>

                  {/* Exceeded warning */}
                  {isExceeded && (
                    <div className="mt-3 p-3 rounded-2xl flex gap-2.5 items-center" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)" }}>
                      <AlertCircle size={14} className="text-red-500 shrink-0" />
                      <p className="text-[11px] font-black text-red-600">Over by {consumed - meal.target} kcal — a 30-min walk will help.</p>
                    </div>
                  )}

                  {/* Logged items */}
                  {meals.length > 0 && (
                    <div className="flex flex-col gap-2 mt-4 pt-4" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                      {meals.map((log, lIdx) => (
                        <div key={lIdx} onClick={() => onViewFood && onViewFood(log)}
                          className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all"
                          style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.9)" }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.85)"}
                          onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.55)"}
                        >
                          <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0">
                            <ImageWithFallback src={log.imageUrl || log.foodItems?.[0]?.imageUrl} query={log.name || log.foodItems?.[0]?.name} alt={log.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-black text-[#0d2b22] truncate">{log.name || log.foodItems?.[0]?.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-black text-emerald-600">{log.calories || log.foodItems?.[0]?.nutrition?.calories} kcal</span>
                              <span className="w-1 h-1 rounded-full bg-slate-200" />
                              <span className="text-[9px] font-black text-slate-400">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="relative">
                              <button className="w-8 h-8 flex items-center justify-center rounded-xl transition-all" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.9)" }}>
                                <MoreHorizontal size={13} className="text-slate-400" />
                              </button>
                              <select onClick={e => e.stopPropagation()} onChange={e => onMoveFood && onMoveFood(log._id, e.target.value)} value={log.mealType} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10">
                                {[{ label: 'Breakfast', value: 'breakfast' }, { label: 'Lunch', value: 'lunch' }, { label: 'Dinner', value: 'dinner' }].map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                            </div>
                            <button onClick={e => { e.stopPropagation(); onDeleteFood && onDeleteFood(log._id); }} className="w-8 h-8 flex items-center justify-center rounded-xl transition-all hover:bg-red-50" style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.9)" }}>
                              <Trash2 size={12} className="text-slate-400 hover:text-red-500" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Log method popup */}
                  {logMethodSection === meal.name && (
                    <div className="absolute right-4 top-14 w-[260px] p-4 rounded-[24px] shadow-2xl z-[100] animate-in zoom-in-95 duration-200"
                      style={{ background: "linear-gradient(135deg,#064e3b,#065f46)", border: "1px solid rgba(255,255,255,0.15)" }}>
                      <p className="text-[11px] font-black text-white/60 uppercase tracking-widest mb-1">Add to</p>
                      <h3 className="text-[17px] font-black text-white mb-4 tracking-tight">{meal.name}</h3>
                      <div className="flex flex-col gap-2">
                        {LOG_METHODS.map(method => (
                          <button key={method.id}
                            onClick={() => { if (method.id === 'photo') { setActiveMealForImport(meal.name); activeMealRef.current = meal.name; setLogMethodSection(null); setTimeout(() => cameraInputRef.current?.click(), 100); } else { setLogMethodSection(null); onLogFood(method.label, meal.name); } }}
                            className="w-full py-3 px-4 rounded-2xl flex items-center justify-between transition-all active:scale-95 border border-white/10"
                            style={{ background: "rgba(255,255,255,0.1)" }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.18)"}
                            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                          >
                            <span className="text-white font-black text-[13px]">{method.label}</span>
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)" }}>
                              <method.icon size={15} className="text-white" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Water tracker inline — after Lunch */}
              {idx === 1 && (
                <div className="rounded-[24px] p-5" style={{ ...glassStyle, boxShadow: "0 4px 20px rgba(59,130,246,0.07), 0 1px 0 rgba(255,255,255,0.9) inset" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hydration</p>
                      <p className="text-[15px] font-black text-[#0d2b22]">{waterIntake.current * 250} ml <span className="text-[11px] font-bold text-slate-400">/ {waterIntake.target * 250} ml</span></p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => onWaterUpdate(-1)} className="w-9 h-9 rounded-xl flex items-center justify-center" style={glassStyle}><Minus size={14} className="text-slate-500" /></button>
                      <button onClick={() => onWaterUpdate(1)} className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: "linear-gradient(135deg,#2563eb,#3b82f6)", boxShadow: "0 2px 10px rgba(59,130,246,0.3)" }}><Plus size={14} strokeWidth={3} /></button>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {[...Array(waterIntake.target)].map((_, i) => (
                      <div key={i} className={`flex-1 h-2.5 rounded-full transition-all ${i < waterIntake.current ? 'bg-blue-500' : 'bg-slate-100'}`} />
                    ))}
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Diet Quality Score ── */}
      <div className="rounded-[24px] p-5" style={glassStyle}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Sparkles size={12} className="text-amber-500" /> Diet Quality</p>
        </div>
        <div className="flex flex-col gap-3">
          {[
            { label: "Today", healthy: todayQuality.healthy, avg: 100 - todayQuality.healthy - todayQuality.junk, junk: todayQuality.junk, accent: "#059669" },
            { label: "7-Day Trend", healthy: overallQuality.healthy, avg: 100 - overallQuality.healthy - overallQuality.junk, junk: overallQuality.junk, accent: "#2563eb" },
          ].map(q => (
            <div key={q.label} className="p-3.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.9)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: q.accent }}>{q.label}</span>
                <div className="flex gap-3 text-[9px] font-black uppercase tracking-widest">
                  <span style={{ color: q.accent }}>{q.healthy}% Healthy</span>
                  <span className="text-slate-400">{q.avg}% Avg</span>
                  <span className="text-orange-500">{q.junk}% Junk</span>
                </div>
              </div>
              <div className="h-2.5 w-full rounded-full overflow-hidden flex" style={{ background: "rgba(0,0,0,0.06)" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${q.healthy}%` }} className="h-full" style={{ background: q.accent }} />
                <motion.div initial={{ width: 0 }} animate={{ width: `${q.avg}%` }} className="h-full bg-slate-200" />
                <motion.div initial={{ width: 0 }} animate={{ width: `${q.junk}%` }} className="h-full bg-orange-400" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 rounded-2xl flex items-start gap-2.5" style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.9)" }}>
          <Zap size={13} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
            {todayQuality.healthy > 70
              ? "Outstanding! Consistently choosing high-nutrient food is accelerating your health goals."
              : todayQuality.total > 0
                ? "Try substituting refined carbs with leafy greens at your next meal."
                : "Log your first meal to unlock personalized diet quality insights."}
          </p>
        </div>
      </div>

      {/* ── Nutrition Insight (bottom — after data) ── */}
      <div className="rounded-[24px] p-5" style={{ ...glassStyle, boxShadow: "0 4px 24px rgba(232,143,74,0.08), 0 1px 0 rgba(255,255,255,0.9) inset" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: "rgba(232,143,74,0.1)", border: "1px solid rgba(232,143,74,0.15)" }}>
              <AlertTriangle size={16} className="text-amber-500" strokeWidth={2.5} />
            </div>
            <p className="text-[13px] font-black text-[#0d2b22] uppercase tracking-tight">AI Insight</p>
          </div>
          <span className="text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest text-amber-600" style={{ background: "rgba(232,143,74,0.1)", border: "1px solid rgba(232,143,74,0.15)" }}>
            AI Analysis
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          {(() => {
            const alerts = [];
            const target = dailySummary.calorieTarget || 1800;
            if (totalTodayKcal > target) alerts.push({ type: 'CALORIES', msg: `Exceeded by ${totalTodayKcal - target} kcal. ${totalTodayKcal - target > 500 ? 'Try 45 mins of HIIT.' : 'A 20-min jog will help.'}` });
            if (dailySummary.protein > dailySummary.proteinTarget) alerts.push({ type: 'PROTEIN', msg: `Exceeded target by ${(dailySummary.protein - dailySummary.proteinTarget).toFixed(1)}g.` });
            if (alerts.length > 0) {
              return alerts.map((a, i) => (
                <div key={i} className="flex gap-3 items-start p-3 rounded-2xl" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.1)" }}>
                  <span className="text-[9px] font-black text-red-500 uppercase tracking-widest px-2 py-1 rounded-full shrink-0" style={{ background: "rgba(239,68,68,0.08)" }}>{a.type}</span>
                  <p className="text-[12px] font-bold text-red-700 leading-snug pt-0.5">{a.msg}</p>
                </div>
              ));
            }
            return <p className="text-[13px] font-bold text-slate-600 leading-relaxed">{aiInsights || "Your nutrition is perfectly balanced today. Keep it up!"}</p>;
          })()}
        </div>
      </div>

      {/* Recipe Modal */}
      <AnimatePresence>
        {showRecipe && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowRecipe(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col" style={glassStyle}>
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
