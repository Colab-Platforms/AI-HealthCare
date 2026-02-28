import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import api from "../services/api";
import toast from "react-hot-toast";
import {
  Loader2,
  Plus,
  Trash2,
  X,
  Droplets,
  Flame,
  Edit2,
  Check,
  Bell,
  Zap,
  Activity,
  Brain,
  Sparkles,
  CheckCircle,
  Utensils,
  Info,
  ShieldCheck,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Calendar,
  ChevronLeft,
  BarChart3,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";

export default function NutritionRevamped() {
  const { user } = useAuth();
  const { invalidateCache } = useData();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [todayLogs, setTodayLogs] = useState([]);
  const [dailySummary, setDailySummary] = useState(null);
  const [healthGoal, setHealthGoal] = useState(null);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState("");
  const [waterIntake, setWaterIntake] = useState(0);
  const [editingMeal, setEditingMeal] = useState(null);

  // Add meal form state
  const [foodName, setFoodName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [nutritionData, setNutritionData] = useState(null);
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fats, setFats] = useState("");
  const [fullAnalysis, setFullAnalysis] = useState(null);

  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [prepMethod, setPrepMethod] = useState("");

  // Smart quantity suggestions based on food type
  const getQuantitySuggestions = (food) => {
    const f = food.toLowerCase();
    if (f.includes("roti") || f.includes("naan") || f.includes("paratha"))
      return ["1 pc", "2 pcs", "3 pcs", "4 pcs"];
    if (f.includes("rice") || f.includes("biryani") || f.includes("khichdi"))
      return ["1 bowl", "1 plate", "1 cup", "2 cups"];
    if (f.includes("samosa") || f.includes("pakora") || f.includes("momos"))
      return ["1 pc", "2 pcs", "3 pcs", "5 pcs"];
    if (f.includes("idli") || f.includes("dosa") || f.includes("vada"))
      return ["1 pc", "2 pcs", "3 pcs", "1 plate"];
    if (f.includes("pizza") || f.includes("burger"))
      return ["1 slice", "2 slices", "1 whole", "1 med"];
    if (f.includes("chicken") || f.includes("paneer") || f.includes("tikka"))
      return ["1 bowl", "1 plate", "150g", "200g"];
    return ["1 bowl", "1 plate", "1 piece", "100g", "150g"];
  };

  const [quantitySuggestions, setQuantitySuggestions] = useState([]);

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [trends, setTrends] = useState([]);
  const [showTrends, setShowTrends] = useState(false);
  const [activeTrend, setActiveTrend] = useState("calories"); // 'calories', 'protein', 'carbs', 'fats'
  const chartRef = useRef(null);

  useEffect(() => {
    fetchData(selectedDate);
    if (showTrends) fetchTrends();
  }, [selectedDate, showTrends]);

  // Scroll to chart when it opens
  useEffect(() => {
    if (showTrends && chartRef.current) {
      setTimeout(() => {
        chartRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [showTrends]);

  const fetchTrends = async (date) => {
    try {
      const targetDate = date || selectedDate;
      const response = await api.get(
        `/nutrition/activity/week?date=${targetDate}`
      );
      if (response.data.success) {
        setTrends(response.data.weekData);
      }
    } catch (error) {
      console.error("Failed to fetch trends:", error);
    }
  };

  const fetchData = async (date) => {
    setLoading(true);
    const targetDate = date || new Date().toISOString().split("T")[0];

    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch logs and summary for the specific date
      const [logsRes, summaryRes, goalRes] = await Promise.all([
        api.get(`/nutrition/logs?date=${targetDate}`),
        api.get(`/nutrition/summary/daily?date=${targetDate}`),
        api.get("/nutrition/goals")
          .catch(() => ({ data: { healthGoal: null } })),
      ]);

      setTodayLogs(logsRes.data.foodLogs || []);
      setDailySummary(summaryRes.data.summary);
      setHealthGoal(goalRes.data.healthGoal);

      // Load water intake from localStorage
      const savedWater = localStorage.getItem(`waterIntake_${targetDate}`);
      setWaterIntake(savedWater ? parseInt(savedWater) : 0);

      setIsInitialLoad(false);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("Failed to load nutrition data");
      setIsInitialLoad(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (days) => {
    const today = new Date().toISOString().split("T")[0];
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    const newDateStr = date.toISOString().split("T")[0];

    // Don't allow future dates
    if (newDateStr > today) {
      toast.error("Can't view future data!");
      return;
    }

    setSelectedDate(newDateStr);
  };

  const handleAddWater = () => {
    const newWater = waterIntake + 1;
    setWaterIntake(newWater);
    localStorage.setItem(`waterIntake_${selectedDate}`, newWater);
    toast.success("Water added! 💧");
  };

  const openAddMeal = (mealType) => {
    if (!healthGoal) {
      toast.error("Please set your fitness goal first");
      navigate("/profile?tab=goals");
      return;
    }
    setSelectedMealType(mealType);
    setShowAddMeal(true);
    setEditingMeal(null);
    setFoodName("");
    setQuantity("");
    setAnalyzing(false);
    setNutritionData(null);
    setCalories("");
    setProtein("");
    setCarbs("");
    setFats("");
    setFullAnalysis(null);
  };

  const openEditMeal = (meal) => {
    setEditingMeal(meal);
    setSelectedMealType(meal.mealType);
    setFoodName(meal.foodItems?.[0]?.name || "");
    setQuantity("");
    setNutritionData({
      calories: meal.totalNutrition?.calories || 0,
      protein: meal.totalNutrition?.protein || 0,
      carbs: meal.totalNutrition?.carbs || 0,
      fats: meal.totalNutrition?.fats || 0,
    });
    setCalories(meal.totalNutrition?.calories?.toString() || "");
    setProtein(meal.totalNutrition?.protein?.toString() || "");
    setCarbs(meal.totalNutrition?.carbs?.toString() || "");
    setFats(meal.totalNutrition?.fats?.toString() || "");

    // Load rich analysis data
    setFullAnalysis({
      healthScore: meal.healthScore,
      healthScore10: meal.healthScore10,
      micronutrients: meal.micronutrients || [],
      enhancementTips: meal.enhancementTips || [],
      healthBenefitsSummary: meal.healthBenefitsSummary,
    });

    setShowAddMeal(true);
  };

  const analyzeFood = async () => {
    if (!foodName.trim() || !quantity.trim()) {
      toast.error("Please enter food name and quantity");
      return;
    }

    setAnalyzing(true);
    try {
      const response = await api.post(
        "/nutrition/quick-check",
        { foodDescription: `${quantity} ${foodName} ${prepMethod}` }
      );

      if (response.data.success && response.data.data?.foodItem) {
        const nutrition = response.data.data.foodItem.nutrition;
        setFullAnalysis(response.data.data);
        setNutritionData(nutrition);
        setCalories(nutrition.calories?.toString() || "0");
        setProtein(nutrition.protein?.toString() || "0");
        setCarbs(nutrition.carbs?.toString() || "0");
        setFats(nutrition.fats?.toString() || "0");
        toast.success("Food analyzed! ✨");
      } else {
        toast.error("Could not analyze food");
      }
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Failed to analyze food");
    } finally {
      setAnalyzing(false);
    }
  };

  const logMeal = async () => {
    if (!foodName.trim() || !nutritionData) {
      toast.error("Please analyze food first");
      return;
    }

    try {
      const token = localStorage.getItem("token");

      if (editingMeal) {
        // Update existing meal
        await api.put(
          `/nutrition/logs/${editingMeal._id}`,
          {
            foodItems: [
              {
                name: `${quantity} ${foodName}`,
                nutrition: {
                  calories: parseFloat(calories) || 0,
                  protein: parseFloat(protein) || 0,
                  carbs: parseFloat(carbs) || 0,
                  fats: parseFloat(fats) || 0,
                },
              },
            ],
          }
        );
        toast.success("Meal updated!");
      } else {
        // Add new meal
        await api.post(
          "/nutrition/log-meal",
          {
            mealType: selectedMealType,
            foodItems: [
              {
                name: `${quantity} ${foodName}`,
                nutrition: {
                  calories: parseFloat(calories) || 0,
                  protein: parseFloat(protein) || 0,
                  carbs: parseFloat(carbs) || 0,
                  fats: parseFloat(fats) || 0,
                },
              },
            ],
            healthScore: fullAnalysis?.healthScore,
            healthScore10: fullAnalysis?.healthScore10,
            micronutrients: fullAnalysis?.micronutrients,
            enhancementTips: fullAnalysis?.enhancementTips,
            healthBenefitsSummary: fullAnalysis?.healthBenefitsSummary,
            timestamp: selectedDate, // Log to the specific selected date
          }
        );
        toast.success("Meal logged!");
      }

      setShowAddMeal(false);
      invalidateCache(["dashboard"]);
      fetchData(selectedDate);
    } catch (error) {
      console.error("Log meal error:", error);
      toast.error("Failed to log meal");
    }
  };

  const deleteMeal = async (id) => {
    if (!confirm("Delete this meal?")) return;

    try {
      const response = await api.delete(`/nutrition/logs/${id}`);

      toast.success("Meal deleted");
      invalidateCache(["dashboard"]);
      fetchData();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete meal");
    }
  };

  const getMealIcon = (type) => {
    const icons = {
      breakfast: "☕",
      lunch: "☀️",
      snack: "🍎",
      dinner: "🌙",
    };
    return icons[type] || "🍽️";
  };

  const getMealColor = (type) => {
    const colors = {
      breakfast: "from-purple-400 to-orange-500",
      lunch: "from-purple-400 to-orange-500",
      snack: "from-purple-400 to-orange-500",
      dinner: "from-purple-400 to-orange-500",
    };
    return colors[type] || "from-gray-400 to-gray-500";
  };

  if (isInitialLoad && loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  const caloriesRemaining =
    (healthGoal?.dailyCalorieTarget || 2000) -
    (dailySummary?.totalCalories || 0);
  const caloriesConsumed = dailySummary?.totalCalories || 0;
  const caloriesGoal = healthGoal?.dailyCalorieTarget || 2000;
  const caloriesPercentage = Math.min(
    (caloriesConsumed / caloriesGoal) * 100,
    100,
  );

  const proteinConsumed = dailySummary?.totalProtein || 0;
  const proteinGoal = healthGoal?.macroTargets?.protein || 150;
  const proteinPercentage = Math.min(
    (proteinConsumed / proteinGoal) * 100,
    100,
  );

  const carbsConsumed = dailySummary?.totalCarbs || 0;
  const carbsGoal = healthGoal?.macroTargets?.carbs || 250;
  const carbsPercentage = Math.min((carbsConsumed / carbsGoal) * 100, 100);

  const fatsConsumed = dailySummary?.totalFats || 0;
  const fatsGoal = healthGoal?.macroTargets?.fats || 80;
  const fatsPercentage = Math.min((fatsConsumed / fatsGoal) * 100, 100);

  const waterGoal = 8;

  return (
    <div className="w-full min-h-screen pb-24 bg-white">
      {/* Main Content Container - Expanded for desktop layout */}
      <div className="w-full max-w-7xl mx-auto px-4 py-6">
        {/* Compact Date Picker - No Card, Just Controls */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => handleDateChange(-1)}
              className="w-10 h-10 flex-shrink-0 hover:bg-slate-100 rounded-xl transition-all active:scale-90 flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>

            <div className="flex-1 flex items-center justify-center gap-2">
              {[-3, -2, -1, 0, 1, 2, 3].map((offset) => {
                const date = new Date();
                date.setDate(date.getDate() + offset);
                const dateStr = date.toISOString().split("T")[0];
                const isSelected = selectedDate === dateStr;
                const isToday = dateStr === new Date().toISOString().split("T")[0];

                return (
                  <button
                    key={offset}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`relative flex flex-col items-center justify-center px-3 py-2.5 rounded-xl transition-all ${isSelected
                      ? "bg-slate-900 text-white shadow-lg scale-105"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-600"
                      }`}
                  >
                    {isToday && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full"></div>
                    )}
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${isSelected ? "text-white/70" : "text-slate-400"
                      }`}>
                      {date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3)}
                    </span>
                    <span className="text-lg font-black mt-0.5">
                      {date.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative flex-shrink-0">
              <input
                type="date"
                max={new Date().toISOString().split("T")[0]}
                value={selectedDate}
                onChange={(e) => {
                  const val = e.target.value;
                  const today = new Date().toISOString().split("T")[0];
                  if (val > today) {
                    toast.error("Future dates not allowed");
                    return;
                  }
                  setSelectedDate(val);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
            </div>

            <button
              onClick={() => handleDateChange(1)}
              className="w-10 h-10 flex-shrink-0 hover:bg-slate-100 rounded-xl transition-all active:scale-90 flex items-center justify-center"
            >
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Column: Meals */}
          <div className="flex-1 space-y-6 order-2 lg:order-1">

            {/* Trends & Insights Section - Replaces Calories Card */}
            {showTrends && trends.length > 0 && (
              <div ref={chartRef} className="animate-in slide-in-from-top-4 duration-500 space-y-6 order-2 scroll-mt-24">
                <div className="card p-6 border-none shadow-xl bg-gradient-to-br from-indigo-50/50 to-purple-50/50 relative">
                  {/* Close Button */}
                  <button
                    onClick={() => setShowTrends(false)}
                    className="absolute top-4 right-4 z-20 p-2 rounded-xl bg-white text-slate-600 hover:bg-slate-100 shadow-md transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 tracking-widest uppercase flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-purple-600" />
                        Trend Analysis
                      </h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                        {activeTrend.toUpperCase()} Performance
                      </p>
                    </div>
                    <span className="text-[10px] font-black text-purple-600 bg-purple-100 px-2 py-1 rounded-full uppercase">
                      Last 7 Days
                    </span>
                  </div>

                  {/* Macro Selector Dropdown - Top Right */}
                  <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
                    {[
                      {
                        id: "calories",
                        label: "Cals",
                        color: "bg-orange-500",
                        text: "text-orange-600",
                      },
                      {
                        id: "protein",
                        label: "Prot",
                        color: "bg-blue-500",
                        text: "text-blue-600",
                      },
                      {
                        id: "carbs",
                        label: "Carbs",
                        color: "bg-emerald-500",
                        text: "text-emerald-600",
                      },
                      {
                        id: "fats",
                        label: "Fats",
                        color: "bg-rose-500",
                        text: "text-rose-600",
                      },
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setActiveTrend(m.id)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeTrend === m.id
                          ? "bg-slate-900 text-white shadow-md"
                          : "bg-white/60 text-slate-500 border border-white hover:border-slate-200"
                          }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  <div className="h-48 w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trends}>
                        <defs>
                          <linearGradient
                            id="colorTrend"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor={
                                activeTrend === "calories"
                                  ? "#f97316"
                                  : activeTrend === "protein"
                                    ? "#3b82f6"
                                    : activeTrend === "carbs"
                                      ? "#10b981"
                                      : "#f43f5e"
                              }
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor={
                                activeTrend === "calories"
                                  ? "#f97316"
                                  : activeTrend === "protein"
                                    ? "#3b82f6"
                                    : activeTrend === "carbs"
                                      ? "#10b981"
                                      : "#f43f5e"
                              }
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e2e8f0"
                        />
                        <XAxis
                          dataKey="date"
                          tick={{
                            fill: "#94a3b8",
                            fontSize: 10,
                            fontWeight: 800,
                          }}
                          axisLine={false}
                          tickLine={false}
                          dy={10}
                          tickFormatter={(str) => {
                            const date = new Date(str);
                            return date.toLocaleDateString("en-US", {
                              weekday: "short",
                            });
                          }}
                        />
                        <YAxis hide domain={["dataMin", "auto"]} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "16px",
                            border: "none",
                            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
                            fontWeight: "bold",
                          }}
                          labelFormatter={(label) =>
                            new Date(label).toLocaleDateString()
                          }
                        />
                        <Area
                          type="monotone"
                          dataKey={activeTrend}
                          stroke={
                            activeTrend === "calories"
                              ? "#f97316"
                              : activeTrend === "protein"
                                ? "#3b82f6"
                                : activeTrend === "carbs"
                                  ? "#10b981"
                                  : "#f43f5e"
                          }
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#colorTrend)"
                          animationDuration={1500}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="bg-white/60 p-4 rounded-2xl border border-white/50">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        Avg {activeTrend}
                      </p>
                      <p className="text-xl font-black text-slate-800">
                        {Math.round(
                          trends.reduce(
                            (acc, curr) => acc + (curr[activeTrend] || 0),
                            0,
                          ) / trends.length,
                        )}
                        <span className="text-[10px] ml-1 text-slate-500">
                          {activeTrend === "calories" ? "kcal" : "g"}
                        </span>
                      </p>
                    </div>
                    <div className="bg-white/60 p-4 rounded-2xl border border-white/50">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        Goal vs Avg
                      </p>
                      <p
                        className={`text-xl font-black ${Math.round(
                          trends.reduce(
                            (acc, curr) => acc + (curr[activeTrend] || 0),
                            0,
                          ) / trends.length,
                        ) <=
                          (activeTrend === "calories"
                            ? healthGoal?.dailyCalorieTarget || 2000
                            : activeTrend === "protein"
                              ? healthGoal?.macroTargets?.protein || 150
                              : activeTrend === "carbs"
                                ? healthGoal?.macroTargets?.carbs || 250
                                : healthGoal?.macroTargets?.fats || 80)
                          ? "text-emerald-600"
                          : "text-rose-600"
                          }`}
                      >
                        {Math.round(
                          (Math.round(
                            trends.reduce(
                              (acc, curr) => acc + (curr[activeTrend] || 0),
                              0,
                            ) / trends.length,
                          ) /
                            (activeTrend === "calories"
                              ? healthGoal?.dailyCalorieTarget || 2000
                              : activeTrend === "protein"
                                ? healthGoal?.macroTargets?.protein || 150
                                : activeTrend === "carbs"
                                  ? healthGoal?.macroTargets?.carbs || 250
                                  : healthGoal?.macroTargets?.fats || 80)) *
                          100,
                        )}
                        %
                        <span className="text-[10px] ml-1 text-slate-500 text-xs">
                          Goal
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Meals Section */}
            <div className="space-y-4">
              {["breakfast", "lunch", "snack", "dinner"].map((mealType) => {
                const mealLogs = todayLogs.filter(
                  (log) => log.mealType === mealType,
                );
                const mealCalories = mealLogs.reduce(
                  (sum, log) => sum + (log.totalNutrition?.calories || 0),
                  0,
                );

                return (
                  <div
                    key={mealType}
                    className="card p-6 border-none shadow-xl bg-white/60 backdrop-blur-md"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-14 h-14 rounded-2xl bg-white flex items-center justify-center border border-slate-100 shadow-sm text-3xl`}
                        >
                          {getMealIcon(mealType)}
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-slate-800 tracking-tight uppercase">
                            {mealType}
                          </h3>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {mealLogs.length} items •{" "}
                            <span className="text-purple-600">
                              {Math.round(mealCalories)} kcal
                            </span>
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => openAddMeal(mealType)}
                        className="w-12 h-12 rounded-[1.25rem] bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-all shadow-xl hover:scale-110 active:scale-95 group"
                      >
                        <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                      </button>
                    </div>

                    {/* Meal Items */}
                    {mealLogs.length > 0 && (
                      <div className="space-y-3">
                        {mealLogs.map((log) => (
                          <div
                            key={log._id}
                            className="flex items-center justify-between p-3 bg-white/50 border border-slate-50 rounded-2xl"
                          >
                            <div className="flex-1">
                              <p className="font-semibold text-slate-800">
                                {log.foodItems?.[0]?.name || "Food"}
                              </p>
                              <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                                <span>
                                  P:{" "}
                                  {Math.round(log.totalNutrition?.protein || 0)}
                                  g
                                </span>
                                <span>
                                  C:{" "}
                                  {Math.round(log.totalNutrition?.carbs || 0)}g
                                </span>
                                <span>
                                  F: {Math.round(log.totalNutrition?.fats || 0)}
                                  g
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {log.healthScore10 !== undefined && (
                                <div
                                  className={`px-2 py-1 rounded-lg text-[10px] font-black shadow-sm flex flex-col items-center justify-center min-w-[32px] ${log.healthScore10 * 10 >= 80
                                    ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                    : log.healthScore10 * 10 >= 60
                                      ? "bg-amber-50 text-amber-600 border border-amber-100"
                                      : "bg-rose-50 text-rose-600 border border-rose-100"
                                    }`}
                                >
                                  <span className="leading-none">
                                    {Math.round(log.healthScore10 * 10)}
                                  </span>
                                  <span className="text-[6px] opacity-70">
                                    SCR
                                  </span>
                                </div>
                              )}
                              <div className="text-right">
                                <p className="font-black text-slate-800 leading-none">
                                  {Math.round(
                                    log.totalNutrition?.calories || 0,
                                  )}
                                </p>
                                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">
                                  kcal
                                </p>
                              </div>
                              <button
                                onClick={() => openEditMeal(log)}
                                className="p-2 hover:bg-white rounded-lg transition-all ml-2 border border-transparent hover:border-slate-100"
                              >
                                <Edit2 className="w-4 h-4 text-slate-600" />
                              </button>
                              <button
                                onClick={() => deleteMeal(log._id)}
                                className="p-2 hover:bg-rose-50 rounded-lg transition-all border border-transparent hover:border-rose-100"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Calories, Hydration, Chart (Sticky on Desktop) */}
          <div className="lg:w-[400px] flex-shrink-0 lg:sticky lg:top-24 h-fit space-y-6 order-1 lg:order-2">
            {/* Calories Card - Shows when chart is hidden */}
            {!showTrends && (
              <div className="card card-gradient p-5 sm:p-8 text-slate-800 shadow-2xl relative overflow-hidden ring-1 ring-white/50 border-none">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-3xl -mr-20 -mt-20"></div>

                {/* Chart Icon Button - Top Right */}
                <button
                  onClick={() => setShowTrends(true)}
                  className="absolute top-4 right-4 z-20 p-2.5 rounded-xl shadow-lg flex items-center justify-center transition-all bg-white text-slate-600 hover:bg-purple-50"
                >
                  <BarChart3 className="w-5 h-5" />
                </button>

                <div className="flex items-start justify-between mb-4 sm:mb-8 relative z-10">
                  <div>
                    <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 mb-1 sm:mb-2">
                      Remaining
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl sm:text-6xl font-black tracking-tighter text-slate-900">
                        {Math.max(caloriesRemaining, 0).toLocaleString()}
                      </span>
                      <span className="text-slate-500 font-bold text-sm sm:text-lg">
                        kcal
                      </span>
                    </div>
                  </div>
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-[1.25rem] sm:rounded-[1.5rem] bg-white/40 backdrop-blur-md flex items-center justify-center border border-white/50 shadow-inner group">
                    <Flame className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500 drop-shadow-md" />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 px-1">
                  <span>GOAL: {caloriesGoal}</span>
                  <span className="text-purple-600">
                    CONSUMED: {caloriesConsumed}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="relative h-4 bg-white/30 rounded-full overflow-hidden mb-8 border border-white/50">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(139,92,246,0.3)]"
                    style={{ width: `${caloriesPercentage}%` }}
                  />
                </div>

                {/* Macros Grid */}
                <div className="grid grid-cols-3 gap-6 relative z-10">
                  {[
                    {
                      label: "Prot",
                      value: Math.round(proteinConsumed),
                      goal: proteinGoal,
                      color: "from-purple-400 to-orange-600",
                      text: "text-blue-600",
                      bg: "bg-blue-50/50",
                      iconSize: "w-2 h-2",
                      percentage: proteinPercentage,
                    },
                    {
                      label: "Carbs",
                      value: Math.round(carbsConsumed),
                      goal: carbsGoal,
                      color: "from-purple-400 to-orange-600",
                      text: "text-emerald-600",
                      bg: "bg-emerald-50/50",
                      iconSize: "w-2 h-2",
                      percentage: carbsPercentage,
                    },
                    {
                      label: "Fat",
                      value: Math.round(fatsConsumed),
                      goal: fatsGoal,
                      color: "from-purple-400 to-orange-600",
                      text: "text-amber-600",
                      bg: "bg-amber-50/50",
                      iconSize: "w-2 h-2",
                      percentage: fatsPercentage,
                    },
                  ].map((macro) => (
                    <div key={macro.label} className="space-y-3">
                      <div className="flex items-center gap-2 px-1">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${macro.text.replace("text-", "bg-")}`}
                        />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {macro.label}
                        </span>
                      </div>
                      <div
                        className={`${macro.bg} backdrop-blur-md p-3 rounded-2xl border border-white/50 shadow-inner`}
                      >
                        <p className="text-xl font-black text-slate-800 tracking-tight">
                          {macro.value}
                          <span className="text-[10px] ml-0.5">g</span>
                        </p>
                        <div className="w-full h-1.5 bg-white/40 rounded-full mt-2 overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${macro.color} rounded-full transition-all duration-700`}
                            style={{ width: `${macro.percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hydration Card */}
            <div className="card p-6 border-none shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50/50 backdrop-blur-md flex items-center justify-center border border-blue-100 shadow-inner">
                    <Droplets className="w-7 h-7 text-blue-500 drop-shadow-sm" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800 tracking-tight">
                      HYDRATION
                    </h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {waterIntake} of {waterGoal} glasses
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-black text-blue-600 tracking-tighter">
                    {waterIntake}
                  </p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] -mt-1">
                    Glasses
                  </p>
                </div>
              </div>

              {/* Water Glasses */}
              <div className="flex flex-wrap gap-2.5 mb-6">
                {Array.from({ length: waterGoal }).map((_, i) => (
                  <button
                    key={i}
                    onClick={handleAddWater}
                    className={`w-10 h-11 rounded-xl flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 border-2 ${i < waterIntake
                      ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200"
                      : "bg-white/40 border-slate-100 text-slate-400 hover:border-blue-200"
                      }`}
                  >
                    <Droplets
                      className={`w-5 h-5 ${i < waterIntake ? "animate-bounce" : ""}`}
                    />
                  </button>
                ))}
                <button
                  onClick={handleAddWater}
                  className="w-10 h-11 rounded-xl flex items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 text-slate-400 hover:border-blue-300 hover:bg-white transition-all transition-all"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r from-purple-400 to-orange-600 rounded-full transition-all duration-1000 ease-out`}
                  style={{ width: `${(waterIntake / waterGoal) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Meal Modal */}
      {showAddMeal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center md:justify-center"
          onClick={() => setShowAddMeal(false)}
        >
          <div
            className="bg-white w-full md:w-full md:max-w-lg rounded-t-3xl md:rounded-3xl p-6 pb-24 md:pb-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Utensils className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">
                    {editingMeal ? "Edit" : "Add"}{" "}
                    {selectedMealType.charAt(0).toUpperCase() +
                      selectedMealType.slice(1)}
                  </h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                    Track your nutrition
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddMeal(false)}
                className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {!nutritionData ? (
                <>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">
                        Food Name
                      </label>
                      <input
                        type="text"
                        value={foodName}
                        onChange={(e) => {
                          setFoodName(e.target.value);
                          setQuantitySuggestions(
                            getQuantitySuggestions(e.target.value),
                          );
                        }}
                        placeholder="e.g., Chicken Salad"
                        className="w-full px-5 py-4 bg-slate-50/80 border-2 border-slate-100 rounded-[1.5rem] focus:border-purple-500 focus:bg-white focus:outline-none text-slate-900 font-bold transition-all placeholder:text-slate-400 shadow-inner"
                        onKeyPress={(e) => e.key === "Enter" && analyzeFood()}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">
                        Quantity
                      </label>

                      {/* Quantity Pills */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {quantitySuggestions.map((qty, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => setQuantity(qty)}
                            className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all border-2 ${quantity === qty
                              ? "bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-200"
                              : "bg-white border-slate-100 text-slate-600 hover:border-purple-200"
                              }`}
                          >
                            {qty}
                          </button>
                        ))}
                      </div>

                      <input
                        type="text"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="e.g., 1 bowl, 100g"
                        className="w-full px-5 py-3.5 bg-slate-50/80 border-2 border-slate-100 rounded-[1.5rem] focus:border-purple-500 focus:bg-white focus:outline-none text-slate-900 font-bold transition-all placeholder:text-slate-400 shadow-inner"
                        onKeyPress={(e) => e.key === "Enter" && analyzeFood()}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">
                        Preparation
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Fried", icon: "🍳" },
                          { label: "Baked", icon: "🥐" },
                          { label: "Grilled", icon: "🔥" },
                          { label: "Home", icon: "🏠" },
                          { label: "Dine-in", icon: "🍽️" },
                          { label: "Packaged", icon: "📦" },
                        ].map((method) => (
                          <button
                            key={method.label}
                            type="button"
                            onClick={() => setPrepMethod(method.label)}
                            className={`p-2.5 rounded-xl transition-all border-2 flex flex-col items-center gap-1.5 ${prepMethod === method.label
                              ? "bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-200"
                              : "bg-white border-slate-100 text-slate-600 hover:border-purple-200"
                              }`}
                          >
                            <span className="text-lg leading-none">
                              {method.icon}
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-tighter">
                              {method.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={analyzeFood}
                      disabled={
                        analyzing || !foodName.trim() || !quantity.trim()
                      }
                      className="w-full bg-slate-900 text-white font-black py-5 rounded-[2rem] hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all shadow-[0_20px_40px_-12px_rgba(15,23,42,0.3)] uppercase tracking-widest text-sm relative overflow-hidden group active:scale-[0.98]"
                    >
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 transform translate-y-2 group-hover:translate-y-0 transition-transform"></div>
                      <div className="relative z-10 flex items-center gap-3">
                        {analyzing ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Zap className="w-5 h-5 text-purple-400 group-hover:animate-pulse" />
                            Calculate Nutrition
                          </>
                        )}
                      </div>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Nutrition Results - Premium Medical UI */}
                  <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-700 ease-out">
                    {/* Header: Score and Basic Info */}
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-orange-500/5 rounded-[2.5rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                      <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.04)] relative">
                        <div className="flex items-center justify-between mb-8">
                          <div className="min-w-0 flex-1">
                            <h3
                              className="text-3xl font-black text-slate-800 tracking-tighter mb-1 truncate"
                              title={foodName}
                            >
                              {foodName}
                            </h3>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100/50">
                                <ShieldCheck className="w-3 h-3" />
                                <span className="text-[10px] font-black uppercase tracking-wider">
                                  Verified by AI Health
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="bg-orange-50 rounded-2xl p-3 border border-orange-100 text-center min-w-[80px] shadow-sm">
                            <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest mb-0.5">
                              SCORE
                            </p>
                            <p className="text-3xl font-black text-orange-600 leading-none">
                              {Math.round(
                                (fullAnalysis?.healthScore10 ||
                                  fullAnalysis?.healthScore / 10) * 10,
                              )}
                            </p>
                            <p className="text-[9px] font-black text-orange-400 uppercase tracking-tighter mt-1">
                              out of 100
                            </p>
                          </div>
                        </div>

                        {/* Macronutrients Grid */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between px-1">
                            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                              MACRONUTRIENTS
                            </h4>
                          </div>
                          <div className="grid grid-cols-4 gap-2.5">
                            {[
                              {
                                label: "CALORIES",
                                value: Math.round(nutritionData.calories),
                                unit: "kcal",
                                color: "text-orange-600",
                                bg: "bg-slate-50",
                              },
                              {
                                label: "PROTEIN",
                                value: Math.round(nutritionData.protein),
                                unit: "g",
                                color: "text-blue-600",
                                bg: "bg-slate-50",
                              },
                              {
                                label: "CARBS",
                                value: Math.round(nutritionData.carbs),
                                unit: "g",
                                color: "text-emerald-600",
                                bg: "bg-slate-50",
                              },
                              {
                                label: "FATS",
                                value: Math.round(nutritionData.fats),
                                unit: "g",
                                color: "text-rose-600",
                                bg: "bg-slate-50",
                              },
                            ].map((stat) => (
                              <div
                                key={stat.label}
                                className={`${stat.bg} rounded-[1.25rem] p-3 border border-slate-100/50 shadow-sm transition-all hover:scale-[1.02] hover:bg-white`}
                              >
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1.5">
                                  {stat.label}
                                </p>
                                <div className="flex items-baseline gap-0.5">
                                  <span className="text-lg font-black text-slate-800 leading-none">
                                    {stat.value}
                                  </span>
                                  <span className="text-[9px] font-bold text-slate-400">
                                    {stat.unit}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Micronutrients Section */}
                    <div className="bg-blue-50/40 rounded-[2.5rem] p-7 border border-blue-100 shadow-sm">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-xl bg-blue-100/50 flex items-center justify-center text-blue-600">
                          <Activity className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-black text-slate-700 tracking-tight uppercase">
                          Micronutrients
                        </h4>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {(fullAnalysis?.micronutrients || []).map(
                          (micro, i) => (
                            <div
                              key={i}
                              className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-blue-100 shadow-sm"
                            >
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-[11px] font-black text-slate-700 truncate">
                                  {micro.name}
                                </span>
                                <span className="text-[10px] font-black text-blue-600">
                                  {micro.percentage}%
                                </span>
                              </div>
                              <p className="text-xl font-black text-slate-800 mb-2">
                                {micro.value}
                              </p>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                                  style={{ width: `${micro.percentage}%` }}
                                />
                              </div>
                            </div>
                          ),
                        )}
                        {(!fullAnalysis?.micronutrients ||
                          fullAnalysis.micronutrients.length === 0) &&
                          ["Vitamin A", "Vitamin C", "Iron", "Calcium"].map(
                            (name) => (
                              <div
                                key={name}
                                className="bg-white/80 rounded-2xl p-4 border border-blue-100 shadow-sm opacity-60"
                              >
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-[11px] font-black text-slate-700">
                                    {name}
                                  </span>
                                  <span className="text-[10px] font-black text-blue-600">
                                    --%
                                  </span>
                                </div>
                                <p className="text-xl font-black text-slate-800 mb-2">
                                  --
                                </p>
                                <div className="h-1.5 bg-slate-100 rounded-full" />
                              </div>
                            ),
                          )}
                      </div>
                    </div>

                    {/* Health Benefits Card */}
                    <div className="bg-emerald-50/50 rounded-[2.5rem] p-7 border border-emerald-100 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10" />
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-200 group-hover:rotate-12 transition-transform">
                          <Brain className="w-5 h-5" />
                        </div>
                        <h4 className="text-sm font-black text-emerald-900 tracking-tight uppercase">
                          Health Benefits
                        </h4>
                      </div>
                      <p className="text-xs font-bold text-emerald-800/80 leading-relaxed">
                        {fullAnalysis?.healthBenefitsSummary ||
                          fullAnalysis?.analysis ||
                          "This meal provides essential nutrients for your daily requirements."}
                      </p>
                    </div>

                    {/* Enhancement Section */}
                    <div className="bg-amber-50/40 rounded-[2.5rem] p-7 border border-amber-100 group">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-2xl bg-white border border-amber-100 flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <h4 className="text-sm font-black text-amber-900 tracking-tight uppercase">
                          Make it even Healthier
                        </h4>
                      </div>

                      <div className="space-y-3">
                        {(fullAnalysis?.enhancementTips || []).map((tip, i) => (
                          <div
                            key={i}
                            className="bg-white rounded-[1.5rem] p-4 flex items-center gap-4 border border-amber-100 shadow-sm hover:shadow-md transition-all"
                          >
                            <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white shrink-0">
                              <Plus className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-800 mb-0.5">
                                {tip.name || tip}
                              </p>
                              <p className="text-[10px] font-bold text-slate-500 truncate">
                                {tip.benefit || "Adds nutritional value"}
                              </p>
                            </div>
                          </div>
                        ))}
                        {(!fullAnalysis?.enhancementTips ||
                          fullAnalysis.enhancementTips.length === 0) && (
                            <div className="text-center py-4 text-slate-400 text-xs font-bold uppercase tracking-widest italic">
                              Already optimal!
                            </div>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-4 pt-4">
                    <button
                      onClick={() => {
                        setNutritionData(null);
                        setQuantity("");
                      }}
                      className="flex-1 py-5 bg-slate-100 text-slate-600 rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                    >
                      Back
                    </button>
                    <button
                      onClick={logMeal}
                      className="flex-[2] py-5 bg-[#2FC8B9] text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-lg shadow-[#2FC8B9]/20 hover:bg-[#28b5a6] transition-all active:scale-95 flex items-center justify-center gap-3 group relative overflow-hidden"
                    >
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 transform translate-y-2 group-hover:translate-y-0 transition-transform"></div>
                      <div className="relative z-10 flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-white/80 group-hover:scale-110 transition-transform" />
                        {editingMeal ? "Update Meal" : "Add to Diary"}
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
