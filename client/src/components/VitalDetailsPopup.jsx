import { useState, useEffect } from 'react';
import { X, Activity, Info, Apple, AlertTriangle, Zap, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { healthService } from '../services/api';

export default function VitalDetailsPopup({ vital, onClose, initialLanguage = 'en', t }) {
  const [aiInfo, setAiInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const language = initialLanguage === 'hi' ? 'hi' : 'en';

  if (!vital) return null;

  // Destructure with new field support from main analysis
  const {
    name = 'Metric',
    value = 'N/A',
    unit = '',
    normalRange = 'N/A',
    status = 'normal',
    whatItDoes = '',
    lowHighImpact = '',
    topFoods = [],
    symptoms = [],
    // Legacy support for fields that might be passed from old reports or secondary fetch
    description = '',
    recommendations = [],
    foodsToConsume = [],
  } = vital;

  // Decide if we need to fetch additional info (for older reports)
  useEffect(() => {
    const shouldFetch = !whatItDoes && !lowHighImpact;

    const fetchAIInfo = async () => {
      try {
        setLoading(true);
        const response = await healthService.getMetricInfo({
          metricName: name,
          metricValue: value,
          normalRange: normalRange,
          unit: unit
        });

        if (response.data && response.data.metricInfo) {
          const info = response.data.metricInfo[language] || response.data.metricInfo.en;
          setAiInfo(info);
        }
      } catch (error) {
        console.error('Error fetching metric info:', error);
      } finally {
        setLoading(false);
      }
    };

    if (shouldFetch) {
      fetchAIInfo();
    }
  }, [name, value, normalRange, unit, language, whatItDoes, lowHighImpact]);

  // Wrap t for safety
  const translate = (text) => (t && typeof t === 'function' ? t(text) : text);

  // Merge data sources
  const data = {
    role: translate(whatItDoes || aiInfo?.whatIsIt || description || 'Information not available.'),
    impact: translate(lowHighImpact || aiInfo?.significance || (status !== 'normal' ? aiInfo?.interpretation : null) || 'No significant issues detected.'),
    foods: (topFoods.length > 0 ? topFoods : (aiInfo?.dietaryTips || foodsToConsume || [])).map(f => translate(f)),
    relatableSymptoms: (symptoms.length > 0 ? symptoms : (aiInfo?.symptoms || [])).map(s => translate(s)),
    steps: (recommendations.length > 0 ? recommendations : (aiInfo?.actions || [])).map(st => translate(st))
  };

  const getStatusConfig = (s) => {
    const statusLower = (s || '').toLowerCase();
    if (statusLower === 'normal' || statusLower === 'good')
      return { color: 'emerald', icon: CheckCircle, label: language === 'hi' ? 'सामान्य' : 'Normal' };
    if (statusLower === 'borderline' || statusLower === 'moderate')
      return { color: 'amber', icon: AlertTriangle, label: language === 'hi' ? 'मध्यम' : 'Borderline' };
    return { color: 'red', icon: TrendingUp, label: statusLower.toUpperCase() };
  };

  const config = getStatusConfig(status);
  const StatusIcon = config.icon;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[10000] p-4 animate-in fade-in duration-300">
      <div
        className="bg-white rounded-[2.5rem] shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modern Header */}
        <div className={`p-8 bg-${config.color}-50 relative`}>
          <div className="flex items-center justify-between mb-6">
            <div className={`w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-${config.color}-100`}>
              <StatusIcon className={`w-6 h-6 text-${config.color}-600`} />
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-sm transition-all active:scale-95"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-2">{name}</h2>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 bg-white rounded-full text-[10px] font-black uppercase tracking-widest text-${config.color}-600 shadow-sm border border-${config.color}-100`}>
              {config.label}
            </span>
            <span className="text-slate-400 font-bold text-xs">{normalRange} {unit}</span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="px-8 pb-8 flex-1 overflow-y-auto custom-scrollbar">
          <div className="py-6 space-y-6">

            {/* Main Value Card */}
            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Your Result</p>
                <div className="flex items-baseline gap-1">
                  <span className={`text-4xl font-black text-${config.color}-600`}>{value}</span>
                  <span className="text-slate-400 font-bold text-sm">{unit}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Range</p>
                <p className="font-bold text-slate-700">{normalRange}</p>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-[#2FC8B9] rounded-full animate-spin mb-4"></div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Generating Insights...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">

                {/* 1. What does it do? */}
                <div className="bg-blue-50/50 rounded-3xl p-5 border border-blue-100 group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Zap className="w-4 h-4 text-blue-600" />
                    </div>
                    <h3 className="text-xs font-black text-blue-900 uppercase tracking-widest">What it Does</h3>
                  </div>
                  <p className="text-sm text-blue-800/80 leading-relaxed font-medium">
                    {data.role}
                  </p>
                </div>

                {/* 2. Impact Low/High */}
                <div className="bg-purple-50/50 rounded-3xl p-5 border border-purple-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center">
                      <Activity className="w-4 h-4 text-purple-600" />
                    </div>
                    <h3 className="text-xs font-black text-purple-900 uppercase tracking-widest">Health Impact</h3>
                  </div>
                  <p className="text-sm text-purple-800/80 leading-relaxed font-medium">
                    {data.impact}
                  </p>
                </div>

                {/* 3. What to Eat - HIGHLIGHTED */}
                <div className="bg-emerald-50 rounded-3xl p-5 border-2 border-emerald-100 relative overflow-hidden">
                  <div className="absolute -right-4 -bottom-4 opacity-10">
                    <Apple className="w-24 h-24 text-emerald-600" />
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <Apple className="w-4 h-4 text-emerald-600" />
                    </div>
                    <h3 className="text-xs font-black text-emerald-900 uppercase tracking-widest italic">What to Eat to Improve</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.foods.length > 0 ? data.foods.map((food, i) => (
                      <span key={i} className="px-3 py-1.5 bg-white rounded-xl text-xs font-bold text-emerald-700 shadow-sm border border-emerald-100">
                        {food}
                      </span>
                    )) : (
                      <p className="text-xs text-emerald-600/70 font-medium italic">General healthy diet recommended.</p>
                    )}
                  </div>
                </div>

                {/* 4. Common Symptoms */}
                {data.relatableSymptoms.length > 0 && (
                  <div className="bg-orange-50/50 rounded-3xl p-5 border border-orange-100">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                      </div>
                      <h3 className="text-xs font-black text-orange-900 uppercase tracking-widest">Common Symptoms</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {data.relatableSymptoms.map((symptom, i) => (
                        <span key={i} className="px-3 py-1.5 bg-white rounded-xl text-xs font-medium text-orange-700 shadow-sm border border-orange-100">
                          {symptom}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>

        {/* Minimal Footer */}
        <div className="p-6 bg-slate-50 text-center border-t border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Consult with a professional for medical advice</p>
        </div>
      </div>
    </div>
  );
}
