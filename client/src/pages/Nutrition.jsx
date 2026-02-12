import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Loader2, Plus, Trash2, X, Droplets, Flame, Zap, Heart,
  AlertCircle, CheckCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import QuickFoodCheck from '../components/QuickFoodCheck';

export default function Nutrition() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [todayLogs, setTodayLogs] = useState([]);
  const [dailySummary, setDailySummary] = useState(null);
  const [healthGoal, setHealthGoal] = useState(null);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [waterIntake, setWaterIntake] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Add meal form state - Enhanced
  const [mealType, setMealType] = useState('breakfast');
  const [foodDescription, setFoodDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  
  // Smart suggestions state
  const [quantity, setQuantity] = useState('');
  const [servingSize, setServingSize] = useState('medium');
  const [preparationMethod, setPreparationMethod] = useState('homemade');
  const [foodItems, setFoodItems] = useState([]);
  const [showQuantitySuggestions, setShowQuantitySuggestions] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  // Handle hash navigation for smooth scroll to daily target
  useEffect(() => {
    if (window.location.hash === '#daily-target') {
      setTimeout(() => {
        document.getElementById('daily-target')?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 100);
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
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
    const newWater = waterIntake + 1;
    setWaterIntake(newWater);
    localStorage.setItem(`waterIntake_${selectedDate}`, newWater);
    
    // Check for excessive water consumption (8-9 liters = 32-36 glasses)
    if (newWater >= 32 && newWater <= 36) {
      toast('⚠️ You are approaching 8 liters of water. Be mindful of overhydration!', {
        icon: '💧',
        duration: 5000,
        style: {
          background: '#fef3c7',
          color: '#92400e',
          border: '2px solid #fbbf24'
        }
      });
    } else if (newWater > 36) {
      toast.error('🚨 Warning: You have consumed more than 9 liters of water today! Excessive water intake can be harmful. Please consult a doctor if you feel unwell.', {
        duration: 7000,
        style: {
          background: '#fee2e2',
          color: '#991b1b',
          border: '2px solid #ef4444'
        }
      });
    } else {
      toast.success('Water intake updated! 💧');
    }
  };

  const handleRemoveWater = () => {
    if (waterIntake > 0) {
      const newWater = waterIntake - 1;
      setWaterIntake(newWater);
      localStorage.setItem(`waterIntake_${selectedDate}`, newWater);
    }
  };

  // Smart quantity suggestions based on food type
  const getQuantitySuggestions = (foodName) => {
    const lowerFood = foodName.toLowerCase();
    
    // Liquids
    if (lowerFood.includes('juice') || lowerFood.includes('milk') || lowerFood.includes('water') || lowerFood.includes('tea') || lowerFood.includes('coffee')) {
      return ['1 cup (250ml)', '1 glass (200ml)', '1 bottle (500ml)', '2 cups (500ml)'];
    }
    
    // Rice/Grains
    if (lowerFood.includes('rice') || lowerFood.includes('pasta') || lowerFood.includes('noodles')) {
      return ['1 cup', '1.5 cups', '2 cups', '1 bowl'];
    }
    
    // Bread/Roti
    if (lowerFood.includes('bread') || lowerFood.includes('roti') || lowerFood.includes('chapati') || lowerFood.includes('paratha')) {
      return ['1 piece', '2 pieces', '3 pieces', '4 pieces'];
    }
    
    // Fruits
    if (lowerFood.includes('apple') || lowerFood.includes('banana') || lowerFood.includes('orange') || lowerFood.includes('mango')) {
      return ['1 small', '1 medium', '1 large', '2 pieces'];
    }
    
    // Eggs
    if (lowerFood.includes('egg')) {
      return ['1 egg', '2 eggs', '3 eggs', '4 eggs'];
    }
    
    // Chicken/Meat
    if (lowerFood.includes('chicken') || lowerFood.includes('meat') || lowerFood.includes('fish')) {
      return ['100g', '150g', '200g', '1 piece'];
    }
    
    // Default
    return ['1 serving', '1 plate', '1 bowl', '1 cup'];
  };

  const addFoodItem = () => {
    if (!analysisResult || !quantity) {
      toast.error('Please analyze food and select quantity');
      return;
    }

    const newItem = {
      ...analysisResult.foodItem,
      quantity,
      servingSize,
      preparationMethod,
      id: Date.now()
    };

    setFoodItems([...foodItems, newItem]);
    setFoodDescription('');
    setAnalysisResult(null);
    setQuantity('');
    setShowQuantitySuggestions(false);
    toast.success('Food item added!');
  };

  const removeFoodItem = (id) => {
    setFoodItems(foodItems.filter(item => item.id !== id));
    toast.success('Item removed');
  };

  const analyzeFood = async () => {
    if (!foodDescription.trim()) {
      toast.error('Please enter a food item');
      return;
    }

    setAnalyzing(true);
    try {
      const token = localStorage.getItem('token');
      
      // Build enhanced description with serving size and preparation
      const enhancedDescription = `${servingSize} ${preparationMethod} ${foodDescription}`;
      
      const response = await axios.post(
        '/api/nutrition/quick-check',
        { foodDescription: enhancedDescription },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setAnalysisResult(response.data.data);
      setShowQuantitySuggestions(true);
      toast.success('Food analyzed!');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze food');
    } finally {
      setAnalyzing(false);
    }
  };

  const logMeal = async () => {
    if (foodItems.length === 0) {
      toast.error('Please add at least one food item');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        '/api/nutrition/log-meal',
        {
          mealType,
          foodItems: foodItems.map(item => ({
            ...item,
            notes: `${item.quantity} - ${item.servingSize} - ${item.preparationMethod}`
          })),
          notes: `${foodItems.length} items logged`
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Meal logged successfully!');
      setShowAddMeal(false);
      setFoodDescription('');
      setAnalysisResult(null);
      setFoodItems([]);
      setQuantity('');
      setServingSize('medium');
      setPreparationMethod('homemade');
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

  const handlePreviousDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    const nextDate = date.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    
    // Don't allow future dates
    if (nextDate > today) {
      toast.error('Cannot view future dates');
      return;
    }
    
    setSelectedDate(nextDate);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dateStr === today.toISOString().split('T')[0]) return 'Today';
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (isInitialLoad && loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const caloriePercentage = dailySummary?.caloriePercentage || 0;
  const waterGoal = 8; // 8 glasses per day
  const today = new Date().toISOString().split('T')[0];
  const isToday = selectedDate === today;

  return (
    <div className={`w-full h-full bg-gradient-to-br from-cyan-50 via-blue-50 to-cyan-100 flex flex-col ${showAddMeal ? 'overflow-hidden' : ''}`}>
      {/* Subtle refresh indicator */}
      {loading && !isInitialLoad && (
        <div className="fixed top-20 right-4 z-50 bg-white rounded-full shadow-lg px-4 py-2 flex items-center gap-2 animate-slide-in-right">
          <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          <span className="text-sm text-slate-600">Refreshing...</span>
        </div>
      )}
      
      {/* Date Picker Header */}
      <div className="w-full px-3 md:px-6 lg:px-8 py-3 flex items-center justify-between bg-white border-b border-gray-200 sticky top-0 z-10 shrink-0">
        <button
          onClick={handlePreviousDay}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="text-center">
          <p className="text-sm text-gray-500">Nutrition</p>
          <p className="text-lg font-bold text-gray-900">{formatDate(selectedDate)}</p>
        </div>
        <button
          onClick={handleNextDay}
          disabled={isToday}
          className={`p-2 rounded-lg transition ${
            isToday 
              ? 'opacity-40 cursor-not-allowed' 
              : 'hover:bg-gray-100'
          }`}
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Main Content with Max Width on Desktop */}
      <div className="w-full flex-1 overflow-y-auto flex justify-center">
        <div className="w-full max-w-4xl px-3 md:px-6 lg:px-8 py-4 space-y-4 pb-24">
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
        <div id="daily-target" className="scroll-mt-20">
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
      </div>

      {/* Add Meal Modal */}
      {showAddMeal && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center md:justify-center"
          onClick={() => {
            setShowAddMeal(false);
            setFoodDescription('');
            setAnalysisResult(null);
            setFoodItems([]);
            setQuantity('');
            setServingSize('medium');
            setPreparationMethod('homemade');
            setShowQuantitySuggestions(false);
          }}
        >
          <div 
            className="bg-white w-full md:w-full md:max-w-2xl rounded-t-3xl md:rounded-3xl p-6 max-h-[85vh] md:max-h-[90vh] overflow-y-auto md:mb-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Add {mealType.charAt(0).toUpperCase() + mealType.slice(1)}</h2>
              <button
                onClick={() => {
                  setShowAddMeal(false);
                  setFoodDescription('');
                  setAnalysisResult(null);
                  setFoodItems([]);
                  setQuantity('');
                  setServingSize('medium');
                  setPreparationMethod('homemade');
                  setShowQuantitySuggestions(false);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Added Food Items List */}
            {foodItems.length > 0 && (
              <div className="mb-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-700">Added Items ({foodItems.length})</h3>
                {foodItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.quantity} • {item.servingSize} • {item.preparationMethod}</p>
                      <p className="text-xs text-gray-600 mt-1">{item.nutrition?.calories || 0} cal</p>
                    </div>
                    <button
                      onClick={() => removeFoodItem(item.id)}
                      className="p-2 hover:bg-red-100 rounded-lg text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!analysisResult ? (
              <div className="space-y-4">
                {/* Serving Size */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Serving Size</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['small', 'medium', 'large'].map((size) => (
                      <button
                        key={size}
                        onClick={() => setServingSize(size)}
                        className={`py-2 px-4 rounded-lg font-medium transition-all ${
                          servingSize === size
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {size.charAt(0).toUpperCase() + size.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preparation Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Preparation Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['homemade', 'baked', 'fried', 'grilled', 'steamed', 'raw'].map((method) => (
                      <button
                        key={method}
                        onClick={() => setPreparationMethod(method)}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                          preparationMethod === method
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {method.charAt(0).toUpperCase() + method.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Food Item</label>
                  <input
                    type="text"
                    value={foodDescription}
                    onChange={(e) => setFoodDescription(e.target.value)}
                    placeholder="e.g., Chicken rice with vegetables"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    onKeyPress={(e) => e.key === 'Enter' && analyzeFood()}
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

                {/* Quantity Selection */}
                {showQuantitySuggestions && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Quantity</label>
                    <div className="grid grid-cols-2 gap-2">
                      {getQuantitySuggestions(analysisResult.foodItem?.name || '').map((qty) => (
                        <button
                          key={qty}
                          onClick={() => setQuantity(qty)}
                          className={`py-3 px-4 rounded-lg font-medium transition-all ${
                            quantity === qty
                              ? 'bg-cyan-600 text-white ring-2 ring-cyan-300'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                      placeholder="Or enter custom quantity"
                      className="w-full mt-2 px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-cyan-500 focus:outline-none text-sm"
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setAnalysisResult(null);
                      setFoodDescription('');
                      setQuantity('');
                      setShowQuantitySuggestions(false);
                    }}
                    className="flex-1 bg-gray-200 text-gray-900 font-bold py-3 rounded-xl hover:bg-gray-300"
                  >
                    Back
                  </button>
                  <button
                    onClick={addFoodItem}
                    disabled={!quantity}
                    className="flex-1 bg-cyan-600 text-white font-bold py-3 rounded-xl hover:bg-cyan-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Add Item
                  </button>
                </div>
              </div>
            )}

            {/* Log All Button */}
            {foodItems.length > 0 && !analysisResult && (
              <button
                onClick={logMeal}
                className="w-full mt-4 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Log {foodItems.length} Item{foodItems.length > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
