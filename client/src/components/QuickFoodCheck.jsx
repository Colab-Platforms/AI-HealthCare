import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Loader2, Trash2, AlertCircle, CheckCircle, Lightbulb,
  Camera, Upload, X, TrendingUp, TrendingDown, ChefHat, ShoppingBag,
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
  const [showImageTooltip, setShowImageTooltip] = useState(false);

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
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQuickCheck = async () => {
    if (!foodInput.trim() && !image) {
      toast.error('Please enter a food item or upload an image');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      let imageBase64 = null;
      if (image) {
        const reader = new FileReader();
        imageBase64 = await new Promise((resolve, reject) => {
          reader.onloadend = () => {
            resolve(reader.result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(image);
        });
      }

      const response = await axios.post(
        '/api/nutrition/quick-check',
        {
          foodDescription: foodInput || undefined,
          imageBase64,
          additionalContext: foodInput || undefined
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setResult(response.data.data);
      setFoodInput('');
      setImage(null);
      setImagePreview(null);
      setShowQuantitySuggestion(false);
      toast.success('Food analyzed and saved!');
      fetchHistory();
    } catch (error) {
      console.error('Quick check error:', error);
      toast.error(error.response?.data?.message || 'Failed to analyze food');
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
    <div className="space-y-4">
      {/* Main Quick Check Card */}
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-3xl p-6 shadow-lg border border-blue-100">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center">
            <Lightbulb className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Quick Check</h2>
            <p className="text-sm text-gray-600">Analyze any food instantly</p>
          </div>
        </div>

        {/* Food Input Section */}
        <div className="space-y-4">
          {/* Main Input */}
          <div className="relative">
            <input
              type="text"
              value={foodInput}
              onChange={handleFoodInputChange}
              placeholder="What did you eat? e.g., Pizza, Chicken..."
              className="w-full px-5 py-4 bg-white border-2 border-blue-200 rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900 placeholder-gray-500 font-medium transition-all"
            />
            {foodInput && (
              <button
                onClick={() => {
                  setFoodInput('');
                  setShowQuantitySuggestion(false);
                  setShowPrepMethod(false);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            )}
          </div>

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
          <div className="grid grid-cols-2 gap-3">
            {/* Image Upload - Disabled */}
            <div className="relative group">
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-4 bg-gray-100 border-2 border-dashed border-gray-300 rounded-2xl cursor-not-allowed opacity-60">
                <div className="relative">
                  <Camera className="w-6 h-6 text-gray-400" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full flex items-center justify-center text-[10px] font-bold text-white">!</span>
                </div>
                <span className="text-xs font-semibold text-gray-500">Photo</span>
              </div>
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Coming soon - Enter manually for now
              </div>
            </div>

            {/* Check Button */}
            <button
              onClick={handleQuickCheck}
              disabled={loading || (!foodInput.trim() && !image)}
              className="px-4 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-2xl font-bold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="hidden sm:inline">Checking...</span>
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  <span className="hidden sm:inline">Check</span>
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
              <p className="text-2xl font-bold text-gray-900 mt-1">{result.foodItem?.nutrition?.calories || 0}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-2 border-red-100 text-center">
              <Heart className="w-6 h-6 text-red-500 mx-auto mb-2" />
              <p className="text-xs text-gray-600 font-medium">Protein</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{result.foodItem?.nutrition?.protein || 0}g</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-2 border-yellow-100 text-center">
              <Zap className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
              <p className="text-xs text-gray-600 font-medium">Carbs</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{result.foodItem?.nutrition?.carbs || 0}g</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border-2 border-blue-100 text-center">
              <Lightbulb className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-xs text-gray-600 font-medium">Fats</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{result.foodItem?.nutrition?.fats || 0}g</p>
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
    </div>
  );
}
