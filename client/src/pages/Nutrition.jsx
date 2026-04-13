import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Plus, Camera, Mic, Lightbulb,
  Sun, Utensils, Cookie, Moon, Minus, Search, Wand2, X,
  Edit3, Image as ImageIcon,
  GlassWater, FileEdit, ScanLine, CheckCircle2, Loader2, Zap, Trash2, Clock, Sparkles, AlertCircle, FlaskConical,
  MoreHorizontal, ArrowLeftRight, Sunrise, FileText
} from 'lucide-react';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { BarChart, Bar, Cell, ResponsiveContainer, XAxis, Tooltip } from 'recharts';
import api, { nutritionService, dietRecommendationService } from '../services/api';
import toast from 'react-hot-toast';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import NutritionSkeleton from '../components/skeletons/NutritionSkeleton';
import { NutritionTab } from '../components/NutritionTab';
import { MealAnalysisModal } from '../components/MealAnalysisModal';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

function Nutrition() {
  const { user } = useAuth();
  const { 
    invalidateCache, 
    triggerRefresh,
    dataRefreshTrigger,
    dashboardData, 
    fetchNutrition, 
    fetchNutritionLogs, 
    fetchWeeklyTrends, 
    fetchHealthGoals,
    nutritionData: cachedNutritionData,
    nutritionLogs: cachedNutritionLogs,
    weeklyTrends: cachedWeeklyTrends,
    healthGoals: cachedHealthGoals
  } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mealTab, setMealTab] = useState('Breakfast');
  const [inputMethod, setInputMethod] = useState('Scan'); // 'Scan', 'Type', 'Predict'
  const [recType, setRecType] = useState('Recommended');
  const [viewingMeal, setViewingMeal] = useState(null);

  // Dynamic Data States
  const [dailySummary, setDailySummary] = useState({
    caloriesConsumed: 0,
    calorieTarget: 1800,
    protein: 0, proteinTarget: 70,
    carbs: 0, carbsTarget: 200,
    fats: 0, fatsTarget: 55
  });
  const [mealLogs, setMealLogs] = useState({
    Breakfast: [],
    Lunch: [],
    Dinner: []
  });
  const [weeklyTrendsData, setWeeklyTrendsData] = useState([]);
  const [waterIntake, setWaterIntake] = useState({ current: 0, target: 8 });
  const [loading, setLoading] = useState(!cachedNutritionData && !cachedNutritionLogs);
  const [recentMeals, setRecentMeals] = useState([]);
  const [frequentFoods, setFrequentFoods] = useState([]);
  const [aiInsights, setAiInsights] = useState("Analyzing your eating patterns...");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRecipeSuggestion, setSelectedRecipeSuggestion] = useState(null);

  // Personalized Suggestions Engine
  const currentSuggestion = React.useMemo(() => {
    // Base suggestions templates
    const isVeg = user?.profile?.dietaryPreference === 'vegetarian' || user?.profile?.dietaryPreference === 'vegan' || user?.profile?.dietaryPreference === 'eggetarian';

    // Base suggestions templates
    const suggestionsMap = {
      'Recommended': isVeg ? {
        name: 'Dal Tadka + Steamed Rice',
        calories: 320, protein: 12, carbs: 48, fats: 8,
        tags: ['HOME STYLE', 'HIGH FIBER'],
        reason: 'A wholesome balanced meal with complete plant proteins for your daily energy.',
        image: null,
        ingredients: ['Yellow Moong Dal', 'Basmati Rice', 'Ghee', 'Cumin Seeds', 'Turmeric', 'Green Chilies'],
        instructions: ['Pressure cook dal with turmeric.', 'Perform "Tadka" with ghee, cumin and chilies.', 'Steam rice until fluffy and serve together.']
      } : {
        name: 'Fish Curry + Brown Rice',
        calories: 350, protein: 28, carbs: 42, fats: 10,
        tags: ['OMEGA-3', 'LEAN PROTEIN'],
        reason: 'Traditional Indian style fish curry to support your heart health and protein goals.',
        image: null,
        ingredients: ['Fresh Fish Fillet', 'Onion-Tomato Masala', 'Ginger-Garlic Paste', 'Brown Rice', 'Curry Leaves'],
        instructions: ['Sauté onion and tomato paste with spices.', 'Add fish pieces and simmer in curry base.', 'Serve with warm cooked brown rice.']
      },
      'High Protein': isVeg ? {
        name: 'Paneer Bhurji + 2 Roti',
        calories: 420, protein: 22, carbs: 38, fats: 18,
        tags: ['MUSCLE REPAIR', 'PROTEIN RICH'],
        reason: 'Specifically suggested to help reach your protein target of 70g using fresh paneer.',
        image: null,
        ingredients: ['Crumbled Paneer (150g)', 'Whole Wheat Roti', 'Chopped Onions', 'Bell Peppers', 'Garam Masala'],
        instructions: ['Heat oil and sauté onions and peppers.', 'Add crumbled paneer and spice mix.', 'Serve with freshly made soft wheat rotis.']
      } : {
        name: 'Chicken Tikka (Dry) + Salad',
        calories: 380, protein: 44, carbs: 10, fats: 14,
        tags: ['LEAN MUSCLE', 'POST WORKOUT'],
        reason: 'High protein, low carb meal to support muscle recovery without extra calories.',
        image: null,
        ingredients: ['Chicken Breast Cubes', 'Hung Curd', 'Lemon Juice', 'Tandoori Masala', 'Fresh Salad Leaves'],
        instructions: ['Marinate chicken in curd and spices for 30 mins.', 'Air fry or grill until charred and juicy.', 'Serve with a fresh squeeze of lemon and salad.']
      },
      'Balanced': {
        name: 'Mixed Veg Khichdi + Curd',
        calories: 310, protein: 14, carbs: 45, fats: 6,
        tags: ['EASY DIGESTION', 'GUT FRIENDLY'],
        reason: 'A light, gut-healing meal that balances all necessary macronutrients.',
        image: null,
        ingredients: ['Rice & Lentils Mix', 'Carrots', 'Peas', 'Fresh Curd (Dahi)', 'Roasted Cumin'],
        instructions: ['Cook rice, lentils and chopped veg in a pressure cooker.', 'Finish with a tiny dollop of ghee.', 'Serve with a bowl of refreshing cold curd.']
      },
      'Low Carb': isVeg ? {
        name: 'Egg Bhurji (3 Eggs) - No Bread',
        calories: 240, protein: 18, carbs: 6, fats: 15,
        tags: ['WEIGHT LOSS', 'KETO STYLE'],
        reason: 'Simple Indian egg scramble to keep you full without traditional heavy carbs.',
        image: null,
        ingredients: ['3 Whole Eggs', 'Onions', 'Tomatoes', 'Green Chilies', 'Coriander'],
        instructions: ['Whisk eggs with a pinch of salt.', 'Sauté onions and chilies until soft.', 'Add eggs and scramble until moist and fully cooked.']
      } : {
        name: 'Masala Omelette + Sprouts',
        calories: 260, protein: 20, carbs: 12, fats: 14,
        tags: ['LOW CALORIE', 'ENERGY SNAP'],
        reason: 'A low-glycemic choice that helps maintain stable blood sugar levels.',
        image: null,
        ingredients: ['2 Eggs', 'Green Sprouted Moong', 'Spinach', 'Onions', 'Black Pepper'],
        instructions: ['Prepare a spicy masala omelette with veggies.', 'Steamed sprouts served on the side as a fiber source.']
      }
    };

    // 1. Dynamic "Recommended" based on Lab Report Deficiencies
    const deficiencies = dashboardData?.latestAnalysis?.deficiencies || [];
    if (deficiencies.length > 0) {
      const topDef = deficiencies[0].name.toLowerCase();
      if (topDef.includes('iron') || topDef.includes('hemoglobin')) {
        suggestionsMap['Recommended'] = {
          name: 'Spinach & Dal Tadka',
          calories: 240, protein: 18, carbs: 10, fats: 14,
          tags: ['IRON RICH', 'BLOOD HEALTH'],
          reason: `Iron optimization: Based on your lab reports, this meal will help improve your ${deficiencies[0].name} levels.`,
          image: null,
          ingredients: ['Palak (Spinach)', 'Yellow Lentils', 'Garlic', 'Ghee'],
          instructions: ['Boil lentils.', 'Sauté spinach and spices.', 'Combine and temper with garlic ghee.']
        };
      } else if (topDef.includes('fiber') || topDef.includes('gut')) {
        suggestionsMap['Recommended'] = {
          name: 'Bajra Khichdi + Chaas',
          calories: 330, protein: 12, carbs: 55, fats: 4,
          tags: ['HIGH FIBER', 'GUT HEALTH'],
          reason: `Fiber boost: Found to be low in your recent analysis, this meal will help fix your digestion.`,
          image: null,
          ingredients: ['Bajra (Pearl Millet)', 'Moong Dal', 'Buttermilk (Chaas)', 'Ginger'],
          instructions: ['Soak and pressure cook bajra and dal mix.', 'Whisk buttermilk with roasted cumin powder.', 'Serve warm for best results.']
        };
      } else if (topDef.includes('protein')) {
        suggestionsMap['Recommended'] = {
          ...suggestionsMap['High Protein'],
          reason: 'Protein synthesis: Suggested to support your muscle recovery after your recent activity.'
        };
      }
    }

    // 2. Adjust based on Dietary Preference (if known)
    // Add logic here if user.profile.dietaryPreference is available

    return suggestionsMap[recType] || suggestionsMap['Recommended'];
  }, [recType, dashboardData]);

  // Modal Specific States
  const [foodInput, setFoodInput] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [foodQuantity, setFoodQuantity] = useState('');
  const [lastSource, setLastSource] = useState('Scan'); // 'Scan' or 'Upload'
  const [prepMethod, setPrepMethod] = useState('');
  
  // Use the robust utility hook for voice logging
  const { 
    transcript, 
    interimTranscript, 
    listening: isListening, 
    startListening: startVoiceCapture, 
    stopListening: stopVoiceCapture,
    resetTranscript
  } = useSpeechRecognition();

  const [expandedMeal, setExpandedMeal] = useState(null);
  const [analyzingMessage, setAnalyzingMessage] = useState('Analyzing food...');
  const pendingAutoAnalyzeRef = React.useRef(false);
  const cameraModalInputRef = React.useRef(null);
  const galleryInputRef = React.useRef(null);

  useEffect(() => {
    if (isAnalyzing) {
      const messages = [
        'Running nutritional analysis...',
        'Scanning ingredients and macros...',
        'Calculating caloric density...'
      ];
      let i = 0;
      const interval = setInterval(() => {
        i = (i + 1) % messages.length;
        setAnalyzingMessage(messages[i]);
      }, 2000); // Rotate every 2 seconds
      return () => clearInterval(interval);
    } else {
      setAnalyzingMessage('Analyzing food...');
    }
  }, [isAnalyzing]);

  useEffect(() => {
    fetchData(dataRefreshTrigger > 0);
    if (location.state?.openLogMeal) {
      setIsModalOpen(true);
      if (location.state?.mealType) setMealTab(location.state.mealType);
    }
    if (location.state?.prefillData) {
      const p = location.state.prefillData;
      setMealTab(p.mealType ? p.mealType.charAt(0).toUpperCase() + p.mealType.slice(1) : 'Breakfast');
      setAnalysisResult({
        _id: 'new_log_again',
        foodItem: p.foodItems?.[0] || { name: p.name },
        totalNutrition: p.totalNutrition || p.nutrition,
        nutrition: p.foodItems?.[0]?.nutrition || p.nutrition,
        healthScore: p.healthScore || 50,
        micronutrients: p.micronutrients || [],
        healthBenefitsSummary: p.healthBenefitsSummary || p.analysis || '',
        enhancementTips: p.enhancementTips || [],
        warnings: p.warnings || [],
        alternatives: p.alternatives || []
      });
      window.history.replaceState({}, document.title);
    }
    if (location.state?.scrollToWater) {
      setTimeout(() => {
        document.getElementById('water-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
  }, [location.state, selectedDate, dataRefreshTrigger]);

  useEffect(() => {
    if (!isModalOpen) {
      stopVoiceCapture();
    }
  }, [isModalOpen]);

  useEffect(() => {
    return () => {
      stopVoiceCapture();
    };
  }, []);

  const fetchData = async (force = false) => {
    // Only show full page loader if we have NO data at all
    if (!cachedNutritionData && !cachedNutritionLogs && !force) {
      setLoading(true);
    }
    
    // Auto-force if refresh trigger changed
    const effectiveForce = force;

    try {
      const date = selectedDate;
      const [summary, logs, trends, goals] = await Promise.all([
        fetchNutrition(date, force),
        fetchNutritionLogs(date, force),
        fetchWeeklyTrends(force),
        fetchHealthGoals(force),
        dietRecommendationService.getActiveDietPlan().catch(() => ({ data: { dietPlan: null } }))
      ]);

      // Update state from data context results
      setDailySummary({
        caloriesConsumed: summary?.totalCalories || 0,
        calorieTarget: goals?.dailyCalorieTarget || 1800,
        protein: summary?.totalProtein || 0,
        proteinTarget: goals?.macroTargets?.protein || 70,
        carbs: summary?.totalCarbs || 0,
        carbsTarget: goals?.macroTargets?.carbs || 200,
        fats: summary?.totalFats || 0,
        fatsTarget: goals?.macroTargets?.fats || 55
      });

      // Water (Assuming it's part of daily summary)
      setWaterIntake({
        current: summary?.waterIntake || 0,
        target: goals?.waterTarget || 8
      });
      
      const grouped = {
        Breakfast: [],
        Lunch: [],
        Dinner: []
      };

      if (logs) {
        logs.forEach(log => {
          const type = log.mealType;
          if (type.toLowerCase().includes('breakfast')) grouped.Breakfast.push(log);
          else if (type.toLowerCase().includes('lunch')) grouped.Lunch.push(log);
          else grouped.Dinner.push(log); // Fallback for everything else
        });
        setMealLogs(grouped);
        setRecentMeals(logs.slice(0, 15));
      }

      if (trends) {
        const chartData = trends.map(day => ({
          day: new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' }),
          value: day.totalCalories,
          active: new Date(day.date).toISOString().split('T')[0] === date
        }));
        setWeeklyTrendsData(chartData);
      }

      // Insights & Suggestions
      let insight = "Analyzing your eating patterns...";
      const bCals = (grouped.Breakfast || []).reduce((sum, l) => sum + (l.foodItems?.[0]?.nutrition?.calories || 0), 0);
      const lCals = (grouped.Lunch || []).reduce((sum, l) => sum + (l.foodItems?.[0]?.nutrition?.calories || 0), 0);
      const dCals = (grouped.Dinner || []).reduce((sum, l) => sum + (l.foodItems?.[0]?.nutrition?.calories || 0), 0);

      const cTarget = goals?.dailyCalorieTarget || 1800;
      const bT = Math.round(cTarget * 0.3);
      const lT = Math.round(cTarget * 0.35);
      const dT = Math.round(cTarget * 0.25);

      if (bCals > bT) insight = `Your breakfast was heavy (${bCals} kcal). Stay light on lunch to balance.`;
      else if (lCals > lT) insight = "Lunch was calorie-dense. A high-protein dinner would be ideal.";
      else if (dCals > dT) insight = "Dinner exceeded target. Consider an active start tomorrow.";
      else if (summary?.totalCalories > 0) insight = "Excellent! You're managing your meal portions very well.";

      setAiInsights(insight);

    } catch (error) {
      console.error('Failed to fetch nutrition data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleWaterUpdate = async (change) => {
    try {
      const newWater = waterIntake.current + change;
      
      if (newWater < 0) return;
      
      if (newWater > waterIntake.target) {
        toast.success("Hydration goal achieved!", {
          icon: '🌊',
          duration: 4000
        });
        toast("You've completed your daily target of 8 glasses. Stay hydrated, but you're all set!", {
          icon: '✨',
          duration: 4000
        });
        return;
      }

      setWaterIntake(prev => ({ ...prev, current: newWater }));
      await api.post('nutrition/log-water', {
        date: selectedDate,
        waterIntake: newWater
      });
      invalidateCache(['dashboard']);
      toast.success('Water intake updated');
    } catch (error) {
      toast.error('Failed to update water');
    }
  };

  const openModal = (meal) => {
    setMealTab(meal);
    setIsModalOpen(true);
    setInputMethod('Scan');
    setAnalysisResult(null);
    setFoodInput('');
    setFoodQuantity('');
    setPrepMethod('');
    setImage(null);
    setImagePreview(null);
    resetTranscript();
  };

  // Image Upload Logic from QuickFoodCheck
  const compressImage = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxSize = 800; // Reduced for faster food scan upload
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height / width) * maxSize;
              width = maxSize;
            } else {
              width = (width / height) * maxSize;
              height = maxSize;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
            } else reject(new Error('Canvas conversion failed'));
          }, 'image/jpeg', 0.8);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageSelect = async (fileOrEvent, autoAnalyze = false) => {
    const file = fileOrEvent?.target ? fileOrEvent.target.files[0] : fileOrEvent;
    if (!file) return;

    // Immediately show the modal in Scan mode
    setInputMethod('Scan');
    setIsModalOpen(true);
    
    // Show instant preview from the raw file while we compress in the background
    const rawUrl = URL.createObjectURL(file);
    setImagePreview(rawUrl);
    
    // Safety: don't auto-analyze unless explicitly requested
    pendingAutoAnalyzeRef.current = autoAnalyze;

    try {
      const compressed = await compressImage(file);
      setImage(compressed);
      // Update with compressed preview for actual logging
      const compressedUrl = URL.createObjectURL(compressed);
      setImagePreview(compressedUrl);
      
      // Cleanup the raw URL after a brief delay to avoid flicker
      setTimeout(() => {
        try { URL.revokeObjectURL(rawUrl); } catch (e) {}
      }, 1000);
    } catch (error) {
      console.error('Image processing error:', error);
      toast.error('Failed to process image');
    }
    
    // Reset file input value so the same file can be re-selected
    if (fileOrEvent?.target) {
      fileOrEvent.target.value = '';
    }
  };

  // Auto-analyze effect: triggers when image is set and auto-analyze is pending
  useEffect(() => {
    if (pendingAutoAnalyzeRef.current && image && !isAnalyzing) {
      pendingAutoAnalyzeRef.current = false;
      // Small delay to ensure UI has rendered with the preview
      const timer = setTimeout(() => {
        handleAnalyzeAndLog();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [image]);

  const handleAnalyzeAndLog = async () => {
    if (!foodInput && !image) return;
    if (isListening) stopVoiceCapture();
    setIsAnalyzing(true);
    setAnalyzingMessage('Please wait, analyzing your food…');
    try {
      const formData = new FormData();
      formData.append('foodDescription', foodInput || 'Food from image');
      if (image) formData.append('image', image);

      let context = '';
      if (foodQuantity) {
        context += `Quantity: ${foodQuantity}. `;
        formData.append('quantity', foodQuantity);
      }
      if (prepMethod) {
        context += `Preparation: ${prepMethod}.`;
        formData.append('prepMethod', prepMethod);
      }
      if (context) formData.append('additionalContext', context);

      const response = await api.post('nutrition/quick-check', formData, {
        timeout: 60000,
        skipAutoLogout: true
      });

      const result = response.data.data;
      const isCached = response.data.isCached || response.data.source === 'global_cache';
      
      // NEW: Validation for food detection
      const totalCals = result.foodItem?.nutrition?.calories || result.totalNutrition?.calories || result.nutrition?.calories || result.calories || 0;
      const name = result.foodItem?.name || result.foodName || result.foodItems?.[0]?.name;
      const isWater = name?.toLowerCase().includes('water');

      if (!name || name === 'Unknown Food' || (totalCals === 0 && !isWater)) {
        toast.error('Food not detected. Please upload a clearer image of your meal.', {
          icon: '🍽️',
          duration: 4000
        });
        return;
      }

      // Inject user input directly into result so it can be logged exactly as typed
      const finalResult = {
        ...result,
        _userInput: foodInput,
        _isFromCache: isCached,
        _cacheSource: response.data?.source,
        _alreadyLogged: true,
        _isImageAnalysis: !!image
      };

      // AUTO-LOG: Directly log the meal to the database using the selected mealTab
      await handleConfirmLog(finalResult);
      
      // We set the result to show the modal so the user sees the details, 
      setAnalysisResult(finalResult);

      if (isCached) {
        toast.success('Instant Analysis: Retrieved from Food DB Cache');
      } else {
        toast.success('AI Analysis complete!');
      }
    } catch (error) {
      console.error(error);
      toast.error('Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Rotating analyzing messages
  useEffect(() => {
    if (!isAnalyzing) return;
    const messages = [
      'Please wait, analyzing your food…',
      'Your food is being analyzed…',
      'Analyzing nutrition data…',
      'Crunching the numbers…',
      'Almost there, hang tight…'
    ];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % messages.length;
      setAnalyzingMessage(messages[i]);
    }, 2500);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const handleConfirmLog = async (data) => {
    try {
      const mappedMealType = mealTab.toLowerCase();

      const logData = {
        mealType: mappedMealType,
        foodItems: [{
          name: data._userInput || data.foodItem?.name || data.foodName,
          quantity: data.foodItem?.quantity || data.quantity || '1 serving',
          nutrition: data.foodItem?.nutrition || data.nutrition || {}
        }],
        healthScore: data.healthScore,
        healthScore10: data.healthScore10,
        micronutrients: data.micronutrients,
        enhancementTips: data.enhancementTips,
        healthBenefitsSummary: data.healthBenefitsSummary || data.analysis,
        warnings: data.warnings,
        alternatives: data.alternatives,
        date: selectedDate,
        imageUrl: data.imageUrl,
        source: data._isImageAnalysis ? 'ai_vision' : 'manual'
      };
      await nutritionService.logMeal(logData);
      toast.success('Added to ' + mealTab);
      invalidateCache(['dashboard', `logs_${selectedDate}`, `nutrition_${selectedDate}`]);
      triggerRefresh();
      await fetchData(true);
      
      // If we are auto-logging from analysis, we don't want to close the result detail view
      // But we DO want to close the initial "Add Meal" input modal
      setIsModalOpen(false); 
    } catch (error) {
      toast.error('Failed to log meal');
    }
  };

  // Sync transcript from hook to foodInput
  useEffect(() => {
    if (isListening) {
      const displayText = (transcript + ' ' + interimTranscript).trim();
      if (displayText) setFoodInput(displayText);
    }
  }, [transcript, interimTranscript, isListening]);

  // stopVoiceCapture is now handled by the hook

  const handleDeleteMeal = async (logId) => {
    try {
      const confirmDelete = window.confirm('Are you sure you want to delete this meal log?');
      if (!confirmDelete) return;

      const { data } = await nutritionService.deleteNutritionLog(logId);
      if (data.success) {
        toast.success('Meal log deleted');
        invalidateCache(['dashboard', `logs_${selectedDate}`, `nutrition_${selectedDate}`]);
        triggerRefresh();
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete meal');
    }
  };

  const handleMoveMeal = async (id, newType) => {
    try {
      // Find the moving log across all categories
      let logToMove = null;
      let oldKeyFound = null;

      Object.keys(mealLogs).forEach(key => {
        const found = mealLogs[key].find(m => m._id === id);
        if (found) {
          logToMove = { ...found, mealType: newType };
          oldKeyFound = key;
        }
      });

      if (!logToMove) return;

      // Determine target key
      const newKey = newType === 'breakfast' ? 'Breakfast' :
                     newType === 'midMorningSnack' ? 'Mid-Morning' :
                     newType === 'lunch' ? 'Lunch' :
                     newType === 'eveningSnack' ? 'Evening' : 'Dinner';

      // Optimistic update with NEW ARRAY REFERENCES
      setMealLogs(prev => {
        const newState = { ...prev };
        if (oldKeyFound) {
          newState[oldKeyFound] = prev[oldKeyFound].filter(m => m._id !== id);
        }
        newState[newKey] = [...(newState[newKey] || []), logToMove];
        return newState;
      });
      
      // Update recent meals list for "All" view consistency
      setRecentMeals(prev => {
        return prev.map(m => m._id === id ? logToMove : m);
      });

      toast.promise(
        api.put(`nutrition/logs/${id}`, { mealType: newType }),
        {
          loading: 'Moving meal...',
          success: 'Meal moved successfully!',
          error: 'Failed to move meal.'
        }
      ).then(() => {
        invalidateCache(['dashboard', `logs_${selectedDate}`, `nutrition_${selectedDate}`]);
        triggerRefresh();
      });

    } catch (error) {
      console.error('Move error:', error);
      toast.error('Failed to move meal');
      triggerRefresh();
    }
  };

  const handleViewMeal = (meal) => {
    setViewingMeal(meal);
  };



  const changeDate = (daysOrDate) => {
    if (typeof daysOrDate === 'number') {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + daysOrDate);
      setSelectedDate(d.toISOString().split('T')[0]);
    } else {
      setSelectedDate(daysOrDate);
    }
  };

  const remainingCals = Math.max(0, dailySummary.calorieTarget - dailySummary.caloriesConsumed);
  const progressPercent = Math.min(100, (dailySummary.caloriesConsumed / dailySummary.calorieTarget) * 100);
  if (loading && (!dailySummary.caloriesConsumed && !mealLogs.Breakfast.length)) {
    return <NutritionSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[#F2F5EC] dark:bg-[#111815] transition-colors pb-32">
       <div className="container mx-auto px-4 pt-2 pb-8">
          <NutritionTab 
            onLogFood={async (mode, mealType, file) => {
              const inputMode = mode === 'photo' || mode === 'Add Food via Photo' ? 'Scan' :
                               mode === 'voice' || mode === 'Voice Log' ? 'Predict' :
                               mode === 'text' || mode === 'Type' ? 'Type' : 
                               mode === 'Scan' ? 'Scan' : 'Scan';
              
              if (inputMode === 'Scan') {
                setInputMethod('Scan');
                if (file) {
                  if (mealType) setMealTab(mealType);
                  setIsModalOpen(true);
                  handleImageSelect(file);
                  return;
                }
              }
              
              setInputMethod(inputMode);
              if (mealType) setMealTab(mealType);
              setIsModalOpen(true);
            }}
            onDeleteFood={handleDeleteMeal}
            onMoveFood={handleMoveMeal}
            onViewFood={handleViewMeal}
            triggerRefresh={triggerRefresh}
            loggedMeals={Object.values(mealLogs).flat()}
            dailySummary={dailySummary}
            waterIntake={waterIntake}
            onWaterUpdate={handleWaterUpdate}
            selectedDate={selectedDate}
            onDateChange={changeDate}
            weeklyTrendsData={weeklyTrendsData}
            recentMeals={recentMeals}
            frequentFoods={frequentFoods}
            aiInsights={aiInsights}
          />

          {/* View Meal Detail Modal */}
          <AnimatePresence>
            {viewingMeal && (
              <MealAnalysisModal
                meal={viewingMeal}
                onClose={() => setViewingMeal(null)}
                source="view"
              />
            )}
          </AnimatePresence>
       </div>

      {/* Add Meal Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            data-modal="true"
            className="fixed inset-0 z-[999] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/40 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 100, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 100, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-t-[2.5rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col h-[90vh] md:h-auto md:max-h-[90vh] border border-slate-100 mt-auto md:mt-0"
            >
              {/* Header */}
              <div className="p-6 md:p-8 pb-4">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Add to {mealTab}</h3>
                  <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 bg-white hover:bg-slate-50 rounded-full flex items-center justify-center transition-all border border-slate-200 shadow-sm shrink-0">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                
                {/* Meal Type Selector */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide -mx-2 px-2">
                  {[
                    { id: 'Breakfast', label: 'BREAKFAST', icon: null },
                    { id: 'Lunch', label: 'LUNCH', icon: Sun },
                    { id: 'Dinner', label: 'DINNER', icon: Moon }
                  ].map(tab => (
                    <button
                      key={tab.id} onClick={() => setMealTab(tab.id)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full transition-all flex-[0_0_auto] min-w-fit justify-center ${
                        mealTab === tab.id
                          ? 'bg-[#69A38D] text-white shadow-md' 
                          : 'bg-white text-slate-500 border border-slate-100 font-bold hover:bg-slate-50'
                      }`}
                    >
                      {tab.icon && <tab.icon size={14} className={mealTab === tab.id ? 'text-white' : 'text-slate-400'} />}
                      <span className="text-[11px] font-black uppercase tracking-wider">{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* Input Method Tabs */}
                <div className="flex bg-white border border-slate-100 p-1.5 rounded-2xl mb-4 shadow-sm">
                  {[
                    { id: 'Scan', label: 'SCAN', icon: ScanLine },
                    { id: 'Type', label: 'TYPE', icon: FileText },
                    { id: 'Predict', label: 'VOICE LOG', icon: Mic }
                  ].map(tab => (
                    <button
                      key={tab.id} 
                      onClick={() => {
                        setInputMethod(tab.id);
                        if (tab.id === 'Predict') {
                          setTimeout(() => startVoiceCapture(), 100);
                        } else {
                          stopVoiceCapture();
                        }
                      }}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${
                        inputMethod === tab.id
                          ? 'bg-white shadow-sm text-[#1a2138]' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <tab.icon size={16} className={inputMethod === tab.id ? 'text-[#69A38D]' : 'text-slate-400'} /> 
                      <span className="text-[12px] font-bold uppercase tracking-wider">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div className="px-6 md:px-8 pb-10 md:pb-8 overflow-y-auto flex-1 scrollbar-hide flex flex-col">

                {isAnalyzing ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center space-y-6 h-full py-12 flex-1">
                    <div className="relative w-24 h-24">
                      <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
                      <motion.div
                        className="absolute inset-0 border-4 border-[#69A38D] rounded-full border-t-transparent"
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      />
                      <Search className="w-8 h-8 text-[#69A38D] absolute inset-0 m-auto animate-pulse" />
                    </div>
                    <div className="text-center space-y-3">
                      <motion.p
                        key={analyzingMessage}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-lg font-black text-slate-900 tracking-tight"
                      >
                        {analyzingMessage}
                      </motion.p>
                    </div>
                  </motion.div>

                ) : inputMethod === 'Scan' ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full flex-1">
                    
                    <div className="bg-[#5c7a6e] rounded-[2rem] p-6 lg:p-8 flex flex-col items-center justify-center relative shadow-inner w-full border-2 border-dashed border-white/20 flex-1 min-h-[250px] overflow-hidden">
                      {imagePreview ? (
                        <>
                          <img src={imagePreview} className="absolute inset-0 w-full h-full object-cover" alt="Food preview" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => { setImagePreview(null); setImage(null); }}
                              className="bg-white/20 backdrop-blur-md border border-white/30 text-white px-6 py-2 rounded-full text-[12px] font-bold uppercase tracking-wider transition-all"
                            >
                              Retake Photo
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm mb-6 shadow-lg">
                              <ScanLine size={32} className="text-white" />
                          </div>
                          
                          <button 
                              onClick={() => {
                                if (cameraModalInputRef.current) cameraModalInputRef.current.value = '';
                                cameraModalInputRef.current?.click();
                              }}
                              className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-6 py-3.5 rounded-full text-[13px] font-black uppercase tracking-wider transition-all mb-4 w-full max-w-[220px] shadow-sm backdrop-blur-sm"
                          >
                              TAP TO SCAN MEAL
                          </button>
                          
                          <span className="text-white/60 text-[10px] font-black uppercase mb-4 tracking-[0.2em]">OR</span>
                          
                          <button 
                              onClick={() => {
                                if (galleryInputRef.current) galleryInputRef.current.value = '';
                                galleryInputRef.current?.click();
                              }}
                              className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-6 py-3.5 rounded-full text-[13px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 w-full max-w-[220px] shadow-sm backdrop-blur-sm"
                          >
                              <ImageIcon size={16} /> UPLOAD PHOTO
                          </button>
                        </>
                      )}
                    </div>

                    <p className="text-center text-[#1a2138] font-bold text-[13px] px-6 mt-6 mb-6 leading-relaxed">
                        Our engine will optimize the portion size and nutritional content directly from the photo.
                    </p>

                    <button
                      onClick={handleAnalyzeAndLog}
                      disabled={isAnalyzing || !image}
                      className="w-full bg-[#69A38D] hover:bg-[#5B9A80] text-white py-4 rounded-[1.25rem] flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] mt-auto mb-2 disabled:opacity-50"
                    >
                      <Search size={18} className="text-white" />
                      <span className="text-[14px] font-black uppercase tracking-wider">ANALYZE PHOTO</span>
                    </button>
                  </motion.div>
                ) : inputMethod === 'Type' ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col flex-1 h-full">
                    
                    {/* Main Search Input */}
                    <div className="relative mb-6">
                      <Search className="w-5 h-5 text-[#86a798] absolute left-5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={foodInput}
                        onChange={(e) => setFoodInput(e.target.value)}
                        placeholder="Search for food or describe..."
                        className="w-full bg-white border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-[1.5rem] py-4.5 pl-14 pr-14 focus:outline-none focus:ring-2 focus:ring-[#69A38D]/20 focus:border-[#69A38D] text-[14px] text-slate-600 font-medium placeholder:text-slate-400"
                        style={{ paddingBottom: '1.1rem', paddingTop: '1.1rem' }}
                      />
                      <button 
                        onClick={() => { setInputMethod('Predict'); setTimeout(startVoiceCapture, 100); }} 
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#eef5f2] text-[#69A38D] hover:bg-[#dfece7] rounded-full flex items-center justify-center transition-colors"
                      >
                        <Mic className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quantity and Preparation */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black text-[#5c806d] uppercase tracking-widest pl-1">Quantity</label>
                        <input
                          type="text"
                          value={foodQuantity}
                          onChange={(e) => setFoodQuantity(e.target.value)}
                          placeholder="e.g., 2 bowls"
                          className="w-full bg-white border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-[1.25rem] py-4 px-5 focus:outline-none focus:ring-2 focus:ring-[#69A38D]/20 focus:border-[#69A38D] text-[13px] font-medium text-slate-600 placeholder:text-[#86a798]"
                        />
                      </div>
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black text-[#5c806d] uppercase tracking-widest pl-1">Preparation</label>
                        <select
                          value={prepMethod}
                          onChange={(e) => setPrepMethod(e.target.value)}
                          className="w-full bg-white border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-[1.25rem] py-4 px-5 focus:outline-none focus:ring-2 focus:ring-[#69A38D]/20 focus:border-[#69A38D] text-[13px] font-bold text-[#1f4031] outline-none appearance-none cursor-pointer text-center"
                        >
                          <option value="">Select Method</option>
                          <option value="homemade">Homemade</option>
                          <option value="fried">Deep Fried</option>
                          <option value="package">Packaged</option>
                          <option value="street">Street Food</option>
                          <option value="boiled">Boiled/Steamed</option>
                          <option value="roasted">Roasted/Grilled</option>
                        </select>
                      </div>
                    </div>

                    {/* Quick Search Tags */}
                    <div className="mb-8 w-full text-left">
                      <p className="text-[10px] font-black text-[#5c806d] uppercase tracking-widest pl-1 mb-3.5">Quick Search Tags</p>
                      <div className="flex flex-wrap gap-2.5 justify-start">
                        {['Apple', 'Rice & Dal', 'Paneer Sabzi', 'Oats', 'Coffee'].map(tag => (
                          <button 
                            key={tag} 
                            onClick={() => setFoodInput(tag)} 
                            className="px-[18px] py-[10px] bg-white border border-slate-200 rounded-[1.25rem] text-[10px] font-black text-[#4f6c5f] hover:bg-[#69A38D] hover:text-white hover:border-[#69A38D] transition-all uppercase tracking-widest shadow-sm"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleAnalyzeAndLog}
                      disabled={isAnalyzing || !foodInput}
                      className="w-full mt-auto mb-2 bg-[#69A38D] hover:bg-[#5B9A80] text-white py-4.5 rounded-[1.25rem] flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
                      style={{ paddingBottom: '1.1rem', paddingTop: '1.1rem' }}
                    >
                      {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-[18px] h-[18px]" />}
                      <span className="text-[14px] font-black uppercase tracking-wider">{isAnalyzing ? analyzingMessage : 'Analyze & Log Meal'}</span>
                    </button>
                  </motion.div>
                ) : inputMethod === 'Predict' ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center space-y-6 flex-1 py-4">
                    <div className="relative mb-4">
                      {isListening && (
                        <>
                          <div className="absolute inset-0 rounded-full bg-[#69A38D] opacity-20 animate-ping" />
                          <div className="absolute -inset-4 rounded-full bg-[#69A38D] opacity-10 animate-ping" style={{ animationDelay: '0.2s' }} />
                        </>
                      )}
                      <button
                        onClick={() => {
                          if (isListening) {
                            stopVoiceCapture();
                          } else {
                            startVoiceCapture();
                          }
                        }}
                        className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all shadow-xl ${isListening
                          ? 'bg-[#5B9A80] text-white scale-110'
                          : 'bg-[#69A38D] text-emerald-50 hover:bg-[#5B9A80] hover:scale-105'
                          }`}
                      >
                        <Mic className={`w-12 h-12 ${isListening ? 'animate-pulse' : ''}`} />
                      </button>
                    </div>

                    {!foodInput && (
                      <div className="text-center space-y-2 px-4">
                        <h4 className="text-xl font-black text-[#1a2138] uppercase tracking-tight">
                          {isListening ? 'Listening...' : 'Voice Log'}
                        </h4>
                        <p className="text-sm font-medium text-slate-500 max-w-[250px] mx-auto leading-relaxed">
                          {isListening
                            ? 'Say what you ate, e.g. "I had two chapati with dal"'
                            : 'Describe your meal naturally and let AI do the rest'}
                        </p>
                      </div>
                    )}

                    {foodInput && (
                      <div className="w-full space-y-5 flex-1 flex flex-col">
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 min-h-[120px] flex items-center justify-center relative shadow-inner">
                          <p className="text-base font-bold text-slate-800 leading-relaxed text-center w-full">{foodInput}</p>
                          {isListening && <div className="w-3 h-3 bg-red-500 rounded-full absolute bottom-4 right-4 animate-pulse shadow-sm" />}
                        </div>

                        <button
                          onClick={handleAnalyzeAndLog}
                          disabled={isAnalyzing}
                          className="w-full py-4 mt-auto mb-2 bg-[#69A38D] text-white rounded-[1.25rem] text-[14px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
                        >
                          {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                          {isAnalyzing ? analyzingMessage : 'Analyze My Meal'}
                        </button>

                        <button
                          onClick={() => { stopVoiceCapture(); setFoodInput(''); setTimeout(startVoiceCapture, 200); }}
                          className="w-full text-center text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-all py-2"
                        >
                          ↻ Restart Voice
                        </button>
                      </div>
                    )}
                  </motion.div>
                ) : null}

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {analysisResult && (
          <MealAnalysisModal 
            meal={analysisResult} 
            onClose={() => setAnalysisResult(null)} 
            onAdd={analysisResult._alreadyLogged ? null : () => handleConfirmLog(analysisResult)} 
          />
        )}
      </AnimatePresence>

      {/* Recipe Detail Modal */}
      <AnimatePresence>
        {selectedRecipeSuggestion && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedRecipeSuggestion(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-100"
            >
              {/* Image & Close Button */}
              <div className="h-56 relative shrink-0">
                <img
                  src={selectedRecipeSuggestion.image}
                  alt={selectedRecipeSuggestion.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <button
                  onClick={() => setSelectedRecipeSuggestion(null)}
                  className="absolute top-6 right-6 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 hover:bg-white/40 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="absolute bottom-6 left-8">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-tight drop-shadow-md">
                    {selectedRecipeSuggestion.name}
                  </h3>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="p-8 overflow-y-auto scrollbar-hide flex-1">
                {/* Stats */}
                <div className="flex justify-between p-5 bg-slate-50 rounded-[2rem] border border-slate-100 mb-8">
                  <div className="text-center flex-1 border-r border-slate-200">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cals</p>
                    <p className="text-lg font-black text-slate-900">{selectedRecipeSuggestion.calories}</p>
                  </div>
                  <div className="text-center flex-1 border-r border-slate-200">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pro</p>
                    <p className="text-lg font-black text-slate-900">{selectedRecipeSuggestion.protein}g</p>
                  </div>
                  <div className="text-center flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Time</p>
                    <p className="text-lg font-black text-slate-900">20m</p>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Ingredients */}
                  <section>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white">
                        <Utensils className="w-4 h-4" />
                      </div>
                      <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900">Ingredients</h4>
                    </div>
                    <ul className="grid grid-cols-1 gap-3">
                      {selectedRecipeSuggestion.ingredients.map((ing, i) => (
                        <li key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          <span className="text-sm font-medium text-slate-600">{ing}</span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  {/* Instructions */}
                  <section>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-900 border border-slate-200">
                        <Clock className="w-4 h-4" />
                      </div>
                      <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900">Instructions</h4>
                    </div>
                    <div className="space-y-5">
                      {selectedRecipeSuggestion.instructions.map((step, i) => (
                        <div key={i} className="flex gap-4 group">
                          <span className="text-sm font-black text-slate-200 group-hover:text-slate-900 transition-colors">0{i + 1}</span>
                          <p className="text-sm font-medium text-slate-600 leading-relaxed">{step}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>

              {/* Action */}
              <div className="p-8 pt-0 mt-auto">
                <button
                  onClick={() => handleConfirmLog({
                    foodItem: {
                      name: selectedRecipeSuggestion.name,
                      quantity: '1 serving',
                      nutrition: {
                        calories: selectedRecipeSuggestion.calories,
                        protein: selectedRecipeSuggestion.protein,
                        carbs: selectedRecipeSuggestion.carbs,
                        fats: selectedRecipeSuggestion.fats
                      }
                    },
                    analysis: selectedRecipeSuggestion.reason
                  })}
                  className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all"
                >
                  Log this meal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden File Inputs - OUTSIDE modal so they survive camera app suspension */}
      <input
        ref={cameraModalInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleImageSelect(e)}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleImageSelect(e)}
      />
    </div>
  );
}

export default Nutrition;
