import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Plus, Camera, Mic, Lightbulb,
  Sun, Utensils, Cookie, Moon, Minus, Search, Wand2, X,
  Edit3, Image as ImageIcon,
  GlassWater, FileEdit, ScanLine, CheckCircle2, Loader2, Zap, Trash2, Clock, Sparkles, AlertCircle, FlaskConical
} from 'lucide-react';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { BarChart, Bar, Cell, ResponsiveContainer, XAxis, Tooltip } from 'recharts';
import api, { nutritionService, dietRecommendationService } from '../services/api';
import toast from 'react-hot-toast';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import NutritionSkeleton from '../components/skeletons/NutritionSkeleton';

function Nutrition() {
  const { user } = useAuth();
  const { 
    invalidateCache, 
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
  const [inputMethod, setInputMethod] = useState('Predict'); // 'Predict', 'Type', 'Scan'
  const [recType, setRecType] = useState('Recommended');

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
    'Mid-Morning': [],
    Lunch: [],
    Evening: [],
    Dinner: []
  });
  const [weeklyTrendsData, setWeeklyTrendsData] = useState([]);
  const [waterIntake, setWaterIntake] = useState({ current: 0, target: 8 });
  const [loading, setLoading] = useState(true);
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
        image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80',
        ingredients: ['Yellow Moong Dal', 'Basmati Rice', 'Ghee', 'Cumin Seeds', 'Turmeric', 'Green Chilies'],
        instructions: ['Pressure cook dal with turmeric.', 'Perform "Tadka" with ghee, cumin and chilies.', 'Steam rice until fluffy and serve together.']
      } : {
        name: 'Fish Curry + Brown Rice',
        calories: 350, protein: 28, carbs: 42, fats: 10,
        tags: ['OMEGA-3', 'LEAN PROTEIN'],
        reason: 'Traditional Indian style fish curry to support your heart health and protein goals.',
        image: 'https://images.unsplash.com/photo-1589187151032-573a91317445?w=800&q=80',
        ingredients: ['Fresh Fish Fillet', 'Onion-Tomato Masala', 'Ginger-Garlic Paste', 'Brown Rice', 'Curry Leaves'],
        instructions: ['Sauté onion and tomato paste with spices.', 'Add fish pieces and simmer in curry base.', 'Serve with warm cooked brown rice.']
      },
      'High Protein': isVeg ? {
        name: 'Paneer Bhurji + 2 Roti',
        calories: 420, protein: 22, carbs: 38, fats: 18,
        tags: ['MUSCLE REPAIR', 'PROTEIN RICH'],
        reason: 'Specifically suggested to help reach your protein target of 70g using fresh paneer.',
        image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=800&q=80',
        ingredients: ['Crumbled Paneer (150g)', 'Whole Wheat Roti', 'Chopped Onions', 'Bell Peppers', 'Garam Masala'],
        instructions: ['Heat oil and sauté onions and peppers.', 'Add crumbled paneer and spice mix.', 'Serve with freshly made soft wheat rotis.']
      } : {
        name: 'Chicken Tikka (Dry) + Salad',
        calories: 380, protein: 44, carbs: 10, fats: 14,
        tags: ['LEAN MUSCLE', 'POST WORKOUT'],
        reason: 'High protein, low carb meal to support muscle recovery without extra calories.',
        image: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&q=80',
        ingredients: ['Chicken Breast Cubes', 'Hung Curd', 'Lemon Juice', 'Tandoori Masala', 'Fresh Salad Leaves'],
        instructions: ['Marinate chicken in curd and spices for 30 mins.', 'Air fry or grill until charred and juicy.', 'Serve with a fresh squeeze of lemon and salad.']
      },
      'Balanced': {
        name: 'Mixed Veg Khichdi + Curd',
        calories: 310, protein: 14, carbs: 45, fats: 6,
        tags: ['EASY DIGESTION', 'GUT FRIENDLY'],
        reason: 'A light, gut-healing meal that balances all necessary macronutrients.',
        image: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=800&q=80',
        ingredients: ['Rice & Lentils Mix', 'Carrots', 'Peas', 'Fresh Curd (Dahi)', 'Roasted Cumin'],
        instructions: ['Cook rice, lentils and chopped veg in a pressure cooker.', 'Finish with a tiny dollop of ghee.', 'Serve with a bowl of refreshing cold curd.']
      },
      'Low Carb': isVeg ? {
        name: 'Egg Bhurji (3 Eggs) - No Bread',
        calories: 240, protein: 18, carbs: 6, fats: 15,
        tags: ['WEIGHT LOSS', 'KETO STYLE'],
        reason: 'Simple Indian egg scramble to keep you full without traditional heavy carbs.',
        image: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=800&q=80',
        ingredients: ['3 Whole Eggs', 'Onions', 'Tomatoes', 'Green Chilies', 'Coriander'],
        instructions: ['Whisk eggs with a pinch of salt.', 'Sauté onions and chilies until soft.', 'Add eggs and scramble until moist and fully cooked.']
      } : {
        name: 'Masala Omelette + Sprouts',
        calories: 260, protein: 20, carbs: 12, fats: 14,
        tags: ['LOW CALORIE', 'ENERGY SNAP'],
        reason: 'A low-glycemic choice that helps maintain stable blood sugar levels.',
        image: 'https://images.unsplash.com/photo-1510693395975-2292190049bd?w=800&q=80',
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
          image: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80',
          ingredients: ['Palak (Spinach)', 'Yellow Lentils', 'Garlic', 'Ghee'],
          instructions: ['Boil lentils.', 'Sauté spinach and spices.', 'Combine and temper with garlic ghee.']
        };
      } else if (topDef.includes('fiber') || topDef.includes('gut')) {
        suggestionsMap['Recommended'] = {
          name: 'Bajra Khichdi + Chaas',
          calories: 330, protein: 12, carbs: 55, fats: 4,
          tags: ['HIGH FIBER', 'GUT HEALTH'],
          reason: `Fiber boost: Found to be low in your recent analysis, this meal will help fix your digestion.`,
          image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80',
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
  const [prepMethod, setPrepMethod] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = React.useRef(null);
  const [expandedMeal, setExpandedMeal] = useState(null);
  const [analyzingMessage, setAnalyzingMessage] = useState('Analyzing food...');

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
    fetchData();
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
  }, [location.state, selectedDate]);

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

  const fetchData = async () => {
    // Only show full page loader if we have NO data at all
    if (!cachedNutritionData && !cachedNutritionLogs) {
      setLoading(true);
    }

    try {
      const date = selectedDate;
      const [summary, logs, trends, goals] = await Promise.all([
        fetchNutrition(date),
        fetchNutritionLogs(date),
        fetchWeeklyTrends(),
        fetchHealthGoals(),
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
        'Mid-Morning': [],
        Lunch: [],
        Evening: [],
        Dinner: []
      };

      if (logs) {
        logs.forEach(log => {
          const type = log.mealType;
          if (type.toLowerCase().includes('breakfast')) grouped.Breakfast.push(log);
          else if (type.toLowerCase().includes('mid') || type.toLowerCase().includes('morning')) grouped['Mid-Morning'].push(log);
          else if (type.toLowerCase().includes('lunch')) grouped.Lunch.push(log);
          else if (type.toLowerCase().includes('evening') || type.toLowerCase().includes('afternoon')) grouped.Evening.push(log);
          else if (type.toLowerCase().includes('dinner')) grouped.Dinner.push(log);
          else grouped.Evening.push(log); // Fallback to evening for generic snacks
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
      const newWater = Math.max(0, waterIntake.current + change);
      // We don't have a direct water log endpoint in the snippet, 
      // but usually we log it as a progress or as part of daily sync.
      // For now, let's update local state and toast.
      setWaterIntake(prev => ({ ...prev, current: newWater }));
      await api.post('health/daily-progress', {
        date: selectedDate,
        waterIntake: newWater
      });
      toast.success('Water intake updated');
    } catch (error) {
      toast.error('Failed to update water');
    }
  };

  const openModal = (meal) => {
    setMealTab(meal);
    setIsModalOpen(true);
    setAnalysisResult(null);
    setFoodInput('');
    setFoodQuantity('');
    setPrepMethod('');
    setImage(null);
    setImagePreview(null);
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

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setImage(compressed);
      setImagePreview(URL.createObjectURL(compressed));
    } catch (error) {
      toast.error('Failed to process image');
    }
  };

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
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000
      });

      const result = response.data.data;
      const isCached = response.data.isCached || response.data.source === 'global_cache';
      
      setAnalysisResult({
        ...result,
        _isFromCache: isCached,
        _cacheSource: response.data.source
      });

      // Instead of auto-logging, we show the result modal first
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
      const mappedMealType = 
        mealTab.toLowerCase() === 'mid-morning' ? 'midMorningSnack' : 
        mealTab.toLowerCase() === 'evening' ? 'eveningSnack' : 
        mealTab.toLowerCase();

      const logData = {
        mealType: mappedMealType,
        foodItems: [{
          name: data.foodItem?.name || data.foodName,
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
        date: selectedDate
      };
      await nutritionService.logMeal(logData);
      toast.success('Added to ' + mealTab);
      invalidateCache(['dashboard', `logs_${selectedDate}`, `nutrition_${selectedDate}`]);
      fetchData();
      setIsModalOpen(false);
      setAnalysisResult(null);
    } catch (error) {
      toast.error('Failed to log meal');
    }
  };

  const finalTranscriptRef = React.useRef('');

  const startVoiceCapture = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-IN';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      finalTranscriptRef.current = ''; // Reset accumulated transcript
      if (inputMethod === 'Predict') {
        setFoodInput('');
      }
      toast('Listening...', { icon: '🎙️', duration: 2000 });
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      
      // Process only from the latest resultIndex to avoid reprocessing old results
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Build display text: committed finals + current interim
      const displayText = (finalTranscriptRef.current + ' ' + interimTranscript).trim();
      setFoodInput(displayText);
    };

    recognition.onerror = (event) => {
      console.error('Speech Recognition Error:', event.error);
      setIsListening(false);
      toast.error('Voice capture failed: ' + event.error);
    };

    try {
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  const stopVoiceCapture = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const deleteLog = async (id) => {
    if (!confirm('Delete this food log?')) return;
    try {
      await api.delete(`nutrition/logs/${id}`);
      toast.success('Deleted');
      fetchData();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const changeDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const remainingCals = Math.max(0, dailySummary.calorieTarget - dailySummary.caloriesConsumed);
  const progressPercent = Math.min(100, (dailySummary.caloriesConsumed / dailySummary.calorieTarget) * 100);
  if (loading && (!dailySummary.caloriesConsumed && !mealLogs.Breakfast.length)) {
    return <NutritionSkeleton />;
  }

  return (
    <div className="min-h-screen bg-transparent pb-32 px-4 md:px-6 lg:px-16 pt-8 relative overflow-hidden font-sans text-slate-800">


      <div className="relative z-10 w-full">

        {/* Header - Optimized for Global Sticky Header */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4 md:mb-8 mt-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4 w-full md:w-auto">
            <div className="flex items-center justify-between md:justify-start bg-white/60 border border-white/40 backdrop-blur-md rounded-full px-4 py-2 shadow-sm w-full md:w-fit">
              <button onClick={() => changeDate(-1)} className="p-1 text-slate-400 hover:text-slate-600"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm font-semibold px-3 uppercase tracking-tight">
                {new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Asia/Kolkata' })}
              </span>
              <button onClick={() => changeDate(1)} className="p-1 text-slate-400 hover:text-slate-600"><ChevronRight className="w-4 h-4" /></button>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pb-2 md:pb-0 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
              <button
                onClick={() => openModal('Lunch')}
                className="flex-shrink-0 flex items-center gap-1.5 bg-slate-900 text-white px-5 py-3 rounded-full text-sm font-semibold hover:bg-black transition-colors"
              >
                <Plus className="w-4 h-4" /> Log Meal
              </button>

              <button
                onClick={() => { setInputMethod('Scan'); openModal('Lunch'); }}
                className="flex-shrink-0 flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 px-5 py-3 rounded-full text-sm font-semibold shadow-sm transition-colors"
              >
                <Camera className="w-4 h-4" /> Scan
              </button>

              <button
                onClick={() => {
                  setInputMethod('Predict');
                  setIsModalOpen(true);
                  setFoodInput('');
                  setTimeout(startVoiceCapture, 100);
                }}
                className="flex-shrink-0 flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 px-5 py-3 rounded-full text-sm font-semibold shadow-sm transition-colors text-slate-800"
              >
                <Mic className={`w-4 h-4 ${isListening ? 'text-red-500 animate-pulse' : ''}`} /> Voice
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Goal Exceeded Alert */}
        <AnimatePresence>
          {(dailySummary.caloriesConsumed > dailySummary.calorieTarget || 
            dailySummary.protein > dailySummary.proteinTarget || 
            dailySummary.carbs > dailySummary.carbsTarget || 
            dailySummary.fats > dailySummary.fatsTarget) && (
            <motion.div 
              initial={{ height: 0, opacity: 0, marginBottom: 0 }}
              animate={{ height: 'auto', opacity: 1, marginBottom: 32 }}
              exit={{ height: 0, opacity: 0, marginBottom: 0 }}
              className="bg-black text-white p-6 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-6 border-4 border-red-500/50 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-[400px] h-full bg-red-500/10 rounded-full blur-[80px] pointer-events-none" />
              <div className="w-14 h-14 bg-red-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-red-500/40">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h4 className="text-lg font-black uppercase tracking-tighter mb-1">
                  Threshold Exceeded
                </h4>
                <p className="text-xs font-bold text-red-100 uppercase tracking-widest leading-relaxed">
                  You have surpassed your recommended intake for 
                  {dailySummary.caloriesConsumed > dailySummary.calorieTarget && <span className="text-white bg-red-500/20 px-2 mx-1 rounded-lg border border-red-500/20">Calories</span>}
                  {dailySummary.protein > dailySummary.proteinTarget && <span className="text-white bg-red-500/20 px-2 mx-1 rounded-lg border border-red-500/20">Protein</span>}
                  {dailySummary.carbs > dailySummary.carbsTarget && <span className="text-white bg-red-500/20 px-2 mx-1 rounded-lg border border-red-500/20">Carbs</span>}
                  {dailySummary.fats > dailySummary.fatsTarget && <span className="text-white bg-red-500/20 px-2 mx-1 rounded-lg border border-red-500/20">Fats</span>}
                   today. Consider lighter meals for the rest of the protocol.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                 <button 
                   onClick={() => navigate('/diet-plan')} 
                   className="bg-white text-black px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center gap-2"
                 >
                   <Sparkles className="w-3 h-3 text-emerald-500" /> View Recovery Diet
                 </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] xl:grid-cols-[1.5fr_1fr] gap-8">

          {/* Left Column */}
          <div className="space-y-6">

            {/* Daily Calorie Intake Card */}
            <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] border border-slate-100">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-4">Daily Calorie Intake</p>
              <div className="flex items-center justify-between mb-6 flex-nowrap">
                <div className="flex items-baseline gap-1 shrink-0">
                  <span className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter">{dailySummary.caloriesConsumed}</span>
                  <span className="text-sm md:text-xl text-slate-400 font-bold">/ {dailySummary.calorieTarget}</span>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 bg-slate-50 px-3 md:px-4 py-2 rounded-2xl border border-slate-100 shadow-sm shrink-0 ml-2">
                  <div className="text-lg md:text-3xl font-black text-slate-900 leading-none">{Math.round(progressPercent)}%</div>
                  <div className="text-[7px] md:text-[10px] text-slate-400 uppercase tracking-widest font-black leading-none">GOAL</div>
                </div>
              </div>
              <p className="text-sm text-slate-500 font-bold mb-8 uppercase tracking-tight">{remainingCals.toFixed(2)} kcal remaining</p>

              {/* Progress Bar */}
              <div className="h-4 bg-slate-50 rounded-full w-full overflow-hidden mb-10 border border-slate-100">
                <motion.div initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }} transition={{ duration: 1, ease: "easeOut" }} className="h-full bg-slate-900 rounded-full" />
              </div>

              {/* Macros */}
              <div className="grid grid-cols-3 gap-8">
                {[
                  { label: 'PROTEIN', current: dailySummary.protein, target: dailySummary.proteinTarget, color: 'bg-black' },
                  { label: 'CARBS', current: dailySummary.carbs, target: dailySummary.carbsTarget, color: 'bg-slate-400' },
                  { label: 'FATS', current: dailySummary.fats, target: dailySummary.fatsTarget, color: 'bg-slate-900' }
                ].map(macro => (
                  <div key={macro.label}>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">{macro.label}</p>
                    <p className="text-xs font-black text-slate-900 mb-2 uppercase">{macro.current}G / {macro.target}G</p>
                    <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden mb-1.5 border border-slate-100">
                      <div className={`h-full ${macro.color} rounded-full transition-all duration-1000`} style={{ width: `${Math.min(100, (macro.current / macro.target) * 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{Math.max(0, macro.target - macro.current).toFixed(2)}g remaining</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Meal Timeline */}
            <div>
              <h3 className="font-black text-slate-900 uppercase tracking-tight mb-5 text-lg">Meal Timeline</h3>
              <div className="space-y-4">
                {[
                  { name: 'Breakfast', icon: Sun, ratio: 0.25 },
                  { name: 'Mid-Morning', icon: Sparkles, ratio: 0.10 },
                  { name: 'Lunch', icon: Utensils, ratio: 0.30 },
                  { name: 'Evening', icon: Cookie, ratio: 0.10 },
                  { name: 'Dinner', icon: Moon, ratio: 0.25 }
                ].map((meal) => {
                  const logs = mealLogs[meal.name] || [];
                  const cals = logs.reduce((sum, l) => sum + (l.foodItems?.[0]?.nutrition?.calories || 0), 0);
                  const mealTarget = Math.round(dailySummary.calorieTarget * meal.ratio);
                  const isOver = cals > mealTarget;
                  const isExpanded = expandedMeal === meal.name;

                  return (
                    <motion.div
                      key={meal.name}
                      layout
                      onClick={() => setExpandedMeal(isExpanded ? null : meal.name)}
                      className={`p-5 bg-white border ${isOver ? 'border-red-200' : 'border-slate-100'} rounded-[2.5rem] shadow-sm hover:border-slate-300 transition-all cursor-pointer overflow-hidden ${isExpanded ? 'ring-2 ring-slate-900 ring-offset-2' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5">
                          <div className={`w-14 h-14 rounded-[1.5rem] ${isOver ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-900'} flex items-center justify-center border border-slate-100 transition-colors`}>
                            <meal.icon className="w-6 h-6" />
                          </div>
                          <div>
                            <span className="font-black text-sm text-slate-900 uppercase tracking-tight">{meal.name}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <span className={`text-xs font-black ${isOver ? 'text-red-500' : 'text-slate-400'} uppercase tracking-wider block`}>{cals} of {mealTarget} kcal</span>
                            {isOver && <span className="text-[9px] font-bold text-red-400 uppercase tracking-tight">Limit exceeded</span>}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openModal(meal.name);
                            }}
                            className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all border border-slate-100 shadow-sm"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-6 pt-6 border-t border-slate-50 space-y-4"
                          >
                            {/* Detailed Logs */}
                            <div className="space-y-3">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Logged Items</p>
                              {logs.length > 0 ? logs.map(log => (
                                <div 
                                  key={log._id} 
                                  onClick={() => setAnalysisResult(log)}
                                  className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 group/item cursor-pointer hover:bg-white hover:border-slate-200 transition-all"
                                >
                                  <div>
                                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{log.foodItems?.[0]?.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{log.foodItems?.[0]?.nutrition?.calories} kcal • {log.foodItems?.[0]?.quantity}</p>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteLog(log._id);
                                    }}
                                    className="w-8 h-8 rounded-full bg-white text-slate-300 hover:text-red-500 flex items-center justify-center border border-slate-100 opacity-0 group-hover/item:opacity-100 transition-all"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )) : (
                                <p className="text-xs font-bold text-slate-300 italic text-center py-2">Nothing logged yet</p>
                              )}
                            </div>

                            {/* Meal Insights */}
                            {isOver && (
                              <div className="bg-red-50 rounded-2xl p-4 border border-red-100 flex gap-3 items-start">
                                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">AI Insight</p>
                                  <p className="text-xs font-bold text-red-800 leading-relaxed">
                                    You've exceeded your {meal.name.toLowerCase()} target by {cals - mealTarget} kcal.
                                    Consider a lighter {meal.name === 'Dinner' ? 'snack tonight' : 'next meal'} to balance your daily intake.
                                  </p>
                                </div>
                              </div>
                            )}

                            {!isOver && cals > 0 && (
                              <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 flex gap-3 items-start">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">AI Insight</p>
                                  <p className="text-xs font-bold text-emerald-800 leading-relaxed">
                                    Great control! You are well within your {meal.name.toLowerCase()} limit.
                                  </p>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Row: Recent Meals & Frequent Foods */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="font-black text-xs text-slate-900 uppercase tracking-widest">Recent Meals</h4>
                  <button className="text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors">View All</button>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide -mx-2 px-2 snap-x">
                  {recentMeals.length > 0 ? recentMeals.map((m, i) => (
                    <motion.div
                      key={m._id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ y: -5 }}
                      onClick={() => setAnalysisResult({ ...m, _id: 'new_log_again' })}
                      className="flex-shrink-0 w-[240px] bg-slate-50 border border-slate-100 rounded-[2.5rem] p-6 cursor-pointer hover:bg-white hover:shadow-2xl transition-all group flex flex-col justify-between snap-center"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-slate-900 transition-colors">
                            <Utensils className="w-6 h-6 text-slate-900 group-hover:text-white transition-colors" />
                          </div>
                          <div className="bg-white/50 px-3 py-1 rounded-full border border-slate-100 backdrop-blur-sm">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{m.mealType}</span>
                          </div>
                        </div>
                        <h5 className="text-[11px] font-black text-slate-900 uppercase tracking-tight mb-1 truncate">
                          {m.foodItems?.[0]?.name}
                        </h5>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                          {m.foodItems?.[0]?.nutrition?.calories || 0} Kcal • {m.foodItems?.[0]?.nutrition?.protein || 0}g Protein
                        </p>
                      </div>
                      <div className="mt-6 pt-4 border-t border-slate-100/50 flex justify-between items-center">
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Added {new Date(m.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })} • {new Date(m.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Asia/Kolkata' })}</span>
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all">
                          <Plus className="w-4 h-4" />
                        </div>
                      </div>
                    </motion.div>
                  )) : (
                    <div className="w-full text-center py-10 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">No recent logs found</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="font-black text-xs text-slate-900 uppercase tracking-widest">Frequent Foods</h4>
                  <button className="text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors">Manage</button>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {['Curd', 'Chicken', 'Egg', 'Oats', 'Milk', 'Dal'].map(f => (
                    <div key={f} className="px-4 py-2 border border-slate-100 rounded-xl flex items-center gap-3 hover:bg-slate-50 cursor-pointer transition-all hover:border-slate-300">
                      <span className="text-[10px] font-black text-slate-900 uppercase">{f}</span>
                      <span className="text-[10px] text-slate-400 font-bold">120k</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Right Column */}
          <div className="space-y-6">

            {/* Insights */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
                <Lightbulb className="w-6 h-6 text-slate-900" />
              </div>
              <div>
                <h4 className="font-black text-base text-slate-900 mb-1 uppercase tracking-tight">Today's Insights</h4>
                <p className="text-sm text-slate-500 font-bold leading-relaxed">{aiInsights}</p>
              </div>
            </div>

            {/* Smart Meal Suggestions */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
              <h4 className="font-black text-base text-slate-900 mb-6 uppercase tracking-tight">Smart Meal Suggestions</h4>

              <div className="flex gap-6 mb-8 overflow-x-auto pb-1 scrollbar-hide">
                {['Recommended', 'High Protein', 'Balanced', 'Low Carb'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setRecType(tab)}
                    className={`text-[10px] font-black uppercase tracking-widest pb-2 transition-all border-b-2 whitespace-nowrap ${recType === tab ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {currentSuggestion ? (
                <div className="border border-slate-50 rounded-[2rem] overflow-hidden group hover:shadow-xl transition-all duration-500">
                  <div className="h-44 relative bg-slate-100">
                    <ImageWithFallback
                      src={currentSuggestion.image}
                      query={currentSuggestion.name}
                      alt={currentSuggestion.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg text-[9px] font-black text-slate-900 shadow-lg tracking-widest uppercase">
                      {recType === 'Recommended' ? 'Highly Personalized' : 'Targeted Prediction'}
                    </div>
                  </div>
                  <div className="p-6">
                    <h5 className="font-black text-lg text-slate-900 mb-4 tracking-tight uppercase leading-none">{currentSuggestion.name}</h5>
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex gap-4">
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">PRO</span>
                          <span className="text-xs font-black text-slate-900">{currentSuggestion.protein}g</span>
                        </div>
                        <div className="flex flex-col border-l border-slate-100 pl-4">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">CAL</span>
                          <span className="text-xs font-black text-slate-900">{currentSuggestion.calories}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Clock className="w-3 h-3" /> 20 MIN
                      </span>
                    </div>
                    <div className="flex gap-2 mb-5">
                      {(currentSuggestion.tags || []).map(t => (
                        <span key={t} className="bg-slate-50 text-slate-400 text-[8px] font-black px-3 py-1.5 rounded-lg tracking-widest uppercase">{t}</span>
                      ))}
                    </div>

                    <div className="mb-6 p-4 bg-slate-50 border border-slate-100/50 rounded-2xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-3.5 h-3.5 text-slate-900" />
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Why suggest this?</span>
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 leading-relaxed italic">
                        "{currentSuggestion.reason}"
                      </p>
                    </div>

                    <button 
                      onClick={() => setSelectedRecipeSuggestion(currentSuggestion)}
                      className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95"
                    >
                      View Recipe
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                  <Utensils className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Generating personalized plan...</p>
                </div>
              )}
            </div>

            {/* Water Intake */}
            <div id="water-section" className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden flex items-center justify-between group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />

              <div className="relative z-10 flex-1">
                <h4 className="font-black text-[10px] uppercase tracking-widest mb-6 text-white/40">Water Intake</h4>
                <div className="flex items-center gap-6 mb-6">
                  <button onClick={() => handleWaterUpdate(-1)} className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center hover:bg-white/20 transition-all active:scale-90 border border-white/5"><Minus className="w-5 h-5" /></button>
                  <span className="text-6xl font-black tracking-tighter">{waterIntake.current}</span>
                  <button onClick={() => handleWaterUpdate(1)} className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center hover:bg-white/20 transition-all active:scale-90 border border-white/5"><Plus className="w-5 h-5" /></button>
                </div>
                <div className="space-y-3">
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden w-full border border-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (waterIntake.current / waterIntake.target) * 100)}%` }}
                      className="h-full bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                    />
                  </div>
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{waterIntake.current} out of {waterIntake.target} glasses</p>
                </div>
              </div>
              <div className="relative z-10 ml-8 flex flex-col items-center gap-3">
                <GlassWater className="w-16 h-16 text-white/90 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]" strokeWidth={1} />
                <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em] whitespace-nowrap">1 Glass (250 ml)</span>
              </div>
            </div>

            {/* Weekly Trends */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <h4 className="font-black text-xs text-slate-900 uppercase tracking-widest">Weekly Trends</h4>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">LAST 7 DAYS</span>
              </div>
              <div className="h-44 mb-8">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyTrendsData}>
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)', padding: '12px' }}
                      labelStyle={{ fontWeight: '900', color: '#1e293b', fontSize: '10px', textTransform: 'uppercase' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>
                      {(weeklyTrendsData || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.active ? '#1e293b' : '#f1f5f9'} className="transition-all duration-300 hover:opacity-80" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-slate-500 font-bold mb-6 leading-relaxed uppercase tracking-tight">
                Your average daily intake is <span className="text-slate-900">1,680 kcal</span>. Your intake is <span className="text-emerald-600">12% lower</span> than last week.
              </p>
              <div className="inline-flex items-center gap-2.5 bg-slate-50 text-slate-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100 shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-black" /> GOOD PROGRESS
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Add Meal Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            data-modal="true"
            className="fixed inset-0 z-[999] flex items-center justify-center p-0 md:p-4 bg-slate-900/40 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 20, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-t-[2.5rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col h-[90vh] md:max-h-[90vh] border border-slate-100"
            >
              {/* Header */}
              <div className="p-8 pb-4 border-b border-slate-50">
                <div className="flex justify-between items-center mb-8">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dietary Protocol</span>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Add to {mealTab}</h3>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center transition-all border border-slate-100">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="flex gap-2 mb-8 overflow-x-auto pb-1 scrollbar-hide">
                  {['Breakfast', 'Mid-Morning', 'Lunch', 'Evening', 'Dinner'].map(tab => (
                    <button
                      key={tab} onClick={() => setMealTab(tab)}
                      className={`text-[10px] font-black px-5 py-2 rounded-full transition-all uppercase tracking-widest whitespace-nowrap ${mealTab === tab ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                  {[
                    { name: 'Scan', icon: ScanLine },
                    { name: 'Type', icon: FileEdit },
                    { name: 'Predict', icon: Mic }
                  ].map(tab => (
                    <button
                      key={tab.name} onClick={() => setInputMethod(tab.name)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${inputMethod === tab.name ? 'bg-white shadow-xl text-slate-900' : 'text-slate-400 hover:text-slate-900'}`}
                    >
                      <tab.icon className="w-4 h-4" /> {tab.name === 'Predict' ? 'Voice Log' : tab.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div className="p-5 md:p-8 overflow-y-auto flex-1 scrollbar-hide">

                {isAnalyzing ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center space-y-6 h-full py-12">
                    <div className="relative w-24 h-24">
                      <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
                      <motion.div
                        className="absolute inset-0 border-4 border-slate-900 rounded-full border-t-transparent"
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      />
                      <Wand2 className="w-8 h-8 text-slate-900 absolute inset-0 m-auto animate-pulse" />
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
                      <div className="flex items-center justify-center gap-1.5 mt-2">
                        {[0, 1, 2].map(i => (
                          <motion.div
                            key={i}
                            className="w-2 h-2 bg-slate-400 rounded-full"
                            animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                            transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.3 }}
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>

                ) : inputMethod === 'Predict' ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center space-y-6 py-4">
                    {/* Mic Button */}
                    <div className="relative">
                      {isListening && (
                        <>
                          <div className="absolute inset-0 rounded-full bg-red-400 opacity-20 animate-ping" />
                          <div className="absolute -inset-4 rounded-full bg-red-400 opacity-10 animate-ping" style={{ animationDelay: '0.2s' }} />
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
                        className={`relative w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center transition-all shadow-xl ${isListening
                          ? 'bg-red-500 text-white scale-110'
                          : 'bg-slate-900 text-white hover:bg-black hover:scale-105'
                          }`}
                      >
                        <Mic className={`w-10 h-10 md:w-12 md:h-12 ${isListening ? 'animate-pulse' : ''}`} />
                      </button>
                    </div>

                    {/* Status Text */}
                    {!foodInput && (
                      <div className="text-center space-y-2 px-4">
                        <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                          {isListening ? 'Listening...' : 'Tap to speak'}
                        </h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-[250px] mx-auto leading-relaxed">
                          {isListening
                            ? 'Say what you ate, e.g. "I had two chapati with dal"'
                            : 'Describe your meal naturally and let AI do the rest'}
                        </p>
                      </div>
                    )}

                    {/* Real-time Speech Text */}
                    {foodInput && (
                      <div className="w-full space-y-5">
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 min-h-[80px] flex items-center justify-center relative">
                          <p className="text-sm font-semibold text-slate-800 leading-relaxed text-center w-full">{foodInput}</p>
                          {isListening && <div className="w-2 h-2 bg-red-500 rounded-full absolute bottom-3 right-3 animate-pulse" />}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Optional: Quantity</p>
                            <input
                              type="text"
                              value={foodQuantity}
                              onChange={(e) => setFoodQuantity(e.target.value)}
                              placeholder="e.g., 2 bowls"
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-black text-xs font-bold"
                            />
                          </div>
                          <div className="space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Prep Method</p>
                            <select
                              value={prepMethod}
                              onChange={(e) => setPrepMethod(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-slate-300 transition-all appearance-none cursor-pointer"
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

                        {/* Analyze Button */}
                        <button
                          onClick={handleAnalyzeAndLog}
                          disabled={isAnalyzing}
                          className="w-full py-5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl active:scale-[0.98] disabled:opacity-50"
                        >
                          {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                          {isAnalyzing ? analyzingMessage : 'Analyze My Meal'}
                        </button>

                        {/* Restart Voice - small link */}
                        <button
                          onClick={() => { stopVoiceCapture(); setFoodInput(''); setTimeout(startVoiceCapture, 200); }}
                          className="w-full text-center text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-all py-2"
                        >
                          ↻ Restart Voice
                        </button>
                      </div>
                    )}
                  </motion.div>
                ) : inputMethod === 'Type' ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                    <div className="relative">
                      <Search className="w-5 h-5 text-slate-300 absolute left-5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={foodInput}
                        onChange={(e) => setFoodInput(e.target.value)}
                        placeholder="Search for food or describe..."
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-black text-black font-bold"
                      />
                      <button onClick={startVoiceCapture} className={`p-2 absolute right-4 top-1/2 -translate-y-1/2 rounded-xl transition-all ${isListening ? 'bg-red-50 text-red-500 animate-pulse' : 'text-slate-300 hover:text-slate-900 hover:bg-slate-100'}`}>
                        <Mic className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Optional: Quantity</p>
                        <input
                          type="text"
                          value={foodQuantity}
                          onChange={(e) => setFoodQuantity(e.target.value)}
                          placeholder="e.g., 2 bowls, 500g"
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-black text-black font-bold placeholder:text-slate-400"
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">How was it made?</p>
                        <select
                          value={prepMethod}
                          onChange={(e) => setPrepMethod(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-[11px] font-bold text-slate-900 outline-none focus:bg-white focus:border-slate-300 transition-all appearance-none cursor-pointer"
                        >
                          <option value="">Select Method</option>
                          <option value="homemade">Homemade</option>
                          <option value="fried">Deep Fried</option>
                          <option value="package">Packaged/Processed</option>
                          <option value="street">Street Food</option>
                          <option value="boiled">Boiled/Steamed</option>
                          <option value="roasted">Roasted/Grilled</option>
                        </select>
                      </div>
                    </div>

                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Quick search tags</p>
                    <div className="flex flex-wrap gap-2.5">
                      {['Apple', 'Rice & Dal', 'Paneer Sabzi', 'Oats', 'Coffee'].map(tag => (
                        <button key={tag} onClick={() => setFoodInput(tag)} className="px-4 py-2 border border-slate-100 rounded-xl text-[10px] font-black text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all uppercase tracking-widest">
                          {tag}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={handleAnalyzeAndLog}
                      disabled={isAnalyzing || !foodInput}
                      className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl active:scale-95 disabled:opacity-50"
                    >
                      {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 text-white" />}
                      {isAnalyzing ? analyzingMessage : 'Analyze & Log Meal'}
                    </button>
                  </motion.div>
                ) : inputMethod === 'Scan' ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center space-y-8">
                    <div className="w-full h-48 md:h-80 bg-slate-50 rounded-[2rem] md:rounded-[3rem] flex items-center justify-center relative overflow-hidden border-4 border-dashed border-slate-200 group transition-all hover:border-slate-300 cursor-pointer"
                      onClick={() => document.getElementById('food-img-upload').click()}>

                      {imagePreview ? (
                        <img src={imagePreview} className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <div className="absolute top-6 left-6 w-8 h-8 border-t-4 border-l-4 border-slate-200 rounded-tl-xl group-hover:border-slate-400 transition-colors" />
                          <div className="absolute top-6 right-6 w-8 h-8 border-t-4 border-r-4 border-slate-200 rounded-tr-xl group-hover:border-slate-400 transition-colors" />
                          <div className="absolute bottom-6 left-6 w-8 h-8 border-b-4 border-l-4 border-slate-200 rounded-bl-xl group-hover:border-slate-400 transition-colors" />
                          <div className="absolute bottom-6 right-6 w-8 h-8 border-b-4 border-r-4 border-slate-200 rounded-br-xl group-hover:border-slate-400 transition-colors" />

                          <div className="text-center space-y-3">
                            <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center mx-auto transition-transform duration-500 group-hover:rotate-12">
                              <Camera className="w-8 h-8 text-slate-900" />
                            </div>
                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Click to upload photo</p>
                          </div>
                        </>
                      )}
                      <input id="food-img-upload" type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full">
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Optional: Quantity</p>
                        <input
                          type="text"
                          value={foodQuantity}
                          onChange={(e) => setFoodQuantity(e.target.value)}
                          placeholder="e.g., 2 bowls, 3 eggs"
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-5 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-black text-sm font-bold placeholder:text-slate-400"
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Prep Method</p>
                        <select
                          value={prepMethod}
                          onChange={(e) => setPrepMethod(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-5 text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-slate-300 transition-all appearance-none cursor-pointer"
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


                    <button
                      onClick={handleAnalyzeAndLog}
                      disabled={isAnalyzing || !image}
                      className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl active:scale-95 disabled:opacity-50"
                    >
                      {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
                      {isAnalyzing ? analyzingMessage : 'Analyze Photo'}
                    </button>

                    <p className="hidden md:block text-[10px] text-slate-400 text-center font-bold px-8 leading-relaxed uppercase tracking-tight">
                      Point your camera at the food. AI will instantly detect the dish, portion size and calculate accurate macros.
                    </p>
                  </motion.div>
                ) : null}

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {analysisResult && (
          <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAnalysisResult(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-t-[3rem] md:rounded-[3rem] shadow-[0_32px_120px_rgba(0,0,0,0.15)] overflow-hidden h-[95vh] md:max-h-[90vh] flex flex-col"
            >
              {/* Premium Black & White Header */}
              <div className="p-6 md:p-10 bg-slate-900 text-white relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32" />
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4 md:mb-8">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-white/10 backdrop-blur-md rounded-[1.2rem] md:rounded-[1.5rem] flex items-center justify-center border border-white/10">
                      <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-white" />
                    </div>
                    <button onClick={() => setAnalysisResult(null)} className="w-10 h-10 md:w-12 md:h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all border border-white/10">
                      <X className="w-5 h-5 md:w-6 md:h-6 text-white" />
                    </button>
                  </div>
                  <h4 className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-2 px-1">
                    Analysis Log View
                  </h4>
                  <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase leading-none mb-4 max-w-[90%]">
                    {analysisResult.foodItem?.name || analysisResult.foodName || analysisResult.foodItems?.[0]?.name}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[10px] font-black bg-white/10 border border-white/10 px-4 py-2 rounded-xl tracking-[0.1em] uppercase">
                      {analysisResult.foodItem?.quantity || analysisResult.quantity || '1 serving'}
                    </span>
                    <span className="text-[10px] font-black bg-white/10 border border-white/10 px-4 py-2 rounded-xl tracking-[0.1em] uppercase flex items-center gap-2">
                      <Zap className="w-3 h-3 text-white" />
                      Score: {analysisResult.healthScore || analysisResult.healthScore10 * 10 || 0}/100
                    </span>
                    {analysisResult._isFromCache && (
                      <span className="text-[10px] font-black bg-emerald-500 text-white px-4 py-2 rounded-xl tracking-[0.1em] uppercase flex items-center gap-2 animate-pulse">
                        <CheckCircle2 className="w-3 h-3 text-white" />
                        Intelligence Cache
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-10 space-y-10 overflow-y-auto scrollbar-hide">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Calories', value: analysisResult.foodItem?.nutrition?.calories || analysisResult.totalNutrition?.calories || analysisResult.nutrition?.calories || analysisResult.calories || 0, unit: 'kcal' },
                    { label: 'Protein', value: analysisResult.foodItem?.nutrition?.protein || analysisResult.totalNutrition?.protein || analysisResult.nutrition?.protein || analysisResult.protein || 0, unit: 'g' },
                    { label: 'Carbs', value: analysisResult.foodItem?.nutrition?.carbs || analysisResult.totalNutrition?.carbs || analysisResult.nutrition?.carbs || analysisResult.carbs || 0, unit: 'g' },
                    { label: 'Fats', value: analysisResult.foodItem?.nutrition?.fats || analysisResult.totalNutrition?.fats || analysisResult.nutrition?.fats || analysisResult.fats || 0, unit: 'g' }
                  ].map((m) => (
                    <div key={m.label} className="bg-white p-5 rounded-[2rem] text-center border-2 border-slate-900 flex flex-col justify-center shadow-sm">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.label}</p>
                      <p className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{m.value}<span className="text-[10px] ml-0.5 text-slate-400 font-bold uppercase">{m.unit}</span></p>
                    </div>
                  ))}
                </div>

                {/* AI Analysis Summary */}
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2.5">
                    <Lightbulb className="w-4 h-4 text-slate-900" /> Health Summary
                  </h4>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed bg-slate-50 p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-slate-100 italic relative">
                    <span className="text-4xl text-slate-200 absolute top-2 left-2 md:top-4 md:left-4 font-serif">"</span>
                    {analysisResult.analysis || analysisResult.healthBenefitsSummary || "Detailed nutritional analysis successfully processed by our AI."}
                  </p>
                </div>

                {/* Micronutrients & Benefits */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2.5">
                      <FlaskConical className="w-4 h-4" /> Micronutrients
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(analysisResult.micronutrients || []).length > 0 ? (
                        analysisResult.micronutrients.map((micro, i) => (
                          <div key={i} className="px-4 py-2 bg-white border border-slate-100 rounded-xl text-[10px] font-bold text-slate-600 shadow-sm uppercase">
                            {typeof micro === 'string' ? micro : micro.name}
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-slate-400 font-bold uppercase italic">Rich in minerals & antioxidants.</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4" /> Health Benefits
                    </h4>
                    <div className="space-y-3">
                      {(() => {
                        const benefitsArray = Array.isArray(analysisResult.benefits) ? analysisResult.benefits : 
                                             Array.isArray(analysisResult.healthBenefits) ? analysisResult.healthBenefits : [];
                        return benefitsArray.slice(0, 3).map((benefit, i) => (
                          <div key={i} className="flex flex-col gap-1.5 text-[11px] font-bold text-slate-900 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-slate-900 shrink-0" />
                            <span className="uppercase tracking-tight">{typeof benefit === 'string' ? 'Benefit' : benefit.name || 'Benefit'}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium leading-relaxed ml-5">
                            {typeof benefit === 'string' ? benefit : benefit.benefit || benefit.description || ''}
                          </p>
                        </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>

                {/* Healthy Optimizations - "What can be added to make it more healthier" */}
                <div>
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2.5">
                    <Zap className="w-4 h-4" /> Healthy Optimizations
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(analysisResult.enhancementTips || []).slice(0, 3).map((tip, i) => (
                      <div key={i} className="flex flex-col gap-2 p-5 bg-black text-white rounded-[2rem] shadow-xl border border-white/10 transition-transform hover:scale-[1.02]">
                        <div className="flex items-center gap-3">
                          <Plus className="w-4 h-4 text-white shrink-0" />
                          <p className="text-[10px] font-black uppercase tracking-tight">{typeof tip === 'string' ? 'Optimization' : tip.name || 'Optimization'}</p>
                        </div>
                        <p className="text-[10px] font-medium text-slate-400 leading-snug ml-7">
                          {typeof tip === 'string' ? tip : tip.benefit || tip.description || ''}
                        </p>
                      </div>
                    ))}
                    {(!analysisResult.enhancementTips || analysisResult.enhancementTips.length === 0) && (
                      <div className="col-span-2 p-6 bg-slate-50 rounded-[2rem] text-center border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Balanced as is. Pair with hydration.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Alternatives & Considerations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2.5">
                      <Utensils className="w-4 h-4" /> Alternatives
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.alternatives?.map((alt, i) => (
                        <div key={i} className="bg-white text-slate-900 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-200 shadow-sm hover:border-slate-900 transition-colors">
                          {typeof alt === 'string' ? alt : alt.name}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-black uppercase tracking-widest flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4" aria-hidden="true" /> Considerations
                    </h4>
                    <div className="space-y-3">
                      {(analysisResult.warnings || []).length > 0 ? (
                        analysisResult.warnings.map((w, i) => (
                          <div key={i} className="flex gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <X className="w-4 h-4 text-black shrink-0 mt-0.5" />
                            <p className="text-xs font-bold text-slate-900 leading-tight">{w}</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Safe & Nutritious</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Log Button */}
                {(!analysisResult._id?.toString().startsWith('log') && analysisResult._id !== 'new_log_again' && !recentMeals.find(m => m._id === analysisResult._id)) || analysisResult._id === 'new_log_again' ? (
                  <div className="pt-6 pb-20 md:pb-6">
                    <div className="mb-6 space-y-3">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Log this to</h4>
                      <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                        {['Breakfast', 'Mid-Morning', 'Lunch', 'Evening', 'Dinner'].map(tab => (
                          <button
                            key={tab} onClick={() => setMealTab(tab)}
                            className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${mealTab === tab ? 'bg-black text-white shadow-xl' : 'text-slate-400 hover:text-black'}`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => handleConfirmLog(analysisResult)}
                      className="w-full py-6 bg-slate-900 hover:bg-black text-white rounded-[2.5rem] text-[13px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-4 group"
                    >
                      <CheckCircle2 className="w-6 h-6 group-hover:scale-110 transition-transform" /> Log to {mealTab}
                    </button>
                  </div>
                ) : null}
              </div>
            </motion.div>
          </div>
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
    </div>
  );
}

export default Nutrition;
