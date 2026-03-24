import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import {
  Flame, Moon, Utensils, Activity, Sparkles, TrendingUp, TrendingDown,
  ChevronRight, ChevronLeft, Plus, FileText, AlertCircle, Droplet,
  Search, Sun, Clock, Heart, Apple, Info, Target, Calendar,
  ArrowUpRight, Upload, Coffee, Dumbbell, MessageCircle, BarChart3,
  Circle, Smile, FlaskConical, Leaf, Pill, CheckCircle2, Zap, Eye,
  UtensilsCrossed, UploadCloud, ShieldCheck, AlertTriangle, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import DashboardSkeleton from '../components/skeletons/DashboardSkeleton';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, PieChart, Pie, Cell, LineChart, Line,
  ReferenceLine, Label
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { getFoodImage } from '../services/imageService';
import api, { nutritionService } from '../services/api';
import { ImageWithFallback } from '../components/ImageWithFallback';

const DashedGauge = ({ value, max = 2400, mode = 'Macro' }) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const totalDashes = 18;
  const activeDashes = Math.floor((percentage / 100) * totalDashes);

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
              stroke={isActive ? '#10b981' : '#F5F5F7'}
              strokeWidth="10"
              strokeLinecap="round"
              className="transition-colors duration-700"
              transform={`rotate(${angle} 120 120)`}
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
    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm mb-12">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-2xl font-black text-black uppercase tracking-tight">Diabetes Monitor</h2>
          <p className="text-sm font-bold text-slate-400">Track glucose, blood sugar & HbA1c</p>
        </div>
        <button className="flex items-center gap-2 bg-white px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest border border-slate-100 shadow-sm hover:shadow-md transition-all">
          <Plus className="w-4 h-4" />
          Log Reading
        </button>
      </div>

      <div className="mt-8 flex flex-col lg:flex-row items-center gap-4 bg-slate-50 p-4 rounded-full border border-slate-100 mb-10">
        <div className="flex items-center gap-2 flex-1">
          {['Fasting', 'Post-Meal', 'Random'].map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-8 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${type === t ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <input
            type="number"
            placeholder="Glucose (mg/dL)"
            value={reading}
            onChange={(e) => setReading(e.target.value)}
            className="flex-1 lg:w-48 bg-transparent px-6 py-2 content-center text-sm font-bold focus:outline-none placeholder:text-slate-300"
          />
          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-slate-900 text-white px-10 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50"
          >
            {loading ? '...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-50 rounded-[2rem] p-8 text-center border border-slate-100">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Glucose</p>
          <div className="flex items-baseline justify-center gap-2 mb-2">
            <span className="text-3xl font-black text-black">110</span>
            <span className="text-[10px] font-bold text-slate-400">mg/dL</span>
          </div>
          <span className="px-5 py-1.5 bg-white text-black rounded-full text-[9px] font-black border border-slate-100 uppercase tracking-widest">Normal</span>
        </div>
        <div className="bg-slate-50 rounded-[2rem] p-8 text-center border border-slate-100">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Avg Sugar</p>
          <div className="flex items-baseline justify-center gap-2 mb-2">
            <span className="text-3xl font-black text-black">126</span>
            <span className="text-[10px] font-bold text-slate-400">mg/dL</span>
          </div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">-3%</span>
        </div>
        <div className="bg-slate-50 rounded-[2rem] p-8 text-center border border-slate-100">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">HbA1c</p>
          <div className="flex items-baseline justify-center gap-2 mb-2">
            <span className="text-3xl font-black text-black">5.8</span>
            <span className="text-[10px] font-bold text-slate-400">%</span>
          </div>
          <span className="px-5 py-1.5 bg-white text-black rounded-full text-[9px] font-black border border-slate-100 uppercase tracking-widest">Good</span>
        </div>
      </div>
    </div>
  );
};

const DailyMetricsCard = () => {
  const { user } = useAuth();
  const { dashboardData, nutritionData, wearableData } = useData();

  // Real data with fallback to 0 or --
  const weight = dashboardData?.user?.profile?.weight || dashboardData?.history?.slice(-1)?.[0]?.weight || user?.profile?.weight || '--';
  const steps = wearableData?.todayMetrics?.steps || dashboardData?.stepsToday || '0';
  const water = nutritionData?.totalWater || nutritionData?.waterIntake || '0';
  const navigate = useNavigate();

  return (
    <div className="lg:bg-white lg:rounded-[28px] p-0 lg:p-5 lg:shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col h-full lg:border border-slate-100/50">
      <div className="hidden lg:flex mb-2 lg:mb-8 justify-between items-center">
        <div>
          <h3 className="text-sm lg:text-xl font-medium text-[#1a1a1a]">Daily Vitals</h3>
          <p className="text-[7px] lg:text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">QUICK LOG</p>
        </div>
      </div>

      <div className="flex flex-row lg:flex-col gap-2 lg:space-y-4 flex-1 mb-6 lg:mb-0">
        <div className="bg-white lg:bg-emerald-50/20 p-2 lg:p-5 rounded-3xl lg:rounded-[24px] border border-emerald-100/30 flex flex-col lg:flex-row flex-1 items-center lg:justify-between group hover:shadow-md lg:hover:bg-white lg:hover:shadow-sm transition-all overflow-hidden shadow-sm lg:shadow-none">
          <div className="flex flex-col lg:flex-row items-center gap-1 lg:gap-4 text-center lg:text-left">
            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-2xl bg-emerald-50 lg:bg-white flex items-center justify-center shadow-sm">
              <Target className="w-4 h-4 lg:w-5 lg:h-5 text-[#064e3b]" />
            </div>
            <div>
              <p className="text-[9px] lg:text-[11px] font-black text-emerald-800/40 uppercase tracking-tighter leading-none mb-1">WEIGHT</p>
              <p className="text-[15px] lg:text-2xl font-black text-[#064e3b]">{weight} <span className="text-[10px] lg:text-sm font-bold text-emerald-800/20">kg</span></p>
            </div>
          </div>
          <button onClick={() => navigate('/log-vitals/weight')} className="mt-2 lg:mt-0 w-6 h-6 lg:w-8 lg:h-8 rounded-full border border-emerald-100/30 flex items-center justify-center hover:bg-emerald-50 transition-colors bg-emerald-50 lg:bg-transparent">
            <Plus className="w-3 h-3 lg:w-4 lg:h-4 text-[#064e3b]" />
          </button>
        </div>

        <div className="bg-white lg:bg-emerald-50/20 p-2 lg:p-5 rounded-3xl lg:rounded-[24px] border border-emerald-100/30 flex flex-col lg:flex-row flex-1 items-center lg:justify-between group hover:shadow-md lg:hover:bg-white lg:hover:shadow-sm transition-all overflow-hidden shadow-sm lg:shadow-none">
          <div className="flex flex-col lg:flex-row items-center gap-1 lg:gap-4 text-center lg:text-left">
            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-2xl bg-emerald-50 lg:bg-white flex items-center justify-center shadow-sm">
              <Activity className="w-4 h-4 lg:w-5 lg:h-5 text-[#064e3b]" />
            </div>
            <div>
              <p className="text-[9px] lg:text-[11px] font-black text-emerald-800/40 uppercase tracking-tighter leading-none mb-1">STEPS</p>
              <p className="text-[15px] lg:text-2xl font-black text-[#064e3b]">{Number(steps).toLocaleString()} <span className="text-[10px] lg:text-sm font-bold text-emerald-800/20">st</span></p>
            </div>
          </div>
          <button onClick={() => navigate('/log-vitals/steps')} className="mt-2 lg:mt-0 w-6 h-6 lg:w-8 lg:h-8 rounded-full border border-emerald-100/30 flex items-center justify-center hover:bg-emerald-50 transition-colors bg-emerald-50 lg:bg-transparent">
            <Plus className="w-3 h-3 lg:w-4 lg:h-4 text-[#064e3b]" />
          </button>
        </div>

        <div className="bg-white lg:bg-emerald-50/20 p-2 lg:p-5 rounded-3xl lg:rounded-[24px] border border-emerald-100/30 flex flex-col lg:flex-row flex-1 items-center lg:justify-between group hover:shadow-md lg:hover:bg-white lg:hover:shadow-sm transition-all overflow-hidden shadow-sm lg:shadow-none">
          <div className="flex flex-col lg:flex-row items-center gap-1 lg:gap-4 text-center lg:text-left">
            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-2xl bg-emerald-50 lg:bg-white flex items-center justify-center shadow-sm">
              <Droplet className="w-4 h-4 lg:w-5 lg:h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-[9px] lg:text-[11px] font-black text-emerald-800/40 uppercase tracking-tighter leading-none mb-1">WATER</p>
              <p className="text-[15px] lg:text-2xl font-black text-[#064e3b]">{water} <span className="text-[10px] lg:text-sm font-bold text-emerald-800/20">glasses</span></p>
            </div>
          </div>
          <button onClick={() => navigate('/nutrition')} className="mt-2 lg:mt-0 w-6 h-6 lg:w-8 lg:h-8 rounded-full border border-emerald-100/30 flex items-center justify-center hover:bg-emerald-50 transition-colors bg-emerald-50 lg:bg-transparent">
            <Plus className="w-3 h-3 lg:w-4 lg:h-4 text-[#064e3b]" />
          </button>
        </div>
      </div>
    </div>
  );
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
      quantity: meal.quantity || '1 serving',
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
            <div className="absolute bottom-4 right-4 px-4 py-1.5 bg-white/90 backdrop-blur-md rounded-full text-[9px] font-black uppercase tracking-widest text-black shadow-sm border border-white">
              Analyzed Image
            </div>
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
  const { user } = useAuth();
  const { dashboardData, nutritionData, wearableData, fetchDashboard, fetchNutrition, fetchNutritionLogs, fetchDietPlan, fetchWearable, loading } = useData();
  const navigate = useNavigate();

  const [dietPlan, setDietPlan] = useState(null);
  const [loggedMeals, setLoggedMeals] = useState([]);
  const [loggedMealsMap, setLoggedMealsMap] = useState({});
  const [isDiabetic, setIsDiabetic] = useState(false);
  const [selectedMealForModal, setSelectedMealForModal] = useState(null);
  const [showMealModal, setShowMealModal] = useState(false);
  const [nutrientMode, setNutrientMode] = useState('Macro');
  const [activeMealTab, setActiveMealTab] = useState('breakfast');
  const [activeDiabetesTab, setActiveDiabetesTab] = useState('Fasting');
  const [activeTrendTab, setActiveTrendTab] = useState('Calories');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(() => {
    const saved = localStorage.getItem('carePlanTasks');
    if (!saved) return [0, 2];
    try {
      const { tasks, date } = JSON.parse(saved);
      const today = new Date().toISOString().split('T')[0];
      if (date === today) return tasks;
      return []; // Reset for new day
    } catch (e) {
      return [0, 2];
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
        await Promise.all([
          fetchDashboard(),
          fetchNutrition(new Date().toISOString().split('T')[0]),
          fetchWearable(),
          fetchDietPlan().then(plan => setDietPlan(plan)),
          fetchNutritionLogs(new Date().toISOString().split('T')[0]).then(logs => {
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
  }, [user]);

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
    // Priority 1: Use medical report deficiencies if they exist
    let list = dashboardData?.latestAnalysis?.deficiencies || [];

    // Priority 2: If no report findings, calculate real-time nutritional gaps from daily intake
    if (list.length === 0 && nutritionData) {
      const driTargets = {
        fiber: 30,
        iron: 18,
        vitaminC: 90,
        vitaminA: 900,
        vitaminD: 20,
        calcium: 1000,
        vitaminB12: 2.4
      };

      const nutrientMeta = {
        fiber: { name: 'Fiber', unit: 'g', food: 'Whole grains, Legumes', supplement: 'Psyllium Husk' },
        iron: { name: 'Iron', unit: 'mg', food: 'Spinach, Beetroot, Red Meat', supplement: 'Iron Supplements' },
        vitaminC: { name: 'Vitamin C', unit: 'mg', food: 'Oranges, Lemon, Amla', supplement: 'C-Vitamin' },
        vitaminA: { name: 'Vitamin A', unit: 'mcg', food: 'Carrots, Sweet Potato', supplement: 'Beta Carotene' },
        vitaminD: { name: 'Vitamin D', unit: 'mcg', food: 'Fatty Fish, Eggs, Sun', supplement: 'Vitamin D3' },
        calcium: { name: 'Calcium', unit: 'mg', food: 'Milk, Tofu, Almonds', supplement: 'Calcium + D3' },
        vitaminB12: { name: 'Vitamin B12', unit: 'mcg', food: 'Dairy, Eggs, Fortified foods', supplement: 'B12 Complex' }
      };

      const dailyGaps = [];
      Object.entries(driTargets).forEach(([key, target]) => {
        const dataKey = 'total' + key.charAt(0).toUpperCase() + key.slice(1);
        const val = nutritionData[dataKey] || 0;
        const percent = Math.min(Math.round((val / target) * 100), 100);

        // If nutrient intake is low relative to target, mark as a gap
        if (percent < 80) {
          dailyGaps.push({
            name: nutrientMeta[key].name,
            status: percent < 30 ? 'High Risk' : percent < 60 ? 'Deficient' : 'Low',
            currentValue: val.toFixed(1),
            normalRange: target,
            unit: nutrientMeta[key].unit,
            percent: percent,
            food: nutrientMeta[key].food,
            supplement: nutrientMeta[key].supplement,
            type: 'daily_gap'
          });
        }
      });

      // Sort by risk (lowest percentage first) and take top 3
      list = dailyGaps.sort((a, b) => a.percent - b.percent).slice(0, 3);
    }
    return list;
  }, [dashboardData, nutritionData]);

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
      <div className="max-w-7xl mx-auto px-0 md:px-8">


      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6 md:mb-16 pt-0 md:pt-4"
      >
        <div className="flex flex-col md:block px-4 md:px-0">
          <h1 className="text-2xl md:text-5xl font-light tracking-tight text-[#064e3b] whitespace-nowrap">
            {getGreeting()}, <span className="font-medium">{user?.name?.split(' ')[0] || 'Mike'}!</span>
          </h1>
          <p className="text-[#065f46] mt-0.5 md:mt-2 text-[13px] md:text-lg">Let's make this day productive.</p>
        </div>
        <div className="hidden lg:flex items-center gap-2 lg:gap-3 pb-2 lg:pb-0 w-full lg:w-auto">
          <button onClick={() => navigate('/nutrition', { state: { openLogMeal: true, mealType: 'Breakfast' } })} className="flex flex-col lg:flex-row items-center justify-center gap-1 lg:gap-2 px-1 py-3 lg:px-6 bg-white/60 backdrop-blur-md rounded-[20px] lg:rounded-full text-[9px] lg:text-sm font-black text-[#1a1a1a] hover:bg-white transition-all border border-white/60 shadow-sm">
            <UtensilsCrossed className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-slate-500" /> <span>Log Meal</span>
          </button>
          <button onClick={() => navigate('/log-vitals/sleep')} className="flex flex-col lg:flex-row items-center justify-center gap-1 lg:gap-2 px-1 py-3 lg:px-6 bg-white/60 backdrop-blur-md rounded-[20px] lg:rounded-full text-[9px] lg:text-sm font-black text-[#1a1a1a] hover:bg-white transition-all border border-white/60 shadow-sm">
            <Moon className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-slate-500" /> <span>Log Sleep</span>
          </button>
          <button
            onClick={() => navigate('/upload')}
            className="flex flex-col lg:flex-row items-center justify-center gap-1 lg:gap-2 px-1 py-3 lg:px-6 bg-[#1a1a1a] text-white rounded-[20px] lg:rounded-full text-[8px] lg:text-sm font-black hover:bg-black transition-all shadow-md"
          >
            <Upload className="w-3 h-3 lg:w-4 lg:h-4" /> <span>Upload Reports</span>
          </button>
        </div>
      </motion.div>



      {/* 3 Column Grid - Scrollable on mobile with Stack Effect */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto lg:grid lg:grid-cols-3 gap-6 md:gap-8 pb-4 md:pb-12 lg:pb-0 scrollbar-hide snap-x snap-mandatory h-full items-stretch lg:items-start w-full mt-2 mb-2 px-[7.5vw] md:px-0"
      >
        {/* Card 1: Nutrient Info (Reordered to be first) */}
        <motion.div
          style={{
            scale: typeof window !== 'undefined' && window.innerWidth < 1024 ? 1 - (Math.abs(0 - activeIndex) * 0.05) : 1,
            filter: typeof window !== 'undefined' && window.innerWidth < 1024 ? `blur(${Math.abs(0 - activeIndex) * 3}px)` : 'none',
            zIndex: 10 - Math.round(Math.abs(0 - activeIndex)),
            opacity: typeof window !== 'undefined' && window.innerWidth < 1024 ? 1 - (Math.abs(0 - activeIndex) * 0.2) : 1
          }}
          className="min-w-[85vw] lg:min-w-0 snap-center bg-white rounded-[2rem] pt-5 px-5 pb-2 lg:p-8 border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.02)] flex flex-col h-auto min-h-[280px] lg:h-full relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          <div className="flex items-center justify-between mb-0.5 relative z-10">
            <h2 className="text-lg lg:text-xl font-black text-[#064e3b]">Nutrient Info</h2>
            <button
              onClick={() => navigate('/nutrition')}
              className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-black shadow-sm group"
            >
              <ArrowUpRight className="w-3.5 h-3.5 lg:w-4 lg:h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
          <p className="text-[8px] lg:text-[10px] font-black text-[#A1A1A1] uppercase tracking-[0.1em] mb-2 lg:mb-4 relative z-10 uppercase">Targets</p>

          <div className="relative z-10">
            {(() => {
              const driTargets = {
                fiber: 30,
                sugar: 50,
                sodium: 2300,
                vitaminA: 900,
                vitaminC: 90,
                vitaminD: 20,
                vitaminB12: 2.4,
                iron: 18,
                calcium: 1000
              };

              const microScores = [
                ((nutritionData?.totalFiber || dashboardData?.nutritionData?.totalFiber || 0) / driTargets.fiber) * 100,
                ((nutritionData?.totalSugar || dashboardData?.nutritionData?.totalSugar || 0) / driTargets.sugar) * 100,
                ((nutritionData?.totalSodium || dashboardData?.nutritionData?.totalSodium || 0) / driTargets.sodium) * 100,
                ((nutritionData?.totalVitaminA || dashboardData?.nutritionData?.totalVitaminA || 0) / driTargets.vitaminA) * 100,
                ((nutritionData?.totalVitaminC || dashboardData?.nutritionData?.totalVitaminC || 0) / driTargets.vitaminC) * 100,
                ((nutritionData?.totalIron || dashboardData?.nutritionData?.totalIron || 0) / driTargets.iron) * 100
              ];
              const avgMicro = Math.min(Math.round(microScores.reduce((a, b) => a + b, 0) / microScores.length), 100);

              return (
                <DashedGauge
                  value={nutrientMode === 'Macro' ? (nutritionData?.totalCalories || dashboardData?.nutritionData?.totalCalories || 0) : avgMicro}
                  max={nutrientMode === 'Macro' ? (user?.nutritionGoal?.calorieGoal || nutritionData?.calorieGoal || 2000) : 100}
                  mode={nutrientMode}
                  className="w-[180px] h-[180px] lg:w-[200px] lg:h-[200px]"
                />
              );
            })()}
          </div>

          <div className="flex justify-center gap-4 lg:gap-8 border-b border-slate-50 mb-4 lg:mb-8 pb-0.5 relative z-10">
            <button
              onClick={() => setNutrientMode('Macro')}
              className={`text-xs font-black uppercase tracking-widest pb-2.5 px-2 transition-all relative ${nutrientMode === 'Macro' ? 'text-black' : 'text-slate-300 hover:text-slate-400'
                }`}
            >
              Macro
              {nutrientMode === 'Macro' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-black" />}
            </button>
            <button
              onClick={() => setNutrientMode('Micro')}
              className={`text-xs font-black uppercase tracking-widest pb-2.5 px-2 transition-all relative ${nutrientMode === 'Micro' ? 'text-black' : 'text-slate-300 hover:text-slate-400'
                }`}
            >
              Micro
              {nutrientMode === 'Micro' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-black" />}
            </button>
          </div>

          <div className="space-y-2 lg:space-y-4 pt-2 relative z-10">            {nutrientMode === 'Macro' ? (
            <div className="grid grid-cols-3 gap-2 lg:flex lg:flex-col lg:space-y-4">
              {/* Mobile: Compact Row, Desktop: Full Row */}
              <div className="lg:hidden">
                <NutrientMacroCompact
                  label="Protein"
                  value={(() => {
                    const goal = user?.nutritionGoal?.proteinGoal || nutritionData?.proteinGoal || 150;
                    const val = nutritionData?.totalProtein || dashboardData?.nutritionData?.totalProtein || 0;
                    return goal > 0 ? (val / goal) * 100 : 0;
                  })()}
                  targetLabel={`${user?.nutritionGoal?.proteinGoal || nutritionData?.proteinGoal || 150}g`}
                  icon={Flame} color="bg-black"
                />
              </div>
              <div className="hidden lg:block">
                <NutrientProgressRow
                  label="Protein"
                  value={(() => {
                    const goal = user?.nutritionGoal?.proteinGoal || nutritionData?.proteinGoal || 150;
                    const val = nutritionData?.totalProtein || dashboardData?.nutritionData?.totalProtein || 0;
                    return goal > 0 ? (val / goal) * 100 : 0;
                  })()}
                  targetLabel={`${user?.nutritionGoal?.proteinGoal || nutritionData?.proteinGoal || 150}g target`}
                  icon={Flame} color="bg-black" iconBg="bg-slate-50" iconColor="text-[#064e3b]"
                />
              </div>

              <div className="lg:hidden">
                <NutrientMacroCompact
                  label="Fats"
                  value={(() => {
                    const goal = user?.nutritionGoal?.fatGoal || nutritionData?.fatGoal || 65;
                    const val = nutritionData?.totalFats || dashboardData?.nutritionData?.totalFats || 0;
                    return goal > 0 ? (val / goal) * 100 : 0;
                  })()}
                  targetLabel={`${user?.nutritionGoal?.fatGoal || nutritionData?.fatGoal || 65}g`}
                  icon={Smile} color="bg-slate-600"
                />
              </div>
              <div className="hidden lg:block">
                <NutrientProgressRow
                  label="Fats"
                  value={(() => {
                    const goal = user?.nutritionGoal?.fatGoal || nutritionData?.fatGoal || 65;
                    const val = nutritionData?.totalFats || dashboardData?.nutritionData?.totalFats || 0;
                    return goal > 0 ? (val / goal) * 100 : 0;
                  })()}
                  targetLabel={`${user?.nutritionGoal?.fatGoal || nutritionData?.fatGoal || 65}g max`}
                  icon={Smile} color="bg-slate-600" iconBg="bg-slate-50" iconColor="text-slate-600"
                />
              </div>

              <div className="lg:hidden">
                <NutrientMacroCompact
                  label="Carbs"
                  value={(() => {
                    const goal = user?.nutritionGoal?.carbsGoal || nutritionData?.carbsGoal || 200;
                    const val = nutritionData?.totalCarbs || dashboardData?.nutritionData?.totalCarbs || 0;
                    return goal > 0 ? (val / goal) * 100 : 0;
                  })()}
                  targetLabel={`${user?.nutritionGoal?.carbsGoal || nutritionData?.carbsGoal || 200}g`}
                  icon={Heart} color="bg-slate-400"
                />
              </div>
              <div className="hidden lg:block">
                <NutrientProgressRow
                  label="Carbs"
                  value={(() => {
                    const goal = user?.nutritionGoal?.carbsGoal || nutritionData?.carbsGoal || 200;
                    const val = nutritionData?.totalCarbs || dashboardData?.nutritionData?.totalCarbs || 0;
                    return goal > 0 ? (val / goal) * 100 : 0;
                  })()}
                  targetLabel={`${user?.nutritionGoal?.carbsGoal || nutritionData?.carbsGoal || 200}g target`}
                  icon={Heart} color="bg-slate-400" iconBg="bg-slate-50" iconColor="text-slate-400"
                />
              </div>
            </div>

          ) : (
            <div className="space-y-3 lg:space-y-4 overflow-y-auto max-h-[135px] lg:max-h-[300px] pr-2 scrollbar-hide py-1">
              <NutrientProgressRow
                label="Fiber"
                value={((nutritionData?.totalFiber || dashboardData?.nutritionData?.totalFiber || 0) / 30) * 100}
                targetLabel="30g recommended"
                icon={Sparkles} color="bg-emerald-500" iconBg="bg-emerald-50" iconColor="text-emerald-500"
              />
              <NutrientProgressRow
                label="Iron"
                value={((nutritionData?.totalIron || dashboardData?.nutritionData?.totalIron || 0) / 18) * 100}
                targetLabel="18mg target"
                icon={Zap} color="bg-orange-500" iconBg="bg-orange-50" iconColor="text-orange-500"
              />
              <NutrientProgressRow
                label="Vitamin C"
                value={((nutritionData?.totalVitaminC || dashboardData?.nutritionData?.totalVitaminC || 0) / 90) * 100}
                targetLabel="90mg target"
                icon={Sun} color="bg-yellow-500" iconBg="bg-yellow-50" iconColor="text-yellow-500"
              />
              <NutrientProgressRow
                label="Vitamin A"
                value={((nutritionData?.totalVitaminA || dashboardData?.nutritionData?.totalVitaminA || 0) / 900) * 100}
                targetLabel="900mcg target"
                icon={Eye} color="bg-purple-500" iconBg="bg-purple-50" iconColor="text-purple-500"
              />
              <NutrientProgressRow
                label="Calcium"
                value={((nutritionData?.totalCalcium || dashboardData?.nutritionData?.totalCalcium || 0) / 1000) * 100}
                targetLabel="1000mg target"
                icon={Target} color="bg-blue-500" iconBg="bg-blue-50" iconColor="text-blue-500"
              />
              <NutrientProgressRow
                label="Vitamin D"
                value={((nutritionData?.totalVitaminD || dashboardData?.nutritionData?.totalVitaminD || 0) / 20) * 100}
                targetLabel="20mcg target"
                icon={Sun} color="bg-amber-500" iconBg="bg-amber-50" iconColor="text-amber-500"
              />
              <NutrientProgressRow
                label="B12"
                value={((nutritionData?.totalVitaminB12 || dashboardData?.nutritionData?.totalVitaminB12 || 0) / 2.4) * 100}
                targetLabel="2.4mcg target"
                icon={FlaskConical} color="bg-red-500" iconBg="bg-red-50" iconColor="text-red-500"
              />
              <NutrientProgressRow
                label="Sodium"
                value={((nutritionData?.totalSodium || dashboardData?.nutritionData?.totalSodium || 0) / 2300) * 100}
                targetLabel="2300mg max"
                icon={AlertCircle} color="bg-slate-400" iconBg="bg-slate-50" iconColor="text-slate-400"
              />
              <NutrientProgressRow
                label="Sugar"
                value={((nutritionData?.totalSugar || dashboardData?.nutritionData?.totalSugar || 0) / 50) * 100}
                targetLabel="50g max"
                icon={Droplet} color="bg-slate-600" iconBg="bg-slate-50" iconColor="text-slate-600"
              />
            </div>
          )}
          </div>
        </motion.div>

        {/* Card 2: Today's Diet Plan */}
        <motion.div
          style={{
            scale: typeof window !== 'undefined' && window.innerWidth < 1024 ? 1 - (Math.abs(1 - activeIndex) * 0.05) : 1,
            filter: typeof window !== 'undefined' && window.innerWidth < 1024 ? `blur(${Math.abs(1 - activeIndex) * 3}px)` : 'none',
            zIndex: 10 - Math.round(Math.abs(1 - activeIndex)),
            opacity: typeof window !== 'undefined' && window.innerWidth < 1024 ? 1 - (Math.abs(1 - activeIndex) * 0.2) : 1
          }}
          className="min-w-[85vw] lg:min-w-0 snap-center bg-white rounded-[2rem] p-4 lg:p-8 border border-slate-100 shadow-sm flex flex-col h-[340px] lg:h-full overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 mb-5 flex-nowrap overflow-hidden">
            <h2 className="text-base sm:text-xl font-black text-[#064e3b] whitespace-nowrap truncate">Today's Diet Plan</h2>
            <div className="flex items-center gap-1 bg-[#F8F9FB] px-1.5 py-1 rounded-lg border border-slate-50 shrink-0">
              <Calendar className="w-2.5 h-2.5 text-emerald-800/60" />
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">
                {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          </div>

          <div className="flex p-1 bg-[#F8F9FB] rounded-2xl mb-6 overflow-x-auto scrollbar-hide">
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
                className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all px-4 min-w-max ${activeMealTab === tab.id ? 'bg-[#064e3b] text-white shadow-md' : 'text-emerald-800/60 hover:text-[#064e3b]'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {(!dietPlan || !dietPlan.mealPlan) ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-3xl mb-6">
              <Target className="w-12 h-12 text-slate-300 mb-4" />
              {!user?.nutritionGoal?.calorieGoal ? (
                <>
                  <p className="text-sm font-bold text-slate-800 mb-2">Set your fitness goal</p>
                  <p className="text-xs text-slate-400 mb-4">Set your fitness goal to see your personalized diet plan</p>
                  <button
                    onClick={() => navigate('/profile?tab=goals')}
                    className="px-8 py-3 bg-[#064e3b] text-white rounded-full text-xs font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 hover:scale-105 transition-all"
                  >
                    Set Fitness Goal
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-slate-800 mb-2">Create your diet plan</p>
                  <p className="text-xs text-slate-400 mb-4">Your goal is set! Now generate your personalized diet plan</p>
                  <button
                    onClick={() => navigate('/diet-plan')}
                    className="px-8 py-3 bg-[#064e3b] text-white rounded-full text-xs font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 hover:scale-105 transition-all"
                  >
                    Create Diet Plan
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 space-y-3 mb-6 overflow-y-auto pr-1">
              {(dietPlan?.mealPlan?.[activeMealTab] || []).map((item, idx) => {
                const isLogged = isMealLogged(activeMealTab, item);
                return (
                  <div key={idx} className={`p-2 lg:p-4 rounded-xl lg:rounded-2xl flex items-center justify-between gap-2 transition-all ${isLogged ? 'bg-emerald-50/50 border border-emerald-100/50' : 'bg-slate-50'}`}>
                    <div className="flex items-center gap-2 lg:gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full ${isLogged ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-[#1A1A1A]'}`} />
                      <span className={`text-[10px] lg:text-sm font-medium lg:font-semibold ${isLogged ? 'text-emerald-900' : 'text-black'}`}>{item?.name || item?.foodItems?.[0]?.name}</span>
                    </div>
                    {isLogged && (
                      <div className="flex items-center gap-1 bg-emerald-500 text-white px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tight">
                        <Check className="w-2.5 h-2.5" /> LOGGED
                      </div>
                    )}
                  </div>
                );
              })}
              {(!(dietPlan?.mealPlan?.[activeMealTab])?.length) && (
                <div className="p-4 bg-slate-50/50 rounded-2xl text-center">
                  <p className="text-xs text-slate-400">No meals planned for this time</p>
                </div>
              )}
            </div>
          )}

          <button 
            onClick={() => navigate('/diet-plan')}
            className="w-full bg-[#064e3b] text-emerald-50 py-4 rounded-2xl text-[13px] font-black uppercase tracking-tight hover:bg-[#042f2e] transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            View Full Plan <ArrowUpRight className="w-4 h-4 ml-1" />
          </button>
        </motion.div>

        {/* Card 3: AI Lab Insights */}
        <motion.div
          style={{
            scale: typeof window !== 'undefined' && window.innerWidth < 1024 ? 1 - (Math.abs(2 - activeIndex) * 0.05) : 1,
            filter: typeof window !== 'undefined' && window.innerWidth < 1024 ? `blur(${Math.abs(2 - activeIndex) * 3}px)` : 'none',
            zIndex: 10 - Math.round(Math.abs(2 - activeIndex)),
            opacity: typeof window !== 'undefined' && window.innerWidth < 1024 ? 1 - (Math.abs(2 - activeIndex) * 0.2) : 1
          }}
          className="min-w-[85vw] lg:min-w-0 snap-center bg-white rounded-[2rem] p-4 lg:p-8 border border-slate-100 shadow-sm flex flex-col h-[340px] lg:h-full overflow-hidden"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm md:text-base font-black text-[#064e3b]">AI Lab Insights</h2>
            <Link to="/upload" className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] flex items-center gap-1 hover:text-black group">
              UPLOAD REPORT <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-2 scrollbar-thin scrollbar-thumb-black scrollbar-track-transparent">
            {dashboardData?.totalReports > 0 && dashboardData?.latestAnalysis?.metrics && Object.keys(dashboardData.latestAnalysis.metrics).length > 0 ? (
              Object.entries(dashboardData.latestAnalysis.metrics).map(([key, val]) => (
                <LabMetricsItem
                  key={key}
                  label={key}
                  value={typeof val === 'object' ? `${val.value} ${val.unit || ''}` : val}
                  status={(typeof val === 'object' && val.status) ? val.status : "Normal"}
                  icon={key.toLowerCase().includes('glucose') ? Droplet : key.toLowerCase().includes('hb') ? Circle : Activity}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center p-8 bg-slate-50/50 rounded-3xl text-center border border-dashed border-slate-200">
                <UploadCloud className="w-10 h-10 text-slate-300 mb-4" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 leading-loose">No Health Reports Found</p>
                <button
                  onClick={() => navigate('/upload')}
                  className="px-6 py-2.5 bg-[#064e3b] text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:scale-105 transition-all shadow-lg"
                >
                  Upload Report
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 p-3 lg:p-6 bg-white rounded-2xl lg:rounded-[2rem] border border-[#F1F1F4] relative group shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3 h-3 lg:w-4 lg:h-4 text-[#064e3b]" />
              <span className="text-[8px] lg:text-[10px] font-black text-emerald-800/40 uppercase tracking-widest">AI Rec</span>
            </div>
            <p className="text-[9px] lg:text-[12px] font-medium text-[#064e3b] leading-relaxed">
              {dashboardData?.latestAnalysis?.recommendations?.lifestyle?.[0] ? (
                `"${dashboardData.latestAnalysis.recommendations.lifestyle[0]}"`
              ) : (
                "Personalized health analysis will appear here."
              )}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Mobile Slider Indicators & Daily Vitals (New Position) */}
      <div className="lg:hidden px-4 mb-4">
        <div className="flex justify-center gap-2 mb-8 mt-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${Math.abs(activeIndex - i) < 0.5 ? 'w-6 bg-black' : 'w-2 bg-slate-200'}`} />
          ))}
        </div>
        <DailyMetricsCard />
      </div>

      {/* Diabetes Monitor Block */}
      {
        isDiabetic && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/80 backdrop-blur-2xl border border-emerald-100/30 rounded-[28px] md:rounded-[32px] p-4 md:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)] relative overflow-hidden mt-8 mb-8"
          >
            {/* Subtle inside gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/20 to-white/30 pointer-events-none" />

            <div className="relative z-10">
              <div className="flex flex-row items-center justify-between mb-4 md:mb-8">
                <div>
                  <h2 className="text-lg md:text-xl font-bold text-[#064e3b]">Diabetes Monitor</h2>
                  <p className="text-emerald-800/40 text-[10px] md:text-xs font-medium">Track glucose & HbA1c</p>
                </div>
                <button 
                  onClick={() => navigate('/diabetes')} 
                  className="px-3 py-1.5 md:px-6 md:py-2.5 bg-emerald-50/50 border border-emerald-100 hover:bg-emerald-100/50 text-[#064e3b] rounded-full text-[10px] md:text-sm font-black md:font-medium transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
                >
                  <Plus className="w-3 h-3 md:w-4 md:h-4" /> Log Reading
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-5">
                {(!dashboardData?.latestAnalysis && !dashboardData?.vitals?.glucose && !dashboardData?.vitals?.hba1c) ? (
                  <div className="col-span-2 bg-emerald-50/20 border border-emerald-100/30 rounded-[24px] p-6 text-center flex flex-col items-center justify-center">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
                      <Sparkles className="w-5 h-5 text-emerald-400" />
                    </div>
                    <p className="text-[#064e3b] text-xs font-bold mb-1">Monitoring ready</p>
                    <p className="text-emerald-800/40 text-[10px] max-w-sm">
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
                        status: dashboardData?.latestAnalysis?.metrics?.Glucose?.status || (dashboardData?.vitals?.glucose ? 'Recent Log' : 'Normal')
                      },
                      { 
                        label: 'HbA1c', 
                        val: dashboardData?.vitals?.hba1c?.value || dashboardData?.latestAnalysis?.metrics?.HbA1c?.value || '--', 
                        unit: '%', 
                        status: dashboardData?.latestAnalysis?.metrics?.HbA1c?.status || (dashboardData?.vitals?.hba1c ? 'Recent Log' : 'Good')
                      }
                    ].map((stat) => (
                      <div key={stat.label} className="bg-white/90 border border-emerald-50 shadow-sm rounded-2xl md:rounded-[24px] p-3 md:p-6 flex flex-col items-center justify-center relative group hover:bg-white transition-all">
                        <span className="text-emerald-800/40 text-[9px] md:text-[11px] font-black uppercase tracking-widest mb-1 md:mb-2">{stat.label}</span>
                        <div className="flex items-baseline gap-0.5 md:gap-1 mb-1 md:mb-3">
                          <span className="text-2xl md:text-4xl font-light text-[#064e3b] tracking-tight">{stat.val}</span>
                          {stat.val !== '--' && <span className="text-[10px] md:text-sm font-medium text-emerald-800/20">{stat.unit}</span>}
                        </div>
                        <span className={`text-[8px] md:text-[10px] font-bold px-2 py-0.5 md:px-3 md:py-1 rounded-full uppercase tracking-wider ${stat.val === '--' ? 'bg-emerald-50/10 text-emerald-800/40' : 'bg-emerald-50 text-[#064e3b]'}`}>
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

      {/* Your Logged Meals */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mb-8 px-4 md:px-0"
      >
        <div className="flex items-center justify-between mb-4 px-2">
          <h2 className="text-xl font-medium text-[#064e3b]">Your Logged Meals</h2>
          <button onClick={() => navigate('/nutrition')} className="text-xs font-medium text-emerald-800/60 hover:text-[#064e3b]">View Menu</button>
        </div>
        <div className="flex overflow-x-auto md:grid md:grid-cols-3 gap-4 md:gap-8 pb-4 md:pb-0 scrollbar-hide snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0">
          {loggedMeals.length > 0 ? (
            <>
              {loggedMeals.slice(0, 3).map((meal, i) => (
                <div key={i} className="min-w-[60vw] md:min-w-0 snap-center bg-white border border-emerald-50 rounded-[24px] md:rounded-[32px] overflow-hidden shadow-sm transition-all flex flex-col">
                  <div className="h-20 md:h-52 relative overflow-hidden">
                    <ImageWithFallback src={meal.imageUrl} query={meal.name || meal.foodItems?.[0]?.name || 'Delicious food'} alt={meal.name || meal.foodItems?.[0]?.name || 'Meal'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                    <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                      {[(meal.totalNutrition?.calories || meal.calories) > 300 ? 'High Energy' : null].filter(Boolean).map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-white/20 backdrop-blur-md text-white border border-white/30 text-[8px] font-black uppercase tracking-wider rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="absolute bottom-2 left-2 flex gap-1.5">
                      <span className="flex items-center gap-1 px-2 py-1 bg-white/90 backdrop-blur-md text-[#064e3b] text-[8px] font-black rounded-full shadow-sm uppercase tracking-widest">
                        <Flame className="w-2.5 h-2.5 text-[#064e3b]" /> {meal.totalNutrition?.calories || meal.calories || 0} cal
                      </span>
                      <span className="flex items-center gap-1 px-2 py-1 bg-white/90 backdrop-blur-md text-[#064e3b] text-[8px] font-black rounded-full shadow-sm uppercase tracking-widest">
                        <Clock className="w-2.5 h-2.5 text-emerald-800/40" /> {meal.mealType || 'Meal'}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 lg:p-8 flex-1 flex flex-col">
                    <h3 className="font-black text-[#064e3b] text-xs md:text-xl mb-2 md:mb-5 truncate">{meal.name || meal.foodItems?.[0]?.name || 'Logged Meal'}</h3>
                    <div className="flex gap-2 md:gap-3 mt-auto">
                      <button onClick={() => navigate('/nutrition', { state: { prefillData: meal } })} className="flex-1 py-2.5 md:py-3 bg-[#064e3b] hover:bg-[#042f2e] text-emerald-50 text-xs md:text-sm font-medium rounded-full transition-all shadow-md">
                        + Add Again
                      </button>
                      <button onClick={() => navigate('/nutrition')} className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 text-[#064e3b] text-sm font-bold rounded-full transition-colors border border-white shrink-0">
                        <Eye className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {loggedMeals.length > 3 && (
                <div className="min-w-[40vw] md:hidden snap-center flex items-center justify-center p-4">
                  <button onClick={() => navigate('/nutrition')} className="flex flex-col items-center gap-3 text-slate-500 hover:text-[#1a1a1a]">
                    <div className="w-14 h-14 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center transition-transform hover:scale-105">
                      <ArrowUpRight className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest">View All</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="md:col-span-3 flex flex-col items-center justify-center p-6 lg:p-12 bg-emerald-50/20 rounded-[2.5rem] border border-emerald-100/30">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-6">
                <Utensils className="w-8 h-8 text-emerald-200" />
              </div>
              <h3 className="text-sm font-black text-[#064e3b] uppercase tracking-tight mb-1">No Meals Logged</h3>
              <p className="text-[10px] text-emerald-800/40 font-bold max-w-[200px] mx-auto leading-relaxed">Log meals to see your history & suggestions.</p>
              <button
                onClick={() => navigate('/nutrition')}
                className="mt-6 px-10 py-3 bg-[#064e3b] text-emerald-50 rounded-full text-xs font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 hover:scale-105 transition-all"
              >
                Log First Meal
              </button>
            </div>
          )}
        </div>

        {/* AI Health Insights Section Moved Here */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mb-6 w-full px-4 md:px-0"
        >
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-xl font-medium text-[#064e3b]">AI Health Insights</h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest">REAL-TIME</span>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>

          <div className="bg-emerald-50/40 backdrop-blur-md rounded-[2rem] p-6 lg:p-8 relative overflow-hidden group shadow-lg border border-white">
            {/* Background Glows */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />

            <div className="relative z-10 flex items-center gap-6">
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="relative min-h-[40px] md:min-h-[48px] flex items-center">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={insightIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                      className="flex items-start gap-4 py-1 w-full"
                    >
                      {overallPerformanceInsight[insightIndex] && (
                        <>
                          <div className="flex-shrink-0 mt-1">
                            <div className={`${overallPerformanceInsight[insightIndex].color} opacity-90`}>
                              {(() => {
                                const Icon = overallPerformanceInsight[insightIndex].icon;
                                return <Icon className="w-4 h-4 md:w-5 md:h-5" />;
                              })()}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#065f46]/40 leading-none mb-1.5 grayscale opacity-70">
                              {overallPerformanceInsight[insightIndex].label}
                            </p>
                            <p className="text-[11px] md:text-sm font-medium text-[#064e3b] leading-snug">
                              {overallPerformanceInsight[insightIndex].text}
                            </p>
                          </div>
                        </>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-1.5">
                {overallPerformanceInsight.map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === insightIndex ? 'bg-white w-4' : 'bg-white/20'}`} />
                ))}
              </div>
            </div>
          </div>
        </motion.div>

      </motion.div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 px-4 md:px-0">


        {/* Daily Vitals (Weight, Steps, Sleep) - Visible only on Desktop here */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="hidden lg:flex flex-col h-full"
        >
          <DailyMetricsCard />

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
              <h3 className="text-sm font-semibold text-[#1a1a1a]">Nutrition Deficiency</h3>
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
              <div className="flex flex-col items-center justify-center p-10 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200 text-center">
                {loggedMeals.length > 0 || dashboardData?.latestAnalysis?.deficiencies?.length > 0 ? (
                  <>
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-4" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">
                      Great job! You've met <br /> all nutritional targets
                    </p>
                  </>
                ) : (
                  <>
                    <Activity className="w-10 h-10 text-slate-300 mb-4" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">
                      Log your meals to see <br /> nutritional insights
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
              <span className="text-sm text-[#888888]">/{ (() => {
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
              })() }</span>
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
                animate={{ width: `${(completedTasks.length / (() => {
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
                })()) * 100}%` }}
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

      {/* Health Trends */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85 }}
        className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-[32px] p-6 lg:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)] relative overflow-hidden mb-8 mx-4 md:mx-0"
      >
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center border border-white shadow-sm">
              <TrendingUp className="w-5 h-5 text-[#064e3b]" />
            </div>
            <div>
              <h3 className="text-xl font-medium text-[#064e3b]">Health Trends</h3>
              <p className="text-[#666666] text-sm">Monitor your progress over time</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="bg-[#F5F5F7] p-1.5 rounded-2xl md:rounded-full grid grid-cols-3 sm:flex gap-1 border border-white shadow-sm w-full md:w-auto">
              {['1W', '1M', '3M'].map(range => (
                <button
                  key={range}
                  onClick={() => setTrendTimeRange(range)}
                  className={`px-4 py-2 rounded-xl md:rounded-full text-xs font-bold transition-all whitespace-nowrap text-center ${trendTimeRange === range
                    ? 'bg-[#1a1a1a] text-white shadow-sm'
                    : 'text-[#666666] hover:text-[#1a1a1a]'
                    }`}
                >
                  {range}
                </button>
              ))}
            </div>
            <div className="bg-[#F5F5F7] p-1.5 rounded-2xl md:rounded-full grid grid-cols-4 sm:flex gap-1 border border-white shadow-sm w-full md:w-auto">
              {['Calories', 'Sleep', 'Steps', 'Weight'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTrendTab(tab)}
                  className={`px-1 sm:px-6 py-2 rounded-xl md:rounded-full text-[10px] sm:text-sm font-medium transition-all whitespace-nowrap text-center ${activeTrendTab === tab
                    ? 'bg-white text-[#1a1a1a] shadow-sm'
                    : 'text-[#666666] hover:text-[#1a1a1a]'
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-[300px] w-full">
          {(() => {
            const chartData = (dashboardData?.history || []).filter(h => {
              if (!h.date) return false;
              const date = new Date(h.date);
              date.setHours(0, 0, 0, 0);
              const now = new Date();
              now.setHours(23, 59, 59, 999);
              const diffMs = now.getTime() - date.getTime();
              const diffDays = diffMs / (1000 * 60 * 60 * 24);

              if (trendTimeRange === '1W') return diffDays < 7 && diffDays >= 0;
              if (trendTimeRange === '1M') return diffDays < 30 && diffDays >= 0;
              if (trendTimeRange === '3M') return diffDays < 90 && diffDays >= 0;
              return diffDays >= 0;
            }).map(h => ({
              date: new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              value: activeTrendTab === 'Calories' ? h.calories : activeTrendTab === 'Steps' ? h.steps : activeTrendTab === 'Sleep' ? h.sleep : h.weight
            }));

            const target = activeTrendTab === 'Calories' ? (user?.nutritionGoal?.calorieGoal || 2000)
              : activeTrendTab === 'Steps' ? (dashboardData?.goals?.steps || 10000)
              : activeTrendTab === 'Sleep' ? (user?.profile?.lifestyle?.sleepHours || 8)
              : (user?.nutritionGoal?.targetWeight || user?.profile?.weight || 70);

            return (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#888888', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#888888', fontSize: 12 }}
                    dx={-10}
                    domain={[0, (dataMax) => Math.max(dataMax, target * 1.1)]}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                    formatter={(value) => [`${value}`, activeTrendTab]}
                    labelStyle={{ color: '#888888', marginBottom: '4px' }}
                  />
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#000000" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#000000" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#000000"
                    strokeWidth={4}
                    fillOpacity={1}
                    fill="url(#colorValue)"
                    activeDot={{ r: 6, fill: '#1a1a1a', strokeWidth: 2, stroke: '#fff' }}
                  />
                  <ReferenceLine
                    y={target}
                    stroke="#000000"
                    strokeDasharray="5 5"
                    strokeWidth={1.5}
                    label={{
                      value: `Target: ${target}`,
                      position: 'insideBottomRight',
                      fill: '#000000',
                      fontSize: 10,
                      fontWeight: 'bold',
                      offset: 10
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            );
          })()}
        </div>
      </motion.div>
      <AnimatePresence>
        {showMealModal && (
          <MealDetailModal
            meal={selectedMealForModal}
            onClose={() => setShowMealModal(false)}
            onAdd={async (foodData) => {
              try {
                const foodItem = foodData.foodItem || foodData;
                await api.post('nutrition/log-meal', {
                  mealType: activeMealTab === 'snacks' ? 'snack' : activeMealTab,
                  foodItems: [{
                    name: foodItem.name,
                    quantity: foodItem.quantity,
                    nutrition: foodItem.nutrition
                  }],
                  healthScore: foodData.healthScore,
                  healthScore10: foodData.healthScore10,
                  micronutrients: foodData.micronutrients,
                  source: 'dashboard_gallery',
                  timestamp: new Date()
                });
                toast.success('Meal added to your logs!');
                setShowMealModal(false);
                fetchDashboard(true);
                fetchNutrition(new Date().toISOString().split('T')[0], true);
                // Refresh logged meals
                nutritionService.getTodayLogs().then(res => setLoggedMeals(res.data?.foodLogs || res.data?.logs || []));
              } catch (err) {
                toast.error('Failed to log meal');
              }
            }}
          />
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
