import { useState, useEffect } from 'react';
import { X, Plus, Sparkles, Loader2, CheckCircle, AlertCircle, Target, Activity, Heart, ShieldCheck, Zap, Coffee, Sun, Utensils } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const Moon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

const MEAL_TABS = [
  { id: 'breakfast', label: 'Breakfast', emoji: '🍳', icon: Coffee, suggestions: ['Oats', 'Eggs', 'Smoothie', 'Idli', 'Poha', 'Paratha', 'Upma', 'Dosa', 'Toast', 'Fruits'] },
  { id: 'lunch', label: 'Lunch', emoji: '🥗', icon: Utensils, suggestions: ['Rice', 'Roti', 'Dal', 'Chicken', 'Paneer', 'Salad', 'Fish', 'Rajma', 'Curry', 'Biryani'] },
  { id: 'snacks', label: 'Snacks', emoji: '🍎', icon: Sun, suggestions: ['Nuts', 'Fruits', 'Yogurt', 'Sprouts', 'Makhana', 'Peanuts', 'Chana', 'Granola', 'Seeds'] },
  { id: 'dinner', label: 'Dinner', emoji: '🌙', icon: Moon, suggestions: ['Soup', 'Grilled Fish', 'Khichdi', 'Tofu', 'Vegetables', 'Chapati', 'Moong Dal', 'Stir Fry'] },
  { id: 'general', label: 'General', emoji: '⭐', icon: Sparkles, subTabs: [
    { id: 'preferredFoods', label: 'Preferred', icon: Heart, suggestions: ['Green Tea', 'Honey', 'Lemon', 'Spices', 'Herbs', 'Dry Fruits'] },
    { id: 'foodsToAvoid', label: 'To Avoid', icon: AlertCircle, suggestions: ['Sugar', 'White Bread', 'Fried Food', 'Soda', 'Processed Meat'] },
    { id: 'dietaryRestrictions', label: 'Restrictions', icon: ShieldCheck, suggestions: ['Gluten-free', 'Dairy-free', 'Nut-free', 'Low Sodium', 'Low Carb'] }
  ]}
];

const UNHEALTHY_KEYWORDS = [
  'burger', 'pizza', 'fries', 'french fries', 'soda', 'coke', 'pepsi', 
  'chips', 'crisps', 'fried', 'donuts', 'doughnuts', 'cake', 'brownie', 
  'candy', 'sweets', 'ice cream', 'hot dog', 'processed', 'nachos', 
  'cola', 'energy drink', 'deep fried', 'nuggets', 'sausage', 'bacon',
  'maggie', 'instant noodles', 'pasta white', 'maida', 'junk',
  'samosa', 'pakora', 'bhajiya', 'jalebi', 'gulab jamun', 'bhature', 
  'puri', 'kachori', 'vada pav', 'misal pav', 'pav bhaji', 'naan', 
  'paratha aloo', 'biryani oily', 'chowmein', 'manchurian'
];

const HEALTHY_ALTERNATIVES = {
  'burger': 'Veggie Wrap or Paneer Sandwich',
  'pizza': 'Whole Wheat Pizza or Flatbread',
  'fries': 'Baked Sweet Potato Fries or Roasted Makhana',
  'soda': 'Lemon Water or Fruit Infused Water',
  'chips': 'Air-fried Kale Chips or Roasted Chana',
  'cola': 'Cold Pressed Juice or Coconut Water',
  'fried': 'Air-fried or Grilled version',
  'maggie': 'Whole Wheat Noodles or Oats Maggi',
  'sweets': 'Fresh Fruits or Dates',
  'ice cream': 'Frozen Yogurt or Fruit Sorbet',
  'white bread': 'Whole Wheat or Multigrain Bread',
  'cake': 'Sugar-free Oat Muffins',
  'donut': 'Whole Wheat Baked Rings',
  'samosa': 'Baked Samosa or Air-fried Khakra',
  'pakora': 'Air-fried Pakora or Grilled Paneer',
  'jalebi': 'Fresh Steamed Yogurt (Bhapa Doi)',
  'gulab jamun': 'Dry Fruit Ladoo or Honey Glazed Dates',
  'bhature': 'Whole Wheat Roti or Baked Kulcha',
  'puri': 'Baked Whole Wheat Puri or Chapatis',
  'kachori': 'Baked Whole Wheat Kachori',
  'vada pav': 'Whole Wheat Pav with Grilled Vada',
  'pav bhaji': 'Whole Wheat Pav with vegetable-rich Bhaji',
  'manchurian': 'Steamed Cabbage Dumplings or Stir-fried Veggies',
  'chowmein': 'Zucchini Noodles or Whole Wheat Chowmein'
};

const HIGH_SUGAR_KEYWORDS = [
  'sugar', 'sweet', 'candy', 'jalebi', 'gulab jamun', 'cake', 'brownie', 
  'ice cream', 'dessert', 'halwa', 'ladoo', 'laddu', 'barfi', 'kheer',
  'rasgulla', 'soda', 'coke', 'pepsi', 'juice sugary', 'syrup'
];

const DIABETIC_ALTERNATIVES = {
  'sweet': 'Stevia-based dessert or Fresh Berries',
  'sugar': 'Stevia, Monk Fruit, or Erythritol',
  'jalebi': 'Sugar-free Apple Slices with Cinnamon',
  'gulab jamun': 'Steamed Yogurt with Cardamom',
  'halwa': 'Sugar-free Moong Dal Sheera (Small portion)',
  'dessert': 'Sugar-free Chia Pudding or Greek Yogurt',
  'soda': 'Unsweetened Iced Tea or Seltzer Water'
};

export default function FoodPreferences({ onClose, onGenerate, mode = 'save' }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('breakfast');
  const [activeGeneralTab, setActiveGeneralTab] = useState('preferredFoods');
  const [hasChanges, setHasChanges] = useState(false);
  const [preferences, setPreferences] = useState({
    preferredFoods: [],
    foodsToAvoid: [],
    dietaryRestrictions: [],
    mealPreferences: {
      breakfast: [],
      lunch: [],
      snacks: [],
      dinner: []
    }
  });
  const [inputValues, setInputValues] = useState({
    breakfast: '',
    lunch: '',
    snacks: '',
    dinner: '',
    preferredFoods: '',
    foodsToAvoid: '',
    dietaryRestrictions: ''
  });
  const [healthWarning, setHealthWarning] = useState(null); // { food: '', alternative: '', type: '', isSuggestion: false }

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await api.get('users/food-preferences');
      if (response.data.success) {
        const data = response.data.data;
        setPreferences({
          ...data,
          preferredFoods: data.preferredFoods || [],
          foodsToAvoid: data.foodsToAvoid || [],
          dietaryRestrictions: data.dietaryRestrictions || [],
          mealPreferences: data.mealPreferences || {
            breakfast: [],
            lunch: [],
            snacks: [],
            dinner: []
          }
        });
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    try {
      // Automatically add current input value if not empty before saving
      const currentInput = inputValues[currentCategory];
      if (currentInput && currentInput.trim()) {
        addItem(currentCategory);
      }

      console.log('Saving preferences:', preferences);
      const response = await api.post('users/food-preferences', preferences);
      if (response.data.success) {
        toast.success('Preferences saved!');
        setHasChanges(false);
        return true;
      }
    } catch (error) {
      toast.error('Failed to save preferences');
      return false;
    }
  };

  const addItem = (type, forced = false) => {
    const value = inputValues[type]?.trim();
    if (!value) return;

    // Check for unhealthy food (but allow it in "To Avoid" section)
    if (!forced && type !== 'foodsToAvoid') {
      const lowerVal = value.toLowerCase();
      
      // DIABETES SPECIFIC GUARD
      const isDiabetic = user?.profile?.medicalHistory?.conditions?.some(c => c.toLowerCase().includes('diabetes')) || 
                         user?.profile?.diabetesProfile?.type;
      
      const matchedSugarKey = HIGH_SUGAR_KEYWORDS.find(k => lowerVal.includes(k));
      
      if (isDiabetic && matchedSugarKey) {
        setHealthWarning({ 
          food: value, 
          alternative: DIABETIC_ALTERNATIVES[matchedSugarKey] || 'a low-glycemic, sugar-free version',
          type,
          isSuggestion: false,
          isClinical: true // More serious warning
        });
        return;
      }

      const matchedKey = UNHEALTHY_KEYWORDS.find(k => lowerVal.includes(k));
      if (matchedKey) {
        setHealthWarning({ 
          food: value, 
          alternative: HEALTHY_ALTERNATIVES[matchedKey] || 'a healthier high-fiber version',
          type,
          isSuggestion: false,
          isClinical: false
        });
        return;
      }
    }

    if (activeTab === 'general') {
      const current = preferences[type] || [];
      if (current.includes(value)) {
        toast.error('Already added');
        return;
      }
      setPreferences(prev => ({
        ...prev,
        [type]: [...(prev[type] || []), value]
      }));
      setHasChanges(true);
    } else {
      const current = preferences.mealPreferences?.[type] || [];
      if (current.includes(value)) {
        toast.error('Already added');
        return;
      }
      setPreferences(prev => ({
        ...prev,
        mealPreferences: {
          ...prev.mealPreferences,
          [type]: [...(prev.mealPreferences?.[type] || []), value]
        }
      }));
      setHasChanges(true);
    }
    setInputValues(prev => ({ ...prev, [type]: '' }));
  };

  const addSuggestion = (type, food, forced = false) => {
    // Check for unhealthy selection (skip check for "To Avoid" category)
    if (!forced && type !== 'foodsToAvoid') {
      const lowerVal = food.toLowerCase();
      
      // DIABETES SPECIFIC GUARD
      const isDiabetic = user?.profile?.medicalHistory?.conditions?.some(c => c.toLowerCase().includes('diabetes')) || 
                         user?.profile?.diabetesProfile?.type;
      
      const matchedSugarKey = HIGH_SUGAR_KEYWORDS.find(k => lowerVal.includes(k));
      
      if (isDiabetic && matchedSugarKey) {
        setHealthWarning({ 
          food: food, 
          alternative: DIABETIC_ALTERNATIVES[matchedSugarKey] || 'a low-GI alternative',
          type,
          isSuggestion: true,
          isClinical: true
        });
        return;
      }

      const matchedKey = UNHEALTHY_KEYWORDS.find(k => lowerVal.includes(k));
      if (matchedKey) {
        setHealthWarning({ 
          food: food, 
          alternative: HEALTHY_ALTERNATIVES[matchedKey] || 'a healthier choice',
          type,
          isSuggestion: true,
          isClinical: false
        });
        return;
      }
    }

    if (activeTab === 'general') {
      const current = preferences[type] || [];
      if (current.includes(food)) return;
      setPreferences(prev => ({
        ...prev,
        [type]: [...(prev[type] || []), food]
      }));
      setHasChanges(true);
    } else {
      const current = preferences.mealPreferences?.[type] || [];
      if (current.includes(food)) return;
      setPreferences(prev => ({
        ...prev,
        mealPreferences: {
          ...prev.mealPreferences,
          [type]: [...(prev.mealPreferences?.[type] || []), food]
        }
      }));
      setHasChanges(true);
    }
  };

  const handleHandleWarning = (action) => {
    const { food, alternative, type, isSuggestion } = healthWarning;
    
    if (action === 'keep') {
      // User chooses to keep unhealthy food
      if (isSuggestion) addSuggestion(type, food, true);
      else addItem(type, true);
    } else if (action === 'replace') {
      // User chooses to replace with healthy alternative
      if (isSuggestion) addSuggestion(type, alternative, true);
      else {
        setInputValues(prev => ({ ...prev, [type]: alternative }));
        // Delay to ensure state update for input values
        setTimeout(() => addItem(type, true), 10);
      }
      toast.success('Smart Choice! 🌿');
    }
    setHealthWarning(null);
  };

  const removeItem = (type, index) => {
    if (activeTab === 'general') {
      setPreferences(prev => ({
        ...prev,
        [type]: (prev[type] || []).filter((_, i) => i !== index)
      }));
      setHasChanges(true);
    } else {
      setPreferences(prev => ({
        ...prev,
        mealPreferences: {
          ...prev.mealPreferences,
          [type]: (prev.mealPreferences?.[type] || []).filter((_, i) => i !== index)
        }
      }));
      setHasChanges(true);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#1a2e35]/40 backdrop-blur-md z-[110] flex items-center justify-center p-4">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-100" />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-full border-4 border-[#69A38D] border-t-transparent"
          />
          <Activity className="absolute inset-0 m-auto w-8 h-8 text-[#69A38D]" />
        </div>
      </div>
    );
  }

  const totalItems = Object.values(preferences.mealPreferences || {}).reduce((sum, arr) => sum + arr.length, 0) + 
                    (preferences.preferredFoods?.length || 0) + 
                    (preferences.foodsToAvoid?.length || 0) + 
                    (preferences.dietaryRestrictions?.length || 0);
  const activeTabData = MEAL_TABS.find(t => t.id === activeTab);
  
  const currentCategory = activeTab === 'general' ? activeGeneralTab : activeTab;
  const activeFoods = activeTab === 'general' ? (preferences[activeGeneralTab] || []) : (preferences.mealPreferences?.[activeTab] || []);
  const activeSuggestions = activeTab === 'general' ? (activeTabData.subTabs.find(st => st.id === activeGeneralTab)?.suggestions || []) : (activeTabData?.suggestions || []);

  return (
    <div className="fixed inset-0 bg-[#1a2e35]/40 backdrop-blur-md z-[110] overflow-y-auto p-4 flex items-start md:items-center justify-center" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[3rem] shadow-[0_20px_60px_rgba(0,0,0,0.1)] max-w-lg w-full overflow-hidden border border-emerald-50 relative my-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-50 bg-[#F8F9F5]/30">
          <div>
            <h2 className="text-xl font-black text-[#1a2e35] tracking-tight">Food Preferences</h2>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
              {hasChanges ? (
                <span className="text-amber-500 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Unsaved changes
                </span>
              ) : (
                "Tell us what you like for each meal"
              )}
            </p>
          </div>
          <button
            onClick={() => {
              if (hasChanges) {
                if (window.confirm('You have unsaved changes. Do you want to discard them?')) {
                  onClose();
                }
              } else {
                onClose();
              }
            }}
            className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-black hover:bg-slate-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Meal Tabs */}
        <div className="flex border-b border-slate-100">
          {MEAL_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-4 text-xs font-bold transition-all relative ${activeTab === tab.id ? 'text-[#064e3b]' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <span className="text-lg">{tab.emoji}</span>
              <span className="text-[10px] font-black uppercase tracking-wider">{tab.label}</span>
              {(tab.id === 'general' ? 
                ((preferences.preferredFoods?.length || 0) + (preferences.foodsToAvoid?.length || 0) + (preferences.dietaryRestrictions?.length || 0)) : 
                (preferences.mealPreferences?.[tab.id] || []).length) > 0 && (
                <span className="absolute top-2 right-1/4 w-4 h-4 rounded-full bg-[#69A38D] text-white text-[9px] font-black flex items-center justify-center border-2 border-white">
                  {tab.id === 'general' ? 
                    ((preferences.preferredFoods?.length || 0) + (preferences.foodsToAvoid?.length || 0) + (preferences.dietaryRestrictions?.length || 0)) : 
                    (preferences.mealPreferences?.[tab.id] || []).length}
                </span>
              )}
              {activeTab === tab.id && (
                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#69A38D]" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-5 min-h-[300px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {/* General Sub-tabs if active */}
              {activeTab === 'general' && (
                <div className="flex gap-1 p-1 bg-emerald-50/50 rounded-2xl mb-4 border border-emerald-100/50">
                  {activeTabData.subTabs.map(st => (
                    <button
                      key={st.id}
                      onClick={() => setActiveGeneralTab(st.id)}
                      className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${activeGeneralTab === st.id ? 'bg-white text-[#69A38D] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValues[currentCategory] || ''}
                  onChange={(e) => setInputValues(prev => ({ ...prev, [currentCategory]: e.target.value }))}
                  onKeyPress={(e) => e.key === 'Enter' && addItem(currentCategory)}
                  placeholder={`Add ${activeTab === 'general' ? activeTabData.subTabs.find(st => st.id === activeGeneralTab).label.toLowerCase() : activeTabData?.label?.toLowerCase()}...`}
                  className="flex-1 bg-slate-50 border border-slate-100 focus:border-[#69A38D]/30 focus:ring-4 focus:ring-[#69A38D]/5 focus:bg-white px-5 py-3 rounded-2xl outline-none transition-all text-sm font-bold placeholder:text-slate-300 text-[#1a2e35]"
                />
                <button
                  onClick={() => addItem(currentCategory)}
                  className="px-6 bg-[#69A38D] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-[#5d8d7d] transition-all active:scale-95 shadow-lg shadow-emerald-700/10"
                >
                  Add
                </button>
              </div>

              {/* Quick Suggestions */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-2">Quick Add</p>
                <div className="flex flex-wrap gap-1.5">
                  {activeSuggestions.filter(s => !activeFoods.includes(s)).map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => addSuggestion(currentCategory, suggestion)}
                      className="px-3 py-1.5 bg-white border border-slate-100 rounded-xl text-[11px] font-bold text-slate-500 hover:border-emerald-200 hover:text-[#69A38D] transition-all active:scale-95"
                    >
                      + {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Foods */}
              <div className="pt-3 border-t border-slate-50">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-2">
                  Selected ({activeFoods.length})
                </p>
                <div className="flex flex-wrap gap-2 min-h-[50px]">
                  <AnimatePresence>
                    {activeFoods.map((food, i) => (
                      <motion.div
                        key={food}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="bg-[#69A38D] text-white rounded-full px-4 py-2 flex items-center gap-2 text-xs font-black shadow-sm"
                      >
                        {food}
                        <X className="w-3.5 h-3.5 cursor-pointer opacity-60 hover:opacity-100 hover:scale-110 transition-all" onClick={() => removeItem(currentCategory, i)} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {activeFoods.length === 0 && (
                    <div className="w-full py-6 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl">
                      <p className="text-[10px] font-bold text-slate-300">No preferences here yet</p>
                      <p className="text-[10px] text-slate-300 mt-0.5">Tap quick suggestions or type above</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-6 pt-2">
          <button
            onClick={async () => {
              const saved = await savePreferences();
              if (saved) {
                if (onGenerate) {
                  onGenerate();
                }
                onClose();
              }
            }}
            className="flex-1 py-4 bg-[#69A38D] text-white rounded-[2rem] font-black uppercase text-[11px] tracking-[0.2em] hover:bg-[#5d8d7d] transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-emerald-700/10"
          >
            {mode === 'regenerate' ? 'Save & Generate New Plan' : 'Save Preferences'}
            {totalItems > 0 && <span className="bg-white/20 px-3 py-1 rounded-full text-[9px] backdrop-blur-sm">{totalItems} items</span>}
          </button>
        </div>

        {/* Health Warning Modal */}
        <AnimatePresence>
          {healthWarning && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-[120] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className={`bg-white rounded-[4rem] p-10 max-w-sm w-full border ${healthWarning.isClinical ? 'border-rose-100 shadow-rose-200' : 'border-emerald-100 shadow-emerald-200'} shadow-2xl overflow-hidden relative`}
              >
                <div className={`absolute top-0 right-0 w-40 h-40 ${healthWarning.isClinical ? 'bg-rose-500/10' : 'bg-emerald-500/10'} rounded-full blur-3xl -mr-20 -mt-20`} />
                
                <div className="flex flex-col items-center text-center mb-10">
                  <div className={`w-20 h-20 ${healthWarning.isClinical ? 'bg-rose-50' : 'bg-emerald-50'} rounded-[2.5rem] flex items-center justify-center mb-8 border ${healthWarning.isClinical ? 'border-rose-100' : 'border-emerald-100'} shadow-inner`}>
                    <AlertCircle className={`w-10 h-10 ${healthWarning.isClinical ? 'text-rose-500' : 'text-[#69A38D]'}`} />
                  </div>
                  <h3 className="text-3xl font-black text-[#1a2e35] mb-3 leading-tight">
                    {healthWarning.isClinical ? 'Clinical Alert' : 'Nutritional Warning'}
                  </h3>
                  <p className="text-[11px] font-black text-slate-400 leading-relaxed uppercase tracking-[0.2em] px-4">
                    {healthWarning.isClinical ? (
                      <>Diabetes Profile: <span className="text-rose-600">{healthWarning.food}</span> may cause sharp blood glucose spikes.</>
                    ) : (
                      <>The platform identifies <span className="text-[#69A38D]">{healthWarning.food}</span> as a caloric or processed choice.</>
                    )}
                  </p>
                </div>
 
                <div className={`${healthWarning.isClinical ? 'bg-rose-50/50' : 'bg-emerald-50/50'} rounded-[2.5rem] p-8 mb-10 border ${healthWarning.isClinical ? 'border-rose-100' : 'border-emerald-100/50'}`}>
                  <p className={`text-[11px] font-black uppercase tracking-widest ${healthWarning.isClinical ? 'text-rose-400' : 'text-emerald-400'} mb-4`}>
                    {healthWarning.isClinical ? 'Diabetes Safe Alternative' : 'Healthier Upgrade'}
                  </p>
                  <p className="text-base font-black text-[#1a2e35] mb-1 leading-tight">How about {healthWarning.alternative} instead?</p>
                </div>
 
                <div className="flex flex-col gap-4">
                  <button 
                    onClick={() => handleHandleWarning('replace')}
                    className={`w-full py-5 ${healthWarning.isClinical ? 'bg-rose-600 shadow-rose-200' : 'bg-[#69A38D] shadow-emerald-200'} text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl`}
                  >
                    <CheckCircle className="w-5 h-5" /> Replace with Healthy
                  </button>
                  <button 
                    onClick={() => handleHandleWarning('keep')}
                    className="w-full py-5 bg-white text-slate-400 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] border border-slate-100 hover:bg-slate-50 transition-all active:scale-95"
                  >
                    Add anyway
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
