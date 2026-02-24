import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { healthService, nutritionService } from '../services/api';
import {
  Heart, Clock, ArrowLeft, Flame, Target,
  AlertCircle, Sparkles, Search, FileText, TrendingUp,
  Leaf, Zap, Bell, Filter, CheckCircle, Lightbulb,
  BookOpen, X
} from 'lucide-react';
import toast from 'react-hot-toast';

function getFoodEmoji(mealName, mealType) {
  const n = (mealName || '').toLowerCase();
  const map = [
    { q: ['idli'], e: String.fromCodePoint(0x1FAD3) },
    { q: ['dosa'], e: String.fromCodePoint(0x1F95E) },
    { q: ['upma', 'poha'], e: String.fromCodePoint(0x1F963) },
    { q: ['paratha', 'chapati', 'roti', 'jowar', 'bajra', 'ragi', 'chilla', 'cheela'], e: String.fromCodePoint(0x1FAD3) },
    { q: ['oat', 'porridge'], e: String.fromCodePoint(0x1F963) },
    { q: ['egg', 'omelette', 'scrambled', 'boiled'], e: String.fromCodePoint(0x1F95A) },
    { q: ['sandwich', 'toast', 'bread'], e: String.fromCodePoint(0x1F96A) },
    { q: ['smoothie', 'shake'], e: String.fromCodePoint(0x1F964) },
    { q: ['pancake', 'waffle'], e: String.fromCodePoint(0x1F95E) },
    { q: ['moong', 'besan'], e: String.fromCodePoint(0x1FAD8) },
    { q: ['dal', 'daal', 'lentil', 'rasam'], e: String.fromCodePoint(0x1F372) },
    { q: ['rice', 'biryani', 'pulao', 'khichdi'], e: String.fromCodePoint(0x1F35A) },
    { q: ['chicken', 'murgh'], e: String.fromCodePoint(0x1F357) },
    { q: ['fish', 'salmon', 'tuna', 'pomfret'], e: String.fromCodePoint(0x1F41F) },
    { q: ['mutton', 'lamb'], e: String.fromCodePoint(0x1F969) },
    { q: ['paneer', 'cottage', 'tofu'], e: String.fromCodePoint(0x1F9C0) },
    { q: ['salad', 'slaw', 'greens'], e: String.fromCodePoint(0x1F957) },
    { q: ['soup', 'broth', 'shorba'], e: String.fromCodePoint(0x1F35C) },
    { q: ['curry', 'sabji', 'sabzi', 'bhaji'], e: String.fromCodePoint(0x1F35B) },
    { q: ['wrap', 'roll', 'frankie'], e: String.fromCodePoint(0x1F32F) },
    { q: ['nut', 'almond', 'walnut', 'cashew', 'makhana'], e: String.fromCodePoint(0x1F95C) },
    { q: ['yogurt', 'curd', 'dahi', 'raita', 'lassi', 'buttermilk', 'chaas'], e: String.fromCodePoint(0x1F95B) },
    { q: ['fruit', 'apple', 'guava', 'orange', 'banana', 'papaya', 'mango', 'jamun'], e: String.fromCodePoint(0x1F34E) },
    { q: ['chana', 'sprout', 'chickpea', 'rajma'], e: String.fromCodePoint(0x1FAD8) },
    { q: ['karela', 'bitter', 'gourd', 'methi', 'spinach', 'palak'], e: String.fromCodePoint(0x1F96C) },
    { q: ['tea', 'chai', 'coffee'], e: String.fromCodePoint(0x2615) },
    { q: ['bowl', 'quinoa', 'grain'], e: String.fromCodePoint(0x1F963) },
  ];
  for (const { q, e } of map) {
    if (q.some(w => n.includes(w))) return e;
  }
  const d = { breakfast: String.fromCodePoint(0x1F305), lunch: String.fromCodePoint(0x1F37D, 0xFE0F), snacks: String.fromCodePoint(0x1F34E), dinner: String.fromCodePoint(0x1F319) };
  return d[mealType] || String.fromCodePoint(0x1F37D, 0xFE0F);
}
const MEAL_ORDER = ['breakfast', 'lunch', 'snacks', 'dinner'];

const SECTION_INFO = {
  breakfast: { label: 'Breakfast', time: '7:00 – 9:00 AM', emoji: '☀️', bg: 'linear-gradient(135deg,#FFF9C4,#FFF176)' },
  lunch: { label: 'Lunch', time: '12:00 – 2:00 PM', emoji: '🥗', bg: 'linear-gradient(135deg,#E8F5E9,#C8E6C9)' },
  snacks: { label: 'Snacks', time: 'Anytime', emoji: '🍎', bg: 'linear-gradient(135deg,#FFF3E0,#FFE0B2)' },
  dinner: { label: 'Dinner', time: '7:00 – 9:00 PM', emoji: '🌙', bg: 'linear-gradient(135deg,#E8EAF6,#C5CAE9)' },
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
function getMealProtein(m) {
  if (typeof m === 'string') return null;
  const p = m?.nutrients?.protein || m?.protein;
  return p ? String(p) : null;
}
function getMealDesc(m) {
  if (typeof m === 'string') return '';
  return String(m?.description || m?.tip || '');
}

// ─── Log Food Modal ───────────────────────────────────────────────────────────
function LogFoodModal({ meal, mealType, onClose, onLogged }) {
  const mealName = getMealName(meal);
  const cal = getMealCalories(meal) || '200';
  const protein = getMealProtein(meal) || '10';
  const [form, setForm] = useState({
    name: mealName,
    calories: cal,
    protein: protein,
    carbs: typeof meal === 'object' ? (meal?.nutrients?.carbs || meal?.carbs || '25') : '25',
    fats: typeof meal === 'object' ? (meal?.nutrients?.fats || meal?.fats || '8') : '8',
    mealType: mealType === 'snacks' ? 'snack' : mealType,
    quantity: 1,
    unit: 'serving',
  });
  const [logging, setLogging] = useState(false);

  const handleLog = async () => {
    setLogging(true);
    try {
      await nutritionService.logMeal({
        foodName: form.name,
        calories: Number(form.calories),
        protein: Number(form.protein),
        carbs: Number(form.carbs),
        fats: Number(form.fats),
        mealType: form.mealType,
        quantity: Number(form.quantity),
        unit: form.unit,
        source: 'meal_plan',
      });
      toast.success(`${form.name} logged to ${form.mealType}! 🎉`);
      onLogged();
      onClose();
    } catch (e) {
      toast.error('Failed to log food. Please try again.');
    } finally {
      setLogging(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: '28px 28px 0 0', padding: 24, width: '100%', maxWidth: 480,
        animation: 'slideUp 0.3s ease'
      }} onClick={e => e.stopPropagation()}>
        <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
        {/* Handle */}
        <div style={{ width: 40, height: 4, background: '#E5E7EB', borderRadius: 2, margin: '0 auto 20px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1A1A2E', margin: 0 }}>Log Food</h3>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '3px 0 0' }}>Add to your nutrition log</p>
          </div>
          <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} color="#374151" />
          </button>
        </div>

        {/* Food Illustration + Name */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 20, alignItems: 'center' }}>
          <div style={{ width: 70, height: 70, borderRadius: 16, background: "#F5F5F5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, flexShrink: 0, border: "2px solid #EEEEEE", animation: "foodBounce 1s ease-in-out infinite alternate" }}>
            {getFoodEmoji(mealName, mealType)}
          </div>
          <div style={{ flex: 1 }}>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E', border: 'none', outline: 'none', background: 'transparent', width: '100%' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {['breakfast', 'lunch', 'snack', 'dinner'].map(t => (
                <button key={t} onClick={() => setForm(p => ({ ...p, mealType: t }))}
                  style={{
                    padding: '3px 10px', borderRadius: 50, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                    background: form.mealType === t ? '#c084fc' : '#F3F4F6',
                    color: form.mealType === t ? 'white' : '#6B7280'
                  }}>{t}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Nutrition inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Calories (kcal)', key: 'calories', emoji: '🔥' },
            { label: 'Protein (g)', key: 'protein', emoji: '💪' },
            { label: 'Carbs (g)', key: 'carbs', emoji: '🌾' },
            { label: 'Fats (g)', key: 'fats', emoji: '🥑' },
          ].map(f => (
            <div key={f.key} style={{ background: '#F9FAFB', borderRadius: 14, padding: '10px 14px' }}>
              <p style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, margin: '0 0 4px' }}>{f.emoji} {f.label}</p>
              <input
                type="number"
                value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                style={{ fontSize: 18, fontWeight: 800, color: '#1A1A2E', border: 'none', outline: 'none', background: 'transparent', width: '100%' }}
              />
            </div>
          ))}
        </div>

        <button onClick={handleLog} disabled={logging}
          style={{
            width: '100%', background: 'linear-gradient(135deg,#c084fc,#fb923c)', color: 'white', border: 'none',
            borderRadius: 50, padding: '14px', fontWeight: 800, fontSize: 16, cursor: logging ? 'not-allowed' : 'pointer',
            opacity: logging ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 6px 20px rgba(192,132,252,0.4)'
          }}>
          {logging
            ? <><div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />Logging...</>
            : <><CheckCircle size={18} />Log This Meal</>
          }
        </button>
      </div>
    </div>
  );
}

// ─── Macro Card ───────────────────────────────────────────────────────────────
function MacroCard({ label, value, unit, gradient, emoji }) {
  return (
    <div style={{
      background: 'white', borderRadius: 18, padding: '14px 8px', textAlign: 'center',
      boxShadow: '0 2px 10px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: gradient, borderRadius: '18px 18px 0 0' }} />
      <div style={{ fontSize: 22, marginBottom: 4, marginTop: 2 }}>{emoji}</div>
      <p style={{ fontSize: 18, fontWeight: 900, color: '#1A1A2E', margin: '0 0 1px', lineHeight: 1 }}>{value || '—'}</p>
      <p style={{ fontSize: 9, color: '#9CA3AF', margin: '0 0 2px', fontWeight: 700, textTransform: 'uppercase' }}>{unit}</p>
      <p style={{ fontSize: 10, color: '#6B7280', margin: 0, fontWeight: 700 }}>{label}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DietPlan() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [personalizedPlan, setPersonalizedPlan] = useState(null);
  const [supplementRecommendations, setSupplementRecommendations] = useState(null);
  const [allReports, setAllReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [hasNutritionGoal, setHasNutritionGoal] = useState(false);
  const [nutritionGoal, setNutritionGoal] = useState(null);
  const [isPlanOutdated, setIsPlanOutdated] = useState(false);
  const [activeSection, setActiveSection] = useState('all');
  const [likedMeals, setLikedMeals] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [logModal, setLogModal] = useState(null); // {meal, mealType}
  const [loggedMeals, setLoggedMeals] = useState({});

  useEffect(() => {
    window.scrollTo(0, 0);
    checkNutritionGoal();
    fetchAllReports();
    fetchPersonalizedPlan();
    fetchSupplementRecommendations();
  }, []);

  useEffect(() => {
    if (nutritionGoal && personalizedPlan?.generatedAt) {
      const planDate = new Date(personalizedPlan.generatedAt);
      const goalDate = new Date(nutritionGoal.updatedAt || nutritionGoal.createdAt);
      setIsPlanOutdated(goalDate > planDate);
    }
  }, [nutritionGoal, personalizedPlan]);

  useEffect(() => { if (selectedReportId) fetchReportDietPlan(selectedReportId); }, [selectedReportId]);

  const checkNutritionGoal = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/nutrition/goals', { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 404) { setHasNutritionGoal(false); return; }
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.healthGoal?.goalType) {
          setHasNutritionGoal(true); setNutritionGoal(data.healthGoal);
        } else setHasNutritionGoal(false);
      }
    } catch { setHasNutritionGoal(false); }
  };

  const fetchAllReports = async () => {
    try {
      const { data } = await healthService.getReports();
      const reports = Array.isArray(data) ? data : (data.reports || []);
      const filtered = reports.filter(r => r.aiAnalysis?.dietPlan);
      setAllReports(filtered);
      if (filtered.length > 0 && !selectedReportId) setSelectedReportId(filtered[0]._id);
    } catch { } finally { setLoading(false); }
  };

  const fetchReportDietPlan = async (reportId) => {
    try {
      setLoading(true);
      const { data } = await healthService.getReport(reportId);
      const report = data.report;
      if (!report.aiAnalysis?.dietPlan) { setPersonalizedPlan(null); return; }
      const dp = report.aiAnalysis.dietPlan;
      let macroTargets = { protein: 150, carbs: 250, fats: 65 };
      let dailyCalorieTarget = 2000;
      let hasGoals = false;
      try {
        const token = localStorage.getItem('token');
        const gr = await fetch('/api/nutrition/goals', { headers: { Authorization: `Bearer ${token}` } });
        const gd = await gr.json();
        if (gd.healthGoal) { dailyCalorieTarget = gd.healthGoal.dailyCalorieTarget || 2000; macroTargets = gd.healthGoal.macroTargets || macroTargets; hasGoals = true; }
      } catch { }
      setPersonalizedPlan({
        mealPlan: {
          breakfast: Array.isArray(dp.breakfast) ? dp.breakfast : [],
          lunch: Array.isArray(dp.lunch) ? dp.lunch : [],
          snacks: Array.isArray(dp.snacks) ? dp.snacks : [],
          dinner: Array.isArray(dp.dinner) ? dp.dinner : [],
        },
        dailyCalorieTarget, macroTargets, hasGoals,
        keyFoods: [],
        lifestyleRecommendations: Array.isArray(dp.tips) ? dp.tips : [],
        createdAt: report.createdAt, source: 'report', reportId,
      });
    } catch { setPersonalizedPlan(null); toast.error('Failed to load diet plan from report'); }
    finally { setLoading(false); }
  };

  const fetchPersonalizedPlan = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/diet-recommendations/diet-plan/active', { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 404) return;
      const data = await res.json();
      if (data.success && data.dietPlan) setPersonalizedPlan(data.dietPlan);
    } catch { }
  };

  const fetchSupplementRecommendations = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/diet-recommendations/supplements/active', { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 404) return;
      const data = await res.json();
      if (data.success && data.recommendations) setSupplementRecommendations(data.recommendations);
    } catch { }
  };

  const generateAIPlan = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/diet-recommendations/diet-plan/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (res.status === 404) { toast.error('Diet plan service unavailable.'); return; }
      const data = await res.json();
      if (data.success) { setPersonalizedPlan(data.dietPlan); setIsPlanOutdated(false); toast.success('AI diet plan generated! 🎉'); }
      else toast.error(data.message || 'Failed to generate plan');
    } catch { toast.error('Failed to generate plan.'); }
    finally { setGenerating(false); }
  };

  const goalTypeLabel = nutritionGoal?.goalType
    ? nutritionGoal.goalType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    : 'Healthy Living';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAF8F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, border: '4px solid #ede9fe', borderTopColor: '#c084fc', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 14px' }} />
          <p style={{ color: '#8B6F4E', fontWeight: 600, fontSize: 14 }}>Loading your meal plan...</p>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes foodBounce{0%{transform:scale(1) rotate(-3deg)}100%{transform:scale(1.1) rotate(3deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAF8F5', paddingBottom: 100, fontFamily: "'Inter',sans-serif" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes foodBounce{0%{transform:scale(1) rotate(-3deg)}100%{transform:scale(1.1) rotate(3deg)}}
        .meal-card{animation:fadeUp 0.35s ease both}
        .log-btn:hover{transform:scale(1.05)}
        ::-webkit-scrollbar{display:none}
      `}</style>

      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* ─── Header ─── */}
        <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => navigate(-1)} style={{ width: 40, height: 40, borderRadius: '50%', background: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <ArrowLeft size={18} color="#1A1A2E" />
          </button>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1A1A2E', margin: 0 }}>Meal Plan 🔥</h1>
          <button style={{ width: 40, height: 40, borderRadius: '50%', background: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <Bell size={18} color="#1A1A2E" />
          </button>
        </div>

        {/* ─── Search ─── */}
        <div style={{ padding: '14px 20px 0' }}>
          <div style={{ background: 'white', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Search size={17} color="#9CA3AF" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search meals…"
              style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14, color: '#374151', background: 'transparent' }} />
            <button style={{ background: 'linear-gradient(135deg,#c084fc,#fb923c)', padding: '6px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <Filter size={14} color="white" />
            </button>
          </div>
        </div>

        {/* ─── Personalise Banner ─── */}
        {(!hasNutritionGoal || !personalizedPlan) && (
          <div style={{ padding: '16px 20px 0' }}>
            <div style={{ background: 'linear-gradient(135deg,#FFF9C4,#FFE082)', borderRadius: 24, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden', boxShadow: '0 4px 16px rgba(255,193,7,0.25)' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1A1A2E', margin: '0 0 5px' }}>Personalise Meal Plan</h3>
                <p style={{ fontSize: 12, color: '#6B5E3E', margin: '0 0 14px', lineHeight: 1.5 }}>
                  {hasNutritionGoal ? 'Generate your AI-powered personalized meal plan' : 'To personalize your menu, we still need information.'}
                </p>
                {hasNutritionGoal ? (
                  <button onClick={generateAIPlan} disabled={generating}
                    style={{ background: '#E8854A', color: 'white', border: 'none', borderRadius: 50, padding: '11px 22px', fontWeight: 700, fontSize: 13, cursor: generating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, opacity: generating ? 0.7 : 1, boxShadow: '0 4px 12px rgba(232,133,74,0.35)' }}>
                    {generating ? <><div style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />Generating…</> : <><Sparkles size={15} />Generate Plan</>}
                  </button>
                ) : (
                  <Link to="/profile?tab=goals" style={{ background: '#E8854A', color: 'white', borderRadius: 50, padding: '11px 22px', fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, boxShadow: '0 4px 12px rgba(232,133,74,0.35)' }}>
                    <Target size={15} />Fill in Data
                  </Link>
                )}
              </div>
              <div style={{ fontSize: 68, lineHeight: 1, marginLeft: 12, flexShrink: 0, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))' }}>🥗</div>
            </div>
          </div>
        )}

        {/* ─── Recommended Nutrition Targets ─── */}
        {personalizedPlan && (
          <div style={{ padding: '20px 20px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: 19, fontWeight: 800, color: '#1A1A2E', margin: 0 }}>Daily Targets</h2>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: '3px 0 0', fontWeight: 500 }}>
                  Goal: <span style={{ color: '#c084fc', fontWeight: 700 }}>{goalTypeLabel}</span>
                </p>
              </div>
              <Link to="/profile?tab=goals" style={{ fontSize: 12, fontWeight: 700, color: '#c084fc', textDecoration: 'none' }}>Edit Goals</Link>
            </div>

            {isPlanOutdated && (
              <div style={{ background: '#FFF7ED', borderRadius: 14, padding: '12px 14px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', border: '1px solid #FED7AA' }}>
                <AlertCircle size={18} color="#F97316" />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#9A3412', margin: '0 0 3px' }}>Goals updated! Plan may be outdated.</p>
                  <button onClick={generateAIPlan} disabled={generating} style={{ fontSize: 11, color: '#E8854A', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Regenerate →
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              <MacroCard label="Calories" value={personalizedPlan.dailyCalorieTarget} unit="kcal" gradient="linear-gradient(135deg,#FF6B6B,#FF8E53)" emoji="🔥" />
              <MacroCard label="Protein" value={personalizedPlan.macroTargets?.protein} unit="g" gradient="linear-gradient(135deg,#c084fc,#818CF8)" emoji="💪" />
              <MacroCard label="Carbs" value={personalizedPlan.macroTargets?.carbs} unit="g" gradient="linear-gradient(135deg,#56ab2f,#a8e063)" emoji="🌾" />
              <MacroCard label="Fats" value={personalizedPlan.macroTargets?.fats} unit="g" gradient="linear-gradient(135deg,#f7971e,#ffd200)" emoji="🥑" />
            </div>

            {personalizedPlan.source === 'report' && !personalizedPlan.hasGoals && (
              <div style={{ marginTop: 10, background: '#FFF7ED', borderRadius: 12, padding: '9px 13px', display: 'flex', gap: 7, alignItems: 'center' }}>
                <AlertCircle size={14} color="#F97316" />
                <p style={{ fontSize: 11, color: '#92400E', margin: 0 }}>
                  Using default targets. <Link to="/profile?tab=goals" style={{ color: '#E8854A', fontWeight: 700 }}>Set your goals →</Link>
                </p>
              </div>
            )}
          </div>
        )}

        {/* ─── Report Selector ─── */}
        {allReports.length > 0 && (
          <div style={{ padding: '16px 20px 0' }}>
            <div style={{ background: 'white', borderRadius: 18, padding: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                <FileText size={15} color="#c084fc" />
                <span style={{ fontWeight: 700, fontSize: 13, color: '#1A1A2E' }}>Report-based Plan</span>
                <Link to="/upload" style={{ marginLeft: 'auto', background: 'linear-gradient(135deg,#c084fc,#fb923c)', color: 'white', borderRadius: 50, padding: '3px 11px', fontSize: 10, fontWeight: 700, textDecoration: 'none' }}>+ Upload</Link>
              </div>
              <select value={selectedReportId || ''} onChange={e => setSelectedReportId(e.target.value)}
                style={{ width: '100%', padding: '9px 13px', background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 11, fontSize: 12, color: '#374151', fontWeight: 600, outline: 'none', cursor: 'pointer' }}>
                {allReports.map(r => (
                  <option key={r._id} value={r._id}>{r.reportType} — {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ─── Meal Sections ─── */}
        {personalizedPlan ? (
          <>
            {/* Section Tabs */}
            <div style={{ padding: '20px 20px 0' }}>
              <div style={{ overflowX: 'auto', display: 'flex', gap: 8, paddingBottom: 2 }}>
                {[{ id: 'all', label: 'All', emoji: '🍽️' }, ...MEAL_ORDER.map(id => ({ id, label: SECTION_INFO[id].label, emoji: SECTION_INFO[id].emoji }))].map(tab => (
                  <button key={tab.id} onClick={() => setActiveSection(tab.id)}
                    style={{
                      whiteSpace: 'nowrap', padding: '8px 16px', borderRadius: 50, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                      background: activeSection === tab.id ? 'linear-gradient(135deg,#c084fc,#fb923c)' : 'white',
                      color: activeSection === tab.id ? 'white' : '#6B7280',
                      boxShadow: activeSection === tab.id ? '0 4px 12px rgba(192,132,252,0.35)' : '0 2px 6px rgba(0,0,0,0.06)'
                    }}>
                    {tab.emoji} {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Meal Cards in correct order: breakfast → lunch → snacks → dinner */}
            {MEAL_ORDER.map(section => {
              if (activeSection !== 'all' && activeSection !== section) return null;
              const meals = personalizedPlan.mealPlan?.[section] || [];
              if (meals.length === 0) return null;
              const info = SECTION_INFO[section];
              const filtered = searchQuery ? meals.filter(m => getMealName(m).toLowerCase().includes(searchQuery.toLowerCase())) : meals;
              if (filtered.length === 0) return null;

              return (
                <div key={section} style={{ padding: '20px 20px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1A1A2E', margin: 0 }}>{info.emoji} {info.label}</h2>
                      <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0', fontWeight: 500 }}>{info.time}</p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#c084fc' }}>{filtered.length} items</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filtered.map((mealItem, idx) => {
                      const name = getMealName(mealItem);
                      const calories = getMealCalories(mealItem);
                      const protein = getMealProtein(mealItem);
                      const desc = getMealDesc(mealItem);
                      const mealKey = `${section}-${idx}`;
                      const isLiked = likedMeals[mealKey];
                      const isLogged = loggedMeals[mealKey];
                      const cookTime = { breakfast: '15 min', lunch: '25 min', snacks: '10 min', dinner: '35 min' }[section];

                      return (
                        <div key={mealKey} className="meal-card"
                          style={{ background: info.bg, borderRadius: 22, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', overflow: 'hidden', animationDelay: `${idx * 0.07}s`, boxShadow: '0 3px 14px rgba(0,0,0,0.06)' }}>

                          {/* Like btn */}
                          <button onClick={() => setLikedMeals(p => ({ ...p, [mealKey]: !p[mealKey] }))}
                            style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.75)', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(4px)', zIndex: 2 }}>
                            <Heart size={13} color={isLiked ? '#EF4444' : '#374151'} fill={isLiked ? '#EF4444' : 'none'} />
                          </button>

                          {/* Content */}
                          <div style={{ flex: 1, paddingTop: 22, paddingRight: 12 }}>
                            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1A1A2E', margin: '0 0 4px', lineHeight: 1.3 }}>{name}</h3>
                            {desc && <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 6px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{desc}</p>}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6B7280', fontWeight: 600 }}>
                                <Clock size={12} color="#6B7280" />{cookTime}
                              </span>
                              {calories && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#E8854A', fontWeight: 700 }}><Flame size={12} color="#E8854A" />{calories} kcal</span>}
                              {protein && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#c084fc', fontWeight: 700 }}><Zap size={12} color="#c084fc" />{protein}g</span>}
                            </div>

                            {/* Log Food Button */}
                            <button
                              className="log-btn"
                              onClick={() => setLogModal({ meal: mealItem, mealType: section })}
                              style={{
                                marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5,
                                background: isLogged ? '#D1FAE5' : 'white',
                                color: isLogged ? '#059669' : '#c084fc',
                                border: `1.5px solid ${isLogged ? '#6EE7B7' : '#c084fc'}`,
                                borderRadius: 50, padding: '5px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}>
                              {isLogged ? <><CheckCircle size={12} />Logged!</> : <><BookOpen size={12} />Log Food</>}
                            </button>
                          </div>

                          {/* Animated Food Emoji Illustration */}
                          <div style={{
                            width: 90, height: 90, borderRadius: 18, flexShrink: 0,
                            background: 'rgba(255,255,255,0.6)',
                            backdropFilter: 'blur(8px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 52,
                            boxShadow: '0 5px 18px rgba(0,0,0,0.1)',
                            animation: `foodBounce ${0.8 + (idx % 3) * 0.3}s ease-in-out infinite alternate`,
                            border: '2px solid rgba(255,255,255,0.7)',
                            userSelect: 'none',
                          }}>
                            {getFoodEmoji(name, section)}
                          </div>

                          {/* Log Food Button only - no + icon */}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Key Foods */}
            {personalizedPlan.keyFoods?.length > 0 && (
              <div style={{ padding: '20px 20px 0' }}>
                <h2 style={{ fontSize: 19, fontWeight: 800, color: '#1A1A2E', margin: '0 0 12px' }}>Key Foods to Include</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {personalizedPlan.keyFoods.map((food, idx) => (
                    <div key={idx} style={{ background: 'white', borderRadius: 16, padding: '13px 15px', display: 'flex', gap: 12, alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(245,245,245,1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 22, border: '1px solid #EEEEEE' }}>
                        {getFoodEmoji(food.name, 'lunch')}
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, color: '#1A1A2E', margin: '0 0 2px', fontSize: 13 }}>{food.name}</p>
                        <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>{food.reason}</p>
                        {food.frequency && <span style={{ fontSize: 10, color: '#c084fc', fontWeight: 700 }}>{food.frequency}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lifestyle Tips */}
            {personalizedPlan.lifestyleRecommendations?.length > 0 && (
              <div style={{ padding: '20px 20px 0' }}>
                <div style={{ background: 'linear-gradient(135deg,#c084fc,#fb923c)', borderRadius: 22, padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Lightbulb size={19} color="white" />
                    <h2 style={{ fontSize: 17, fontWeight: 800, color: 'white', margin: 0 }}>Lifestyle Tips</h2>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {personalizedPlan.lifestyleRecommendations.map((tip, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                        <CheckCircle size={15} color="rgba(255,255,255,0.85)" style={{ flexShrink: 0, marginTop: 2 }} />
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.92)', margin: 0, lineHeight: 1.5 }}>{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Supplements */}
            {supplementRecommendations?.supplements?.length > 0 && (
              <div style={{ padding: '20px 20px 0' }}>
                <h2 style={{ fontSize: 19, fontWeight: 800, color: '#1A1A2E', margin: '0 0 12px' }}>Supplements</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {supplementRecommendations.supplements.map((s, i) => (
                    <div key={i} style={{ background: 'white', borderRadius: 16, padding: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                        <p style={{ fontWeight: 800, color: '#1A1A2E', margin: 0, fontSize: 14 }}>{s.name}</p>
                        {s.priority && (
                          <span style={{
                            fontSize: 9, fontWeight: 800, padding: '3px 9px', borderRadius: 50,
                            background: s.priority === 'high' ? '#FEE2E2' : s.priority === 'medium' ? '#FEF3C7' : '#D1FAE5',
                            color: s.priority === 'high' ? '#DC2626' : s.priority === 'medium' ? '#D97706' : '#059669'
                          }}>
                            {s.priority.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 9px' }}>{s.reason}</p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {s.dosage && <span style={{ fontSize: 11, background: '#F3F4F6', padding: '3px 9px', borderRadius: 8, fontWeight: 600, color: '#374151' }}>{s.dosage}</span>}
                        {s.timing && <span style={{ fontSize: 11, background: '#F3F4F6', padding: '3px 9px', borderRadius: 8, fontWeight: 600, color: '#374151' }}>{s.timing}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          !loading && (
            <div style={{ padding: '24px 20px 0' }}>
              <div style={{ background: 'white', borderRadius: 26, padding: '38px 22px', textAlign: 'center', boxShadow: '0 4px 18px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 68, marginBottom: 14 }}>🍽️</div>
                <h3 style={{ fontSize: 21, fontWeight: 800, color: '#1A1A2E', margin: '0 0 9px' }}>
                  {hasNutritionGoal ? 'Ready to Generate!' : 'Set Your Goals First'}
                </h3>
                <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 22px', lineHeight: 1.6 }}>
                  {hasNutritionGoal
                    ? 'Tap below to create your AI-powered personalized meal plan.'
                    : 'Set your nutrition and fitness goals to receive a personalized meal plan.'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {hasNutritionGoal ? (
                    <button onClick={generateAIPlan} disabled={generating}
                      style={{ background: 'linear-gradient(135deg,#c084fc,#fb923c)', color: 'white', border: 'none', borderRadius: 50, padding: '13px 26px', fontWeight: 800, fontSize: 14, cursor: generating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 6px 18px rgba(192,132,252,0.4)' }}>
                      {generating ? <><div style={{ width: 17, height: 17, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />Generating…</> : <><Sparkles size={17} />Generate AI Meal Plan</>}
                    </button>
                  ) : (
                    <Link to="/profile?tab=goals" style={{ background: 'linear-gradient(135deg,#c084fc,#fb923c)', color: 'white', borderRadius: 50, padding: '13px 26px', fontWeight: 800, fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <Target size={17} />Set My Goals
                    </Link>
                  )}
                  <Link to="/upload" style={{ background: '#F9FAFB', color: '#374151', borderRadius: 50, padding: '13px 26px', fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1.5px solid #E5E7EB' }}>
                    <FileText size={17} />Upload Health Report
                  </Link>
                </div>
              </div>
            </div>
          )
        )}

        {/* Disclaimer */}
        <div style={{ margin: '22px 20px 0', background: '#F9FAFB', borderRadius: 14, padding: '13px 15px', border: '1px solid #E5E7EB' }}>
          <p style={{ fontSize: 11, color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
            <strong style={{ color: '#374151' }}>⚕️ Disclaimer:</strong> This meal plan is AI-generated for informational purposes only. Consult a registered dietitian before making significant dietary changes.
          </p>
        </div>

      </div>

      {/* ─── Log Food Modal ─── */}
      {logModal && (
        <LogFoodModal
          meal={logModal.meal}
          mealType={logModal.mealType}
          onClose={() => setLogModal(null)}
          onLogged={() => {
            // Mark all meals of this type as potentially logged (we don't know exact index)
            const key = `${logModal.mealType}-logged`;
            setLoggedMeals(p => ({ ...p, [key]: true }));
          }}
        />
      )}
    </div>
  );
}
