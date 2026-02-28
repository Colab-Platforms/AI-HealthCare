import { useState, useEffect } from 'react';
import { X, Plus, Sparkles, Loader2, CheckCircle, AlertCircle, TrendingUp, TrendingDown, UtensilsCrossed, Target, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function FoodPreferences({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [preferences, setPreferences] = useState({
    preferredFoods: [],
    foodsToAvoid: [],
    dietaryRestrictions: []
  });
  const [analysis, setAnalysis] = useState(null);
  const [inputValues, setInputValues] = useState({
    preferred: '',
    avoid: '',
    restriction: ''
  });

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await api.get('/users/food-preferences');
      if (response.data.success) {
        const data = response.data.data;
        setPreferences({
          ...data,
          mealPreferences: data.mealPreferences || {
            breakfast: [],
            lunch: [],
            snacks: [],
            dinner: []
          }
        });
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    try {
      const response = await api.post('/users/food-preferences', preferences);
      if (response.data.success) {
        toast.success('Preferences saved!');
        return true;
      }
    } catch (error) {
      toast.error('Failed to save preferences');
      return false;
    }
  };

  const analyzeChoices = async () => {
    if (!preferences.preferredFoods || preferences.preferredFoods.length === 0) {
      toast.error('Please add at least one preferred food');
      return;
    }

    setAnalyzing(true);
    try {
      const saved = await savePreferences();
      if (!saved) {
        setAnalyzing(false);
        return;
      }

      const response = await api.post('/users/analyze-food-choices');
      if (response.data.success) {
        setAnalysis(response.data.data);
        toast.success('Analysis complete!');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const addItem = (type) => {
    const value = inputValues[type].trim();
    if (!value) return;

    const key = type === 'preferred' ? 'preferredFoods' :
      type === 'avoid' ? 'foodsToAvoid' : 'dietaryRestrictions';

    if (preferences[key].includes(value)) {
      toast.error('Already added');
      return;
    }

    setPreferences(prev => ({
      ...prev,
      [key]: [...prev[key], value]
    }));
    setInputValues(prev => ({ ...prev, [type]: '' }));
  };

  const removeItem = (type, index) => {
    const key = type === 'preferred' ? 'preferredFoods' :
      type === 'avoid' ? 'foodsToAvoid' : 'dietaryRestrictions';

    setPreferences(prev => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full">
          <Loader2 className="w-8 h-8 animate-spin text-[#2FC8B9] mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] overflow-y-auto p-2 sm:p-4 animate-in fade-in duration-300">
      <div className="min-h-screen flex items-center justify-center py-4 sm:py-8">
        <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-5xl w-full overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">

          {/* Main Visual Header */}
          <div className="relative h-32 sm:h-40 bg-gradient-to-br from-[#2FC8B9] to-[#1db7a6] overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-black rounded-full translate-x-1/2 translate-y-1/2 blur-3xl"></div>
            </div>

            <div className="relative h-full px-6 sm:px-10 flex items-center justify-between">
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-xl rounded-3xl flex items-center justify-center border border-white/30 shadow-2xl">
                  <UtensilsCrossed className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight leading-none mb-2">Food Preferences</h2>
                  <p className="text-white/80 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em]">Tailor your nutrition roadmap</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center transition-all group border border-white/20"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-white group-hover:rotate-90 transition-transform" />
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row">
            {/* Preferences Input Side */}
            <div className="flex-1 p-6 sm:p-10 space-y-8 border-r border-slate-50">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Favorites Section */}
                <div className="col-span-1 md:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-[#2FC8B9]" />
                      Preferred Foods (Daily Staples)
                    </label>
                    <span className="text-[10px] text-slate-300 font-bold uppercase">{preferences.preferredFoods.length} Added</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputValues.preferred}
                      onChange={(e) => setInputValues(prev => ({ ...prev, preferred: e.target.value }))}
                      onKeyPress={(e) => e.key === 'Enter' && addItem('preferred')}
                      placeholder="e.g. Chicken breast, Oats, Paneer..."
                      className="flex-1 px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-[#2FC8B9]/30 focus:bg-white rounded-2xl outline-none transition-all text-sm font-bold placeholder:text-slate-300"
                    />
                    <button
                      onClick={() => addItem('preferred')}
                      className="px-4 sm:px-6 bg-black text-white rounded-2xl font-black uppercase text-[10px] sm:text-xs hover:bg-slate-800 transition-all shadow-lg active:scale-95 text-nowrap"
                    >
                      Add Food
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                    {preferences.preferredFoods.map((food, i) => (
                      <div key={i} className="group flex items-center gap-2 px-4 py-2 bg-[#2FC8B9]/5 hover:bg-[#2FC8B9]/10 border border-[#2FC8B9]/20 rounded-xl transition-all">
                        <span className="text-xs font-black text-slate-700 uppercase">{food}</span>
                        <button onClick={() => removeItem('preferred', i)} className="text-slate-400 hover:text-rose-500 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {preferences.preferredFoods.length === 0 && (
                      <div className="w-full py-8 border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center text-slate-300">
                        <UtensilsCrossed className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-[10px] font-black uppercase tracking-widest">No favorites listed</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Avoid Section */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Foods to Avoid
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputValues.avoid}
                      onChange={(e) => setInputValues(prev => ({ ...prev, avoid: e.target.value }))}
                      onKeyPress={(e) => e.key === 'Enter' && addItem('avoid')}
                      placeholder="e.g. Mushrooms, Seafood..."
                      className="flex-1 px-5 py-4 bg-rose-50/30 border-2 border-transparent focus:border-rose-200 focus:bg-white rounded-2xl outline-none transition-all text-sm font-bold"
                    />
                    <button onClick={() => addItem('avoid')} className="p-4 bg-rose-500 text-white rounded-2xl hover:bg-rose-600 shadow-md active:scale-95 transition-all">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
                    {preferences.foodsToAvoid.map((food, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-lg">
                        <span className="text-[10px] font-bold text-rose-700 uppercase">{food}</span>
                        <button onClick={() => removeItem('avoid', i)} className="text-rose-300 hover:text-rose-500">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Restrictions Section */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Restrictions
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputValues.restriction}
                      onChange={(e) => setInputValues(prev => ({ ...prev, restriction: e.target.value }))}
                      onKeyPress={(e) => e.key === 'Enter' && addItem('restriction')}
                      placeholder="e.g. Vegetarian, Keto..."
                      className="flex-1 px-5 py-4 bg-blue-50/30 border-2 border-transparent focus:border-blue-200 focus:bg-white rounded-2xl outline-none transition-all text-sm font-bold"
                    />
                    <button onClick={() => addItem('restriction')} className="p-4 bg-blue-500 text-white rounded-2xl hover:bg-blue-600 shadow-md active:scale-95 transition-all">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
                    {preferences.dietaryRestrictions.map((res, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg">
                        <span className="text-[10px] font-bold text-blue-700 uppercase">{res}</span>
                        <button onClick={() => removeItem('restriction', i)} className="text-blue-300 hover:text-blue-500">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  onClick={onClose}
                  className="w-full sm:w-auto px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs hover:bg-slate-200 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <button
                    onClick={savePreferences}
                    className="w-full sm:w-auto px-8 py-4 bg-black text-white rounded-2xl font-black uppercase text-xs hover:bg-slate-800 transition-all shadow-xl active:scale-95"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={analyzeChoices}
                    disabled={analyzing}
                    className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#2FC8B9] to-[#1db7a6] text-white rounded-2xl font-black uppercase text-xs hover:scale-105 transition-all shadow-xl shadow-[#2FC8B9]/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Analyze Choices
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* AI Analysis Result Side - Modern View */}
            <div className={`lg:w-[320px] p-6 sm:p-10 bg-slate-50 relative overflow-hidden flex flex-col ${!analysis && 'items-center justify-center text-center opacity-40'}`}>
              <div className="relative z-10 flex flex-col h-full">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Target className="w-4 h-4 text-[#2FC8B9]" />
                  AI Prediction
                </h3>

                {analysis ? (
                  <div className="space-y-6 flex-1 animate-in slide-in-from-right-4 duration-500 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Health Impact</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-black ${analysis.impact === 'positive' ? 'text-emerald-500' : 'text-slate-800'}`}>
                          {analysis.overallScore || analysis.impactScore || '88'}%
                        </span>
                        {analysis.impact === 'positive' ? <TrendingUp className="w-5 h-5 text-emerald-500" /> : <Activity className="w-5 h-5 text-blue-500" />}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[10px] text-slate-400 font-black uppercase">Core Insights</p>
                      {(analysis.insights || analysis.strengths || []).slice(0, 4).map((insight, i) => (
                        <div key={i} className="flex gap-3 text-left">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#2FC8B9] shrink-0 mt-1.5"></div>
                          <p className="text-[11px] font-bold text-slate-600 leading-relaxed">{insight}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-auto pt-6 border-t border-slate-200">
                      <p className="text-[10px] text-[#2FC8B9] font-black uppercase mb-2">Recommendation</p>
                      <p className="text-xs font-bold text-slate-700 italic">"{analysis.summary || 'Your choices align well with your metabolic profile.'}"</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm">
                      <Sparkles className="w-10 h-10 text-slate-200" />
                    </div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest px-4 leading-relaxed">
                      Complete your staples and click 'Analyze' to see AI predictions
                    </p>
                  </div>
                )}
              </div>

              {/* Background watermark */}
              <div className="absolute -bottom-20 -right-20 pointer-events-none opacity-5">
                <UtensilsCrossed className="w-64 h-64" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
