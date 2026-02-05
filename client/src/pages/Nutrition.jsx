import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Camera, Upload, Loader2, Plus, Trash2, Edit2, TrendingUp,
  Apple, Flame, Droplets, Activity, Target, ChevronDown, ChevronUp,
  Sparkles, Calendar, Search, AlertCircle, CheckCircle, Lightbulb, X
} from 'lucide-react';
import QuickFoodCheck from '../components/QuickFoodCheck';

export default function Nutrition() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [todayLogs, setTodayLogs] = useState([]);
  const [dailySummary, setDailySummary] = useState(null);
  const [healthGoal, setHealthGoal] = useState(null);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [expandedLog, setExpandedLog] = useState(null);
  const [editingLog, setEditingLog] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [activityData, setActivityData] = useState([]);
  const [showGoalModal, setShowGoalModal] = useState(false);

  // Quick Food Check State
  const [quickCheckFood, setQuickCheckFood] = useState('');
  const [quickCheckResult, setQuickCheckResult] = useState(() => {
    // Load persisted quick check result from localStorage
    const saved = localStorage.getItem('quickCheckResult');
    return saved ? JSON.parse(saved) : null;
  });
  const [checkingFood, setCheckingFood] = useState(false);
  const [quickCheckImage, setQuickCheckImage] = useState(null);
  const [quickCheckImagePreview, setQuickCheckImagePreview] = useState(null);
  const [showQuantitySuggestion, setShowQuantitySuggestion] = useState(false);
  const [suggestedUnit, setSuggestedUnit] = useState('');
  
  // Date selection for viewing meals
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Add meal form state
  const [mealType, setMealType] = useState('breakfast');
  const [foodDescription, setFoodDescription] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);

  useEffect(() => {
    fetchData();
  }, [selectedDate]); // Refetch when date changes

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Check if selected date is today
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

      // Fetch last 7 days activity data
      try {
        const activityRes = await axios.get('/api/nutrition/activity/week', { headers });
        setActivityData(activityRes.data.weekData || []);
      } catch (error) {
        console.log('Activity data not available');
        setActivityData([]);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load nutrition data');
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeFood = async () => {
    if (!foodDescription && !imageFile) {
      toast.error('Please provide food description or image');
      return;
    }

    setAnalyzing(true);
    try {
      const token = localStorage.getItem('token');
      
      let imageBase64 = null;
      if (imageFile) {
        const reader = new FileReader();
        imageBase64 = await new Promise((resolve) => {
          reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
          };
          reader.readAsDataURL(imageFile);
        });
      }

      const response = await axios.post(
        '/api/nutrition/analyze-food',
        {
          foodDescription: foodDescription || undefined,
          imageBase64,
          additionalContext: foodDescription || undefined
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setAnalysisResult(response.data.analysis);
      toast.success('Food analyzed successfully!');
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
          foodItems: analysisResult.foodItems,
          imageUrl: imagePreview,
          notes: foodDescription
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      toast.success('Meal logged successfully!');
      setShowAddMeal(false);
      resetForm();
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

  const resetForm = () => {
    setMealType('breakfast');
    setFoodDescription('');
    setImageFile(null);
    setImagePreview(null);
    setAnalysisResult(null);
  };

  const handleEditMeal = (log) => {
    setEditingLog(log._id);
    setEditFormData({
      mealType: log.mealType,
      foodDescription: log.foodItems.map(item => `${item.name} (${item.quantity})`).join(', '),
      totalCalories: log.totalNutrition.calories,
      totalProtein: log.totalNutrition.protein,
      totalCarbs: log.totalNutrition.carbs,
      totalFats: log.totalNutrition.fats
    });
  };

  const saveEditedMeal = async () => {
    if (!editFormData) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `/api/nutrition/logs/${editingLog}`,
        {
          mealType: editFormData.mealType,
          notes: editFormData.foodDescription
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Meal updated successfully!');
      setEditingLog(null);
      setEditFormData(null);
      fetchData();
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Failed to update meal');
    }
  };

  const handleQuickCheckImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setQuickCheckImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setQuickCheckImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Smart quantity suggestion - works for ALL foods
  const getQuantitySuggestion = (foodText) => {
    const text = foodText.toLowerCase();
    
    // Check if quantity is already mentioned
    const hasQuantity = /\d+/.test(text) || 
                       text.includes('bowl') || text.includes('plate') || 
                       text.includes('cup') || text.includes('glass') ||
                       text.includes('slice') || text.includes('piece') ||
                       text.includes('gram') || text.includes('kg') ||
                       text.includes('ml') || text.includes('litre');
    
    if (hasQuantity) {
      return { show: false, unit: '', examples: '' };
    }
    
    // Liquids - ml, litre, glass, cup
    const liquids = ['juice', 'milk', 'water', 'tea', 'coffee', 'smoothie', 'shake', 'lassi', 'buttermilk', 'soup', 'dal', 'curry', 'gravy', 'kadhi', 'rasam', 'sambhar'];
    if (liquids.some(liquid => text.includes(liquid))) {
      return { show: true, examples: '💡 Add quantity: e.g., 250ml, 1 glass, 2 cups' };
    }
    
    // Sliced items - slices, pieces
    const sliced = ['pizza', 'bread', 'toast', 'cake', 'pie', 'sandwich', 'paratha', 'naan'];
    if (sliced.some(item => text.includes(item))) {
      return { show: true, examples: '💡 Add quantity: e.g., 2 slices, 1 piece' };
    }
    
    // Weight-based - grams, kg
    const weighted = ['rice', 'roti', 'chapati', 'chicken', 'fish', 'meat', 'paneer', 'vegetables', 'salad', 'pasta', 'noodles', 'biryani', 'pulao', 'khichdi'];
    if (weighted.some(item => text.includes(item))) {
      return { show: true, examples: '💡 Add quantity: e.g., 100g, 1 bowl, 1 plate' };
    }
    
    // Countable items - pieces, numbers
    const countable = ['egg', 'banana', 'apple', 'orange', 'samosa', 'pakora', 'biscuit', 'cookie', 'idli', 'dosa', 'vada', 'gulab jamun', 'ladoo'];
    if (countable.some(item => text.includes(item))) {
      return { show: true, examples: '💡 Add quantity: e.g., 2 pieces, 1 banana' };
    }
    
    // Default suggestion for ANY food not matched above
    return { 
      show: true, 
      examples: '💡 Add quantity for accurate results: e.g., 100g, 1 bowl, 2 pieces, 250ml' 
    };
  };

  const handleFoodInputChange = (e) => {
    const value = e.target.value;
    setQuickCheckFood(value);
    
    // Show suggestion if user has typed at least 3 characters
    if (value.length >= 3) {
      const suggestion = getQuantitySuggestion(value);
      setShowQuantitySuggestion(suggestion.show);
      setSuggestedUnit(suggestion.examples);
    } else {
      setShowQuantitySuggestion(false);
      setSuggestedUnit('');
    }
  };

  const handleQuickCheck = async () => {
    if (!quickCheckFood.trim() && !quickCheckImage) {
      toast.error('Please enter a food item or upload an image');
      return;
    }

    // Check if user has set a health goal
    if (!healthGoal) {
      setShowGoalModal(true);
      return;
    }

    setCheckingFood(true);
    try {
      const token = localStorage.getItem('token');
      
      let imageBase64 = null;
      if (quickCheckImage) {
        try {
          const reader = new FileReader();
          imageBase64 = await new Promise((resolve, reject) => {
            reader.onloadend = () => {
              const base64 = reader.result.split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(quickCheckImage);
          });
        } catch (error) {
          console.error('Image read error:', error);
          toast.error('Failed to read image file');
          setCheckingFood(false);
          return;
        }
      }

      const response = await axios.post(
        '/api/nutrition/quick-check',
        { 
          foodDescription: quickCheckFood || undefined,
          imageBase64,
          additionalContext: quickCheckFood || undefined
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const result = response.data;
      setQuickCheckResult(result);
      
      // Persist to localStorage
      localStorage.setItem('quickCheckResult', JSON.stringify(result));
      
      toast.success('Food analyzed!');
      setShowQuantitySuggestion(false);
    } catch (error) {
      console.error('Quick check error:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Failed to analyze food';
      toast.error(errorMsg);
    } finally {
      setCheckingFood(false);
    }
  };

  const clearQuickCheck = () => {
    setQuickCheckResult(null);
    setQuickCheckFood('');
    setQuickCheckImage(null);
    setQuickCheckImagePreview(null);
    localStorage.removeItem('quickCheckResult');
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

  const getProgressColor = (percentage) => {
    if (percentage < 80) return 'bg-amber-500';
    if (percentage <= 110) return 'bg-green-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  const caloriePercentage = dailySummary?.caloriePercentage || 0;
  const proteinPercentage = dailySummary?.proteinPercentage || 0;
  const carbsPercentage = dailySummary?.carbsPercentage || 0;
  const fatsPercentage = dailySummary?.fatsPercentage || 0;

  // Goal Modal Component
  const GoalModal = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4">
        {/* Close Button */}
        <button
          onClick={() => setShowGoalModal(false)}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        {/* Icon */}
        <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Target className="w-8 h-8 text-amber-600" />
        </div>

        {/* Content */}
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Set Your Fitness Goal</h2>
        <p className="text-gray-600 text-center mb-6">
          To track your nutrition accurately, we need to know your fitness goal. This helps us calculate your daily calorie and macro targets.
        </p>

        {/* Benefits List */}
        <div className="space-y-3 mb-8 bg-blue-50 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-gray-700">Personalized calorie targets</span>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-gray-700">Macro nutrient recommendations</span>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-gray-700">Track progress towards your goal</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowGoalModal(false)}
            className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
          >
            Maybe Later
          </button>
          <button
            onClick={() => {
              setShowGoalModal(false);
              navigate('/profile?tab=goals');
            }}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Target className="w-5 h-5" />
            Set Goal
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in w-full overflow-x-hidden">
      {/* Your Activity Card - Responsive */}
      <div className="bg-white rounded-2xl p-3 md:p-6 shadow-sm border border-[#E5DFD3] w-full overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-bold text-[#2C2416]">Your Activity</h2>
          <div className="flex items-center gap-1 text-sm md:text-base text-[#5C4F3D] bg-[#F5F1EA] px-2 md:px-3 py-2 rounded-lg cursor-pointer hover:bg-[#E5DFD3] flex-shrink-0">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs md:text-sm text-[#2C2416] cursor-pointer outline-none w-24 md:w-32"
            />
          </div>
        </div>

          {/* Daily Intake Card - Responsive */}
          {dailySummary && healthGoal ? (
            <div className="bg-gradient-to-br from-[#E8F5E9] to-[#C8E6C9] rounded-2xl p-4 md:p-6 mb-4 w-full overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-[#2E7D32]" />
                <span className="text-sm md:text-base font-medium text-[#2E7D32]">Daily Intake</span>
              </div>
              
              {/* Mobile View - List Layout */}
              <div className="md:hidden flex flex-col items-center gap-6 w-full">
                {/* Circular Progress */}
                <div className="relative w-24 h-24 flex-shrink-0">
                  <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#2E7D32"
                      strokeWidth="3"
                      strokeDasharray={`${Math.min(caloriePercentage, 100)}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-[#1B5E20]">{dailySummary.totalCalories}</span>
                    <span className="text-[10px] text-[#2E7D32]">kcal</span>
                  </div>
                </div>

                {/* Macros - Mobile List */}
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0"></div>
                      <span className="text-xs text-[#2E7D32] truncate">Protein</span>
                    </div>
                    <span className="text-xs font-bold text-[#1B5E20] flex-shrink-0 whitespace-nowrap">
                      {(dailySummary.totalProtein).toFixed(2)}/{healthGoal.macroTargets.protein}g
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-3 h-3 bg-orange-500 rounded-full flex-shrink-0"></div>
                      <span className="text-xs text-[#2E7D32] truncate">Carbs</span>
                    </div>
                    <span className="text-xs font-bold text-[#1B5E20] flex-shrink-0 whitespace-nowrap">
                      {(dailySummary.totalCarbs).toFixed(2)}/{healthGoal.macroTargets.carbs}g
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></div>
                      <span className="text-xs text-[#2E7D32] truncate">Fats</span>
                    </div>
                    <span className="text-xs font-bold text-[#1B5E20] flex-shrink-0 whitespace-nowrap">
                      {(dailySummary.totalFats).toFixed(2)}/{healthGoal.macroTargets.fats}g
                    </span>
                  </div>
                </div>
              </div>

              {/* Desktop View - Circle Layout */}
              <div className="hidden md:flex md:items-center md:justify-between gap-8 w-full">
                {/* Calories Circle */}
                <div className="relative w-32 h-32 flex-shrink-0">
                  <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#2E7D32"
                      strokeWidth="3"
                      strokeDasharray={`${Math.min(caloriePercentage, 100)}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-[#1B5E20]">{dailySummary.totalCalories}</span>
                    <span className="text-xs text-[#2E7D32]">kcal</span>
                  </div>
                </div>

                {/* Protein Circle */}
                <div className="relative w-28 h-28 flex-shrink-0">
                  <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#EF4444"
                      strokeWidth="3"
                      strokeDasharray={`${Math.min(proteinPercentage, 100)}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-[#1B5E20]">{(dailySummary.totalProtein).toFixed(0)}</span>
                    <span className="text-[10px] text-[#2E7D32]">g</span>
                  </div>
                </div>

                {/* Carbs Circle */}
                <div className="relative w-28 h-28 flex-shrink-0">
                  <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#F97316"
                      strokeWidth="3"
                      strokeDasharray={`${Math.min(carbsPercentage, 100)}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-[#1B5E20]">{(dailySummary.totalCarbs).toFixed(0)}</span>
                    <span className="text-[10px] text-[#2E7D32]">g</span>
                  </div>
                </div>

                {/* Fats Circle */}
                <div className="relative w-28 h-28 flex-shrink-0">
                  <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="3"
                      strokeDasharray={`${Math.min(fatsPercentage, 100)}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-[#1B5E20]">{(dailySummary.totalFats).toFixed(0)}</span>
                    <span className="text-[10px] text-[#2E7D32]">g</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-col gap-3 ml-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-sm text-[#2E7D32]">Protein: {(dailySummary.totalProtein).toFixed(2)}/{healthGoal.macroTargets.protein}g</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <span className="text-sm text-[#2E7D32]">Carbs: {(dailySummary.totalCarbs).toFixed(2)}/{healthGoal.macroTargets.carbs}g</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm text-[#2E7D32]">Fats: {(dailySummary.totalFats).toFixed(2)}/{healthGoal.macroTargets.fats}g</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <Target className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-900 mb-1">Set Your Health Goal</h3>
                  <p className="text-sm text-amber-700 mb-3">
                    Set your health goals to get personalized calorie and macro targets.
                  </p>
                  <Link 
                    to="/profile"
                    className="inline-block px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium"
                  >
                    Set Goals Now
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Activity & Meals Summary Row - Responsive */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            {/* Activity - 7 Day Chart */}
            <div className="bg-white rounded-xl p-4 border border-[#E5DFD3] overflow-hidden">
              <h3 className="text-sm md:text-base font-medium text-[#2C2416] mb-1">Activity</h3>
              <p className="text-xs text-[#5C4F3D] mb-3">Last 7 days calorie intake</p>
              <div className="flex items-end gap-1 mb-3 justify-center md:justify-start h-20">
                {activityData && activityData.length > 0 ? (
                  activityData.map((day, idx) => {
                    const isToday = new Date(day.date).toDateString() === new Date().toDateString();
                    const goalCalories = healthGoal?.macroTargets?.calories || healthGoal?.dailyCalorieTarget || 2000;
                    const maxCalories = Math.max(...activityData.map(d => d.calories || 0), goalCalories);
                    const heightPercent = (day.calories / maxCalories) * 100;
                    return (
                      <div
                        key={idx}
                        className={`flex-1 rounded-t transition-all group relative cursor-pointer ${
                          isToday ? 'bg-[#2E7D32]' : 'bg-[#8B7355]'
                        }`}
                        style={{ height: `${Math.max(heightPercent, 10)}%` }}
                        title={`${new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}: ${day.calories} kcal`}
                      >
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-[#2C2416] text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          {day.calories} kcal
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="w-full flex items-center justify-center text-[#5C4F3D] text-sm">
                    No data available
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <span className="text-lg md:text-xl font-bold text-[#2C2416]">
                  {dailySummary?.totalCalories || 0}
                </span>
                <span className="text-sm md:text-base text-[#5C4F3D]">Kcal (Today)</span>
                <TrendingUp className="w-4 h-4 text-[#2E7D32]" />
              </div>
            </div>

            {/* Meals Summary */}
            <div className="bg-white rounded-xl p-4 border border-[#E5DFD3] overflow-hidden">
              <h3 className="text-sm md:text-base font-medium text-[#2C2416] mb-3">Meals Summary</h3>
              <p className="text-xs md:text-sm text-[#5C4F3D] mb-3">Logged meals today</p>
              <div className="flex items-center gap-2 flex-wrap">
                {todayLogs.length === 0 ? (
                  <p className="text-xs text-[#5C4F3D]">No meals logged yet</p>
                ) : (
                  <>
                    {todayLogs.slice(0, 3).map((log, idx) => (
                      <div key={idx} className="group relative">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-xs font-bold cursor-pointer hover:shadow-lg transition-shadow">
                          {log.mealType.charAt(0).toUpperCase()}
                        </div>
                        <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-[#2C2416] text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          {log.mealType}: {log.totalNutrition.calories} cal
                        </div>
                      </div>
                    ))}
                    {todayLogs.length > 3 && (
                      <div className="text-xs text-[#5C4F3D] font-medium">+{todayLogs.length - 3}</div>
                    )}
                  </>
                )}
                <button 
                  onClick={() => setShowAddMeal(true)}
                  className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#8B7355] text-white flex items-center justify-center text-lg md:text-xl font-medium hover:bg-[#A0826D] transition-colors"
                  title="Add new meal"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

      {/* Quick Food Check Component */}
      <QuickFoodCheck />

      {/* Recently Logged - Responsive */}
      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-[#E5DFD3] overflow-hidden w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-semibold text-[#2C2416]">Recently logged</h2>
          <button
            onClick={() => setShowAddMeal(true)}
            className="p-2 bg-[#8B7355] text-white rounded-full hover:bg-[#A0826D] flex-shrink-0"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

          {todayLogs.length === 0 ? (
            <div className="text-center py-8">
              <Apple className="w-12 h-12 text-[#E5DFD3] mx-auto mb-3" />
              <p className="text-[#5C4F3D] mb-3">No meals logged today</p>
              <button
                onClick={() => setShowAddMeal(true)}
                className="px-4 py-2 bg-[#8B7355] text-white rounded-lg hover:bg-[#A0826D] text-sm"
              >
                Log Your First Meal
              </button>
            </div>
          ) : (
            <div className="space-y-3 overflow-x-hidden">
              {todayLogs.map((log) => (
                <div key={log._id} className="flex items-center gap-2 md:gap-3 p-3 md:p-4 bg-[#F5F1EA] rounded-xl hover:bg-[#E5DFD3] transition-colors overflow-hidden">
                  {/* Food Image Placeholder */}
                  <div className="w-14 h-14 md:w-20 md:h-20 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex-shrink-0"></div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm md:text-base text-[#2C2416] capitalize truncate">
                      {log.foodItems[0]?.name || log.mealType}
                    </h3>
                    <div className="flex items-center gap-2 md:gap-3 text-[10px] md:text-xs text-[#5C4F3D] mt-1 overflow-x-auto">
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                        <span>{log.totalNutrition.protein}g</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                        <span>{log.totalNutrition.carbs}g</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                        <span>{log.totalNutrition.fats}g</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm md:text-base font-semibold text-[#2C2416]">{log.totalNutrition.calories}</p>
                    <p className="text-xs md:text-sm text-[#5C4F3D]">kcal</p>
                  </div>
                  
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleEditMeal(log)}
                      className="p-1.5 md:p-2 text-[#5C4F3D] hover:text-[#8B7355] rounded-lg hover:bg-white transition-colors"
                      title="Edit meal"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteMeal(log._id)}
                      className="p-1.5 md:p-2 text-[#5C4F3D] hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      title="Delete meal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      {/* Bottom Navigation Spacer */}
      <div className="h-6 md:h-0"></div>

      {/* Edit Meal Modal */}
      {editingLog && editFormData && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 overflow-hidden" onClick={() => setEditingLog(null)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-2xl h-[70vh] md:h-auto md:max-h-[75vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 flex-shrink-0 p-4 md:p-6">
              <h2 className="text-xl md:text-2xl font-bold text-[#2C2416]">Edit Meal</h2>
              <button onClick={() => setEditingLog(null)} className="text-[#5C4F3D] hover:text-[#2C2416] text-2xl flex-shrink-0">
                ×
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto pr-2 md:pr-0 p-4 md:p-6">
              <div className="mb-4">
                <label className="block text-sm md:text-base font-medium text-[#2C2416] mb-2">Meal Type</label>
                <select
                  value={editFormData.mealType}
                  onChange={(e) => setEditFormData({...editFormData, mealType: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-[#E5DFD3] rounded-xl focus:border-[#8B7355] focus:outline-none text-sm md:text-base"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm md:text-base font-medium text-[#2C2416] mb-2">Food Items</label>
                <textarea
                  value={editFormData.foodDescription}
                  onChange={(e) => setEditFormData({...editFormData, foodDescription: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-[#E5DFD3] rounded-xl focus:border-[#8B7355] focus:outline-none resize-none text-sm md:text-base"
                  rows="3"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-[#F5F1EA] p-3 rounded-lg">
                  <p className="text-xs text-[#5C4F3D]">Calories</p>
                  <p className="text-lg font-bold text-[#2C2416]">{editFormData.totalCalories}</p>
                </div>
                <div className="bg-[#F5F1EA] p-3 rounded-lg">
                  <p className="text-xs text-[#5C4F3D]">Protein</p>
                  <p className="text-lg font-bold text-[#2C2416]">{editFormData.totalProtein}g</p>
                </div>
                <div className="bg-[#F5F1EA] p-3 rounded-lg">
                  <p className="text-xs text-[#5C4F3D]">Carbs</p>
                  <p className="text-lg font-bold text-[#2C2416]">{editFormData.totalCarbs}g</p>
                </div>
                <div className="bg-[#F5F1EA] p-3 rounded-lg">
                  <p className="text-xs text-[#5C4F3D]">Fats</p>
                  <p className="text-lg font-bold text-[#2C2416]">{editFormData.totalFats}g</p>
                </div>
              </div>
            </div>

            {/* Fixed Bottom Buttons */}
            <div className="flex-shrink-0 border-t border-[#E5DFD3] pt-4 mt-4 gap-3 flex p-4 md:p-6 bg-white">
              <button
                onClick={saveEditedMeal}
                className="flex-1 px-6 py-3 bg-[#2E7D32] text-white rounded-xl font-medium hover:bg-[#1B5E20] text-sm md:text-base"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditingLog(null)}
                className="flex-1 px-6 py-3 bg-[#E5DFD3] text-[#2C2416] rounded-xl font-medium hover:bg-[#D4CFC3] text-sm md:text-base"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Meal Modal - Responsive */}
      {showAddMeal && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 overflow-hidden" onClick={() => setShowAddMeal(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-2xl h-[70vh] md:h-auto md:max-h-[75vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 flex-shrink-0 p-4 md:p-6">
              <h2 className="text-xl md:text-2xl font-bold text-[#2C2416]">Add Meal</h2>
              <button onClick={() => setShowAddMeal(false)} className="text-[#5C4F3D] hover:text-[#2C2416] text-2xl flex-shrink-0">
                ×
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto pr-2 md:pr-0 p-4 md:p-6">
              {/* Meal Type */}
              <div className="mb-4">
                <label className="block text-sm md:text-base font-medium text-[#2C2416] mb-2">Meal Type</label>
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-[#E5DFD3] rounded-xl focus:border-[#8B7355] focus:outline-none text-sm md:text-base"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
              </div>

              {/* Food Description */}
              <div className="mb-4">
                <label className="block text-sm md:text-base font-medium text-[#2C2416] mb-2">What did you eat?</label>
                <textarea
                  value={foodDescription}
                  onChange={(e) => setFoodDescription(e.target.value)}
                  placeholder="E.g., 2 eggs, 2 slices of whole wheat toast, 1 banana"
                  className="w-full px-4 py-3 border-2 border-[#E5DFD3] rounded-xl focus:border-[#8B7355] focus:outline-none resize-none text-sm md:text-base"
                  rows="3"
                />
              </div>

              {/* Image Upload */}
              <div className="mb-4">
                <label className="block text-sm md:text-base font-medium text-[#2C2416] mb-2">Or upload a photo</label>
                <label className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-[#E5DFD3] rounded-xl hover:border-[#8B7355] cursor-pointer transition-colors">
                  <Upload className="w-6 h-6 text-[#5C4F3D]" />
                  <span className="text-[#5C4F3D] text-sm md:text-base">Upload Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </label>
                {imagePreview && (
                  <div className="mt-3">
                    <img src={imagePreview} alt="Food" className="w-full h-48 object-cover rounded-xl" />
                  </div>
                )}
              </div>

              {/* Analysis Result */}
              {analysisResult && (
                <div className="border-2 border-[#2E7D32] rounded-xl p-4 md:p-6 bg-[#E8F5E9] mb-4">
                  <h3 className="font-semibold text-lg md:text-xl text-[#1B5E20] mb-4">Nutrition Breakdown</h3>
                  
                  {/* Nutrition Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="bg-white p-3 md:p-4 rounded-lg text-center border border-[#E5DFD3]">
                      <p className="text-xs md:text-sm text-[#5C4F3D]">Calories</p>
                      <p className="text-lg md:text-xl font-bold text-[#2C2416]">{analysisResult.totalNutrition.calories}</p>
                    </div>
                    <div className="bg-white p-3 md:p-4 rounded-lg text-center border border-[#E5DFD3]">
                      <p className="text-xs md:text-sm text-[#5C4F3D]">Protein</p>
                      <p className="text-lg md:text-xl font-bold text-[#2C2416]">{analysisResult.totalNutrition.protein}g</p>
                    </div>
                    <div className="bg-white p-3 md:p-4 rounded-lg text-center border border-[#E5DFD3]">
                      <p className="text-xs md:text-sm text-[#5C4F3D]">Carbs</p>
                      <p className="text-lg md:text-xl font-bold text-[#2C2416]">{analysisResult.totalNutrition.carbs}g</p>
                    </div>
                    <div className="bg-white p-3 md:p-4 rounded-lg text-center border border-[#E5DFD3]">
                      <p className="text-xs md:text-sm text-[#5C4F3D]">Fats</p>
                      <p className="text-lg md:text-xl font-bold text-[#2C2416]">{analysisResult.totalNutrition.fats}g</p>
                    </div>
                  </div>

                  {/* Detected Items - Food Details */}
                  <div className="bg-white p-4 rounded-lg mb-4 border border-[#E5DFD3]">
                    <p className="text-sm md:text-base font-medium text-[#2C2416] mb-3">Detected Items:</p>
                    <div className="space-y-2">
                      {analysisResult.foodItems.map((item, idx) => (
                        <div key={idx} className="border-l-4 border-[#8B7355] pl-3 py-2">
                          <div className="flex items-start justify-between mb-1">
                            <div>
                              <p className="text-sm md:text-base font-medium text-[#2C2416]">{item.name}</p>
                              <p className="text-xs md:text-sm text-[#5C4F3D]">{item.quantity}</p>
                            </div>
                            <p className="text-sm md:text-base font-bold text-[#2C2416]">{item.nutrition.calories} cal</p>
                          </div>
                          <div className="flex gap-3 text-xs md:text-sm text-[#5C4F3D]">
                            <span>P: {item.nutrition.protein}g</span>
                            <span>C: {item.nutrition.carbs}g</span>
                            <span>F: {item.nutrition.fats}g</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Fixed Bottom Buttons */}
            <div className="flex-shrink-0 border-t border-[#E5DFD3] pt-4 mt-4 space-y-3 p-4 md:p-6 bg-white">
              <button
                onClick={analyzeFood}
                disabled={analyzing || (!foodDescription && !imageFile)}
                className="w-full px-6 py-4 bg-gradient-to-r from-[#8B7355] to-[#A0826D] text-white rounded-xl font-medium hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Analyze with AI
                  </>
                )}
              </button>

              {analysisResult && (
                <button
                  onClick={logMeal}
                  className="w-full px-6 py-3 bg-[#2E7D32] text-white rounded-xl font-medium hover:bg-[#1B5E20] text-sm md:text-base"
                >
                  Log This Meal
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Goal Modal */}
      {showGoalModal && <GoalModal />}
    </div>
  );
}