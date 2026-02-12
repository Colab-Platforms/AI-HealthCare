import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Loader2, Trash2, AlertCircle, CheckCircle, Lightbulb,
  Camera, X, ChefHat,
  Flame, Zap, Heart, Info, History
} from 'lucide-react';

export default function QuickFoodCheck() {
  const [foodInput, setFoodInput] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showQuantitySuggestion, setShowQuantitySuggestion] = useState(false);
  const [quantitySuggestion, setQuantitySuggestion] = useState('');
  const [showPrepMethod, setShowPrepMethod] = useState(false);
  const [prepMethod, setPrepMethod] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showImageDetailsForm, setShowImageDetailsForm] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [imageDetails, setImageDetails] = useState({
    quantity: '',
    prepMethod: '',
    additionalInfo: ''
  });

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const today = new Date().toISOString().split('T')[0];
      const response = await axios.get(
        `/api/nutrition/quick-checks/history/date?date=${today}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setHistory(response.data.stats?.checks || []);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const getQuantitySuggestion = (text) => {
    const lowerText = text.toLowerCase();
    
    // Check if quantity already mentioned
    const hasQuantity = /\d+/.test(lowerText) || 
                       ['bowl', 'plate', 'cup', 'glass', 'slice', 'piece', 'gram', 'kg', 'ml', 'litre'].some(q => lowerText.includes(q));
    
    if (hasQuantity) return { show: false, text: '' };

    // Liquids
    const liquids = ['juice', 'milk', 'water', 'tea', 'coffee', 'smoothie', 'shake', 'lassi', 'soup', 'dal', 'curry'];
    if (liquids.some(l => lowerText.includes(l))) {
      return { show: true, text: '💡 Add quantity: e.g., 250ml, 1 glass, 2 cups' };
    }

    // Sliced items
    const sliced = ['pizza', 'bread', 'toast', 'cake', 'sandwich', 'paratha', 'naan'];
    if (sliced.some(s => lowerText.includes(s))) {
      return { show: true, text: '💡 Add quantity: e.g., 2 slices, 1 piece' };
    }

    // Weight-based
    const weighted = ['rice', 'roti', 'chicken', 'fish', 'meat', 'paneer', 'vegetables', 'pasta', 'biryani'];
    if (weighted.some(w => lowerText.includes(w))) {
      return { show: true, text: '💡 Add quantity: e.g., 100g, 1 bowl, 1 plate' };
    }

    // Countable
    const countable = ['egg', 'banana', 'apple', 'samosa', 'pakora', 'biscuit', 'idli', 'dosa'];
    if (countable.some(c => lowerText.includes(c))) {
      return { show: true, text: '💡 Add quantity: e.g., 2 pieces, 1 banana' };
    }

    return { show: true, text: '💡 Add quantity for accurate results: e.g., 100g, 1 bowl, 2 pieces, 250ml' };
  };

  const getPrepMethodSuggestion = (text) => {
    const lowerText = text.toLowerCase();
    
    // Check if prep method already mentioned
    const hasPrepMethod = ['grilled', 'fried', 'baked', 'boiled', 'steamed', 'roasted', 'raw', 'cooked', 'homemade', 'restaurant', 'packaged', 'frozen'].some(m => lowerText.includes(m));
    
    if (hasPrepMethod) return { show: false };

    // Foods that benefit from prep method info
    const needsPrepInfo = ['chicken', 'fish', 'meat', 'egg', 'potato', 'vegetables', 'rice', 'noodles', 'samosa', 'pakora', 'fries', 'chips'];
    if (needsPrepInfo.some(f => lowerText.includes(f))) {
      return { show: true };
    }

    return { show: false };
  };

  const handleFoodInputChange = (e) => {
    const value = e.target.value;
    setFoodInput(value);
    
    if (value.length >= 3) {
      const suggestion = getQuantitySuggestion(value);
      setShowQuantitySuggestion(suggestion.show);
      setQuantitySuggestion(suggestion.text);

      // Check if we should ask about prep method
      const prepSuggestion = getPrepMethodSuggestion(value);
      setShowPrepMethod(prepSuggestion.show);
    } else {
      setShowQuantitySuggestion(false);
      setShowPrepMethod(false);
    }
  };

  const handleImageSelect = (e) => {
    e.preventDefault(); // Prevent form submission/page refresh
    e.stopPropagation(); // Stop event bubbling
    
    const file = e.target.files[0];
    if (file) {
      // Validate file size (max 3MB)
      if (file.size > 3 * 1024 * 1024) {
        toast.error('Image too large. Please use a smaller image (max 3MB)');
        return;
      }
      
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setShowImageDetailsForm(true); // Show form when image is selected
      };
      reader.readAsDataURL(file);
    }
    
    // Reset the input value so the same file can be selected again
    e.target.value = '';
  };

  const handleQuickCheck = async () => {
    if (!foodInput.trim() && !image) {
      toast.error('Please enter a food item or upload an image');
      return;
    }

    // If image is uploaded but no details provided, show warning
    if (image && !imageDetails.quantity && !imageDetails.prepMethod) {
      toast.error('Please provide quantity and preparation method for the image');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Convert image to base64 if present
      let imageBase64 = null;
      if (image) {
        const reader = new FileReader();
        imageBase64 = await new Promise((resolve, reject) => {
          reader.onloadend = () => {
            // Remove the data:image/...;base64, prefix
            const base64 = reader.result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(image);
        });
      }

      // Build context from image details
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

      console.log('Sending request:', {
        hasImage: !!imageBase64,
        imageSize: imageBase64 ? `${(imageBase64.length * 0.75 / 1024).toFixed(2)} KB` : 'N/A',
        context: contextText
      });

      const response = await axios.post(
        '/api/nutrition/quick-check',
        {
          foodDescription: foodInput || 'Food from image',
          imageBase64: imageBase64,
          additionalContext: contextText
        },
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000 // 60 seconds for image analysis
        }
      );

      setResult(response.data.data);
      setFoodInput('');
      setImage(null);
      setImagePreview(null);
      setShowQuantitySuggestion(false);
      setShowImageDetailsForm(false);
      setImageDetails({ quantity: '', prepMethod: '', additionalInfo: '' });
      toast.success('Food analyzed and saved!');
      fetchHistory();
    } catch (error) {
      console.error('Quick check error:', error);
      console.error('Error response:', error.response?.data);
      
      // Check if AI couldn't detect food in image
      if (error.response?.status === 400 && error.response?.data?.error === 'UNABLE_TO_DETECT_FOOD') {
        // Clear image and show helpful message
        setImage(null);
        setImagePreview(null);
        setShowImageDetailsForm(false);
        
        // Keep quantity and prep method if user provided them
        // (don't reset imageDetails completely)
        
        toast.error('Could not detect food in image. Please type the food name above for accurate results.', {
          duration: 5000
        });
        
        // Focus the food input field
        setTimeout(() => {
          const foodInputElement = document.querySelector('input[placeholder*="What did you eat"]');
          if (foodInputElement) {
            foodInputElement.focus();
          }
        }, 100);
      } else if (error.code === 'ECONNABORTED') {
        toast.error('Request timeout. The image analysis took too long. Please try again or use text description.');
      } else if (error.response?.status === 413) {
        toast.error('Image too large. Please use a smaller image.');
      } else {
        toast.error(error.response?.data?.message || 'Failed to analyze food. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleHistoryItemClick = (check) => {
    setResult({
      foodItem: {
        name: check.foodName,
        quantity: check.quantity || '',
        nutrition: {
          calories: check.calories || 0,
          protein: check.protein || 0,
          carbs: check.carbs || 0,
          fats: check.fats || 0
        }
      },
      isHealthy: check.isHealthy,
      healthScore: check.healthScore,
      analysis: check.analysis || 'Previously analyzed food item',
      warnings: check.warnings || [],
      alternatives: check.alternatives || []
    });
    setShowHistory(false);
  };

  const deleteFromHistory = async (id) => {
    if (!confirm('Delete this food check?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/nutrition/quick-checks/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Deleted');
      fetchHistory();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Main Quick Check Card */}
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg border border-blue-100">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
            <Lightbulb className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Quick Check</h2>
            <p className="text-xs sm:text-sm text-gray-600">Analyze any food instantly</p>
          </div>
        </div>

        {/* Food Input Section */}
        <div className="space-y-3 sm:space-y-4">
          {/* Main Input with Camera Icon */}
          <div className="relative">
            <input
              type="text"
              value={foodInput}
              onChange={handleFoodInputChange}
              placeholder="What did you eat? e.g., Pizza, Chicken..."
              className="w-full px-4 sm:px-5 py-3 sm:py-4 pr-12 sm:pr-14 bg-white border-2 border-blue-200 rounded-xl sm:rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900 placeholder-gray-500 text-sm sm:text-base font-medium transition-all"
            />
            {/* Camera Icon - Opens Modal */}
            <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setShowCameraModal(true)}
                className="p-1.5 sm:p-2 text-cyan-600 hover:bg-cyan-50 rounded-lg transition relative group"
              >
                <Camera className="w-5 h-5" />
                {/* Tooltip - Hidden on mobile */}
                <div className="hidden sm:block absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  Upload or capture food
                </div>
              </button>
              {foodInput && (
                <button
                  onClick={() => {
                    setFoodInput('');
                    setShowQuantitySuggestion(false);
                    setShowPrepMethod(false);
                  }}
                  className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* Image Preview - Mobile Optimized */}
          {imagePreview && (
            <div className="relative bg-white border-2 border-cyan-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-3 sm:gap-4">
                <img 
                  src={imagePreview} 
                  alt="Food preview" 
                  className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg sm:rounded-xl border-2 border-cyan-300 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-cyan-900 mb-1">📸 Image Ready for AI Analysis</p>
                  <p className="text-xs text-cyan-700">AI will analyze the food in this image</p>
                  <p className="text-xs text-purple-600 font-semibold mt-1 sm:mt-2">
                    👇 Add details below for better accuracy
                  </p>
                </div>
                <button
                  onClick={() => {
                    setImage(null);
                    setImagePreview(null);
                    setShowImageDetailsForm(false);
                    setImageDetails({ quantity: '', prepMethod: '', additionalInfo: '' });
                  }}
                  className="p-1.5 sm:p-2 hover:bg-red-50 rounded-lg transition text-red-500 flex-shrink-0"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Image Details Form - Mobile Optimized */}
          {showImageDetailsForm && imagePreview && (
            <div className="bg-white border-2 border-purple-200 rounded-xl sm:rounded-2xl p-4 sm:p-5 animate-in fade-in slide-in-from-top-2">
              <p className="text-sm font-bold text-purple-900 mb-3 sm:mb-4 flex items-center gap-2">
                <ChefHat className="w-4 h-4 sm:w-5 sm:h-5" />
                Tell us more for accurate results
              </p>
              
              {/* Quantity Input */}
              <div className="mb-3 sm:mb-4">
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Quantity (e.g., "2 pieces", "1 bowl", "100g")
                </label>
                <input
                  type="text"
                  value={imageDetails.quantity}
                  onChange={(e) => setImageDetails({ ...imageDetails, quantity: e.target.value })}
                  placeholder="How much did you eat?"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 border-2 border-gray-200 rounded-lg sm:rounded-xl focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 text-sm sm:text-base text-gray-900 placeholder-gray-500"
                />
              </div>

              {/* Preparation Method */}
              <div className="mb-3 sm:mb-4">
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  How was it prepared?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Fried', icon: '🍳' },
                    { label: 'Baked', icon: '🥐' },
                    { label: 'Grilled', icon: '🔥' },
                    { label: 'Homemade', icon: '🏠' },
                    { label: 'Restaurant', icon: '🍽️' },
                    { label: 'Packaged', icon: '📦' }
                  ].map((method) => (
                    <button
                      key={method.label}
                      type="button"
                      onClick={() => setImageDetails({ ...imageDetails, prepMethod: method.label })}
                      className={`flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl text-xs font-medium transition-all ${
                        imageDetails.prepMethod === method.label
                          ? 'bg-purple-500 text-white shadow-md'
                          : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                      }`}
                    >
                      <span className="text-lg">{method.icon}</span>
                      <span className="text-[10px] sm:text-xs leading-tight">{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional Info */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Additional details (optional)
                </label>
                <input
                  type="text"
                  value={imageDetails.additionalInfo}
                  onChange={(e) => setImageDetails({ ...imageDetails, additionalInfo: e.target.value })}
                  placeholder="e.g., with cheese, extra spicy, etc."
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 border-2 border-gray-200 rounded-lg sm:rounded-xl focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 text-sm sm:text-base text-gray-900 placeholder-gray-500"
                />
              </div>

              {/* Info Note */}
              <div className="mt-3 sm:mt-4 flex items-start gap-2 bg-purple-50 rounded-lg sm:rounded-xl p-2.5 sm:p-3">
                <Info className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] sm:text-xs text-purple-700 leading-snug">
                  These details help AI provide more accurate nutritional information
                </p>
              </div>
            </div>
          )}

          {/* Quantity Suggestion */}
          {showQuantitySuggestion && (
            <div className="bg-white border-2 border-amber-200 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <Zap className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900 mb-1">Add Quantity</p>
                <p className="text-sm text-amber-700">{quantitySuggestion}</p>
              </div>
            </div>
          )}

          {/* Prep Method Suggestion */}
          {showPrepMethod && (
            <div className="bg-white border-2 border-purple-200 rounded-2xl p-4 animate-in fade-in slide-in-from-top-2">
              <p className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
                <ChefHat className="w-4 h-4" />
                How was it prepared?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Homemade', icon: '🏠' },
                  { label: 'Restaurant', icon: '🍽️' },
                  { label: 'Packaged', icon: '📦' },
                  { label: 'Grilled', icon: '🔥' },
                  { label: 'Fried', icon: '🍳' },
                  { label: 'Baked', icon: '🥐' }
                ].map((method) => (
                  <button
                    key={method.label}
                    onClick={() => {
                      setPrepMethod(method.label);
                      setShowPrepMethod(false);
                    }}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      prepMethod === method.label
                        ? 'bg-purple-500 text-white'
                        : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                    }`}
                  >
                    {method.icon} {method.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Image Upload & Check Button */}
          <div className="grid grid-cols-1 gap-3">
            {/* Check Button - Improved */}
            <button
              onClick={handleQuickCheck}
              disabled={loading || (!foodInput.trim() && !image)}
              className="px-4 py-4 bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-600 text-white rounded-2xl font-bold hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="hidden sm:inline">Analyzing...</span>
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  <span className="hidden sm:inline">Analyze Food</span>
                  <span className="sm:hidden">Check</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Result Display */}
      {result && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          {/* Health Score Card */}
          <div className={`rounded-3xl p-6 shadow-lg border-2 ${
            result.isHealthy 
              ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' 
              : 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{result.foodItem?.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{result.foodItem?.quantity}</p>
                {prepMethod && <p className="text-xs text-gray-500 mt-1">📍 {prepMethod}</p>}
              </div>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-xl ${
                result.isHealthy 
                  ? 'bg-green-500 text-white' 
                  : 'bg-red-500 text-white'
              }`}>
                {result.healthScore}
              </div>
            </div>

            {/* Status Badge */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm ${
              result.isHealthy
                ? 'bg-green-200 text-green-800'
                : 'bg-red-200 text-red-800'
            }`}>
              {result.isHealthy ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Healthy Choice
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4" />
                  Not Ideal
                </>
              )}
            </div>
          </div>

          {/* Nutrition Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl p-4 border-2 border-orange-100 text-center">
              <Flame className="w-6 h-6 text-orange-500 mx-auto mb-2" />
              <p className="text-xs text-gray-600 font-medium">Calories</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {result.foodItem?.nutritionRanges?.calories || result.foodItem?.nutrition?.calories || 0}
              </p>
              {result.foodItem?.nutritionRanges?.calories && <p className="text-xs text-gray-500">kcal</p>}
            </div>
            <div className="bg-white rounded-2xl p-4 border-2 border-red-100 text-center">
              <Heart className="w-6 h-6 text-red-500 mx-auto mb-2" />
              <p className="text-xs text-gray-600 font-medium">Protein</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {result.foodItem?.nutritionRanges?.protein || result.foodItem?.nutrition?.protein || 0}g
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-2 border-yellow-100 text-center">
              <Zap className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
              <p className="text-xs text-gray-600 font-medium">Carbs</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {result.foodItem?.nutritionRanges?.carbs || result.foodItem?.nutrition?.carbs || 0}g
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-2 border-blue-100 text-center">
              <Lightbulb className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-xs text-gray-600 font-medium">Fats</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {result.foodItem?.nutritionRanges?.fats || result.foodItem?.nutrition?.fats || 0}g
              </p>
            </div>
          </div>

          {/* Analysis */}
          <div className="bg-white rounded-2xl p-5 border-2 border-gray-200">
            <p className="text-gray-700 leading-relaxed">{result.analysis}</p>
          </div>

          {/* Warnings */}
          {result.warnings && result.warnings.length > 0 && (
            <div className="bg-red-50 rounded-2xl p-5 border-2 border-red-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-900 mb-2">⚠️ Watch Out</p>
                  <ul className="space-y-1">
                    {result.warnings.map((w, i) => (
                      <li key={i} className="text-sm text-red-700">• {w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Healthy Alternatives */}
          {result.alternatives && result.alternatives.length > 0 && (
            <div className="bg-green-50 rounded-2xl p-5 border-2 border-green-200">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-6 h-6 text-green-600" />
                <h4 className="font-bold text-green-900">✨ Better Options</h4>
              </div>
              <div className="space-y-3">
                {result.alternatives.slice(0, 3).map((alt, i) => (
                  <div key={i} className="bg-white rounded-xl p-4 border border-green-200">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-bold text-green-900">{alt.name}</p>
                      <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded-lg">
                        {alt.nutrition?.calories} cal
                      </span>
                    </div>
                    <p className="text-sm text-green-700 mb-2">{alt.description}</p>
                    <div className="flex gap-2 text-xs text-green-600 font-medium">
                      <span>P: {alt.nutrition?.protein}g</span>
                      <span>C: {alt.nutrition?.carbs}g</span>
                      <span>F: {alt.nutrition?.fats}g</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              setResult(null);
              setPrepMethod(null);
            }}
            className="w-full py-3 bg-gray-200 text-gray-900 rounded-2xl font-bold hover:bg-gray-300 transition-all"
          >
            Clear
          </button>
        </div>
      )}

      {/* History Section */}
      <div className="bg-white rounded-3xl p-6 shadow-lg border-2 border-gray-200">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between mb-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <History className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-gray-900">Today's Checks</h3>
              <p className="text-xs text-gray-600">{history.length} items</p>
            </div>
          </div>
          <span className={`text-2xl text-gray-400 transition-transform ${showHistory ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>

        {showHistory && (
          <div className="space-y-2 border-t-2 border-gray-200 pt-4">
            {history.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No checks yet today</p>
            ) : (
              history.map((check) => (
                <button
                  key={check._id}
                  onClick={() => handleHistoryItemClick(check)}
                  className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl hover:from-blue-100 hover:to-cyan-100 transition-all text-left"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{check.foodName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                        check.isHealthy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {check.healthScore}/100
                      </span>
                      <span className="text-xs text-gray-500">
                        {check.calories} cal
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(check.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFromHistory(check._id);
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition ml-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Camera/Gallery Modal */}
      {showCameraModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            // Close modal when clicking backdrop
            if (e.target === e.currentTarget) {
              e.preventDefault();
              e.stopPropagation();
              setShowCameraModal(false);
            }
          }}
          onTouchStart={(e) => {
            // Prevent any touch events from bubbling
            if (e.target === e.currentTarget) {
              e.stopPropagation();
            }
          }}
        >
          <div 
            className="bg-white rounded-3xl p-6 max-w-sm w-full animate-in fade-in slide-in-from-bottom-4"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Choose Image Source</h3>
            <div className="space-y-3">
              {/* Camera Option */}
              <div 
                className="cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Trigger file input click
                  const input = document.getElementById('camera-input');
                  if (input) input.click();
                }}
              >
                <input
                  id="camera-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleImageSelect(e);
                    setShowCameraModal(false);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="hidden"
                  style={{ display: 'none' }}
                />
                <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-cyan-50 to-blue-50 border-2 border-cyan-200 rounded-2xl hover:border-cyan-400 transition-all">
                  <div className="w-12 h-12 bg-cyan-500 rounded-xl flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">Take Photo</p>
                    <p className="text-sm text-gray-600">Use camera to capture food</p>
                  </div>
                </div>
              </div>

              {/* Gallery Option */}
              <div 
                className="cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Trigger file input click
                  const input = document.getElementById('gallery-input');
                  if (input) input.click();
                }}
              >
                <input
                  id="gallery-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleImageSelect(e);
                    setShowCameraModal(false);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="hidden"
                  style={{ display: 'none' }}
                />
                <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl hover:border-purple-400 transition-all">
                  <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">Choose from Gallery</p>
                    <p className="text-sm text-gray-600">Select existing photo</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowCameraModal(false);
              }}
              className="w-full mt-4 py-3 bg-gray-200 text-gray-900 rounded-2xl font-bold hover:bg-gray-300 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
