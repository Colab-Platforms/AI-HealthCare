import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, X, Camera, ChefHat, Info, Flame, Heart, Zap, Droplets,
  CheckCircle, AlertCircle, Lightbulb, ArrowLeft, ScanLine, Plus, Activity, Brain, Sparkles,
  ShieldCheck, TrendingUp, TrendingDown, ChevronRight, Image as ImageIcon
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
  const [isLogging, setIsLogging] = useState(false);
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

  // Check for persisted result or image on mount (for mobile memory recovery)
  useEffect(() => {
    // Check sessionStorage first (more reliable than localStorage on mobile)
    const persistedResult = sessionStorage.getItem('foodScanResult');
    const persistedImage = sessionStorage.getItem('foodScanImage');
    const persistedInput = sessionStorage.getItem('foodScanInput');
    const persistedDetails = sessionStorage.getItem('foodScanDetails');
    const persistedBinaryImage = sessionStorage.getItem('foodScanBinaryImage');

    console.log('Checking for persisted data...', {
      hasResult: !!persistedResult,
      hasImage: !!persistedImage,
      hasBinary: !!persistedBinaryImage,
      hasInput: !!persistedInput,
      hasDetails: !!persistedDetails
    });

    // Recover input values if no current value
    if (persistedInput && !foodInput) {
      setFoodInput(persistedInput);
      setQuantitySuggestions(getQuantitySuggestions(persistedInput));
    }
    if (persistedDetails && (!imageDetails.quantity && !imageDetails.prepMethod)) {
      try {
        setImageDetails(JSON.parse(persistedDetails));
      } catch (e) { }
    }

    // Recover binary image (Base64 DataURL -> File)
    if (persistedBinaryImage && !image) {
      try {
        console.log('🔄 Attempting to recover image from storage...');

        let recoveredFile;
        let previewUrl = persistedBinaryImage;

        // Extract mime type and data
        if (persistedBinaryImage.startsWith('data:')) {
          const [meta, data] = persistedBinaryImage.split(';base64,');
          const mime = meta.split(':')[1];
          const binary = atob(data);
          const array = [];
          for (let i = 0; i < binary.length; i++) array.push(binary.charCodeAt(i));
          const blob = new Blob([new Uint8Array(array)], { type: mime });
          recoveredFile = new File([blob], 'captured_food.jpg', { type: mime });

          // For recovery, create a local URL for the blob as it's more stable for display
          previewUrl = URL.createObjectURL(recoveredFile);
        }

        if (recoveredFile) {
          setImage(recoveredFile);
          setImagePreview(previewUrl);
          console.log('✅ Recovered image successfully');

          // Auto-trigger analysis if we have details
          const details = persistedDetails ? JSON.parse(persistedDetails) : null;
          if (persistedInput || details?.quantity) {
            console.log('🚀 Auto-resuming analysis...');
            setTimeout(() => {
              handleAnalyze(null, recoveredFile);
            }, 800);
          }
        }
      } catch (e) {
        console.error('❌ Recovery failed:', e);
      }
    }

    if (persistedResult) {
      try {
        const parsedResult = JSON.parse(persistedResult);
        setResult(parsedResult);
        setShowResultModal(true);

        if (persistedImage) {
          setFoodImage(persistedImage);
        }

        // Clear persisted results but keep inputs (maybe user wants to scan more)
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
  }, [navigate]);

  // Real-time persistence for inputs - prevent data loss on mobile reloads
  useEffect(() => {
    if (foodInput) sessionStorage.setItem('foodScanInput', foodInput);
    if (imageDetails.quantity || imageDetails.prepMethod || imageDetails.additionalInfo) {
      sessionStorage.setItem('foodScanDetails', JSON.stringify(imageDetails));
    }
    // Clean up if cleared
    if (!foodInput && !image) {
      sessionStorage.removeItem('foodScanInput');
      sessionStorage.removeItem('foodScanDetails');
      sessionStorage.removeItem('foodScanBinaryImage');
    }
  }, [foodInput, imageDetails, image]);

  // Prevent navigation/unmounting during analysis - CRITICAL FOR MOBILE
  useEffect(() => {
    if (loading) {
      console.log('🔒 Blocking navigation - analysis in progress');

      // Block browser back button
      const handleBeforeUnload = (e) => {
        e.preventDefault();
        e.returnValue = '';
      };

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
  }, [loading]);

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

      // Smart real-time update: Check for exact or partial matches to show better pills
      const bestMatch = filtered[0] || value;
      setQuantitySuggestions(getQuantitySuggestions(bestMatch));
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

      // MAX 20MB for the raw file before compression to prevent browser crash
      if (file.size > 20 * 1024 * 1024) {
        return reject(new Error('Image is too large (max 20MB). Please take a smaller photo or use a screenshot.'));
      }

      // SUPER AGGRESSIVE compression for mobile
      const isVeryLarge = file.size > 2 * 1024 * 1024; // > 2MB
      let targetQuality = 0.5;
      let maxDimension = 800; // Standard

      if (isMobile) {
        // Balanced settings - 1024px is high res enough but keeps memory low
        targetQuality = 0.6;
        maxDimension = 1024;
      } else if (isVeryLarge) {
        targetQuality = 0.7;
        maxDimension = 1200;
      }

      console.log('🗜️ Compression starting...', {
        isMobile,
        targetQuality,
        maxDimension,
        originalSize: (file.size / 1024).toFixed(2) + ' KB',
        fileType: file.type
      });

      const blobUrl = URL.createObjectURL(file);
      const img = new Image();

      // Safety timeout for image loading
      const timeoutId = setTimeout(() => {
        img.src = ''; // Clear src to stop loading
        console.warn('❌ Image processing timed out after 30s');
        img.onload = null;
        img.onerror = null;
        resolve(file);
      }, 30000);

      // CRITICAL: Set handlers BEFORE setting src to avoid race condition
      img.onload = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(blobUrl); // Clean up immediately
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

          console.log('📐 Resizing to', width, 'x', height);
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d', { alpha: false }); // Disable alpha for memory
          if (!ctx) {
            throw new Error('Could not get canvas context - low memory');
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Clear img from memory
          img.src = "";

          // Compress to JPEG
          canvas.toBlob(
            (blob) => {
              // Aggressive cleanup
              canvas.width = 0;
              canvas.height = 0;

              if (!blob) {
                console.warn('⚠️ Canvas toBlob returned null, using original file');
                resolve(file);
                return;
              }

              const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });

              console.log('✅ Final size:', (compressedFile.size / 1024).toFixed(2), 'KB');
              resolve(compressedFile);
            },
            'image/jpeg',
            targetQuality
          );
        } catch (error) {
          console.error('Canvas compression error:', error);
          // Fallback: use original file
          resolve(file);
        }
      };

      img.onerror = (e) => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(blobUrl);
        console.warn('⚠️ Failed to load image in canvas, using original file. Error:', e);
        // Fallback: resolve with original file instead of rejecting
        // The browser couldn't decode it (e.g., HEIC), but the server/AI might handle it
        resolve(file);
      };

      // Set crossOrigin before src for CORS images
      img.crossOrigin = 'anonymous';
      // Set src AFTER handlers to prevent race condition
      img.src = blobUrl;
    });
  };

  const handleImageSelect = async (e) => {
    console.log('--- HANDLE IMAGE SELECT START ---');
    const file = e.target.files?.[0];
    const inputSource = e.target.id;

    console.log(`📸 Image selected from ${inputSource}`, file ? {
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      type: file.type
    } : 'No file');

    if (file) {
      // Check if file is larger than 50MB
      if (file.size > 50 * 1024 * 1024) {
        toast.error('Image too large. Please use an image smaller than 50MB');
        return;
      }

      setCompressing(true);
      const toastId = toast.loading('Processing image...');

      try {
        // 1. SET INSTANT PREVIEW - Use blob URL for immediate display
        const fastPreview = URL.createObjectURL(file);
        setImagePreview(fastPreview);
        setImage(file);
        console.log('⚡ Preview set successfully');

        // 2. COMPRESS IMAGE IN BACKGROUND
        await new Promise(resolve => setTimeout(resolve, 300));
        
        let processedFile;
        try {
          processedFile = await compressImage(file);
          if (processedFile && processedFile !== file) {
            setImage(processedFile);
            console.log('🗜️ Image optimized');
          }
        } catch (compressionError) {
          console.warn('Optimization skipped:', compressionError.message);
          processedFile = file;
          setImage(processedFile);
        }

        // 3. PERSIST TO SESSION STORAGE (for mobile recovery)
        // Only persist if image is small enough (< 3MB after compression)
        if (processedFile.size < 3 * 1024 * 1024) {
          try {
            const reader = new FileReader();
            reader.onloadend = () => {
              try {
                sessionStorage.setItem('foodScanBinaryImage', reader.result);
                console.log('📦 Image persisted to sessionStorage');
              } catch (storageError) {
                console.warn('📦 Storage quota exceeded - image not persisted');
                sessionStorage.removeItem('foodScanBinaryImage');
              }
            };
            reader.readAsDataURL(processedFile);
          } catch (e) {
            console.warn('Failed to persist image:', e);
          }
        } else {
          console.log('📦 Image too large for sessionStorage (>3MB), skipping persistence');
        }

        toast.success(`Image ready! ${(processedFile.size / 1024).toFixed(0)}KB`, { id: toastId });

      } catch (error) {
        console.error('Image processing error:', error);
        toast.error('Failed to process image. Please try a different image.', { id: toastId });
      } finally {
        setCompressing(false);
      }
    }

    // Reset input to allow selecting the same file again
    e.target.value = '';
  };

  const fetchFoodImage = async (foodName) => {
    setLoadingFoodImage(true);
    try {
      const response = await api.get(
        `/nutrition/food-image?foodName=${encodeURIComponent(foodName)}`,
        { skipAutoLogout: true }
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

  const handleAnalyze = async (e, directImage = null) => {
    if (e) e.preventDefault();

    // Safety check: prevent double clicks
    if (loading || isAnalyzing.current) {
      console.log('Analysis already in progress, skipping...');
      return;
    }

    const currentImage = directImage || image;

    if (!foodInput.trim() && !currentImage) {
      toast.error('Please enter a food item or upload an image');
      return;
    }

    if (currentImage && !imageDetails.quantity && !imageDetails.prepMethod) {
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
    isAnalyzing.current = true;
    setFoodImage(null);
    const analysisToastId = toast.loading('AI is carefully scanning your food...');

    // Store data in variables to prevent state loss
    let analysisResult = null;
    let shouldShowModal = false;

    try {
      let formData = new FormData();

      if (currentImage) {
        console.log('Using binary upload via FormData...');
        console.log('Image size:', (currentImage.size / 1024).toFixed(2), 'KB');
        formData.append('image', currentImage);
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

      // Add other fields to FormData
      formData.append('foodDescription', foodInput || 'Food from image');
      formData.append('additionalContext', contextText);

      console.log('Sending analysis request (FormData) via api instance...');

      const response = await api.post(
        '/nutrition/quick-check',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          timeout: 180000, // INCREASED TO 3 MINUTES
          skipAutoLogout: true
        }
      );

      toast.dismiss(analysisToastId);

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
        fetchFoodImage(analysisResult.foodItem.name);
      }

      toast.success('Food analyzed!');

      isAnalyzing.current = false;
      setLoading(false);
      return;

    } catch (error) {
      toast.dismiss(analysisToastId);
      console.error('Analysis error:', error);
      console.error('Error response:', error.response);
      console.error('Error status:', error.response?.status);

      setLoading(false);
      isAnalyzing.current = false;

      // DON'T redirect to login on 401 — the api interceptor handles this
      // Only show a toast message, let the user retry
      if (error.response?.status === 401) {
        toast.error('Session issue. Please try again. If the problem persists, re-login.', {
          duration: 5000
        });
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
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
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
    if (isLogging) return;
    setIsLogging(true);
    const logToastId = toast.loading('Logging meal...');
    try {

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
      const response = await api.post(
        '/nutrition/log-meal',
        {
          mealType: selectedMealType,
          foodItems: [foodItem],
          notes: `Logged from Quick Food Scan`,
          imageUrl: result.imageUrl,
          healthScore: result.healthScore,
          healthScore10: result.healthScore10,
          micronutrients: result.micronutrients,
          enhancementTips: result.enhancementTips,
          healthBenefitsSummary: result.healthBenefitsSummary,
          timestamp: new Date().toISOString().split('T')[0]
        },
        {
          skipAutoLogout: true
        }
      );

      if (response.data.success) {
        toast.success(`Meal logged to ${selectedMealType}! 🎉`, { id: logToastId });
        setShowMealTypeModal(false);
        resetForm();
        // Navigate to nutrition page
        setTimeout(() => {
          navigate('/nutrition#daily-target');
        }, 1000);
      }
    } catch (error) {
      console.error('Log meal error:', error);
      toast.error('Failed to log meal. Please try again.', { id: logToastId });
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans selection:bg-[#2FC8B9]/20">
      {/* Premium Glass Header */}
      <div className="w-full px-6 py-5 bg-white/80 backdrop-blur-2xl border-b border-[#2FC8B9]/10 sticky top-0 z-[100] shadow-[0_4px_20px_-5px_rgba(0,0,0,0.05)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="group p-2.5 bg-white rounded-2xl shadow-sm border border-[#2FC8B9]/5 hover:bg-slate-50 transition-all active:scale-95"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600 group-hover:text-[#2FC8B9] transition-colors" />
            </button>
            <div>
              <h1 className="text-xl font-extrabold text-[#1e293b] leading-tight tracking-tight">Food Scanner</h1>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#2FC8B9] animate-pulse" />
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">AI Nutrition Analysis</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-[#2FC8B9]/10 p-2 rounded-xl border border-[#2FC8B9]/20">
              <ScanLine className="w-5 h-5 text-[#2FC8B9]" />
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
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[#2FC8B9] to-[#25a89b] rounded-[2rem] blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
                <div className="relative bg-white rounded-[2rem] p-6 sm:p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] border border-slate-100">
                  {(!foodInput.trim() && !imagePreview) && (
                    <div className="flex flex-col items-center text-center mb-8 animate-in fade-in zoom-in duration-500">
                      <div className="w-16 h-16 bg-[#2FC8B9]/10 rounded-2xl flex items-center justify-center mb-4 border border-[#2FC8B9]/20">
                        <ChefHat className="w-8 h-8 text-[#2FC8B9]" />
                      </div>
                      <h2 className="text-2xl font-black text-[#1e293b] mb-2">Track Your Meal</h2>
                      <p className="text-slate-500 text-sm max-w-[280px]">Take a photo or type what you ate for instant nutritional insights.</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Visual Text Input */}
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-[#2FC8B9]/10 p-1.5 rounded-lg border border-[#2FC8B9]/20">
                        <Info className="w-4 h-4 text-[#2FC8B9]" />
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
                        className="w-full pl-14 pr-4 py-6 bg-slate-50/50 border-2 border-[#2FC8B9]/40 rounded-2xl focus:outline-none focus:border-[#2FC8B9] focus:bg-white transition-all text-xl text-slate-800 font-black placeholder-slate-400 shadow-xl"
                      />

                      {/* Premium Suggestions Dropdown */}
                      {showSuggestions && filteredSuggestions.length > 0 && (
                        <div className="absolute z-[110] w-full mt-2 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                          {filteredSuggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              onClick={() => selectSuggestion(suggestion)}
                              className="w-full px-5 py-3.5 text-left hover:bg-[#2FC8B9]/10 transition-colors text-sm font-semibold text-slate-700 flex items-center gap-3 border-b border-slate-50 last:border-0"
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-[#2FC8B9]" />
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

                    <input
                      id="camera-input"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageSelect}
                      className="hidden"
                      disabled={compressing}
                    />
                    <input
                      id="gallery-input"
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                      disabled={compressing}
                    />

                    <div className="flex flex-col gap-3">
                      {/* Scan Button (Direct Camera) */}
                      <label
                        htmlFor="camera-input"
                        className={`w-full group relative overflow-hidden py-5 bg-slate-900 text-white rounded-2xl font-bold text-sm tracking-wide transition-all active:scale-[0.98] shadow-xl hover:shadow-2xl hover:bg-slate-800 flex items-center justify-center cursor-pointer ${compressing ? 'opacity-75 cursor-not-allowed' : ''}`}
                      >
                        <div className="relative z-10 flex items-center justify-center gap-3">
                          {compressing ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin text-[#2FC8B9]" />
                              <span>Optimizing Image...</span>
                            </>
                          ) : (
                            <>
                              <Camera className="w-5 h-5 group-hover:scale-110 transition-transform" />
                              <span>Scan Food with Camera</span>
                            </>
                          )}
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-r from-[#2FC8B9]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </label>

                      {/* Gallery Button */}
                      <label
                        htmlFor="gallery-input"
                        className={`w-full group relative overflow-hidden py-4 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold text-sm tracking-wide transition-all active:scale-[0.98] hover:bg-slate-50 flex items-center justify-center cursor-pointer ${compressing ? 'opacity-75 cursor-not-allowed' : ''}`}
                      >
                        <div className="relative z-10 flex items-center justify-center gap-3">
                          <ImageIcon className="w-5 h-5 text-[#2FC8B9] group-hover:scale-110 transition-transform" />
                          <span>Select from Gallery</span>
                        </div>
                      </label>
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
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-orange-500 rounded-[2.2rem] blur opacity-10"></div>
                  <div className="relative rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl">
                    <img
                      src={imagePreview}
                      alt="Scanned Food"
                      className="w-full h-72 object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60"></div>

                    <button
                      onClick={() => {
                        if (imagePreview && imagePreview.startsWith('blob:')) {
                          URL.revokeObjectURL(imagePreview);
                        }
                        setImage(null);
                        setImagePreview(null);
                        setImageDetails({ quantity: '', prepMethod: '', additionalInfo: '' });
                      }}
                      className="absolute top-4 right-4 p-2.5 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl hover:bg-red-50 hover:text-red-500 transition-all active:scale-95"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <div className="absolute bottom-4 left-4 flex items-center gap-2">
                      <div className="bg-white/95 backdrop-blur-md text-[#2FC8B9] px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-wider shadow-lg flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Image Ready
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.06)] border border-slate-100 space-y-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 bg-[#2FC8B9]/10 rounded-xl flex items-center justify-center">
                    <Flame className="w-5 h-5 text-[#2FC8B9]" />
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
                            ? 'bg-[#2FC8B9] border-[#2FC8B9] text-white shadow-lg shadow-[#2FC8B9]/20'
                            : 'bg-white border-slate-100 text-slate-600 hover:border-[#2FC8B9]/30'
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
                      className="w-full px-5 py-3.5 bg-slate-50/80 border-2 border-[#2FC8B9]/20 rounded-xl focus:outline-none focus:border-[#2FC8B9] focus:bg-white transition-all text-sm font-semibold text-slate-800 placeholder-slate-400"
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
                            ? 'bg-[#2FC8B9] border-[#2FC8B9] text-white shadow-lg shadow-[#2FC8B9]/20'
                            : 'bg-white border-slate-100 text-slate-600 hover:border-[#2FC8B9]/30'
                            }`}
                        >
                          <span className="text-lg leading-none">{method.icon}</span>
                          <span className="text-[9px] font-black uppercase tracking-tighter">{method.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Final Analysis Trigger */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleAnalyze();
                    }}
                    disabled={loading}
                    className="w-full group relative overflow-hidden py-5 bg-[#2FC8B9] text-white rounded-[2rem] font-black text-base tracking-widest transition-all active:scale-[0.98] shadow-[0_20px_40px_-12px_rgba(47,200,185,0.3)] disabled:opacity-50"
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
          )}

          {/* Info Badge */}
          <div className="max-w-md mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-[#2FC8B9]/5 backdrop-blur-sm rounded-full border border-[#2FC8B9]/20 group">
              <Info className="w-4 h-4 text-[#2FC8B9] group-hover:rotate-12 transition-transform" />
              <p className="text-[11px] font-semibold text-[#2FC8B9] tracking-wide">
                AI analysis is an estimate. Portions may impact accuracy.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Result Modal - Premium Redesign */}
      {
        showResultModal && result && (
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] overflow-y-auto px-4 py-8"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                resetForm();
              }
            }}
          >
            <div
              className="max-w-2xl mx-auto bg-white rounded-[2.5rem] shadow-[0_32px_100px_-12px_rgba(0,0,0,0.25)] overflow-hidden relative animate-in zoom-in-95 slide-in-from-bottom-5 duration-500 ease-out"
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
                        <Zap className="w-4 h-4 text-[#2FC8B9]" />
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

                {/* Analyzed Image Display */}
                {(result.imageUrl || imagePreview || foodImage) && (
                  <div className="mt-8 relative rounded-[2rem] overflow-hidden border-2 border-slate-100 shadow-inner group">
                    {loadingFoodImage && !result.imageUrl && !imagePreview ? (
                      <div className="w-full h-48 bg-slate-100 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-[#2FC8B9]" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Finding Photo...</span>
                      </div>
                    ) : (
                      <>
                        <img
                          src={result.imageUrl || imagePreview || foodImage}
                          alt={result.foodItem?.name}
                          className="w-full h-48 object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                        <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-[9px] font-black text-slate-600 uppercase tracking-widest border border-white shadow-sm">
                          {foodImage && !result.imageUrl && !imagePreview ? 'Sample Image' : 'Analyzed Image'}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Macro Breakdown */}
              <div className="px-8 mt-10">
                <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100 shadow-inner">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[
                      { label: 'Calories', value: result.foodItem?.nutrition?.calories, icon: Flame, color: 'text-orange-500', bg: 'bg-orange-100', b: 'border-orange-200' },
                      { label: 'Protein', value: result.foodItem?.nutrition?.protein, icon: Zap, color: 'text-[#2FC8B9]', bg: 'bg-[#2FC8B9]/10', b: 'border-[#2FC8B9]/20' },
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
                <div className="bg-[#2FC8B9]/10 rounded-[2.5rem] p-7 border border-[#2FC8B9]/20 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-xl bg-[#2FC8B9]/20 flex items-center justify-center text-[#2FC8B9]">
                      <Activity className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-black text-slate-700 tracking-tight uppercase">Micronutrients Breakdown</h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(result.micronutrients || []).map((micro, i) => (
                      <div key={i} className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-[#2FC8B9]/10 shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[11px] font-black text-slate-700 truncate">{typeof micro === 'object' ? micro.name : micro}</span>
                          <span className="text-[10px] font-black text-[#2FC8B9]">{typeof micro === 'object' ? micro.percentage : '--'}%</span>
                        </div>
                        <p className="text-xl font-black text-slate-800 mb-2">{typeof micro === 'object' ? micro.value : '--'}</p>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#2FC8B9] rounded-full transition-all duration-1000"
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
                    <Info className="w-4 h-4 text-[#2FC8B9]" />
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
                            <div className="px-2 py-1 bg-[#2FC8B9]/10 text-[#2FC8B9] text-[9px] font-black rounded-lg uppercase">
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
                  className="flex-[2] py-5 bg-[#2FC8B9] text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-[0_20px_40px_-12px_rgba(47,200,185,0.3)] hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <CheckCircle className="w-5 h-5 text-white/80" />
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
                { type: 'breakfast', icon: '🌅', label: 'Breakfast', color: 'from-[#2FC8B9] to-[#25a89b]' },
                { type: 'lunch', icon: '☀️', label: 'Lunch', color: 'from-[#2FC8B9] to-[#25a89b]' },
                { type: 'dinner', icon: '🌙', label: 'Dinner', color: 'from-[#2FC8B9] to-[#25a89b]' },
                { type: 'snack', icon: '🍎', label: 'Snacks', color: 'from-[#2FC8B9] to-[#25a89b]' }
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
              disabled={isLogging}
              className="w-full py-4 bg-[#2FC8B9] text-white rounded-xl font-bold hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-70"
            >
              {isLogging ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Logging...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Log to {selectedMealType.charAt(0).toUpperCase() + selectedMealType.slice(1)}</span>
                </>
              )}
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
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#2FC8B9]/20 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#2FC8B9]/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>

          <div className="relative text-center px-8 w-full max-w-lg">
            {/* Holographic Scanner Effect */}
            <div className="relative mb-12">
              <div className="w-48 h-48 mx-auto relative">
                {/* Rotating Outer Ring */}
                <div className="absolute inset-0 border-[3px] border-dashed border-[#2FC8B9]/30 rounded-full animate-spin" style={{ animationDuration: '8s' }}></div>
                {/* Glowing Core */}
                <div className="absolute inset-4 bg-gradient-to-br from-[#2FC8B9] to-[#25a89b] rounded-full p-1 shadow-[0_0_50px_rgba(47,200,185,0.5)]">
                  <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-x-0 h-1 bg-[#2FC8B9]/50 blur-sm animate-[scan_2s_linear_infinite]" />
                    <ChefHat className="w-16 h-16 text-[#2FC8B9] drop-shadow-[0_0_10px_rgba(47,200,185,0.8)]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-4xl font-black text-white tracking-tighter">
                Scanning <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2FC8B9] to-[#bafff9]">Nutrition</span>
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
                    <div className="w-2 h-2 rounded-full bg-[#2FC8B9] shadow-[0_0_10px_rgba(47,200,185,1)]"></div>
                  ) : step.active ? (
                    <div className="w-2 h-2 rounded-full bg-[#2FC8B9] animate-ping"></div>
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                  )}
                  <span className={`text-xs font-bold uppercase tracking-widest ${step.active ? 'text-[#2FC8B9]' : 'text-slate-300'}`}>{step.text}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-center gap-3">
              <Info className="w-4 h-4 text-[#2FC8B9]/70" />
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
