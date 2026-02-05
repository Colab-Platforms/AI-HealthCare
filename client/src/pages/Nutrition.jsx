import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Loader2, Plus, Trash2, X, Droplets, Flame, Zap, Heart,
  Calendar, AlertCircle, CheckCircle
} from 'lucide-react';
import QuickFoodCheck from '../components/QuickFoodCheck';

export default function Nutrition() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [todayLogs, setTodayLogs] = useState([]);
  const [dailySummary, setDailySummary] = useState(null);
  const [healthGoal, setHealthGoal] = useState(null);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [waterIntake, setWaterIntake] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Add meal form state
  const [mealType, setMealType] = useState('breakfast');
  const [foodDescription, setFoodDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const today = new Date().toISOString().split('T')[0];
      const isToday = selectedDate === today;

      const [logsRes, summaryRes, goalRes] = await Promise.all([
        isToday 
          ? axios.get('/api/nutrition/logs/today', { headers })
          : axios.get(`/api/nutrition/logs?startDate=${selectedDate}&endDate=${selectedDate}`, { headers }),
        axios.get(`/api/nutrition/summary/daily?date=${selectedDate}`, { headers }),
        axios.get('/api/nutrition/goals', { headers }).catch(() => ({ data: { healthGoal: null } }))
      ]);

      setTodayLogs(logsRes.data.foodLogs || []);
      setDailySummary(summaryRes.data.summary);
      setHealthGoal(goalRes.data.healthGoal);

      // Load water intake from localStorage
      const savedWater = localStorage.getItem(`waterIntake_${selectedDate}`);
      setWaterIntake(savedWater ? parseInt(savedWater) : 0);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load nutrition data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddWater = () => {
    const newWater = waterIntake + 1;
    setWaterIntake(newWater);
    localStorage.setItem(`waterIntake_${selectedDate}`, newWater);
    toast.success('Water intake updated! 💧');
  };

  const handleRemoveWater = () => {
    if (waterIntake > 0) {
      const newWater = waterIntake - 1;
      setWaterIntake(newWater);
      localStorage.setItem(`waterIntake_${selectedDate}`, newWater);
    }
  };

  const analyzeFood = async () => {
    if (!foodDescription.trim()) {
      toast.error('Please enter a food item');
      return;
    }

    setAnalyzing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        '/api/nutrition/quick-check',
        { foodDescription: foodDescription },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setAnalysisResult(response.data.data);
      toast.success('Food analyzed!');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze food');
    } finally {
      setAnalyzing(false);
    }
  };

  const logMeal = async () => {
    if (!analysisResult) {
      toast.error('Please analyze food first');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        '/api/nutrition/log-meal',
        {
          mealType,
          foodItems: analysisResult.foodItem ? [analysisResult.foodItem] : [],
          notes: foodDescription
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Meal logged successfully!');
      setShowAddMeal(false);
      setFoodDescription('');
      setAnalysisResult(null);
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
      fetchData();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete meal');
    }
  };

  const getMealIcon = (type) => {
    const icons = {
      breakfast: '🌅',
      lunch: '☀️',
      dinner: '🌙',
      snack: '🍎'
    };
    return icons[type] || '🍽️';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const caloriePercentage = dailySummary?.caloriePercentage || 0;
  const waterGoal = 8; // 8 glasses per day

  return (
    <>
      <div className={`fixed inset-0 bg-gradient-to-b from-blue-50 to-white overflow-y-auto ${showAddMeal ? 'overflow-hidden' : ''}`}>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Nutrition</h1>
            <p className="text-xs text-gray-600">Track your daily intake</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-sm">{user?.name?.[0]?.toUpperCase()}</span>
          </div>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
          <Calendar className="w-4 h-4 text-gray-600" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent text-sm font-medium text-gray-900 outline-none flex-1"
          />
        </div>
      </div>

      <div className="px-3 py-4 space-y-4 pb-24">
        {/* Goal Check */}
        {!healthGoal && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-900 mb-2">Set Your Fitness Goal</p>
              <button
                onClick={() => navigate('/profile?tab=goals')}
                className="text-sm bg-amber-600 text-white px-3 py-1 rounded-lg hover:bg-amber-700"
              >
                Set Goal Now
              </button>
            </div>
          </div>
        )}

        {/* Calories Overview */}
        {dailySummary && healthGoal && (
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-blue-100 text-sm mb-1">Calories Today</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">{dailySummary.totalCalories}</span>
                  <span className="text-blue-100">/ {healthGoal.dailyCalorieTarget}</span>
                </div>
              </div>
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="white"
                    strokeWidth="3"
                    strokeDasharray={`${Math.min(caloriePercentage, 100)}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold">{Math.min(caloriePercentage, 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>

            {/* Macros */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/20 rounded-xl p-3 text-center">
                <p className="text-xs text-blue-100 mb-1">Protein</p>
                <p className="font-bold">{dailySummary.totalProtein.toFixed(0)}g</p>
                <p className="text-xs text-blue-100">/ {healthGoal.macroTargets.protein}g</p>
              </div>
              <div className="bg-white/20 rounded-xl p-3 text-center">
                <p className="text-xs text-blue-100 mb-1">Carbs</p>
                <p className="font-bold">{dailySummary.totalCarbs.toFixed(0)}g</p>
                <p className="text-xs text-blue-100">/ {healthGoal.macroTargets.carbs}g</p>
              </div>
              <div className="bg-white/20 rounded-xl p-3 text-center">
                <p className="text-xs text-blue-100 mb-1">Fats</p>
                <p className="font-bold">{dailySummary.totalFats.toFixed(0)}g</p>
                <p className="text-xs text-blue-100">/ {healthGoal.macroTargets.fats}g</p>
              </div>
            </div>
          </div>
        )}

        {/* Water Intake */}
        <div className="bg-gradient-to-br from-cyan-400 to-blue-500 rounded-3xl p-6 text-white shadow-lg">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-cyan-100 text-sm mb-1">Water Reminder</p>
              <p className="text-2xl font-bold">Drink water stay hydrated</p>
            </div>
            <div className="text-4xl">💧</div>
          </div>

          <p className="text-cyan-100 mb-4">Today you drink <span className="font-bold text-white">{waterIntake} glass</span> of water</p>
          <p className="text-cyan-100 mb-4 text-sm">{(waterIntake * 0.25).toFixed(2)} L</p>

          {/* Water Glasses */}
          <div className="grid grid-cols-6 gap-2 mb-4">
            {Array.from({ length: waterGoal }).map((_, i) => (
              <div
                key={i}
                onClick={() => i < waterIntake ? handleRemoveWater() : handleAddWater()}
                className={`aspect-square rounded-lg flex items-center justify-center cursor-pointer transition-all transform hover:scale-110 ${
                  i < waterIntake
                    ? 'bg-white text-blue-500 shadow-lg'
                    : 'bg-white/30 text-white'
                }`}
              >
                <Droplets className="w-5 h-5" />
              </div>
            ))}
          </div>

          <button
            onClick={handleAddWater}
            className="w-full bg-white text-blue-600 font-bold py-2 rounded-xl hover:bg-blue-50 transition-all"
          >
            + Add Water
          </button>
        </div>

        {/* Quick Food Check */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">Quick Check</h2>
          <QuickFoodCheck />
        </div>

        {/* Meals Section */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">My Daily Target</h2>

          {/* Meal Cards */}
          <div className="space-y-3">
            {['breakfast', 'lunch', 'snack', 'dinner'].map((type) => {
              const mealLogs = todayLogs.filter(log => log.mealType === type);
              const mealCalories = mealLogs.reduce((sum, log) => sum + (log.totalNutrition?.calories || 0), 0);

              return (
                <div key={type} className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 text-white shadow-md">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm opacity-90 capitalize">{type}</p>
                      <p className="text-2xl font-bold">{mealCalories} Kcal</p>
                    </div>
                    <span className="text-3xl">{getMealIcon(type)}</span>
                  </div>

                  {mealLogs.length > 0 ? (
                    <div className="space-y-2 mb-3">
                      {mealLogs.map((log) => (
                        <div key={log._id} className="bg-white/20 rounded-lg p-2 flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{log.foodItems?.[0]?.name || 'Food'}</p>
                            <p className="text-xs opacity-75">{log.totalNutrition?.calories} cal</p>
                          </div>
                          <button
                            onClick={() => deleteMeal(log._id)}
                            className="p-1 hover:bg-white/30 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <button
                    onClick={() => {
                      if (!healthGoal) {
                        toast.error('Please set your fitness goal first');
                        return;
                      }
                      setMealType(type);
                      setShowAddMeal(true);
                      setMealTypeToAdd(type);
                    }}
                    className="w-full bg-white/30 hover:bg-white/40 text-white font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Add {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Meal Modal */}
      {showAddMeal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end pb-20">
          <div className="bg-white w-full rounded-t-3xl p-6 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Add {mealType.charAt(0).toUpperCase() + mealType.slice(1)}</h2>
              <button
                onClick={() => {
                  setShowAddMeal(false);
                  setFoodDescription('');
                  setAnalysisResult(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {!analysisResult ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Food Item</label>
                  <input
                    type="text"
                    value={foodDescription}
                    onChange={(e) => setFoodDescription(e.target.value)}
                    placeholder="e.g., Chicken rice with vegetables"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <button
                  onClick={analyzeFood}
                  disabled={analyzing || !foodDescription.trim()}
                  className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Flame className="w-5 h-5" />
                      Analyze Food
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Nutrition Card */}
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 text-white">
                  <h3 className="font-bold text-white mb-4">{analysisResult.foodItem?.name}</h3>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-white/20 rounded-xl p-3 text-center">
                      <Flame className="w-5 h-5 text-orange-300 mx-auto mb-1" />
                      <p className="text-xs text-blue-100">Calories</p>
                      <p className="text-xl font-bold text-white">{analysisResult.foodItem?.nutrition?.calories || 0}</p>
                    </div>
                    <div className="bg-white/20 rounded-xl p-3 text-center">
                      <Heart className="w-5 h-5 text-red-300 mx-auto mb-1" />
                      <p className="text-xs text-blue-100">Protein</p>
                      <p className="text-xl font-bold text-white">{analysisResult.foodItem?.nutrition?.protein || 0}g</p>
                    </div>
                    <div className="bg-white/20 rounded-xl p-3 text-center">
                      <Zap className="w-5 h-5 text-yellow-300 mx-auto mb-1" />
                      <p className="text-xs text-blue-100">Carbs</p>
                      <p className="text-xl font-bold text-white">{analysisResult.foodItem?.nutrition?.carbs || 0}g</p>
                    </div>
                    <div className="bg-white/20 rounded-xl p-3 text-center">
                      <Droplets className="w-5 h-5 text-cyan-300 mx-auto mb-1" />
                      <p className="text-xs text-blue-100">Fats</p>
                      <p className="text-xl font-bold text-white">{analysisResult.foodItem?.nutrition?.fats || 0}g</p>
                    </div>
                  </div>

                  {analysisResult.isHealthy ? (
                    <div className="flex items-center gap-2 text-white bg-white/20 px-3 py-2 rounded-lg">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">Healthy Choice</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-white bg-white/20 px-3 py-2 rounded-lg">
                      <AlertCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">Not Ideal</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setAnalysisResult(null);
                      setFoodDescription('');
                    }}
                    className="flex-1 bg-gray-200 text-gray-900 font-bold py-3 rounded-xl hover:bg-gray-300"
                  >
                    Back
                  </button>
                  <button
                    onClick={logMeal}
                    className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Log Meal
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
