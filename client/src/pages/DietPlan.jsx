import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import api, { nutritionService, dietRecommendationService } from '../services/api';
import {
  Heart, Clock, ArrowLeft, Flame, Target,
  AlertCircle, Sparkles, CheckCircle, Lightbulb, X, UtensilsCrossed, Utensils,
  ChevronLeft, ChevronRight, Calendar, Search, Filter, RefreshCw, Eye, ChefHat,
  ArrowRight, Check, Zap, Info, Coffee, Sun
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import FoodPreferences from '../components/FoodPreferences';
import { ImageWithFallback } from '../components/ImageWithFallback';

// --- Constants & Helpers ---
const Sunset = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="M2 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="M12 18v2" /><path d="m17.66 17.66 1.41 1.41" /><path d="M20 12h2" /><path d="m19.07 4.93-1.41 1.41" /><path d="M2 18h20" /><path d="M16 18a4 4 0 0 0-8 0" />
  </svg>
);

const Moon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

const MEAL_ORDER = ['breakfast', 'midMorningSnack', 'lunch', 'eveningSnack', 'dinner', 'snacks'];
const SECTION_INFO = {
  breakfast: { label: 'Breakfast', time: '08:00 AM', emoji: '🍳', icon: Coffee },
  midMorningSnack: { label: 'Morning Snack', time: '11:00 AM', emoji: '🍎', icon: Sun },
  lunch: { label: 'Lunch', time: '01:30 PM', emoji: '🥗', icon: Utensils },
  eveningSnack: { label: 'Evening Snack', time: '05:00 PM', emoji: '☕', icon: Sunset },
  dinner: { label: 'Dinner', time: '08:30 PM', emoji: '🌙', icon: Moon },
  snacks: { label: 'Healthy Snacks', time: 'Flexible', emoji: '🍿', icon: Coffee },
};

function getMealName(m) {
  if (typeof m === 'string') return m;
  return m?.name || 'Meal Item';
}

function getMealCalories(m) {
  return m?.calories || m?.nutrients?.calories || 0;
}

// --- UI Components ---

const MealCard = ({ meal, mealType, onLog, isLogged, idx }) => {
  const name = getMealName(meal);
  const calories = getMealCalories(meal);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-[2.5rem] p-5 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] group hover:shadow-xl hover:shadow-slate-200/50 transition-all flex flex-col h-full min-w-[280px] md:min-w-[320px] snap-start"
    >
      <div className="relative h-48 mb-5 overflow-hidden rounded-[2rem] bg-slate-50">
        <ImageWithFallback
          src={meal.imageUrl}
          query={name}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute top-4 left-4">
          <span className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-800 shadow-sm border border-white/50">
            Option {idx + 1}
          </span>
        </div>
      </div>

      <div className="flex-1">
        <h3 className="text-lg font-semibold text-slate-800 mb-2 leading-tight">{name}</h3>
        <p className="text-[11px] font-medium text-slate-500 line-clamp-2 mb-6 leading-relaxed">
          {meal.description || meal.benefits || "Nutrient-rich choice designed for your goals."}
        </p>
      </div>

      <div className="flex items-center gap-2 mb-6 scrollbar-hide">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-full">
          <Flame className="w-3.5 h-3.5" />
          <span className="text-[11px] font-black">{calories} Cal</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-[11px] font-black">15m Prep</span>
        </div>
      </div>

      <button
        onClick={() => onLog(meal, mealType)}
        disabled={isLogged}
        className={`w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg ${isLogged
          ? 'bg-emerald-500 text-white shadow-emerald-200'
          : 'bg-black text-white hover:bg-slate-800 shadow-black/5'
          }`}
      >
        {isLogged ? <><Check className="w-4 h-4" /> Eaten</> : 'Log this meal'}
      </button>
    </motion.div>
  );
};

export default function DietPlan() {
  const { user } = useAuth();
  const { invalidateCache } = useData();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlan] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showRegenOptions, setShowRegenOptions] = useState(false);
  const [prefMode, setPrefMode] = useState('save');
  const [loggedMeals, setLoggedMeals] = useState({});

  const rowRefs = useRef({});

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [planRes, logsRes, historyRes] = await Promise.all([
        dietRecommendationService.getActiveDietPlan(),
        nutritionService.getTodayLogs(),
        dietRecommendationService.getDietPlanHistory()
      ]);

      if (planRes.data.success) setActivePlan(planRes.data.dietPlan);
      if (historyRes.data.success) setHistory(historyRes.data.history);

      const logs = logsRes.data?.foodLogs || logsRes.data?.logs || [];
      const loggedMap = {};
      logs.forEach(log => {
        const type = log.mealType;
        const name = log.name || log.foodItems?.[0]?.name;
        loggedMap[`${type}-${name}`] = true;
        // Add mapping for snack variations
        if (type === 'snack') {
          loggedMap[`midMorningSnack-${name}`] = true;
          loggedMap[`eveningSnack-${name}`] = true;
          loggedMap[`snacks-${name}`] = true;
        }
      });
      setLoggedMeals(loggedMap);

    } catch (err) {
      console.error("Error loading diet plan:", err);
    } finally {
      setLoading(false);
    }
  };

  const generatePlan = async (isRegenerate = false, usePreferences = true) => {
    // Check if user has set a fitness goal first
    if (!user?.nutritionGoal?.calorieGoal) {
      toast.error('Please set your fitness goal first to generate a personalized diet plan.');
      navigate('/profile?tab=goals');
      return;
    }

    setGenerating(true);
    try {
      const { data } = await dietRecommendationService.generateDietPlan({ isRegenerate, usePreferences });
      if (data.success) {
        toast.success(isRegenerate ? 'Plan updated!' : 'New plan ready!');
        loadInitialData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update plan');
    } finally {
      setGenerating(false);
    }
  };

  const loadSelectedPlan = async (planId) => {
    try {
      setLoading(true);
      const { data } = await dietRecommendationService.getDietPlanById(planId);
      if (data.success) {
        setActivePlan(data.dietPlan);
        setShowHistory(false);
        toast.success('Loaded past plan');
      }
    } catch (err) {
      toast.error('Failed to load plan');
    } finally {
      setLoading(false);
    }
  };

  const handleLogMeal = async (meal, type) => {
    const mealName = getMealName(meal);
    if (loggedMeals[`${type}-${mealName}`]) return;

    try {
      // Show analyzing toast
      const analyzeToastId = toast.loading('Analyzing nutrition profile...');

      // 1. Analyze the food to get rich data (AI or Cache)
      const { data: analysisRes } = await api.post('nutrition/analyze-food', {
        foodDescription: mealName
      });

      if (!analysisRes.success) throw new Error('Analysis failed');
      const data = analysisRes.analysis;

      // 2. Log with rich data
      await nutritionService.logMeal({
        mealType: type === 'midMorningSnack' || type === 'eveningSnack' ? 'snack' : type,
        foodItems: [{
          name: mealName,
          quantity: data.foodItem?.quantity || '1 serving',
          nutrition: data.foodItem?.nutrition || {
            calories: meal.calories || 200,
            protein: meal.protein || 10,
            carbs: meal.carbs || 30,
            fats: meal.fats || 5
          }
        }],
        healthScore: data.healthScore || data.foodItem?.healthScore,
        healthScore10: data.healthScore10 || data.foodItem?.healthScore10,
        micronutrients: data.micronutrients || data.foodItem?.micronutrients,
        enhancementTips: data.enhancementTips || data.foodItem?.enhancementTips,
        healthBenefitsSummary: data.healthBenefitsSummary || data.foodItem?.healthBenefitsSummary,
        warnings: data.warnings || data.foodItem?.warnings,
        alternatives: data.alternatives || data.foodItem?.alternatives,
        source: 'meal_plan'
      });

      toast.dismiss(analyzeToastId);
      toast.success('Meal logged! Keep it up 🚀');
      setLoggedMeals(prev => ({ ...prev, [`${type}-${mealName}`]: true }));
      invalidateCache(['dashboard', `nutrition_${new Date().toISOString().split('T')[0]}`]);
    } catch (err) {
      console.error("Log meal error:", err);
      toast.error('Failed to log meal');
    }
  };

  if (loading || generating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDFDFD] px-4">
        <div className="relative w-24 h-24 mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-full border-4 border-black border-t-transparent"
          />
          <ChefHat className="absolute inset-0 m-auto w-8 h-8 text-black animate-pulse" />
        </div>
        <p className="text-[#A795C7] font-black uppercase tracking-[0.2em] text-xs text-center mb-3">
          {generating ? 'Hang tight, diet plan is generating...' : 'Curating your diet protocol...'}
        </p>
        {generating && (
          <p className="text-red-400 font-bold text-[10px] uppercase tracking-widest text-center max-w-xs leading-relaxed border border-red-100 bg-red-50 p-3 rounded-2xl">
            Please do not click the back button or refresh the page
          </p>
        )}
      </div>
    );
  }

  // --- Prioritize Profile Goals for Overview ---
  const dailyGoals = {
    calories: user?.nutritionGoal?.calorieGoal || activePlan?.nutritionGoals?.dailyCalorieTarget || 2100,
    protein: user?.nutritionGoal?.proteinGoal || activePlan?.nutritionGoals?.macroTargets?.protein || 150,
    carbs: user?.nutritionGoal?.carbsGoal || activePlan?.nutritionGoals?.macroTargets?.carbs || 200,
    fats: user?.nutritionGoal?.fatGoal || activePlan?.nutritionGoals?.macroTargets?.fat || 65
  };

  return (
    <div className="min-h-screen bg-transparent pb-32 px-4 md:px-6 lg:px-12 pt-8">
      {/* Background elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-100/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex flex-col gap-3 mb-6 md:mb-16 pt-2 md:pt-4">
        <h1 className="text-3xl md:text-5xl font-light tracking-tight text-[#1a1a1a]">My Meal Plan</h1>

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1.5 bg-white/60 backdrop-blur-md px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-white/60 shadow-sm shrink-0">
            <Calendar className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-400" />
            <span className="text-xs md:text-sm font-medium text-slate-600 whitespace-nowrap">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </div>
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 md:px-6 md:py-2 bg-white/60 backdrop-blur-md rounded-full text-xs md:text-sm font-medium text-[#1a1a1a] hover:bg-white transition-all border border-white/60 shadow-sm shrink-0"
          >
            <Clock className="w-3.5 h-3.5 text-slate-500" /> History
          </button>
          <button
            onClick={() => {
              setPrefMode('save');
              setShowPreferences(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 md:px-6 md:py-2 bg-white/60 backdrop-blur-md rounded-full text-xs md:text-sm font-medium text-[#1a1a1a] hover:bg-white transition-all border border-white/60 shadow-sm shrink-0"
          >
            <Filter className="w-3.5 h-3.5 text-slate-500" /> Preferences
          </button>
          <button
            onClick={() => setShowRegenOptions(true)}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 md:px-6 md:py-2 bg-black text-white rounded-full text-xs md:text-sm font-medium hover:bg-black transition-all shadow-lg hover:shadow-black/5 active:scale-95 disabled:opacity-50 shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            {generating ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>
      </div>

      {!activePlan ? (
        <div className="bg-white rounded-[3rem] p-12 border border-slate-100 shadow-xl text-center max-w-2xl mx-auto mt-20">
          <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-white shadow-inner">
            <ChefHat className="w-10 h-10 text-slate-400" />
          </div>
          <h2 className="text-3xl font-light text-slate-800 mb-4 tracking-tight">Ready for your roadmap?</h2>
          <p className="text-slate-500 mb-10 leading-relaxed text-lg">
            We'll calculate your metabolic needs based on your profile and health reports to create a perfect plan.
          </p>
          <button
            onClick={() => generatePlan(false)}
            disabled={generating}
            className="bg-black text-white px-10 py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl hover:bg-slate-800 transition-all disabled:opacity-50 active:scale-95"
          >
            {generating ? 'Calculating...' : 'Create My Plan'}
          </button>
        </div>
      ) : (
        <div className="space-y-12 md:space-y-24">

          {/* Quick Metrics Bar - Protocol Overview */}
          <section>
            <div className="grid grid-cols-4 gap-2 md:gap-4">
              {[
                { label: 'Calories', val: Math.round(dailyGoals.calories), unit: 'kcal', color: 'bg-indigo-500', icon: Flame },
                { label: 'Protein', val: Math.round(dailyGoals.protein), unit: 'g', color: 'bg-emerald-500', icon: Zap },
                { label: 'Carbs', val: Math.round(dailyGoals.carbs), unit: 'g', color: 'bg-blue-500', icon: Target },
                { label: 'Fats', val: Math.round(dailyGoals.fats), unit: 'g', color: 'bg-orange-500', icon: Heart }
              ].map((m, i) => (
                <div key={m.label} className="bg-white p-2.5 md:p-6 rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center">
                  <div className={`w-7 h-7 md:w-10 md:h-10 ${m.color} bg-opacity-10 rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-4`}>
                    <m.icon className={`w-3.5 h-3.5 md:w-5 md:h-5 ${m.color.replace('bg-', 'text-')}`} />
                  </div>
                  <span className="text-[7px] md:text-[10px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] text-slate-400 mb-0.5 md:mb-1">{m.label}</span>
                  <div className="flex items-baseline gap-0.5 md:gap-1">
                    <span className="text-sm md:text-2xl font-light text-slate-800">{m.val}</span>
                    <span className="text-[8px] md:text-xs font-bold text-slate-400">{m.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Meal Rows - Vertical sections with horizontal scroll */}
          {MEAL_ORDER.map((sectionId, sIdx) => {
            const section = SECTION_INFO[sectionId];
            const meals = activePlan.mealPlan?.[sectionId] || [];
            if (meals.length === 0) return null;

            return (
              <section key={sectionId} className="relative group">
                <div className="flex items-center justify-between mb-8 px-2">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-[1.25rem] bg-slate-50 flex items-center justify-center border border-white shadow-sm overflow-hidden text-2xl">
                      {section.emoji}
                    </div>
                    <div>
                      <h2 className="text-2xl font-light tracking-tight text-slate-800 uppercase">{section.label}</h2>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{section.time}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => rowRefs.current[sectionId]?.scrollBy({ left: -350, behavior: 'smooth' })}
                      className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-all shadow-sm"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => rowRefs.current[sectionId]?.scrollBy({ left: 350, behavior: 'smooth' })}
                      className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-all shadow-sm"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div
                  ref={el => rowRefs.current[sectionId] = el}
                  className="flex gap-6 overflow-x-auto pb-8 scrollbar-hide snap-x px-2"
                >
                  {meals.map((meal, i) => (
                    <MealCard
                      key={`${sectionId}-${i}`}
                      meal={meal}
                      mealType={sectionId}
                      idx={i}
                      isLogged={!!loggedMeals[`${sectionId}-${getMealName(meal)}`]}
                      onLog={handleLogMeal}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {/* AI Insights Bar */}
          <section className="bg-black rounded-[3rem] p-10 lg:p-16 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px]" />
            <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-6">
                  <Sparkles className="w-8 h-8 text-emerald-400" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Dietary Intelligence</span>
                </div>
                <h2 className="text-4xl font-light mb-8 leading-tight tracking-tight">AI Insights based on your health profile</h2>
                <div className="space-y-4">
                  {(activePlan.lifestyleRecommendations || ["Balance carbs with fiber.", "Hydrate 30m before breakfast.", "Avoid caffeine after 4pm."]).slice(0, 3).map((rec, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      </div>
                      <p className="text-slate-300 font-medium leading-relaxed">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:w-1/3 w-full">
                <div className="bg-white/5 backdrop-blur-3xl p-8 rounded-[2.5rem] border border-white/10">
                  <div className="flex items-center gap-3 mb-6">
                    <AlertCircle className="w-6 h-6 text-rose-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Restricted Foods</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(activePlan.avoidSuggestions || ["Refined Sugar", "Processed Meats", "Soda", "High Sodium Snacks"]).map((food, i) => (
                      <span key={i} className="px-4 py-2 bg-rose-500/10 text-rose-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-rose-500/20">
                        {food}
                      </span>
                    ))}
                  </div>
                  <div className="mt-8 pt-8 border-t border-white/5">
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">
                      Based on your latest records, avoiding these will significantly improve your {user?.nutritionGoal?.goal?.replace('_', ' ') || 'metabolic health'}.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

        </div>
      )}

      {/* Modals */}
      {showPreferences && (
        <FoodPreferences 
          onClose={() => setShowPreferences(false)} 
          mode={prefMode}
          onGenerate={prefMode === 'regenerate' ? () => generatePlan(true) : null}
        />
      )}

      {/* Regeneration Options Modal */}
      <AnimatePresence>
        {showRegenOptions && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[120] flex items-center justify-center p-4" onClick={() => setShowRegenOptions(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full border border-slate-100"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800">Regenerate Plan</h3>
                <button onClick={() => setShowRegenOptions(false)} className="text-slate-400 hover:text-black">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setShowRegenOptions(false);
                    generatePlan(true); // Default regeneration (usually more variety)
                  }}
                  className="w-full flex flex-col items-start p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-all text-left"
                >
                  <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500" /> Different Food
                  </span>
                  <span className="text-xs text-slate-500 mt-1">Generate completely new variety of healthy Indian meals</span>
                </button>

                <button
                  onClick={() => {
                    setShowRegenOptions(false);
                    setPrefMode('regenerate');
                    setShowPreferences(true);
                  }}
                  className="w-full flex flex-col items-start p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-all text-left"
                >
                  <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-emerald-500" /> Based on Preferred Food
                  </span>
                  <span className="text-xs text-slate-500 mt-1">Update your favorites first, then generate a tailored plan</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[3rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">Plan History</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Previous generations</p>
                </div>
                <button onClick={() => setShowHistory(false)} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-black transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4 scrollbar-hide">
                {history.length > 0 ? (
                  history.map((plan) => (
                    <button
                      key={plan._id}
                      onClick={() => loadSelectedPlan(plan._id)}
                      className={`w-full p-6 rounded-3xl border text-left transition-all flex items-center justify-between group ${activePlan?._id === plan._id ? 'bg-black border-black shadow-xl ring-4 ring-black/5' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${activePlan?._id === plan._id ? 'bg-white/20 text-white border border-white/20' : 'bg-white text-slate-800 border border-slate-100'}`}>
                            {plan.fitnessGoal?.replace('_', ' ') || 'General Health'}
                          </div>
                          {activePlan?._id === plan._id && (
                            <div className="flex items-center gap-1 text-emerald-400 text-[9px] font-black uppercase tracking-widest">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Active Now
                            </div>
                          )}
                        </div>
                        <p className={`text-sm font-black ${activePlan?._id === plan._id ? 'text-white' : 'text-slate-800'}`}>
                          {new Date(plan.createdAt).toLocaleDateString('en-US', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </p>
                        <p className={`text-[10px] font-bold mt-1 ${activePlan?._id === plan._id ? 'text-slate-400' : 'text-slate-400'}`}>
                          {plan.nutritionGoals?.dailyCalorieTarget} kcal • {plan.foodType || 'Balanced'}
                        </p>
                      </div>
                      <ChevronRight className={`w-5 h-5 transition-transform group-hover:translate-x-1 ${activePlan?._id === plan._id ? 'text-white' : 'text-slate-300'}`} />
                    </button>
                  ))
                ) : (
                  <div className="py-20 text-center">
                    <Clock className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                    <p className="text-sm font-bold text-slate-400">No past plans found</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
