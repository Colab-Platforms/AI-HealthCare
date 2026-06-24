import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import {
  Flame,
  Moon,
  Utensils,
  Activity,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Bell,
  ChevronRight,
  ChevronLeft,
  Plus,
  FileText,
  AlertCircle,
  Droplet,
  Search,
  Sun,
  Heart,
  Apple,
  Info,
  Target,
  Calendar,
  ArrowUpRight,
  Upload,
  Coffee,
  Dumbbell,
  MessageCircle,
  BarChart3,
  Circle,
  Smile,
  FlaskConical,
  Leaf,
  Pill,
  CheckCircle2,
  Zap,
  Eye,
  UtensilsCrossed,
  UploadCloud,
  ShieldCheck,
  AlertTriangle,
  Check,
  Dna,
  Scale,
  Footprints,
  X,
  Minus,
  GlassWater,
  Save,
  ArrowRight,
  Lightbulb,
  Clock,
  Cigarette,
  Wine,
} from "lucide-react";
import toast from "react-hot-toast";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Joyride, STATUS } from "react-joyride";
import DashboardSkeleton from "../components/skeletons/DashboardSkeleton";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ReferenceLine,
  Label,
  BarChart,
  Bar,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { getFoodImage } from "../services/imageService";
import api, { nutritionService, dietRecommendationService } from "../services/api";
import { ImageWithFallback } from "../components/ImageWithFallback";
import SEO from "../hooks/useSEO";
import SmokeTrackerCard from "../components/SmokeTrackerCard";
import AlcoholTrackerCard from "../components/AlcoholTrackerCard";
import { features } from "../config/features";
import StepMiniCard from "../components/StepCounter";
import useCarePlanTasks from "../hooks/useCarePlanTasks";

const DashedGauge = ({ value, max = 2400, mode = "Macro" }) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const totalDashes = 18;
  const activeDashes = Math.floor((percentage / 100) * totalDashes);

  const getSripColor = (index, isActive) => {
    if (!isActive) return "#F5F5F7";
    // 1st 7 strips: dd5432 67% and c82d06
    if (index < 7) return index % 2 === 0 ? "#dd5432" : "#c82d06";
    // next 6 strips: f6efde and b8964e
    if (index < 13) return index % 2 === 0 ? "#f6efde" : "#b8964e";
    // last 5 strips: 83c3ae and 567c6f
    return index % 2 === 0 ? "#83c3ae" : "#567c6f";
  };

  return (
    <div className="relative flex flex-col items-center justify-center pt-1 pb-1">
      <svg
        width="180"
        height="90"
        viewBox="0 0 240 120"
        className="overflow-visible lg:w-[220px] lg:h-[110px]"
      >
        {Array.from({ length: totalDashes }).map((_, i) => {
          const angle = i * (180 / (totalDashes - 1));
          const isActive = i < activeDashes;
          return (
            <line
              key={i}
              x1="20"
              y1="120"
              x2="52"
              y2="120"
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

const NutrientProgressRow = ({
  label,
  value,
  targetLabel,
  icon: Icon,
  color = "bg-black",
  iconBg = "bg-slate-50",
  iconColor = "text-black",
}) => (
  <div className="group">
    <div className="flex justify-between items-center mb-1.5 px-1">
      <div className="flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded-lg ${iconBg} flex items-center justify-center`}
        >
          <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
        </div>
        <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight">
          {label}
        </span>
      </div>
      <div className="text-right">
        <span className="text-[10px] font-black text-black">
          {Math.round(value)}%
        </span>
        {targetLabel && (
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter block -mt-0.5">
            {targetLabel}
          </span>
        )}
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

const NutrientMacroCompact = ({
  label,
  value,
  targetLabel,
  icon: Icon,
  color = "bg-[#064e3b]",
}) => (
  <div className="flex flex-col items-center gap-1">
    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center mb-0.5">
      <Icon className="w-4 h-4 text-[#064e3b]" />
    </div>
    <div className="text-xs font-black text-[#064e3b] leading-tight">
      {Math.round(value)}%
    </div>
    <div className="text-[10px] font-bold text-emerald-800/60 uppercase tracking-tighter leading-none">
      {label}
    </div>
    {targetLabel && (
      <div className="text-[9px] font-bold text-emerald-800/40 uppercase leading-none mt-0.5">
        {targetLabel}
      </div>
    )}
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
      getFoodImage(item.name).then((img) => {
        if (isMounted && img) setImage(img);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [item?.name]);

  const tag =
    item?.tag ||
    (item?.calories < 200
      ? "LOW CALORIE"
      : item?.protein > 10
        ? "HIGH PROTEIN"
        : "HEALTHY");

  return (
    <div
      onClick={() => onClick && onClick({ ...item, image })}
      className={`min-w-[180px] rounded-[2.2rem] p-4 group transition-all border flex flex-col snap-start cursor-pointer bg-white border-slate-50/50 hover:bg-white hover:shadow-xl hover:shadow-slate-100`}
    >
      <div className="relative h-40 mb-3">
        <div className="w-full h-full rounded-[1.5rem] overflow-hidden bg-slate-50">
          {image ? (
            <img
              src={item?.imageUrl || image}
              alt={item?.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src =
                  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80";
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-200">
              <Utensils className="w-8 h-8 opacity-10" />
            </div>
          )}
        </div>
        <div className="absolute top-2.5 right-2.5 px-2.5 py-1.5 bg-white/90 backdrop-blur-md rounded-full text-[9px] font-black text-black shadow-sm flex items-center gap-1">
          {item?.totalNutrition?.calories ||
            item?.nutrition?.calories ||
            item?.calories ||
            0}{" "}
          <span className="text-slate-400 text-[8px] font-bold">KCAL</span>
        </div>
      </div>
      <div className="px-1">
        <h4 className="text-base font-black text-black mb-1 truncate tracking-tight">
          {item?.name || item?.foodItems?.[0]?.name || "Healthy Dish"}
        </h4>
        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
          {tag}
        </div>
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
        <h4 className="text-[10px] lg:text-[12px] font-medium text-[#064e3b] leading-tight">
          {label}
        </h4>
      </div>
    </div>
    <div className="text-right">
      <div className="text-[10px] lg:text-[12px] font-black text-[#064e3b] leading-tight mb-0.5">
        {value}
      </div>
      <div
        className={`text-[8px] lg:text-[9px] font-medium uppercase tracking-widest ${
          status?.toLowerCase().includes("high") ||
          status?.toLowerCase().includes("risk")
            ? "text-[#064e3b]"
            : "text-emerald-800/40"
        }`}
      >
        {status}
      </div>
    </div>
  </div>
);

const DiabetesMonitor = ({ onLog }) => {
  const [reading, setReading] = useState("");
  const [type, setType] = useState("Fasting");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!reading) return;
    setLoading(true);
    try {
      await api.post("health/glucose", {
        value: reading,
        type,
        date: new Date(),
      });
      setReading("");
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
          <h2 className="text-2xl font-bold text-[#1a1a1a]">
            Diabetes Monitor
          </h2>
          <p className="text-sm font-medium text-[#a0a0a0]">
            Biological markers tracking
          </p>
        </div>
        <button onClick={() => navigate("/glucose-log")} className="flex items-center gap-2 bg-[#FAFBF8] px-6 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-widest border border-[#f0f0ea] shadow-sm hover:shadow-md transition-all">
          <Plus className="w-4 h-4" />
          Log Reading
        </button>
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-4 bg-[#FAFBF8] p-4 rounded-[24px] border border-[#f0f0ea] mb-8">
        <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-hide w-full">
          {["Fasting", "Post-Meal", "Random"].map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-8 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${type === t ? "bg-[#1a1a1a] text-white shadow-md" : "text-[#8a8a8a] hover:text-[#1a1a1a]"}`}
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
            {loading ? "..." : "Save"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        {[
          {
            label: "Glucose",
            val: "110",
            unit: "mg/dL",
            status: "Normal",
            color: "#5B8C6F",
          },
          {
            label: "Avg Sugar",
            val: "126",
            unit: "mg/dL",
            status: "-3%",
            color: "#F59E0B",
          },
          {
            label: "HbA1c",
            val: "5.8",
            unit: "%",
            status: "Good",
            color: "#5B8C6F",
          },
        ].map((item, i) => (
          <div
            key={i}
            className="liquid-glass-inner rounded-[24px] p-6 lg:p-8 text-center transition-shadow"
          >
            <p className="text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-4">
              {item.label}
            </p>
            <div className="flex items-baseline justify-center gap-1 mb-2">
              <span className="text-3xl lg:text-4xl font-black text-[#1a1a1a]">
                {item.val}
              </span>
              <span className="text-[10px] font-bold text-[#b0b0b0] uppercase">
                {item.unit}
              </span>
            </div>
            <span
              className={`px-4 py-1.5 bg-white text-[10px] font-bold rounded-full border border-[#f0f0ea] uppercase tracking-wider`}
              style={{ color: item.color }}
            >
              {item.status}
            </span>
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
        const response = await api.post("nutrition/quick-check", {
          foodDescription: `${meal.name} ${meal.quantity || ""}`,
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
      quantity: meal.portionSize || meal.quantity || "1 serving",
      nutrition: {
        calories: meal.calories || 0,
        protein: meal.protein || 0,
        carbs: meal.carbs || 0,
        fats: meal.fats || 0,
        fiber: 0,
        sugar: 0,
        sodium: 0,
      },
    },
    healthScore10: 7,
    healthBenefitsSummary: "Loading dietary insights...",
    isHealthy: true,
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
              <svg
                className="absolute inset-0 w-full h-full -rotate-90"
                viewBox="0 0 100 100"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#F5F5F7"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#1A1A1A"
                  strokeWidth="8"
                  strokeDasharray={283}
                  strokeDashoffset={283 - (283 * healthScore) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="flex flex-col items-center justify-center z-10">
                <span className="text-xl font-black text-black">
                  {healthScore}
                </span>
                <span className="text-[8px] font-bold text-slate-400">
                  / 100
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-3 py-1 bg-slate-100 text-black text-[9px] font-black uppercase tracking-widest rounded-full">
                  {data.isHealthy ? "Healthy Choice" : "Indulgence"}
                </span>
                {nutrition.calories < 200 && (
                  <span className="px-3 py-1 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-full">
                    Low Calorie
                  </span>
                )}
              </div>
              <h2 className="text-3xl font-black text-black tracking-tight">
                {data.foodItem.name}
              </h2>
              <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">
                ⚡ {data.foodItem.quantity}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-all border border-slate-100"
          >
            <Plus className="w-5 h-5 rotate-45 text-slate-400" />
          </button>
        </div>

        <div className="px-8 overflow-y-auto pb-8 scrollbar-hide">
          {/* Main Image */}
          <div className="relative h-64 rounded-3xl overflow-hidden mb-8 border border-slate-100">
            <ImageWithFallback
              src={meal.image || data.imageUrl}
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
              <div className="text-lg font-black text-black leading-none">
                {Math.round(nutrition.calories)}
              </div>
              <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Calories
              </div>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-2 border border-slate-100">
                <Zap className="w-4 h-4 text-black" />
              </div>
              <div className="text-lg font-black text-black leading-none">
                {Math.round(nutrition.protein)}g
              </div>
              <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Protein
              </div>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-2 border border-slate-100">
                <Activity className="w-4 h-4 text-black" />
              </div>
              <div className="text-lg font-black text-black leading-none">
                {Math.round(nutrition.carbs)}g
              </div>
              <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Carbs
              </div>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-2 border border-slate-100">
                <Heart className="w-4 h-4 text-black" />
              </div>
              <div className="text-lg font-black text-black leading-none">
                {Math.round(nutrition.fats)}g
              </div>
              <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Fats
              </div>
            </div>

            <div className="col-span-4 mt-4 pt-4 border-t border-slate-50 flex justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Fiber:{" "}
                  <span className="text-black">{nutrition.fiber || 0}g</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Sugar:{" "}
                  <span className="text-black">{nutrition.sugar || 0}g</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Sodium:{" "}
                  <span className="text-black">{nutrition.sodium || 0}mg</span>
                </span>
              </div>
            </div>
          </div>

          {/* Health Benefits Section */}
          <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                <Info className="w-4 h-4 text-black" />
              </div>
              <h3 className="text-[11px] font-black uppercase tracking-widest text-black">
                Health Benefits
              </h3>
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

// --- Feature Carousel ---
const FEATURE_SLIDES = [
  {
    tag: "AI Diet Plan",
    title: "7-Day Personalized\nMeal Plan",
    desc: "AI crafts your perfect diet based on your goals, health & preferences.",
    cta: "View Plan",
    ctaPath: "/diet-plan",
    bg: "linear-gradient(135deg, #1a3a2a 0%, #2d5a3d 60%, #3d7a52 100%)",
    img: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80",
  },
  {
    tag: "Glucose Monitor",
    title: "Track Blood Sugar\nTrends Daily",
    desc: "Log readings and get AI-powered insights on your glucose patterns.",
    cta: "Log Glucose",
    ctaPath: "/glucose-log",
    bg: "linear-gradient(135deg, #1a2a3a 0%, #1e3a5f 60%, #1a5276 100%)",
    img: "https://images.unsplash.com/photo-1631815589968-fdb09a223b1e?w=600&q=80",
  },
  {
    tag: "Lab Reports",
    title: "Upload Reports\nGet AI Insights",
    desc: "Our AI reads your lab reports and flags deficiencies instantly.",
    cta: "Upload Now",
    ctaPath: "/upload",
    bg: "linear-gradient(135deg, #2a1a3a 0%, #3d2060 60%, #4a1a6e 100%)",
    img: "https://images.unsplash.com/photo-1576671081837-49000212a370?w=600&q=80",
  },
  {
    tag: "Fitness Goals",
    title: "Hit Your Calorie\n& Macro Targets",
    desc: "Stay on track with real-time nutrition logging and progress rings.",
    cta: "Log Meal",
    ctaPath: "/nutrition",
    bg: "linear-gradient(135deg, #1a2a1a 0%, #2d4a1a 60%, #3a5a20 100%)",
    img: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=80",
  },
  {
    tag: "Lifestyle",
    title: "Track Sleep,\nWater & Habits",
    desc: "Monitor all lifestyle factors that impact your health in one place.",
    cta: "Log Sleep",
    ctaPath: "/dashboard",
    bg: "linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)",
    img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80",
  },
];

function FeatureCarousel({ navigate }) {
  const [idx, setIdx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const timerRef = useRef(null);

  const goTo = (next) => {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => {
      setIdx(next);
      setAnimating(false);
    }, 280);
  };

  useEffect(() => {
    timerRef.current = setInterval(() => {
      goTo((idx + 1) % FEATURE_SLIDES.length);
    }, 4000);
    return () => clearInterval(timerRef.current);
  }, [idx]);

  const slide = FEATURE_SLIDES[idx];

  return (
    <div className="relative w-full overflow-hidden rounded-[26px] border border-white/20" style={{ minHeight: 140, background: slide.bg, transition: "background 0.6s ease" }}>
      {/* BG Image */}
      <img
        src={slide.img}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 0.22, transition: "opacity 0.4s" }}
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)" }} />

      {/* Content */}
      <div
        className="relative z-10 p-5 flex items-center justify-between h-full"
        style={{ minHeight: 140, opacity: animating ? 0 : 1, transform: animating ? "translateY(6px)" : "translateY(0)", transition: "opacity 0.28s, transform 0.28s" }}
      >
        <div className="flex flex-col gap-2 flex-1 pr-4">
          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/60">{slide.tag}</span>
          <h3 className="text-white font-black text-base leading-tight" style={{ whiteSpace: "pre-line" }}>{slide.title}</h3>
          <p className="text-white/65 text-[10px] font-medium leading-snug max-w-[220px]">{slide.desc}</p>
          <button
            onClick={() => navigate(slide.ctaPath)}
            className="mt-1 self-start px-4 py-1.5 rounded-xl text-[10px] font-black text-white uppercase tracking-wider transition-all active:scale-95"
            style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.3)", backdropFilter: "blur(8px)" }}
          >
            {slide.cta} →
          </button>
        </div>

        {/* Right image circle */}
        <div className="shrink-0 w-[90px] h-[90px] rounded-2xl overflow-hidden border-2 border-white/20 shadow-xl">
          <img src={slide.img} alt="" className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Dot indicators */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {FEATURE_SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="transition-all duration-300 rounded-full"
            style={{ width: i === idx ? 18 : 6, height: 6, background: i === idx ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)" }}
          />
        ))}
      </div>
    </div>
  );
}

// --- Main Component ---

export default function DashboardEnhanced() {
  const { user, refreshUser } = useAuth();
  const {
    dashboardData,
    nutritionData,
    wearableData,
    weeklyTrends,
    fetchDashboard,
    fetchNutrition,
    fetchNutritionLogs,
    fetchDietPlan,
    fetchWearable,
    fetchWeeklyTrends,
    loading,
    dataRefreshTrigger,
    invalidateCache,
  } = useData();
  const navigate = useNavigate();

  const [dietPlan, setDietPlan] = useState(null);
  const [dietHistory, setDietHistory] = useState([]);
  const [selectedDietDate, setSelectedDietDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedCalorieDate, setSelectedCalorieDate] = useState(new Date().toISOString().split("T")[0]);
  const [calorieDateData, setCalorieDateData] = useState(null);
  const [calorieDateLoading, setCalorieDateLoading] = useState(false);
  const [showCalorieDatePicker, setShowCalorieDatePicker] = useState(false);
  const [calorieDatePickerMonth, setCalorieDatePickerMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [calorieDatePickerPos, setCalorieDatePickerPos] = useState({ top: 0, right: 0 });
  const calorieDateBtnRef = useRef(null);
  const [dietDatePickerPos, setDietDatePickerPos] = useState({ top: 0, right: 0 });
  const dietDateBtnRef = useRef(null);
  const [loggedMeals, setLoggedMeals] = useState([]);
  const [loggedMealsMap, setLoggedMealsMap] = useState({});
  const [isDiabetic, setIsDiabetic] = useState(false);
  const [selectedMealForModal, setSelectedMealForModal] = useState(null);
  const [showMealModal, setShowMealModal] = useState(false);
  const [nutrientMode, setNutrientMode] = useState("Macro");
  const [showNutrientDetails, setShowNutrientDetails] = useState(false);
  const [activeDietSlide, setActiveDietSlide] = useState(0);
  const [activeMealTab, setActiveMealTab] = useState("breakfast");
  const [activeDiabetesTab, setActiveDiabetesTab] = useState("Fasting");
  const [activeTrendTab, setActiveTrendTab] = useState("Calories");
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isLogVitalsOpen, setIsLogVitalsOpen] = useState(false);
  const [activeLogTab, setActiveLogTab] = useState("Weight"); // Weight, Steps, Sleep, Water
  const [waterLog, setWaterLog] = useState(0);
  const [vitalsLoading, setVitalsLoading] = useState(false);
  const [vitalsInput, setVitalsInput] = useState({
    weight: "",
    steps: "",
    sleepHours: "",
    sleepMins: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const placeholders = [
    "How often should i do HbA1c...",
    "What should I eat for dinner?",
    "Am I reaching my goals?",
  ];

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
      const today = new Date().toISOString().split("T")[0];
      await Promise.all([
        fetchDashboard(),
        fetchNutrition(today),
        fetchWearable(),
        fetchWeeklyTrends(),
      ]);
    };
    loadAllData();
  }, [fetchDashboard, fetchNutrition, fetchWearable, fetchWeeklyTrends]);

  // Sync Sleep Inputs with Real Data
  useEffect(() => {
    if (wearableData?.todayMetrics?.sleep !== undefined) {
      const totalMins = Number(wearableData.todayMetrics.sleep);
      if (totalMins > 0) {
        setVitalsInput((prev) => ({
          ...prev,
          sleepHours: Math.floor(totalMins / 60).toString(),
          sleepMins: (totalMins % 60).toString(),
        }));
      }
    }
  }, [wearableData?.todayMetrics?.sleep]);

  // Sync Weight Input with Real Data
  useEffect(() => {
    const currentWeight =
      dashboardData?.vitals?.weight?.value || user?.profile?.weight;
    if (currentWeight) {
      setVitalsInput((prev) => ({
        ...prev,
        weight: currentWeight.toString(),
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
      const dateStr = d.toISOString().split("T")[0];
      const dayName = d
        .toLocaleDateString("en-US", { weekday: "short" })
        .toUpperCase();
      days.push({ date: dateStr, day: dayName });
    }

    // Map data from various sources (dashboardData.history is the primary source of truth for 90-day history)
    const historySource = dashboardData?.history || [];

    return {
      weight: days.map((d) => {
        const entry = historySource.find((h) => h.date === d.date);
        return {
          day: d.day,
          value: entry?.weight || user?.profile?.weight || 70,
        };
      }),
      water: days.map((d) => {
        const entry = historySource.find((h) => h.date === d.date);
        return { day: d.day, value: entry?.water || 0 };
      }),
      steps: days.map((d) => {
        const entry = historySource.find((h) => h.date === d.date);
        return { day: d.day, value: entry?.steps || 0 };
      }),
      sleep: days.map((d) => {
        const entry = historySource.find((h) => h.date === d.date);
        return { day: d.day, value: entry?.sleep || 0 };
      }),
    };
  }, [dashboardData?.history, user?.profile?.weight]);

  const handleLogVitals = async (type, change = null) => {
    setVitalsLoading(true);
    try {
      const logDate =
        vitalsInput.date || new Date().toISOString().split("T")[0];

      if (type === "Weight") {
        if (!vitalsInput.weight) throw new Error("Weight is required");
        await api.post("nutrition/log-weight", {
          weight: Number(vitalsInput.weight),
          notes: "Mobile dashboard log",
          date: logDate,
        });
        toast.success(type + " logged successfully");
      } else if (type === "Steps") {
        if (!vitalsInput.steps) throw new Error("Steps required");
        const stepsToAdd = Number(vitalsInput.steps);
        await api.post("wearables/sync", {
          deviceType: "other",
          isAdditive: true,
          metrics: { steps: stepsToAdd, date: logDate },
        });
        toast.success("Steps added successfully");
      } else if (type === "Sleep") {
        if (!vitalsInput.sleepHours && !vitalsInput.sleepMins)
          throw new Error("Sleep duration required");
        const totalMins =
          Number(vitalsInput.sleepHours || 0) * 60 +
          Number(vitalsInput.sleepMins || 0);
        await api.post("wearables/sleep", {
          deviceType: "other",
          isAdditive: false,
          sleepData: { totalSleepMinutes: totalMins, date: logDate },
        });
        toast.success("Sleep logged successfully");
      } else if (type === "Water") {
        const currentWater =
          nutritionData?.totalWater ?? nutritionData?.waterIntake ?? 0;
        const newWater = Math.max(0, Number(currentWater) + (change || 0));
        await api.post("nutrition/log-water", {
          date: logDate,
          waterIntake: newWater,
        });
        setWaterLog(newWater);
        toast.success("Water logged successfully");
      }

      // Sync all data sources
      invalidateCache(["dashboard", "wearable", `nutrition_${logDate}`]);
      await Promise.all([
        fetchDashboard(true),
        fetchNutrition(logDate, true),
        fetchWearable(true),
        // Refresh user profile so weight gauge reads the updated user.profile.weight
        type === "Weight" ? refreshUser() : Promise.resolve(),
      ]);

      if (type !== "Water") {
        // Only reset the fields that were just logged; preserve sleep values from server if not logging sleep
        setVitalsInput((prev) => ({
          ...prev,
          weight: type === "Weight" ? "" : prev.weight,
          steps: type === "Steps" ? "" : prev.steps,
          sleepHours: type === "Sleep" ? "" : prev.sleepHours,
          sleepMins: type === "Sleep" ? "" : prev.sleepMins,
          date: logDate,
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
      target: ".tour-profile",
      content: "Tap your profile here anytime to set your fitness Goal.",
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: ".tour-nutrient-info",
      content:
        "Track your daily macros, micros, and live diet goals here. Swipe left to see more cards!",
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: ".tour-diet-plan",
      content:
        "Your AI-generated daily meal schedule appears here based on your fitness goals.",
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: ".tour-ai-insights",
      content:
        "Upload your medical reports here to get deep AI Lab Insights instantly.",
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: ".tour-health-profile",
      content:
        "Tap here to unlock your full AI-generated Health Archetype and medical summary.",
      placement: "top",
      disableBeacon: true,
    },
    {
      target: ".tour-logged-meals",
      content:
        "All your tracked meals appear here. Keep eating healthy to hit your targets!",
      placement: "top",
      disableBeacon: true,
    },
    {
      target: ".nav-center-fab",
      content:
        "The action hub! Tap this bold button to quick-log your meals, sleep, steps, and water intake.",
      placement: "top",
      disableBeacon: true,
    },
    {
      target: ".mobile-bottom-nav-container",
      content:
        "Navigate between your Dashboard, Nutrition, and Medical Reports swiftly using these tabs.",
      placement: "top",
      disableBeacon: true,
    },
  ]);

  // 🔐 Synchronous Ironclad Guard: Resolve instantly to prevent refresh flicker
  const isTourCompleted = (() => {
    if (localStorage.getItem("joyride-completed-any") === "true") return true;
    if (
      user?._id &&
      localStorage.getItem(`joyride-completed-${user._id}`) === "true"
    )
      return true;
    if (user?.profile?.hasSeenMobileTour) return true;
    return false;
  })();

  // Instant DOM synchronization
  if (isTourCompleted) {
    document.body.classList.add("onboarding-tour-finished");
    if (document.documentElement)
      document.documentElement.setAttribute("data-tour-finished", "true");
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
        api
          .put("auth/profile", { profile: { hasSeenMobileTour: true } })
          .then(
            () =>
              updateUser && updateUser({ ...user, profile: updatedProfile }),
          )
          .catch((e) => console.error("DB Sync Fail:", e));
      }
      setRunTour(false);
      document.body.classList.add("onboarding-tour-finished");
    }

    // Smooth scroll logic maintained below...

    // Maintain the smooth scrolling logic for tour steps
    if (type === "step:before" || type === "tooltip") {
      setTimeout(() => {
        try {
          if (
            step?.target &&
            [
              ".tour-nutrient-info",
              ".tour-diet-plan",
              ".tour-ai-insights",
            ].includes(step.target)
          ) {
            if (scrollContainerRef.current) {
              let leftScroll = 0;
              if (step.target === ".tour-nutrient-info") {
                leftScroll = 0;
              } else if (step.target === ".tour-diet-plan") {
                leftScroll = window.innerWidth * 0.85;
              } else if (step.target === ".tour-ai-insights") {
                leftScroll = window.innerWidth * 1.7;
              }
              scrollContainerRef.current.scrollTo({
                left: leftScroll,
                behavior: "smooth",
              });
            }
          }
          const targetEl = document.querySelector(step.target);
          if (targetEl) {
            const bodyRect = document.body.getBoundingClientRect().top;
            const elementRect = targetEl.getBoundingClientRect().top;
            const elementPosition = elementRect - bodyRect;
            const yOffset =
              elementPosition -
              window.innerHeight / 2 +
              targetEl.clientHeight / 2;
            window.scrollTo({ top: Math.max(0, yOffset), behavior: "smooth" });
          }
        } catch (err) {
          console.error("Tour focus fail:", err);
        }
      }, 50);
    }
  };

  const { completedTasks, toggleTask: toggleCarePlanTask } = useCarePlanTasks();

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
      id: "score",
      type: "primary",
      icon: Heart,
      color: "text-rose-400",
      label: "Health Score",
      text: `Your overall vitality score is ${healthScore}/100 based on recent logs.`,
    });

    // Calorie Pointer
    if (caloriesLeft < 0) {
      insights.push({
        id: "calories",
        type: "warning",
        icon: AlertCircle,
        color: "text-amber-400",
        label: "Nutrition Intake",
        text: `Calorie limit exceeded by ${Math.abs(caloriesLeft)} kcal. Focus on fiber-rich greens for next meal.`,
      });
    } else if (currentCals > 0) {
      insights.push({
        id: "calories",
        type: "success",
        icon: Utensils,
        color: "text-emerald-400",
        label: "Daily Energy",
        text: `Balanced intake so far. You have ${caloriesLeft} kcal remaining for your daily goal.`,
      });
    }

    // Steps Pointer
    if (currentSteps > 0) {
      if (currentSteps < stepsGoal) {
        insights.push({
          id: "steps",
          type: "info",
          icon: Activity,
          color: "text-blue-400",
          label: "Activity Goal",
          text: `You're doing great! Just ${stepsGoal - currentSteps} more steps to reach your daily target.`,
        });
      } else {
        insights.push({
          id: "steps",
          type: "success",
          icon: CheckCircle2,
          color: "text-emerald-400",
          label: "Activity Goal",
          text: `Goal reached! You've achieved your target of ${stepsGoal} steps today.`,
        });
      }
    }

    // Recommendation/Summary Pointer
    const aiSummary = dashboardData.latestAnalysis?.summary;
    if (aiSummary && typeof aiSummary === "string" && aiSummary.length > 10) {
      insights.push({
        id: "summary",
        type: "ai",
        icon: Sparkles,
        color: "text-purple-400",
        label: "AI Recommendation",
        text: aiSummary.includes(".")
          ? aiSummary.split(".")[0] + "."
          : aiSummary,
      });
    }

    return insights;
  }, [dashboardData, nutritionData]);

  const [trendTimeRange, setTrendTimeRange] = useState("1W");
  const [insightIndex, setInsightIndex] = useState(0);

  useEffect(() => {
    if (overallPerformanceInsight.length <= 1) return;
    const interval = setInterval(() => {
      setInsightIndex((prev) => (prev + 1) % overallPerformanceInsight.length);
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
          fetchNutrition(new Date().toISOString().split("T")[0], force),
          fetchWearable(force),
          fetchDietPlan(force).then((plan) => { setDietPlan(plan); activeDietPlanRef.current = plan; }),
          dietRecommendationService.getDietPlanHistory().then((res) => {
            if (res.data.success) setDietHistory(res.data.history || []);
          }).catch(() => {}),
          fetchNutritionLogs(
            new Date().toISOString().split("T")[0],
            force,
          ).then((logs) => {
            const logMap = {};
            (logs || []).forEach((l) => {
              if (l.foodItems) {
                l.foodItems.forEach((fi) => {
                  logMap[`${l.mealType}-${fi.name}`] = true;
                });
              }
            });
            setLoggedMeals(logs || []);
            setLoggedMealsMap(logMap);
          }),
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
      const diabeticStatus =
        user.profile.isDiabetic === "yes" ||
        user.profile.isDiabetic === true ||
        (user.profile.medicalHistory?.conditions?.some((c) =>
          c.toLowerCase().includes("diabetes"),
        ) &&
          user.profile.isDiabetic !== "no");
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
    if (hour < 11) setActiveMealTab("breakfast");
    else if (hour < 17) setActiveMealTab("lunch");
    else setActiveMealTab("dinner");
  }, []);

  const [showDietDatePicker, setShowDietDatePicker] = useState(false);
  const [dietDatePickerMonth, setDietDatePickerMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const activeDietPlanRef = useRef(null); // stores the original active plan

  const handleDietDateChange = async (dateStr) => {
    setSelectedDietDate(dateStr);
    setShowDietDatePicker(false);
    const today = new Date().toISOString().split("T")[0];
    if (dateStr === today) {
      if (activeDietPlanRef.current) setDietPlan(activeDietPlanRef.current);
      return;
    }
    // Include current active plan + history for lookup
    const allPlans = activeDietPlanRef.current
      ? [activeDietPlanRef.current, ...dietHistory]
      : [...dietHistory];
    const seen = new Set();
    const unique = allPlans.filter((p) => {
      if (seen.has(p._id)) return false;
      seen.add(p._id);
      return true;
    });
    const sorted = unique.sort(
      (a, b) => new Date(b.generatedAt || b.createdAt) - new Date(a.generatedAt || a.createdAt)
    );
    const match = sorted.find(
      (p) => new Date(p.generatedAt || p.createdAt) <= new Date(dateStr + "T23:59:59")
    );
    if (!match) { setDietPlan(null); return; }
    // If this is the active plan, it already has mealPlan
    if (match._id === activeDietPlanRef.current?._id) {
      setDietPlan(activeDietPlanRef.current);
      return;
    }
    // History plans don't have mealPlan — fetch full plan by id
    try {
      const { data } = await dietRecommendationService.getDietPlanById(match._id);
      setDietPlan(data.dietPlan || null);
    } catch {
      setDietPlan(match);
    }
  };

  const handleCalorieDateChange = async (dateStr) => {
    setSelectedCalorieDate(dateStr);
    setShowCalorieDatePicker(false);
    const today = new Date().toISOString().split("T")[0];
    if (dateStr === today) {
      setCalorieDateData(null); // use live nutritionData
      return;
    }
    setCalorieDateLoading(true);
    try {
      const response = await nutritionService.getDailySummary(dateStr);
      setCalorieDateData(response.data?.summary || null);
    } catch (err) {
      console.error("Failed to fetch nutrition for date:", dateStr, err);
      setCalorieDateData(null);
    } finally {
      setCalorieDateLoading(false);
    }
  };

  // Active calorie data: today = live nutritionData, past date = fetched data (null = no meals logged that day, show zeros)
  const activeNutritionData = selectedCalorieDate === new Date().toISOString().split("T")[0]
    ? nutritionData
    : calorieDateData;

  const calorieDelta =
    (nutritionData?.totalCalories || 0) - (nutritionData?.calorieGoal || 2000);
  const isOverLimit = calorieDelta > 0;

  const handleScroll = () => {
    if (scrollContainerRef.current && !isDragging.current) {
      const { scrollLeft, scrollWidth, clientWidth } =
        scrollContainerRef.current;
      const progress = (scrollLeft / (scrollWidth - clientWidth)) * 100;
      setScrollProgress(progress);
    }
  };

  const handleDrag = (e) => {
    if (
      !isDragging.current ||
      !scrollTrackRef.current ||
      !scrollContainerRef.current
    )
      return;
    const track = scrollTrackRef.current.getBoundingClientRect();
    const x = e.clientX - track.left;
    const scrollableWidth =
      scrollContainerRef.current.scrollWidth -
      scrollContainerRef.current.clientWidth;
    const progress = Math.max(0, Math.min(100, (x / track.width) * 100));
    setScrollProgress(progress);
    scrollContainerRef.current.scrollLeft = (progress / 100) * scrollableWidth;
  };

  useEffect(() => {
    const mouseUp = () => {
      isDragging.current = false;
    };
    const mouseMove = (e) => handleDrag(e);
    window.addEventListener("mouseup", mouseUp);
    window.addEventListener("mousemove", mouseMove);
    return () => {
      window.removeEventListener("mouseup", mouseUp);
      window.removeEventListener("mousemove", mouseMove);
    };
  }, []);

  // --- SYNC: DYNAMIC DEFICIENCY CALCULATION ---
  const dynamicDeficiencies = useMemo(() => {
    const nutrientMeta = {
      fiber: {
        name: "Fiber",
        unit: "g",
        food: "Whole grains, Legumes",
        supplement: "Psyllium Husk",
      },
      iron: {
        name: "Iron",
        unit: "mg",
        food: "Spinach, Beetroot, Red Meat",
        supplement: "Iron Supplements",
      },
      hemoglobin: {
        name: "Iron",
        unit: "mg",
        food: "Spinach, Beetroot, Red Meat",
        supplement: "Iron Supplements",
      },
      vitaminc: {
        name: "Vitamin C",
        unit: "mg",
        food: "Oranges, Lemon, Amla",
        supplement: "C-Vitamin",
      },
      vitamina: {
        name: "Vitamin A",
        unit: "mcg",
        food: "Carrots, Sweet Potato",
        supplement: "Beta Carotene",
      },
      vitamind: {
        name: "Vitamin D",
        unit: "mcg",
        food: "Fatty Fish, Eggs, Sun",
        supplement: "Vitamin D3",
      },
      calcium: {
        name: "Calcium",
        unit: "mg",
        food: "Milk, Tofu, Almonds",
        supplement: "Calcium + D3",
      },
      vitaminb12: {
        name: "Vitamin B12",
        unit: "mcg",
        food: "Dairy, Eggs, Fortified foods",
        supplement: "B12 Complex",
      },
      protein: {
        name: "Protein",
        unit: "g",
        food: "Paneer, Eggs, Lentils",
        supplement: "Whey Protein",
      },
      ferritin: {
        name: "Iron",
        unit: "ng/mL",
        food: "Spinach, Beetroot, Red Meat",
        supplement: "Iron Supplements",
      },
    };

    let extractedDeficiencies = [
      ...(dashboardData?.latestAnalysis?.deficiencies || []),
    ];

    // Fallback: Ensure any "low" or "deficient" markers in the general metrics are caught
    if (dashboardData?.latestAnalysis?.metrics) {
      Object.entries(dashboardData.latestAnalysis.metrics).forEach(
        ([key, val]) => {
          if (typeof val === "object" && val.status) {
            const statusLower = val.status.toLowerCase();
            if (
              statusLower.includes("low") ||
              statusLower.includes("deficient") ||
              statusLower.includes("risk")
            ) {
              const exists = extractedDeficiencies.some(
                (d) =>
                  d.name.toLowerCase().includes(key.toLowerCase()) ||
                  key.toLowerCase().includes(d.name.toLowerCase()),
              );
              if (!exists) {
                extractedDeficiencies.push({
                  name: key,
                  severity: val.status,
                  currentValue: val.value,
                  normalRange: val.normalRange,
                  unit: val.unit,
                  explanation:
                    val.lowHighImpact ||
                    "Levels are below normal. Please consult a doctor.",
                });
              }
            }
          }
        },
      );
    }

    return extractedDeficiencies
      .map((item) => {
        const key = item.name.toLowerCase().replace(/\s+/g, "");
        const meta = nutrientMeta[key] || {};

        let aiFoods = null;
        if (dashboardData?.latestAnalysis?.metrics) {
          Object.entries(dashboardData.latestAnalysis.metrics).forEach(
            ([mKey, val]) => {
              if (
                typeof val === "object" &&
                mKey.toLowerCase().includes(item.name.toLowerCase()) &&
                val.foodsToConsume
              ) {
                aiFoods = Array.isArray(val.foodsToConsume)
                  ? val.foodsToConsume.join(", ")
                  : val.foodsToConsume;
              }
            },
          );
        }

        return {
          ...item,
          food:
            item.food ||
            aiFoods ||
            meta.food ||
            "Nutrient-rich balanced meals tailored to your report",
          supplement:
            item.supplement || meta.supplement || "Consult a specialist",
          percent: item.percent || 50, // Rough default gauge percent
        };
      })
      .slice(0, 5);
  }, [dashboardData]);

  const cardCount = 3;
  const activeIndex = scrollProgress / (100 / (cardCount - 1 || 1));

  const scrollBy = (direction) => {
    if (scrollContainerRef.current) {
      const amount = 300;
      scrollContainerRef.current.scrollBy({
        left: direction * amount,
        behavior: "smooth",
      });
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  // Only show skeleton if we have NO data and we are currently loading
  if (!dashboardData && (loading.dashboard || loading.nutrition)) {
    return <DashboardSkeleton />;
  }

  console.log("Rendering Dashboard", { hasData: !!dashboardData, isDiabetic });
  return (
    <div className="min-h-screen text-[#1a1a1a] font-sans selection:bg-emerald-100 selection:text-emerald-900 overflow-x-hidden pb-20 relative"
      style={{ background: "linear-gradient(135deg, #edfdf4 0%, #f0faf5 30%, #f0fdf8 60%, #ffffff 100%)" }}
    >
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] rounded-full pointer-events-none -z-0"
        style={{ background: "radial-gradient(circle, rgba(16,185,129,0.05), transparent)", filter: "blur(80px)" }} />
      <div className="fixed bottom-1/4 right-0 w-[500px] h-[500px] rounded-full pointer-events-none -z-0"
        style={{ background: "radial-gradient(circle, rgba(52,211,153,0.04), transparent)", filter: "blur(100px)" }} />
      <div className="fixed top-1/2 left-0 w-[400px] h-[400px] rounded-full pointer-events-none -z-0"
        style={{ background: "radial-gradient(circle, rgba(110,231,183,0.03), transparent)", filter: "blur(80px)" }} />
      <SEO pageName="dashboard" />
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
              primaryColor: "#064e3b",
              zIndex: 10000,
              beaconSize: 0,
              disableBeacon: true,
            },
          }}
        />
      )}
      <div className="w-full px-0 md:px-6">

        {/* Feature Showcase Carousel */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="px-4 md:px-0 mb-2 w-full"
        >
          <FeatureCarousel navigate={navigate} />
        </motion.div>

        {/* Quick Navigation Cards */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="px-4 md:px-0 mb-3"
        >
          <div className="flex gap-2">
            {[
              { label: "Meal", icon: UtensilsCrossed, color: "#059669", onClick: () => navigate("/nutrition", { state: { openLogMeal: true, mealType: "Breakfast" } }) },
              { label: "Water", icon: GlassWater, color: "#0ea5e9", onClick: () => { setActiveLogTab("Water"); setIsLogVitalsOpen(true); } },
              { label: "Sleep", icon: Moon, color: "#7c3aed", onClick: () => { setActiveLogTab("Sleep"); setIsLogVitalsOpen(true); } },
              { label: "Lab", icon: Upload, color: "#064e3b", onClick: () => navigate("/upload") },
              // { label: "Steps", icon: Footprints, color: "#f59e0b", onClick: () => { setActiveLogTab("Steps"); setIsLogVitalsOpen(true); } },
              { label: "Smoke", icon: Cigarette, color: "#6b7280", onClick: () => navigate("/smoke-tracker") },
              ...(features.alcoholTracker ? [{ label: "Drinks", icon: Wine, color: "#dc2626", onClick: () => navigate("/alcohol-tracker") }] : []),
            ].map(({ label, icon: Icon, color, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                className="liquid-glass-btn flex-1 flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-[16px] md:rounded-[16px] aspect-square md:aspect-auto transition-all active:scale-95"
              >
                <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <span className="text-[9px] font-bold text-slate-700 leading-tight text-center">{label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Main Content - Dynamic Grid */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-5 pb-8 w-full mt-0 px-4 md:px-0 focus-visible:outline-none scroll-smooth"
        >
          {/* Card 1: Calories & Daily Tracking */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="tour-nutrient-info liquid-glass-strong w-full px-5 pb-5 pt-5 lg:px-8 lg:pb-8 lg:pt-8 flex flex-col"
            style={{
              borderRadius: "29.29px",
              marginTop: "4px",
            }}
          >
            {/* Calories Header */}
            <div className="mb-0 flex items-start justify-between">
              <div>
                <h2 className="text-lg lg:text-xl font-bold text-[#1a1a1a] leading-tight">
                  Calories
                </h2>
                <p className="text-[9px] text-[#a0a0a0] font-bold uppercase tracking-widest leading-none mt-0.5">
                  Daily tracking
                </p>
              </div>
              <button
                ref={calorieDateBtnRef}
                onClick={() => {
                  const d = new Date(selectedCalorieDate + "T12:00:00");
                  setCalorieDatePickerMonth({ year: d.getFullYear(), month: d.getMonth() });
                  if (calorieDateBtnRef.current) {
                    const rect = calorieDateBtnRef.current.getBoundingClientRect();
                    setCalorieDatePickerPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
                  }
                  setShowCalorieDatePicker((v) => !v);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#d4e9de] bg-gradient-to-r from-[#eef7f2] to-[#f5fbf7] shadow-sm hover:shadow-md transition-all"
              >
                <Calendar className="w-3.5 h-3.5 text-[#5B8C6F]" />
                <span className="text-[11px] font-semibold text-[#3d7a5e]">
                  {selectedCalorieDate === new Date().toISOString().split("T")[0]
                    ? "Today"
                    : new Date(selectedCalorieDate + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
                <svg className={`w-3 h-3 text-[#5B8C6F] transition-transform ${showCalorieDatePicker ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {/* Premium Custom Date Picker - portal to escape card stacking context */}
              {createPortal(
              <AnimatePresence>
                {showCalorieDatePicker && (
                  <>
                    <div className="fixed inset-0 z-[999]" onClick={() => setShowCalorieDatePicker(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="fixed z-[1000] rounded-[20px] shadow-2xl border border-[#e0ede6] overflow-hidden"
                      style={{ background: "linear-gradient(145deg, #ffffff 0%, #f4fbf7 100%)", width: 280, top: calorieDatePickerPos.top, right: calorieDatePickerPos.right }}
                    >
                      <div className="flex items-center justify-between px-4 py-3 border-b border-[#edf5f0]">
                        <button
                          onClick={() => setCalorieDatePickerMonth((prev) => {
                            const d = new Date(prev.year, prev.month - 1);
                            return { year: d.getFullYear(), month: d.getMonth() };
                          })}
                          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[#e8f4ed] transition-colors text-[#5B8C6F]"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <span className="text-[13px] font-bold text-[#1a2e22]">
                          {new Date(calorieDatePickerMonth.year, calorieDatePickerMonth.month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                        </span>
                        <button
                          onClick={() => setCalorieDatePickerMonth((prev) => {
                            const d = new Date(prev.year, prev.month + 1);
                            const now = new Date();
                            if (d.getFullYear() > now.getFullYear() || (d.getFullYear() === now.getFullYear() && d.getMonth() > now.getMonth())) return prev;
                            return { year: d.getFullYear(), month: d.getMonth() };
                          })}
                          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[#e8f4ed] transition-colors text-[#5B8C6F]"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                      <div className="grid grid-cols-7 px-3 pt-2 pb-1">
                        {["Mo","Tu","We","Th","Fr","Sa","Su"].map((d) => (
                          <div key={d} className="text-center text-[9px] font-black text-[#a0bfae] uppercase tracking-wider py-1">{d}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
                        {(() => {
                          const { year, month } = calorieDatePickerMonth;
                          const firstDay = new Date(year, month, 1).getDay();
                          const offset = firstDay === 0 ? 6 : firstDay - 1;
                          const daysInMonth = new Date(year, month + 1, 0).getDate();
                          const today = new Date().toISOString().split("T")[0];
                          const cells = [];
                          for (let i = 0; i < offset; i++) cells.push(<div key={`e${i}`} />);
                          for (let d = 1; d <= daysInMonth; d++) {
                            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                            const isFuture = dateStr > today;
                            const isSelected = dateStr === selectedCalorieDate;
                            const isToday = dateStr === today;
                            cells.push(
                              <button
                                key={d}
                                disabled={isFuture}
                                onClick={() => handleCalorieDateChange(dateStr)}
                                className={`w-full aspect-square rounded-full text-[12px] font-semibold flex items-center justify-center transition-all
                                  ${isFuture ? "text-[#d0d0d0] cursor-not-allowed" : "hover:bg-[#e8f4ed] cursor-pointer"}
                                  ${isSelected ? "text-white font-bold shadow-md" : isToday ? "text-[#3d7a5e] font-black" : "text-[#2a2a2a]"}
                                `}
                                style={isSelected ? { background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" } : isToday && !isSelected ? { boxShadow: "inset 0 0 0 1.5px #5B8C6F" } : {}}
                              >
                                {d}
                              </button>
                            );
                          }
                          return cells;
                        })()}
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#edf5f0]">
                        <button onClick={() => handleCalorieDateChange(new Date().toISOString().split("T")[0])} className="text-[11px] font-bold text-[#5B8C6F] hover:text-[#3d7a5e] transition-colors">Today</button>
                        <button onClick={() => setShowCalorieDatePicker(false)} className="text-[11px] font-bold text-[#a0a0a0] hover:text-[#5B8C6F] transition-colors">Close</button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>,
              document.body)}
            </div>

            {/* Dashed Gauge */}
            <div className="flex justify-center mb-0 mt-2 relative z-10 w-full overflow-visible">
              {calorieDateLoading ? (
                <div className="flex items-center justify-center h-[180px]">
                  <div className="w-8 h-8 border-2 border-[#5B8C6F] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <DashedGauge
                  value={activeNutritionData?.totalCalories || 0}
                  max={user?.nutritionGoal?.calorieGoal || activeNutritionData?.calorieGoal || 2000}
                  mode={nutrientMode}
                />
              )}
            </div>

            {/* Protein / Carbs / Fats Row - Unified Card - Balanced */}
            <div className="liquid-glass-inner mt-2 mb-5 rounded-[18px] py-3 px-3 flex items-center justify-around gap-1 overflow-hidden">
              <div className="flex items-center gap-2">
                <img
                  src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Icon_8.png?v=1775645708"
                  alt="Protein"
                  className="w-4 h-4 object-contain"
                />
                <div className="flex flex-col">
                  <span className="text-[11px] font-black text-[#1a1a1a] leading-none">
                    {Math.round(activeNutritionData?.totalProtein || 0)}g
                  </span>
                  <span className="text-[7px] font-bold text-[#a0a0a0] uppercase tracking-tighter">
                    Protein
                  </span>
                </div>
              </div>

              <div className="h-5 w-px bg-[#f0f0ea]/50" />

              <div className="flex items-center gap-2 text-center">
                <img
                  src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Icon_7.png?v=1775645656"
                  alt="Carbs"
                  className="w-4 h-4 object-contain"
                />
                <div className="flex flex-col">
                  <span className="text-[11px] font-black text-[#1a1a1a] leading-none">
                    {Math.round(activeNutritionData?.totalCarbs || 0)}g
                  </span>
                  <span className="text-[7px] font-bold text-[#a0a0a0] uppercase tracking-tighter">
                    Carbs
                  </span>
                </div>
              </div>

              <div className="h-5 w-px bg-[#f0f0ea]/50" />

              <div className="flex items-center gap-2">
                <img
                  src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Icon_9.png?v=1775645708"
                  alt="Fats"
                  className="w-4 h-4 object-contain"
                />
                <div className="flex flex-col">
                  <span className="text-[11px] font-black text-[#1a1a1a] leading-none">
                    {Math.round(activeNutritionData?.totalFats || 0)}g
                  </span>
                  <span className="text-[7px] font-bold text-[#a0a0a0] uppercase tracking-tighter">
                    Fats
                  </span>
                </div>
              </div>
            </div>

            {/* Nutrient Info Toggle */}
            <div
              className="w-full"
              style={{ height: "24.71px", marginTop: "4px" }}
            >
              <button
                onClick={() => setShowNutrientDetails(!showNutrientDetails)}
                className="flex items-center justify-between w-full h-full border-t border-[#f0f0ea] pt-2"
              >
                <span className="text-sm font-bold text-[#1a1a1a]">
                  Nutrient Info
                </span>
                <span className="text-xs text-[#5B8C6F] font-medium flex items-center gap-1">
                  View Details{" "}
                  <ChevronRight
                    className={`w-3.5 h-3.5 transition-transform duration-300 ${showNutrientDetails ? "rotate-90" : ""}`}
                  />
                </span>
              </button>
            </div>

            {/* Expandable Micro Details - Top 3 */}
            <AnimatePresence>
              {showNutrientDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 pt-3 pb-2">
                    {(() => {
                      const micros = [
                        {
                          label: "Fiber",
                          value: activeNutritionData?.totalFiber || 0,
                          target: 30,
                          unit: "g",
                          color: "#10b981",
                        },
                        {
                          label: "Iron",
                          value: activeNutritionData?.totalIron || 0,
                          target: 18,
                          unit: "mg",
                          color: "#F59E0B",
                        },
                        {
                          label: "Vitamin C",
                          value: activeNutritionData?.totalVitaminC || 0,
                          target: 90,
                          unit: "mg",
                          color: "#FF6B6B",
                        },
                        {
                          label: "Vitamin A",
                          value: activeNutritionData?.totalVitaminA || 0,
                          target: 900,
                          unit: "mcg",
                          color: "#8B5CF6",
                        },
                        {
                          label: "Calcium",
                          value: activeNutritionData?.totalCalcium || 0,
                          target: 1000,
                          unit: "mg",
                          color: "#3B82F6",
                        },
                        {
                          label: "Vitamin D",
                          value: activeNutritionData?.totalVitaminD || 0,
                          target: 20,
                          unit: "mcg",
                          color: "#F59E0B",
                        },
                        {
                          label: "B12",
                          value: activeNutritionData?.totalVitaminB12 || 0,
                          target: 2.4,
                          unit: "mcg",
                          color: "#EF4444",
                        },
                      ];
                      return micros
                        .map((m) => ({
                          ...m,
                          percent: Math.min((m.value / m.target) * 100, 100),
                        }))
                        .sort((a, b) => a.percent - b.percent)
                        .slice(0, 3)
                        .map((micro) => (
                          <div key={micro.label} className="group">
                            <div className="flex justify-between items-center mb-1.5">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: micro.color }}
                                />
                                <span className="text-xs font-semibold text-[#1a1a1a]">
                                  {micro.label}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-[#8a8a8a]">
                                {micro.value.toFixed(1)} / {micro.target}
                                {micro.unit}
                              </span>
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
            className="tour-diet-plan liquid-glass-strong w-full flex flex-col"
            style={{
              minHeight: "400px",
              borderRadius: "29.29px",
              marginTop: "4px",
            }}
          >
            {/* Header Row */}
            <div className="flex items-center justify-between px-5 pt-6 pb-4 w-full">
              <h2
                className="text-[#1a1a1a] font-semibold text-base"
                style={{ letterSpacing: "-0.43px", margin: 0 }}
              >
                {selectedDietDate === new Date().toISOString().split("T")[0] ? "Today's Diet" : "Diet Plan"}
              </h2>
              <button
                ref={dietDateBtnRef}
                onClick={() => {
                  const d = new Date(selectedDietDate + "T12:00:00");
                  setDietDatePickerMonth({ year: d.getFullYear(), month: d.getMonth() });
                  if (dietDateBtnRef.current) {
                    const rect = dietDateBtnRef.current.getBoundingClientRect();
                    setDietDatePickerPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
                  }
                  setShowDietDatePicker((v) => !v);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#d4e9de] bg-gradient-to-r from-[#eef7f2] to-[#f5fbf7] shadow-sm hover:shadow-md transition-all"
              >
                <Calendar className="w-3.5 h-3.5 text-[#5B8C6F]" />
                <span className="text-[11px] font-semibold text-[#3d7a5e]">
                  {new Date(selectedDietDate + "T12:00:00").toLocaleDateString("en-GB", {
                    weekday: "short", day: "numeric", month: "short", year: "numeric",
                  })}
                </span>
                <svg className={`w-3 h-3 text-[#5B8C6F] transition-transform ${showDietDatePicker ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {/* Premium Custom Date Picker Dropdown - portal to escape card stacking context */}
              {createPortal(
              <AnimatePresence>
                {showDietDatePicker && (
                  <>
                    <div className="fixed inset-0 z-[999]" onClick={() => setShowDietDatePicker(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="fixed z-[1000] rounded-[20px] shadow-2xl border border-[#e0ede6] overflow-hidden"
                      style={{ background: "linear-gradient(145deg, #ffffff 0%, #f4fbf7 100%)", width: 280, top: dietDatePickerPos.top, right: dietDatePickerPos.right }}
                    >
                      {/* Month Nav */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-[#edf5f0]">
                        <button
                          onClick={() => setDietDatePickerMonth((prev) => {
                            const d = new Date(prev.year, prev.month - 1);
                            return { year: d.getFullYear(), month: d.getMonth() };
                          })}
                          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[#e8f4ed] transition-colors text-[#5B8C6F]"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <span className="text-[13px] font-bold text-[#1a2e22]">
                          {new Date(dietDatePickerMonth.year, dietDatePickerMonth.month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                        </span>
                        <button
                          onClick={() => setDietDatePickerMonth((prev) => {
                            const d = new Date(prev.year, prev.month + 1);
                            const now = new Date();
                            if (d.getFullYear() > now.getFullYear() || (d.getFullYear() === now.getFullYear() && d.getMonth() > now.getMonth())) return prev;
                            return { year: d.getFullYear(), month: d.getMonth() };
                          })}
                          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[#e8f4ed] transition-colors text-[#5B8C6F]"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                      {/* Day Headers */}
                      <div className="grid grid-cols-7 px-3 pt-2 pb-1">
                        {["Mo","Tu","We","Th","Fr","Sa","Su"].map((d) => (
                          <div key={d} className="text-center text-[9px] font-black text-[#a0bfae] uppercase tracking-wider py-1">{d}</div>
                        ))}
                      </div>
                      {/* Days Grid */}
                      <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
                        {(() => {
                          const { year, month } = dietDatePickerMonth;
                          const firstDay = new Date(year, month, 1).getDay();
                          const offset = firstDay === 0 ? 6 : firstDay - 1;
                          const daysInMonth = new Date(year, month + 1, 0).getDate();
                          const today = new Date().toISOString().split("T")[0];
                          const cells = [];
                          for (let i = 0; i < offset; i++) cells.push(<div key={`e${i}`} />);
                          for (let d = 1; d <= daysInMonth; d++) {
                            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                            const isFuture = dateStr > today;
                            const isSelected = dateStr === selectedDietDate;
                            const isToday = dateStr === today;
                            cells.push(
                              <button
                                key={d}
                                disabled={isFuture}
                                onClick={() => handleDietDateChange(dateStr)}
                                className={`relative w-full aspect-square rounded-full text-[12px] font-semibold flex items-center justify-center transition-all
                                  ${isFuture ? "text-[#d0d0d0] cursor-not-allowed" : "hover:bg-[#e8f4ed] cursor-pointer"}
                                  ${isSelected ? "text-white font-bold shadow-md" : isToday ? "text-[#3d7a5e] font-black" : "text-[#2a2a2a]"}
                                `}
                                style={isSelected ? { background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" } : isToday && !isSelected ? { boxShadow: "inset 0 0 0 1.5px #5B8C6F" } : {}}
                              >
                                {d}
                              </button>
                            );
                          }
                          return cells;
                        })()}
                      </div>
                      {/* Footer */}
                      <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#edf5f0]">
                        <button
                          onClick={() => handleDietDateChange(new Date().toISOString().split("T")[0])}
                          className="text-[11px] font-bold text-[#5B8C6F] hover:text-[#3d7a5e] transition-colors"
                        >
                          Today
                        </button>
                        <button
                          onClick={() => setShowDietDatePicker(false)}
                          className="text-[11px] font-bold text-[#a0a0a0] hover:text-[#5B8C6F] transition-colors"
                        >
                          Close
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>,
              document.body)}
            </div>

            {/* Meal Tabs Row */}
            <div className="px-5 mb-4 w-full">
              <div className="flex items-center gap-1.5 w-full">
                {[
                  { id: "breakfast", label: "Breakfast" },
                  { id: "lunch", label: "Lunch" },
                  { id: "dinner", label: "Dinner" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveMealTab(tab.id)}
                    className={`transition-all whitespace-nowrap flex-1 h-[36px] rounded-full font-bold text-[11px] uppercase tracking-wider ${
                      activeMealTab === tab.id
                        ? "text-white border-transparent"
                        : "bg-white text-[#8a8a8a] border border-[#f0f0ea] hover:bg-[#E8F3EE]"
                    }`}
                    style={activeMealTab === tab.id
                      ? { background: "linear-gradient(135deg, rgba(5,150,105,0.85) 0%, rgba(16,185,129,0.9) 100%)", boxShadow: "0 4px 12px rgba(5,150,105,0.3), inset 0 1px 0 rgba(255,255,255,0.2)" }
                      : {}
                    }
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fallback Banner */}
            {dietPlan?.isFallback && (
              <div className="mx-5 mb-2 px-4 py-3 rounded-2xl flex items-start gap-3" style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)" }}>
                <span className="text-base mt-0.5"></span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-[#92400e] leading-snug">Server busy — showing your previous plan.</p>
                  <p className="text-[10px] text-[#b45309] mt-0.5 leading-snug">New preferences will apply next time, or <button onClick={() => navigate("/diet-plan")} className="underline font-bold hover:text-[#92400e] transition-colors">retry now</button>.</p>
                </div>
              </div>
            )}

            {/* Meal Content Area */}
            <div className="flex-1 flex flex-col min-h-[220px] w-full">
              {!dietPlan || !dietPlan.mealPlan ? (
                <div className="liquid-glass-inner mx-5 my-4 flex flex-col items-center justify-center text-center rounded-[24px] py-10">
                  <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-md mb-4 border border-[#E8F3EE]">
                    <Utensils className="w-7 h-7 text-[#76B39D]" />
                  </div>
                  <p className="text-sm font-bold text-[#1a1a1a] uppercase tracking-wide">
                    No Plan Today
                  </p>
                </div>
              ) : (
                <div className="w-full">
                  {(() => {
                    const meals = dietPlan.mealPlan[activeMealTab] || [];
                    if (meals.length === 0) {
                      return (
                        <div className="liquid-glass-inner mx-5 my-2 p-8 rounded-[24px] text-center">
                          <p className="text-[11px] font-bold text-[#a0a0a0] uppercase tracking-wider">
                            No meals logged for {activeMealTab}
                          </p>
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
                            setActiveDietSlide(
                              Math.min(index, meals.length - 1),
                            );
                          }}
                        >
                          {meals.map((item, idx) => {
                            const foodName =
                              item?.name ||
                              item?.foodItems?.[0]?.name ||
                              "food";
                            const bingThumb = `https://tse1.mm.bing.net/th?q=${encodeURIComponent(foodName + " indian food")}&w=400&h=400&c=7&o=5&pid=Api&mkt=en-IN`;
                            return (
                              <div
                                key={idx}
                                className="relative flex-none w-[208px] h-[172px] group snap-start"
                              >
                                {/* Meal Image Floating */}
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[102px] h-[100px] z-20 rounded-full border-[3px] border-white shadow-xl overflow-hidden bg-white group-hover:scale-105 transition-transform duration-500">
                                  <img
                                    src={item?.imageUrl || bingThumb}
                                    alt={foodName}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.target.src = bingThumb;
                                    }}
                                  />
                                </div>
                                {/* Content Card */}
                                <div className="liquid-glass-inner absolute bottom-0 left-0 w-full h-[126px] rounded-[22px] pt-[52px] px-4 pb-3 z-10 text-left">
                                  <h4
                                    className="truncate font-bold text-[13px] text-[#1a1a1a] mb-1"
                                    style={{}}
                                  >
                                    {foodName}
                                  </h4>
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-start gap-1.5">
                                      <Scale className="w-2.5 h-2.5 text-[#76B39D] mt-0.5 shrink-0" />
                                      <span className="text-[9px] font-black text-[#76B39D] uppercase tracking-tight leading-tight break-words line-clamp-2 max-w-[170px]">
                                        {item?.portionSize || "1 Serving"}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <div className="flex items-center gap-1.5">
                                        <Flame className="w-2.5 h-2.5 text-orange-500" />
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                                          {item?.calories || "280"} Kcal
                                        </span>
                                      </div>
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
                              className={`transition-all duration-300 h-[7px] rounded-full ${activeDietSlide === i ? "w-4 bg-[#76B39D]" : "w-[7px] bg-[#d4d4d4]"}`}
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
                onClick={() => navigate("/diet-plan")}
                className="w-full h-[46px] text-white font-bold rounded-[18px] flex items-center justify-center gap-2 active:scale-95 transition-all"
                style={{ background: "linear-gradient(135deg, rgba(5,150,105,0.9) 0%, rgba(16,185,129,0.95) 100%)", boxShadow: "0 4px 20px rgba(5,150,105,0.40), inset 0 1px 0 rgba(255,255,255,0.25)", fontSize: "14px" }}
              >
                View Full Plan{" "}
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </motion.div>

          {/* Card 3: AI Lab Insights */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="tour-ai-insights liquid-glass-strong w-full rounded-[29px] p-5 lg:p-8 flex flex-col"
            style={{
              marginTop: "4px",
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl lg:text-2xl font-bold text-[#1a1a1a]">
                  Lab Insights
                </h2>
                <p className="text-xs text-[#a0a0a0] font-medium">
                  Biological markers
                </p>
              </div>
              <button
                onClick={() => navigate("/reports")}
                className="text-[10px] font-bold text-[#5B8C6F] uppercase tracking-wider flex items-center gap-1 hover:text-[#4a7b5e] transition-colors"
              >
                View <Plus className="w-3 h-3" />
              </button>
            </div>

            <div className="flex-1 space-y-3 min-h-[180px] max-h-[300px] overflow-y-auto scrollbar-hide pr-1">
              {dashboardData?.processingReport ? (
                <div className="liquid-glass-inner flex flex-col items-center justify-center p-6 rounded-[24px] text-center">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 border border-[#E8F3EE]">
                    <Clock className="w-6 h-6 text-[#5B8C6F] animate-spin" />
                  </div>
                  <p className="text-xs font-bold text-[#1a1a1a] uppercase tracking-wider mb-1">
                    Analyzing Report
                  </p>
                  <p className="text-[9px] font-medium text-[#a0a0a0] max-w-[150px] leading-relaxed uppercase tracking-wider">
                    Our AI is processing your health data...
                  </p>
                </div>
              ) : dashboardData?.totalReports > 0 &&
                dashboardData?.latestAnalysis?.metrics &&
                Object.keys(dashboardData.latestAnalysis.metrics).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(dashboardData.latestAnalysis.metrics).map(
                    ([key, val]) => (
                      <div
                        key={key}
                        className="liquid-glass-inner p-3 rounded-2xl flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-white border border-[#E8F3EE] flex items-center justify-center">
                            {key.toLowerCase().includes("glucose") ? (
                              <Droplet className="w-4 h-4 text-[#FF6B6B]" />
                            ) : (
                              <Activity className="w-4 h-4 text-[#5B8C6F]" />
                            )}
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[#8a8a8a] uppercase leading-none mb-1">
                              {key}
                            </p>
                            <p className="text-sm font-black text-[#1a1a1a]">
                              {typeof val === "object"
                                ? `${val.value} ${val.unit || ""}`
                                : val}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-[8px] font-black px-2 py-1 rounded-md uppercase tracking-wider ${
                            typeof val === "object" &&
                            val.status?.toLowerCase().includes("normal")
                              ? "bg-[#E8F3EE] text-[#5B8C6F]"
                              : "bg-[#FFF5F5] text-[#FF6B6B]"
                          }`}
                        >
                          {typeof val === "object" && val.status
                            ? val.status
                            : "Normal"}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <div className="liquid-glass-inner flex flex-col items-center justify-center p-6 rounded-[24px] text-center h-full">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 border border-[#E8F3EE]">
                    <Upload className="w-6 h-6 text-[#5B8C6F]" />
                  </div>
                  <p className="text-xs font-bold text-[#1a1a1a] uppercase tracking-wider mb-1">
                    No Reports
                  </p>
                  <p className="text-[9px] font-medium text-[#a0a0a0] mb-4 max-w-[150px] leading-relaxed uppercase tracking-wider text-center">
                    Add lab reports to get biological insights
                  </p>
                  <button
                    onClick={() => navigate("/upload")}
                    className="px-5 py-2 text-white rounded-full text-[9px] font-bold uppercase tracking-widest hover:scale-[1.02] transition-all"
                    style={{ background: "linear-gradient(135deg, rgba(5,150,105,0.85) 0%, rgba(16,185,129,0.9) 100%)", boxShadow: "0 4px 12px rgba(5,150,105,0.3)" }}
                  >
                    Upload Now
                  </button>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#5B8C6F]" />
                <span className="text-[9px] font-bold text-[#5B8C6F] uppercase tracking-widest">
                  Recommendation
                </span>
              </div>
              <p className="text-[11px] font-medium text-[#1a1a1a] leading-relaxed line-clamp-2 italic">
                {dashboardData?.latestAnalysis?.recommendations?.lifestyle?.[0]
                  ? `"${dashboardData.latestAnalysis.recommendations.lifestyle[0]}"`
                  : "Add details to unlock tailored insights."}
              </p>
            </div>
          </motion.div>
        </div>

        {/* Diabetes Monitor Block */}
        {isDiabetic && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="liquid-glass-strong mx-4 lg:mx-0 rounded-[28px] mt-4 mb-4 overflow-hidden"
          >
            {/* Header strip */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 lg:px-8 lg:pt-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: "rgba(91,140,111,0.12)", border: "1px solid rgba(91,140,111,0.2)" }}>
                  <Droplet className="w-4 h-4 text-[#5B8C6F]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1a1a1a] leading-tight">Diabetes Monitor</h2>
                  <p className="text-[10px] text-[#a0a0a0] font-medium leading-none mt-0.5">Track glucose & HbA1c</p>
                </div>
              </div>
              <button
                onClick={() => navigate("/glucose-log")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold text-[#5B8C6F] transition-all"
                style={{ background: "rgba(91,140,111,0.1)", border: "1px solid rgba(91,140,111,0.2)" }}
              >
                <Plus className="w-3.5 h-3.5" /> Log Reading
              </button>
            </div>

            {/* Stats row */}
            {(() => {
              const glucoseVal = dashboardData?.vitals?.glucose?.value || dashboardData?.latestAnalysis?.metrics?.Glucose?.value;
              const hba1cVal = dashboardData?.vitals?.hba1c?.value || dashboardData?.latestAnalysis?.metrics?.HbA1c?.value;
              const glucoseStatus = dashboardData?.latestAnalysis?.metrics?.Glucose?.status || (dashboardData?.vitals?.glucose ? "Recent" : null);
              const hba1cStatus = dashboardData?.latestAnalysis?.metrics?.HbA1c?.status || (dashboardData?.vitals?.hba1c ? "Recent" : null);

              if (!glucoseVal && !hba1cVal) {
                return (
                  <div className="mx-5 mb-5 liquid-glass-inner rounded-[20px] p-6 flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(91,140,111,0.1)" }}>
                      <Sparkles className="w-7 h-7 text-[#5B8C6F]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-[#1a1a1a] mb-0.5">Ready to Monitor</p>
                      <p className="text-[10px] text-[#a0a0a0] font-medium leading-relaxed">Upload a report or log your glucose to see insights here.</p>
                    </div>
                    <button onClick={() => navigate("/glucose-log")} className="shrink-0 px-4 py-2 rounded-xl text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg,#5B8C6F,#3d6b53)" }}>
                      Start
                    </button>
                  </div>
                );
              }

              const glucoseNum = parseFloat(glucoseVal) || 0;
              const ringPct = Math.min((glucoseNum / 200) * 100, 100);
              const ringColor = glucoseNum > 180 ? "#EF4444" : glucoseNum > 130 ? "#F59E0B" : "#5B8C6F";
              const circumference = 2 * Math.PI * 32;

              return (
                <div className="px-5 pb-5 lg:px-8 lg:pb-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Glucose ring card */}
                    <div className="liquid-glass-inner rounded-[20px] p-4 flex items-center gap-4 sm:col-span-1">
                      <div className="relative shrink-0 w-[72px] h-[72px]">
                        <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
                          <circle cx="36" cy="36" r="32" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="6" />
                          <circle cx="36" cy="36" r="32" fill="none" stroke={ringColor} strokeWidth="6"
                            strokeDasharray={circumference} strokeDashoffset={circumference - (circumference * ringPct) / 100}
                            strokeLinecap="round" className="transition-all duration-700" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-lg font-black text-[#1a1a1a] leading-none">{glucoseVal || "--"}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-[#a0a0a0] uppercase tracking-widest mb-0.5">Glucose</p>
                        <p className="text-xs font-bold text-[#888]">mg/dL</p>
                        {glucoseStatus && (
                          <span className="mt-1.5 inline-block text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                            style={{ background: `${ringColor}18`, color: ringColor }}>
                            {glucoseStatus}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* HbA1c card */}
                    <div className="liquid-glass-inner rounded-[20px] p-4 flex flex-col justify-center sm:col-span-1">
                      <p className="text-[9px] font-bold text-[#a0a0a0] uppercase tracking-widest mb-2">HbA1c</p>
                      <div className="flex items-baseline gap-1 mb-2">
                        <span className="text-3xl font-black text-[#1a1a1a]">{hba1cVal || "--"}</span>
                        {hba1cVal && <span className="text-[10px] font-bold text-[#b0b0b0] uppercase">%</span>}
                      </div>
                      {hba1cStatus && (
                        <span className="text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider self-start"
                          style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B" }}>
                          {hba1cStatus}
                        </span>
                      )}
                    </div>

                    {/* CTA card */}
                    <div className="liquid-glass-inner rounded-[20px] p-4 flex flex-col justify-between sm:col-span-1">
                      <div>
                        <p className="text-[9px] font-bold text-[#a0a0a0] uppercase tracking-widest mb-1">Full History</p>
                        <p className="text-[11px] text-[#1a1a1a] font-medium leading-snug">View trends, logs & AI analysis</p>
                      </div>
                      <button onClick={() => navigate("/glucose-log")}
                        className="mt-3 w-full h-9 rounded-xl text-[10px] font-bold text-white flex items-center justify-center gap-1.5 transition-all active:scale-95"
                        style={{ background: "linear-gradient(135deg, rgba(5,150,105,0.85), rgba(16,185,129,0.9))", boxShadow: "0 4px 12px rgba(5,150,105,0.25)" }}>
                        Open Glucose Log <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
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
          className="tour-logged-meals mb-4 w-full px-4 md:px-0"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-[#1a1a1a]">Logged Meals</h2>
              <p className="text-[10px] text-[#a0a0a0] font-medium uppercase tracking-wider">Today's intake</p>
            </div>
            <button
              onClick={() => navigate("/nutrition")}
              className="flex items-center gap-1.5 text-[11px] font-bold text-[#5B8C6F] hover:text-[#4a7b5e] uppercase tracking-wider transition-colors"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {loggedMeals.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
              {[...loggedMeals]
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, 8)
                .map((meal, idx) => {
                  const foodName = meal.name || meal.foodItems?.[0]?.name || "Meal";
                  const bingThumb = `https://tse1.mm.bing.net/th?q=${encodeURIComponent(foodName + " indian food")}&w=400&h=300&c=7&o=5&pid=Api`;
                  const calories = meal.totalNutrition?.calories || meal.calories || 200;
                  const protein = meal.totalNutrition?.protein || meal.protein || 0;
                  const mealTypeColors = {
                    breakfast: { bg: "rgba(251,191,36,0.15)", text: "#D97706" },
                    lunch: { bg: "rgba(16,185,129,0.15)", text: "#059669" },
                    dinner: { bg: "rgba(99,102,241,0.15)", text: "#6366F1" },
                    snack: { bg: "rgba(239,68,68,0.15)", text: "#EF4444" },
                  };
                  const typeColor = mealTypeColors[(meal.mealType || "").toLowerCase()] || mealTypeColors.lunch;

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className="liquid-glass rounded-[22px] overflow-hidden group cursor-pointer flex flex-col flex-shrink-0 w-[150px] snap-start"
                      onClick={() => navigate("/nutrition", { state: { prefillData: meal } })}
                    >
                      {/* Image */}
                      <div className="relative h-[110px] overflow-hidden">
                        <img
                          src={meal.imageUrl || bingThumb}
                          alt={foodName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => { e.target.src = bingThumb; }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                        <div className="absolute top-2 left-2">
                          <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-sm"
                            style={{ background: typeColor.bg, color: typeColor.text, border: `1px solid ${typeColor.text}30` }}>
                            {meal.mealType || "Meal"}
                          </span>
                        </div>
                        <div className="absolute bottom-2 right-2">
                          <span className="text-[9px] font-black text-white bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full">
                            {calories} kcal
                          </span>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-3 flex flex-col flex-1">
                        <h4 className="text-[12px] font-bold text-[#1a1a1a] truncate mb-1">{foodName}</h4>
                        <div className="flex items-center gap-2 mt-auto">
                          <div className="flex items-center gap-1">
                            <Zap className="w-2.5 h-2.5 text-[#5B8C6F]" />
                            <span className="text-[9px] font-bold text-[#888]">{Math.round(protein)}g Pro</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

              {/* Log More CTA card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(loggedMeals.length, 8) * 0.05 }}
                className="liquid-glass-inner rounded-[22px] flex flex-col items-center justify-center p-4 cursor-pointer group flex-shrink-0 w-[150px] snap-start"
                onClick={() => navigate("/nutrition", { state: { openLogMeal: true } })}
              >
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform"
                  style={{ background: "rgba(91,140,111,0.12)", border: "1px solid rgba(91,140,111,0.2)" }}>
                  <Plus className="w-5 h-5 text-[#5B8C6F]" />
                </div>
                <p className="text-[10px] font-bold text-[#5B8C6F] uppercase tracking-wider text-center">Log More</p>
              </motion.div>
            </div>
          ) : (
            <div className="liquid-glass rounded-[24px] overflow-hidden">
              <div className="flex flex-col md:flex-row items-center gap-6 p-6 md:p-8">
                {/* Left: visual */}
                <div className="flex-shrink-0 w-24 h-24 md:w-28 md:h-28 rounded-3xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,rgba(91,140,111,0.12),rgba(16,185,129,0.08))", border: "1px solid rgba(91,140,111,0.15)" }}>
                  <UtensilsCrossed className="w-10 h-10 text-[#5B8C6F]" />
                </div>

                {/* Right: text + actions */}
                <div className="flex-1 text-center md:text-left">
                  <p className="text-[10px] font-bold text-[#5B8C6F] uppercase tracking-widest mb-1">No meals yet today</p>
                  <h3 className="text-xl font-bold text-[#1a1a1a] mb-1">Start Tracking Your Diet</h3>
                  <p className="text-sm text-[#a0a0a0] font-medium mb-5 max-w-xs">Log your meals to get personalized nutrition insights and track your daily macros.</p>
                  <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                    <button
                      onClick={() => navigate("/nutrition", { state: { openLogMeal: true, mealType: "Breakfast" } })}
                      className="px-5 py-2.5 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95"
                      style={{ background: "linear-gradient(135deg, rgba(5,150,105,0.85), rgba(16,185,129,0.9))", boxShadow: "0 4px 16px rgba(5,150,105,0.3)" }}
                    >
                      Log First Meal
                    </button>
                    <button
                      onClick={() => navigate("/nutrition")}
                      className="px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all border"
                      style={{ color: "#5B8C6F", borderColor: "rgba(91,140,111,0.3)", background: "rgba(91,140,111,0.06)" }}
                    >
                      View Nutrition
                    </button>
                  </div>
                </div>

                {/* Quick meal type shortcuts */}
                <div className="hidden lg:flex flex-col gap-2 shrink-0">
                  {["Breakfast", "Lunch", "Dinner", "Snack"].map((type) => (
                    <button
                      key={type}
                      onClick={() => navigate("/nutrition", { state: { openLogMeal: true, mealType: type } })}
                      className="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all hover:scale-105"
                      style={{ background: "rgba(91,140,111,0.08)", color: "#5B8C6F", border: "1px solid rgba(91,140,111,0.15)" }}
                    >
                      + {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Challenge Banner - full width, visible on all screens */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="px-4 md:px-0 mb-3"
        >
          <div
            onClick={() => navigate("/challenge")}
            className="relative overflow-hidden rounded-[24px] cursor-pointer group"
            style={{ background: "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)" }}
          >
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-1/4 w-48 h-48 bg-emerald-400/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-1/3 w-32 h-32 bg-teal-300/10 rounded-full blur-2xl" />
            </div>
            <div className="relative z-10 flex items-center gap-5 px-5 py-4 lg:px-8 lg:py-5">
              {/* Streak ring */}
              <div className="relative shrink-0 w-14 h-14 lg:w-16 lg:h-16">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="23" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                  <circle cx="28" cy="28" r="23" fill="none" stroke="#34d399" strokeWidth="4"
                    strokeDasharray={144.5} strokeDashoffset={144.5 - (144.5 * Math.min((dashboardData?.streakDays || 0) / 30, 1))}
                    strokeLinecap="round" className="transition-all duration-700" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-emerald-400 fill-emerald-400" />
                </div>
              </div>
              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black text-emerald-300/60 uppercase tracking-widest mb-0.5">30-Day Challenge</p>
                <p className="text-xl lg:text-2xl font-black text-white leading-tight">
                  {dashboardData?.streakDays || 0} <span className="text-emerald-300">Day</span> Streak
                </p>
                <p className="text-[10px] font-medium text-emerald-200/50 mt-0.5">
                  {dashboardData?.streakDays > 0 ? "Keep going! You're on a roll." : "Start your streak today!"}
                </p>
              </div>
              {/* Progress */}
              <div className="hidden sm:flex flex-col items-end gap-2 shrink-0 mr-2">
                <span className="text-[9px] font-black text-emerald-300/50 uppercase tracking-widest">
                  {Math.round(Math.min((dashboardData?.streakDays || 0) / 30, 1) * 100)}% Complete
                </span>
                <div className="w-28 h-1.5 bg-emerald-950/40 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((dashboardData?.streakDays || 0) / 30, 1) * 100}%` }}
                    transition={{ duration: 1, delay: 0.6 }}
                    className="h-full bg-emerald-400 rounded-full"
                  />
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-emerald-300/40 group-hover:translate-x-1 transition-transform shrink-0" />
            </div>
          </div>
        </motion.div>

        {/* Bottom Grid - Nutrition Deficiency + Care Plan */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 px-4 md:px-0">
          {/* Nutrition Deficiency Tracker */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="liquid-glass-strong rounded-[28px] p-5 lg:p-6 flex flex-col"
          >
            <div className="flex items-center justify-between mb-5 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: "rgba(91,140,111,0.1)", border: "1px solid rgba(91,140,111,0.2)" }}>
                  <FlaskConical className="w-4 h-4 text-[#5B8C6F]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1a1a1a]">Nutrition Deficiency</h3>
                  <p className="text-[9px] text-[#a0a0a0] font-medium uppercase tracking-wider">From your lab reports</p>
                </div>
              </div>
              <button onClick={() => navigate("/upload")} className="text-[10px] font-bold text-[#5B8C6F] hover:text-[#4a7b5e] uppercase tracking-wide flex items-center gap-1">
                Detailed <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-4 flex-1 overflow-y-auto scrollbar-hide">
              {dashboardData?.processingReport ? (
                <div className="liquid-glass-inner flex items-center gap-4 p-4 rounded-[20px]">
                  <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center border border-[#E8F3EE] shrink-0">
                    <Clock className="w-5 h-5 text-[#5B8C6F] animate-spin" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#1a1a1a] mb-0.5">AI Analysis In Progress</p>
                    <p className="text-[10px] text-[#a0a0a0] font-medium">Processing your health data...</p>
                  </div>
                </div>
              ) : dynamicDeficiencies?.length > 0 ? (
                dynamicDeficiencies.map((item, i) => {
                  const isRisk =
                    item.status?.toLowerCase().includes("risk") ||
                    item.status?.toLowerCase().includes("deficient") ||
                    item.severity?.toLowerCase().includes("severe") ||
                    item.severity?.toLowerCase().includes("moderate");
                  const barColor = isRisk ? "#EF4444" : "#5B8C6F";
                  return (
                    <div key={i} className="liquid-glass-inner rounded-[18px] p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#1a1a1a]">{item.name}</span>
                          <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
                            style={{ background: `${barColor}18`, color: barColor }}>
                            {item.severity || item.status || "Low"}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-[#888]">
                          {item.currentValue || "--"}<span className="text-[#ccc]">/{item.normalRange || "--"}</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden mb-2">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${item.percent || 0}%` }}
                          transition={{ duration: 1, delay: 0.8 + i * 0.1 }}
                          className="h-full rounded-full" style={{ background: barColor }} />
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[9px] font-medium text-[#888] flex items-center gap-1">
                          <Leaf className="w-2.5 h-2.5 text-[#5B8C6F]" /> {item.food?.split(",")[0]}
                        </span>
                        <span className="text-[9px] font-medium text-[#888] flex items-center gap-1">
                          <Pill className="w-2.5 h-2.5 text-[#5B8C6F]" /> {item.supplement}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : dashboardData?.totalReports > 0 ? (
                <div className="liquid-glass-inner flex flex-col items-center justify-center p-8 rounded-[20px] text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-3" />
                  <p className="text-sm font-bold text-[#1a1a1a] mb-1">All Good!</p>
                  <p className="text-[10px] font-medium text-[#a0a0a0] uppercase tracking-wider">No deficiencies found in your reports</p>
                </div>
              ) : (
                <div className="liquid-glass-inner flex items-center gap-4 p-5 rounded-[20px]">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(91,140,111,0.08)" }}>
                    <Upload className="w-5 h-5 text-[#5B8C6F]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-[#1a1a1a] mb-0.5">No Reports Yet</p>
                    <p className="text-[10px] text-[#a0a0a0] font-medium mb-3">Upload lab reports to see nutritional insights</p>
                    <button onClick={() => navigate("/upload")}
                      className="px-4 py-1.5 rounded-xl text-[10px] font-bold text-white"
                      style={{ background: "linear-gradient(135deg, rgba(5,150,105,0.85), rgba(16,185,129,0.9))" }}>
                      Upload Now
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Care Plan */}
          {(() => {
            const metrics = dashboardData?.latestAnalysis?.metrics || {};
            const conditions = user?.profile?.medicalHistory?.conditions || [];
            const hasCondition = (name) => conditions.some((c) => c.toLowerCase().includes(name.toLowerCase()));
            const isHighMetric = (name) => {
              const metric = Object.values(metrics).find((m) =>
                m.name?.toLowerCase().includes(name.toLowerCase()) || m.label?.toLowerCase().includes(name.toLowerCase()));
              return metric?.status?.toLowerCase().includes("high") || metric?.status?.toLowerCase().includes("risk");
            };
            const defaultTasks = ["Drink 3L Water", "Morning walk 20 mins", "Take Multivitamins", "8 Hours Sleep"];
            if (isDiabetic || hasCondition("diabetes")) { defaultTasks[0] = "Check Glucose Level"; defaultTasks[2] = "Sugar-free Breakfast"; }
            if (hasCondition("hypertension") || isHighMetric("pressure")) { defaultTasks.push("Check Blood Pressure"); defaultTasks[0] = "Low Sodium Meals"; }
            if (hasCondition("anemia") || isHighMetric("hemoglobin")) { defaultTasks.push("Iron-rich Foods"); defaultTasks[2] = "Take Iron Supplement"; }
            if (isHighMetric("cholesterol")) { defaultTasks.push("Omega-3 Supplement"); defaultTasks[3] = "Fiber-rich Dinner"; }
            if (isOverLimit) { defaultTasks[1] = "Extra 15m Cardio"; if (defaultTasks.length < 5) defaultTasks.push("Log Extra Calories"); }
            const tasksToRender = dashboardData?.latestAnalysis?.recommendations?.lifestyle?.length > 0
              ? dashboardData.latestAnalysis.recommendations.lifestyle
              : defaultTasks.slice(0, 5);
            const totalTasks = tasksToRender.length;
            const progressPct = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

            return (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="liquid-glass-strong rounded-[28px] p-5 lg:p-6 flex flex-col"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: "rgba(91,140,111,0.1)", border: "1px solid rgba(91,140,111,0.2)" }}>
                      <CheckCircle2 className="w-4 h-4 text-[#5B8C6F]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#1a1a1a]">Care Plan</h3>
                      <p className="text-[9px] text-[#a0a0a0] font-medium uppercase tracking-wider">Daily health goals</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative w-9 h-9">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="3" />
                        <circle cx="18" cy="18" r="15" fill="none" stroke="#5B8C6F" strokeWidth="3"
                          strokeDasharray={94.2} strokeDashoffset={94.2 - (94.2 * progressPct) / 100}
                          strokeLinecap="round" className="transition-all duration-700" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-[#5B8C6F]">{progressPct}%</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-[#1a1a1a]">{completedTasks.length}</span>
                      <span className="text-[10px] text-[#a0a0a0]">/{totalTasks}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto scrollbar-hide">
                  {tasksToRender.map((task, i) => {
                    const isCompleted = completedTasks.includes(i);
                    return (
                      <div key={i}
                        className="flex items-center gap-3 p-3 rounded-[14px] cursor-pointer group transition-all"
                        style={{ background: isCompleted ? "rgba(91,140,111,0.06)" : "rgba(0,0,0,0.02)", border: `1px solid ${isCompleted ? "rgba(91,140,111,0.15)" : "rgba(0,0,0,0.04)"}` }}
                        onClick={() => toggleCarePlanTask(i)}
                      >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${isCompleted ? "bg-[#5B8C6F]" : "border-2 border-slate-200 group-hover:border-[#5B8C6F]"}`}>
                          {isCompleted && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <span className={`text-[11px] font-semibold flex-1 leading-tight transition-all ${isCompleted ? "text-[#5B8C6F] line-through decoration-[#5B8C6F]/40" : "text-[#1a1a1a]"}`}>
                          {task}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 pt-4 border-t border-black/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider">{Math.max(0, totalTasks - completedTasks.length)} tasks remaining</span>
                    <span className="text-[10px] font-bold text-[#5B8C6F]">{progressPct}% done</span>
                  </div>
                  <div className="h-1.5 bg-black/5 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${progressPct}%` }}
                      transition={{ duration: 1, delay: 1 }}
                      className="h-full bg-[#5B8C6F] rounded-full" />
                  </div>
                </div>
              </motion.div>
            );
          })()}
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
                className="fixed bottom-0 left-0 w-full h-[90vh] rounded-t-[40px] z-[71] flex flex-col overflow-hidden"
                style={{ background: "rgba(235,253,244,0.85)", backdropFilter: "blur(48px) saturate(200%)", WebkitBackdropFilter: "blur(48px) saturate(200%)", borderTop: "1px solid rgba(255,255,255,0.90)", boxShadow: "0 -20px 60px rgba(15,23,42,0.15), inset 0 1px 0 rgba(255,255,255,0.95)" }}
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
                        {activeLogTab === "Weight" && (
                          <Scale className="w-3 h-3 text-white/50" />
                        )}
                        {activeLogTab === "Water" && (
                          <Droplet className="w-3 h-3 text-white/50" />
                        )}
                        {activeLogTab === "Steps" && (
                          <Footprints className="w-3 h-3 text-white/50" />
                        )}
                        {activeLogTab === "Sleep" && (
                          <Moon className="w-3 h-3 text-white/50" />
                        )}
                        <span className="text-[9px] font-black text-white/60 uppercase tracking-[0.1em]">
                          Activity Log
                        </span>
                      </div>
                    </div>

                    <h3 className="text-xl font-black uppercase leading-tight tracking-tight">
                      Track {activeLogTab}
                    </h3>
                  </div>
                </div>

                {/* Navigation Tabs - Cleaner Spacing */}
                <div className="px-6 relative z-30 mt-4 mb-4">
                  <div className="bg-white p-1 rounded-[22px] shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-slate-100 flex gap-1 items-stretch">
                    {[
                      { id: "Weight", icon: Scale },
                      { id: "Water", icon: Droplet },
                      { id: "Steps", icon: Footprints },
                      { id: "Sleep", icon: Moon },
                    ].map(({ id, icon: Icon }) => {
                      const isActive = activeLogTab === id;
                      return (
                        <button
                          key={id}
                          onClick={() => setActiveLogTab(id)}
                          className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-[18px] transition-all duration-300 ${
                            isActive
                              ? "bg-[#F8FAFC] shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] border border-[#F1F5F9] text-[#1D293D]"
                              : "text-[#94A3B8] hover:bg-slate-50"
                          }`}
                        >
                          <Icon
                            className={`w-4 h-4 mb-1 ${isActive ? "text-[#1F5C49]" : "text-[#94A3B8]"}`}
                          />
                          <span
                            className={`text-[8.5px] uppercase tracking-wider ${isActive ? "font-black" : "font-bold"}`}
                          >
                            {id}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dynamic Content Mapping */}
                <div className="flex-1 overflow-y-auto pb-24 lg:pb-12 pt-2 px-0 max-w-2xl mx-auto w-full">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeLogTab}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="py-4"
                    >
                      {activeLogTab === "Weight" && (
                        <div className="space-y-6">
                          {/* Summary Card - High Fidelity */}
                          <div className="liquid-glass rounded-[32px] p-8 relative group">
                            <div className="flex items-center justify-between mb-10">
                              <h4 className="text-lg font-bold text-[#90A1B9]">
                                Current{" "}
                                <span className="text-[#1D293D] font-black">
                                  {(
                                    Number(vitalsInput.weight) ||
                                    Number(user?.profile?.weight) ||
                                    72.5
                                  ).toFixed(1)}{" "}
                                  kg
                                </span>
                              </h4>
                              <div className="px-3 py-1 bg-[#E8F3EE] rounded-full flex items-center gap-1.5 ">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#1F5C49]" />
                                <span className="text-[9px] font-black text-[#1F5C49] uppercase tracking-widest">
                                  Live
                                </span>
                              </div>
                            </div>

                            {/* Semi-Circle Gauge */}
                            <div className="flex flex-col items-center justify-center my-10 relative">
                              <div className="relative w-[220px] h-[130px]">
                                <svg
                                  width="220"
                                  height="130"
                                  viewBox="0 0 220 130"
                                >
                                  <path
                                    d="M 20 120 A 80 80 0 0 1 200 120"
                                    fill="none"
                                    stroke="#F1F5F9"
                                    strokeWidth="8"
                                    strokeLinecap="butt"
                                  />
                                  <circle
                                    cx="20"
                                    cy="120"
                                    r="4"
                                    fill="#10B981"
                                  />
                                  <motion.path
                                    key={vitalsInput.weight}
                                    initial={{ pathLength: 0 }}
                                    animate={{
                                      pathLength:
                                        Math.min(
                                          100,
                                          Number(vitalsInput.weight) ||
                                            Number(user?.profile?.weight) ||
                                            0,
                                        ) / 100,
                                    }}
                                    transition={{
                                      type: "tween",
                                      duration: 0.5,
                                      ease: "easeOut",
                                    }}
                                    d="M 20 120 A 80 80 0 0 1 200 120"
                                    fill="none"
                                    stroke="#10B981"
                                    strokeWidth="12"
                                    strokeLinecap="round"
                                  />
                                </svg>
                                <div className="absolute top-[18px] left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white border-2 border-[#10B981] flex items-center justify-center shadow-sm">
                                  <Scale className="w-3.5 h-3.5 text-[#10B981]" />
                                </div>
                              </div>
                              <div className="text-center -mt-8">
                                <span className="text-4xl font-black text-[#1D293D]">
                                  {(
                                    Number(vitalsInput.weight) ||
                                    Number(user?.profile?.weight) ||
                                    0
                                  ).toFixed(1)}
                                </span>
                                <p className="text-[9px] font-black text-[#90A1B9] uppercase tracking-[0.1em] mt-1">
                                  Kilograms Today
                                </p>
                              </div>
                            </div>

                            <div className="bg-[#F8FAFC] rounded-[24px] p-6 flex justify-between items-center border border-[#F1F5F9]">
                              <div className="flex-1 flex flex-col items-center border-r border-slate-200">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">
                                  Goal
                                </span>
                                <p className="text-lg font-black text-[#1D293D]">
                                  {dashboardData?.goals?.weight || 70}
                                  <span className="text-xs ml-1">kg</span>
                                </p>
                              </div>
                              <div className="flex-1 flex flex-col items-center border-r border-slate-200">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">
                                  Progress
                                </span>
                                <p className="text-lg font-black text-[#1F5C49]">
                                  {(() => {
                                    const current =
                                      Number(vitalsInput.weight) ||
                                      Number(user?.profile?.weight) ||
                                      0;
                                    const target = Number(
                                      dashboardData?.goals?.weight ||
                                        user?.nutritionGoal?.weightGoal ||
                                        70,
                                    );
                                    const diff = (current - target).toFixed(1);
                                    return (
                                      (diff > 0 ? `+${diff}` : diff) + "kg"
                                    );
                                  })()}
                                </p>
                              </div>
                              <div className="flex-1 flex flex-col items-center">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">
                                  BMI
                                </span>
                                <p className="text-lg font-black text-[#1D293D]">
                                  {(() => {
                                    const w = Number(
                                      vitalsInput.weight ||
                                        user?.profile?.weight ||
                                        72.5,
                                    );
                                    const h =
                                      Number(user?.profile?.height || 170) /
                                      100;
                                    return (w / (h * h)).toFixed(1);
                                  })()}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="liquid-glass rounded-[32px] p-8 overflow-hidden group">
                            <div className="flex items-center justify-between mb-8">
                              <div className="flex items-center gap-3">
                                <Activity className="w-5 h-5 text-[#1F5C49]" />
                                <h4 className="text-lg font-black text-[#1D293D]">
                                  Trend
                                </h4>
                              </div>
                              <div className="px-3 py-1.5 bg-[#F3F9F6] rounded-full">
                                <span className="text-[9px] font-black text-[#1F5C49] uppercase">
                                  Last 7 Days
                                </span>
                              </div>
                            </div>
                            <div className="h-32 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={formattedHistory.weight}>
                                  <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#1F5C49"
                                    strokeWidth={3}
                                    dot={{
                                      fill: "#1F5C49",
                                      stroke: "#fff",
                                      strokeWidth: 2,
                                      r: 4,
                                    }}
                                  />
                                  <XAxis dataKey="day" hide />
                                  <YAxis
                                    hide
                                    domain={["dataMin - 1", "dataMax + 1"]}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                              <div className="flex justify-between px-2 mt-2">
                                {formattedHistory.weight.map((item) => (
                                  <span
                                    key={item.day}
                                    className="text-[9px] font-black text-[#CAD5E2]"
                                  >
                                    {item.day}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="bg-white border border-[#E8F3EE] shadow-sm rounded-[24px] p-6 flex items-center gap-6">
                            <div className="flex-[4] space-y-3">
                              <span className="text-[9px] font-black text-[#1F5C49]/70 uppercase ml-2">
                                Weight (kg)
                              </span>
                              <div className="bg-white px-4 py-3.5 rounded-2xl border border-[#E8F3EE]">
                                <input
                                  type="number"
                                  step="0.1"
                                  placeholder="72.5"
                                  value={vitalsInput.weight}
                                  onChange={(e) =>
                                    setVitalsInput((prev) => ({
                                      ...prev,
                                      weight: e.target.value,
                                    }))
                                  }
                                  className="bg-transparent text-sm font-bold text-[#1D293D] w-full focus:outline-none"
                                />
                              </div>
                            </div>
                            <div className="flex-[6] space-y-3">
                              <span className="text-[9px] font-black text-[#1F5C49]/70 uppercase ml-2">
                                Date
                              </span>
                              <div className="flex flex-col gap-2 bg-white px-4 py-3.5 rounded-2xl border border-[#E8F3EE] w-full">
                                <div className="flex items-center gap-2 w-full">
                                  <Calendar className="w-3.5 h-3.5 text-[#90A1B9]" />
                                  <input
                                    type="date"
                                    value={vitalsInput.date}
                                    onChange={(e) =>
                                      setVitalsInput((prev) => ({
                                        ...prev,
                                        date: e.target.value,
                                      }))
                                    }
                                    className="bg-transparent text-sm font-bold text-[#1D293D] w-full focus:outline-none"
                                  />
                                </div>
                                <p className="text-[9px] font-black text-[#1F5C49] uppercase tracking-widest pl-5.5">
                                  Logging for:{" "}
                                  {vitalsInput.date
                                    ? vitalsInput.date
                                        .split("-")
                                        .reverse()
                                        .join("/")
                                    : "--/--/--"}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Primary Save Action */}
                          <div className="mt-8">
                            <button
                              onClick={() => handleLogVitals("Weight")}
                              disabled={vitalsLoading}
                              className="w-full h-16 bg-[#1F5C49] rounded-full shadow-[0_20px_40px_rgba(31,92,73,0.3)] flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                              {vitalsLoading ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Save className="w-5 h-5 text-white" />
                                  <span className="text-base font-black text-white tracking-tight uppercase">
                                    Save weight
                                  </span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {activeLogTab === "Water" && (
                        <div className="space-y-6 pb-24">
                          <div className="bg-white border border-[#E8F3EE] shadow-[0_1px_3px_rgba(0,0,0,0.1)] rounded-[32px] p-8 relative overflow-hidden group">
                            {/* Live Badge */}
                            <div className="absolute top-6 right-6 px-3 py-1 bg-[#EEF2FF]/50 rounded-full flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                              <span className="text-[9px] font-black text-[#3B82F6] uppercase tracking-widest">
                                Live
                              </span>
                            </div>

                            <div className="text-center mt-4">
                              <h4 className="text-lg font-bold text-slate-400">
                                You have drank{" "}
                                <span className="text-[#1D293D] font-black">
                                  {waterLog} glasses
                                </span>
                              </h4>
                              <p className="text-sm font-bold text-slate-300 mt-1">
                                today
                              </p>
                            </div>
                            {/* Semi-Circle Gauge */}
                            <div className="flex flex-col items-center justify-center my-10 relative">
                              <div className="relative w-[220px] h-[130px]">
                                <svg
                                  width="220"
                                  height="130"
                                  viewBox="0 0 220 130"
                                >
                                  <path
                                    d="M 20 120 A 80 80 0 0 1 200 120"
                                    fill="none"
                                    stroke="#F1F5F9"
                                    strokeWidth="8"
                                    strokeLinecap="butt"
                                  />
                                  <circle
                                    cx="20"
                                    cy="120"
                                    r="4"
                                    fill="#3B82F6"
                                  />
                                  <motion.path
                                    key={waterLog}
                                    initial={{ pathLength: 0 }}
                                    animate={{
                                      pathLength: Math.min(8, waterLog) / 8,
                                    }}
                                    transition={{
                                      type: "tween",
                                      duration: 0.5,
                                      ease: "easeOut",
                                    }}
                                    d="M 20 120 A 80 80 0 0 1 200 120"
                                    fill="none"
                                    stroke="#3B82F6"
                                    strokeWidth="12"
                                    strokeLinecap="round"
                                  />
                                </svg>
                                <div className="absolute top-[18px] left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white border-2 border-[#3B82F6] flex items-center justify-center shadow-sm">
                                  <GlassWater className="w-3.5 h-3.5 text-[#3B82F6]" />
                                </div>
                              </div>
                              <div className="text-center -mt-8">
                                <span className="text-4xl font-black text-[#1D293D]">
                                  {waterLog}
                                </span>
                                <p className="text-[9px] font-black text-[#90A1B9] uppercase tracking-[0.1em] mt-1">
                                  Glasses Today
                                </p>
                              </div>
                            </div>

                            <div className="bg-[#F8FAFC] rounded-[24px] p-6 flex justify-between items-center border border-[#F1F5F9] mt-4">
                              <div className="flex-1 flex flex-col items-center border-r border-slate-200">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">
                                  Volume
                                </span>
                                <p className="text-lg font-black text-[#1D293D]">
                                  {waterLog * 250}
                                  <span className="text-xs ml-1 text-slate-300">
                                    ml
                                  </span>
                                </p>
                              </div>
                              <div className="flex-1 flex flex-col items-center border-r border-slate-200">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">
                                  Remaining
                                </span>
                                <p className="text-lg font-black text-[#3B82F6]">
                                  {Math.max(0, 8 - waterLog)}
                                  <span className="text-xs ml-1 font-bold">
                                    glasses
                                  </span>
                                </p>
                              </div>
                              <div className="flex-1 flex flex-col items-center">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">
                                  Goal
                                </span>
                                <p className="text-lg font-black text-[#1D293D]">
                                  8
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Weekly Hydration Chart Card */}
                          <div className="liquid-glass rounded-[20px] p-4">
                            <div className="flex justify-between items-center mb-6">
                              <h4 className="text-base font-black text-[#1D293D] tracking-tight">
                                Weekly Hydration
                              </h4>
                              <div className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                  Last 7 Days
                                </span>
                              </div>
                            </div>

                            <div className="h-[180px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={formattedHistory.water}>
                                  <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="#F1F5F9"
                                  />
                                  <XAxis
                                    dataKey="day"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{
                                      fontSize: 9,
                                      fontWeight: 900,
                                      fill: "#94A3B8",
                                    }}
                                    dy={10}
                                  />
                                  <YAxis hide />
                                  <Tooltip
                                    cursor={{ fill: "#F8FAFC" }}
                                    content={({ active, payload }) => {
                                      if (active && payload && payload.length) {
                                        return (
                                          <div className="bg-white p-3 rounded-xl shadow-lg border border-slate-100">
                                            <p className="text-xs font-black text-slate-400 uppercase">
                                              {payload[0].payload.day}
                                            </p>
                                            <p className="text-sm font-black text-[#3B82F6]">
                                              {payload[0].value} Glasses
                                            </p>
                                          </div>
                                        );
                                      }
                                      return null;
                                    }}
                                  />
                                  <Bar
                                    dataKey="value"
                                    radius={[8, 8, 8, 8]}
                                    barSize={28}
                                  >
                                    {formattedHistory.water.map(
                                      (entry, index) => (
                                        <Cell
                                          key={index}
                                          fill={
                                            entry.value >= 8
                                              ? "#3B82F6"
                                              : "#E0E7FF"
                                          }
                                        />
                                      ),
                                    )}
                                  </Bar>
                                  <ReferenceLine
                                    y={8}
                                    stroke="#3B82F6"
                                    strokeDasharray="3 3"
                                    opacity={0.3}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>

                            {/* Legend */}
                            <div className="flex items-center justify-center gap-6 mt-6">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                  Goal Met
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#E0E7FF]" />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                  In Progress
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Quick Log Card - High Fidelity */}
                          <div className="liquid-glass rounded-[20px] p-4 space-y-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                                <Plus className="w-4 h-4 text-[#3B82F6]" />
                              </div>
                              <h4 className="text-base font-black text-[#1D293D]">
                                Quick Log
                              </h4>
                            </div>

                            <div className="flex items-center justify-center gap-10">
                              <button
                                onClick={() =>
                                  setWaterLog((prev) => Math.max(0, prev - 1))
                                }
                                className="w-16 h-16 rounded-full bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-slate-100 flex items-center justify-center text-slate-400 active:scale-95 transition-all"
                              >
                                <Minus className="w-6 h-6" />
                              </button>

                              <div className="relative flex items-center justify-center">
                                <div className="w-28 h-28 rounded-full border-[6px] border-[#3B82F6]/5 flex items-center justify-center">
                                  <div className="w-22 h-22 rounded-full bg-[#EFF6FF] flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                                    <span className="text-4xl font-black text-[#3B82F6]">
                                      {waterLog}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => setWaterLog((prev) => prev + 1)}
                                className="w-16 h-16 rounded-full bg-[#3B82F6] shadow-[0_8px_30px_rgba(59,130,246,0.25)] flex items-center justify-center text-white active:scale-95 transition-all"
                              >
                                <Plus className="w-6 h-6" />
                              </button>
                            </div>
                          </div>

                          {/* Primary Save Action */}
                          <div className="mt-8">
                            <button
                              onClick={() =>
                                handleLogVitals(
                                  "Water",
                                  waterLog -
                                    (nutritionData?.totalWater ??
                                      nutritionData?.waterIntake ??
                                      0),
                                )
                              }
                              disabled={vitalsLoading}
                              className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                              style={{ background: "linear-gradient(135deg, rgba(5,150,105,0.9) 0%, rgba(16,185,129,0.95) 100%)", boxShadow: "0 8px 24px rgba(16,185,129,0.3)" }}
                            >
                              {vitalsLoading ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Save className="w-5 h-5 text-white" />
                                  <span className="text-base font-black text-white tracking-tight uppercase">
                                    Save water
                                  </span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {activeLogTab === "Steps" && (
                        <div className="space-y-6 pb-24">
                          <div className="bg-white border border-[#E8F3EE] shadow-[0_1px_3px_rgba(0,0,0,0.1)] rounded-[32px] p-8 relative overflow-hidden group">
                            {/* Live Badge */}
                            <div className="absolute top-6 right-6 px-3 py-1 bg-orange-50 rounded-full flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                              <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest">
                                Live
                              </span>
                            </div>

                            <div className="text-center mt-4">
                              <h4 className="text-lg font-bold text-slate-400">
                                You have walked{" "}
                                <span className="text-[#1D293D] font-black">
                                  {(
                                    Number(vitalsInput.steps) ||
                                    Number(wearableData?.todayMetrics?.steps) ||
                                    0
                                  ).toLocaleString()}{" "}
                                  steps
                                </span>
                              </h4>
                              <p className="text-sm font-bold text-slate-300 mt-1">
                                today
                              </p>
                            </div>

                            {/* Semi-Circle Gauge - Increased height to prevent clipping */}
                            <div className="flex flex-col items-center justify-center my-10 relative">
                              <div className="relative w-[220px] h-[130px]">
                                <svg
                                  width="220"
                                  height="130"
                                  viewBox="0 0 220 130"
                                >
                                  <path
                                    d="M 20 120 A 80 80 0 0 1 200 120"
                                    fill="none"
                                    stroke="#F1F5F9"
                                    strokeWidth="8"
                                    strokeLinecap="butt"
                                  />
                                  <circle
                                    cx="20"
                                    cy="120"
                                    r="4"
                                    fill="#F97316"
                                  />
                                  <motion.path
                                    key={vitalsInput.steps}
                                    initial={{ pathLength: 0 }}
                                    animate={{
                                      pathLength:
                                        Math.min(
                                          10000,
                                          Number(vitalsInput.steps) ||
                                            Number(
                                              wearableData?.todayMetrics?.steps,
                                            ) ||
                                            0,
                                        ) / 10000,
                                    }}
                                    transition={{
                                      type: "tween",
                                      duration: 0.5,
                                      ease: "easeOut",
                                    }}
                                    d="M 20 120 A 80 80 0 0 1 200 120"
                                    fill="none"
                                    stroke="#F97316"
                                    strokeWidth="12"
                                    strokeLinecap="round"
                                  />
                                </svg>
                                <div className="absolute top-[18px] left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white border-2 border-orange-500 flex items-center justify-center shadow-sm">
                                  <Footprints className="w-3.5 h-3.5 text-orange-500" />
                                </div>
                              </div>
                              <div className="text-center -mt-8">
                                <span className="text-4xl font-black text-[#1D293D]">
                                  {(
                                    Number(vitalsInput.steps) ||
                                    Number(wearableData?.todayMetrics?.steps) ||
                                    0
                                  ).toLocaleString()}
                                </span>
                                <p className="text-[9px] font-black text-[#90A1B9] uppercase tracking-[0.1em] mt-1">
                                  Of 10,000 steps
                                </p>
                              </div>
                            </div>

                            <div className="bg-[#F8FAFC] rounded-[24px] p-6 flex justify-between items-center border border-[#F1F5F9] mt-4">
                              <div className="flex-1 flex flex-col items-center border-r border-slate-200">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">
                                  Calories
                                </span>
                                <p className="text-lg font-black text-[#1D293D]">
                                  {(
                                    Number(
                                      vitalsInput.steps ||
                                        wearableData?.todayMetrics?.steps ||
                                        0,
                                    ) * 0.04
                                  ).toFixed(0)}
                                  <span className="text-xs ml-1 text-slate-300">
                                    kcal
                                  </span>
                                </p>
                              </div>
                              <div className="flex-1 flex flex-col items-center border-r border-slate-200">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">
                                  Distance
                                </span>
                                <p className="text-lg font-black text-[#1D293D]">
                                  {(
                                    Number(
                                      vitalsInput.steps ||
                                        wearableData?.todayMetrics?.steps ||
                                        0,
                                    ) * 0.0008
                                  ).toFixed(1)}
                                  <span className="text-xs ml-1 text-slate-300 font-bold">
                                    km
                                  </span>
                                </p>
                              </div>
                              <div className="flex-1 flex flex-col items-center">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">
                                  Goal
                                </span>
                                <p className="text-lg font-black text-[#1D293D]">
                                  10k
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Weekly Progress Chart Card */}
                          <div className="liquid-glass rounded-[20px] p-4">
                            <div className="flex justify-between items-center mb-6">
                              <h4 className="text-base font-black text-[#1D293D] tracking-tight">
                                Weekly Progress
                              </h4>
                              <div className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                  Last 7 Days
                                </span>
                              </div>
                            </div>

                            <div className="h-[180px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={formattedHistory.steps}>
                                  <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="#F1F5F9"
                                  />
                                  <XAxis
                                    dataKey="day"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{
                                      fontSize: 9,
                                      fontWeight: 900,
                                      fill: "#94A3B8",
                                    }}
                                    dy={10}
                                  />
                                  <YAxis hide />
                                  <Tooltip
                                    cursor={{ fill: "#FFF7ED" }}
                                    content={({ active, payload }) => {
                                      if (active && payload && payload.length) {
                                        return (
                                          <div className="bg-white p-3 rounded-xl shadow-lg border border-orange-100">
                                            <p className="text-xs font-black text-slate-400 uppercase">
                                              {payload[0].payload.day}
                                            </p>
                                            <p className="text-sm font-black text-[#F97316]">
                                              {payload[0].value.toLocaleString()}{" "}
                                              Steps
                                            </p>
                                          </div>
                                        );
                                      }
                                      return null;
                                    }}
                                  />
                                  <Bar
                                    dataKey="value"
                                    radius={[8, 8, 8, 8]}
                                    barSize={28}
                                  >
                                    {formattedHistory.steps.map(
                                      (entry, index) => (
                                        <Cell
                                          key={index}
                                          fill={
                                            entry.value >= 10000
                                              ? "#F97316"
                                              : "#FFEDD5"
                                          }
                                        />
                                      ),
                                    )}
                                  </Bar>
                                  <ReferenceLine
                                    y={10000}
                                    stroke="#F97316"
                                    strokeDasharray="3 3"
                                    opacity={0.3}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>

                            {/* Legend */}
                            <div className="flex items-center justify-center gap-6 mt-6">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#F97316]" />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                  Goal Met
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#FFEDD5]" />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                  In Progress
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Manual Entry Card */}
                          <div className="liquid-glass rounded-[20px] p-4 space-y-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center">
                                <Plus className="w-4 h-4 text-[#F97316]" />
                              </div>
                              <h4 className="text-base font-black text-[#1D293D]">
                                Manual Entry
                              </h4>
                            </div>

                            <div className="flex gap-4">
                              <div className="flex-1 space-y-3">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase ml-1">
                                  Steps to Add
                                </span>
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                  <input
                                    type="number"
                                    placeholder="2000"
                                    value={vitalsInput.steps}
                                    onChange={(e) =>
                                      setVitalsInput((prev) => ({
                                        ...prev,
                                        steps: e.target.value,
                                      }))
                                    }
                                    className="bg-transparent text-sm font-black text-[#1D293D] placeholder:text-slate-200 w-full focus:outline-none"
                                  />
                                </div>
                              </div>
                              <div className="flex-1 space-y-3">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase ml-1">
                                  Date
                                </span>
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-slate-200" />
                                  <input
                                    type="date"
                                    value={vitalsInput.date}
                                    onChange={(e) =>
                                      setVitalsInput((prev) => ({
                                        ...prev,
                                        date: e.target.value,
                                      }))
                                    }
                                    className="bg-transparent text-xs font-black text-[#1D293D] w-full focus:outline-none"
                                  />
                                </div>
                                <p className="text-[8px] font-black text-orange-600 uppercase tracking-widest ml-1 mt-1">
                                  Date:{" "}
                                  {vitalsInput.date
                                    ? vitalsInput.date
                                        .split("-")
                                        .reverse()
                                        .join("/")
                                    : "--/--/--"}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Primary Save Action */}
                          <div className="mt-4">
                            <button
                              onClick={() => handleLogVitals("Steps")}
                              disabled={vitalsLoading}
                              className="w-full h-16 bg-[#F97316] rounded-full shadow-[0_20px_40px_rgba(249,115,22,0.3)] flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                              {vitalsLoading ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Save className="w-5 h-5 text-white" />
                                  <span className="text-base font-black text-white tracking-tight uppercase">
                                    Save steps
                                  </span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {activeLogTab === "Sleep" && (
                        <div className="space-y-6 pb-24">
                          <div className="bg-white border border-[#E8F3EE] shadow-[0_1px_3px_rgba(0,0,0,0.1)] rounded-[32px] p-8 relative overflow-hidden group">
                            <div className="absolute top-6 right-6 px-3 py-1 bg-purple-50 rounded-full flex items-center gap-1.5 ">
                              <span className="text-[9px] font-black text-purple-600 uppercase tracking-widest">
                                Last Night
                              </span>
                            </div>

                            <div className="text-center mt-4">
                              <h4 className="text-lg font-bold text-slate-400">
                                You slept{" "}
                                <span className="text-[#1D293D] font-black">
                                  {vitalsInput.sleepHours ||
                                    Math.floor(
                                      Number(
                                        wearableData?.todayMetrics?.sleep || 0,
                                      ) / 60,
                                    )}
                                  h{" "}
                                  {vitalsInput.sleepMins ||
                                    Number(
                                      wearableData?.todayMetrics?.sleep || 0,
                                    ) % 60}
                                  m
                                </span>
                              </h4>
                            </div>

                            {/* Semi-Circle Gauge - Increased height to prevent clipping */}
                            <div className="flex flex-col items-center justify-center my-10 relative">
                              <div className="relative w-[220px] h-[130px]">
                                <svg
                                  width="220"
                                  height="130"
                                  viewBox="0 0 220 130"
                                >
                                  <path
                                    d="M 20 120 A 80 80 0 0 1 200 120"
                                    fill="none"
                                    stroke="#F1F5F9"
                                    strokeWidth="8"
                                    strokeLinecap="butt"
                                  />
                                  <circle
                                    cx="20"
                                    cy="120"
                                    r="4"
                                    fill="#8A7BB6"
                                  />
                                  {(() => {
                                    const hasInput =
                                      vitalsInput.sleepHours !== "" ||
                                      vitalsInput.sleepMins !== "";
                                    const selectedDateStr =
                                      vitalsInput.date ||
                                      new Date().toISOString().split("T")[0];

                                    // Find existing sleep record for selected date in recentSleep array
                                    const existingSleep =
                                      wearableData?.recentSleep?.find(
                                        (s) =>
                                          new Date(s.date)
                                            .toISOString()
                                            .split("T")[0] === selectedDateStr,
                                      );
                                    const existingMins =
                                      existingSleep?.totalSleepMinutes || 0;

                                    const currentSleepVal = hasInput
                                      ? parseFloat(
                                          vitalsInput.sleepHours || 0,
                                        ) +
                                        parseFloat(vitalsInput.sleepMins || 0) /
                                          60
                                      : existingMins / 60;

                                    return (
                                      <>
                                        <motion.path
                                          key={`${vitalsInput.sleepHours}-${vitalsInput.sleepMins}-${existingMins}-${vitalsInput.date}`}
                                          initial={{ pathLength: 0 }}
                                          animate={{
                                            pathLength:
                                              Math.min(8, currentSleepVal) / 8,
                                          }}
                                          transition={{
                                            type: "tween",
                                            duration: 0.5,
                                            ease: "easeOut",
                                          }}
                                          d="M 20 120 A 80 80 0 0 1 200 120"
                                          fill="none"
                                          stroke="#8A7BB6"
                                          strokeWidth="12"
                                          strokeLinecap="round"
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
                                    const hasInput =
                                      vitalsInput.sleepHours !== "" ||
                                      vitalsInput.sleepMins !== "";
                                    const selectedDateStr =
                                      vitalsInput.date ||
                                      new Date().toISOString().split("T")[0];
                                    const existingSleep =
                                      wearableData?.recentSleep?.find(
                                        (s) =>
                                          new Date(s.date)
                                            .toISOString()
                                            .split("T")[0] === selectedDateStr,
                                      );
                                    const existingMins =
                                      existingSleep?.totalSleepMinutes || 0;

                                    return (
                                      hasInput
                                        ? parseFloat(
                                            vitalsInput.sleepHours || 0,
                                          ) +
                                          parseFloat(
                                            vitalsInput.sleepMins || 0,
                                          ) /
                                            60
                                        : existingMins / 60
                                    ).toFixed(1);
                                  })()}
                                </span>
                                <p className="text-[9px] font-black text-[#90A1B9] uppercase tracking-[0.1em] mt-1">
                                  Hours Logged
                                </p>
                              </div>
                            </div>

                            <div className="bg-[#F8FAFC] rounded-[24px] p-6 flex justify-between items-center border border-[#F1F5F9] mt-4">
                              <div className="flex-1 flex flex-col items-center border-r border-slate-200">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">
                                  Deep
                                </span>
                                <p className="text-lg font-black text-[#1D293D]">
                                  {(
                                    Number(vitalsInput.sleepHours) * 0.3
                                  ).toFixed(1)}
                                  <span className="text-xs ml-1 text-slate-300">
                                    h
                                  </span>
                                </p>
                              </div>
                              <div className="flex-1 flex flex-col items-center border-r border-slate-200">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">
                                  Quality
                                </span>
                                <p className="text-lg font-black text-purple-600">
                                  85%
                                </p>
                              </div>
                              <div className="flex-1 flex flex-col items-center">
                                <span className="text-[9px] font-black text-[#90A1B9] uppercase mb-1">
                                  Goal
                                </span>
                                <p className="text-lg font-black text-[#1D293D]">
                                  8h
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Weekly Sleep Analysis Chart */}
                          <div className="liquid-glass rounded-[20px] p-4">
                            <div className="flex justify-between items-center mb-6">
                              <h4 className="text-base font-black text-[#1D293D] tracking-tight">
                                Weekly Sleep
                              </h4>
                              <div className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                  Last 7 Days
                                </span>
                              </div>
                            </div>

                            <div className="h-[180px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={formattedHistory.sleep}>
                                  <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="#F1F5F9"
                                  />
                                  <XAxis
                                    dataKey="day"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{
                                      fontSize: 9,
                                      fontWeight: 900,
                                      fill: "#94A3B8",
                                    }}
                                    dy={10}
                                  />
                                  <YAxis hide />
                                  <Tooltip
                                    cursor={{ fill: "#F5F3FF" }}
                                    content={({ active, payload }) => {
                                      if (active && payload && payload.length) {
                                        return (
                                          <div className="bg-white p-3 rounded-xl shadow-lg border border-purple-100">
                                            <p className="text-xs font-black text-slate-400 uppercase">
                                              {payload[0].payload.day}
                                            </p>
                                            <p className="text-sm font-black text-[#8A7BB6]">
                                              {payload[0].value} Hours
                                            </p>
                                          </div>
                                        );
                                      }
                                      return null;
                                    }}
                                  />
                                  <Bar
                                    dataKey="value"
                                    radius={[8, 8, 8, 8]}
                                    barSize={28}
                                  >
                                    {formattedHistory.sleep.map(
                                      (entry, index) => (
                                        <Cell
                                          key={index}
                                          fill={
                                            entry.value >= 8
                                              ? "#8A7BB6"
                                              : "#D1CBE9"
                                          }
                                        />
                                      ),
                                    )}
                                  </Bar>
                                  <ReferenceLine
                                    y={8}
                                    stroke="#8A7BB6"
                                    strokeDasharray="3 3"
                                    opacity={0.3}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>

                            {/* Legend */}
                            <div className="flex items-center justify-center gap-6 mt-6">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#8A7BB6]" />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                  Goal Met
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#D1CBE9]" />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                  Below Goal
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-4 border-t-2 border-dashed border-[#8A7BB6]/30" />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                  Goal (8h)
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Log Sleep Manual Entry Card */}
                          <div className="liquid-glass rounded-[20px] p-4 space-y-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                                <Plus className="w-4 h-4 text-emerald-600" />
                              </div>
                              <h4 className="text-base font-bold text-[#1D293D] tracking-tight">
                                Log Sleep
                              </h4>
                            </div>

                            <div className="grid grid-cols-12 gap-4">
                              <div className="col-span-3 space-y-3">
                                <span className="text-[10px] font-black text-[#94A3B8] uppercase tracking-[0.15em] ml-2">
                                  Hours
                                </span>
                                <div className="bg-white px-2 py-4.5 rounded-[22px] border border-[#E2E8F0] flex items-center justify-center h-[72px]">
                                  <input
                                    type="number"
                                    placeholder="7"
                                    value={vitalsInput.sleepHours || ""}
                                    onChange={(e) =>
                                      setVitalsInput((prev) => ({
                                        ...prev,
                                        sleepHours: e.target.value,
                                      }))
                                    }
                                    className="bg-transparent text-xl font-black text-[#A0AEC0] placeholder:text-[#CBD5E0] text-center w-full focus:outline-none"
                                  />
                                </div>
                              </div>
                              <div className="col-span-3 space-y-3">
                                <span className="text-[10px] font-black text-[#94A3B8] uppercase tracking-[0.15em] ml-2">
                                  Mins
                                </span>
                                <div className="bg-white px-2 py-4.5 rounded-[22px] border border-[#E2E8F0] flex items-center justify-center h-[72px]">
                                  <input
                                    type="number"
                                    placeholder="15"
                                    value={vitalsInput.sleepMins || ""}
                                    onChange={(e) =>
                                      setVitalsInput((prev) => ({
                                        ...prev,
                                        sleepMins: e.target.value,
                                      }))
                                    }
                                    className="bg-transparent text-xl font-black text-[#A0AEC0] placeholder:text-[#CBD5E0] text-center w-full focus:outline-none"
                                  />
                                </div>
                              </div>
                              <div className="col-span-6 space-y-3">
                                <span className="text-[10px] font-black text-[#94A3B8] uppercase tracking-[0.15em] ml-2">
                                  Date
                                </span>
                                <div className="bg-white px-6 py-4.5 rounded-[22px] border border-[#E2E8F0] flex flex-col justify-center h-[72px]">
                                  <div className="flex items-center gap-4 w-full">
                                    <Calendar className="w-5.5 h-5.5 text-[#94A3B8]" />
                                    <input
                                      type="date"
                                      value={vitalsInput.date}
                                      onChange={(e) =>
                                        setVitalsInput((prev) => ({
                                          ...prev,
                                          date: e.target.value,
                                        }))
                                      }
                                      className="bg-transparent text-[16px] font-black text-[#1D293D] w-full focus:outline-none"
                                    />
                                  </div>
                                  <p className="text-[9px] font-black text-[#8A7BB6] uppercase tracking-widest ml-9.5">
                                    {vitalsInput.date
                                      ? vitalsInput.date
                                          .split("-")
                                          .reverse()
                                          .join("/")
                                      : "--/--/--"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Primary Save Action */}
                          <div className="mt-4">
                            <button
                              onClick={() => handleLogVitals("Sleep")}
                              disabled={vitalsLoading}
                              className="w-full h-16 bg-[#8A7BB6] rounded-full shadow-[0_20px_40px_rgba(138,123,182,0.3)] flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                              {vitalsLoading ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Save className="w-5 h-5 text-white" />
                                  <span className="text-base font-black text-white tracking-tight uppercase">
                                    Save sleep
                                  </span>
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
