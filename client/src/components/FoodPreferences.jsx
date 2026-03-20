import { useState, useEffect } from 'react';
import { X, Plus, Sparkles, Loader2, CheckCircle, AlertCircle, Target, Activity, Heart, ShieldCheck, Zap, Coffee, Sun, Utensils } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';

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

export default function FoodPreferences({ onClose, onGenerate, mode = 'save' }) {
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

  const addItem = (type) => {
    const value = inputValues[type]?.trim();
    if (!value) return;

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

  const addSuggestion = (type, food) => {
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
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[110] flex items-center justify-center p-4">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-white/10" />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent"
          />
          <Activity className="absolute inset-0 m-auto w-8 h-8 text-indigo-400" />
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[110] overflow-y-auto p-4 flex items-start md:items-center justify-center" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 relative my-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3 border-b border-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Food Preferences</h2>
            <p className="text-slate-400 text-xs mt-0.5">
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
            className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-black hover:bg-slate-100 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Meal Tabs */}
        <div className="flex border-b border-slate-100">
          {MEAL_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-bold transition-all relative ${activeTab === tab.id ? 'text-black' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <span className="text-lg">{tab.emoji}</span>
              <span className="text-[10px] font-black uppercase tracking-wider">{tab.label}</span>
              {(tab.id === 'general' ? 
                ((preferences.preferredFoods?.length || 0) + (preferences.foodsToAvoid?.length || 0) + (preferences.dietaryRestrictions?.length || 0)) : 
                (preferences.mealPreferences?.[tab.id] || []).length) > 0 && (
                <span className="absolute top-1.5 right-1/4 w-4 h-4 rounded-full bg-black text-white text-[9px] font-black flex items-center justify-center">
                  {tab.id === 'general' ? 
                    ((preferences.preferredFoods?.length || 0) + (preferences.foodsToAvoid?.length || 0) + (preferences.dietaryRestrictions?.length || 0)) : 
                    (preferences.mealPreferences?.[tab.id] || []).length}
                </span>
              )}
              {activeTab === tab.id && (
                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />
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
                <div className="flex gap-1 p-1 bg-slate-50 rounded-xl mb-4">
                  {activeTabData.subTabs.map(st => (
                    <button
                      key={st.id}
                      onClick={() => setActiveGeneralTab(st.id)}
                      className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${activeGeneralTab === st.id ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
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
                  className="flex-1 bg-slate-50 border border-slate-100 focus:border-slate-300 focus:bg-white px-4 py-2.5 rounded-xl outline-none transition-all text-sm font-medium placeholder:text-slate-300"
                />
                <button
                  onClick={() => addItem(currentCategory)}
                  className="px-4 bg-black text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all active:scale-95"
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
                      className="px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all"
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
                        className="bg-black text-white rounded-full px-3 py-1.5 flex items-center gap-2 text-xs font-bold"
                      >
                        {food}
                        <X className="w-3 h-3 cursor-pointer opacity-60 hover:opacity-100" onClick={() => removeItem(currentCategory, i)} />
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
        <div className="flex items-center gap-3 p-5 pt-0">
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
            className="flex-1 py-3.5 bg-black text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            {mode === 'regenerate' ? 'Save & Generate New Plan' : 'Save Preferences'}
            {totalItems > 0 && <span className="bg-white/20 px-2 py-0.5 rounded-full text-[9px]">{totalItems} items</span>}
          </button>
        </div>

      </motion.div>
    </div>
  );
}
