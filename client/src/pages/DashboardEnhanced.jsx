import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import {
  Flame, Moon, Utensils, Activity, Sparkles, TrendingUp, TrendingDown, Bell,
  ChevronRight, ChevronLeft, Plus, FileText, AlertCircle, Droplet,
  Search, Sun, Clock, Heart, Apple, Info, Target, Calendar,
  ArrowUpRight, Upload, Coffee, Dumbbell, MessageCircle, BarChart3,
  Circle, Smile, FlaskConical, Leaf, Pill, CheckCircle2, Zap, Eye,
  UtensilsCrossed, UploadCloud, ShieldCheck, AlertTriangle, Check, Dna,
  Scale, Footprints, X, Minus, GlassWater, Save, ArrowRight, Lightbulb
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Joyride, STATUS } from 'react-joyride';
import DashboardSkeleton from '../components/skeletons/DashboardSkeleton';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, PieChart, Pie, Cell, LineChart, Line,
  ReferenceLine, Label, BarChart, Bar
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { getFoodImage } from '../services/imageService';
import api, { nutritionService } from '../services/api';
import { ImageWithFallback } from '../components/ImageWithFallback';

const DashedGauge = ({ value, max = 2400, mode = 'Macro' }) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const totalDashes = 18;
  const activeDashes = Math.floor((percentage / 100) * totalDashes);

  const getSripColor = (index, isActive) => {
    if (!isActive) return '#F5F5F7';
    // 1st 7 strips: dd5432 67% and c82d06
    if (index < 7) return index % 2 === 0 ? '#dd5432' : '#c82d06';
    // next 6 strips: f6efde and b8964e
    if (index < 13) return index % 2 === 0 ? '#f6efde' : '#b8964e';
    // last 5 strips: 83c3ae and 567c6f
    return index % 2 === 0 ? '#83c3ae' : '#567c6f';
  };

  return (
    <div className="relative flex flex-col items-center justify-center pt-1 pb-1">
      <svg width="180" height="90" viewBox="0 0 240 120" className="overflow-visible lg:w-[220px] lg:h-[110px]">
        {Array.from({ length: totalDashes }).map((_, i) => {
          const angle = (i * (180 / (totalDashes - 1)));
          const isActive = i < activeDashes;
          return (
            <line
              key={i}
              x1="20" y1="120"
              x2="52" y2="120"
              stroke={getSripColor(i, isActive)}
              strokeWidth="10"
              strokeLinecap="round"
              className="transition-colors duration-700"
              transform={`rotate(${angle} 120 120)`}
              strokeOpacity={isActive ? 1 : 0.4}
            />
          );
        })}
      </svg>
      <div className="absolute bottom-1 lg:bottom-2 flex flex-col items-center">
        <span className="text-lg lg:text-2xl font-black text-[#1a1a1a] tracking-tight leading-none">
          {Math.round(value)}
        </span>
        <span className="text-[8px] lg:text-[10px] font-bold text-[#888888] mt-0 lg:mt-0.5 uppercase">
          of {max}
        </span>
      </div>
    </div>
  );
};

const NutrientProgressRow = ({ label, value, targetLabel, icon: Icon, color = "bg-black", iconBg = "bg-slate-50", iconColor = "text-black" }) => (
  <div className="group">
    <div className="flex justify-between items-center mb-1.5 px-1">
      <div className="flex items-center gap-2">
        <div className={`w-6 h-6 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
        </div>
        <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{label}</span>
      </div>
      <div className="text-right">
        <span className="text-[10px] font-black text-black">{Math.round(value)}%</span>
        {targetLabel && <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter block -mt-0.5">{targetLabel}</span>}
      </div>
    </div>
    <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100/50">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(value, 100)}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className={`h-full ${color} rounded-full`}
      />
    </div>
  </div>
);

const NutrientMacroCompact = ({ label, value, targetLabel, icon: Icon, color = "bg-[#064e3b]" }) => (
  <div className="flex flex-col items-center gap-1">
    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center mb-0.5">
      <Icon className="w-4 h-4 text-[#064e3b]" />
    </div>
    <div className="text-xs font-black text-[#064e3b] leading-tight">{Math.round(value)}%</div>
    <div className="text-[10px] font-bold text-emerald-800/60 uppercase tracking-tighter leading-none">{label}</div>
    {targetLabel && <div className="text-[9px] font-bold text-emerald-800/40 uppercase leading-none mt-0.5">{targetLabel}</div>}
    <div className="h-1.5 w-full bg-emerald-50/50 rounded-full overflow-hidden mt-0.5 border border-white">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(value, 100)}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className={`h-full ${color} rounded-full`}
      />
    </div>
  </div>
);

const MealGallaryCard = ({ item, mealType, onClick }) => {
  const [image, setImage] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (item?.name) {
      getFoodImage(item.name).then(img => {
        if (isMounted && img) setImage(img);
      });
    }
    return () => { isMounted = false; };
  }, [item?.name]);

  const tag = item?.tag || (item?.calories < 200 ? 'LOW CALORIE' : item?.protein > 10 ? 'HIGH PROTEIN' : 'HEALTHY');

  return (
    <div
      onClick={() => onClick && onClick({ ...item, image })}
      className={`min-w-[180px] rounded-[2.2rem] p-4 group transition-all border flex flex-col snap-start cursor-pointer bg-white border-slate-50/50 hover:bg-white hover:shadow-xl hover:shadow-slate-100`}>
      <div className="relative h-40 mb-3">
        <div className="w-full h-full rounded-[1.5rem] overflow-hidden bg-slate-50">
          {image ? (
            <img
              src={item?.imageUrl || image}
              alt={item?.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-200">
              <Utensils className="w-8 h-8 opacity-10" />
            </div>
          )}
        </div>
        <div className="absolute top-2.5 right-2.5 px-2.5 py-1.5 bg-white/90 backdrop-blur-md rounded-full text-[9px] font-black text-black shadow-sm flex items-center gap-1">
          {(item?.totalNutrition?.calories || item?.nutrition?.calories || item?.calories || 0)} <span className="text-slate-400 text-[8px] font-bold">KCAL</span>
        </div>
      </div>
      <div className="px-1">
        <h4 className="text-base font-black text-black mb-1 truncate tracking-tight">{item?.name || item?.foodItems?.[0]?.name || 'Healthy Dish'}</h4>
        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{tag}</div>
      </div>
    </div>
  );
};

const LabMetricsItem = ({ label, value, status, icon: Icon }) => (
  <div className="flex items-center justify-between p-2 lg:p-4 bg-[#F8F9FB] rounded-xl lg:rounded-2xl border border-slate-50 group hover:bg-white hover:shadow-sm transition-all">
    <div className="flex items-center gap-2 lg:gap-4">
      <div className="w-6 h-6 lg:w-9 lg:h-9 rounded-lg bg-emerald-50/50 flex items-center justify-center shadow-sm">
        <Icon className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-[#064e3b]" />
      </div>
      <div>
        <h4 className="text-[10px] lg:text-[12px] font-medium text-[#064e3b] leading-tight">{label}</h4>
      </div>
    </div>
    <div className="text-right">
      <div className="text-[10px] lg:text-[12px] font-black text-[#064e3b] leading-tight mb-0.5">{value}</div>
      <div className={`text-[8px] lg:text-[9px] font-medium uppercase tracking-widest ${status?.toLowerCase().includes('high') || status?.toLowerCase().includes('risk') ? 'text-[#064e3b]' : 'text-emerald-800/40'
        }`}>
        {status}
      </div>
    </div>
  </div>
);

const DiabetesMonitor = ({ onLog }) => {
  const [reading, setReading] = useState('');
  const [type, setType] = useState('Fasting');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!reading) return;
    setLoading(true);
    try {
      await api.post('health/glucose', { value: reading, type, date: new Date() });
      setReading('');
      if (onLog) onLog();
    } catch (err) {
      console.error("Failed to log glucose:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-[32px] p-6 lg:p-10 border border-[#f0f0ea] shadow-sm mb-12 relative overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-[#1a1a1a]">Diabetes Monitor</h2>
          <p className="text-sm font-medium text-[#a0a0a0]">Biological markers tracking</p>
        </div>
        <button className="flex items-center gap-2 bg-[#FAFBF8] px-6 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-widest border border-[#f0f0ea] shadow-sm hover:shadow-md transition-all">
          <Plus className="w-4 h-4" />
          Log Reading
        </button>
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-4 bg-[#FAFBF8] p-4 rounded-[24px] border border-[#f0f0ea] mb-8">
        <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-hide w-full">
          {['Fasting', 'Post-Meal', 'Random'].map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-8 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${type === t ? 'bg-[#1a1a1a] text-white shadow-md' : 'text-[#8a8a8a] hover:text-[#1a1a1a]'}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <input
            type="number"
            placeholder="mg/dL"
            value={reading}
            onChange={(e) => setReading(e.target.value)}
            className="flex-1 lg:w-40 bg-white border border-[#f0f0ea] px-6 py-2.5 rounded-full text-sm font-bold focus:outline-none placeholder:text-[#d1d1d1]"
          />
          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-[#5B8C6F] text-white px-8 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-widest hover:bg-[#4a7b5e] transition-all disabled:opacity-50 shadow-md shadow-[#5B8C6F]/20"
          >
            {loading ? '...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        {[
          { label: 'Glucose', val: '110', unit: 'mg/dL', status: 'Normal', color: '#5B8C6F' },
          { label: 'Avg Sugar', val: '126', unit: 'mg/dL', status: '-3%', color: '#F59E0B' },
          { label: 'HbA1c', val: '5.8', unit: '%', status: 'Good', color: '#5B8C6F' }
        ].map((item, i) => (
          <div key={i} className="bg-[#FAFBF8] rounded-[24px] p-6 lg:p-8 text-center border border-[#f0f0ea] hover:shadow-md transition-shadow">
            <p className="text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-4">{item.label}</p>
            <div className="flex items-baseline justify-center gap-1 mb-2">
              <span className="text-3xl lg:text-4xl font-black text-[#1a1a1a]">{item.val}</span>
              <span className="text-[10px] font-bold text-[#b0b0b0] uppercase">{item.unit}</span>
            </div>
            <span className={`px-4 py-1.5 bg-white text-[10px] font-bold rounded-full border border-[#f0f0ea] uppercase tracking-wider`} style={{ color: item.color }}>{item.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const DailyMetricsCard = ({ onOpenLog }) => {
  return null;
};

const MealDetailModal = ({ meal, onClose, onAdd }) => {
  const [loading, setLoading] = useState(true);
  const [aiData, setAiData] = useState(null);

  useEffect(() => {
    const fetchAiData = async () => {
      setLoading(true);
      try {
        const response = await api.post('nutrition/quick-check', {
          foodDescription: `${meal.name} ${meal.quantity || ''}`
        });
        if (response.data.success) {
          setAiData(response.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch AI data:", err);
      } finally {
        setLoading(false);
      }
    };

    if (meal) fetchAiData();
  }, [meal]);

  if (!meal) return null;

  const data = aiData || {
    foodItem: {
      name: meal.name,
      quantity: meal.portionSize || meal.quantity || '1 serving',
      nutrition: {
        calories: meal.calories || 0,
        protein: meal.protein || 0,
        carbs: meal.carbs || 0,
        fats: meal.fats || 0,
        fiber: 0,
        sugar: 0,
        sodium: 0
      }
    },
    healthScore10: 7,
    healthBenefitsSummary: 'Loading dietary insights...',
    isHealthy: true
  };

  const healthScore = Math.round(data.healthScore10 * 10 || 70);
  const nutrition = data.foodItem.nutrition;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header Section */}
        <div className="p-8 pb-4 flex items-start justify-between">
          <div className="flex items-center gap-6">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#F5F5F7" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="45" fill="none" stroke="#1A1A1A" strokeWidth="8"
                  strokeDasharray={283}
                  strokeDashoffset={283 - (283 * healthScore) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="flex flex-col items-center justify-center z-10">
                <span className="text-xl font-black text-black">{healthScore}</span>
                <span className="text-[8px] font-bold text-slate-400">/ 100</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-3 py-1 bg-slate-100 text-black text-[9px] font-black uppercase tracking-widest rounded-full">
                  {data.isHealthy ? 'Healthy Choice' : 'Indulgence'}
                </span>
                {nutrition.calories < 200 && (
                  <span className="px-3 py-1 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-full">
                    Low Calorie
                  </span>
                )}
              </div>
              <h2 className="text-3xl font-black text-black tracking-tight">{data.foodItem.name}</h2>
              <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">
                ⚡ {data.foodItem.quantity}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-all border border-slate-100">
            <Plus className="w-5 h-5 rotate-45 text-slate-400" />
          </button>
        </div>

        <div className="px-8 overflow-y-auto pb-8 scrollbar-hide">
          {/* Main Image */}
          <div className="relative h-64 rounded-3xl overflow-hidden mb-8 border border-slate-100">
            <ImageWithFallback
              src={meal.image || (data.imageUrl)}
              foodName={meal.name}
              className="w-full h-full object-cover"
            />
            {(meal.image || data.imageUrl) && (
              <div className="absolute bottom-4 right-4 px-4 py-1.5 bg-white/90 backdrop-blur-md rounded-full text-[9px] font-black uppercase tracking-widest text-black shadow-sm border border-white">
                Analyzed Image
              </div>
            )}
          </div>

          {/* Macros Grid */}
          <div className="grid grid-cols-4 gap-4 p-6 bg-[#FDFDFD] rounded-[32px] border border-slate-100 shadow-sm mb-6">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-2 border border-slate-100">
                <Flame className="w-4 h-4 text-black" />
              </div>
              <div className="text-lg font-black text-black leading-none">{Math.round(nutrition.calories)}</div>
              <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Calories</div>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-2 border border-slate-100">
                <Zap className="w-4 h-4 text-black" />
              </div>
              <div className="text-lg font-black text-black leading-none">{Math.round(nutrition.protein)}g</div>
              <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Protein</div>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-2 border border-slate-100">
                <Activity className="w-4 h-4 text-black" />
              </div>
              <div className="text-lg font-black text-black leading-none">{Math.round(nutrition.carbs)}g</div>
              <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Carbs</div>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-2 border border-slate-100">
                <Heart className="w-4 h-4 text-black" />
              </div>
              <div className="text-lg font-black text-black leading-none">{Math.round(nutrition.fats)}g</div>
              <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Fats</div>
            </div>

            <div className="col-span-4 mt-4 pt-4 border-t border-slate-50 flex justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fiber: <span className="text-black">{nutrition.fiber || 0}g</span></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sugar: <span className="text-black">{nutrition.sugar || 0}g</span></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sodium: <span className="text-black">{nutrition.sodium || 0}mg</span></span>
              </div>
            </div>
          </div>

          {/* Health Benefits Section */}
          <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                <Info className="w-4 h-4 text-black" />
              </div>
              <h3 className="text-[11px] font-black uppercase tracking-widest text-black">Health Benefits</h3>
            </div>
            <p className="text-sm font-medium text-slate-600 leading-relaxed">
              {data.healthBenefitsSummary}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 pt-0">
          <button
            onClick={() => onAdd(data)}
            className="w-full py-5 bg-slate-900 hover:bg-black text-white rounded-[24px] font-black uppercase tracking-widest shadow-xl shadow-black/10 transition-all flex items-center justify-center gap-3"
          >
            <Plus className="w-5 h-5" /> Add to Diet Plan
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main Component ---

export default function DashboardEnhanced() {
  const { user, refreshUser } = useAuth();
  const { dashboardData, nutritionData, wearableData, weeklyTrends, fetchDashboard, fetchNutrition, fetchNutritionLogs, fetchDietPlan, fetchWearable, fetchWeeklyTrends, loading, dataRefreshTrigger, invalidateCache } = useData();
  const navigate = useNavigate();

  const [dietPlan, setDietPlan] = useState(null);
  const [loggedMeals, setLoggedMeals] = useState([]);
  const [loggedMealsMap, setLoggedMealsMap] = useState({});
  const [isDiabetic, setIsDiabetic] = useState(false);
  const [selectedMealForModal, setSelectedMealForModal] = useState(null);
  const [showMealModal, setShowMealModal] = useState(false);
  const [nutrientMode, setNutrientMode] = useState('Macro');
  const [showNutrientDetails, setShowNutrientDetails] = useState(false);
  const [activeDietSlide, setActiveDietSlide] = useState(0);
  const [activeMealTab, setActiveMealTab] = useState('breakfast');
  const [activeDiabetesTab, setActiveDiabetesTab] = useState('Fasting');
  const [activeTrendTab, setActiveTrendTab] = useState('Calories');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isLogVitalsOpen, setIsLogVitalsOpen] = useState(false);
  const [activeLogTab, setActiveLogTab] = useState('Weight'); // Weight, Steps, Sleep, Water
  const [waterLog, setWaterLog] = useState(0);
  const [vitalsLoading, setVitalsLoading] = useState(false);
  const [vitalsInput, setVitalsInput] = useState({ weight: '', steps: '', sleepHours: '', sleepMins: '', date: new Date().toISOString().split('T')[0] });
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const placeholders = ["How often should i do HbA1c...", "What should I eat for dinner?", "Am I reaching my goals?"];

  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const location = useLocation();

  // Initialize and Sync Water Log (field is 'waterIntake' in NutritionSummary)
  useEffect(() => {
    const water = nutritionData?.totalWater ?? nutritionData?.waterIntake;
    if (water !== undefined && water !== null) {
      setWaterLog(Number(water));
    }
  }, [nutritionData?.totalWater, nutritionData?.waterIntake]);

  // Sync Log Modal with Navigation State
  useEffect(() => {
    if (location.state?.openLogVitals) {
      setActiveLogTab(location.state.openLogVitals);
      setIsLogVitalsOpen(true);
      // Clean up state to prevent re-opening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Fetch all required data on mount
  useEffect(() => {
    const loadAllData = async () => {
      const today = new Date().toISOString().split('T')[0];
      await Promise.all([
        fetchDashboard(),
        fetchNutrition(today),
        fetchWearable(),
        fetchWeeklyTrends()
      ]);
    };
    loadAllData();
  }, [fetchDashboard, fetchNutrition, fetchWearable, fetchWeeklyTrends]);

  // Sync Sleep Inputs with Real Data
  useEffect(() => {
    if (wearableData?.todayMetrics?.sleep !== undefined) {
      const totalMins = Number(wearableData.todayMetrics.sleep);
      if (totalMins > 0) {
        setVitalsInput(prev => ({
          ...prev,
          sleepHours: Math.floor(totalMins / 60).toString(),
          sleepMins: (totalMins % 60).toString()
        }));
      }
    }
  }, [wearableData?.todayMetrics?.sleep]);

  // Sync Weight Input with Real Data
  useEffect(() => {
    const currentWeight = dashboardData?.vitals?.weight?.value || user?.profile?.weight;
    if (currentWeight) {
      setVitalsInput(prev => ({
        ...prev,
        weight: currentWeight.toString()
      }));
    }
  }, [dashboardData?.vitals?.weight?.value, user?.profile?.weight]);

  // Robust Graph Data Processing (Last 7 Days)
  const formattedHistory = useMemo(() => {
    const days = [];
    const today = new Date();

    // Generate last 7 days (including today)
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      days.push({ date: dateStr, day: dayName });
    }

    // Map data from various sources (dashboardData.history is the primary source of truth for 90-day history)
    const historySource = dashboardData?.history || [];

    return {
      weight: days.map(d => {
        const entry = historySource.find(h => h.date === d.date);
        return { day: d.day, value: entry?.weight || user?.profile?.weight || 70 };
      }),
      water: days.map(d => {
        const entry = historySource.find(h => h.date === d.date);
        return { day: d.day, value: entry?.water || 0 };
      }),
      steps: days.map(d => {
        const entry = historySource.find(h => h.date === d.date);
        return { day: d.day, value: entry?.steps || 0 };
      }),
      sleep: days.map(d => {
        const entry = historySource.find(h => h.date === d.date);
        return { day: d.day, value: entry?.sleep || 0 };
      })
    };
  }, [dashboardData?.history, user?.profile?.weight]);

  const handleLogVitals = async (type, change = null) => {
    setVitalsLoading(true);
    try {
      const logDate = vitalsInput.date || new Date().toISOString().split('T')[0];

      if (type === 'Weight') {
        if (!vitalsInput.weight) throw new Error('Weight is required');
        await api.post('nutrition/log-weight', { weight: Number(vitalsInput.weight), notes: 'Mobile dashboard log', date: logDate });
        toast.success(type + ' logged successfully');
      } else if (type === 'Steps') {
        if (!vitalsInput.steps) throw new Error('Steps required');
        const stepsToAdd = Number(vitalsInput.steps);
        await api.post('wearables/sync', { deviceType: 'other', isAdditive: true, metrics: { steps: stepsToAdd, date: logDate } });
        toast.success('Steps added successfully');
      } else if (type === 'Sleep') {
        if (!vitalsInput.sleepHours && !vitalsInput.sleepMins) throw new Error('Sleep duration required');
        const totalMins = (Number(vitalsInput.sleepHours || 0) * 60) + Number(vitalsInput.sleepMins || 0);
        await api.post('wearables/sleep', { deviceType: 'other', isAdditive: false, sleepData: { totalSleepMinutes: totalMins, date: logDate } });
        toast.success('Sleep logged successfully');
      } else if (type === 'Water') {
        const currentWater = nutritionData?.totalWater ?? nutritionData?.waterIntake ?? 0;
        const newWater = Math.max(0, Number(currentWater) + (change || 0));
        await api.post('nutrition/log-water', { date: logDate, waterIntake: newWater });
        setWaterLog(newWater);
        toast.success('Water logged successfully');
      }

      // Sync all data sources
      invalidateCache(['dashboard', 'wearable', `nutrition_${logDate}`]);
      await Promise.all([
        fetchDashboard(true),
        fetchNutrition(logDate, true),
        fetchWearable(true),
        // Refresh user profile so weight gauge reads the updated user.profile.weight
        type === 'Weight' ? refreshUser() : Promise.resolve()
      ]);

      if (type !== 'Water') {
        // Only reset the fields that were just logged; preserve sleep values from server if not logging sleep
        setVitalsInput(prev => ({
          ...prev,
          weight: type === 'Weight' ? '' : prev.weight,
          steps: type === 'Steps' ? '' : prev.steps,
          sleepHours: type === 'Sleep' ? '' : prev.sleepHours,
          sleepMins: type === 'Sleep' ? '' : prev.sleepMins,
          date: logDate
        }));
      }
    } catch (err) {
      toast.error(err.message || `Failed to log ${type}`);
    } finally {
      setVitalsLoading(false);
    }
  };

  // Simple Joyride Tour State
  const [runTour, setRunTour] = useState(false);
  const [tourSteps] = useState([
    {
      target: '.tour-profile',
      content: 'Tap your profile here anytime to set your fitness Goal.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '.tour-nutrient-info',
      content: 'Track your daily macros, micros, and live diet goals here. Swipe left to see more cards!',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '.tour-diet-plan',
      content: 'Your AI-generated daily meal schedule appears here based on your fitness goals.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '.tour-ai-insights',
      content: 'Upload your medical reports here to get deep AI Lab Insights instantly.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '.tour-health-profile',
      content: 'Tap here to unlock your full AI-generated Health Archetype and medical summary.',
      placement: 'top',
      disableBeacon: true,
    },
    {
      target: '.tour-logged-meals',
      content: 'All your tracked meals appear here. Keep eating healthy to hit your targets!',
      placement: 'top',
      disableBeacon: true,
    },
    {
      target: '.nav-center-fab',
      content: 'The action hub! Tap this bold button to quick-log your meals, sleep, steps, and water intake.',
      placement: 'top',
      disableBeacon: true,
    },
    {
      target: '.mobile-bottom-nav-container',
      content: 'Navigate between your Dashboard, Nutrition, and Medical Reports swiftly using these tabs.',
      placement: 'top',
      disableBeacon: true,
    }
  ]);

  // 🔐 Synchronous Ironclad Guard: Resolve instantly to prevent refresh flicker
  const isTourCompleted = (() => {
    if (localStorage.getItem("joyride-completed-any") === "true") return true;
    if (user?._id && localStorage.getItem(`joyride-completed-${user._id}`) === "true") return true;
    if (user?.profile?.hasSeenMobileTour) return true;
    return false;
  })();

  // Instant DOM synchronization
  if (isTourCompleted) {
    document.body.classList.add('onboarding-tour-finished');
    if (document.documentElement) document.documentElement.setAttribute('data-tour-finished', 'true');
  }

  // Step 1: Trigger the tour for authenticated new users ONLY
  // useEffect(() => {
  //   if (!user?._id || isTourCompleted) return;
  //   setRunTour(true);
  // }, [user?._id, isTourCompleted]);

  // Step 2: Mark tour as completed in local storage AND database
  const handleJoyrideCallback = (data) => {
    const { status, type, step } = data;

    if (status === "finished" || status === "skipped" || type === "tour:end") {
      if (user?._id) {
        // Double-lock persistence
        localStorage.setItem(`joyride-completed-${user._id}`, "true");
        localStorage.setItem("joyride-completed-any", "true");

        const updatedProfile = { ...user.profile, hasSeenMobileTour: true };
        api.put('auth/profile', { profile: { hasSeenMobileTour: true } })
          .then(() => updateUser && updateUser({ ...user, profile: updatedProfile }))
          .catch(e => console.error('DB Sync Fail:', e));
      }
      setRunTour(false);
      document.body.classList.add('onboarding-tour-finished');
    }

    // Smooth scroll logic maintained below...

    // Maintain the smooth scrolling logic for tour steps
    if (type === 'step:before' || type === 'tooltip') {
      setTimeout(() => {
        try {
          if (step?.target && ['.tour-nutrient-info', '.tour-diet-plan', '.tour-ai-insights'].includes(step.target)) {
            if (scrollContainerRef.current) {
              let leftScroll = 0;
              if (step.target === '.tour-nutrient-info') { leftScroll = 0; }
              else if (step.target === '.tour-diet-plan') { leftScroll = window.innerWidth * 0.85; }
              else if (step.target === '.tour-ai-insights') { leftScroll = window.innerWidth * 1.7; }
              scrollContainerRef.current.scrollTo({ left: leftScroll, behavior: 'smooth' });
            }
          }
          const targetEl = document.querySelector(step.target);
          if (targetEl) {
            const bodyRect = document.body.getBoundingClientRect().top;
            const elementRect = targetEl.getBoundingClientRect().top;
            const elementPosition = elementRect - bodyRect;
            const yOffset = elementPosition - (window.innerHeight / 2) + (targetEl.clientHeight / 2);
            window.scrollTo({ top: Math.max(0, yOffset), behavior: 'smooth' });
          }
        } catch (err) { console.error('Tour focus fail:', err); }
      }, 50);
    }
  };


  const [completedTasks, setCompletedTasks] = useState(() => {
    const saved = localStorage.getItem('carePlanTasks');
    if (!saved) return [];
    try {
      const { tasks, date } = JSON.parse(saved);
      const today = new Date().toISOString().split('T')[0];
      if (date === today) return tasks;
      return []; // Reset for new day
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('carePlanTasks', JSON.stringify({
      tasks: completedTasks,
      date: today
    }));
  }, [completedTasks]);

  const overallPerformanceInsight = useMemo(() => {
    if (!dashboardData) return [];

    const calorieGoal = dashboardData.goals?.calories || 2100;
    const currentCals = nutritionData?.totalCalories || 0;
    const caloriesLeft = calorieGoal - currentCals;
    const stepsGoal = dashboardData.goals?.steps || 10000;
    const currentSteps = Number(dashboardData.stepsToday || 0);
    const healthScore = dashboardData.latestAnalysis?.healthScore || 75;

    const insights = [];

    // Health Score Pointer
    insights.push({
      id: 'score',
      type: 'primary',
      icon: Heart,
      color: 'text-rose-400',
      label: 'Health Score',
      text: `Your overall vitality score is ${healthScore}/100 based on recent logs.`
    });

    // Calorie Pointer
    if (caloriesLeft < 0) {
      insights.push({
        id: 'calories',
        type: 'warning',
        icon: AlertCircle,
        color: 'text-amber-400',
        label: 'Nutrition Intake',
        text: `Calorie limit exceeded by ${Math.abs(caloriesLeft)} kcal. Focus on fiber-rich greens for next meal.`
      });
    } else if (currentCals > 0) {
      insights.push({
        id: 'calories',
        type: 'success',
        icon: Utensils,
        color: 'text-emerald-400',
        label: 'Daily Energy',
        text: `Balanced intake so far. You have ${caloriesLeft} kcal remaining for your daily goal.`
      });
    }

    // Steps Pointer
    if (currentSteps > 0) {
      if (currentSteps < stepsGoal) {
        insights.push({
          id: 'steps',
          type: 'info',
          icon: Activity,
          color: 'text-blue-400',
          label: 'Activity Goal',
          text: `You're doing great! Just ${stepsGoal - currentSteps} more steps to reach your daily target.`
        });
      } else {
        insights.push({
          id: 'steps',
          type: 'success',
          icon: CheckCircle2,
          color: 'text-emerald-400',
          label: 'Activity Goal',
          text: `Goal reached! You've achieved your target of ${stepsGoal} steps today.`
        });
      }
    }

    // Recommendation/Summary Pointer
    const aiSummary = dashboardData.latestAnalysis?.summary;
    if (aiSummary && typeof aiSummary === 'string' && aiSummary.length > 10) {
      insights.push({
        id: 'summary',
        type: 'ai',
        icon: Sparkles,
        color: 'text-purple-400',
        label: 'AI Recommendation',
        text: aiSummary.includes('.') ? aiSummary.split('.')[0] + '.' : aiSummary
      });
    }

    return insights;
  }, [dashboardData, nutritionData]);

  const [trendTimeRange, setTrendTimeRange] = useState('1W');
  const [insightIndex, setInsightIndex] = useState(0);

  useEffect(() => {
    if (overallPerformanceInsight.length <= 1) return;
    const interval = setInterval(() => {
      setInsightIndex(prev => (prev + 1) % overallPerformanceInsight.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [overallPerformanceInsight.length]);

  const scrollContainerRef = useRef(null);
  const scrollTrackRef = useRef(null);
  const isDragging = useRef(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const force = dataRefreshTrigger > 0;
        await Promise.all([
          fetchDashboard(force),
          fetchNutrition(new Date().toISOString().split('T')[0], force),
          fetchWearable(force),
          fetchDietPlan(force).then(plan => setDietPlan(plan)),
          fetchNutritionLogs(new Date().toISOString().split('T')[0], force).then(logs => {
            const logMap = {};
            (logs || []).forEach(l => {
              if (l.foodItems) {
                l.foodItems.forEach(fi => {
                  logMap[`${l.mealType}-${fi.name}`] = true;
                });
              }
            });
            setLoggedMeals(logs || []);
            setLoggedMealsMap(logMap);
          })
        ]);

      } catch (err) {
        console.error("Dashboard mount load error:", err);
      }
    };
    loadData();
  }, [user, dataRefreshTrigger]);

  // Separate effect for diabetic status to ensure it shows immediately regardless of other data loads
  useEffect(() => {
    if (user?.profile) {
      const diabeticStatus = user.profile.isDiabetic === 'yes' ||
        user.profile.isDiabetic === true ||
        (user.profile.medicalHistory?.conditions?.some(c => c.toLowerCase().includes('diabetes')) && user.profile.isDiabetic !== 'no');
      setIsDiabetic(!!diabeticStatus);
    }
  }, [user]);

  const isMealLogged = (mealType, meal) => {
    if (!loggedMealsMap || !meal) return false;
    const name = meal?.name || meal?.foodItems?.[0]?.name;
    return !!loggedMealsMap[`${mealType}-${name}`];
  };

  // Calculate current meal based on time for initial state
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 11) setActiveMealTab('breakfast');
    else if (hour < 16) setActiveMealTab('lunch');
    else setActiveMealTab('dinner');
  }, []);

  const calorieDelta = (nutritionData?.totalCalories || 0) - (nutritionData?.calorieGoal || 2000);
  const isOverLimit = calorieDelta > 0;



  const handleScroll = () => {
    if (scrollContainerRef.current && !isDragging.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      const progress = (scrollLeft / (scrollWidth - clientWidth)) * 100;
      setScrollProgress(progress);
    }
  };

  const handleDrag = (e) => {
    if (!isDragging.current || !scrollTrackRef.current || !scrollContainerRef.current) return;
    const track = scrollTrackRef.current.getBoundingClientRect();
    const x = e.clientX - track.left;
    const scrollableWidth = scrollContainerRef.current.scrollWidth - scrollContainerRef.current.clientWidth;
    const progress = Math.max(0, Math.min(100, (x / track.width) * 100));
    setScrollProgress(progress);
    scrollContainerRef.current.scrollLeft = (progress / 100) * scrollableWidth;
  };

  useEffect(() => {
    const mouseUp = () => { isDragging.current = false; };
    const mouseMove = (e) => handleDrag(e);
    window.addEventListener('mouseup', mouseUp);
    window.addEventListener('mousemove', mouseMove);
    return () => {
      window.removeEventListener('mouseup', mouseUp);
      window.removeEventListener('mousemove', mouseMove);
    };
  }, []);

  // --- SYNC: DYNAMIC DEFICIENCY CALCULATION ---
  const dynamicDeficiencies = useMemo(() => {
    const nutrientMeta = {
      fiber: { name: 'Fiber', unit: 'g', food: 'Whole grains, Legumes', supplement: 'Psyllium Husk' },
      iron: { name: 'Iron', unit: 'mg', food: 'Spinach, Beetroot, Red Meat', supplement: 'Iron Supplements' },
      hemoglobin: { name: 'Iron', unit: 'mg', food: 'Spinach, Beetroot, Red Meat', supplement: 'Iron Supplements' },
      vitaminc: { name: 'Vitamin C', unit: 'mg', food: 'Oranges, Lemon, Amla', supplement: 'C-Vitamin' },
      vitamina: { name: 'Vitamin A', unit: 'mcg', food: 'Carrots, Sweet Potato', supplement: 'Beta Carotene' },
      vitamind: { name: 'Vitamin D', unit: 'mcg', food: 'Fatty Fish, Eggs, Sun', supplement: 'Vitamin D3' },
      calcium: { name: 'Calcium', unit: 'mg', food: 'Milk, Tofu, Almonds', supplement: 'Calcium + D3' },
      vitaminb12: { name: 'Vitamin B12', unit: 'mcg', food: 'Dairy, Eggs, Fortified foods', supplement: 'B12 Complex' },
      protein: { name: 'Protein', unit: 'g', food: 'Paneer, Eggs, Lentils', supplement: 'Whey Protein' }
    };

    // Priority 1: Use medical report deficiencies if they exist
    return (dashboardData?.latestAnalysis?.deficiencies || []).map(item => {
      const key = item.name.toLowerCase().replace(/\s+/g, '');
      const meta = nutrientMeta[key] || {};
      return {
        ...item,
        food: item.food || meta.food || 'Green leafy vegetables',
        supplement: item.supplement || meta.supplement || 'Consult a specialist',
        percent: item.percent || (item.current && item.target ? Math.min((item.current/item.target)*100, 100) : 0)
      };
    }).slice(0, 3);
  }, [dashboardData]);

  const cardCount = 3;
  const activeIndex = scrollProgress / (100 / (cardCount - 1 || 1));

  const scrollBy = (direction) => {
    if (scrollContainerRef.current) {
      const amount = 300;
      scrollContainerRef.current.scrollBy({ left: direction * amount, behavior: 'smooth' });
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Only show skeleton if we have NO data and we are currently loading
  if (!dashboardData && (loading.dashboard || loading.nutrition)) {
    return <DashboardSkeleton />;
  }

  console.log('Rendering Dashboard', { hasData: !!dashboardData, isDiabetic });
  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,#F2F5EC_0%,#EFF2E9_25%,#EBF0E6_50%,#E8EDE3_75%,#E5EBE0_100%)] text-[#064e3b] font-sans selection:bg-emerald-100 selection:text-emerald-900 overflow-x-hidden pb-12">
      {runTour && !isTourCompleted && (
        <Joyride
          steps={tourSteps}
          run={runTour && !isTourCompleted}
          continuous={true}
          showSkipButton={true}
          showProgress={true}
          scrollToFirstStep={false}
          disableScrolling={true}
          disableBeacon={true}
          callback={handleJoyrideCallback}
          floaterProps={{
            disableAnimation: false,
          }}
          styles={{
            options: {
              primaryColor: '#064e3b',
              zIndex: 10000,
              beaconSize: 0,
              disableBeacon: true
            }
          }}
        />
      )}
      <div className="max-w-7xl mx-auto px-0 md:px-8">

        {/* Header moved to Layout.jsx */}

        {/* AI Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="px-4 md:px-0 mb-4"
          style={{ marginTop: '15px' }}
        >
          <div
            onClick={() => navigate('/ai-chat')}
            className="w-full flex items-center gap-3 bg-gradient-to-r from-white/70 to-white/40 backdrop-blur-[2px] rounded-full px-4 border border-white/50 shadow-sm cursor-pointer hover:shadow-md transition-all relative"
            style={{ height: '51.26px', opacity: 1 }}
          >
            <div
              className="absolute bg-[#588975] flex items-center justify-center shrink-0 border border-[#588975]/10"
              style={{
                width: '38.4451789855957px',
                height: '38.4451789855957px',
                top: '6.41px',
                left: '6.41px',
                borderRadius: '30714396px',
                opacity: 1
              }}
            >
              <img src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Icon_11.png?v=1775649527" alt="" className="w-5 h-5 object-contain" />
            </div>
            <div className="flex-1 overflow-hidden h-5 relative ml-12">
              <AnimatePresence mode="wait">
                <motion.span
                  key={placeholderIndex}
                  initial={{ y: 5, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -5, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 text-sm text-[#1a1a1a]/60 font-medium truncate"
                >
                  {placeholders[placeholderIndex]}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Optimize Your Health Banner - Fully Responsive */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="px-4 md:px-0 mb-4 w-full"
        >
          <div className="relative overflow-hidden w-full min-h-[140px] rounded-[26px] border border-white/30">
            <img
              src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/6de313b1e5c8e1bb654eedecdc54a6f84116947a.jpg?v=1775563817"
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#2d3d32]/90 via-[#2d3d32]/75 to-[#2d3d32]/40" />
            
            <div className="relative z-10 p-5 flex flex-col h-full justify-between">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center shrink-0 border border-white/20">
                  <img src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Bacteria.svg?v=1775563872" alt="" className="w-5 h-5 brightness-0 invert" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Optimize Your Health
                    </h3>
                    <span className="px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded-md text-[8px] font-black text-white uppercase tracking-wider">NEW</span>
                  </div>
                  <p className="text-white/70 text-[11px] font-medium leading-tight mt-1 max-w-[240px]" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    Add details and lab reports to unlock tailored wellness insights.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 mt-4 w-full">
                <button
                  onClick={() => navigate('/profile')}
                  className="px-4 h-9 bg-white/10 backdrop-blur-md text-white font-medium border border-white/20 rounded-xl text-[10px] hover:bg-white/20 transition-all lowercase whitespace-nowrap"
                >
                  complete profile
                </button>
                <button
                  onClick={() => navigate('/upload')}
                  className="px-4 h-9 bg-[#5B8C6F] text-white font-medium rounded-xl text-[10px] shadow-lg shadow-[#5B8C6F]/30 hover:bg-[#4a7b5e] transition-all lowercase flex items-center gap-2 whitespace-nowrap"
                >
                  <img src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Icon_10.png?v=1775649527" alt="" className="w-3 h-3 invert brightness-0" />
                  upload report
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Desktop Action Buttons */}
        <div className="hidden lg:flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/nutrition', { state: { openLogMeal: true, mealType: 'Breakfast' } })} className="flex items-center gap-2 px-6 py-2.5 bg-white/60 backdrop-blur-md rounded-full text-sm font-semibold text-[#1a1a1a] hover:bg-white transition-all border border-[#E5EBE0] shadow-sm">
            <UtensilsCrossed className="w-4 h-4 text-[#5B8C6F]" /> Log Meal
          </button>
          <button onClick={() => { setActiveLogTab('Sleep'); setIsLogVitalsOpen(true); }} className="flex items-center gap-2 px-6 py-2.5 bg-white/60 backdrop-blur-md rounded-full text-sm font-semibold text-[#1a1a1a] hover:bg-white transition-all border border-[#E5EBE0] shadow-sm">
            <Moon className="w-4 h-4 text-[#5B8C6F]" /> Log Sleep
          </button>
          <button onClick={() => navigate('/upload')} className="flex items-center gap-2 px-6 py-2.5 bg-[#1a1a1a] text-white rounded-full text-sm font-semibold hover:bg-black transition-all shadow-md">
            <Upload className="w-4 h-4" /> Upload Reports
          </button>
        </div>

        {/* Main Content - Dynamic Grid */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 pb-12 w-full mt-2 px-4 md:px-0 focus-visible:outline-none scroll-smooth"
        >
          {/* Card 1: Calories & Daily Tracking */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="tour-nutrient-info w-full bg-white px-5 pb-5 pt-5 lg:px-8 lg:pb-8 lg:pt-8 border border-slate-100/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col relative overflow-hidden"
            style={{ 
              borderRadius: '29.29px', 
              marginTop: '8px'
            }}
          >
            {/* Calories Header */}
            <div className="mb-0">
              <h2 className="text-lg lg:text-xl font-bold text-[#1a1a1a] leading-tight">Calories</h2>
              <p className="text-[9px] text-[#a0a0a0] font-bold uppercase tracking-widest leading-none mt-0.5">Daily tracking</p>
            </div>

            {/* Dashed Gauge */}
            <div className="flex justify-center mb-0 -mt-14 lg:-mt-16 relative z-10 w-full overflow-visible">
              <DashedGauge
                value={nutritionData?.totalCalories || dashboardData?.nutritionData?.totalCalories || 0}
                max={user?.nutritionGoal?.calorieGoal || nutritionData?.calorieGoal || 2000}
                mode={nutrientMode}
              />
            </div>

            {/* Protein / Carbs / Fats Row - Unified Card - Balanced */}
            <div className="mt-2 mb-5 bg-[#FCF9EE] rounded-[18px] py-3 px-3 flex items-center justify-around gap-1 border border-[#f0f0ea]/30 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2">
                <img src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Icon_8.png?v=1775645708" alt="Protein" className="w-4 h-4 object-contain" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-black text-[#1a1a1a] leading-none">{Math.round(nutritionData?.totalProtein || 0)}g</span>
                  <span className="text-[7px] font-bold text-[#a0a0a0] uppercase tracking-tighter">Protein</span>
                </div>
              </div>

              <div className="h-5 w-px bg-[#f0f0ea]/50" />

              <div className="flex items-center gap-2 text-center">
                <img src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Icon_7.png?v=1775645656" alt="Carbs" className="w-4 h-4 object-contain" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-black text-[#1a1a1a] leading-none">{Math.round(nutritionData?.totalCarbs || 0)}g</span>
                  <span className="text-[7px] font-bold text-[#a0a0a0] uppercase tracking-tighter">Carbs</span>
                </div>
              </div>

              <div className="h-5 w-px bg-[#f0f0ea]/50" />

              <div className="flex items-center gap-2">
                <img src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Icon_9.png?v=1775645708" alt="Fats" className="w-4 h-4 object-contain" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-black text-[#1a1a1a] leading-none">{Math.round(nutritionData?.totalFats || 0)}g</span>
                  <span className="text-[7px] font-bold text-[#a0a0a0] uppercase tracking-tighter">Fats</span>
                </div>
              </div>
            </div>

            {/* Nutrient Info Toggle */}
            <div className="w-full" style={{ height: '24.71px', marginTop: '4px' }}>
              <button
                onClick={() => setShowNutrientDetails(!showNutrientDetails)}
                className="flex items-center justify-between w-full h-full border-t border-[#f0f0ea] pt-2"
              >
                <span className="text-sm font-bold text-[#1a1a1a]">Nutrient Info</span>
                <span className="text-xs text-[#5B8C6F] font-medium flex items-center gap-1">
                  View Details <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-300 ${showNutrientDetails ? 'rotate-90' : ''}`} />
                </span>
              </button>
            </div>

            {/* Expandable Micro Details - Top 3 */}
            <AnimatePresence>
              {showNutrientDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 pt-3 pb-2">
                    {(() => {
                      const micros = [
                        { label: 'Fiber', value: nutritionData?.totalFiber || 0, target: 30, unit: 'g', color: '#10b981' },
                        { label: 'Iron', value: nutritionData?.totalIron || 0, target: 18, unit: 'mg', color: '#F59E0B' },
                        { label: 'Vitamin C', value: nutritionData?.totalVitaminC || 0, target: 90, unit: 'mg', color: '#FF6B6B' },
                        { label: 'Vitamin A', value: nutritionData?.totalVitaminA || 0, target: 900, unit: 'mcg', color: '#8B5CF6' },
                        { label: 'Calcium', value: nutritionData?.totalCalcium || 0, target: 1000, unit: 'mg', color: '#3B82F6' },
                        { label: 'Vitamin D', value: nutritionData?.totalVitaminD || 0, target: 20, unit: 'mcg', color: '#F59E0B' },
                        { label: 'B12', value: nutritionData?.totalVitaminB12 || 0, target: 2.4, unit: 'mcg', color: '#EF4444' }
                      ];
                      return micros
                        .map(m => ({ ...m, percent: Math.min((m.value / m.target) * 100, 100) }))
                        .sort((a, b) => a.percent - b.percent)
                        .slice(0, 3)
                        .map((micro) => (
                          <div key={micro.label} className="group">
                            <div className="flex justify-between items-center mb-1.5">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: micro.color }} />
                                <span className="text-xs font-semibold text-[#1a1a1a]">{micro.label}</span>
                              </div>
                              <span className="text-[10px] font-bold text-[#8a8a8a]">{micro.value.toFixed(1)} / {micro.target}{micro.unit}</span>
                            </div>
                            <div className="h-1.5 bg-[#f0f0ea] rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${micro.percent}%` }}
                                transition={{ duration: 0.8 }}
                                className="h-full rounded-full"
                                style={{ backgroundColor: micro.color }}
                              />
                            </div>
                          </div>
                        ));
                    })()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Card 2: Today's Diet Plan */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="tour-diet-plan w-full bg-white border border-[#f0f0ea] shadow-sm flex flex-col relative overflow-hidden"
            style={{ 
              minHeight: '400px', 
              borderRadius: '29.29px', 
              marginTop: '8px'
            }}
          >
            {/* Header Row */}
            <div className="flex items-center justify-between px-5 pt-6 pb-4 w-full">
              <h2
                className="text-[#1a1a1a] font-semibold text-base"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  letterSpacing: '-0.43px',
                  margin: 0
                }}
              >
                Today's Diet
              </h2>
              <div className="bg-[#FAFBF8] rounded-full border border-[#f0f0ea] flex items-center gap-1.5 shadow-sm px-3 py-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#5B8C6F]" />
                <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: '600', fontSize: '11px', color: '#5B8C6F' }}>
                  {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Meal Tabs Row */}
            <div className="px-5 mb-4 w-full overflow-x-auto scrollbar-hide">
              <div className="flex items-center gap-2">
                {[
                  { id: 'breakfast', label: 'Breakfast' },
                  { id: 'midMorningSnack', label: 'Mid-Morning' },
                  { id: 'lunch', label: 'Lunch' },
                  { id: 'eveningSnack', label: 'Evening' },
                  { id: 'dinner', label: 'Dinner' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveMealTab(tab.id)}
                    className={`transition-all whitespace-nowrap flex-none h-[32.5px] px-4 rounded-full font-semibold text-xs transition-all ${
                      activeMealTab === tab.id
                        ? 'bg-[#76B39D] text-white shadow-lg shadow-[#76B39D]/30'
                        : 'bg-[#FAFBF8] text-[#8a8a8a] border border-[#f0f0ea] hover:bg-[#E8F3EE]'
                    }`}
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Meal Content Area */}
            <div className="flex-1 flex flex-col min-h-[220px] w-full">
              {(!dietPlan || !dietPlan.mealPlan) ? (
                <div className="mx-5 my-4 flex flex-col items-center justify-center text-center bg-[#F9FAF5] rounded-[24px] border border-[#f0f0ea] py-10">
                  <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-md mb-4 border border-[#E8F3EE]">
                    <Utensils className="w-7 h-7 text-[#76B39D]" />
                  </div>
                  <p className="text-sm font-bold text-[#1a1a1a] uppercase tracking-wide">No Plan Today</p>
                </div>
              ) : (
                <div className="w-full">
                  {(() => {
                    const meals = dietPlan.mealPlan[activeMealTab] || [];
                    if (meals.length === 0) {
                      return (
                        <div className="mx-5 my-2 p-8 bg-[#F9FAF5] rounded-[24px] text-center border border-[#f0f0ea]">
                          <p className="text-[11px] font-bold text-[#a0a0a0] uppercase tracking-wider">No meals logged for {activeMealTab}</p>
                        </div>
                      );
                    }
                    return (
                      <div className="w-full">
                        <div
                          className="flex overflow-x-auto scrollbar-hide snap-x snap-mandatory w-full px-8 scroll-px-8 gap-6 pb-6"
                          onScroll={(e) => {
                            const scrollLeft = e.target.scrollLeft;
                            const cardWidth = 232; 
                            const index = Math.round(scrollLeft / cardWidth);
                            setActiveDietSlide(Math.min(index, meals.length - 1));
                          }}
                        >
                          {meals.map((item, idx) => {
                            const foodName = item?.name || item?.foodItems?.[0]?.name || 'food';
                            const bingThumb = `https://tse1.mm.bing.net/th?q=${encodeURIComponent(foodName + ' indian food')}&w=400&h=400&c=7&o=5&pid=Api&mkt=en-IN`;
                            return (
                              <div key={idx} className="relative flex-none w-[208px] h-[172px] group snap-start">
                                {/* Meal Image Floating */}
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[102px] h-[100px] z-20 rounded-full border-[3px] border-white shadow-xl overflow-hidden bg-white group-hover:scale-105 transition-transform duration-500">
                                  <img 
                                    src={item?.imageUrl || bingThumb} 
                                    alt={foodName} 
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.target.src = bingThumb; }}
                                  />
                                </div>
                                {/* Content Card */}
                                <div className="absolute bottom-0 left-0 w-full h-[122px] bg-[#F6F7F2] rounded-[22px] border border-[#ededdf] pt-[55px] px-4 pb-3 z-10 text-left">
                                  <h4 className="truncate font-bold text-[13px] text-[#1a1a1a] mb-1.5" style={{ fontFamily: 'Poppins, sans-serif' }}>{foodName}</h4>
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1 text-[#6B7280]">
                                      <Clock className="w-3 h-3 text-[#FF7E5F]" />
                                      <span className="text-[10px] font-medium">12 Min</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[#6B7280]">
                                      <Flame className="w-3 h-3 text-[#FF7E5F]" />
                                      <span className="text-[10px] font-medium">{item?.calories || '280'} Cal</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Pagination */}
                        <div className="flex justify-center items-center gap-1.5 py-1">
                          {meals.map((_, i) => (
                            <div
                              key={i}
                              className={`transition-all duration-300 h-[7px] rounded-full ${activeDietSlide === i ? 'w-4 bg-[#76B39D]' : 'w-[7px] bg-[#d4d4d4]'}`}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Bottom Button */}
            <div className="px-5 pb-6 mt-auto">
              <button
                onClick={() => navigate('/diet-plan')}
                className="w-full h-[46px] bg-[#76B39D] text-white font-bold rounded-[18px] shadow-lg shadow-[#76B39D]/30 flex items-center justify-center gap-2 hover:bg-[#65a18b] active:scale-95 transition-all"
                style={{ fontFamily: 'Poppins, sans-serif', fontSize: '14px' }}
              >
                View Full Plan <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </motion.div>

          {/* Card 3: AI Lab Insights */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="tour-ai-insights w-full bg-white rounded-[24px] p-5 lg:p-8 border border-slate-100/80 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col relative overflow-hidden"
            style={{
              marginTop: '8px'
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl lg:text-2xl font-bold text-[#1a1a1a]">Lab Insights</h2>
                <p className="text-xs text-[#a0a0a0] font-medium">Biological markers</p>
              </div>
              <button
                onClick={() => navigate('/upload')}
                className="text-[10px] font-bold text-[#5B8C6F] uppercase tracking-wider flex items-center gap-1 hover:text-[#4a7b5e] transition-colors"
              >
                Upload <Plus className="w-3 h-3" />
              </button>
            </div>

            <div className="flex-1 space-y-3 min-h-[180px]">
              {dashboardData?.processingReport ? (
                <div className="flex flex-col items-center justify-center p-6 bg-[#FAFBF8] rounded-[24px] text-center border border-[#f0f0ea]">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 border border-[#E8F3EE]">
                    <Clock className="w-6 h-6 text-[#5B8C6F] animate-spin" />
                  </div>
                  <p className="text-xs font-bold text-[#1a1a1a] uppercase tracking-wider mb-1">Analyzing Report</p>
                  <p className="text-[9px] font-medium text-[#a0a0a0] max-w-[150px] leading-relaxed uppercase tracking-wider">Our AI is processing your health data...</p>
                </div>
              ) : dashboardData?.totalReports > 0 && dashboardData?.latestAnalysis?.metrics && Object.keys(dashboardData.latestAnalysis.metrics).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(dashboardData.latestAnalysis.metrics).slice(0, 3).map(([key, val]) => (
                    <div key={key} className="p-3 bg-[#FAFBF8] rounded-2xl border border-[#f0f0ea] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-white border border-[#E8F3EE] flex items-center justify-center">
                          {key.toLowerCase().includes('glucose') ? <Droplet className="w-4 h-4 text-[#FF6B6B]" /> : <Activity className="w-4 h-4 text-[#5B8C6F]" />}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[#8a8a8a] uppercase leading-none mb-1">{key}</p>
                          <p className="text-sm font-black text-[#1a1a1a]">{typeof val === 'object' ? `${val.value} ${val.unit || ''}` : val}</p>
                        </div>
                      </div>
                      <span className={`text-[8px] font-black px-2 py-1 rounded-md uppercase tracking-wider ${(typeof val === 'object' && val.status?.toLowerCase().includes('normal')) ? 'bg-[#E8F3EE] text-[#5B8C6F]' : 'bg-[#FFF5F5] text-[#FF6B6B]'
                        }`}>
                        {(typeof val === 'object' && val.status) ? val.status : "Normal"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 bg-[#FAFBF8] rounded-[24px] text-center border border-[#f0f0ea] h-full">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 border border-[#E8F3EE]">
                    <Upload className="w-6 h-6 text-[#5B8C6F]" />
                  </div>
                  <p className="text-xs font-bold text-[#1a1a1a] uppercase tracking-wider mb-1">No Reports</p>
                  <p className="text-[9px] font-medium text-[#a0a0a0] mb-4 max-w-[150px] leading-relaxed uppercase tracking-wider text-center">Add lab reports to get biological insights</p>
                  <button
                    onClick={() => navigate('/upload')}
                    className="px-5 py-2 bg-[#5B8C6F] text-white rounded-full text-[9px] font-bold uppercase tracking-widest shadow-lg shadow-[#5B8C6F]/10 hover:scale-[1.02] transition-all"
                  >
                    Upload Now
                  </button>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#5B8C6F]" />
                <span className="text-[9px] font-bold text-[#5B8C6F] uppercase tracking-widest">Recommendation</span>
              </div>
              <p className="text-[11px] font-medium text-[#1a1a1a] leading-relaxed line-clamp-2 italic">
                {dashboardData?.latestAnalysis?.recommendations?.lifestyle?.[0] ?
                  `"${dashboardData.latestAnalysis.recommendations.lifestyle[0]}"` :
                  "Add details to unlock tailored insights."
                }
              </p>
            </div>
          </motion.div>
        </div>



        {/* Diabetes Monitor Block */}
        {
          isDiabetic && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mx-4 lg:mx-0 bg-white border border-[#f0f0ea] rounded-[32px] p-5 lg:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)] relative overflow-hidden mt-8 mb-8"
            >
              <div className="relative z-10">
                <div className="flex flex-row items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl lg:text-2xl font-bold text-[#1a1a1a]">Diabetes Monitor</h2>
                    <p className="text-xs text-[#a0a0a0] font-medium">Track glucose & HbA1c</p>
                  </div>
                  <button
                    onClick={() => navigate('/diabetes')}
                    className="px-4 py-2 bg-[#FAFBF8] border border-[#f0f0ea] hover:bg-[#E8F3EE] text-[#5B8C6F] rounded-full text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Log Reading
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 lg:gap-6">
                  {(!dashboardData?.latestAnalysis && !dashboardData?.vitals?.glucose && !dashboardData?.vitals?.hba1c) ? (
                    <div className="col-span-2 bg-[#FAFBF8] border border-[#f0f0ea] rounded-[24px] p-8 text-center flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 border border-[#E8F3EE]">
                        <Sparkles className="w-6 h-6 text-[#5B8C6F]" />
                      </div>
                      <p className="text-[#1a1a1a] text-sm font-bold mb-1 uppercase tracking-wider">Ready to Monitor</p>
                      <p className="text-[#a0a0a0] text-[10px] max-w-[200px] leading-relaxed uppercase tracking-widest font-medium">
                        Upload report or log glucose to see insights.
                      </p>
                    </div>
                  ) : (
                    <>
                      {[
                        {
                          label: 'Glucose',
                          val: dashboardData?.vitals?.glucose?.value || dashboardData?.latestAnalysis?.metrics?.Glucose?.value || '--',
                          unit: 'mg/dL',
                          status: dashboardData?.latestAnalysis?.metrics?.Glucose?.status || (dashboardData?.vitals?.glucose ? 'Recent' : 'Normal'),
                          color: '#5B8C6F',
                          bg: 'bg-[#E8F3EE]'
                        },
                        {
                          label: 'HbA1c',
                          val: dashboardData?.vitals?.hba1c?.value || dashboardData?.latestAnalysis?.metrics?.HbA1c?.value || '--',
                          unit: '%',
                          status: dashboardData?.latestAnalysis?.metrics?.HbA1c?.status || (dashboardData?.vitals?.hba1c ? 'Recent' : 'Good'),
                          color: '#F59E0B',
                          bg: 'bg-[#FFF8ED]'
                        }
                      ].map((stat) => (
                        <div key={stat.label} className="bg-[#FAFBF8] border border-[#f0f0ea] shadow-sm rounded-[24px] p-5 lg:p-7 flex flex-col items-center justify-center group hover:bg-white hover:shadow-md transition-all">
                          <span className="text-[#a0a0a0] text-[10px] font-bold uppercase tracking-widest mb-2">{stat.label}</span>
                          <div className="flex items-baseline gap-1 mb-3">
                            <span className="text-3xl lg:text-4xl font-black text-[#1a1a1a] tracking-tighter">{stat.val}</span>
                            {stat.val !== '--' && <span className="text-[10px] lg:text-xs font-bold text-[#d1d1d1] uppercase">{stat.unit}</span>}
                          </div>
                          <span className={`text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${stat.val === '--' ? 'bg-[#f5f5f5] text-[#b0b0b0]' : `${stat.bg} text-[#1a1a1a]`}`}>
                            {stat.status}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}



        {/* Health DNA Entry Card - Disabled as requested */}
        {/* 
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        onClick={() => navigate('/health-dna')}
        whileHover={{ scale: 1.01 }}
        className="tour-health-profile mx-4 lg:mx-0 mb-8 p-6 bg-gradient-to-br from-[#064e3b] to-[#042f24] rounded-[2rem] shadow-xl relative overflow-hidden cursor-pointer group"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-emerald-400/20 transition-all" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 lg:w-14 lg:h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
              <Dna className="w-6 h-6 lg:w-8 lg:h-8 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg lg:text-xl font-bold text-white mb-1">Your Health Profile</h3>
              <p className="text-emerald-400/60 text-[10px] font-black uppercase tracking-widest leading-none">Complete Personalized Profile</p>
            </div>
          </div>
          </div>
        </div>
      </motion.div>
      */}

        {/* Your Logged Meals */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="tour-logged-meals mb-8 w-full px-6 md:px-0"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-[#1a1a1a]">Logged Meals</h2>
            <button onClick={() => navigate('/nutrition')} className="text-xs font-bold text-[#5B8C6F] hover:text-[#4a7b5e] uppercase tracking-wider">View Menu</button>
          </div>
          
          <div 
            className="flex overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-6 gap-[11px] w-full" 
            style={{ 
              height: '220px'
            }}
          >
            {loggedMeals.length > 0 ? (
              [...loggedMeals].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map((meal, idx) => {
                const foodName = meal.name || meal.foodItems?.[0]?.name || 'Meal';
                const bingThumb = `https://tse1.mm.bing.net/th?q=${encodeURIComponent(foodName + ' indian food')}&w=400&h=300&c=7&o=5&pid=Api`;
                
                return (
                  <div 
                    key={idx}
                    className="bg-white shadow-sm flex flex-col flex-none snap-start group cursor-pointer border border-[#f0f0ea]/50"
                    style={{ 
                      width: 'calc(50% - 6px)', 
                      height: '210px', 
                      borderRadius: '24px' 
                    }}
                    onClick={() => navigate('/nutrition', { state: { prefillData: meal } })}
                  >
                    {/* Image Area */}
                    <div className="p-2 w-full h-[105px]">
                      <div className="w-full h-full relative overflow-hidden rounded-[20px]">
                        <img 
                          src={meal.imageUrl || bingThumb} 
                          alt={foodName} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                          onError={(e) => { e.target.src = bingThumb; }}
                        />
                        <div className="absolute top-2 left-2 px-2 py-0.5 bg-white/70 backdrop-blur-md rounded-full border border-white/20">
                          <span className="text-[8px] font-black text-[#5B8C6F] uppercase tracking-wider">{meal.mealType || 'Meal'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Content Area */}
                    <div className="px-3 py-2 flex flex-col flex-1">
                      <h4 className="text-[11px] font-bold text-[#1a1a1a] truncate mb-0.5" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        {foodName}
                      </h4>
                      <p className="text-[9px] font-medium text-[#90A1B9] mb-auto">
                        {meal.totalNutrition?.calories || meal.calories || 200} kcal • {meal.totalNutrition?.protein || meal.protein || 0}g Pro
                      </p>
                      
                      <button 
                        className="w-full h-[32px] bg-[#76B39D] rounded-xl flex items-center justify-center active:scale-95 transition-all shadow-sm group-hover:bg-[#65a18b] mt-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/nutrition');
                        }}
                      >
                        <span className="text-[9px] font-black text-white uppercase tracking-wider">VIEW</span>
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div 
                className="w-full flex-none flex flex-col items-center justify-center p-8 bg-[#FAFBF8] rounded-[32px] border border-[#f0f0ea] text-center"
                style={{ height: '208.24px' }}
              >
                <Utensils className="w-8 h-8 text-[#5B8C6F] mb-3" />
                <h3 className="text-md font-bold text-[#1a1a1a] uppercase tracking-tight mb-2">No Meals Logged</h3>
                <button
                  onClick={() => navigate('/nutrition')}
                  className="px-6 py-2 bg-[#5B8C6F] text-white rounded-xl text-[9px] font-bold uppercase tracking-widest shadow-md transition-all"
                >
                  Log First Meal
                </button>
              </div>
            )}
          </div>



        </motion.div>

        {/* Bottom Grid - Consistent with Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 lg:mb-12 px-4 md:px-0">


          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="hidden lg:flex flex-col"
          >

            {/* 30 Day Challenge Mini Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              onClick={() => navigate('/challenge')}
              className="mt-4 bg-gradient-to-br from-[#064e3b] to-[#042f2e] rounded-[24px] p-5 text-emerald-50 shadow-lg cursor-pointer relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50/10 flex items-center justify-center">
                    <Flame className="w-5 h-5 text-emerald-400 fill-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-200/50">Challenge</h4>
                    <p className="text-base font-bold text-emerald-50">{dashboardData?.streakDays || 0} Day Streak</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-emerald-300/50 group-hover:translate-x-1 transition-transform" />
              </div>
              <div className="mt-4 h-1.5 bg-emerald-950/20 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full w-[40%]" />
              </div>
            </motion.div>
          </motion.div>

          {/* Nutrition Deficiency Tracker */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white rounded-[28px] p-4 lg:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col h-full border border-slate-100/50"
          >
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#1A1A1A]/5 flex items-center justify-center">
                  <FlaskConical className="w-4 h-4 text-[#1a1a1a]" />
                </div>
                <h3 className="text-sm font-semibold text-[#064e3b]">Nutrition Deficiency</h3>
              </div>
              <button className="text-[10px] font-bold text-[#888888] hover:text-[#1a1a1a] uppercase tracking-wide">Detailed &rarr;</button>
            </div>
            <div className="space-y-6 flex-1 overflow-y-auto pr-2 pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
              {dynamicDeficiencies?.length > 0 ? (
                dynamicDeficiencies.map((item, i) => {
                  const isRisk = item.status?.toLowerCase().includes('risk') || item.status?.toLowerCase().includes('deficient');
                  const statusColor = isRisk ? 'text-white bg-black' : 'text-black bg-slate-100';
                  const barColor = isRisk ? 'bg-black' : 'bg-slate-400';

                  return (
                    <div key={i} className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#1a1a1a]">{item.name}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor}`}>
                            {item.status}
                          </span>
                        </div>
                        <div className="text-xs text-[#888888]">
                          <span className="font-bold text-[#1a1a1a] text-sm">{item.currentValue || item.current}</span>/{item.normalRange || item.target} {item.unit}
                        </div>
                      </div>

                      <div className="h-2 w-full bg-[#F5F5F7] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.percent || 0}%` }}
                          transition={{ duration: 1, delay: 0.8 + (i * 0.1) }}
                          className={`h-full ${barColor} rounded-full`}
                        />
                      </div>

                      <div className="flex flex-col gap-1 mt-1 p-2 bg-white/40 rounded-xl border border-white">
                        <div className="flex items-start gap-2 text-[10px] text-[#666666]">
                          <Leaf className="w-3 h-3 text-[#1a1a1a] flex-shrink-0 mt-0.5" />
                          <span><span className="font-semibold text-[#1a1a1a]">Eat more:</span> {item.food}</span>
                        </div>
                        <div className="flex items-start gap-2 text-[10px] text-[#666666]">
                          <Pill className="w-3 h-3 text-[#1a1a1a] flex-shrink-0 mt-0.5" />
                          <span><span className="font-semibold text-[#1a1a1a]">Supplement:</span> {item.supplement}</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="flex flex-col items-center justify-center p-10 bg-emerald-50/20 rounded-[2rem] border border-emerald-100/30 text-center">
                  {dashboardData?.latestAnalysis?.deficiencies?.length > 0 ? (
                    <>
                      <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-4" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">
                        Great job! No deficiencies <br /> found in your reports
                      </p>
                    </>
                  ) : (
                    <>
                      <FileText className="w-10 h-10 text-slate-300 mb-4" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">
                        Upload lab reports to see <br /> nutritional insights
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>

          {/* Care Plan */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-white rounded-[28px] p-4 lg:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/50 flex flex-col"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#1A1A1A]/5 flex items-center justify-center border border-white/40 shadow-sm">
                  <FileText className="w-4 h-4 text-[#064e3b]" />
                </div>
                <h3 className="text-sm font-semibold text-[#064e3b]">Care Plan</h3>
              </div>
              <span className="text-xl font-light text-[#1a1a1a]">
                {completedTasks.length}
                <span className="text-sm text-[#888888]">/{(() => {
                  const defaultTasks = ['Drink 3L Water', 'Morning walk 20 mins', 'Take Multivitamins', '8 Hours Sleep'];
                  const metrics = dashboardData?.latestAnalysis?.metrics || {};
                  const conditions = user?.profile?.medicalHistory?.conditions || [];
                  const hasCondition = (name) => conditions.some(c => c.toLowerCase().includes(name.toLowerCase()));
                  const isHigh = (name) => {
                    const metric = Object.values(metrics).find(m => m.name?.toLowerCase().includes(name.toLowerCase()) || m.label?.toLowerCase().includes(name.toLowerCase()));
                    return metric?.status?.toLowerCase().includes('high') || metric?.status?.toLowerCase().includes('risk');
                  };
                  if (isDiabetic || hasCondition('diabetes')) {
                    defaultTasks[0] = 'Check Glucose Level';
                    defaultTasks[2] = 'Sugar-free Breakfast';
                  }
                  if (hasCondition('hypertension') || isHigh('pressure')) { defaultTasks.push('Check Blood Pressure'); defaultTasks[0] = 'Low Sodium Meals'; }
                  if (hasCondition('anemia') || isHigh('hemoglobin')) { defaultTasks.push('Iron-rich Foods'); defaultTasks[2] = 'Take Iron Supplement'; }
                  if (isHigh('cholesterol')) { defaultTasks.push('Omega-3 Supplement'); defaultTasks[3] = 'Fiber-rich Dinner'; }
                  if (isOverLimit) { defaultTasks[1] = 'Extra 15m Cardio'; if (defaultTasks.length < 5) defaultTasks.push('Log Extra Calories'); }
                  return (dashboardData?.latestAnalysis?.recommendations?.lifestyle || defaultTasks.slice(0, 5)).length;
                })()}</span>
              </span>
            </div>
            <div className="space-y-5 flex-1 min-h-0 overflow-y-auto pr-1">
              {(() => {
                const defaultTasks = [
                  'Drink 3L Water',
                  'Morning walk 20 mins',
                  'Take Multivitamins',
                  '8 Hours Sleep'
                ];

                // Check for various health conditions from profile and analysis metrics
                const metrics = dashboardData?.latestAnalysis?.metrics || {};
                const conditions = user?.profile?.medicalHistory?.conditions || [];

                const hasCondition = (name) => conditions.some(c => c.toLowerCase().includes(name.toLowerCase()));
                const isHigh = (name) => {
                  const metric = Object.values(metrics).find(m => m.name?.toLowerCase().includes(name.toLowerCase()) || m.label?.toLowerCase().includes(name.toLowerCase()));
                  return metric?.status?.toLowerCase().includes('high') || metric?.status?.toLowerCase().includes('risk');
                };

                if (isDiabetic || hasCondition('diabetes')) {
                  defaultTasks[0] = 'Check Glucose Level';
                  defaultTasks[2] = 'Sugar-free Breakfast';
                }

                if (hasCondition('hypertension') || isHigh('pressure')) {
                  defaultTasks.push('Check Blood Pressure');
                  defaultTasks[0] = 'Low Sodium Meals';
                }

                if (hasCondition('anemia') || isHigh('hemoglobin')) {
                  defaultTasks.push('Iron-rich Foods');
                  defaultTasks[2] = 'Take Iron Supplement';
                }

                if (isHigh('cholesterol')) {
                  defaultTasks.push('Omega-3 Supplement');
                  defaultTasks[3] = 'Fiber-rich Dinner';
                }

                if (isOverLimit) {
                  defaultTasks[1] = 'Extra 15m Cardio';
                  if (defaultTasks.length < 5) defaultTasks.push('Log Extra Calories');
                }

                const tasksToRender = (dashboardData?.latestAnalysis?.recommendations?.lifestyle || defaultTasks.slice(0, 5));

                return tasksToRender.map((task, i) => {
                  const isCompleted = completedTasks.includes(i);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-4 group cursor-pointer"
                      onClick={() => {
                        setCompletedTasks(prev =>
                          prev.includes(i) ? prev.filter(t => t !== i) : [...prev, i]
                        );
                      }}
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors flex-shrink-0 ${isCompleted ? 'border-[#1a1a1a] bg-[#1a1a1a]' : 'border-slate-300 group-hover:border-slate-400'}`}>
                        {isCompleted && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <span className={`text-[11px] font-semibold transition-colors uppercase tracking-tight ${isCompleted ? 'text-[#a0a0a0] line-through decoration-[#a0a0a0]' : 'text-[#1a1a1a] group-hover:text-slate-600'}`}>
                        {task}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="h-1.5 bg-[#F5F5F7] rounded-full overflow-hidden mb-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(completedTasks.length / (() => {
                      const defaultTasks = ['Drink 3L Water', 'Morning walk 20 mins', 'Take Multivitamins', '8 Hours Sleep'];
                      const metrics = dashboardData?.latestAnalysis?.metrics || {};
                      const conditions = user?.profile?.medicalHistory?.conditions || [];
                      const hasCondition = (name) => conditions.some(c => c.toLowerCase().includes(name.toLowerCase()));
                      const isHigh = (name) => {
                        const metric = Object.values(metrics).find(m => m.name?.toLowerCase().includes(name.toLowerCase()) || m.label?.toLowerCase().includes(name.toLowerCase()));
                        return metric?.status?.toLowerCase().includes('high') || metric?.status?.toLowerCase().includes('risk');
                      };
                      if (isDiabetic || hasCondition('diabetes')) {
                        defaultTasks[0] = 'Check Glucose Level';
                        defaultTasks[2] = 'Sugar-free Breakfast';
                      }
                      if (hasCondition('hypertension') || isHigh('pressure')) { defaultTasks.push('Check Blood Pressure'); defaultTasks[0] = 'Low Sodium Meals'; }
                      if (hasCondition('anemia') || isHigh('hemoglobin')) { defaultTasks.push('Iron-rich Foods'); defaultTasks[2] = 'Take Iron Supplement'; }
                      if (isHigh('cholesterol')) { defaultTasks.push('Omega-3 Supplement'); defaultTasks[3] = 'Fiber-rich Dinner'; }
                      if (isOverLimit) { defaultTasks[1] = 'Extra 15m Cardio'; if (defaultTasks.length < 5) defaultTasks.push('Log Extra Calories'); }
                      return (dashboardData?.latestAnalysis?.recommendations?.lifestyle || defaultTasks.slice(0, 5)).length;
                    })()) * 100}%`
                  }}
                  transition={{ duration: 1, delay: 1 }}
                  className="h-full bg-[#1a1a1a] rounded-full"
                />
              </div>
              <p className="text-xs text-center text-[#888888] font-bold uppercase tracking-wider">
                {(() => {
                  const defaultTasks = ['Drink 3L Water', 'Morning walk 20 mins', 'Take Multivitamins', '8 Hours Sleep'];
                  const metrics = dashboardData?.latestAnalysis?.metrics || {};
                  const conditions = user?.profile?.medicalHistory?.conditions || [];
                  const hasCondition = (name) => conditions.some(c => c.toLowerCase().includes(name.toLowerCase()));
                  const isHigh = (name) => {
                    const metric = Object.values(metrics).find(m => m.name?.toLowerCase().includes(name.toLowerCase()) || m.label?.toLowerCase().includes(name.toLowerCase()));
                    return metric?.status?.toLowerCase().includes('high') || metric?.status?.toLowerCase().includes('risk');
                  };
                  if (isDiabetic || hasCondition('diabetes')) {
                    defaultTasks[0] = 'Check Glucose Level';
                    defaultTasks[2] = 'Sugar-free Breakfast';
                  }
                  if (hasCondition('hypertension') || isHigh('pressure')) { defaultTasks.push('Check Blood Pressure'); defaultTasks[0] = 'Low Sodium Meals'; }
                  if (hasCondition('anemia') || isHigh('hemoglobin')) { defaultTasks.push('Iron-rich Foods'); defaultTasks[2] = 'Take Iron Supplement'; }
                  if (isHigh('cholesterol')) { defaultTasks.push('Omega-3 Supplement'); defaultTasks[3] = 'Fiber-rich Dinner'; }
                  if (isOverLimit) { defaultTasks[1] = 'Extra 15m Cardio'; if (defaultTasks.length < 5) defaultTasks.push('Log Extra Calories'); }
                  const list = (dashboardData?.latestAnalysis?.recommendations?.lifestyle || defaultTasks.slice(0, 5));
                  return Math.max(0, list.length - completedTasks.length);
                })()} tasks remaining
              </p>
            </div>
          </motion.div>
        </div>

        {/* Vitals Log Modal - Unified Bottom Sheet for Weight, Steps, Sleep, Water */}
        <AnimatePresence>
          {isLogVitalsOpen && (
            <>
              {/* Dark Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[70]"
                onClick={() => setIsLogVitalsOpen(false)}
              />

              {/* Bottom Sheet */}
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed bottom-0 left-0 w-full h-[90vh] bg-[#FAFAFA] rounded-t-[40px] shadow-[0_-20px_60px_rgba(15,23,42,0.15)] z-[71] flex flex-col border-t border-white overflow-hidden"
              >
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/20 rounded-full z-20" />

                {/* Seamless Dark Header Section - Flush with top/sides */}
                <div className="bg-[#0F172A] pt-8 px-6 pb-10 rounded-b-[40px] relative text-white shadow-xl overflow-hidden border-b border-white/5">
                  {/* Visual Glows */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full" />

                  {/* Close Button - Compact Circular Styled */}
                  <button
                    onClick={() => setIsLogVitalsOpen(false)}
                    className="absolute top-6 right-6 w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-all z-30"
                  >
                    <Plus className="w-4 h-4 rotate-45 text-white" />
                  </button>

                  <div className="relative z-20 flex flex-col gap-3">
                    {/* Dynamic Badge */}
                    <div className="flex justify-start">
                      <div className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
                        {activeLogTab === 'Weight' && <Scale className="w-3 h-3 text-white/50" />}
                        {activeLogTab === 'Water' && <Droplet className="w-3 h-3 text-white/50" />}
                        {activeLogTab === 'Steps' && <Footprints className="w-3 h-3 text-white/50" />}
                        {activeLogTab === 'Sleep' && <Moon className="w-3 h-3 text-white/50" />}
                        <span className="text-[9px] font-black text-white/60 uppercase tracking-[0.1em]">Activity Log</span>
                      </div>
                    </div>

                    <h3 className="text-xl font-black uppercase leading-tight tracking-tight">Track {activeLogTab}</h3>
                  </div>
                </div>

                {/* Navigation Tabs - Cleaner Spacing */}
                <div className="px-6 relative z-30 mt-4 mb-4">
                  <div className="bg-white p-1 rounded-[22px] shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-slate-100 flex gap-1 items-stretch">
                    {[
                      { id: 'Weight', icon: Scale },
                      { id: 'Water', icon: Droplet },
                      { id: 'Steps', icon: Footprints },
                      { id: 'Sleep', icon: Moon }
                    ].map(({ id, icon: Icon }) => {
                      const isActive = activeLogTab === id;
                      return (
                        <button
                          key={id}
                          onClick={() => setActiveLogTab(id)}
                          className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-[18px] transition-all duration-300 ${isActive
                            ? 'bg-[#F8FAFC] shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] border border-[#F1F5F9] text-[#1D293D]'
                            : 'text-[#94A3B8] hover:bg-slate-50'
                            }`}
                        >
                          <Icon className={`w-4 h-4 mb-1 ${isActive ? 'text-[#1F5C49]' : 'text-[#94A3B8]'}`} />
                          <span className={`text-[8.5px] uppercase tracking-wider ${isActive ? 'font-black' : 'font-bold'}`}>{id}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dynamic Content Mapping */}
                <div className="flex-1 overflow-y-auto lg:overflow-visible pb-24 lg:pb-12 pt-0 md:pt-4 px-0 md:px-0 max-w-7xl mx-auto w-full">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeLogTab}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="py-4"
                    >
                      {activeLogTab === 'Weight' && (
                        <div className="space-y-6">
                          {/* Summary Card - High Fidelity */}
                          <div className="bg-white border border-[#E8F3EE] shadow-[0_1px_3px_rgba(0,0,0,0.1)] rounded-[32px] p-8 relative group">
                            <div className="flex items-center justify-between mb-10">
                              <h4 className="text-lg font-bold text-[#90A1B9]">Current <span className="text-[#1D293D] font-black">{(Number(vitalsInput.weight) || Number(user?.profile?.weight) || 72.5).toFixed(1)} kg</span></h4>
                              <div className="px-3 py-1 bg-[#E8F3EE] rounded-full flex items-center gap-1.5 ">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#1F5C49]" />
                                <span className="text-[9px] font-black text-[#1F5C49] uppercase tracking-widest">Live</span>
                              </div>
                            </div>

                            {/* Semi-Circle Gauge */}
                            <div className="flex flex-col items-center justify-center my-10 relative">
                              <div className="relative w-[220px] h-[130px]">
                                <svg width="220" height="130" viewBox="0 0 220 130">
                                  <path d="M 20 120 A 80 80 0 0 1 200 120" fill="none" stroke="#F1F5F9" strokeWidth="8" strokeLinecap="butt" />
                                  <circle cx="20" cy="120" r="4" fill="#10B981" />
                                  <motion.path
                                    key={vitalsInput.weight}
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: (Math.min(100, (Number(vitalsInput.weight) || Number(user?.profile?.weight) || 0)) / 100) }}
                                    transition={{ type: "tween", duration: 0.5, ease: "easeOut" }}
                                    d="M 20 120 A 80 80 0 0 1 200 120"
                                    fill="none" stroke="#10B981" strokeWidth="12" strokeLinecap="round"
                                  />
                                </svg>
                                <div className="absolute top-[18px] left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white border-2 border-[#10B981] flex items-center justify-center shadow-sm">
                                  <Scale className="w-3.5 h-3.5 text-[#10B981]" />
                                </div>
                              </div>
                              <div className="text-center -mt-8">
                                <span className="text-4xl font-black text-[#1D293D]">{(Number(vitalsInput.weight) || Number(user?.profile?.weight) || 0).toFixed(1)}</span>
                                <p className="text-[9px] font-black text-[#90A1B9] uppercase tracking-[0.1em] mt-1">Kilograms Today</p>
                              </div>
                            </div>

                            <div className="bg-[#F8FAFC] rounded-[24px] p-6 flex justify-between items-center border border-[#F1F5F9]">
                              <div className="flex-1 flex flex-col items-center border-r border-slate-200">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">Goal</span>
                                <p className="text-lg font-black text-[#1D293D]">{dashboardData?.goals?.weight || 70}<span className="text-xs ml-1">kg</span></p>
                              </div>
                              <div className="flex-1 flex flex-col items-center border-r border-slate-200">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">Progress</span>
                                <p className="text-lg font-black text-[#1F5C49]">
                                  {(() => {
                                    const current = Number(vitalsInput.weight) || Number(user?.profile?.weight) || 0;
                                    const target = Number(dashboardData?.goals?.weight || user?.nutritionGoal?.weightGoal || 70);
                                    const diff = (current - target).toFixed(1);
                                    return (diff > 0 ? `+${diff}` : diff) + 'kg';
                                  })()}
                                </p>
                              </div>
                              <div className="flex-1 flex flex-col items-center">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">BMI</span>
                                <p className="text-lg font-black text-[#1D293D]">
                                  {(() => {
                                    const w = Number(vitalsInput.weight || user?.profile?.weight || 72.5);
                                    const h = Number(user?.profile?.height || 170) / 100;
                                    return (w / (h * h)).toFixed(1);
                                  })()}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white/60 backdrop-blur-md rounded-[32px] p-8 border border-white shadow-sm overflow-hidden group">
                            <div className="flex items-center justify-between mb-8">
                              <div className="flex items-center gap-3">
                                <Activity className="w-5 h-5 text-[#1F5C49]" />
                                <h4 className="text-lg font-black text-[#1D293D]">Trend</h4>
                              </div>
                              <div className="px-3 py-1.5 bg-[#F3F9F6] rounded-full"><span className="text-[9px] font-black text-[#1F5C49] uppercase">Last 7 Days</span></div>
                            </div>
                            <div className="h-32 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={formattedHistory.weight}>
                                  <Line type="monotone" dataKey="value" stroke="#1F5C49" strokeWidth={3} dot={{ fill: '#1F5C49', stroke: '#fff', strokeWidth: 2, r: 4 }} />
                                  <XAxis dataKey="day" hide /><YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                                </LineChart>
                              </ResponsiveContainer>
                              <div className="flex justify-between px-2 mt-2">
                                {formattedHistory.weight.map(item => (<span key={item.day} className="text-[9px] font-black text-[#CAD5E2]">{item.day}</span>))}
                              </div>
                            </div>
                          </div>

                          <div className="bg-white border border-[#E8F3EE] shadow-sm rounded-[24px] p-6 flex items-center gap-6">
                            <div className="flex-[4] space-y-3">
                              <span className="text-[9px] font-black text-[#1F5C49]/70 uppercase ml-2">Weight (kg)</span>
                              <div className="bg-white px-4 py-3.5 rounded-2xl border border-[#E8F3EE]">
                                <input type="number" step="0.1" placeholder="72.5" value={vitalsInput.weight} onChange={(e) => setVitalsInput(prev => ({ ...prev, weight: e.target.value }))} className="bg-transparent text-sm font-bold text-[#1D293D] w-full focus:outline-none" />
                              </div>
                            </div>
                            <div className="flex-[6] space-y-3">
                              <span className="text-[9px] font-black text-[#1F5C49]/70 uppercase ml-2">Date</span>
                              <div className="flex flex-col gap-2 bg-white px-4 py-3.5 rounded-2xl border border-[#E8F3EE] w-full">
                                <div className="flex items-center gap-2 w-full">
                                  <Calendar className="w-3.5 h-3.5 text-[#90A1B9]" />
                                  <input type="date" value={vitalsInput.date} onChange={(e) => setVitalsInput(prev => ({ ...prev, date: e.target.value }))} className="bg-transparent text-sm font-bold text-[#1D293D] w-full focus:outline-none" />
                                </div>
                                <p className="text-[9px] font-black text-[#1F5C49] uppercase tracking-widest pl-5.5">
                                  Logging for: {vitalsInput.date ? vitalsInput.date.split('-').reverse().join('/') : '--/--/--'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Primary Save Action */}
                          <div className="mt-8">
                            <button
                              onClick={() => handleLogVitals('Weight')}
                              disabled={vitalsLoading}
                              className="w-full h-16 bg-[#1F5C49] rounded-full shadow-[0_20px_40px_rgba(31,92,73,0.3)] flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                              {vitalsLoading ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Save className="w-5 h-5 text-white" />
                                  <span className="text-base font-black text-white tracking-tight uppercase">Save weight</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {activeLogTab === 'Water' && (
                        <div className="space-y-6 pb-24">
                          <div className="bg-white border border-[#E8F3EE] shadow-[0_1px_3px_rgba(0,0,0,0.1)] rounded-[32px] p-8 relative overflow-hidden group">
                            {/* Live Badge */}
                            <div className="absolute top-6 right-6 px-3 py-1 bg-[#EEF2FF]/50 rounded-full flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                              <span className="text-[9px] font-black text-[#3B82F6] uppercase tracking-widest">Live</span>
                            </div>

                            <div className="text-center mt-4">
                              <h4 className="text-lg font-bold text-slate-400">You have drank <span className="text-[#1D293D] font-black">{waterLog} glasses</span></h4>
                              <p className="text-sm font-bold text-slate-300 mt-1">today</p>
                            </div>
                            {/* Semi-Circle Gauge */}
                            <div className="flex flex-col items-center justify-center my-10 relative">
                              <div className="relative w-[220px] h-[130px]">
                                <svg width="220" height="130" viewBox="0 0 220 130">
                                  <path d="M 20 120 A 80 80 0 0 1 200 120" fill="none" stroke="#F1F5F9" strokeWidth="8" strokeLinecap="butt" />
                                  <circle cx="20" cy="120" r="4" fill="#3B82F6" />
                                  <motion.path
                                    key={waterLog}
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: (Math.min(8, waterLog) / 8) }}
                                    transition={{ type: "tween", duration: 0.5, ease: "easeOut" }}
                                    d="M 20 120 A 80 80 0 0 1 200 120"
                                    fill="none" stroke="#3B82F6" strokeWidth="12" strokeLinecap="round"
                                  />
                                </svg>
                                <div className="absolute top-[18px] left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white border-2 border-[#3B82F6] flex items-center justify-center shadow-sm">
                                  <GlassWater className="w-3.5 h-3.5 text-[#3B82F6]" />
                                </div>
                              </div>
                              <div className="text-center -mt-8">
                                <span className="text-4xl font-black text-[#1D293D]">{waterLog}</span>
                                <p className="text-[9px] font-black text-[#90A1B9] uppercase tracking-[0.1em] mt-1">Glasses Today</p>
                              </div>
                            </div>

                            <div className="bg-[#F8FAFC] rounded-[24px] p-6 flex justify-between items-center border border-[#F1F5F9] mt-4">
                              <div className="flex-1 flex flex-col items-center border-r border-slate-200">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">Volume</span>
                                <p className="text-lg font-black text-[#1D293D]">{waterLog * 250}<span className="text-xs ml-1 text-slate-300">ml</span></p>
                              </div>
                              <div className="flex-1 flex flex-col items-center border-r border-slate-200">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">Remaining</span>
                                <p className="text-lg font-black text-[#3B82F6]">{Math.max(0, 8 - waterLog)}<span className="text-xs ml-1 font-bold">glasses</span></p>
                              </div>
                              <div className="flex-1 flex flex-col items-center">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">Goal</span>
                                <p className="text-lg font-black text-[#1D293D]">8</p>
                              </div>
                            </div>
                          </div>

                          {/* Weekly Hydration Chart Card */}
                          <div className="bg-white border border-[#E8F3EE] shadow-sm rounded-[32px] p-6">
                            <div className="flex justify-between items-center mb-10">
                              <h4 className="text-base font-black text-[#1D293D] tracking-tight">Weekly Hydration</h4>
                              <div className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Last 7 Days</span>
                              </div>
                            </div>

                            <div className="h-[180px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={formattedHistory.water}>

                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94A3B8' }} dy={10} />
                                  <YAxis hide />
                                  <Tooltip cursor={{ fill: '#F8FAFC' }} content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      return (
                                        <div className="bg-white p-3 rounded-xl shadow-lg border border-slate-100">
                                          <p className="text-xs font-black text-slate-400 uppercase">{payload[0].payload.day}</p>
                                          <p className="text-sm font-black text-[#3B82F6]">{payload[0].value} Glasses</p>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }} />
                                  <Bar dataKey="value" radius={[8, 8, 8, 8]} barSize={28}>
                                    {formattedHistory.water.map((entry, index) => (
                                      <Cell key={index} fill={entry.value >= 8 ? '#3B82F6' : '#E0E7FF'} />
                                    ))}
                                  </Bar>
                                  <ReferenceLine y={8} stroke="#3B82F6" strokeDasharray="3 3" opacity={0.3} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>

                            {/* Legend */}
                            <div className="flex items-center justify-center gap-6 mt-6">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Goal Met</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#E0E7FF]" />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">In Progress</span>
                              </div>
                            </div>
                          </div>

                          {/* Quick Log Card - High Fidelity */}
                          <div className="bg-white border border-[#E8F3EE] shadow-sm rounded-[32px] p-8 space-y-8">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center"><Plus className="w-4 h-4 text-[#3B82F6]" /></div>
                              <h4 className="text-base font-black text-[#1D293D]">Quick Log</h4>
                            </div>

                            <div className="flex items-center justify-center gap-10">
                              <button
                                onClick={() => setWaterLog(prev => Math.max(0, prev - 1))}
                                className="w-16 h-16 rounded-full bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-slate-100 flex items-center justify-center text-slate-400 active:scale-95 transition-all"
                              >
                                <Minus className="w-6 h-6" />
                              </button>

                              <div className="relative flex items-center justify-center">
                                <div className="w-28 h-28 rounded-full border-[6px] border-[#3B82F6]/5 flex items-center justify-center">
                                  <div className="w-22 h-22 rounded-full bg-[#EFF6FF] flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                                    <span className="text-4xl font-black text-[#3B82F6]">{waterLog}</span>
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => setWaterLog(prev => prev + 1)}
                                className="w-16 h-16 rounded-full bg-[#3B82F6] shadow-[0_8px_30px_rgba(59,130,246,0.25)] flex items-center justify-center text-white active:scale-95 transition-all"
                              >
                                <Plus className="w-6 h-6" />
                              </button>
                            </div>
                          </div>

                          {/* Primary Save Action */}
                          <div className="mt-8">
                            <button
                              onClick={() => handleLogVitals('Water', waterLog - (nutritionData?.totalWater ?? nutritionData?.waterIntake ?? 0))}
                              disabled={vitalsLoading}
                              className="w-full h-16 bg-[#3B82F6] rounded-full shadow-[0_20px_40px_rgba(59,130,246,0.3)] flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                              {vitalsLoading ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Save className="w-5 h-5 text-white" />
                                  <span className="text-base font-black text-white tracking-tight uppercase">Save water</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {activeLogTab === 'Steps' && (
                        <div className="space-y-6 pb-24">
                          <div className="bg-white border border-[#E8F3EE] shadow-[0_1px_3px_rgba(0,0,0,0.1)] rounded-[32px] p-8 relative overflow-hidden group">
                            {/* Live Badge */}
                            <div className="absolute top-6 right-6 px-3 py-1 bg-orange-50 rounded-full flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                              <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest">Live</span>
                            </div>

                            <div className="text-center mt-4">
                              <h4 className="text-lg font-bold text-slate-400">You have walked <span className="text-[#1D293D] font-black">{(Number(vitalsInput.steps) || Number(wearableData?.todayMetrics?.steps) || 0).toLocaleString()} steps</span></h4>
                              <p className="text-sm font-bold text-slate-300 mt-1">today</p>
                            </div>

                            {/* Semi-Circle Gauge - Increased height to prevent clipping */}
                            <div className="flex flex-col items-center justify-center my-10 relative">
                              <div className="relative w-[220px] h-[130px]">
                                <svg width="220" height="130" viewBox="0 0 220 130">
                                  <path d="M 20 120 A 80 80 0 0 1 200 120" fill="none" stroke="#F1F5F9" strokeWidth="8" strokeLinecap="butt" />
                                  <circle cx="20" cy="120" r="4" fill="#F97316" />
                                  <motion.path
                                    key={vitalsInput.steps}
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: (Math.min(10000, (Number(vitalsInput.steps) || Number(wearableData?.todayMetrics?.steps) || 0)) / 10000) }}
                                    transition={{ type: "tween", duration: 0.5, ease: "easeOut" }}
                                    d="M 20 120 A 80 80 0 0 1 200 120"
                                    fill="none" stroke="#F97316" strokeWidth="12" strokeLinecap="round"
                                  />
                                </svg>
                                <div className="absolute top-[18px] left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white border-2 border-orange-500 flex items-center justify-center shadow-sm">
                                  <Footprints className="w-3.5 h-3.5 text-orange-500" />
                                </div>
                              </div>
                              <div className="text-center -mt-8">
                                <span className="text-4xl font-black text-[#1D293D]">{(Number(vitalsInput.steps) || Number(wearableData?.todayMetrics?.steps) || 0).toLocaleString()}</span>
                                <p className="text-[9px] font-black text-[#90A1B9] uppercase tracking-[0.1em] mt-1">Of 10,000 steps</p>
                              </div>
                            </div>

                            <div className="bg-[#F8FAFC] rounded-[24px] p-6 flex justify-between items-center border border-[#F1F5F9] mt-4">
                              <div className="flex-1 flex flex-col items-center border-r border-slate-200">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">Calories</span>
                                <p className="text-lg font-black text-[#1D293D]">{(Number(vitalsInput.steps || wearableData?.todayMetrics?.steps || 0) * 0.04).toFixed(0)}<span className="text-xs ml-1 text-slate-300">kcal</span></p>
                              </div>
                              <div className="flex-1 flex flex-col items-center border-r border-slate-200">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">Distance</span>
                                <p className="text-lg font-black text-[#1D293D]">{(Number(vitalsInput.steps || wearableData?.todayMetrics?.steps || 0) * 0.0008).toFixed(1)}<span className="text-xs ml-1 text-slate-300 font-bold">km</span></p>
                              </div>
                              <div className="flex-1 flex flex-col items-center">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">Goal</span>
                                <p className="text-lg font-black text-[#1D293D]">10k</p>
                              </div>
                            </div>
                          </div>

                          {/* Weekly Progress Chart Card */}
                          <div className="bg-white border border-[#E8F3EE] shadow-sm rounded-[32px] p-6">
                            <div className="flex justify-between items-center mb-10">
                              <h4 className="text-base font-black text-[#1D293D] tracking-tight">Weekly Progress</h4>
                              <div className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Last 7 Days</span>
                              </div>
                            </div>

                            <div className="h-[180px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={formattedHistory.steps}>

                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94A3B8' }} dy={10} />
                                  <YAxis hide />
                                  <Tooltip cursor={{ fill: '#FFF7ED' }} content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      return (
                                        <div className="bg-white p-3 rounded-xl shadow-lg border border-orange-100">
                                          <p className="text-xs font-black text-slate-400 uppercase">{payload[0].payload.day}</p>
                                          <p className="text-sm font-black text-[#F97316]">{payload[0].value.toLocaleString()} Steps</p>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }} />
                                  <Bar dataKey="value" radius={[8, 8, 8, 8]} barSize={28}>
                                    {formattedHistory.steps.map((entry, index) => (
                                      <Cell key={index} fill={entry.value >= 10000 ? '#F97316' : '#FFEDD5'} />
                                    ))}
                                  </Bar>
                                  <ReferenceLine y={10000} stroke="#F97316" strokeDasharray="3 3" opacity={0.3} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>

                            {/* Legend */}
                            <div className="flex items-center justify-center gap-6 mt-6">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#F97316]" />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Goal Met</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#FFEDD5]" />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">In Progress</span>
                              </div>
                            </div>
                          </div>

                          {/* Manual Entry Card */}
                          <div className="bg-white border border-[#E8F3EE] shadow-sm rounded-[32px] p-8 space-y-8">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center"><Plus className="w-4 h-4 text-[#F97316]" /></div>
                              <h4 className="text-base font-black text-[#1D293D]">Manual Entry</h4>
                            </div>

                            <div className="flex gap-4">
                              <div className="flex-1 space-y-3">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase ml-1">Steps to Add</span>
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                  <input type="number" placeholder="2000" value={vitalsInput.steps} onChange={(e) => setVitalsInput(prev => ({ ...prev, steps: e.target.value }))} className="bg-transparent text-sm font-black text-[#1D293D] placeholder:text-slate-200 w-full focus:outline-none" />
                                </div>
                              </div>
                              <div className="flex-1 space-y-3">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase ml-1">Date</span>
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-slate-200" />
                                  <input type="date" value={vitalsInput.date} onChange={(e) => setVitalsInput(prev => ({ ...prev, date: e.target.value }))} className="bg-transparent text-xs font-black text-[#1D293D] w-full focus:outline-none" />
                                </div>
                                <p className="text-[8px] font-black text-orange-600 uppercase tracking-widest ml-1 mt-1">
                                  Date: {vitalsInput.date ? vitalsInput.date.split('-').reverse().join('/') : '--/--/--'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Primary Save Action */}
                          <div className="mt-4">
                            <button
                              onClick={() => handleLogVitals('Steps')}
                              disabled={vitalsLoading}
                              className="w-full h-16 bg-[#F97316] rounded-full shadow-[0_20px_40px_rgba(249,115,22,0.3)] flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                              {vitalsLoading ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Save className="w-5 h-5 text-white" />
                                  <span className="text-base font-black text-white tracking-tight uppercase">Save steps</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {activeLogTab === 'Sleep' && (
                        <div className="space-y-6 pb-24">
                          <div className="bg-white border border-[#E8F3EE] shadow-[0_1px_3px_rgba(0,0,0,0.1)] rounded-[32px] p-8 relative overflow-hidden group">
                            <div className="absolute top-6 right-6 px-3 py-1 bg-purple-50 rounded-full flex items-center gap-1.5 ">
                              <span className="text-[9px] font-black text-purple-600 uppercase tracking-widest">Last Night</span>
                            </div>

                            <div className="text-center mt-4">
                              <h4 className="text-lg font-bold text-slate-400">You slept <span className="text-[#1D293D] font-black">{vitalsInput.sleepHours || (Math.floor(Number(wearableData?.todayMetrics?.sleep || 0) / 60))}h {vitalsInput.sleepMins || (Number(wearableData?.todayMetrics?.sleep || 0) % 60)}m</span></h4>
                            </div>

                            {/* Semi-Circle Gauge - Increased height to prevent clipping */}
                            <div className="flex flex-col items-center justify-center my-10 relative">
                              <div className="relative w-[220px] h-[130px]">
                                <svg width="220" height="130" viewBox="0 0 220 130">
                                  <path d="M 20 120 A 80 80 0 0 1 200 120" fill="none" stroke="#F1F5F9" strokeWidth="8" strokeLinecap="butt" />
                                  <circle cx="20" cy="120" r="4" fill="#8A7BB6" />
                                  {(() => {
                                    const hasInput = vitalsInput.sleepHours !== '' || vitalsInput.sleepMins !== '';
                                    const selectedDateStr = vitalsInput.date || new Date().toISOString().split('T')[0];

                                    // Find existing sleep record for selected date in recentSleep array
                                    const existingSleep = wearableData?.recentSleep?.find(s =>
                                      new Date(s.date).toISOString().split('T')[0] === selectedDateStr
                                    );
                                    const existingMins = existingSleep?.totalSleepMinutes || 0;

                                    const currentSleepVal = hasInput
                                      ? (parseFloat(vitalsInput.sleepHours || 0) + (parseFloat(vitalsInput.sleepMins || 0) / 60))
                                      : (existingMins / 60);

                                    return (
                                      <>
                                        <motion.path
                                          key={`${vitalsInput.sleepHours}-${vitalsInput.sleepMins}-${existingMins}-${vitalsInput.date}`}
                                          initial={{ pathLength: 0 }}
                                          animate={{ pathLength: Math.min(8, currentSleepVal) / 8 }}
                                          transition={{ type: "tween", duration: 0.5, ease: "easeOut" }}
                                          d="M 20 120 A 80 80 0 0 1 200 120"
                                          fill="none" stroke="#8A7BB6" strokeWidth="12" strokeLinecap="round"
                                        />
                                      </>
                                    );
                                  })()}
                                </svg>
                                <div className="absolute top-[18px] left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white border-2 border-[#8A7BB6] flex items-center justify-center shadow-sm">
                                  <Moon className="w-3.5 h-3.5 text-[#8A7BB6]" />
                                </div>
                              </div>
                              <div className="text-center -mt-8">
                                <span className="text-4xl font-black text-[#1D293D]">
                                  {(() => {
                                    const hasInput = vitalsInput.sleepHours !== '' || vitalsInput.sleepMins !== '';
                                    const selectedDateStr = vitalsInput.date || new Date().toISOString().split('T')[0];
                                    const existingSleep = wearableData?.recentSleep?.find(s =>
                                      new Date(s.date).toISOString().split('T')[0] === selectedDateStr
                                    );
                                    const existingMins = existingSleep?.totalSleepMinutes || 0;

                                    return (hasInput
                                      ? (parseFloat(vitalsInput.sleepHours || 0) + (parseFloat(vitalsInput.sleepMins || 0) / 60))
                                      : (existingMins / 60)).toFixed(1);
                                  })()}
                                </span>
                                <p className="text-[9px] font-black text-[#90A1B9] uppercase tracking-[0.1em] mt-1">Hours Logged</p>
                              </div>
                            </div>

                            <div className="bg-[#F8FAFC] rounded-[24px] p-6 flex justify-between items-center border border-[#F1F5F9] mt-4">
                              <div className="flex-1 flex flex-col items-center border-r border-slate-200">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">Deep</span>
                                <p className="text-lg font-black text-[#1D293D]">{(Number(vitalsInput.sleepHours) * 0.3).toFixed(1)}<span className="text-xs ml-1 text-slate-300">h</span></p>
                              </div>
                              <div className="flex-1 flex flex-col items-center border-r border-slate-200">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">Quality</span>
                                <p className="text-lg font-black text-purple-600">85%</p>
                              </div>
                              <div className="flex-1 flex flex-col items-center">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">Goal</span>
                                <p className="text-lg font-black text-[#1D293D]">8h</p>
                              </div>
                            </div>
                          </div>

                          {/* Weekly Sleep Analysis Chart */}
                          <div className="bg-white border border-[#E8F3EE] shadow-sm rounded-[32px] p-6">
                            <div className="flex justify-between items-center mb-10">
                              <h4 className="text-base font-black text-[#1D293D] tracking-tight">Weekly Sleep</h4>
                              <div className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Last 7 Days</span>
                              </div>
                            </div>

                            <div className="h-[180px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={formattedHistory.sleep}>

                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94A3B8' }} dy={10} />
                                  <YAxis hide />
                                  <Tooltip cursor={{ fill: '#F5F3FF' }} content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      return (
                                        <div className="bg-white p-3 rounded-xl shadow-lg border border-purple-100">
                                          <p className="text-xs font-black text-slate-400 uppercase">{payload[0].payload.day}</p>
                                          <p className="text-sm font-black text-[#8A7BB6]">{payload[0].value} Hours</p>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }} />
                                  <Bar dataKey="value" radius={[8, 8, 8, 8]} barSize={28}>
                                    {formattedHistory.sleep.map((entry, index) => (
                                      <Cell key={index} fill={entry.value >= 8 ? '#8A7BB6' : '#D1CBE9'} />
                                    ))}
                                  </Bar>
                                  <ReferenceLine y={8} stroke="#8A7BB6" strokeDasharray="3 3" opacity={0.3} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>

                            {/* Legend */}
                            <div className="flex items-center justify-center gap-6 mt-6">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#8A7BB6]" />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Goal Met</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#D1CBE9]" />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Below Goal</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-4 border-t-2 border-dashed border-[#8A7BB6]/30" />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Goal (8h)</span>
                              </div>
                            </div>
                          </div>

                          {/* Log Sleep Manual Entry Card */}
                          <div className="bg-white border border-[#F1F5F9] shadow-[0_10px_40px_rgba(0,0,0,0.03)] rounded-[32px] p-8 space-y-8">
                            <div className="flex items-center gap-4">
                              <div className="w-9 h-9 rounded-full bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] flex items-center justify-center border border-slate-50"><Plus className="w-4 h-4 text-slate-400" /></div>
                              <h4 className="text-xl font-bold text-[#1D293D] tracking-tight">Log Sleep</h4>
                            </div>

                            <div className="grid grid-cols-12 gap-4">
                              <div className="col-span-3 space-y-3">
                                <span className="text-[10px] font-black text-[#94A3B8] uppercase tracking-[0.15em] ml-2">Hours</span>
                                <div className="bg-white px-2 py-4.5 rounded-[22px] border border-[#E2E8F0] flex items-center justify-center h-[72px]">
                                  <input type="number" placeholder="7" value={vitalsInput.sleepHours || ''} onChange={(e) => setVitalsInput(prev => ({ ...prev, sleepHours: e.target.value }))} className="bg-transparent text-xl font-black text-[#A0AEC0] placeholder:text-[#CBD5E0] text-center w-full focus:outline-none" />
                                </div>
                              </div>
                              <div className="col-span-3 space-y-3">
                                <span className="text-[10px] font-black text-[#94A3B8] uppercase tracking-[0.15em] ml-2">Mins</span>
                                <div className="bg-white px-2 py-4.5 rounded-[22px] border border-[#E2E8F0] flex items-center justify-center h-[72px]">
                                  <input type="number" placeholder="15" value={vitalsInput.sleepMins || ''} onChange={(e) => setVitalsInput(prev => ({ ...prev, sleepMins: e.target.value }))} className="bg-transparent text-xl font-black text-[#A0AEC0] placeholder:text-[#CBD5E0] text-center w-full focus:outline-none" />
                                </div>
                              </div>
                              <div className="col-span-6 space-y-3">
                                <span className="text-[10px] font-black text-[#94A3B8] uppercase tracking-[0.15em] ml-2">Date</span>
                                <div className="bg-white px-6 py-4.5 rounded-[22px] border border-[#E2E8F0] flex flex-col justify-center h-[72px]">
                                  <div className="flex items-center gap-4 w-full">
                                    <Calendar className="w-5.5 h-5.5 text-[#94A3B8]" />
                                    <input type="date" value={vitalsInput.date} onChange={(e) => setVitalsInput(prev => ({ ...prev, date: e.target.value }))} className="bg-transparent text-[16px] font-black text-[#1D293D] w-full focus:outline-none" />
                                  </div>
                                  <p className="text-[9px] font-black text-[#8A7BB6] uppercase tracking-widest ml-9.5">
                                    {vitalsInput.date ? vitalsInput.date.split('-').reverse().join('/') : '--/--/--'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Primary Save Action */}
                          <div className="mt-4">
                            <button
                              onClick={() => handleLogVitals('Sleep')}
                              disabled={vitalsLoading}
                              className="w-full h-16 bg-[#8A7BB6] rounded-full shadow-[0_20px_40px_rgba(138,123,182,0.3)] flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                              {vitalsLoading ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Save className="w-5 h-5 text-white" />
                                  <span className="text-base font-black text-white tracking-tight uppercase">Save sleep</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}