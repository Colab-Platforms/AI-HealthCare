import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, X, Camera, ChefHat, Info, Flame, Heart, Zap, Droplets,
  CheckCircle, AlertCircle, Lightbulb, ArrowLeft, ScanLine, Plus, Activity, Brain, Sparkles,
  ShieldCheck, TrendingUp, TrendingDown, ChevronRight
} from 'lucide-react';

export default function QuickFoodScan() {
  const navigate = useNavigate();
  const isAnalyzing = useRef(false); // Prevent multiple calls
  const [foodInput, setFoodInput] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [result, setResult] = useState(null);
  const [foodImage, setFoodImage] = useState(null);
  const [loadingFoodImage, setLoadingFoodImage] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [imageDetails, setImageDetails] = useState({
    quantity: '',
    prepMethod: '',
    additionalInfo: ''
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [foodSuggestions] = useState([
    'Chicken Biryani', 'Paneer Tikka', 'Dal Makhani', 'Butter Chicken',
    'Roti', 'Naan', 'Rice', 'Pasta', 'Pizza', 'Burger',
    'Salad', 'Sandwich', 'Idli', 'Dosa', 'Samosa',
    'Paratha', 'Chole Bhature', 'Rajma Chawal', 'Khichdi',
    'Fried Rice', 'Momos', 'Spring Roll', 'Manchurian'
  ]);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);

  // Smart quantity suggestions based on food type
  const getQuantitySuggestions = (foodName) => {
    const food = foodName.toLowerCase();

    // Bread items
    if (food.includes('roti') || food.includes('naan') || food.includes('paratha')) {
      return ['1 piece', '2 pieces', '3 pieces', '4 pieces'];
    }
    // Rice/Bowl items
    if (food.includes('rice') || food.includes('biryani') || food.includes('khichdi') ||
      food.includes('dal') || food.includes('rajma') || food.includes('chole')) {
      return ['1 bowl', '1 plate', '1 cup', '2 cups'];
    }
    // Snacks
    if (food.includes('samosa') || food.includes('pakora') || food.includes('momos') ||
      food.includes('spring roll')) {
      return ['1 piece', '2 pieces', '3 pieces', '5 pieces', '1 plate'];
    }
    // South Indian
    if (food.includes('idli') || food.includes('dosa') || food.includes('vada')) {
      return ['1 piece', '2 pieces', '3 pieces', '1 plate'];
    }
    // Pizza/Burger
    if (food.includes('pizza') || food.includes('burger')) {
      return ['1 slice', '2 slices', '1 whole', '1 medium', '1 large'];
    }
    // Curry/Gravy items
    if (food.includes('chicken') || food.includes('paneer') || food.includes('tikka')) {
      return ['1 bowl', '1 plate', '100g', '150g', '200g'];
    }
    // Pasta/Noodles
    if (food.includes('pasta') || food.includes('noodles') || food.includes('manchurian')) {
      return ['1 bowl', '1 plate', '1 cup'];
    }
    // Salad/Sandwich
    if (food.includes('salad') || food.includes('sandwich')) {
      return ['1 bowl', '1 plate', '1 piece', '1 full'];
    }

    // Default suggestions
    return ['1 bowl', '1 plate', '1 piece', '100g', '150g'];
  };

  const [quantitySuggestions, setQuantitySuggestions] = useState([]);
  const [showMealTypeModal, setShowMealTypeModal] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState('breakfast');

  // Check for persisted result on mount (for mobile memory recovery)
  useEffect(() => {
    // Check sessionStorage first (more reliable than localStorage on mobile)
    const persistedResult = sessionStorage.getItem('foodScanResult');
    const persistedImage = sessionStorage.getItem('foodScanImage');

    console.log('Checking for persisted data...', {
      hasResult: !!persistedResult,
      hasImage: !!persistedImage
    });

    if (persistedResult) {
      try {
        const parsedResult = JSON.parse(persistedResult);
        console.log('✅ Recovered persisted result:', parsedResult.foodItem?.name);

        // Set result and show modal immediately
        setResult(parsedResult);
        setShowResultModal(true);

        if (persistedImage) {
          setFoodImage(persistedImage);
        }

        // Clear persisted data after recovery
        sessionStorage.removeItem('foodScanResult');
        sessionStorage.removeItem('foodScanImage');

        // Show success message
        toast.success('Food analysis recovered!', { duration: 2000 });
      } catch (error) {
        console.error('❌ Failed to recover persisted result:', error);
        sessionStorage.removeItem('foodScanResult');
        sessionStorage.removeItem('foodScanImage');
      }
    }
  }, []);

  // Prevent navigation/unmounting during analysis - CRITICAL FOR MOBILE
  useEffect(() => {
    if (loading) {
      console.log('🔒 Blocking navigation - analysis in progress');

      // Block browser back button
      const handleBeforeUnload = (e) => {
        e.preventDefault();
        e.returnValue = '';
      };

      // Block React Router navigation
      const unblock = navigate && typeof navigate === 'function'
        ? null
        : null; // We'll handle this differently

      window.addEventListener('beforeunload', handleBeforeUnload);

      // Prevent popstate (back button)
      const handlePopState = (e) => {
        e.preventDefault();
        window.history.pushState(null, '', window.location.pathname);
        toast.error('Please wait for analysis to complete');
      };
      window.addEventListener('popstate', handlePopState);

      // Push a dummy state to prevent back navigation
      window.history.pushState(null, '', window.location.pathname);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [loading, navigate]);

  // Keep modal open and prevent accidental closes
  useEffect(() => {
    if (showResultModal && result) {
      console.log('Modal is now visible with result:', result.foodItem?.name);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [showResultModal, result]);

  const handleFoodInputChange = (e) => {
    const value = e.target.value;
    setFoodInput(value);

    // Filter suggestions
    if (value.trim().length > 0) {
      const filtered = foodSuggestions.filter(food =>
        food.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered.slice(0, 5)); // Show max 5 suggestions
      setShowSuggestions(filtered.length > 0);

      // Set quantity suggestions based on current input
      setQuantitySuggestions(getQuantitySuggestions(value));
    } else {
      setShowSuggestions(false);
      setFilteredSuggestions([]);
      setQuantitySuggestions([]);
    }
  };

  const selectSuggestion = (suggestion) => {
    setFoodInput(suggestion);
    setShowSuggestions(false);
    setFilteredSuggestions([]);
    // Update quantity suggestions for selected food
    setQuantitySuggestions(getQuantitySuggestions(suggestion));
  };

  // Optimized image compression function for mobile with SUPER aggressive settings
  const compressImage = async (file) => {
    return new Promise((resolve, reject) => {
      // Detect mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      // SUPER AGGRESSIVE compression for mobile
      const isVeryLarge = file.size > 5 * 1024 * 1024; // > 5MB
      let targetQuality = 0.5;
      let maxDimension = 800; // Reduced from 1280

      if (isMobile) {
        // MUCH more aggressive on mobile
        targetQuality = isVeryLarge ? 0.3 : 0.4; // Lower quality
        maxDimension = isVeryLarge ? 640 : 800; // Smaller dimensions
      } else if (isVeryLarge) {
        targetQuality = 0.4;
        maxDimension = 960;
      }

      console.log('🗜️ AGGRESSIVE Compression settings:', {
        isMobile,
        targetQuality,
        maxDimension,
        originalSize: (file.size / 1024).toFixed(2) + ' KB'
      });

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Calculate new dimensions
            if (width > height) {
              if (width > maxDimension) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              }
            } else {
              if (height > maxDimension) {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }

            console.log('📐 Resizing from', img.width, 'x', img.height, 'to', width, 'x', height);

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d', {
              alpha: false,
              willReadFrequently: false
            });

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'low'; // Use LOW quality for maximum compression

            ctx.drawImage(img, 0, 0, width, height);

            // Compress to JPEG
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('Failed to compress image'));
                  return;
                }

                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });

                console.log('✅ Original size:', (file.size / 1024).toFixed(2), 'KB');
                console.log('✅ Compressed size:', (compressedFile.size / 1024).toFixed(2), 'KB');
                console.log('✅ Compression ratio:', ((1 - compressedFile.size / file.size) * 100).toFixed(1), '%');

                // Aggressive cleanup
                canvas.width = 0;
                canvas.height = 0;
                ctx.clearRect(0, 0, 1, 1);
                img.src = '';
                img.onload = null;
                reader.onload = null;

                // Force garbage collection hint
                if (window.gc) window.gc();

                resolve(compressedFile);
              },
              'image/jpeg',
              targetQuality
            );
          } catch (error) {
            console.error('Compression error:', error);
            reject(error);
          }
        };
        img.onerror = () => {
          reader.onload = null;
          reject(new Error('Failed to load image'));
        };
      };
      reader.onerror = () => {
        reader.onload = null;
        reject(new Error('Failed to read file'));
      };
    });
  };

  const handleImageSelect = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.target.files[0];
    if (file) {
      // Check if file is larger than 100MB
      if (file.size > 100 * 1024 * 1024) {
        toast.error('Image too large. Please use an image smaller than 100MB');
        return;
      }

      setCompressing(true);
      const toastId = toast.loading('Compressing image...');

      try {
        // Add a small delay to let UI update
        await new Promise(resolve => setTimeout(resolve, 100));

        // Compress the image
        const compressedFile = await compressImage(file);

        // More lenient size check for mobile - 3MB instead of 5MB
        const maxCompressedSize = 3 * 1024 * 1024;
        if (compressedFile.size > maxCompressedSize) {
          toast.error(`Image still too large (${(compressedFile.size / 1024 / 1024).toFixed(1)}MB). Try a smaller image or type the food name.`, { id: toastId });
          setCompressing(false);
          return;
        }

        toast.success(`Image ready! ${(compressedFile.size / 1024).toFixed(0)}KB`, { id: toastId });

        setImage(compressedFile);

        // Create preview with cleanup
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result);
          reader.onloadend = null;
          reader.onerror = null;
        };
        reader.onerror = () => {
          toast.error('Failed to preview image');
          reader.onloadend = null;
          reader.onerror = null;
        };
        reader.readAsDataURL(compressedFile);
      } catch (error) {
        console.error('Compression error:', error);
        toast.error('Failed to compress image. Please try a different image.', { id: toastId });
      } finally {
        setCompressing(false);
      }
    }

    // Reset input
    e.target.value = '';
  };

  const fetchFoodImage = async (foodName) => {
    setLoadingFoodImage(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `/api/nutrition/food-image?foodName=${encodeURIComponent(foodName)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success && response.data.imageUrl) {
        setFoodImage(response.data.imageUrl);
        // Persist food image to sessionStorage
        try {
          sessionStorage.setItem('foodScanImage', response.data.imageUrl);
        } catch (e) {
          console.warn('Failed to persist food image');
        }
      }
    } catch (error) {
      console.error('Failed to fetch food image:', error);
      // Don't show error toast, just continue without image
    } finally {
      setLoadingFoodImage(false);
    }
  };

  const handleAnalyze = async () => {
    if (!foodInput.trim() && !image) {
      toast.error('Please enter a food item or upload an image');
      return;
    }

    if (image && !imageDetails.quantity && !imageDetails.prepMethod) {
      toast.error('Please provide quantity and preparation method for the image');
      return;
    }

    // Validate token exists before proceeding
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please login to use this feature');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
      return;
    }

    setLoading(true);
    setFoodImage(null);

    // Store data in variables to prevent state loss
    let analysisResult = null;
    let shouldShowModal = false;

    try {

      let imageBase64 = null;
      if (image) {
        console.log('Converting image to base64...');
        console.log('Image size:', (image.size / 1024).toFixed(2), 'KB');

        // Convert image to base64 with memory cleanup
        const reader = new FileReader();
        imageBase64 = await new Promise((resolve, reject) => {
          reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            console.log('Base64 conversion complete. Size:', (base64.length * 0.75 / 1024).toFixed(2), 'KB');
            // Clear reader to free memory
            reader.onloadend = null;
            reader.onerror = null;
            resolve(base64);
          };
          reader.onerror = (error) => {
            console.error('FileReader error:', error);
            reader.onloadend = null;
            reader.onerror = null;
            reject(error);
          };
          reader.readAsDataURL(image);
        });
      }

      let contextText = '';
      if (image && (imageDetails.quantity || imageDetails.prepMethod || imageDetails.additionalInfo)) {
        const parts = [];
        if (imageDetails.quantity) parts.push(`Quantity: ${imageDetails.quantity}`);
        if (imageDetails.prepMethod) parts.push(`Preparation: ${imageDetails.prepMethod}`);
        if (imageDetails.additionalInfo) parts.push(imageDetails.additionalInfo);
        if (foodInput) parts.push(`Additional info: ${foodInput}`);
        contextText = parts.join(', ');
      } else {
        contextText = foodInput;
      }

      console.log('Sending analysis request...');
      console.log('Token present:', !!token);
      console.log('Has image:', !!imageBase64);
      console.log('Context text:', contextText);

      // Double-check token is still in localStorage (mobile can clear it)
      const currentToken = localStorage.getItem('token');
      if (!currentToken) {
        throw new Error('Session expired during processing. Please login again.');
      }

      const response = await axios.post(
        '/api/nutrition/quick-check',
        {
          foodDescription: foodInput || 'Food from image',
          imageBase64: imageBase64,
          additionalContext: contextText
        },
        {
          headers: { Authorization: `Bearer ${currentToken}` },
          timeout: 60000,
          skipAutoLogout: true // Prevent automatic logout on 401 errors
        }
      );

      console.log('API Response received:', response.data);

      // Clear image base64 from memory immediately after sending
      imageBase64 = null;

      if (!response.data || !response.data.data) {
        throw new Error('Invalid response from server');
      }

      // Store result in local variable first
      analysisResult = response.data.data;
      shouldShowModal = true;

      console.log('Analysis successful, persisting result...');

      // CRITICAL: Persist to sessionStorage BEFORE setting state (for mobile recovery)
      try {
        sessionStorage.setItem('foodScanResult', JSON.stringify(analysisResult));
        console.log('✅ Result persisted to sessionStorage');
      } catch (storageError) {
        console.warn('⚠️ Failed to persist result:', storageError);
        // Try localStorage as fallback
        try {
          localStorage.setItem('foodScanResult', JSON.stringify(analysisResult));
          console.log('✅ Result persisted to localStorage (fallback)');
        } catch (e) {
          console.error('❌ Both storage methods failed');
        }
      }

      console.log('Setting state now...');

      // Set state in a single batch to prevent re-renders
      setResult(analysisResult);
      setShowResultModal(true);
      setLoading(false);

      console.log('✅ State updated, modal should be visible');
      console.log('Modal state:', { showResultModal: true, hasResult: !!analysisResult });

      // Fetch food image from SerpAPI (non-blocking)
      if (analysisResult?.foodItem?.name) {
        fetchFoodImage(analysisResult.foodItem.name).then(() => {
          // Persist food image too
          if (foodImage) {
            try {
              sessionStorage.setItem('foodScanImage', foodImage);
            } catch (e) {
              console.warn('Failed to persist food image');
            }
          }
        });
      }

      toast.success('Food analyzed!');

      // Return early to prevent finally block from running
      return;

    } catch (error) {
      console.error('Analysis error:', error);
      console.error('Error response:', error.response);
      console.error('Error status:', error.response?.status);

      setLoading(false);

      // Handle 401 errors specifically (token expired/invalid)
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.', {
          duration: 5000
        });
        // Give user time to see the message before redirecting
        setTimeout(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }, 2000);
        return;
      }

      if (error.response?.status === 400 && error.response?.data?.error === 'UNABLE_TO_DETECT_FOOD') {
        setImage(null);
        setImagePreview(null);
        toast.error('Could not detect food in image. Please type the food name for accurate results.', {
          duration: 5000
        });
      } else if (error.code === 'ECONNABORTED') {
        toast.error('Request timeout. Please try again or use text description.');
      } else if (error.message && error.message.includes('memory')) {
        // Handle memory errors specifically
        toast.error('Image too large for device. Please try a smaller image or type the food name.');
        setImage(null);
        setImagePreview(null);
      } else if (error.message && error.message.includes('Network Error')) {
        // Handle network errors
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error(error.response?.data?.message || 'Failed to analyze food. Please try again.');
      }
    }
  };

  const resetForm = () => {
    console.log('Resetting form...');
    setShowResultModal(false);
    setResult(null);
    setFoodImage(null);
    setFoodInput('');
    setImage(null);
    setImagePreview(null);
    setImageDetails({ quantity: '', prepMethod: '', additionalInfo: '' });
    setShowMealTypeModal(false);
    setSelectedMealType('breakfast');

    // Clear persisted data from both storages
    sessionStorage.removeItem('foodScanResult');
    sessionStorage.removeItem('foodScanImage');
    localStorage.removeItem('foodScanResult');
    localStorage.removeItem('foodScanImage');

    // Clear any stored data
    if (window.gc) window.gc(); // Hint for garbage collection
  };

  const handleLogMeal = () => {
    // Show meal type selector modal
    setShowMealTypeModal(true);
  };

  const logMealToNutrition = async () => {
    try {
      const token = localStorage.getItem('token');

      // Prepare food item data - ALWAYS use user input for quantity and prep method
      const foodItem = {
        name: result.foodItem?.name || 'Food from scan',
        quantity: imageDetails.quantity || '1 serving', // User input quantity
        nutrition: result.foodItem?.nutrition || {},
        notes: imageDetails.prepMethod ? `Preparation: ${imageDetails.prepMethod}` : '' // User input prep method
      };

      console.log('Logging meal with user input:', {
        quantity: imageDetails.quantity,
        prepMethod: imageDetails.prepMethod,
        foodItem
      });

      // Log meal to nutrition page
      const response = await axios.post(
        '/api/nutrition/log-meal',
        {
          mealType: selectedMealType,
          foodItems: [foodItem],
          notes: `Logged from Quick Food Scan`,
          healthScore: result.healthScore,
          healthScore10: result.healthScore10,
          micronutrients: result.micronutrients,
          enhancementTips: result.enhancementTips,
          healthBenefitsSummary: result.healthBenefitsSummary,
          timestamp: new Date()
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          skipAutoLogout: true
        }
      );

      if (response.data.success) {
        toast.success(`Meal logged to ${selectedMealType}! 🎉`);
        setShowMealTypeModal(false);
        resetForm();
        // Navigate to nutrition page
        setTimeout(() => {
          navigate('/nutrition#daily-target');
        }, 1000);
      }
    } catch (error) {
      console.error('Log meal error:', error);
      toast.error('Failed to log meal. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans selection:bg-blue-100">
      {/* Premium Glass Header */}
      <div className="w-full px-6 py-5 bg-white/70 backdrop-blur-xl border-b border-white/40 sticky top-0 z-[100] shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="group p-2.5 bg-white rounded-2xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-all active:scale-95"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600 group-hover:text-blue-600 transition-colors" />
            </button>
            <div>
              <h1 className="text-xl font-extrabold text-[#1e293b] leading-tight tracking-tight">Food Scanner</h1>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">AI Nutrition Analysis</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-blue-50/80 p-2 rounded-xl border border-blue-100">
              <ScanLine className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-4xl mx-auto px-5 py-8 space-y-8">

          {/* Hero Section - The New Choice UI */}
          {!imagePreview && (
            <div className="space-y-6">
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-[2rem] blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
                <div className="relative bg-white rounded-[2rem] p-6 sm:p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] border border-slate-100">
                  {(!foodInput.trim() && !imagePreview) && (
                    <div className="flex flex-col items-center text-center mb-8 animate-in fade-in zoom-in duration-500">
                      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 border border-blue-100/50">
                        <ChefHat className="w-8 h-8 text-blue-600" />
                      </div>
                      <h2 className="text-2xl font-black text-[#1e293b] mb-2">Track Your Meal</h2>
                      <p className="text-slate-500 text-sm max-w-[280px]">Take a photo or type what you ate for instant nutritional insights.</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Visual Text Input */}
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-blue-50 p-1.5 rounded-lg border border-blue-100">
                        <Info className="w-4 h-4 text-blue-500" />
                      </div>
                      <input
                        type="text"
                        value={foodInput}
                        onChange={handleFoodInputChange}
                        onFocus={() => {
                          if (foodInput.trim() && filteredSuggestions.length > 0) {
                            setShowSuggestions(true);
                          }
                        }}
                        placeholder="What's on your plate?"
                        className="w-full pl-14 pr-4 py-6 bg-slate-50/50 border-2 border-blue-400 rounded-2xl focus:outline-none focus:border-blue-600 focus:bg-white transition-all text-xl text-slate-800 font-black placeholder-slate-400 shadow-xl"
                      />

                      {/* Premium Suggestions Dropdown */}
                      {showSuggestions && filteredSuggestions.length > 0 && (
                        <div className="absolute z-[110] w-full mt-2 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                          {filteredSuggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              onClick={() => selectSuggestion(suggestion)}
                              className="w-full px-5 py-3.5 text-left hover:bg-blue-50 transition-colors text-sm font-semibold text-slate-700 flex items-center gap-3 border-b border-slate-50 last:border-0"
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 py-2">
                      <div className="flex-1 h-[1px] bg-slate-100"></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">OR</span>
                      <div className="flex-1 h-[1px] bg-slate-100"></div>
                    </div>

                    {/* Enhanced Camera Button */}
                    <div>
                      <input
                        id="camera-input"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleImageSelect}
                        className="hidden"
                        disabled={compressing}
                      />
                      <button
                        onClick={() => document.getElementById('camera-input').click()}
                        disabled={compressing}
                        className="w-full group relative overflow-hidden py-5 bg-slate-900 text-white rounded-2xl font-bold text-sm tracking-wide transition-all active:scale-[0.98] shadow-xl hover:shadow-2xl hover:bg-slate-800 disabled:opacity-75"
                      >
                        <div className="relative z-10 flex items-center justify-center gap-3">
                          {compressing ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                              <span>Optimizing Image...</span>
                            </>
                          ) : (
                            <>
                              <Camera className="w-5 h-5 group-hover:scale-110 transition-transform" />
                              <span>Scan Food with Camera</span>
                            </>
                          )}
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-cyan-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {(!foodInput.trim() && !imagePreview) && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50/50 p-4 rounded-3xl border border-emerald-100 flex flex-col gap-2">
                    <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <Flame className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-xs font-bold text-emerald-900">Track Calories</p>
                    <p className="text-[10px] text-emerald-700/80 leading-snug">Instantly see the energy content of your meals.</p>
                  </div>
                  <div className="bg-amber-50/50 p-4 rounded-3xl border border-amber-100 flex flex-col gap-2">
                    <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center">
                      <Zap className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-xs font-bold text-amber-900">Health Score</p>
                    <p className="text-[10px] text-amber-700/80 leading-snug">Know how healthy your food choices are.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Context Input UI (When typing/image) */}
          {(foodInput.trim() || imagePreview) && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              {imagePreview && (
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-[2.2rem] blur opacity-10"></div>
                  <div className="relative rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl">
                    <img
                      src={imagePreview}
                      alt="Scanned Food"
                      className="w-full h-72 object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60"></div>

                    <button
                      onClick={() => {
                        setImage(null);
                        setImagePreview(null);
                        setImageDetails({ quantity: '', prepMethod: '', additionalInfo: '' });
                      }}
                      className="absolute top-4 right-4 p-2.5 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl hover:bg-red-50 hover:text-red-500 transition-all active:scale-95"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <div className="absolute bottom-4 left-4 flex items-center gap-2">
                      <div className="bg-white/95 backdrop-blur-md text-blue-600 px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-wider shadow-lg flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Image Ready
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.06)] border border-slate-100 space-y-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Flame className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-extrabold text-[#1e293b]">Refine Details</h3>
                </div>

                {/* Quantity and Prep Group */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">
                      Serving Quantity
                    </label>

                    {/* Smart Pills */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(quantitySuggestions.length > 0 ? quantitySuggestions : ['1 serving', '1 bowl', '1 plate', '100g']).map((qty, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setImageDetails({ ...imageDetails, quantity: qty })}
                          className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all border-2 ${imageDetails.quantity === qty
                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200'
                            : 'bg-white border-slate-100 text-slate-600 hover:border-blue-200'
                            }`}
                        >
                          {qty}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      value={imageDetails.quantity}
                      onChange={(e) => setImageDetails({ ...imageDetails, quantity: e.target.value })}
                      placeholder="Or specify exact amount"
                      className="w-full px-5 py-3.5 bg-slate-50/80 border-2 border-blue-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white transition-all text-sm font-semibold text-slate-800 placeholder-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-1">
                      Preparation Method
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
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
                          onClick={() => setImageDetails({ ...imageDetails, prepMethod: method.label })}
                          className={`p-2.5 rounded-xl transition-all border-2 flex flex-col items-center gap-1.5 ${imageDetails.prepMethod === method.label
                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200'
                            : 'bg-white border-slate-100 text-slate-600 hover:border-blue-200'
                            }`}
                        >
                          <span className="text-lg leading-none">{method.icon}</span>
                          <span className="text-[9px] font-black uppercase tracking-tighter">{method.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Final Analysis Trigger */}
                  <div className="pt-4">
                    <button
                      onClick={handleAnalyze}
                      disabled={loading}
                      className="w-full group relative overflow-hidden py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-[2rem] font-black text-base tracking-widest transition-all active:scale-[0.98] shadow-[0_20px_40px_-12px_rgba(59,130,246,0.3)] disabled:opacity-50"
                    >
                      <div className="relative z-10 flex items-center justify-center gap-3 uppercase">
                        {loading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Processing...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-5 h-5 group-hover:animate-pulse" />
                            <span>Analyze Now</span>
                          </>
                        )}
                      </div>
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 transform translate-y-2 group-hover:translate-y-0 transition-transform"></div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Info Badge */}
          <div className="max-w-md mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-blue-50/50 backdrop-blur-sm rounded-full border border-blue-100 group">
              <Info className="w-4 h-4 text-blue-500 group-hover:rotate-12 transition-transform" />
              <p className="text-[11px] font-semibold text-blue-800 tracking-wide">
                AI analysis is an estimate. Portions may impact accuracy.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Result Modal - Premium Redesign */}
      {showResultModal && result && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] overflow-y-auto px-4 py-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              resetForm();
            }
          }}
        >
          <div
            className="max-w-2xl mx-auto bg-white rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] overflow-hidden relative animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Section */}
            <div className="relative p-8 pb-0">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                {/* Score & Icon */}
                <div className="flex items-center gap-6">
                  <div className="relative w-32 h-32 flex-shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="58"
                        stroke="#f1f5f9"
                        strokeWidth="10"
                        fill="none"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="58"
                        stroke={result.healthScore10 >= 7 ? "#10b981" : result.healthScore10 >= 4 ? "#f59e0b" : "#ef4444"}
                        strokeWidth="10"
                        fill="none"
                        strokeDasharray={364.4}
                        strokeDashoffset={364.4 - (Math.round((result.healthScore10 || (result.healthScore / 10)) * 10) / 100) * 364.4}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-black text-slate-800">
                        {Math.round((result.healthScore10 || (result.healthScore / 10)) * 10)}
                      </span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">out of 100</span>
                    </div>
                  </div>

                  <div>
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 ${result.isHealthy
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-rose-100 text-rose-700'
                      }`}>
                      {result.isHealthy ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {result.isHealthy ? 'Healthy Choice' : 'Watch Portions'}
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 leading-tight mb-1">
                      {result.foodItem?.name}
                    </h2>
                    <p className="text-slate-500 font-bold flex items-center gap-2 uppercase text-[11px] tracking-widest">
                      <Zap className="w-4 h-4 text-purple-500" />
                      {result.foodItem?.quantity || 'Standard Serving'}
                    </p>
                  </div>
                </div>

                {/* Main Action Pin */}
                <div className="flex md:flex-col gap-2">
                  <button
                    onClick={resetForm}
                    className="p-3 bg-slate-100 text-slate-400 rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>

            {/* Macro Breakdown */}
            <div className="px-8 mt-10">
              <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100 shadow-inner">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[
                    { label: 'Calories', value: result.foodItem?.nutrition?.calories, icon: Flame, color: 'text-orange-500', bg: 'bg-orange-100', b: 'border-orange-200' },
                    { label: 'Protein', value: result.foodItem?.nutrition?.protein, icon: Zap, color: 'text-blue-500', bg: 'bg-blue-100', b: 'border-blue-200' },
                    { label: 'Carbs', value: result.foodItem?.nutrition?.carbs, icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-100', b: 'border-emerald-200' },
                    { label: 'Fats', value: result.foodItem?.nutrition?.fats, icon: Heart, color: 'text-rose-500', bg: 'bg-rose-100', b: 'border-rose-200' }
                  ].map((macro) => {
                    const Icon = macro.icon;
                    return (
                      <div key={macro.label} className="flex flex-col items-center">
                        <div className={`w-14 h-14 rounded-2xl ${macro.bg} flex items-center justify-center mb-3 shadow-sm border ${macro.b}`}>
                          <Icon className={`w-7 h-7 ${macro.color}`} />
                        </div>
                        <span className="text-sm font-black text-slate-800">{macro.value || 0}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{macro.label}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Small Nutrition List */}
                <div className="flex flex-wrap justify-center gap-6 mt-8 pt-8 border-t border-slate-200">
                  {[
                    { label: 'Fiber', value: result.foodItem?.nutrition?.fiber, unit: 'g' },
                    { label: 'Sugar', value: result.foodItem?.nutrition?.sugar, unit: 'g' },
                    { label: 'Sodium', value: result.foodItem?.nutrition?.sodium, unit: 'mg' }
                  ].map(stat => (
                    <div key={stat.label} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-slate-300" />
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{stat.label}:</span>
                      <span className="text-xs font-black text-slate-800">{stat.value || 0}{stat.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Health Intelligence */}
            <div className="px-8 py-10 space-y-10">

              {/* Micronutrients Section - New Detailed Design */}
              <div className="bg-blue-50/40 rounded-[2.5rem] p-7 border border-blue-100 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-xl bg-blue-100/50 flex items-center justify-center text-blue-600">
                    <Activity className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-black text-slate-700 tracking-tight uppercase">Micronutrients Breakdown</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(result.micronutrients || []).map((micro, i) => (
                    <div key={i} className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-blue-100 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[11px] font-black text-slate-700 truncate">{typeof micro === 'object' ? micro.name : micro}</span>
                        <span className="text-[10px] font-black text-blue-600">{typeof micro === 'object' ? micro.percentage : '--'}%</span>
                      </div>
                      <p className="text-xl font-black text-slate-800 mb-2">{typeof micro === 'object' ? micro.value : '--'}</p>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                          style={{ width: `${typeof micro === 'object' ? micro.percentage : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {(!result.micronutrients || result.micronutrients.length === 0) && (
                    <p className="text-slate-400 text-xs italic p-4 text-center col-span-2">No micronutrient data available</p>
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
                  <h4 className="text-sm font-black text-emerald-900 tracking-tight uppercase">Health Benefits</h4>
                </div>
                <p className="text-xs font-bold text-emerald-800/80 leading-relaxed">
                  {result.healthBenefitsSummary || result.analysis || "This meal provides essential nutrients for your daily requirements."}
                </p>
              </div>

              {/* Enhancement Section */}
              <div className="bg-amber-50/40 rounded-[2.5rem] p-7 border border-amber-100 group">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-white border border-amber-100 flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-black text-amber-900 tracking-tight uppercase">Make it even Healthier</h4>
                </div>

                <div className="space-y-3">
                  {(result.enhancementTips || []).map((tip, i) => (
                    <div key={i} className="bg-white rounded-[1.5rem] p-4 flex items-center gap-4 border border-amber-100 shadow-sm hover:shadow-md transition-all">
                      <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white shrink-0">
                        <Plus className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-800 mb-0.5">{typeof tip === 'object' ? tip.name : tip}</p>
                        <p className="text-[10px] font-bold text-slate-500 truncate">{typeof tip === 'object' ? tip.benefit : 'Adds nutritional value'}</p>
                      </div>
                    </div>
                  ))}
                  {(!result.enhancementTips || result.enhancementTips.length === 0) && (
                    <div className="text-center py-4 text-slate-400 text-xs font-bold uppercase tracking-widest italic">
                      Already optimal!
                    </div>
                  )}
                </div>
              </div>

              {/* Original Analysis Box (Optional) */}
              <div className="relative group p-1">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-500" />
                  Analysis Detail
                </h3>
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <p className="text-slate-600 font-medium leading-relaxed">
                    {result.analysis}
                  </p>
                </div>
              </div>
            </div>

            {/* Challenges & Alerts */}
            {result.warnings && result.warnings.length > 0 && (
              <div className="px-8 pb-10 space-y-4">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                  Nutritional Alerts
                </h3>
                <div className="grid gap-3">
                  {result.warnings.map((w, i) => (
                    <div key={i} className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4 flex items-center gap-4 group">
                      <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center shrink-0 group-hover:rotate-12 transition-transform">
                        <AlertCircle className="w-5 h-5 text-rose-600" />
                      </div>
                      <p className="text-xs font-bold text-rose-900 leading-tight">{w}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {/* Recommendations */}
            {result.alternatives && result.alternatives.length > 0 && (
              <div className="space-y-4 px-8 pb-10">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-emerald-500" />
                  Smart Alternatives
                </h3>
                <div className="flex overflow-x-auto scrollbar-hide gap-5 -mx-8 px-8">
                  {result.alternatives.map((alt, i) => (
                    <div key={i} className="min-w-[280px] group bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <p className="font-black text-slate-800 text-base leading-tight group-hover:text-emerald-600 transition-colors uppercase tracking-tight">{alt.name}</p>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{alt.prepTime || 'Quick'} Prep</span>
                        </div>
                        <div className="bg-emerald-50 text-emerald-600 text-[11px] font-black px-3 py-1.5 rounded-xl border border-emerald-100">
                          {alt.nutrition?.calories} Kcal
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6 line-clamp-2 italic">
                        "{alt.description}"
                      </p>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                        <div className="flex gap-2">
                          <div className="px-2 py-1 bg-blue-50 text-blue-600 text-[9px] font-black rounded-lg uppercase">
                            High Prot
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Satiety</span>
                          <span className="text-xs font-black text-slate-800">{alt.satietyScore || 8}/10</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Master Actions */}
            <div className="flex gap-4 pt-6">
              <button
                onClick={resetForm}
                className="flex-1 py-5 bg-slate-100 text-slate-600 rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
              >
                Discard
              </button>
              <button
                onClick={handleLogMeal}
                className="flex-[2] py-5 bg-[#1e293b] text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <CheckCircle className="w-5 h-5 text-blue-400" />
                Add to Diary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meal Type Selector Modal */}
      {showMealTypeModal && (
        <div
          className="fixed inset-0 bg-black/60 z-[10001] flex items-end sm:items-center justify-center"
          onClick={() => setShowMealTypeModal(false)}
        >
          <div
            className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Select Meal Type</h3>
              <button
                onClick={() => setShowMealTypeModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              {[
                { type: 'breakfast', icon: '🌅', label: 'Breakfast', color: 'from-orange-400 to-yellow-400' },
                { type: 'lunch', icon: '☀️', label: 'Lunch', color: 'from-yellow-400 to-amber-400' },
                { type: 'dinner', icon: '🌙', label: 'Dinner', color: 'from-indigo-400 to-purple-400' },
                { type: 'snack', icon: '🍎', label: 'Snacks', color: 'from-green-400 to-emerald-400' }
              ].map((meal) => (
                <button
                  key={meal.type}
                  onClick={() => setSelectedMealType(meal.type)}
                  className={`w-full p-4 rounded-xl flex items-center gap-4 transition-all ${selectedMealType === meal.type
                    ? `bg-gradient-to-r ${meal.color} text-white shadow-lg scale-105`
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  <span className="text-3xl">{meal.icon}</span>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-lg">{meal.label}</p>
                  </div>
                  {selectedMealType === meal.type && (
                    <CheckCircle className="w-6 h-6" />
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={logMealToNutrition}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
            >
              Log to {selectedMealType.charAt(0).toUpperCase() + selectedMealType.slice(1)}
            </button>
          </div>
        </div>
      )}

      {/* Full-Screen Analyzing Overlay - Premium Futuristic Design */}
      {loading && (
        <div
          className="fixed inset-0 bg-slate-900 z-[10000] flex items-center justify-center overflow-hidden"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, touchAction: 'none' }}
        >
          {/* Animated Background Gradients */}
          <div className="absolute top-0 left-0 w-full h-full">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>

          <div className="relative text-center px-8 w-full max-w-lg">
            {/* Holographic Scanner Effect */}
            <div className="relative mb-12">
              <div className="w-48 h-48 mx-auto relative">
                {/* Rotating Outer Ring */}
                <div className="absolute inset-0 border-[3px] border-dashed border-blue-400/30 rounded-full animate-spin" style={{ animationDuration: '8s' }}></div>
                {/* Glowing Core */}
                <div className="absolute inset-4 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-full p-1 shadow-[0_0_50px_rgba(59,130,246,0.5)]">
                  <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-x-0 h-1 bg-blue-400/50 blur-sm animate-[scan_2s_linear_infinite]" />
                    <ChefHat className="w-16 h-16 text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.8)]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-4xl font-black text-white tracking-tighter">
                Scanning <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Nutrition</span>
              </h2>
              <p className="text-slate-400 font-bold text-sm uppercase tracking-[0.3em]">AI processing active</p>
            </div>

            {/* Smart Progress Feed */}
            <div className="mt-12 space-y-3 bg-white/5 backdrop-blur-md rounded-[2.5rem] p-8 border border-white/10 shadow-2xl">
              {[
                { text: 'Optimizing high-res capture', active: false, done: true },
                { text: 'Neural food recognition', active: true, done: false },
                { text: 'Cross-referencing database', active: false, done: false },
                { text: 'Calculating health impact', active: false, done: false }
              ].map((step, i) => (
                <div key={i} className={`flex items-center gap-4 transition-opacity duration-500 ${step.done || step.active ? 'opacity-100' : 'opacity-20'}`}>
                  {step.done ? (
                    <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,1)]"></div>
                  ) : step.active ? (
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></div>
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                  )}
                  <span className={`text-xs font-bold uppercase tracking-widest ${step.active ? 'text-blue-400' : 'text-slate-300'}`}>{step.text}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-center gap-3">
              <Info className="w-4 h-4 text-blue-400" />
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-loose">
                DO NOT DISCONNECT · ANALYZING COMPOSITION
              </p>
            </div>
          </div>

          <style dangerouslySetInnerHTML={{
            __html: `
                @keyframes scan {
                  0% { transform: translateY(-100%); opacity: 0; }
                  50% { opacity: 1; }
                  100% { transform: translateY(100%); opacity: 0; }
                }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
              `}} />
        </div>
      )}
    </div>
  );
}
