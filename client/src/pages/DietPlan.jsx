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

const MEAL_ORDER = ['breakfast', 'midMorningSnack', 'lunch', 'eveningSnack', 'dinner'];
const SECTION_INFO = {
  breakfast: { label: 'Breakfast', time: '08:00 AM', emoji: '🍳', icon: Coffee },
  midMorningSnack: { label: 'Mid-Morning', time: '11:00 AM', emoji: '🍎', icon: Sun },
  lunch: { label: 'Lunch', time: '01:30 PM', emoji: '🥗', icon: Utensils },
  eveningSnack: { label: 'Evening', time: '05:00 PM', emoji: '☕', icon: Sunset },
  dinner: { label: 'Dinner', time: '08:30 PM', emoji: '🌙', icon: Moon }
};

function getMealName(m) {
  if (typeof m === 'string') return m;
  return m?.name || 'Meal Item';
}

function getMealCalories(m) {
  return m?.calories || m?.nutrients?.calories || 0;
}

// --- UI Components ---

const MealCard = ({ meal, mealType, onLog, isLogged, idx, isLoading }) => {
  const name = getMealName(meal);
  const calories = getMealCalories(meal);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-3 md:p-5 border border-emerald-100/30 shadow-[0_4px_20px_rgb(0,0,0,0.02)] group hover:shadow-xl hover:shadow-emerald-200/50 transition-all flex flex-col h-full min-w-[170px] md:min-w-[320px] snap-start"
    >
      <div className="relative h-28 md:h-48 mb-3 md:mb-5 overflow-hidden rounded-[1rem] md:rounded-[2rem] bg-emerald-50/20">
        <ImageWithFallback
          src={meal.imageUrl}
          query={name}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute top-2 left-2 md:top-4 md:left-4">
          <span className="bg-white/90 backdrop-blur-md px-2 py-1 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest text-[#064e3b] shadow-sm border border-emerald-50/50">
            Option {idx + 1}
          </span>
        </div>
      </div>

      <div className="flex-1">
        <h3 className="text-sm md:text-lg font-bold text-[#064e3b] mb-1 leading-tight line-clamp-1">{name}</h3>
        <p className="text-[10px] md:text-[11px] font-medium text-emerald-800/60 line-clamp-1 mb-3 md:mb-6 leading-relaxed">
          {meal.description || meal.benefits || "Nutrient-rich choice designed for your goals."}
        </p>
      </div>

      <div className="flex items-center gap-1.5 mb-3 md:mb-6 overflow-hidden">
        <div className="flex items-center gap-1 px-2 py-1 bg-orange-50/50 text-orange-600 rounded-full shrink-0">
          <Flame className="w-2.5 h-2.5" />
          <span className="text-[9px] md:text-[11px] font-black">{calories} Cal</span>
        </div>
      </div>

      <button
        onClick={() => onLog(meal, mealType)}
        disabled={isLogged || isLoading}
        className={`w-full py-2.5 md:py-4 rounded-xl md:rounded-2xl text-[9px] md:text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm ${isLogged
          ? 'bg-emerald-600 text-white shadow-emerald-200'
          : 'bg-[#064e3b] text-white hover:bg-[#042f2e] shadow-[#064e3b]/10'
          } ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
      >
        {isLoading ? (
          <RefreshCw className="w-3 h-3 md:w-4 md:h-4 animate-spin" />
        ) : isLogged ? (
          <><Check className="w-3 h-3 md:w-4 md:h-4" /> Eaten</>
        ) : (
          'Log Meal'
        )}
      </button>
    </motion.div>
  );
};

export default function DietPlan() {
  const { user } = useAuth();
  const { 
    invalidateCache, 
    fetchDietPlan, 
    fetchNutritionLogs, 
    fetchHealthGoals,
    healthGoals 
  } = useData();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [activePlan, setActivePlan] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showRegenOptions, setShowRegenOptions] = useState(false);
  const [prefMode, setPrefMode] = useState('save');
  const [loggedMeals, setLoggedMeals] = useState({});
  const [loggingMealId, setLoggingMealId] = useState(null);

  const rowRefs = useRef({});
  const insightsRef = useRef(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // Check for cached plan first
      const cachedPlan = await fetchDietPlan();
      if (cachedPlan) {
        setActivePlan(cachedPlan);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const today = new Date().toISOString().split('T')[0];
      const [plan, logs, historyRes] = await Promise.all([
        fetchDietPlan(),
        fetchNutritionLogs(today),
        dietRecommendationService.getDietPlanHistory(),
        fetchHealthGoals()
      ]);

      if (plan) setActivePlan(plan);
      if (historyRes.data.success) setHistory(historyRes.data.history);

      const loggedMap = {};
      (logs || []).forEach(log => {
        const type = log.mealType;
        const name = log.name || log.foodItems?.[0]?.name;
        loggedMap[`${type}-${name}`] = true;
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
        invalidateCache(['diet_plan', 'dashboard']);
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
    const mealId = `${type}-${mealName}`;
    if (loggedMeals[mealId]) return;

    try {
      setLoggingMealId(mealId);
      // Show analyzing toast
      const analyzeToastId = toast.loading('Analyzing nutrition profile...', { duration: 4000 });

      // 1. Analyze the food to get rich data (AI or Cache)
      const { data: analysisRes } = await api.post('nutrition/analyze-food', {
        foodDescription: mealName
      });

      if (!analysisRes.success) throw new Error('Analysis failed');
      const data = analysisRes.analysis;

      // 2. Log with rich data
      // 2. Log with data from diet plan PREFERRED (for calorie goal consistency) 
      // but enrich with AI analysis findings (benefits, alternatives)
      const todayStr = new Date().toISOString().split('T')[0];
      await nutritionService.logMeal({
        mealType: type,
        foodItems: [{
          name: mealName,
          quantity: data.foodItem?.quantity || meal.portionSize || '1 serving',
          nutrition: {
            calories: meal.calories || data.foodItem?.nutrition?.calories || 200,
            protein: meal.protein || data.foodItem?.nutrition?.protein || 10,
            carbs: meal.carbs || data.foodItem?.nutrition?.carbs || 30,
            fats: meal.fats || data.foodItem?.nutrition?.fats || 5
          }
        }],
        healthScore: data.healthScore || data.foodItem?.healthScore || 80,
        healthScore10: data.healthScore10 || data.foodItem?.healthScore10 || 8,
        micronutrients: data.micronutrients || data.foodItem?.micronutrients || [],
        enhancementTips: data.enhancementTips || data.foodItem?.enhancementTips || [],
        healthBenefitsSummary: meal.benefits || data.healthBenefitsSummary || data.foodItem?.healthBenefitsSummary || '',
        warnings: data.warnings || data.foodItem?.warnings || [],
        alternatives: data.alternatives || data.foodItem?.alternatives || [],
        source: 'meal_plan',
        date: todayStr
      });

      toast.dismiss(analyzeToastId);
      toast.success('Meal logged! Keep it up 🚀');
      setLoggedMeals(prev => ({ ...prev, [mealId]: true }));
      invalidateCache(['dashboard', `logs_${todayStr}`, `nutrition_${todayStr}`]);
      loadInitialData(); // Refresh UI
    } catch (err) {
      console.error("Log meal error:", err);
      toast.error('Failed to log meal');
    } finally {
      setLoggingMealId(null);
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
          {generating ? 'Analyzing Reports, Goals & BMI...' : 'Curating your diet protocol...'}
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
    calories: user?.nutritionGoal?.calorieGoal || healthGoals?.dailyCalorieTarget || activePlan?.nutritionGoals?.dailyCalorieTarget || 2100,
    protein: user?.nutritionGoal?.proteinGoal || healthGoals?.macroTargets?.protein || activePlan?.nutritionGoals?.macroTargets?.protein || 150,
    carbs: user?.nutritionGoal?.carbsGoal || healthGoals?.macroTargets?.carbs || activePlan?.nutritionGoals?.macroTargets?.carbs || 200,
    fats: user?.nutritionGoal?.fatGoal || healthGoals?.macroTargets?.fats || healthGoals?.macroTargets?.fat || activePlan?.nutritionGoals?.macroTargets?.fat || 65
  };

  return (
    <div className="min-h-screen bg-transparent pb-32 px-4 md:px-6 lg:px-12 pt-2 md:pt-8">
      {/* Background elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-100/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Header - Simplified for Global Sticky Header */}
      <div className="relative z-10 flex items-center gap-2 overflow-x-auto scrollbar-hide mb-8 mt-0 md:mt-4">
        <div className="hidden md:flex items-center gap-1.5 bg-white/60 backdrop-blur-md px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-white/60 shadow-sm shrink-0">
          <Calendar className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-800/40" />
          <span className="text-xs md:text-sm font-medium text-emerald-800/60 whitespace-nowrap">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </div>
        <button
          onClick={() => setShowHistory(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 md:px-6 md:py-2 bg-emerald-50/60 backdrop-blur-md rounded-full text-[10px] md:text-sm font-black text-[#064e3b] hover:bg-emerald-50 transition-all border border-emerald-200 shadow-sm shrink-0 uppercase tracking-tighter"
        >
          <Clock className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-800/40" /> History
        </button>
        <button
          onClick={() => {
            setPrefMode('save');
            setShowPreferences(true);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 md:px-6 md:py-2 bg-emerald-50/60 backdrop-blur-md rounded-full text-[10px] md:text-sm font-black text-[#064e3b] hover:bg-emerald-50 transition-all border border-emerald-200 shadow-sm shrink-0 uppercase tracking-tighter"
        >
          <Filter className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-800/40" /> Preference
        </button>
        <button
          onClick={() => setShowRegenOptions(true)}
          disabled={generating}
          className="flex items-center gap-1.5 px-3 py-1.5 md:px-6 md:py-2 bg-[#064e3b] text-emerald-50 rounded-full text-[10px] md:text-sm font-bold md:font-medium hover:bg-[#042f2e] transition-all shadow-lg border border-emerald-900/10 active:scale-95 disabled:opacity-50 shrink-0 uppercase tracking-tighter"
        >
          <RefreshCw className={`w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-400 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Regenerating...' : 'Regen Plan'}
        </button>
      </div>

      {!activePlan ? (
        <div className="bg-white rounded-[3rem] p-12 border border-slate-100 shadow-xl text-center max-w-2xl mx-auto mt-20">
          <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-white shadow-inner">
            <ChefHat className="w-10 h-10 text-slate-400" />
          </div>
          <h2 className="text-3xl font-light text-slate-800 mb-4 tracking-tight">Personalized Nutrition Engine</h2>
          <p className="text-slate-500 mb-10 leading-relaxed text-lg">
            Our AI will analyze your <span className="font-bold text-slate-800">Health Reports</span>, 
            <span className="font-bold text-slate-800"> Fitness Goals</span>, and <span className="font-bold text-slate-800">BMI</span> 
            to curate a clinical-grade diet plan just for you.
          </p>
          <button
            onClick={() => generatePlan(false)}
            disabled={generating}
            className="bg-black text-white px-10 py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl hover:bg-slate-800 transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-3 mx-auto"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            {generating ? 'Synthesizing Data...' : 'Generate My Personalized Plan'}
          </button>
        </div>
      ) : (
        <div className="space-y-12 md:space-y-24">

          {/* Intelligence Context Message */}
          <section className="mt-4 p-4 md:p-6 bg-emerald-50/40 backdrop-blur-md rounded-[1.5rem] md:rounded-[2rem] border border-emerald-100/30 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <h3 className="text-sm md:text-lg font-bold text-[#064e3b] tracking-tight leading-snug">
                  This diet plan is specially designed by considering your health parameters, fitness goals and BMI for optimal results.
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button 
                  onClick={() => insightsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 border border-emerald-100/50 text-[#064e3b] rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-[#064e3b] hover:text-white transition-all shadow-sm active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  View AI Insights
                </button>
              </div>
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
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-[1.25rem] bg-emerald-50/30 flex items-center justify-center border border-emerald-50 shadow-sm overflow-hidden text-lg md:text-2xl">
                      {section.emoji}
                    </div>
                    <div>
                      <h2 className="text-base md:text-2xl font-bold md:font-light tracking-tight text-[#064e3b] uppercase leading-none mb-1">{section.label}</h2>
                      <p className="text-[8px] md:text-[10px] font-black text-emerald-800/30 uppercase tracking-[0.2em]">{section.time}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 md:gap-2">
                    <button
                      onClick={() => rowRefs.current[sectionId]?.scrollBy({ left: -250, behavior: 'smooth' })}
                      className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white border border-emerald-100 flex items-center justify-center hover:bg-emerald-50 transition-all shadow-sm"
                    >
                      <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 text-[#064e3b]" />
                    </button>
                    <button
                      onClick={() => rowRefs.current[sectionId]?.scrollBy({ left: 250, behavior: 'smooth' })}
                      className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white border border-emerald-100 flex items-center justify-center hover:bg-emerald-50 transition-all shadow-sm"
                    >
                      <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-[#064e3b]" />
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
                      isLoading={loggingMealId === `${sectionId}-${getMealName(meal)}`}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {/* AI Insights Bar */}
          <section ref={insightsRef} className="bg-black rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-12 lg:p-16 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px]" />
            <div className="relative z-10 flex flex-col lg:flex-row gap-8 lg:gap-16">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4 md:mb-6">
                  <Sparkles className="w-5 h-5 md:w-8 md:h-8 text-emerald-400" />
                  <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-slate-400">Dietary Intelligence</span>
                </div>
                <h2 className="text-2xl md:text-3xl lg:text-4xl font-light mb-6 md:mb-8 leading-tight tracking-tight">AI Insights based on your health profile</h2>
                <div className="grid grid-cols-1 gap-3 md:gap-4">
                  {(activePlan.lifestyleRecommendations || ["Balance carbs with fiber.", "Hydrate 30m before breakfast.", "Avoid caffeine after 4pm."]).slice(0, 3).map((rec, i) => (
                    <div key={i} className="flex items-start gap-4 py-1 group transition-colors">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                      </div>
                      <p className="text-slate-300 font-medium leading-relaxed text-sm md:text-base">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:w-1/3 w-full pt-8 lg:pt-0 border-t lg:border-t-0 lg:border-l border-white/10 lg:pl-12">
                <div className="flex flex-col gap-6">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <AlertCircle className="w-5 h-5 text-rose-500" />
                      <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">Restricted Foods</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(activePlan.avoidSuggestions || ["Refined Sugar", "Processed Meats", "Soda", "High Sodium Snacks"]).map((food, i) => (
                        <span key={i} className="px-3 py-1.5 bg-rose-500/10 text-rose-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-rose-500/20">
                          {food}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                    Based on your latest records, avoiding these will improve your {user?.nutritionGoal?.goal?.replace('_', ' ') || 'metabolic health'}.
                  </p>
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
