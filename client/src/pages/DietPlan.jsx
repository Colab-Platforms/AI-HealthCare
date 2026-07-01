import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import api, {
  nutritionService,
  dietRecommendationService,
} from "../services/api";
import SEO from "../hooks/useSEO";
import {
  Heart,
  Clock,
  ArrowLeft,
  Flame,
  Target,
  AlertCircle,
  Sparkles,
  CheckCircle,
  Lightbulb,
  X,
  UtensilsCrossed,
  Utensils,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  Eye,
  ChefHat,
  ArrowRight,
  Check,
  Zap,
  Info,
  Coffee,
  Sun,
  Activity,
  Mail,
  Plus,
  ArrowUpRight,
  Scale,
} from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import FoodPreferences from "../components/FoodPreferences";
import { ImageWithFallback } from "../components/ImageWithFallback";

// --- UI Components ---
const FoodDetailModal = ({ food, onClose, onLog, isLogged, isLoading }) => {
  if (!food) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-2xl bg-white rounded-[2.5rem] overflow-hidden shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-10 w-10 h-10 rounded-full bg-black/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/20 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
          {/* Top/Left: Image */}
          <div className="w-full md:w-1/2 h-64 md:h-auto relative bg-emerald-50">
            <ImageWithFallback
              src={food.imageUrl}
              query={food.name}
              alt={food.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent md:hidden" />
            <div className="absolute bottom-6 left-6 md:hidden">
              <h2 className="text-2xl font-black text-white">{food.name}</h2>
            </div>
          </div>

          {/* Right: Details */}
          <div className="flex-1 p-6 md:p-10 overflow-y-auto">
            <div className="hidden md:block mb-6">
              <h2 className="text-3xl font-black text-[#064e3b] tracking-tight">
                {food.name}
              </h2>
              <p className="text-emerald-800/40 font-bold uppercase tracking-widest text-xs mt-1">
                Nutrition Protocol
              </p>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-8">
              {[
                {
                  label: "Calories",
                  val: food.calories,
                  unit: "kcal",
                  color: "orange",
                },
                {
                  label: "Protein",
                  val: food.protein,
                  unit: "g",
                  color: "emerald",
                },
                { label: "Carbs", val: food.carbs, unit: "g", color: "blue" },
                { label: "Fats", val: food.fats, unit: "g", color: "amber" },
              ].map((n) => (
                <div
                  key={n.label}
                  className={`p-3 rounded-2xl bg-${n.color}-50/50 border border-${n.color}-100 flex flex-col items-center justify-center`}
                >
                  <span
                    className={`text-[10px] font-black uppercase text-${n.color}-800/40 mb-1`}
                  >
                    {n.label}
                  </span>
                  <span
                    className={`text-sm md:text-lg font-black text-${n.color}-700`}
                  >
                    {n.val || 0}
                  </span>
                  <span
                    className={`text-[8px] font-bold text-${n.color}-600/60 uppercase`}
                  >
                    {n.unit}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-6">
              <section>
                <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-800/40 mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" /> Key
                  Benefits
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed bg-emerald-50/30 p-4 rounded-2xl border border-emerald-50 italic font-medium">
                  {food.benefits ||
                    "Highly nutritious and balanced for your current health profile."}
                </p>
              </section>

              <section>
                <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-800/40 mb-3">
                  <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-500" />{" "}
                  Portion Guidance
                </h4>
                <div className="flex items-center gap-2 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <Info className="w-4 h-4 text-slate-400" />
                  <p className="text-sm font-bold text-slate-700">
                    {food.portionSize || "1 standard serving size"}
                  </p>
                </div>
              </section>

              <section>
                <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-800/40 mb-3">
                  <Lightbulb className="w-3.5 h-3.5 text-emerald-500" />{" "}
                  Instructions
                </h4>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">
                  {food.description ||
                    "Consume as per the recommended time for optimal metabolic absorption and energy levels."}
                </p>
              </section>
            </div>

            <button
              onClick={() => onLog(food)}
              disabled={isLogged || isLoading}
              className={`w-full mt-10 py-5 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl ${
                isLogged
                  ? "bg-emerald-600 text-white shadow-emerald-200"
                  : "bg-black text-white hover:bg-slate-800 shadow-slate-200"
              } ${isLoading ? "opacity-70 cursor-wait" : ""}`}
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : isLogged ? (
                <>
                  <Check className="w-4 h-4" /> Logged as Eaten
                </>
              ) : (
                "Log this Meal"
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- Constants & Helpers ---
const Sunset = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="M12 18v2" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M20 12h2" />
    <path d="m19.07 4.93-1.41 1.41" />
    <path d="M2 18h20" />
    <path d="M16 18a4 4 0 0 0-8 0" />
  </svg>
);

const Moon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

const MEAL_ORDER = ["breakfast", "lunch", "dinner"];
const SECTION_INFO = {
  breakfast: {
    label: "Breakfast",
    time: "08:00 AM",
    emoji: "🍳",
    icon: Coffee,
  },
  lunch: { label: "Lunch", time: "01:30 PM", emoji: "🥗", icon: Utensils },
  dinner: { label: "Dinner", time: "08:30 PM", emoji: "🌙", icon: Moon },
};

function getMealName(m) {
  if (typeof m === "string") return m;
  return m?.name || "Meal Item";
}

function getMealCalories(m) {
  return m?.calories || m?.nutrients?.calories || 0;
}

// --- UI Components ---

const MealSectionCard = ({
  section,
  meals,
  loggedMeals,
  onOpenOptions,
  mealType,
}) => {
  const { label, time } = section;
  const [slideIdx, setSlideIdx] = useState(0);
  const [dir, setDir] = useState(1); // 1 = forward, -1 = backward
  const intervalRef = useRef(null);

  const staggerOffset = { breakfast: 0, lunch: 1200, dinner: 2400, snacks: 3600 };

  const goTo = (idx, direction) => {
    setDir(direction);
    setSlideIdx(idx);
  };

  const next = (e) => {
    e?.stopPropagation();
    const nxt = (slideIdx + 1) % meals.length;
    goTo(nxt, 1);
    resetInterval();
  };

  const prev = (e) => {
    e?.stopPropagation();
    const prv = (slideIdx - 1 + meals.length) % meals.length;
    goTo(prv, -1);
    resetInterval();
  };

  const resetInterval = () => {
    clearInterval(intervalRef.current);
    if (meals.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setDir(1);
      setSlideIdx(p => (p + 1) % meals.length);
    }, 6500);
  };

  useEffect(() => {
    if (meals.length <= 1) return;
    const delay = staggerOffset[mealType] ?? 0;
    const t = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        setDir(1);
        setSlideIdx(p => (p + 1) % meals.length);
      }, 6500);
    }, delay);
    return () => { clearTimeout(t); clearInterval(intervalRef.current); };
  }, [meals.length, mealType]);

  const isAnyLogged = meals.some(m => !!loggedMeals[`${mealType}-${getMealName(m)}`]);
  const currentMeal = meals[slideIdx] || meals[0];
  const currentCalories = getMealCalories(currentMeal) || 0;
  const currentName = getMealName(currentMeal);

  const variants = {
    enter: (d) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <motion.div
      onClick={onOpenOptions}
      className="rounded-[2rem] cursor-pointer overflow-hidden flex flex-col w-full lg:flex-1"
      style={{
        background: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.85)",
        boxShadow: "0 4px 24px rgba(16,185,129,0.07), 0 1px 0 rgba(255,255,255,0.9) inset",
      }}
    >
      {/* Image slider */}
      <div className="relative w-full overflow-hidden aspect-[4/3] lg:aspect-auto lg:h-[260px]">

        {/* Sliding image */}
        <AnimatePresence initial={false} custom={dir} mode="sync">
          <motion.div
            key={slideIdx}
            custom={dir}
            variants={{
              enter: (d) => ({ x: d > 0 ? "100%" : "-100%", opacity: 1 }),
              center: { x: 0, opacity: 1 },
              exit: (d) => ({ x: d > 0 ? "-100%" : "100%", opacity: 1 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-0"
          >
            <ImageWithFallback
              src={currentMeal?.imageUrl}
              query={currentName}
              className="w-full h-full object-cover"
            />
          </motion.div>
        </AnimatePresence>

        {/* Dark gradient at bottom for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

        {/* Meal name (left) + Calories (right) — animated with slide */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 flex items-stretch justify-between pointer-events-none overflow-hidden gap-2">
          <AnimatePresence initial={false} custom={dir} mode="wait">
            <motion.div
              key={`name-${slideIdx}`}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 1.0, ease: [0.4, 0, 0.2, 1] }}
              className="min-w-0 flex-1"
            >
              <div className="flex flex-col justify-center px-3 py-2 rounded-xl"
                style={{
                  background: "rgba(0,0,0,0.45)",
                  backdropFilter: "blur(14px) saturate(180%)",
                  WebkitBackdropFilter: "blur(14px) saturate(180%)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  maxWidth: "220px",
                  minHeight: "54px",
                }}>
                <p className="text-[9px] font-black text-white/60 uppercase tracking-widest leading-none mb-1">
                  Day {slideIdx + 1} of {meals.length}
                </p>
                <p className="text-[13px] font-black text-white leading-tight line-clamp-2">
                  {currentName}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence initial={false} custom={-dir} mode="wait">
            <motion.div
              key={`cal-${slideIdx}`}
              custom={-dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 1.0, ease: [0.4, 0, 0.2, 1] }}
              className="flex-shrink-0"
            >
              <div className="flex flex-col items-end justify-center px-3 py-2 rounded-xl"
                style={{
                  background: "rgba(0,0,0,0.45)",
                  backdropFilter: "blur(14px) saturate(180%)",
                  WebkitBackdropFilter: "blur(14px) saturate(180%)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  minHeight: "54px",
                }}>
                <p className="text-[9px] font-black text-white/60 uppercase tracking-widest leading-none mb-1">Calories</p>
                <p className="text-[15px] font-black text-orange-400 leading-tight">
                  {currentCalories} <span className="text-[10px] font-bold text-white/50">kcal</span>
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Manual prev/next tap zones */}
        {meals.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-0 top-0 bottom-8 w-1/3 z-10 flex items-center justify-start pl-2 opacity-100 lg:opacity-0 lg:hover:opacity-100 transition-opacity"
            >
              <div className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <ChevronLeft className="w-4 h-4 text-white" />
              </div>
            </button>
            <button
              onClick={next}
              className="absolute right-0 top-0 bottom-8 w-1/3 z-10 flex items-center justify-end pr-2 opacity-100 lg:opacity-0 lg:hover:opacity-100 transition-opacity"
            >
              <div className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <ChevronRight className="w-4 h-4 text-white" />
              </div>
            </button>
          </>
        )}

        {/* Logged badge */}
        {isAnyLogged && (
          <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-md z-10">
            <Check className="w-3.5 h-3.5 text-white" />
          </div>
        )}

        {/* Dots */}
        {meals.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 pointer-events-none z-10">
            {meals.map((_, i) => (
              <div key={i} className={`rounded-full transition-all duration-300 ${
                i === slideIdx ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40"
              }`} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom info bar */}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-black text-[#0d2b22] leading-tight truncate" style={{ letterSpacing: "-0.4px" }}>
            {label}
          </h3>
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3 text-emerald-500 shrink-0" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{time}</span>
          </div>
        </div>

        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 ${
          isAnyLogged ? "bg-emerald-500" : "bg-emerald-600"
        }`}>
          {isAnyLogged
            ? <Check className="w-4 h-4 text-white" />
            : <ArrowUpRight className="w-4 h-4 text-white" />
          }
        </div>
      </div>
    </motion.div>
  );
};

const MealOptionsModal = ({
  label,
  meals,
  loggedMeals,
  mealType,
  onClose,
  onLog,
  loggingMealId,
}) => {
  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-md"
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 30 }}
        className="relative w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        style={{
          background: "rgba(242,247,242,0.97)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.9)",
        }}
      >
        <div className="p-8 pb-4 flex items-center justify-between">
          <h2 className="text-2xl font-black text-[#1a2e35] tracking-tight">
            {label} Options
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-slate-400 hover:text-black transition-all border border-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 pt-2 overflow-y-auto space-y-5 scrollbar-hide">
          {meals.map((meal, idx) => {
            const name = getMealName(meal);
            const isLogged = !!loggedMeals[`${mealType}-${name}`];
            const isLoading = loggingMealId === `${mealType}-${name}`;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => {
                  setSelectedFood(meal);
                  setSelectedFoodType(mealType);
                }}
                className="rounded-[2rem] p-4 flex flex-col gap-4 cursor-pointer transition-all"
                style={{
                  background: "rgba(255,255,255,0.75)",
                  backdropFilter: "blur(16px) saturate(180%)",
                  WebkitBackdropFilter: "blur(16px) saturate(180%)",
                  border: "1px solid rgba(255,255,255,0.9)",
                  boxShadow: "0 2px 12px rgba(16,185,129,0.05)",
                }}
              >
                <div className="flex gap-5">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden shrink-0 bg-slate-50 shadow-inner">
                    <ImageWithFallback
                      src={meal.imageUrl}
                      query={name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 py-1">
                    <h3 className="text-base md:text-lg font-bold text-[#1a2e35] mb-2 leading-tight">
                      {name}
                    </h3>
                    <div className="flex flex-col gap-2 mt-auto">
                      <div className="flex items-start gap-1.5 w-fit max-w-full">
                        <Scale
                          className="w-3.5 h-3.5 text-[#69A38D] mt-0.5 shrink-0"
                          strokeWidth={2.5}
                        />
                        <span className="text-[10px] md:text-sm font-black uppercase tracking-tight text-[#69A38D] leading-tight break-words">
                          {meal.portionSize || "1 Serving"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Flame
                          className="w-3.5 h-3.5 text-orange-400 shrink-0"
                          strokeWidth={2.5}
                        />
                        <span className="text-[10px] md:text-sm font-black uppercase tracking-tight text-slate-400">
                          {getMealCalories(meal)} Kcal
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLog(meal, mealType);
                  }}
                  disabled={isLogged || isLoading}
                  className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.1em] transition-all ${
                    isLogged
                      ? "bg-emerald-600 text-white shadow-emerald-100"
                      : "bg-[#719685] text-white hover:bg-[#5f8171] shadow-lg shadow-[#719685]/10"
                  } ${isLoading ? "opacity-70 cursor-wait" : ""}`}
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : isLogged ? (
                    <>
                      <Check className="w-4 h-4" /> Logged as Eaten
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" /> Log Meal
                    </>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default function DietPlan() {
  const { user } = useAuth();
  const {
    invalidateCache,
    fetchDietPlan,
    setDietPlan,
    fetchNutritionLogs,
    fetchHealthGoals,
    addPendingDietPlan,
    pendingDietPlanIds,
    healthGoals,
    dietPlan,
    dataRefreshTrigger,
  } = useData();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [showPreferences, setShowPreferences] = useState(false);
  const [showRegenOptions, setShowRegenOptions] = useState(false);
  const [prefMode, setPrefMode] = useState("save");
  const [loggedMeals, setLoggedMeals] = useState({});
  const [loggingMealId, setLoggingMealId] = useState(null);
  const [selectedFood, setSelectedFood] = useState(null);
  const [selectedFoodType, setSelectedFoodType] = useState(null);
  const [activeMealSection, setActiveMealSection] = useState(null);

  const rowRefs = useRef({});
  const insightsRef = useRef(null);

  useEffect(() => {
    loadInitialData();
  }, [dataRefreshTrigger]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (
      params.get("autoGenerate") === "true" &&
      !generating &&
      !location.state?.generated
    ) {
      const timer = setTimeout(() => {
        generatePlan(true); // Auto-generate/update plan
        // Clear param to prevent loop
        navigate("/diet-plan", { replace: true, state: { generated: true } });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [location]);

  const loadInitialData = async () => {
    try {
      // Check for cached plan first
      const cachedPlan = await fetchDietPlan();
      if (!cachedPlan) {
        setLoading(true);
      }

      const today = new Date().toISOString().split("T")[0];
      const [plan, logs, historyRes] = await Promise.all([
        fetchDietPlan(),
        fetchNutritionLogs(today),
        dietRecommendationService.getDietPlanHistory(),
        fetchHealthGoals(),
      ]);

      if (historyRes.data.success) setHistory(historyRes.data.history);

      const loggedMap = {};
      (logs || []).forEach((log) => {
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
      toast.error(
        "Please set your fitness goal first to generate a personalized diet plan.",
      );
      navigate("/profile?tab=goals");
      return;
    }

    setGenerating(true);
    try {
      const { data } = await dietRecommendationService.generateDietPlan({
        isRegenerate,
        usePreferences,
      });
      if (data.success) {
        if (data.backgroundProcessing) {
          toast.success("AI generation started in background");
          addPendingDietPlan(data.dietPlan._id);
          // fetchDietPlan will update the global state
          await fetchDietPlan(true);
        } else {
          toast.success(isRegenerate ? "Plan updated!" : "New plan ready!");
          invalidateCache(["diet_plan", "dashboard"]);
          loadInitialData();
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update plan");
    } finally {
      setGenerating(false);
    }
  };

  const loadSelectedPlan = async (planId) => {
    try {
      setLoading(true);
      const { data } = await dietRecommendationService.getDietPlanById(planId);
      if (data.success) {
        setDietPlan(data.dietPlan);
        setShowHistory(false);
        toast.success("Loaded past plan");
      }
    } catch (err) {
      console.error("Error loading selected plan:", err);
      toast.error("Failed to load selected plan");
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
      const analyzeToastId = toast.loading("Analyzing nutrition profile...", {
        duration: 4000,
      });

      // 1. Analyze the food to get rich data (AI or Cache)
      const { data: analysisRes } = await api.post("nutrition/analyze-food", {
        foodDescription: mealName,
      });

      if (!analysisRes.success) throw new Error("Analysis failed");
      const data = analysisRes.analysis;

      // 2. Log with rich data
      // 2. Log with data from diet plan PREFERRED (for calorie goal consistency)
      // but enrich with AI analysis findings (benefits, alternatives)
      const todayStr = new Date().toISOString().split("T")[0];
      const res = await nutritionService.logMeal({
        mealType: type,
        foodItems: [
          {
            name: mealName,
            quantity:
              meal.portionSize || data.foodItem?.quantity || "1 serving",
            nutrition: {
              calories:
                meal.calories || data.foodItem?.nutrition?.calories || 200,
              protein: meal.protein || data.foodItem?.nutrition?.protein || 10,
              carbs: meal.carbs || data.foodItem?.nutrition?.carbs || 30,
              fats: meal.fats || data.foodItem?.nutrition?.fats || 5,
            },
          },
        ],
        healthScore: data.healthScore || data.foodItem?.healthScore || 80,
        healthScore10: data.healthScore10 || data.foodItem?.healthScore10 || 8,
        micronutrients:
          data.micronutrients || data.foodItem?.micronutrients || [],
        enhancementTips:
          data.enhancementTips || data.foodItem?.enhancementTips || [],
        healthBenefitsSummary:
          meal.benefits ||
          data.healthBenefitsSummary ||
          data.foodItem?.healthBenefitsSummary ||
          "",
        warnings: data.warnings || data.foodItem?.warnings || [],
        alternatives: data.alternatives || data.foodItem?.alternatives || [],
        source: "meal_plan",
        date: todayStr,
      });

      toast.dismiss(analyzeToastId);
      toast.success("Meal logged! Keep it up 🚀");
      
      // Handle Gamification update
      if (res.data?.gamification?.status === 'success' && res.data.gamification.pointsAwarded > 0) {
        setTimeout(() => {
          toast.success(`🎯 +${res.data.gamification.pointsAwarded} Points earned for logging a meal!`, {
            icon: '✨',
            style: {
              borderRadius: '16px',
              background: '#10b981',
              color: '#fff',
              fontWeight: 'bold',
            },
            duration: 4000,
          });
          window.dispatchEvent(new Event('gamificationUpdate'));
        }, 500);
      }

      setLoggedMeals((prev) => ({ ...prev, [mealId]: true }));
      invalidateCache([
        "dashboard",
        `logs_${todayStr}`,
        `nutrition_${todayStr}`,
      ]);
      loadInitialData(); // Refresh UI
    } catch (err) {
      console.error("Log meal error:", err);
      toast.error("Failed to log meal");
    } finally {
      setLoggingMealId(null);
    }
  };

  // Use context's dietPlan status
  const isCurrentlyGenerating =
    generating ||
    dietPlan?.status === "generating" ||
    pendingDietPlanIds?.length > 0;
  const showCraftingScreen = loading || isCurrentlyGenerating;

  if (showCraftingScreen) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDFDFD] px-6">
        <div className="relative w-32 h-32 mb-10 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent"
          />
          <div className="relative w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center shadow-inner">
            <ChefHat className="w-10 h-10 text-emerald-600 animate-pulse" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center animate-bounce">
            <Sparkles className="w-4 h-4 text-emerald-500" />
          </div>
        </div>

        <div className="max-w-md w-full text-center space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Crafting Your Protocol
            </h2>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em]">
              AI Generation in Progress
            </p>
          </div>

          <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-[2rem] shadow-sm">
            <p className="text-emerald-800 text-sm font-bold leading-relaxed mb-4 italic">
              "We're analyzing your latest medical reports, BMI, and nutritional
              goals to create a scientifically optimized diet plan just for
              you."
            </p>
            <div className="flex flex-col items-center gap-4">
              <div className="w-full bg-emerald-100/50 h-3 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: "10%" }}
                  animate={{ width: "95%" }}
                  transition={{ duration: 60, ease: "linear" }}
                  className="bg-emerald-500 h-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                />
              </div>
              <div className="flex items-center gap-2 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                <Clock className="w-4 h-4 animate-spin" />
                Estimated time: 1-2 minutes
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-100 p-5 rounded-[2rem] shadow-xl">
            <p className="text-slate-500 text-xs font-medium leading-relaxed mb-4">
              While our AI works, feel free to explore other areas of the
              platform. We'll send you an email and a notification the moment
              it's ready!
            </p>
            <div className="flex gap-2">
              <Link
                to="/dashboard"
                className="flex-1 py-4 bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
              >
                Platform Tour
              </Link>
              <Link
                to="/nutrition"
                className="flex-1 py-4 bg-slate-100 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Food Tracker
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-slate-300">
            <Mail className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest leading-none mt-0.5">
              Notification will be sent to your inbox
            </span>
          </div>
        </div>
      </div>
    );
  }

  // --- Prioritize Profile Goals for Overview ---
  const dailyGoals = {
    calories:
      user?.nutritionGoal?.calorieGoal ||
      healthGoals?.dailyCalorieTarget ||
      dietPlan?.nutritionGoals?.dailyCalorieTarget ||
      2100,
    protein:
      user?.nutritionGoal?.proteinGoal ||
      healthGoals?.macroTargets?.protein ||
      dietPlan?.nutritionGoals?.macroTargets?.protein ||
      150,
    carbs:
      user?.nutritionGoal?.carbsGoal ||
      healthGoals?.macroTargets?.carbs ||
      dietPlan?.nutritionGoals?.macroTargets?.carbs ||
      200,
    fats:
      user?.nutritionGoal?.fatGoal ||
      healthGoals?.macroTargets?.fats ||
      healthGoals?.macroTargets?.fat ||
      dietPlan?.nutritionGoals?.macroTargets?.fat ||
      65,
  };

  return (
    <div className="min-h-screen pb-32 px-4 md:px-6 lg:px-12 pt-2 md:pt-8 relative" style={{ background: "#F2F7F2" }}>
      <SEO pageName="dietPlan" />
      {/* Background elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-100/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Header - Simplified for Global Sticky Header */}
      <div className="relative z-10 flex items-center gap-2 overflow-x-auto scrollbar-hide mb-8 mt-0 md:mt-4">
        <div className="hidden md:flex items-center gap-1.5 bg-white/60 backdrop-blur-md px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-white/60 shadow-sm shrink-0">
          <Calendar className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-800/40" />
          <span className="text-xs md:text-sm font-medium text-emerald-800/60 whitespace-nowrap">
            {new Date().toLocaleDateString("en-US", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>
        <button
          onClick={() => setShowHistory(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 md:px-6 md:py-2 rounded-full text-[10px] md:text-sm font-black text-[#064e3b] transition-all shrink-0 uppercase tracking-tighter"
          style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
        >
          <Clock className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-800/40" />{" "}
          History
        </button>
        <button
          onClick={() => {
            setPrefMode("save");
            setShowPreferences(true);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 md:px-6 md:py-2 rounded-full text-[10px] md:text-sm font-black text-[#064e3b] transition-all shrink-0 uppercase tracking-tighter"
          style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
        >
          <Filter className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-800/40" />{" "}
          Preference
        </button>
        <button
          onClick={() => setShowRegenOptions(true)}
          disabled={generating}
          className="flex items-center gap-1.5 px-3 py-1.5 md:px-6 md:py-2 bg-[#064e3b] text-emerald-50 rounded-full text-[10px] md:text-sm font-bold md:font-medium hover:bg-[#042f2e] transition-all shadow-lg border border-emerald-900/10 active:scale-95 disabled:opacity-50 shrink-0 uppercase tracking-tighter"
        >
          <RefreshCw
            className={`w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-400 ${generating ? "animate-spin" : ""}`}
          />
          {generating ? "Regenerating..." : "Regen Plan"}
        </button>
        {user?.profile?.isDiabetic === "yes" && (
          <button
            onClick={() => navigate("/nutrition")}
            className="flex items-center gap-1.5 px-3 py-1.5 md:px-6 md:py-2 bg-rose-50/80 text-rose-600 rounded-full text-[10px] md:text-sm font-black border border-rose-200 shadow-sm shrink-0 uppercase tracking-tighter"
          >
            <Activity className="w-3 h-3 md:w-3.5 md:h-3.5 opacity-70" />{" "}
            Nutrition
          </button>
        )}
      </div>

      {!dietPlan ? (
        <div className="rounded-[3rem] p-12 text-center max-w-2xl mx-auto mt-20" style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)", border: "1px solid rgba(255,255,255,0.85)", boxShadow: "0 4px 24px rgba(16,185,129,0.06)" }}>
          <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-white shadow-inner">
            <ChefHat className="w-10 h-10 text-slate-400" />
          </div>
          <h2 className="text-3xl font-light text-slate-800 mb-4 tracking-tight">
            Personalized Nutrition Engine
          </h2>
          <p className="text-slate-500 mb-10 leading-relaxed text-lg">
            Our AI will analyze your{" "}
            <span className="font-bold text-slate-800">Health Reports</span>,
            <span className="font-bold text-slate-800"> Fitness Goals</span>,
            and <span className="font-bold text-slate-800">BMI</span>
            to curate a clinical-grade diet plan just for you.
          </p>
          <button
            onClick={() => generatePlan(false)}
            disabled={generating}
            className="bg-black text-white px-10 py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl hover:bg-slate-800 transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-3 mx-auto"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            {generating
              ? "Synthesizing Data..."
              : "Generate My Personalized Plan"}
          </button>
        </div>
      ) : (
        <div className="space-y-8 md:space-y-24">
          <div className="mt-8 space-y-6 md:space-y-10">
            <h2 className="text-2xl md:text-3xl font-black text-[#1a2e35] px-2 mb-2 tracking-tight">
              Today's Plan
            </h2>
            {/* Mobile: vertical stack | Desktop: horizontal full-width row */}
            <div className="flex flex-col gap-4 lg:flex-row lg:gap-5">
              {MEAL_ORDER.map((sectionId) => {
                const section = SECTION_INFO[sectionId];
                const meals = dietPlan.mealPlan?.[sectionId] || [];
                if (meals.length === 0) return null;

                return (
                  <MealSectionCard
                    key={sectionId}
                    section={section}
                    meals={meals}
                    mealType={sectionId}
                    loggedMeals={loggedMeals}
                    onOpenOptions={() => setActiveMealSection(sectionId)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Meal Options Modal */}
      <AnimatePresence>
        {activeMealSection && (
          <MealOptionsModal
            label={SECTION_INFO[activeMealSection].label}
            meals={dietPlan.mealPlan?.[activeMealSection] || []}
            mealType={activeMealSection}
            loggedMeals={loggedMeals}
            onClose={() => setActiveMealSection(null)}
            onLog={handleLogMeal}
            loggingMealId={loggingMealId}
          />
        )}
      </AnimatePresence>

      {showPreferences && (
        <FoodPreferences
          onClose={() => setShowPreferences(false)}
          mode={prefMode}
          onGenerate={
            prefMode === "regenerate" ? () => generatePlan(true) : null
          }
        />
      )}

      {/* Regeneration Options Modal */}
      <AnimatePresence>
        {showRegenOptions && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[120] flex items-center justify-center p-4"
            onClick={() => setShowRegenOptions(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full border border-slate-100"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800">
                  Regenerate Plan
                </h3>
                <button
                  onClick={() => setShowRegenOptions(false)}
                  className="text-slate-400 hover:text-black"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setShowRegenOptions(false);
                    generatePlan(false);
                  }}
                  className="w-full flex flex-col items-start p-5 rounded-[2rem] border border-slate-100 hover:bg-emerald-50/50 hover:border-emerald-200 transition-all text-left group"
                >
                  <span className="text-sm font-bold text-[#1a2e35] flex items-center gap-2 group-hover:text-[#69A38D]">
                    <Sparkles className="w-4 h-4 text-[#69A38D]" /> Different
                    Food
                  </span>
                  <span className="text-xs text-slate-500 mt-2 font-medium">
                    Generate completely new variety of healthy Indian meals
                  </span>
                </button>

                <button
                  onClick={() => {
                    setShowRegenOptions(false);
                    setPrefMode("regenerate");
                    setShowPreferences(true);
                  }}
                  className="w-full flex flex-col items-start p-5 rounded-[2rem] border border-slate-100 hover:bg-emerald-50/50 hover:border-emerald-200 transition-all text-left group"
                >
                  <span className="text-sm font-bold text-[#1a2e35] flex items-center gap-2 group-hover:text-[#69A38D]">
                    <Utensils className="w-4 h-4 text-[#69A38D]" /> Based on
                    Preferred Food
                  </span>
                  <span className="text-xs text-slate-500 mt-2 font-medium">
                    Update your favorites first, then generate a tailored plan
                  </span>
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
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                    Plan History
                  </h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                    Previous generations
                  </p>
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-black transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4 scrollbar-hide bg-[#F8F9F5]/30">
                {history.length > 0 ? (
                  history.map((plan) => (
                    <button
                      key={plan._id}
                      onClick={() => loadSelectedPlan(plan._id)}
                      className={`w-full p-6 rounded-[2rem] border text-left transition-all flex items-center justify-between group shadow-sm ${dietPlan?._id === plan._id ? "bg-[#69A38D] border-[#69A38D] shadow-emerald-200/50 ring-4 ring-emerald-500/10" : "bg-white border-slate-100 hover:border-emerald-100 hover:bg-emerald-50/20"}`}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${dietPlan?._id === plan._id ? "bg-white/20 text-white border border-white/20" : "bg-white text-slate-800 border border-slate-100"}`}
                          >
                            {plan.inputData?.bmiGoal?.replace("_", " ") ||
                              plan.fitnessGoal ||
                              "General Health"}
                          </div>
                          {dietPlan?._id === plan._id && (
                            <div className="flex items-center gap-1.5 text-white/90 text-[9px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-md">
                              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              Active Now
                            </div>
                          )}
                        </div>
                        <p
                          className={`text-base font-black ${dietPlan?._id === plan._id ? "text-white" : "text-[#1a2e35]"}`}
                        >
                          {new Date(
                            plan.generatedAt || plan.createdAt,
                          ).toLocaleDateString("en-US", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        <p
                          className={`text-[10px] font-bold mt-1 ${dietPlan?._id === plan._id ? "text-slate-400" : "text-slate-400"}`}
                        >
                          {plan.nutritionGoals?.dailyCalorieTarget} kcal •{" "}
                          {plan.foodType || "Balanced"}
                        </p>
                      </div>
                      <ChevronRight
                        className={`w-5 h-5 transition-transform group-hover:translate-x-1 ${dietPlan?._id === plan._id ? "text-white" : "text-slate-300"}`}
                      />
                    </button>
                  ))
                ) : (
                  <div className="py-20 text-center">
                    <Clock className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                    <p className="text-sm font-bold text-slate-400">
                      No past plans found
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Food Detail Modal */}
      <AnimatePresence>
        {selectedFood && (
          <FoodDetailModal
            food={selectedFood}
            mealType={selectedFoodType}
            onClose={() => {
              setSelectedFood(null);
              setSelectedFoodType(null);
            }}
            onLog={(food) => {
              handleLogMeal(food, selectedFoodType);
            }}
            isLogged={
              !!loggedMeals[`${selectedFoodType}-${getMealName(selectedFood)}`]
            }
            isLoading={
              loggingMealId ===
              `${selectedFoodType}-${getMealName(selectedFood)}`
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
}
