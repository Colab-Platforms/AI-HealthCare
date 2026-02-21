import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Loader2, Plus, Trash2, X, Droplets, Flame, Edit2, Check, Bell, Zap, Activity
} from 'lucide-react';

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
  const [selectedMealType, setSelectedMealType] = useState('');
  const [waterIntake, setWaterIntake] = useState(0);
  const [editingMeal, setEditingMeal] = useState(null);

  // Add meal form state
  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [nutritionData, setNutritionData] = useState(null);
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fats, setFats] = useState('');
  const [fullAnalysis, setFullAnalysis] = useState(null);

  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [prepMethod, setPrepMethod] = useState('');

  // Smart quantity suggestions based on food type
  const getQuantitySuggestions = (food) => {
    const f = food.toLowerCase();
    if (f.includes('roti') || f.includes('naan') || f.includes('paratha')) return ['1 pc', '2 pcs', '3 pcs', '4 pcs'];
    if (f.includes('rice') || f.includes('biryani') || f.includes('khichdi')) return ['1 bowl', '1 plate', '1 cup', '2 cups'];
    if (f.includes('samosa') || f.includes('pakora') || f.includes('momos')) return ['1 pc', '2 pcs', '3 pcs', '5 pcs'];
    if (f.includes('idli') || f.includes('dosa') || f.includes('vada')) return ['1 pc', '2 pcs', '3 pcs', '1 plate'];
    if (f.includes('pizza') || f.includes('burger')) return ['1 slice', '2 slices', '1 whole', '1 med'];
    if (f.includes('chicken') || f.includes('paneer') || f.includes('tikka')) return ['1 bowl', '1 plate', '150g', '200g'];
    return ['1 bowl', '1 plate', '1 piece', '100g', '150g'];
  };

  const [quantitySuggestions, setQuantitySuggestions] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const today = new Date().toISOString().split('T')[0];

      const [logsRes, summaryRes, goalRes] = await Promise.all([
        axios.get('/api/nutrition/logs/today', { headers }),
        axios.get(`/api/nutrition/summary/daily?date=${today}`, { headers }),
        axios.get('/api/nutrition/goals', { headers }).catch(() => ({ data: { healthGoal: null } }))
      ]);

      setTodayLogs(logsRes.data.foodLogs || []);
      setDailySummary(summaryRes.data.summary);
      setHealthGoal(goalRes.data.healthGoal);

      // Load water intake from localStorage
      const savedWater = localStorage.getItem(`waterIntake_${today}`);
      setWaterIntake(savedWater ? parseInt(savedWater) : 0);

      setIsInitialLoad(false);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load nutrition data');
      setIsInitialLoad(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWater = () => {
    const today = new Date().toISOString().split('T')[0];
    const newWater = waterIntake + 1;
    setWaterIntake(newWater);
    localStorage.setItem(`waterIntake_${today}`, newWater);
    toast.success('Water added! 💧');
  };

  const openAddMeal = (mealType) => {
    if (!healthGoal) {
      toast.error('Please set your fitness goal first');
      navigate('/profile?tab=goals');
      return;
    }
    setSelectedMealType(mealType);
    setShowAddMeal(true);
    setEditingMeal(null);
    setFoodName('');
    setQuantity('');
    setAnalyzing(false);
    setNutritionData(null);
    setCalories('');
    setProtein('');
    setCarbs('');
    setFats('');
    setFullAnalysis(null);
  };

  const openEditMeal = (meal) => {
    setEditingMeal(meal);
    setSelectedMealType(meal.mealType);
    setFoodName(meal.foodItems?.[0]?.name || '');
    setQuantity('');
    setNutritionData({
      calories: meal.totalNutrition?.calories || 0,
      protein: meal.totalNutrition?.protein || 0,
      carbs: meal.totalNutrition?.carbs || 0,
      fats: meal.totalNutrition?.fats || 0
    });
    setCalories(meal.totalNutrition?.calories?.toString() || '');
    setProtein(meal.totalNutrition?.protein?.toString() || '');
    setCarbs(meal.totalNutrition?.carbs?.toString() || '');
    setFats(meal.totalNutrition?.fats?.toString() || '');
    setShowAddMeal(true);
  };

  const analyzeFood = async () => {
    if (!foodName.trim() || !quantity.trim()) {
      toast.error('Please enter food name and quantity');
      return;
    }

    setAnalyzing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        '/api/nutrition/quick-check',
        { foodDescription: `${quantity} ${foodName} ${prepMethod}` },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success && response.data.data?.foodItem) {
        const nutrition = response.data.data.foodItem.nutrition;
        setFullAnalysis(response.data.data);
        setNutritionData(nutrition);
        setCalories(nutrition.calories?.toString() || '0');
        setProtein(nutrition.protein?.toString() || '0');
        setCarbs(nutrition.carbs?.toString() || '0');
        setFats(nutrition.fats?.toString() || '0');
        toast.success('Food analyzed! ✨');
      } else {
        toast.error('Could not analyze food');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze food');
    } finally {
      setAnalyzing(false);
    }
  };

  const logMeal = async () => {
    if (!foodName.trim() || !nutritionData) {
      toast.error('Please analyze food first');
      return;
    }

    try {
      const token = localStorage.getItem('token');

      if (editingMeal) {
        // Update existing meal
        await axios.put(
          `/api/nutrition/logs/${editingMeal._id}`,
          {
            foodItems: [{
              name: `${quantity} ${foodName}`,
              nutrition: {
                calories: parseFloat(calories) || 0,
                protein: parseFloat(protein) || 0,
                carbs: parseFloat(carbs) || 0,
                fats: parseFloat(fats) || 0
              }
            }]
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Meal updated!');
      } else {
        // Add new meal
        await axios.post(
          '/api/nutrition/log-meal',
          {
            mealType: selectedMealType,
            foodItems: [{
              name: `${quantity} ${foodName}`,
              nutrition: {
                calories: parseFloat(calories) || 0,
                protein: parseFloat(protein) || 0,
                carbs: parseFloat(carbs) || 0,
                fats: parseFloat(fats) || 0
              }
            }]
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Meal logged!');
      }

      setShowAddMeal(false);
      invalidateCache(['dashboard']);
      fetchData();
    } catch (error) {
      console.error('Log meal error:', error);
      toast.error('Failed to log meal');
    }
  };

  const deleteMeal = async (id) => {
    if (!confirm('Delete this meal?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/nutrition/logs/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Meal deleted');
      invalidateCache(['dashboard']);
      fetchData();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete meal');
    }
  };

  const getMealIcon = (type) => {
    const icons = {
      breakfast: '☕',
      lunch: '☀️',
      snack: '🍎',
      dinner: '🌙'
    };
    return icons[type] || '🍽️';
  };

  const getMealColor = (type) => {
    const colors = {
      breakfast: 'from-orange-400 to-orange-500',
      lunch: 'from-yellow-400 to-yellow-500',
      snack: 'from-pink-400 to-pink-500',
      dinner: 'from-purple-400 to-purple-500'
    };
    return colors[type] || 'from-gray-400 to-gray-500';
  };

  if (isInitialLoad && loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  const caloriesRemaining = (healthGoal?.dailyCalorieTarget || 2000) - (dailySummary?.totalCalories || 0);
  const caloriesConsumed = dailySummary?.totalCalories || 0;
  const caloriesGoal = healthGoal?.dailyCalorieTarget || 2000;
  const caloriesPercentage = Math.min((caloriesConsumed / caloriesGoal) * 100, 100);

  const proteinConsumed = dailySummary?.totalProtein || 0;
  const proteinGoal = healthGoal?.macroTargets?.protein || 150;
  const proteinPercentage = Math.min((proteinConsumed / proteinGoal) * 100, 100);

  const carbsConsumed = dailySummary?.totalCarbs || 0;
  const carbsGoal = healthGoal?.macroTargets?.carbs || 250;
  const carbsPercentage = Math.min((carbsConsumed / carbsGoal) * 100, 100);

  const fatsConsumed = dailySummary?.totalFats || 0;
  const fatsGoal = healthGoal?.macroTargets?.fats || 80;
  const fatsPercentage = Math.min((fatsConsumed / fatsGoal) * 100, 100);

  const waterGoal = 8;

  return (
    <div className="w-full min-h-screen bg-gray-50 pb-24">
      {/* Main Content */}
      <div className="w-full max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Welcome Message - Mobile Only */}
        <div className="md:hidden flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-md flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <h1 className="text-sm font-bold text-slate-800 truncate">
              {(() => {
                const hour = new Date().getHours();
                if (hour < 12) return 'Good Morning';
                if (hour < 18) return 'Good Afternoon';
                return 'Good Evening';
              })()}, {user?.name?.split(' ')[0] || 'there'}!
            </h1>
          </div>
          <button className="w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:shadow-lg transition-all flex-shrink-0">
            <Bell className="w-4 h-4 text-slate-700" />
          </button>
        </div>

        {/* Calories Card - Purple Theme */}
        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-3xl p-6 text-white shadow-xl">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-purple-200 text-sm uppercase tracking-wide mb-2">Calories Remaining</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold">{Math.max(caloriesRemaining, 0).toLocaleString()}</span>
                <span className="text-purple-200 text-lg">kcal</span>
              </div>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-purple-500 flex items-center justify-center">
              <Flame className="w-8 h-8 text-orange-300" />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm mb-4">
            <span className="text-purple-200">GOAL: {caloriesGoal}</span>
            <span className="text-purple-200">CONSUMED: {caloriesConsumed}</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-3 bg-purple-500 rounded-full overflow-hidden mb-6">
            <div
              className="h-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 rounded-full transition-all duration-500"
              style={{ width: `${caloriesPercentage}%` }}
            />
          </div>

          {/* Macros */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-blue-300" />
                <span className="text-purple-200 text-xs uppercase">Protein</span>
              </div>
              <p className="text-2xl font-bold">{Math.round(proteinConsumed)}g</p>
              <div className="w-full h-2 bg-purple-500 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-blue-300 rounded-full transition-all duration-500"
                  style={{ width: `${proteinPercentage}%` }}
                />
              </div>
              <p className="text-xs text-purple-300 mt-1">Goal: {proteinGoal}g</p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-green-300" />
                <span className="text-purple-200 text-xs uppercase">Carbs</span>
              </div>
              <p className="text-2xl font-bold">{Math.round(carbsConsumed)}g</p>
              <div className="w-full h-2 bg-purple-500 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-green-300 rounded-full transition-all duration-500"
                  style={{ width: `${carbsPercentage}%` }}
                />
              </div>
              <p className="text-xs text-purple-300 mt-1">Goal: {carbsGoal}g</p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-yellow-300" />
                <span className="text-purple-200 text-xs uppercase">Fat</span>
              </div>
              <p className="text-2xl font-bold">{Math.round(fatsConsumed)}g</p>
              <div className="w-full h-2 bg-purple-500 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-yellow-300 rounded-full transition-all duration-500"
                  style={{ width: `${fatsPercentage}%` }}
                />
              </div>
              <p className="text-xs text-purple-300 mt-1">Goal: {fatsGoal}g</p>
            </div>
          </div>
        </div>

        {/* Hydration Card */}
        <div className="bg-white rounded-3xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center">
                <Droplets className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">HYDRATION</h3>
                <p className="text-sm text-slate-500">{waterIntake} / {waterGoal} glasses</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-blue-500">{waterIntake}</p>
              <p className="text-sm text-slate-500">Liters</p>
            </div>
          </div>

          {/* Water Glasses */}
          <div className="grid grid-cols-8 gap-2 mb-4">
            {Array.from({ length: waterGoal }).map((_, i) => (
              <button
                key={i}
                onClick={handleAddWater}
                className={`aspect-square rounded-xl flex items-center justify-center transition-all transform hover:scale-110 ${i < waterIntake
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-400'
                  }`}
              >
                <Droplets className="w-5 h-5" />
              </button>
            ))}
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${(waterIntake / waterGoal) * 100}%` }}
            />
          </div>
        </div>

        {/* Meals Section */}
        <div className="space-y-4">
          {['breakfast', 'lunch', 'snack', 'dinner'].map((mealType) => {
            const mealLogs = todayLogs.filter(log => log.mealType === mealType);
            const mealCalories = mealLogs.reduce((sum, log) => sum + (log.totalNutrition?.calories || 0), 0);

            return (
              <div key={mealType} className="bg-white rounded-3xl p-5 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{getMealIcon(mealType)}</div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 capitalize">{mealType}</h3>
                      <p className="text-sm text-slate-500">
                        {mealLogs.length} items • {mealCalories} kcal
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => openAddMeal(mealType)}
                    className="w-12 h-12 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 transition-all shadow-lg"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>

                {/* Meal Items */}
                {mealLogs.length > 0 && (
                  <div className="space-y-3">
                    {mealLogs.map((log) => (
                      <div key={log._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                        <div className="flex-1">
                          <p className="font-semibold text-slate-800">{log.foodItems?.[0]?.name || 'Food'}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                            <span>P: {Math.round(log.totalNutrition?.protein || 0)}g</span>
                            <span>C: {Math.round(log.totalNutrition?.carbs || 0)}g</span>
                            <span>F: {Math.round(log.totalNutrition?.fats || 0)}g</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{Math.round(log.totalNutrition?.calories || 0)}</span>
                          <span className="text-xs text-slate-500">kcal</span>
                          <button
                            onClick={() => openEditMeal(log)}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-all ml-2"
                          >
                            <Edit2 className="w-4 h-4 text-slate-600" />
                          </button>
                          <button
                            onClick={() => deleteMeal(log._id)}
                            className="p-2 hover:bg-red-100 rounded-lg transition-all"
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

      {/* Add/Edit Meal Modal */}
      {showAddMeal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center md:justify-center"
          onClick={() => setShowAddMeal(false)}
        >
          <div
            className="bg-white w-full md:w-full md:max-w-lg rounded-t-3xl md:rounded-3xl p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-800">
                {editingMeal ? 'Edit' : 'Add'} {selectedMealType.charAt(0).toUpperCase() + selectedMealType.slice(1)}
              </h2>
              <button
                onClick={() => setShowAddMeal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {!nutritionData ? (
                <>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Food Name</label>
                      <input
                        type="text"
                        value={foodName}
                        onChange={(e) => {
                          setFoodName(e.target.value);
                          setQuantitySuggestions(getQuantitySuggestions(e.target.value));
                        }}
                        placeholder="e.g., Chicken Salad"
                        className="w-full px-5 py-4 bg-slate-50/80 border-2 border-slate-100 rounded-2xl focus:border-purple-500 focus:bg-white focus:outline-none text-slate-900 font-bold transition-all placeholder:text-slate-400"
                        onKeyPress={(e) => e.key === 'Enter' && analyzeFood()}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Quantity</label>

                      {/* Quantity Pills */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {quantitySuggestions.map((qty, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => setQuantity(qty)}
                            className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all border-2 ${quantity === qty
                              ? 'bg-purple-600 border-purple-600 text-white shadow-lg'
                              : 'bg-white border-slate-100 text-slate-600 hover:border-purple-200'
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
                        className="w-full px-5 py-3.5 bg-slate-50/80 border-2 border-slate-100 rounded-xl focus:border-purple-500 focus:bg-white focus:outline-none text-slate-900 font-bold transition-all placeholder:text-slate-400"
                        onKeyPress={(e) => e.key === 'Enter' && analyzeFood()}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Preparation</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Fried', icon: '🍳' },
                          { label: 'Baked', icon: '🥐' },
                          { label: 'Grilled', icon: '🔥' },
                          { label: 'Home', icon: '🏠' },
                          { label: 'Dine-in', icon: '🍽️' },
                          { label: 'Packaged', icon: '📦' }
                        ].map((method) => (
                          <button
                            key={method.label}
                            type="button"
                            onClick={() => setPrepMethod(method.label)}
                            className={`p-2.5 rounded-xl transition-all border-2 flex flex-col items-center gap-1.5 ${prepMethod === method.label
                              ? 'bg-purple-600 border-purple-600 text-white shadow-lg'
                              : 'bg-white border-slate-100 text-slate-600 hover:border-purple-200'
                              }`}
                          >
                            <span className="text-lg leading-none">{method.icon}</span>
                            <span className="text-[9px] font-black uppercase tracking-tighter">{method.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={analyzeFood}
                      disabled={analyzing || !foodName.trim() || !quantity.trim()}
                      className="w-full bg-slate-900 text-white font-black py-5 rounded-[2rem] hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all shadow-xl uppercase tracking-widest text-sm"
                    >
                      {analyzing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Zap className="w-5 h-5 text-purple-400" />
                          Calculate Nutrition
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Nutrition Results - Premium Light Theme */}
                  <div className="space-y-6">
                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.05)] relative overflow-hidden">
                      {/* Decorative Gradient Accent */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/5 to-blue-500/5 rounded-bl-full pointer-events-none" />

                      <div className="flex flex-col sm:flex-row items-center gap-8 mb-8 relative z-10">
                        {/* Circular Score Ring */}
                        <div className="relative w-28 h-28 flex-shrink-0">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="56" cy="56" r="50" stroke="#f1f5f9" strokeWidth="8" fill="none" />
                            <circle
                              cx="56" cy="56" r="50"
                              stroke={fullAnalysis?.healthScore10 >= 7 ? "#10b981" : fullAnalysis?.healthScore10 >= 4 ? "#f59e0b" : "#ef4444"}
                              strokeWidth="8"
                              fill="none"
                              strokeDasharray={314}
                              strokeDashoffset={314 - (fullAnalysis?.healthScore10 || (fullAnalysis?.healthScore / 10)) * 31.4}
                              strokeLinecap="round"
                              className="transition-all duration-1000 ease-out"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black text-slate-800">
                              {fullAnalysis?.healthScore10 || (fullAnalysis?.healthScore / 10).toFixed(1)}
                            </span>
                            <span className="text-[8px] font-black text-slate-400 tracking-widest">SCORE</span>
                          </div>
                        </div>

                        <div className="text-center sm:text-left">
                          <h3 className="text-2xl font-black text-slate-800 mb-1">{foodName}</h3>
                          <div className="flex items-center justify-center sm:justify-start gap-2">
                            <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black rounded-lg uppercase tracking-wider">
                              {quantity}
                            </span>
                            <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${fullAnalysis?.healthScore10 >= 7 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {fullAnalysis?.healthScore10 >= 7 ? 'Optimal' : 'Moderate'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Macros Grid */}
                      <div className="grid grid-cols-4 gap-3 mb-8 relative z-10">
                        {[
                          { label: 'Kcal', value: Math.round(nutritionData.calories), color: 'text-orange-600', bg: 'bg-orange-50' },
                          { label: 'Prot', value: Math.round(nutritionData.protein), color: 'text-blue-600', bg: 'bg-blue-50' },
                          { label: 'Carbs', value: Math.round(nutritionData.carbs), color: 'text-emerald-600', bg: 'bg-emerald-50' },
                          { label: 'Fats', value: Math.round(nutritionData.fats), color: 'text-rose-600', bg: 'bg-rose-50' }
                        ].map(stat => (
                          <div key={stat.label} className={`${stat.bg} rounded-2xl p-3 text-center transition-transform hover:-translate-y-1`}>
                            <p className="text-lg font-black text-slate-800 leading-none mb-1">{stat.value}</p>
                            <p className={`text-[9px] font-black uppercase tracking-tighter ${stat.color}`}>{stat.label}</p>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-6 relative z-10">
                        {/* Summary Box */}
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 shadow-inner">
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-3 h-3 text-purple-500" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Insights</span>
                          </div>
                          <p className="text-xs font-medium text-slate-600 leading-relaxed italic">
                            "{fullAnalysis?.analysis}"
                          </p>
                        </div>

                        {/* Components Sections */}
                        <div className="grid gap-4">
                          {fullAnalysis?.enhancementTips?.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                <Plus className="w-3 h-3 text-emerald-500" />
                                Boost Nutrition
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {fullAnalysis.enhancementTips.map((tip, i) => (
                                  <div key={i} className="px-3 py-2 bg-emerald-50/50 border border-emerald-100/50 rounded-xl flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-emerald-400" />
                                    <p className="text-[10px] font-bold text-emerald-800">{tip}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {fullAnalysis?.micronutrients?.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                <Activity className="w-3 h-3 text-blue-500" />
                                Key Micros
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {fullAnalysis.micronutrients.map((micro, i) => (
                                  <span key={i} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-[10px] font-black rounded-lg uppercase tracking-tight">
                                    {micro}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setNutritionData(null);
                        setQuantity('');
                      }}
                      className="flex-1 bg-gray-200 text-gray-900 font-bold py-4 rounded-xl hover:bg-gray-300 transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={logMeal}
                      className="flex-1 bg-slate-800 text-white font-bold py-4 rounded-xl hover:bg-slate-700 flex items-center justify-center gap-2 transition-all"
                    >
                      <Check className="w-5 h-5" />
                      {editingMeal ? 'Update' : 'Log Meal'}
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
