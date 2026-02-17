import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, X, Camera, ChefHat, Info, Flame, Heart, Zap, Droplets,
  CheckCircle, AlertCircle, Lightbulb, ArrowLeft, ScanLine
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
      
      // Prepare food item data
      const foodItem = {
        name: result.foodItem?.name || 'Food from scan',
        quantity: imageDetails.quantity || result.foodItem?.quantity || '1 serving',
        nutrition: result.foodItem?.nutrition || {},
        notes: imageDetails.prepMethod ? `Preparation: ${imageDetails.prepMethod}` : ''
      };

      // Log meal to nutrition page
      const response = await axios.post(
        '/api/nutrition/log-meal',
        {
          mealType: selectedMealType,
          foodItems: [foodItem],
          notes: `Logged from Quick Food Scan`,
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/40 to-purple-50/40 flex flex-col">
      {/* Mobile-Optimized Header */}
      <div className="w-full px-4 py-4 bg-white/80 backdrop-blur-sm border-b border-gray-200 shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Food Scanner</h1>
            <p className="text-xs text-gray-600">AI-powered nutrition analysis</p>
          </div>
        </div>
      </div>

      {/* Main Content - Mobile First */}
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="w-full px-4 py-4 space-y-4">
          {/* Food Input Card */}
          <div className="bg-white rounded-2xl shadow-lg p-4 space-y-4">
            {/* Input Field with Suggestions */}
            <div className="relative">
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                What did you eat?
              </label>
              <input
                type="text"
                value={foodInput}
                onChange={handleFoodInputChange}
                onFocus={() => {
                  if (foodInput.trim() && filteredSuggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                placeholder="Type food name..."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-base text-gray-900 placeholder-gray-400"
              />
              
              {/* Suggestions Dropdown */}
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {filteredSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => selectSuggestion(suggestion)}
                      className="w-full px-4 py-2.5 text-left hover:bg-blue-50 transition text-sm text-gray-900 border-b border-gray-100 last:border-b-0"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Preparation Method - Show for Text Input */}
            {foodInput.trim() && !image && (
              <div className="space-y-3 bg-blue-50 rounded-xl p-3 animate-in fade-in">
                {/* Quantity Suggestions */}
                {quantitySuggestions.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2">
                      How much did you eat?
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 mb-3">
                      {quantitySuggestions.map((qty, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setImageDetails({ ...imageDetails, quantity: qty })}
                          className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                            imageDetails.quantity === qty
                              ? 'bg-green-500 text-white'
                              : 'bg-white text-gray-700 border border-gray-200'
                          }`}
                        >
                          {qty}
                        </button>
                      ))}
                    </div>
                    {/* Custom quantity input */}
                    <input
                      type="text"
                      value={imageDetails.quantity}
                      onChange={(e) => setImageDetails({ ...imageDetails, quantity: e.target.value })}
                      placeholder="Or type custom quantity..."
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
                    />
                  </div>
                )}
                
                {/* Preparation Method */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    How was it prepared?
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: 'Fried', icon: '🍳' },
                      { label: 'Baked', icon: '🥐' },
                      { label: 'Grilled', icon: '🔥' },
                      { label: 'Home', icon: '🏠' },
                      { label: 'Restaurant', icon: '🍽️' },
                      { label: 'Packaged', icon: '📦' }
                    ].map((method) => (
                      <button
                        key={method.label}
                        type="button"
                        onClick={() => setImageDetails({ ...imageDetails, prepMethod: method.label })}
                        className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                          imageDetails.prepMethod === method.label
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-gray-700 border border-gray-200'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-sm">{method.icon}</span>
                          <span>{method.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Image Preview - Mobile Optimized */}
            {imagePreview && (
              <div className="space-y-3 animate-in fade-in">
                <div className="relative rounded-xl overflow-hidden border-2 border-blue-300">
                  <img 
                    src={imagePreview} 
                    alt="Food" 
                    className="w-full h-48 object-cover"
                  />
                  <button
                    onClick={() => {
                      setImage(null);
                      setImagePreview(null);
                      setImageDetails({ quantity: '', prepMethod: '', additionalInfo: '' });
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-white/95 rounded-full shadow-lg"
                  >
                    <X className="w-4 h-4 text-gray-700" />
                  </button>
                  <div className="absolute bottom-2 left-2 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Detected
                  </div>
                </div>

                {/* Compact Details */}
                <div className="space-y-2 bg-blue-50 rounded-xl p-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    How much did you eat?
                  </label>
                  <input
                    type="text"
                    value={imageDetails.quantity}
                    onChange={(e) => setImageDetails({ ...imageDetails, quantity: e.target.value })}
                    placeholder="Quantity (e.g., 1 bowl)"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-400"
                  />
                  
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: 'Fried', icon: '🍳' },
                      { label: 'Baked', icon: '🥐' },
                      { label: 'Grilled', icon: '🔥' },
                      { label: 'Home', icon: '🏠' },
                      { label: 'Restaurant', icon: '🍽️' },
                      { label: 'Packaged', icon: '📦' }
                    ].map((method) => (
                      <button
                        key={method.label}
                        type="button"
                        onClick={() => setImageDetails({ ...imageDetails, prepMethod: method.label })}
                        className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                          imageDetails.prepMethod === method.label
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-gray-700 border border-gray-200'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-sm">{method.icon}</span>
                          <span>{method.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Camera Button */}
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
                className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {compressing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Compressing...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    <span>Scan with Camera</span>
                  </>
                )}
              </button>
            </div>

            {/* Analyze Button */}
            <button
              onClick={handleAnalyze}
              disabled={loading || (!foodInput.trim() && !image)}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold text-sm hover:shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Analyze Food</span>
                </>
              )}
            </button>
          </div>

          {/* Info Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-900">
              Upload a photo or type the food name. AI will analyze nutrition and provide health insights.
            </p>
          </div>
        </div>
      </div>

      {/* Result Modal - Mobile Optimized */}
      {showResultModal && result && (
        <div 
          className="fixed inset-0 bg-black/60 z-[9999] overflow-y-auto"
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            touchAction: 'pan-y'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              e.stopPropagation();
              resetForm();
            }
          }}
        >
          <div 
            className="min-h-screen flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                resetForm();
              }
            }}
          >
            <div 
              className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl max-h-[95vh] overflow-y-auto"
              style={{ position: 'relative', zIndex: 10000 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Food Image Header - Mobile Optimized */}
              <div className="relative h-48 sm:h-64 bg-gradient-to-br from-cyan-100 to-blue-100 sm:rounded-t-3xl rounded-t-3xl overflow-hidden">
                {loadingFoodImage ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  </div>
                ) : foodImage ? (
                  <img 
                    src={foodImage} 
                    alt={result.foodItem?.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <ChefHat className="w-12 h-12 sm:w-16 sm:h-16 text-blue-400 mx-auto mb-2" />
                      <p className="text-blue-600 font-semibold text-sm">{result.foodItem?.name}</p>
                    </div>
                  </div>
                )}
                
                {/* Close Button */}
                <button
                  onClick={resetForm}
                  className="absolute top-3 right-3 p-2 bg-white/95 rounded-full shadow-lg"
                >
                  <X className="w-5 h-5 text-gray-700" />
                </button>
              </div>

              {/* Content - Mobile Optimized */}
              <div className="p-4 space-y-4">
                {/* Title and Health Score */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-gray-900 mb-1 truncate">
                      {result.foodItem?.name}
                    </h2>
                    <p className="text-xs text-gray-600">{result.foodItem?.quantity || '1 serving'}</p>
                  </div>
                  <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center font-bold flex-shrink-0 ${
                    result.isHealthy 
                      ? 'bg-green-500 text-white' 
                      : 'bg-red-500 text-white'
                  }`}>
                    <span className="text-xl">{result.healthScore}</span>
                    <span className="text-[10px]">Score</span>
                  </div>
                </div>

                {/* Health Status Badge */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-xs ${
                  result.isHealthy
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {result.isHealthy ? (
                    <>
                      <CheckCircle className="w-3 h-3" />
                      Healthy Choice
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3" />
                      Not Ideal
                    </>
                  )}
                </div>

                {/* Nutrition Grid - Mobile Optimized */}
                <div>
                  <h3 className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                    Nutrition Per Serving
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-3 border border-orange-200">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Flame className="w-4 h-4 text-orange-500" />
                        <span className="text-[10px] font-semibold text-gray-600">Carbs</span>
                      </div>
                      <p className="text-xl font-bold text-gray-900">
                        {result.foodItem?.nutrition?.carbs || 0}
                      </p>
                      <p className="text-[10px] text-gray-500">grams</p>
                    </div>

                    <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-3 border border-red-200">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Heart className="w-4 h-4 text-red-500" />
                        <span className="text-[10px] font-semibold text-gray-600">Fat</span>
                      </div>
                      <p className="text-xl font-bold text-gray-900">
                        {result.foodItem?.nutrition?.fats || 0}
                      </p>
                      <p className="text-[10px] text-gray-500">grams</p>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-3 border border-blue-200">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Zap className="w-4 h-4 text-blue-500" />
                        <span className="text-[10px] font-semibold text-gray-600">Protein</span>
                      </div>
                      <p className="text-xl font-bold text-gray-900">
                        {result.foodItem?.nutrition?.protein || 0}
                      </p>
                      <p className="text-[10px] text-gray-500">grams</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-3 border border-purple-200">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Droplets className="w-4 h-4 text-purple-500" />
                        <span className="text-[10px] font-semibold text-gray-600">Fiber</span>
                      </div>
                      <p className="text-xl font-bold text-gray-900">
                        {result.foodItem?.nutrition?.fiber || 0}
                      </p>
                      <p className="text-[10px] text-gray-500">grams</p>
                    </div>
                  </div>

                  {/* Total Calories */}
                  <div className="mt-3 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-3 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold opacity-90">Total Calories</p>
                        <p className="text-2xl font-bold">{result.foodItem?.nutrition?.calories || 0}</p>
                      </div>
                      <Flame className="w-10 h-10 opacity-50" />
                    </div>
                  </div>
                </div>

                {/* Analysis */}
                {result.analysis && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-700 leading-relaxed">{result.analysis}</p>
                  </div>
                )}

                {/* Warnings */}
                {result.warnings && result.warnings.length > 0 && (
                  <div className="bg-red-50 rounded-xl p-3 border border-red-200">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-red-900 mb-1 text-xs">⚠️ Watch Out</p>
                        <ul className="space-y-0.5">
                          {result.warnings.map((w, i) => (
                            <li key={i} className="text-xs text-red-700">• {w}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Alternatives */}
                {result.alternatives && result.alternatives.length > 0 && (
                  <div className="bg-green-50 rounded-xl p-3 border border-green-200">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Lightbulb className="w-4 h-4 text-green-600" />
                      <h4 className="font-bold text-green-900 text-xs">✨ Better Options</h4>
                    </div>
                    <div className="space-y-2">
                      {result.alternatives.slice(0, 3).map((alt, i) => (
                        <div key={i} className="bg-white rounded-lg p-2.5 border border-green-200">
                          <div className="flex items-start justify-between mb-1">
                            <p className="font-semibold text-gray-900 text-xs flex-1">{alt.name}</p>
                            <span className="text-[10px] font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded ml-2">
                              {alt.nutrition?.calories} cal
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-700">{alt.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons - Mobile Optimized */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={resetForm}
                    className="flex-1 py-3 bg-gray-200 text-gray-900 rounded-xl font-semibold text-sm hover:bg-gray-300 transition-all"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleLogMeal}
                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-all"
                  >
                    Log Meal
                  </button>
                </div>
              </div>
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
                  className={`w-full p-4 rounded-xl flex items-center gap-4 transition-all ${
                    selectedMealType === meal.type
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

      {/* Full-Screen Analyzing Overlay - Prevents App Crash */}
      {loading && (
        <div 
          className="fixed inset-0 bg-gradient-to-br from-cyan-900/95 via-blue-900/95 to-purple-900/95 z-[10000] flex items-center justify-center"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            touchAction: 'none',
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none'
          }}
        >
          <div className="text-center px-6 max-w-md">
            {/* Animated Food Icon */}
            <div className="relative mb-8">
              <div className="w-32 h-32 mx-auto relative">
                {/* Outer rotating ring */}
                <div className="absolute inset-0 border-8 border-cyan-400/30 rounded-full animate-spin" 
                     style={{ animationDuration: '3s' }}
                />
                {/* Middle rotating ring */}
                <div className="absolute inset-4 border-8 border-blue-400/40 rounded-full animate-spin" 
                     style={{ animationDuration: '2s', animationDirection: 'reverse' }}
                />
                {/* Inner pulsing circle */}
                <div className="absolute inset-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full animate-pulse flex items-center justify-center">
                  <ChefHat className="w-12 h-12 text-white" />
                </div>
              </div>
            </div>

            {/* Analyzing Text */}
            <h2 className="text-3xl font-bold text-white mb-3 animate-pulse">
              Analyzing Your Food
            </h2>
            <p className="text-cyan-200 text-lg mb-6">
              AI is processing your image...
            </p>

            {/* Progress Steps */}
            <div className="space-y-3 text-left bg-white/10 backdrop-blur-sm rounded-2xl p-6">
              <div className="flex items-center gap-3 text-white">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <span className="text-sm">Image compressed successfully</span>
              </div>
              <div className="flex items-center gap-3 text-white">
                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin flex-shrink-0" />
                <span className="text-sm">Detecting food items...</span>
              </div>
              <div className="flex items-center gap-3 text-white/50">
                <div className="w-6 h-6 rounded-full border-2 border-white/30 flex-shrink-0" />
                <span className="text-sm">Calculating nutrition...</span>
              </div>
              <div className="flex items-center gap-3 text-white/50">
                <div className="w-6 h-6 rounded-full border-2 border-white/30 flex-shrink-0" />
                <span className="text-sm">Generating health score...</span>
              </div>
            </div>

            {/* Tip */}
            <div className="mt-6 bg-yellow-500/20 border-2 border-yellow-400/50 rounded-xl p-4">
              <p className="text-yellow-200 text-sm flex items-start gap-2">
                <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>
                  This may take 10-30 seconds. Please don't close the app or switch tabs.
                </span>
              </p>
            </div>

            {/* Animated dots */}
            <div className="flex justify-center gap-2 mt-8">
              <div className="w-3 h-3 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-3 h-3 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
