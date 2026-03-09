import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, X, Mic, MicOff, ChefHat, Info, Flame, Heart, Zap, Droplets,
  CheckCircle, AlertCircle, Lightbulb, ArrowLeft, ScanLine, Plus, Activity, Brain, Sparkles,
  ShieldCheck, TrendingUp, TrendingDown, ChevronRight, Image as ImageIcon,
  Barcode, Search, History
} from 'lucide-react';
import BarcodeScanner from '../components/BarcodeScanner';

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
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('image'); // 'image', 'barcode', 'text'

  // Voice recognition state
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const recognitionRef = useRef(null);

  // Initialize Web Speech API (Chrome built-in)
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN'; // Indian English for better food name recognition

      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        const currentText = finalTranscript || interimTranscript;
        setVoiceTranscript(currentText);
        if (finalTranscript) {
          setFoodInput(prev => {
            const newVal = prev ? `${prev}, ${finalTranscript.trim()}` : finalTranscript.trim();
            setQuantitySuggestions(getQuantitySuggestions(newVal));
            return newVal;
          });
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setVoiceTranscript('');
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setVoiceTranscript('');
        if (event.error === 'not-allowed') {
          toast.error('Microphone access denied. Please allow mic in browser settings.');
        } else if (event.error === 'no-speech') {
          toast.error('No speech detected. Please try again.');
        } else {
          toast.error(`Voice error: ${event.error}`);
        }
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice recognition not supported. Please use Google Chrome.');
      return;
    }
    // Re-create recognition instance each time (fixes Chrome re-use bugs)
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        const currentText = finalTranscript || interimTranscript;
        setVoiceTranscript(currentText);
        console.log('🎙️ Voice transcript:', currentText);
        if (finalTranscript) {
          setFoodInput(prev => {
            const newVal = prev ? `${prev}, ${finalTranscript.trim()}` : finalTranscript.trim();
            setQuantitySuggestions(getQuantitySuggestions(newVal));
            return newVal;
          });
        }
      };

      recognition.onend = () => {
        console.log('🎙️ Voice recognition ended');
        setIsListening(false);
        setVoiceTranscript('');
      };

      recognition.onerror = (event) => {
        console.error('🎙️ Speech recognition error:', event.error);
        setIsListening(false);
        setVoiceTranscript('');
        if (event.error === 'not-allowed') {
          toast.error('Microphone access denied. Please allow mic in browser settings.');
        } else if (event.error === 'no-speech') {
          toast.error('No speech detected. Try again.');
        } else if (event.error === 'network') {
          toast.error('Network error. Speech API requires internet.');
        } else {
          toast.error(`Voice error: ${event.error}`);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
      setVoiceTranscript('');
      toast.success('🎙️ Listening... say your food item', { duration: 2000 });
      console.log('🎙️ Speech recognition started');
    } catch (err) {
      console.error('🎙️ Failed to start speech recognition:', err);
      toast.error('Failed to start voice. Make sure you\'re on localhost or HTTPS.');
      setIsListening(false);
    }
  };

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
        console.log('🔄 Recovery: Found base64 image, size:', Math.round(persistedBinaryImage.length / 1024), 'KB');

        // Increase safety limit for high-res mobile photos
        if (persistedBinaryImage.length > 30 * 1024 * 1024) {
          console.warn('⚠️ Stored image is too large for recovery, size:', Math.round(persistedBinaryImage.length / 1024 / 1024), 'MB');
          sessionStorage.removeItem('foodScanBinaryImage');
          return;
        }

        let recoveredFile;
        let previewUrl = persistedBinaryImage;

        // Extract mime type and data
        if (persistedBinaryImage.startsWith('data:')) {
          const parts = persistedBinaryImage.split(';base64,');
          if (parts.length === 2) {
            const [meta, data] = parts;
            // Robust mime extraction
            const mime = meta.split(':')[1]?.split(';')[0] || 'image/jpeg';
            const binary = atob(data);
            const array = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
            const blob = new Blob([array], { type: mime });
            recoveredFile = new File([blob], 'recovered_food.jpg', { type: mime });
            previewUrl = URL.createObjectURL(recoveredFile);
          }
        }

        if (recoveredFile) {
          setImage(recoveredFile);
          setImagePreview(previewUrl);
          console.log('✅ Recovered successfully');
          toast.success('📸 Image recovered!', { duration: 2000, id: 'recovery-toast' });
        }
      } catch (e) {
        console.error('❌ Recovery failed:', e);
        sessionStorage.removeItem('foodScanBinaryImage');
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
    if (foodInput) {
      sessionStorage.setItem('foodScanInput', foodInput);
    }
    if (imageDetails.quantity || imageDetails.prepMethod || imageDetails.additionalInfo) {
      sessionStorage.setItem('foodScanDetails', JSON.stringify(imageDetails));
    }
    // REMOVED auto-clear logic here as it wipes data on mount before recovery
  }, [foodInput, imageDetails]); // Removed image from deps trigger

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
      // Detect device type and browser
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      // MAX 40MB for the raw file before compression (modern phones have huge files)
      if (file.size > 40 * 1024 * 1024) {
        return reject(new Error('Image is too large (max 40MB).'));
      }

      // Settings optimized for mobile captures
      let targetQuality = 0.6;
      let maxDimension = 1200;

      if (isMobile) {
        // More aggressive for mobile to prevent memory crashes
        targetQuality = 0.5;
        maxDimension = 1000;
      }

      console.log('🗜️ Compression starting for mobile-compatible analysis...', {
        isMobile,
        originalSize: (file.size / 1024).toFixed(2) + ' KB'
      });

      const blobUrl = URL.createObjectURL(file);
      const img = new Image();

      // Increased timeout for slow mobile processors
      const timeoutId = setTimeout(() => {
        img.src = '';
        console.warn('❌ Processing timed out, using original');
        resolve(file);
      }, 45000);

      img.onload = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(blobUrl);
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Scale maintaining aspect ratio
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

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) throw new Error('Canvas context failed');

          // Paint white background (prevents transparent PNG issues)
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          }, 'image/jpeg', targetQuality
          );
        } catch (error) {
          console.error('Compression crash:', error);
          resolve(file);
        }
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(blobUrl);
        resolve(file);
      };

      img.src = blobUrl;
    });
  };

  const handleImageSelect = async (e) => {
    console.log('📸 handleImageSelect triggered');
    const file = e.target.files?.[0];
    if (!file) return;

    // Use a descriptive toast for high-res images
    const toastId = toast.loading(file.size > 15 * 1024 * 1024
      ? 'Optimizing high-quality photo... this may take a moment'
      : 'Processing image...');

    try {
      // 1. SET PREVIEW IMMEDIATELY (VITAL FOR MOBILE RESPONSIVENESS)
      const fastPreview = URL.createObjectURL(file);
      setImagePreview(fastPreview);
      setImage(file);
      setResult(null);
      setShowResultModal(false);

      // Clear input right away
      const target = e.target;
      setTimeout(() => { target.value = ''; }, 100);

      // 2. CREATE RECOVERY THUMBNAIL (Essential for mobile survivability)
      // We do this immediately in the background
      const createThumbnail = (file) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX = 800; // Small enough for sessionStorage, large enough for AI fallback
              let w = img.width;
              let h = img.height;
              if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } }
              else { if (h > MAX) { w *= MAX / h; h = MAX; } }
              canvas.width = w;
              canvas.height = h;
              canvas.getContext('2d').drawImage(img, 0, 0, w, h);
              const thumbBase64 = canvas.toDataURL('image/jpeg', 0.6);
              resolve(thumbBase64);
            };
          };
        });
      };

      // RUN PERSISTENCE
      createThumbnail(file).then(thumb => {
        try {
          sessionStorage.setItem('foodScanBinaryImage', thumb);
          console.log('📦 Persistence thumb saved');
        } catch (err) {
          console.warn('📦 Persistence failed:', err);
        }
      });

      // 3. OFF-LOAD FULL COMPRESSION (FOR UPLOAD)
      setTimeout(async () => {
        setCompressing(true);
        try {
          console.log('🗜️ Starting background compression for upload...');
          const processedFile = await compressImage(file);
          if (processedFile && processedFile !== file) {
            setImage(processedFile);
            console.log('🗜️ Image optimized for upload');
          }
          toast.success('Image ready!', { id: toastId });
        } catch (err) {
          console.warn('Compression task failed:', err);
          toast.dismiss(toastId);
        } finally {
          setCompressing(false);
        }
      }, 500);

    } catch (error) {
      console.error('Select error:', error);
      toast.error('Failed to load image', { id: toastId });
    }
  };

  const fetchFoodImage = async (foodName) => {
    setLoadingFoodImage(true);
    try {
      const response = await api.get(
        `nutrition/food-image?foodName=${encodeURIComponent(foodName)}`,
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

  const fetchScanHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await api.get('nutrition/quick-checks?limit=10');
      if (response.data.success) {
        setScanHistory(response.data.checks);
      }
    } catch (error) {
      console.error('Failed to fetch scan history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchScanHistory();
  }, []);

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
        'nutrition/quick-check',
        formData,
        {
          headers: {
            'Content-Type': undefined // CRITICAL: Allow axios to set boundary automatically
          },
          timeout: 240000, // 4 minutes
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
      fetchScanHistory(); // Refresh history after analysis
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
        // KEEP the image and preview so user can refine details instead of restarting
        toast.error("AI couldn't recognize the food in this photo. Please type what it is in the box below!", {
          duration: 6000
        });

        // Ensure we don't clear the image, just stay on this screen
        const refineSection = document.getElementById('refine-details');
        if (refineSection) {
          refineSection.scrollIntoView({ behavior: 'smooth' });
        }
      } else if (error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout'))) {
        toast.error('Connection timed out. Please try again with details specified.', { id: analysisToastId });
      } else if (error.message && error.message.includes('memory')) {
        toast.error('Image processing failed due to low memory. Please try a smaller file or text search.');
        setImage(null);
        setImagePreview(null);
      } else {
        toast.error(error.response?.data?.message || 'Something went wrong. Please check your connection or try a text description.', { id: analysisToastId });
      }
    }
  };


  const handleBarcodeScan = async (barcode) => {
    setShowBarcodeScanner(false);
    const scanToastId = toast.loading('Fetching product details...');

    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
      const data = await response.json();

      if (data.status === 1) {
        const product = data.product;
        // Map Open Food Facts data to our format
        const nutrition = {
          calories: Math.round(product.nutriments?.['energy-kcal_100g'] || 0),
          protein: Math.round(product.nutriments?.proteins_100g || 0),
          carbs: Math.round(product.nutriments?.carbohydrates_100g || 0),
          fats: Math.round(product.nutriments?.fat_100g || 0),
          sugar: Math.round(product.nutriments?.sugars_100g || 0),
          sodium: Math.round(product.nutriments?.sodium_100g || 0),
          fiber: Math.round(product.nutriments?.fiber_100g || 0)
        };

        const resultData = {
          foodItem: {
            name: product.product_name || 'Unknown Product',
            quantity: 'Per 100g', // Standard per 100g from OFF
            nutrition: nutrition
          },
          imageUrl: product.image_url,
          isHealthy: (product.nutriscore_grade === 'a' || product.nutriscore_grade === 'b'),
          healthBenefitsSummary: `Ingredients: ${product.ingredients_text || 'No ingredients listed.'}`,
          analysis: `Barcode: ${barcode}. Classified as ${product.categories || 'Food'}.`,
          enhancementTips: product.nova_group > 2 ? ['Highly processed food. Try to consume in moderation.', 'Pair with fresh vegetables.'] : ['Healthy choice!'],
          micronutrients: [
            { name: 'Calcium', value: `${product.nutriments?.calcium_100g || 0}mg`, percentage: Math.min(Math.round((product.nutriments?.calcium_100g / 1000) * 100), 100) },
            { name: 'Iron', value: `${product.nutriments?.iron_100g || 0}mg`, percentage: Math.min(Math.round((product.nutriments?.iron_100g / 18) * 100), 100) }
          ],
          warnings: product.ingredients_text_with_allergens ? [product.ingredients_text_with_allergens] : []
        };

        setResult(resultData);
        setShowResultModal(true);
        toast.success('Product found!', { id: scanToastId });

        // Save to server history
        api.post('nutrition/quick-check/save', {
          ...resultData,
          foodName: resultData.foodItem.name,
          quantity: resultData.foodItem.quantity,
          nutrition: resultData.foodItem.nutrition,
          scanType: 'barcode'
        })
          .then(() => fetchScanHistory())
          .catch(err => console.error('Failed to save barcode scan:', err));
      } else {
        toast.error('Product not found in database', { id: scanToastId });
      }
    } catch (error) {
      console.error('Barcode fetch error:', error);
      toast.error('Failed to fetch product data', { id: scanToastId });
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
        'nutrition/log-meal',
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

        // Show motivation based on nutrition
        const p = result.foodItem?.nutrition?.protein || 0;
        const c = result.foodItem?.nutrition?.calories || 0;
        let msg = "Keep it up! You're doing well! 🚀";
        if (p > 25) msg = "Great protein source! Your muscles will thank you! 💪";
        else if (c < 300) msg = "Nice light meal! Perfect for staying on track! ✨";
        else if (c > 800) msg = "Energy powerhouse! Make sure to stay active today! 🔥";

        setTimeout(() => {
          toast(msg, { icon: '🌟', duration: 4000 });
        }, 500);

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
    <>
      <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans selection:bg-[#2FC8B9]/20">
        {/* Hidden File Inputs */}
        <input
          type="file"
          id="gallery-input"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />
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
                  {(!foodInput.trim() && !imagePreview) && (
                    <div className="flex flex-col items-center text-center mb-6 animate-in fade-in zoom-in duration-500">
                      <h2 className="text-xl font-black text-[#1e293b] mb-1">Log Your Meal</h2>
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Select your entry method below</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Compact All-in-one Row for Mobile Space Saving */}
                    <div className="grid grid-cols-3 gap-3 mb-2">
                      {/* Voice Log Button */}
                      <button
                        onClick={toggleVoiceInput}
                        className={`group flex flex-col items-center justify-center p-4 rounded-[2rem] border transition-all active:scale-95 cursor-pointer hover:shadow-xl ${isListening
                          ? 'bg-red-500 border-red-400 shadow-lg shadow-red-500/30 animate-pulse'
                          : 'bg-slate-900 border-slate-800'
                          }`}
                      >
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform ${isListening ? 'bg-white/20' : 'bg-[#2FC8B9]/10'}`}>
                          {isListening ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-[#2FC8B9]" />}
                        </div>
                        <span className="text-[9px] font-black text-white uppercase tracking-tighter">{isListening ? 'Stop' : 'Voice'}</span>
                      </button>

                      {/* Barcode Button */}
                      <button
                        onClick={() => setShowBarcodeScanner(true)}
                        className="group flex flex-col items-center justify-center p-4 bg-white rounded-[2rem] border border-slate-100 shadow-sm transition-all active:scale-95 hover:shadow-lg hover:border-[#2FC8B9]/20"
                      >
                        <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                          <Barcode className="w-5 h-5 text-amber-500" />
                        </div>
                        <span className="text-[9px] font-black text-slate-800 uppercase tracking-tighter">Barcode</span>
                      </button>

                      {/* Gallery/Upload Button */}
                      <label
                        htmlFor="gallery-input"
                        className="group flex flex-col items-center justify-center p-4 bg-white rounded-[2rem] border border-slate-100 shadow-sm transition-all active:scale-95 cursor-pointer hover:shadow-lg hover:border-[#2FC8B9]/20"
                      >
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                          <ImageIcon className="w-5 h-5 text-indigo-500" />
                        </div>
                        <span className="text-[9px] font-black text-slate-800 uppercase tracking-tighter">Gallery</span>
                      </label>
                    </div>

                    {/* Voice Transcript Live Preview */}
                    {isListening && (
                      <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 animate-in fade-in duration-300">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Listening...</span>
                        </div>
                        <p className="text-sm font-bold text-slate-700 min-h-[24px]">
                          {voiceTranscript || 'Say your food item like "2 roti with dal"...'}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-4 py-1">
                      <div className="flex-1 h-[1px] bg-slate-50"></div>
                      <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">or search</span>
                      <div className="flex-1 h-[1px] bg-slate-50"></div>
                    </div>

                    {/* Visual Text Input - Now secondary but prominent */}
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-[#2FC8B9]/5 p-2 rounded-xl border border-[#2FC8B9]/10">
                        <Search className="w-4 h-4 text-[#2FC8B9]" />
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
                        placeholder="Search meal name..."
                        className="w-full pl-14 pr-4 py-4 bg-slate-50/50 border-2 border-transparent rounded-[1.5rem] focus:outline-none focus:border-[#2FC8B9]/30 focus:bg-white transition-all text-sm font-bold text-slate-800 placeholder-slate-400"
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

                  </div>
                </div>
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

                <div id="refine-details" className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.06)] border border-slate-100 space-y-6">
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

            {/* Recent Scans Section - Newly Added & Space Optimized */}
            <div className="space-y-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-lg font-black text-[#1e293b] uppercase tracking-tight">Recent Scans</h3>
                  <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-lg uppercase tracking-widest">
                    {scanHistory.length} Total
                  </span>
                </div>

                {/* Tabs Single Row for Mobile */}
                <div className="flex p-1.5 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto scrollbar-hide">
                  {[
                    { id: 'image', label: 'Uploaded Food', icon: ImageIcon },
                    { id: 'barcode', label: 'Barcode Food', icon: Barcode },
                    { id: 'text', label: 'Searched Food', icon: Search }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all whitespace-nowrap ${activeTab === tab.id
                        ? 'bg-[#2FC8B9] text-white shadow-lg shadow-[#2FC8B9]/20 scale-[1.02]'
                        : 'text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                      <tab.icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-white' : 'text-slate-400'}`} />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Unique List-based UI for Recent Scans */}
              <div className="space-y-3">
                {loadingHistory ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-[#2FC8B9]/30" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading History...</p>
                  </div>
                ) : scanHistory.filter(item => (item.scanType || (item.imageUrl ? 'image' : 'text')) === activeTab).length === 0 ? (
                  <div className="bg-white rounded-[2rem] p-10 text-center border border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 grayscale opacity-50">
                      <History className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">No Recent {activeTab}s</p>
                    <p className="text-[10px] text-slate-300 font-bold">Your logged meals will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {scanHistory
                      .filter(item => (item.scanType || (item.imageUrl ? 'image' : 'text')) === activeTab)
                      .slice(0, 10)
                      .map((item, idx) => (
                        <div
                          key={item._id || idx}
                          className="group bg-white rounded-3xl p-4 border border-slate-100 shadow-sm hover:shadow-xl hover:border-[#2FC8B9]/20 transition-all flex items-center gap-4 cursor-pointer"
                          onClick={() => {
                            // Normalize item to include foodItem structure for the modal
                            const normalizedItem = {
                              ...item,
                              foodItem: item.foodItem || {
                                name: item.foodName,
                                quantity: item.quantity,
                                nutrition: item.nutrition || {
                                  calories: item.calories,
                                  protein: item.protein,
                                  carbs: item.carbs,
                                  fats: item.fats,
                                  fiber: item.fiber,
                                  sugar: item.sugar,
                                  sodium: item.sodium
                                }
                              }
                            };
                            setResult(normalizedItem);
                            setShowResultModal(true);
                          }}
                        >
                          {/* Type Icon */}
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'image' ? 'bg-indigo-50 text-indigo-500' :
                            activeTab === 'barcode' ? 'bg-amber-50 text-amber-500' :
                              'bg-emerald-50 text-[#2FC8B9]'
                            }`}>
                            {activeTab === 'image' ? <ImageIcon className="w-6 h-6" /> :
                              activeTab === 'barcode' ? <Barcode className="w-6 h-6" /> :
                                <Search className="w-6 h-6" />
                            }
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-black text-slate-800 tracking-tight uppercase truncate">
                              {item.foodName || (item.foodItem?.name) || item.query || 'Unnamed Item'}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">
                                {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                              <span className="w-1 h-1 rounded-full bg-slate-200" />
                              <span className="text-[9px] font-black text-[#2FC8B9] uppercase">
                                {(item.nutrition?.calories || item.calories || item.foodItem?.nutrition?.calories || 0)} kcal
                              </span>
                            </div>
                          </div>

                          {/* Score Insight */}
                          <div className={`px-3 py-2 rounded-2xl flex flex-col items-center justify-center min-w-[50px] border ${item.healthScore >= 80 ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                            item.healthScore >= 60 ? 'bg-amber-50 border-amber-100 text-amber-600' :
                              'bg-rose-50 border-rose-100 text-rose-600'
                            }`}>
                            <span className="text-xs font-black leading-none">{item.healthScore || 0}</span>
                            <span className="text-[7px] font-black uppercase tracking-tighter opacity-70">Score</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
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
              <div className="relative p-6 pb-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                  {/* Score & Icon */}
                  <div className="flex items-center gap-5">
                    <div className="relative w-24 h-24 flex-shrink-0">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="44" stroke="#f1f5f9" strokeWidth="8" fill="none" />
                        <circle
                          cx="50" cy="50" r="44"
                          stroke={result.healthScore10 >= 7 ? "#10b981" : result.healthScore10 >= 4 ? "#f59e0b" : "#ef4444"}
                          strokeWidth="8" fill="none"
                          strokeDasharray={276.5}
                          strokeDashoffset={276.5 - (Math.round((result.healthScore10 || (result.healthScore / 10)) * 10) / 100) * 276.5}
                          strokeLinecap="round"
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-black text-slate-800">
                          {Math.round((result.healthScore10 || (result.healthScore / 10)) * 10)}
                        </span>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">/ 100</span>
                      </div>
                    </div>

                    <div>
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest mb-1.5 ${result.isHealthy
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                        }`}>
                        {result.isHealthy ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {result.isHealthy ? 'Healthy' : 'Watch Portions'}
                      </div>
                      <h2 className="text-2xl font-black text-slate-800 leading-tight mb-0.5">
                        {result.foodItem?.name}
                      </h2>
                      <p className="text-slate-500 font-bold flex items-center gap-1.5 uppercase text-[10px] tracking-widest">
                        <Zap className="w-3.5 h-3.5 text-[#2FC8B9]" />
                        {result.foodItem?.quantity || 'Standard Serving'}
                      </p>
                    </div>
                  </div>

                  {/* Closing Cross on Top Right */}
                  <button
                    onClick={resetForm}
                    className="absolute top-6 right-6 p-2 bg-slate-100/80 backdrop-blur-sm text-slate-500 rounded-xl hover:bg-slate-200 transition-all active:scale-95 z-50 shadow-sm border border-white/50"
                  >
                    <X className="w-5 h-5" />
                  </button>
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
              <div className="px-6 mt-6">
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 shadow-inner">
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Calories', value: result.foodItem?.nutrition?.calories, icon: Flame, color: 'text-orange-500', bg: 'bg-orange-100', b: 'border-orange-200' },
                      { label: 'Protein', value: result.foodItem?.nutrition?.protein, icon: Zap, color: 'text-[#2FC8B9]', bg: 'bg-[#2FC8B9]/10', b: 'border-[#2FC8B9]/20' },
                      { label: 'Carbs', value: result.foodItem?.nutrition?.carbs, icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-100', b: 'border-emerald-200' },
                      { label: 'Fats', value: result.foodItem?.nutrition?.fats, icon: Heart, color: 'text-rose-500', bg: 'bg-rose-100', b: 'border-rose-200' }
                    ].map((macro) => {
                      const Icon = macro.icon;
                      return (
                        <div key={macro.label} className="flex flex-col items-center">
                          <div className={`w-10 h-10 rounded-xl ${macro.bg} flex items-center justify-center mb-2 shadow-sm border ${macro.b}`}>
                            <Icon className={`w-5 h-5 ${macro.color}`} />
                          </div>
                          <span className="text-xs font-black text-slate-800">{macro.value || 0}</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{macro.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Small Nutrition List */}
                  <div className="flex flex-wrap justify-center gap-4 mt-4 pt-4 border-t border-slate-200">
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

              {/* Health Intelligence - Compact Side-by-Side Layout */}
              <div className="px-6 py-6 space-y-5">

                {/* Row 1: Health Benefits + Enhancement Tips — Side by Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Health Benefits Card */}
                  <div className="bg-emerald-50/50 rounded-2xl p-5 border border-emerald-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -mr-8 -mt-8" />
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-200 group-hover:rotate-12 transition-transform">
                        <Brain className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-black text-emerald-900 tracking-tight uppercase">Health Benefits</h4>
                    </div>
                    <p className="text-[11px] font-bold text-emerald-800/80 leading-relaxed">
                      {result.healthBenefitsSummary || result.analysis || "This meal provides essential nutrients for your daily requirements."}
                    </p>
                  </div>

                  {/* Enhancement Tips Card */}
                  <div className="bg-amber-50/40 rounded-2xl p-5 border border-amber-100 group">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-xl bg-white border border-amber-100 flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-black text-amber-900 tracking-tight uppercase">Make it Healthier</h4>
                    </div>
                    <div className="space-y-2">
                      {(result.enhancementTips || []).map((tip, i) => (
                        <div key={i} className="bg-white rounded-xl p-2.5 flex items-center gap-3 border border-amber-100 shadow-sm">
                          <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white shrink-0">
                            <Plus className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-black text-slate-800 leading-tight">{typeof tip === 'object' ? tip.name : tip}</p>
                            <p className="text-[9px] font-bold text-slate-500 truncate">{typeof tip === 'object' ? tip.benefit : 'Adds nutritional value'}</p>
                          </div>
                        </div>
                      ))}
                      {(!result.enhancementTips || result.enhancementTips.length === 0) && (
                        <div className="text-center py-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest italic">
                          Already optimal!
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 2: Micronutrients — Compact 3-column grid */}
                <div className="bg-[#2FC8B9]/10 rounded-2xl p-5 border border-[#2FC8B9]/20 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-[#2FC8B9]/20 flex items-center justify-center text-[#2FC8B9]">
                      <Activity className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-xs font-black text-slate-700 tracking-tight uppercase">Micronutrients</h4>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(result.micronutrients || []).map((micro, i) => (
                      <div key={i} className="bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-[#2FC8B9]/10 shadow-sm">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-black text-slate-700 truncate">{typeof micro === 'object' ? micro.name : micro}</span>
                          <span className="text-[9px] font-black text-[#2FC8B9]">{typeof micro === 'object' ? micro.percentage : '--'}%</span>
                        </div>
                        <p className="text-sm font-black text-slate-800 mb-1">{typeof micro === 'object' ? micro.value : '--'}</p>
                        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#2FC8B9] rounded-full transition-all duration-1000"
                            style={{ width: `${typeof micro === 'object' ? micro.percentage : 0}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {(!result.micronutrients || result.micronutrients.length === 0) && (
                      <p className="text-slate-400 text-xs italic p-3 text-center col-span-3">No micronutrient data available</p>
                    )}
                  </div>
                </div>

                {/* Row 3: Analysis Detail — Compact collapsible */}
                <details className="group">
                  <summary className="cursor-pointer text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 select-none hover:text-slate-600 transition-colors">
                    <Info className="w-4 h-4 text-[#2FC8B9]" />
                    Analysis Detail
                    <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90 ml-auto" />
                  </summary>
                  <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm mt-3">
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {result.analysis}
                    </p>
                  </div>
                </details>
              </div>

              {/* Challenges & Alerts */}
              {result.warnings && result.warnings.length > 0 && (
                <div className="px-6 pb-5 space-y-3">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    Nutritional Alerts
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {result.warnings.map((w, i) => (
                      <div key={i} className="bg-rose-50/50 border border-rose-100 rounded-xl p-3 flex items-center gap-3 group">
                        <div className="w-7 h-7 bg-rose-100 rounded-lg flex items-center justify-center shrink-0">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        </div>
                        <p className="text-[11px] font-bold text-rose-900 leading-tight">{w}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Smart Alternatives */}
              {result.alternatives && result.alternatives.length > 0 && (
                <div className="space-y-3 px-6 pb-5">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-emerald-500" />
                    Smart Alternatives
                  </h3>
                  <div className="flex overflow-x-auto scrollbar-hide gap-3 -mx-6 px-6">
                    {result.alternatives.map((alt, i) => (
                      <div key={i} className="min-w-[240px] group bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-lg transition-all">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-slate-800 text-sm leading-tight group-hover:text-emerald-600 transition-colors uppercase tracking-tight truncate">{alt.name}</p>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{alt.prepTime || 'Quick'} Prep</span>
                          </div>
                          <div className="bg-emerald-50 text-emerald-600 text-[10px] font-black px-2 py-1 rounded-lg border border-emerald-100 shrink-0 ml-2">
                            {alt.nutrition?.calories} Kcal
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium leading-snug mb-3 line-clamp-2 italic">
                          "{alt.description}"
                        </p>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                          <div className="px-2 py-0.5 bg-[#2FC8B9]/10 text-[#2FC8B9] text-[8px] font-black rounded-md uppercase">
                            High Prot
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Satiety</span>
                            <span className="text-[11px] font-black text-slate-800">{alt.satietyScore || 8}/10</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Master Actions */}
              <div className="flex gap-3 px-6 pb-6 pt-4">
                <button
                  onClick={resetForm}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                >
                  Discard
                </button>
                <button
                  onClick={handleLogMeal}
                  className="flex-[2] py-4 bg-[#2FC8B9] text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-[0_20px_40px_-12px_rgba(47,200,185,0.3)] hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <CheckCircle className="w-5 h-5 text-white/80" />
                  Log this Meal
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Meal Type Selector Modal */}
      {
        showMealTypeModal && (
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
        )
      }

      {/* Full-Screen Analyzing Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-slate-900 z-[10000] flex items-center justify-center overflow-hidden">
          {/* Animated Background Gradients */}
          <div className="absolute top-0 left-0 w-full h-full">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#2FC8B9]/20 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#2FC8B9]/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>

          <div className="relative text-center px-8 w-full max-w-lg">
            <div className="relative mb-12">
              <div className="w-48 h-48 mx-auto relative">
                <div className="absolute inset-0 border-[3px] border-dashed border-[#2FC8B9]/30 rounded-full animate-spin" style={{ animationDuration: '8s' }}></div>
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

            <div className="mt-8 flex items-center justify-center gap-3">
              <Info className="w-4 h-4 text-[#2FC8B9]/70" />
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-loose">
                DO NOT DISCONNECT · ANALYZING COMPOSITION
              </p>
            </div>
            <style dangerouslySetInnerHTML={{
              __html: `
                @keyframes scan {
                  0% { transform: translateY(-100%); opacity: 0; }
                  50% { opacity: 1; }
                  100% { transform: translateY(100%); opacity: 0; }
                }
              `}} />
          </div>
        </div>
      )}

      {/* Barcode Scanner View */}
      {showBarcodeScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}
    </>
  );
}
