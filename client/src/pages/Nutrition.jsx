import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Plus, Camera, Mic, Lightbulb,
  Sun, Utensils, Cookie, Moon, Minus, Search, Wand2, X,
  Edit3, Image as ImageIcon,
  GlassWater, FileEdit, ScanLine, CheckCircle2, Loader2, Zap, Trash2, Clock, Sparkles, AlertCircle, FlaskConical,
  MoreHorizontal, ArrowLeftRight
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
  const [inputMethod, setInputMethod] = useState('Predict'); // 'Predict', 'Type', 'Scan'
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
    'Mid-Morning': [],
    Lunch: [],
    Evening: [],
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
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = React.useRef(null);
  const [expandedMeal, setExpandedMeal] = useState(null);
  const [analyzingMessage, setAnalyzingMessage] = useState('Analyzing food...');
  const pendingAutoAnalyzeRef = React.useRef(false);
  const cameraModalInputRef = React.useRef(null);

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

  const handleImageSelect = async (fileOrEvent, autoAnalyze = false) => {
    const file = fileOrEvent?.target ? fileOrEvent.target.files[0] : fileOrEvent;
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setImage(compressed);
      setImagePreview(URL.createObjectURL(compressed));
      // If auto-analyze is requested (e.g. from camera capture), trigger analysis after state update
      if (autoAnalyze) {
        pendingAutoAnalyzeRef.current = true;
      }
    } catch (error) {
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
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000
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
        _alreadyLogged: true
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
      const mappedMealType = 
        mealTab.toLowerCase() === 'mid-morning' ? 'midMorningSnack' : 
        mealTab.toLowerCase() === 'evening' ? 'eveningSnack' : 
        mealTab.toLowerCase();

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
        date: selectedDate
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
                  setImage(null);
                  setImagePreview(null);
                  if (mealType) setMealTab(mealType);
                  setIsModalOpen(true);
                  await handleImageSelect(file, true);
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
          {viewingMeal && (
            <MealAnalysisModal
              isOpen={!!viewingMeal}
              onClose={() => setViewingMeal(null)}
              meal={viewingMeal}
              source="view"
            />
          )}
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
              <div className="p-6 md:p-8 pb-4 border-b border-slate-50">
                <div className="flex justify-between items-start mb-5">
                  <div className="flex flex-col">
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest w-fit mb-2 ${user?.isDiabetic ? 'bg-[#064e3b] text-emerald-50 shadow-md border border-[#064e3b]/20' : 'bg-slate-100 text-slate-400'}`}>
                      <Sparkles className="w-3 h-3" />
                      {user?.isDiabetic ? 'Active Diabetic Care Protocol' : 'Standard Health Protocol'}
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Add to {mealTab}</h3>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center transition-all border border-slate-100 shrink-0">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <div className="flex gap-2 mb-8 overflow-x-auto pb-1 scrollbar-hide">
                  {['Breakfast', 'Mid-Morning', 'Lunch', 'Evening', 'Dinner'].map(tab => (
                    <button
                      key={tab} onClick={() => setMealTab(tab)}
                      className={`text-[10px] font-black px-5 py-2 rounded-full transition-all uppercase tracking-widest whitespace-nowrap ${mealTab === tab ? 'bg-[#064e3b] text-emerald-50 shadow-lg' : 'text-slate-400 hover:text-[#064e3b] hover:bg-emerald-50/50'}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                  {[
                    { name: 'Upload', icon: ImageIcon },
                    { name: 'Scan', icon: Camera },
                    { name: 'Type', icon: FileEdit },
                    { name: 'Predict', icon: Mic }
                  ].map(tab => (
                    <button
                      key={tab.name} 
                      onClick={() => {
                        if (tab.name === 'Upload' || tab.name === 'Scan') {
                          setInputMethod('Scan');
                          setLastSource(tab.name);
                          if (tab.name === 'Upload') {
                            setTimeout(() => document.getElementById('food-img-upload')?.click(), 50);
                          } else {
                            if (cameraModalInputRef.current) cameraModalInputRef.current.value = '';
                            setTimeout(() => cameraModalInputRef.current?.click(), 50);
                          }
                        } else {
                          setInputMethod(tab.name);
                        }
                      }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[9px] font-black rounded-xl transition-all uppercase tracking-widest ${
                        (tab.name === 'Upload' || tab.name === 'Scan' 
                          ? (inputMethod === 'Scan' && lastSource === tab.name)
                          : (inputMethod === tab.name))
                        ? 'bg-white shadow-xl text-[#064e3b]' 
                        : 'text-slate-400 hover:text-[#064e3b]'
                      }`}
                    >
                      <tab.icon className="w-3.5 h-3.5" /> 
                      {tab.name === 'Predict' ? 'Voice' : tab.name}
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
                          : 'bg-[#064e3b] text-emerald-50 hover:bg-[#042f2e] hover:scale-105'
                          }`}
                      >
                        <Mic className={`w-10 h-10 md:w-12 md:h-12 ${isListening ? 'animate-pulse' : ''}`} />
                      </button>
                    </div>

                    {/* Status Text */}
                    {!foodInput && (
                      <div className="text-center space-y-2 px-4">
                        <h4 className="text-lg font-black text-[#064e3b] uppercase tracking-tight">
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
                          className="w-full py-5 bg-[#064e3b] text-emerald-50 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-[#042f2e] transition-all shadow-xl active:scale-[0.98] disabled:opacity-50"
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
                      className="w-full py-5 bg-[#064e3b] text-emerald-50 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-[#042f2e] transition-all shadow-xl active:scale-95 disabled:opacity-50"
                    >
                      {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 text-white" />}
                      {isAnalyzing ? analyzingMessage : 'Analyze & Log Meal'}
                    </button>
                  </motion.div>
                ) : inputMethod === 'Scan' ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center space-y-6">
                    {/* Image Preview / Upload Area */}
                    <div className="w-full h-48 md:h-72 bg-slate-50 rounded-[2rem] md:rounded-[3rem] flex items-center justify-center relative overflow-hidden border-4 border-dashed border-slate-200 group transition-all hover:border-slate-300 cursor-pointer"
                      onClick={() => {
                        if (lastSource === 'Scan') {
                          if (cameraModalInputRef.current) cameraModalInputRef.current.value = '';
                          cameraModalInputRef.current?.click();
                        } else {
                          document.getElementById('food-img-upload')?.click();
                        }
                      }}>

                      {imagePreview ? (
                        <>
                          <img src={imagePreview} className="w-full h-full object-cover" alt="Food preview" />
                          {/* Re-capture overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-lg">
                              <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">Tap to change {lastSource.toLowerCase()}</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="absolute top-6 left-6 w-8 h-8 border-t-4 border-l-4 border-slate-200 rounded-tl-xl group-hover:border-slate-400 transition-colors" />
                          <div className="absolute top-6 right-6 w-8 h-8 border-t-4 border-r-4 border-slate-200 rounded-tr-xl group-hover:border-slate-400 transition-colors" />
                          <div className="absolute bottom-6 left-6 w-8 h-8 border-b-4 border-l-4 border-slate-200 rounded-bl-xl group-hover:border-slate-400 transition-colors" />
                          <div className="absolute bottom-6 right-6 w-8 h-8 border-b-4 border-r-4 border-slate-200 rounded-br-xl group-hover:border-slate-400 transition-colors" />

                          <div className="text-center space-y-3">
                            <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center mx-auto transition-transform duration-500 group-hover:rotate-12">
                              {lastSource === 'Scan' ? <Camera className="w-8 h-8 text-[#064e3b]" /> : <ImageIcon className="w-8 h-8 text-[#064e3b]" />}
                            </div>
                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">
                              Tap to {lastSource === 'Scan' ? 'open camera' : 'choose from gallery'}
                            </p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest opacity-60">AI will automatically analyze your meal</p>
                          </div>
                        </>
                      )}
                      <input id="food-img-upload" type="file" accept="image/*" className="hidden" onChange={(e) => handleImageSelect(e)} />
                    </div>


                    {/* Hidden camera input that forces native camera */}
                    <input
                      ref={cameraModalInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleImageSelect(e)}
                    />

                    {imagePreview && (
                      <>
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
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-5 text-sm font-bold text-[#064e3b] outline-none focus:bg-white focus:border-slate-300 transition-all appearance-none cursor-pointer"
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
                          className="w-full py-5 bg-[#064e3b] text-emerald-50 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-[#042f2e] transition-all shadow-xl active:scale-95 disabled:opacity-50"
                        >
                          {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
                          {isAnalyzing ? analyzingMessage : 'Analyze Photo'}
                        </button>
                      </>
                    )}

                    <p className="text-[10px] text-slate-400 text-center font-bold px-8 leading-relaxed uppercase tracking-tight">
                      Take a photo or choose from gallery. AI will detect the dish and calculate macros.
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
    </div>
  );
}

export default Nutrition;
