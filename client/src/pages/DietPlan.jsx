import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { healthService, nutritionService } from '../services/api';
import {
  Heart, Clock, ArrowLeft, Flame, Target,
  AlertCircle, Sparkles, CheckCircle, Lightbulb, X, UtensilsCrossed, Utensils
} from 'lucide-react';
import toast from 'react-hot-toast';
import FoodPreferences from '../components/FoodPreferences';

// Helper Functions
function getFoodEmoji(mealName, mealType) {
  const n = (mealName || '').toLowerCase();
  const map = [
    { q: ['idli'], e: '🫓' },
    { q: ['dosa'], e: '🥞' },
    { q: ['upma', 'poha'], e: '🥣' },
    { q: ['paratha', 'chapati', 'roti'], e: '🫓' },
    { q: ['oat', 'porridge'], e: '🥣' },
    { q: ['egg'], e: '🥚' },
    { q: ['sandwich', 'toast', 'bread'], e: '🥪' },
    { q: ['smoothie', 'shake'], e: '🥤' },
    { q: ['dal', 'lentil'], e: '🍲' },
    { q: ['rice', 'biryani'], e: '🍚' },
    { q: ['chicken'], e: '🍗' },
    { q: ['fish'], e: '🐟' },
    { q: ['paneer', 'tofu'], e: '🧀' },
    { q: ['salad'], e: '🥗' },
    { q: ['soup'], e: '🍜' },
    { q: ['curry'], e: '🍛' },
    { q: ['nut', 'almond'], e: '🥜' },
    { q: ['yogurt', 'curd'], e: '🥛' },
    { q: ['fruit', 'apple', 'banana'], e: '🍎' },
  ];
  for (const { q, e } of map) {
    if (q.some(w => n.includes(w))) return e;
  }
  const defaults = { breakfast: '🌅', lunch: '🍽️', snacks: '🍎', dinner: '🌙' };
  return defaults[mealType] || '🍽️';
}

const MEAL_ORDER = ['breakfast', 'lunch', 'snacks', 'dinner'];
const SECTION_INFO = {
  breakfast: { label: 'Breakfast', time: '7:00 – 9:00 AM', emoji: '☀️' },
  lunch: { label: 'Lunch', time: '12:00 – 2:00 PM', emoji: '🥗' },
  snacks: { label: 'Snacks', time: 'Anytime', emoji: '🍎' },
  dinner: { label: 'Dinner', time: '7:00 – 9:00 PM', emoji: '🌙' },
};

function getMealName(m) {
  if (typeof m === 'string') return m;
  return String(m?.name || m?.meal || 'Meal');
}

function getMealCalories(m) {
  if (typeof m === 'string') return null;
  const c = m?.nutrients?.calories || m?.calories;
  return c ? String(c) : null;
}

function getMealDesc(m) {
  if (typeof m === 'string') return '';
  return String(m?.description || m?.tip || '');
}

// Macro Card Component
function MacroCard({ label, value, unit, color, emoji }) {
  return (
    <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
      <div className="text-xl sm:text-2xl mb-1 sm:mb-2">{emoji}</div>
      <p className="text-xl sm:text-2xl font-black text-slate-800 leading-none">{value || '—'}</p>
      <p className="text-[8px] sm:text-xs text-slate-500 font-bold uppercase mt-1">{unit}</p>
      <p className="text-[9px] sm:text-xs font-black uppercase mt-1 opacity-80" style={{ color }}>{label}</p>
    </div>
  );
}

// Log Food Modal Component
function LogFoodModal({ meal, mealType, onClose, onLogged }) {
  const mealName = getMealName(meal);
  const cal = getMealCalories(meal) || '200';
  const [form, setForm] = useState({
    name: mealName,
    calories: cal,
    protein: '10',
    carbs: '25',
    fats: '8',
    mealType: mealType === 'snacks' ? 'snack' : mealType,
  });
  const [logging, setLogging] = useState(false);

  const handleLog = async () => {
    setLogging(true);
    try {
      await nutritionService.logMeal({
        mealType: form.mealType,
        foodItems: [{
          name: form.name,
          quantity: '1 serving',
          nutrition: {
            calories: Number(form.calories),
            protein: Number(form.protein),
            carbs: Number(form.carbs),
            fats: Number(form.fats)
          }
        }],
        source: 'meal_plan',
      });
      toast.success(`${form.name} logged successfully! 🎉`);
      onLogged();
      onClose();
    } catch (e) {
      toast.error('Failed to log food');
    } finally {
      setLogging(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-black text-slate-800">Log Food</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <input
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 font-bold"
            placeholder="Food name"
          />

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Calories', key: 'calories', emoji: '🔥' },
              { label: 'Protein (g)', key: 'protein', emoji: '💪' },
              { label: 'Carbs (g)', key: 'carbs', emoji: '🌾' },
              { label: 'Fats (g)', key: 'fats', emoji: '🥑' },
            ].map(f => (
              <div key={f.key} className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 font-bold mb-1">{f.emoji} {f.label}</p>
                <input
                  type="number"
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full text-lg font-black bg-transparent border-none outline-none"
                />
              </div>
            ))}
          </div>

          <button
            onClick={handleLog}
            disabled={logging}
            className="w-full bg-[#2FC8B9] text-white py-3 rounded-xl font-black uppercase text-sm disabled:opacity-50"
          >
            {logging ? 'Logging...' : 'Log Meal'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Component
export default function DietPlan() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [personalizedPlan, setPersonalizedPlan] = useState(null);
  const [planHistory, setPlanHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [supplementRecommendations, setSupplementRecommendations] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [activeSection, setActiveSection] = useState('all');
  const [logModal, setLogModal] = useState(null);
  const [likedMeals, setLikedMeals] = useState({});
  const [loggedMeals, setLoggedMeals] = useState({});
  const [showFoodPreferences, setShowFoodPreferences] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchPersonalizedPlan();
    fetchSupplementRecommendations();
    fetchPlanHistory();
  }, []);

  // Calculate total daily nutrition (PRIORITIZE Profile Fitness Goals)
  const totalDailyNutrition = {
    calories: user?.nutritionGoal?.calorieGoal || personalizedPlan?.nutritionGoals?.dailyCalorieTarget || personalizedPlan?.dailyCalorieTarget || 2000,
    protein: user?.nutritionGoal?.proteinGoal || personalizedPlan?.nutritionGoals?.macroTargets?.protein || personalizedPlan?.macroTargets?.protein || 150,
    carbs: user?.nutritionGoal?.carbsGoal || personalizedPlan?.nutritionGoals?.macroTargets?.carbs || personalizedPlan?.macroTargets?.carbs || 250,
    fats: user?.nutritionGoal?.fatGoal || personalizedPlan?.nutritionGoals?.macroTargets?.fat || personalizedPlan?.macroTargets?.fats || 65
  };

  const fetchPersonalizedPlan = async () => {
    try {
      const { data } = await api.get('/diet-recommendations/diet-plan/active');
      if (data.success && data.dietPlan) {
        const dp = data.dietPlan;
        if (dp.mealPlan && !dp.mealPlan.snacks) {
          dp.mealPlan.snacks = [
            ...(Array.isArray(dp.mealPlan.midMorningSnack) ? dp.mealPlan.midMorningSnack : []),
            ...(Array.isArray(dp.mealPlan.eveningSnack) ? dp.mealPlan.eveningSnack : [])
          ];
        }
        setPersonalizedPlan(dp);
      }
    } catch (err) {
      if (err.response?.status !== 404) console.error('Error fetching diet plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanHistory = async () => {
    try {
      const { data } = await api.get('/diet-recommendations/diet-plan/history');
      if (data.success) {
        setPlanHistory(data.history || []);
      }
    } catch (err) {
      console.error('History fetch error:', err);
    }
  };

  const fetchSpecificPlan = async (planId) => {
    setLoading(true);
    setShowHistory(false);
    try {
      const { data } = await api.get(`/diet-recommendations/diet-plan/${planId}`);
      if (data.success) {
        setPersonalizedPlan(data.dietPlan);
        toast.success('Viewing selected plan');
      }
    } catch (err) {
      toast.error('Failed to load plan');
    } finally {
      setLoading(false);
    }
  };

  const fetchSupplementRecommendations = async () => {
    try {
      const { data } = await api.get('/diet-recommendations/supplements/active');
      if (data.success && data.recommendations) {
        setSupplementRecommendations(data.recommendations);
      }
    } catch (err) {
      if (err.response?.status !== 404) console.error('Error fetching supplements:', err);
    }
  };

  const generateAIPlan = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post('/diet-recommendations/diet-plan/generate');
      if (data.success) {
        toast.success('Diet plan generated successfully!');
        fetchPersonalizedPlan();
        fetchPlanHistory();
      } else {
        toast.error(data.message || 'Failed to generate plan');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error generating diet plan');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2FC8B9]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-24">
      <div className="w-full px-4 pt-4">

        <div className="flex flex-col sm:flex-row items-center justify-between mb-6 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm relative gap-4">
          <div className="flex items-center justify-between w-full sm:w-auto gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#2FC8B9]/10 flex items-center justify-center">
                <Target className="w-6 h-6 text-[#2FC8B9]" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-black uppercase tracking-tight leading-none">Diet Plan</h1>
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                  Smart Nutrition Roadmap
                </p>
              </div>
            </div>

            {/* Mobile History Button - visible only on mobile inside this sub-flex if needed, or just keep it responsive */}
            {planHistory.length > 0 && (
              <div className="sm:hidden relative">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="p-2 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-all border border-slate-200"
                >
                  <Clock className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* Plan History Dropdown - Desktop */}
            {planHistory.length > 0 && (
              <div className="hidden sm:block relative">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 hover:bg-slate-200 transition-all border border-slate-200"
                >
                  <Clock className="w-3.5 h-3.5" />
                  History
                </button>
                {showHistory && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="p-3 bg-slate-50 border-b border-slate-100">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Recent Plans</p>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {planHistory.map((plan) => (
                        <button
                          key={plan._id}
                          onClick={() => fetchSpecificPlan(plan._id)}
                          className={`w-full text-left p-4 hover:bg-slate-50 flex items-center justify-between border-b border-slate-50 last:border-0 ${personalizedPlan?._id === plan._id ? 'bg-[#2FC8B9]/10 text-[#2FC8B9]' : ''}`}
                        >
                          <div>
                            <p className="text-xs font-black">
                              {new Date(plan.generatedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-[10px] opacity-60 font-bold uppercase mt-0.5">
                              {plan.nutritionGoals?.dailyCalorieTarget || '2000'} kcal goal
                            </p>
                          </div>
                          {plan.isActive && (
                            <div className="w-2 h-2 rounded-full bg-[#2FC8B9]"></div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Show Mobile History Dropdown if open */}
            {showHistory && planHistory.length > 0 && (
              <div className="sm:hidden absolute top-full left-4 right-4 mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 z-[60] overflow-hidden max-h-[300px] overflow-y-auto">
                <div className="p-3 bg-slate-50 border-b border-slate-100">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">History</p>
                </div>
                {planHistory.map((plan) => (
                  <button
                    key={plan._id}
                    onClick={() => fetchSpecificPlan(plan._id)}
                    className={`w-full text-left p-4 hover:bg-slate-50 flex items-center justify-between border-b border-slate-100 last:border-0 ${personalizedPlan?._id === plan._id ? 'bg-[#2FC8B9]/10 text-[#2FC8B9]' : ''}`}
                  >
                    <p className="text-xs font-black">
                      {new Date(plan.generatedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-[10px] font-bold uppercase">{plan.nutritionGoals?.dailyCalorieTarget || '2000'} kcal</p>
                  </button>
                ))}
              </div>
            )}

            {personalizedPlan && (
              <button
                onClick={generateAIPlan}
                disabled={generating}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all disabled:opacity-50 shadow-lg shadow-black/10"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#2FC8B9]" />
                <span>{generating ? 'Processing...' : 'Regen'}</span>
              </button>
            )}
            <button
              onClick={() => setShowFoodPreferences(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-[#2FC8B9] text-white rounded-xl font-bold text-xs hover:bg-[#25a89b] transition-all shadow-lg shadow-[#2FC8B9]/10"
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Prefs</span>
            </button>
          </div>
        </div>

        {/* No Plan State */}
        {!personalizedPlan && (
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl mb-8">
            <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
              <div className="w-20 h-20 rounded-2xl bg-[#2FC8B9]/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-10 h-10 text-[#2FC8B9]" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Generate Your Diet Plan</h2>
                <p className="text-slate-500 font-bold text-sm uppercase tracking-widest leading-relaxed">
                  {!user?.nutritionGoal?.goal && !user?.hasReports
                    ? "Set your fitness goals or upload a health report to get a hyper-personalized diet plan."
                    : "Create a personalized diet plan based on your custom food preferences, health reports, and fitness goals."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
                  {!user?.nutritionGoal?.goal && (
                    <Link to="/profile?tab=goals" className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold uppercase hover:bg-slate-200">
                      + Set Fitness Goal
                    </Link>
                  )}
                  {/* Assuming hasReports is a boolean we might not have on user context, we rely on the backend */}
                  <button onClick={() => setShowFoodPreferences(true)} className="px-3 py-1 bg-slate-100 text-[#2FC8B9] rounded-lg text-[10px] font-black uppercase hover:bg-slate-200 flex items-center gap-1.5 transition-all">
                    <Utensils className="w-3.5 h-3.5" />
                    Set Meal Favorites
                  </button>
                </div>
              </div>
              <button
                onClick={generateAIPlan}
                disabled={generating}
                className="px-8 py-4 bg-[#2FC8B9] text-white rounded-2xl font-black uppercase text-sm shadow-lg disabled:opacity-50 hover:bg-[#25a89b] transition-colors shrink-0"
              >
                {generating ? 'Generating...' : 'Generate Plan'}
              </button>
            </div>
          </div>
        )}

        {/* Diet Plan Content */}
        {personalizedPlan && (
          <div className="flex flex-col lg:flex-row gap-8">

            {/* Bio-Protocol Section - NOW FIRST */}
            <div className="lg:w-[400px] space-y-6 order-1">

              {/* Recommended Targets Section */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-black text-black uppercase tracking-tight">Fitness Goal Targets</h2>
                  <Link
                    to="/profile?tab=goals"
                    className="text-xs font-black text-[#2FC8B9] hover:text-black uppercase tracking-widest"
                  >
                    Adjust Goal
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <MacroCard label="CALORIES" value={Math.round(totalDailyNutrition.calories)} unit="kcal" color="#2FC8B9" emoji="🔥" />
                  <MacroCard label="PROTEIN" value={Math.round(totalDailyNutrition.protein)} unit="g" color="#1A1A2E" emoji="🍗" />
                  <MacroCard label="CARBS" value={Math.round(totalDailyNutrition.carbs)} unit="g" color="#3B82F6" emoji="🌾" />
                  <MacroCard label="FATS" value={Math.round(totalDailyNutrition.fats)} unit="g" color="#F59E0B" emoji="🥑" />
                </div>
                {!user?.nutritionGoal?.calorieGoal && (
                  <p className="mt-4 text-[10px] text-slate-400 font-black uppercase text-center border-t border-slate-50 pt-3">
                    ⚠️ Showing general targets. Set profile goals for best sync.
                  </p>
                )}
              </div>

              {/* Supplements */}
              {supplementRecommendations?.supplements?.length > 0 && (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl">
                  <h2 className="text-lg font-black text-black uppercase tracking-tight mb-4">Supplements</h2>
                  <div className="space-y-3">
                    {supplementRecommendations.supplements.slice(0, 3).map((s, i) => (
                      <div key={i} className="bg-slate-50 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-black text-black uppercase">{s.name}</span>
                          <span className={`text-xs font-black px-2 py-1 rounded-full uppercase ${s.priority === 'high' ? 'bg-rose-100 text-rose-600' : 'bg-[#2FC8B9]/10 text-[#2FC8B9]'
                            }`}>
                            {s.priority}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-bold mb-2">{s.reason}</p>
                        <div className="flex gap-2">
                          <span className="px-3 py-1 bg-white rounded-lg text-xs font-black text-slate-600">
                            {s.dosage}
                          </span>
                          <span className="px-3 py-1 bg-white rounded-lg text-xs font-black text-slate-600">
                            {s.timing}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Insights */}
              {personalizedPlan.lifestyleRecommendations?.length > 0 && (
                <div className="bg-black rounded-3xl p-6 text-white">
                  <div className="flex items-center gap-3 mb-4">
                    <Lightbulb className="w-6 h-6 text-[#2FC8B9]" />
                    <h2 className="text-xl font-black uppercase tracking-tight">Insights</h2>
                  </div>
                  <div className="space-y-3">
                    {personalizedPlan.lifestyleRecommendations.map((tip, idx) => (
                      <div key={idx} className="flex gap-3 items-start">
                        <CheckCircle className="w-4 h-4 text-[#2FC8B9] shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-400 font-bold leading-relaxed">{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Smart Suggestions: What to Avoid */}
              {personalizedPlan.avoidSuggestions?.length > 0 && (
                <div className="bg-rose-50 rounded-3xl p-6 border border-rose-100">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertCircle className="w-6 h-6 text-rose-600" />
                    <h2 className="text-xl font-black uppercase tracking-tight text-rose-900">What to Avoid</h2>
                  </div>
                  <div className="space-y-3">
                    {personalizedPlan.avoidSuggestions.map((suggestion, idx) => (
                      <div key={idx} className="flex gap-3 items-start">
                        <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-rose-800 font-bold leading-relaxed">{suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Meal Sections - NOW SECOND */}
            <div className="flex-1 space-y-6 order-2">

              {/* Meal Filter Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {[{ id: 'all', label: 'All Meals', emoji: '🍽️' }, ...MEAL_ORDER.map(id => ({
                  id, label: SECTION_INFO[id].label, emoji: SECTION_INFO[id].emoji
                }))].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSection(tab.id)}
                    className={`whitespace-nowrap px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeSection === tab.id
                      ? 'bg-[#2FC8B9] text-white shadow-lg'
                      : 'bg-white text-slate-400 border border-slate-100'
                      }`}
                  >
                    {tab.emoji} {tab.label}
                  </button>
                ))}
              </div>

              {/* Meal Cards */}
              <div className="space-y-8">
                {MEAL_ORDER.map(section => {
                  if (activeSection !== 'all' && activeSection !== section) return null;
                  const meals = personalizedPlan.mealPlan?.[section] || [];
                  if (meals.length === 0) return null;
                  const info = SECTION_INFO[section];

                  return (
                    <div key={section}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-2xl">
                            {info.emoji}
                          </div>
                          <div>
                            <h2 className="text-xl font-black text-black uppercase">{info.label}</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase">{info.time}</p>
                          </div>
                        </div>
                        <span className="bg-[#2FC8B9]/10 text-[#2FC8B9] px-3 py-1 rounded-full text-xs font-black uppercase">
                          {meals.length} Items
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {meals.slice(0, 3).map((mealItem, idx) => {
                          const name = getMealName(mealItem);
                          const calories = getMealCalories(mealItem);
                          const desc = getMealDesc(mealItem);
                          const mealKey = `${section}-${idx}`;
                          const isLiked = likedMeals[mealKey];
                          const isLogged = loggedMeals[mealKey];

                          return (
                            <div
                              key={mealKey}
                              className="bg-white rounded-3xl border border-slate-100 p-5 hover:shadow-xl transition-all relative pt-8 mt-4"
                            >
                              {/* Option Badge */}
                              <div className="absolute -top-3 left-6">
                                <span className="bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
                                  Option {idx + 1}
                                </span>
                              </div>

                              <button
                                onClick={() => setLikedMeals(p => ({ ...p, [mealKey]: !p[mealKey] }))}
                                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center"
                              >
                                <Heart className={`w-4 h-4 ${isLiked ? 'text-rose-500 fill-rose-500' : 'text-slate-300'}`} />
                              </button>

                              <div className="flex gap-4 mb-4">
                                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-3xl shrink-0">
                                  {getFoodEmoji(name, section)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-base font-black text-black leading-tight mb-1">{name}</h3>
                                  {desc && <p className="text-xs text-slate-500 font-bold line-clamp-2">{desc}</p>}
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                <div className="flex gap-3">
                                  <div className="flex items-center gap-1 text-xs font-black text-slate-400">
                                    <Clock className="w-3 h-3" /> 15 min
                                  </div>
                                  {calories && (
                                    <div className="flex items-center gap-1 text-xs font-black text-[#2FC8B9]">
                                      <Flame className="w-3 h-3" /> {calories} kcal
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => setLogModal({ meal: mealItem, mealType: section })}
                                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase ${isLogged
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : 'bg-black text-white hover:bg-[#2FC8B9]'
                                    }`}
                                >
                                  {isLogged ? 'Logged' : 'Log'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Refinement Section */}
                <div className="bg-white rounded-3xl p-8 border-2 border-dashed border-slate-200 text-center mt-12">
                  <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-[#2FC8B9]" />
                  </div>
                  <h3 className="text-xl font-black text-black uppercase tracking-tight mb-2">Not satisfied with this plan?</h3>
                  <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-6 max-w-sm mx-auto">
                    If these meals are too expensive or not your style, add more favorites to get a better match.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => setShowFoodPreferences(true)}
                      className="px-6 py-3 bg-slate-100 text-[#2FC8B9] rounded-xl text-xs font-black uppercase hover:bg-slate-200 flex items-center gap-2 transition-all"
                    >
                      <Utensils className="w-4 h-4" />
                      Add Favorite Foods
                    </button>
                    <button
                      onClick={generateAIPlan}
                      disabled={generating}
                      className="px-6 py-3 bg-black text-white rounded-xl text-xs font-black uppercase hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2 transition-all shadow-lg"
                    >
                      {generating ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          Regenerating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-[#2FC8B9]" />
                          Regenerate Plan
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Log Modal */}
      {logModal && (
        <LogFoodModal
          meal={logModal.meal}
          mealType={logModal.mealType}
          onClose={() => setLogModal(null)}
          onLogged={() => {
            const key = `${logModal.mealType}-logged`;
            setLoggedMeals(p => ({ ...p, [key]: true }));
          }}
        />
      )}

      {/* Food Preferences Modal */}
      {showFoodPreferences && (
        <FoodPreferences onClose={() => setShowFoodPreferences(false)} />
      )}
    </div>
  );
}
