import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { healthService } from '../services/api';
import { FileText, Activity, ArrowLeft, X, Droplets, Eye, Pill, UtensilsCrossed, Heart } from 'lucide-react';
import toast from 'react-hot-toast';

const translations = {
  en: {
    whatIsIt: 'What is',
    whenHigh: 'When High',
    whenLow: 'When Low',
    howToImprove: 'How to Improve',
    gotIt: 'Got it'
  },
  hi: {
    whatIsIt: 'यह क्या है',
    whenHigh: 'जब अधिक हो',
    whenLow: 'जब कम हो',
    howToImprove: 'सुधार के तरीके',
    gotIt: 'समझ गया'
  }
};

// Global cache for metric info
const metricInfoCache = {};

const MetricDetailModal = ({ metric, onClose }) => {
  const [language, setLanguage] = useState('en');
  const [metricInfo, setMetricInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAIGenerated, setIsAIGenerated] = useState(false);

  useEffect(() => {
    const fetchMetricInfo = async () => {
      try {
        const cacheKey = `${metric.name}-${metric.value}`;
        
        // Check global cache first (instant)
        if (metricInfoCache[cacheKey]) {
          console.log('✅ Using cached metric info for:', metric.name);
          setMetricInfo(metricInfoCache[cacheKey]);
          setIsAIGenerated(true);
          setLoading(false);
          return;
        }
        
        console.log('🔄 Fetching AI-generated metric info for:', metric.name);
        setLoading(true);
        setIsAIGenerated(false);
        
        // Fetch AI info
        const response = await healthService.getMetricInfo({
          metricName: metric.name,
          metricValue: metric.value,
          normalRange: metric.normalRange,
          unit: metric.unit
        });

        console.log('✨ Received AI metric info:', response.data);
        
        // Cache the result
        metricInfoCache[cacheKey] = response.data.metricInfo;
        setMetricInfo(response.data.metricInfo);
        setIsAIGenerated(true);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching metric info:', error);
        
        // Fallback to generic info only on error
        const fallbackInfo = {
          en: {
            name: metric.name,
            whatIsIt: `${metric.name} is a health metric. Your current value is ${metric.value} ${metric.unit || ''}.`,
            whenHighTitle: 'When High',
            whenHighEffects: ['Please consult with a healthcare professional'],
            whenLowTitle: 'When Low',
            whenLowEffects: ['Please consult with a healthcare professional'],
            solutions: ['Consult with your doctor for personalized advice']
          },
          hi: {
            name: metric.name,
            whatIsIt: `${metric.name} एक स्वास्थ्य मेट्रिक है।`,
            whenHighTitle: 'जब अधिक हो',
            whenHighEffects: ['कृपया डॉक्टर से परामर्श लें'],
            whenLowTitle: 'जब कम हो',
            whenLowEffects: ['कृपया डॉक्टर से परामर्श लें'],
            solutions: ['व्यक्तिगत सलाह के लिए अपने डॉक्टर से परामर्श लें']
          }
        };
        
        setMetricInfo(fallbackInfo);
        setIsAIGenerated(false);
        setLoading(false);
      }
    };

    if (metric) {
      fetchMetricInfo();
    }
  }, [metric]);

  if (!metric || !metricInfo) return null;

  const info = metricInfo[language];
  const t = translations[language];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 relative animate-slide-up sm:animate-fade-in shadow-xl" 
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto mb-4 sm:hidden" />
        
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">{info.name}</h2>
            <p className="text-slate-600">{language === 'hi' ? 'सामान्य रेंज' : 'Normal Range'}: <span className="font-semibold text-cyan-600">{metric.normalRange} {metric.unit}</span></p>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="px-3 py-2 bg-white border-2 border-slate-200 rounded-lg text-sm font-medium text-slate-700 cursor-pointer hover:border-cyan-400 focus:outline-none focus:border-cyan-500 transition-colors"
            >
              <option value="en">English</option>
              <option value="hi">हिंदी</option>
            </select>
          </div>
        </div>

        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1">
          <X className="w-5 h-5" />
        </button>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-4" />
            <p className="text-slate-600 font-medium">Generating AI insights...</p>
            <p className="text-xs text-slate-400 mt-2">This usually takes 2-3 seconds</p>
          </div>
        ) : (
          <>
            <div className="mb-6 p-4 bg-cyan-50 rounded-xl border-2 border-cyan-200">
              <h3 className="text-lg font-bold text-cyan-700 mb-2">{t.whatIsIt} {info.name}?</h3>
              <p className="text-slate-700 leading-relaxed">{info.whatIsIt}</p>
            </div>

            <div className="mb-6 p-4 bg-red-50 rounded-xl border-2 border-red-200">
              <h3 className="text-lg font-bold text-red-700 mb-3">{info.whenHighTitle}</h3>
              <ul className="space-y-2">
                {info.whenHighEffects?.map((effect, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-700">
                    <span className="text-red-500 font-bold mt-0.5">•</span>
                    {effect}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mb-6 p-4 bg-amber-50 rounded-xl border-2 border-amber-200">
              <h3 className="text-lg font-bold text-amber-700 mb-3">{info.whenLowTitle}</h3>
              <ul className="space-y-2">
                {info.whenLowEffects?.map((effect, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-700">
                    <span className="text-amber-500 font-bold mt-0.5">•</span>
                    {effect}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mb-6 p-4 bg-emerald-50 rounded-xl border-2 border-emerald-200">
              <h3 className="text-lg font-bold text-emerald-700 mb-3">✅ {t.howToImprove}</h3>
              <ul className="space-y-2">
                {info.solutions?.map((solution, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-700">
                    <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                    {solution}
                  </li>
                ))}
              </ul>
            </div>

            {isAIGenerated && (
              <div className="mb-4 p-2 bg-green-50 rounded-lg border border-green-200 flex items-center gap-2">
                <span className="text-green-600 text-sm">✨ AI-Generated Information</span>
              </div>
            )}

            <button 
              onClick={onClose}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors sm:hidden"
            >
              {t.gotIt}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default function ReportDetails() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const { data } = await healthService.getReport(id);
        setReport(data.report);
      } catch (error) {
        toast.error('Failed to load report');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><div className="text-center"><div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" /><p className="text-slate-400">Loading report...</p></div></div>;
  if (!report) return <div className="text-center py-12 text-slate-400">Report not found</div>;

  const { aiAnalysis } = report;
  const healthScore = aiAnalysis?.healthScore || 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {selectedMetric && (
        <MetricDetailModal metric={selectedMetric} onClose={() => setSelectedMetric(null)} />
      )}

      <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 font-medium transition-colors"><ArrowLeft className="w-4 h-4" /> Back to Dashboard</Link>

      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"><div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" /></div>
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center"><FileText className="w-8 h-8" /></div>
            <div><h1 className="text-2xl font-bold">{report.reportType} Report</h1><p className="text-white/70">Analyzed on {new Date(report.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p></div>
          </div>
          <div className="text-center p-4 bg-white/10 backdrop-blur-sm rounded-xl"><p className="text-4xl font-bold">{healthScore}</p><p className="text-sm text-white/70">Health Score</p></div>
        </div>
      </div>

      {aiAnalysis?.summary && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2"><Activity className="w-5 h-5 text-cyan-500" /> Summary</h2>
          <p className="text-slate-700 leading-relaxed">{aiAnalysis.summary}</p>
        </div>
      )}

      {aiAnalysis?.metrics && Object.keys(aiAnalysis.metrics).length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Health Metrics</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {Object.entries(aiAnalysis.metrics).map(([key, metric]) => (
              <button
                key={key}
                onClick={() => setSelectedMetric({ key, name: key.replace(/([A-Z])/g, ' $1'), ...metric })}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md hover:scale-105 text-left ${metric.status === 'normal' ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300' : metric.status === 'borderline' ? 'bg-amber-50 border-amber-200 hover:border-amber-300' : 'bg-red-50 border-red-200 hover:border-red-300'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm text-slate-600 capitalize font-medium">{key.replace(/([A-Z])/g, ' $1')}</p>
                  <Eye className="w-4 h-4 text-slate-400" />
                </div>
                <p className="text-2xl font-bold text-slate-800">{metric.value} <span className="text-sm font-normal text-slate-500">{metric.unit}</span></p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-600">Normal: {metric.normalRange}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${metric.status === 'normal' ? 'bg-emerald-100 text-emerald-700' : metric.status === 'borderline' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {metric.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {aiAnalysis?.deficiencies?.length > 0 && (
        <div className="bg-white rounded-2xl border-l-4 border-amber-500 border-t-2 border-r-2 border-b-2 border-t-slate-200 border-r-slate-200 border-b-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><Droplets className="w-5 h-5 text-amber-500" /> Detected Deficiencies</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {aiAnalysis.deficiencies.map((def, i) => (
              <button
                key={i}
                onClick={() => setSelectedMetric({ key: def.name.toLowerCase().replace(/\s+/g, ''), name: def.name, value: def.currentValue, normalRange: def.normalRange, unit: '' })}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md hover:scale-105 text-left ${def.severity === 'severe' ? 'bg-red-50 border-red-200 hover:border-red-300' : def.severity === 'moderate' ? 'bg-amber-50 border-amber-200 hover:border-amber-300' : 'bg-yellow-50 border-yellow-200 hover:border-yellow-300'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800">{def.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${def.severity === 'severe' ? 'bg-red-100 text-red-700' : def.severity === 'moderate' ? 'bg-amber-100 text-amber-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {def.severity}
                    </span>
                    <Eye className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
                <p className="text-sm text-slate-700 font-medium">Current: {def.currentValue}</p>
                <p className="text-sm text-slate-600">Normal: {def.normalRange}</p>
                {def.symptoms?.length > 0 && <p className="text-xs text-slate-600 mt-2">Symptoms: {def.symptoms.join(', ')}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      {aiAnalysis?.supplements?.length > 0 && (
        <div className="bg-white rounded-2xl border-l-4 border-purple-500 border-t-2 border-r-2 border-b-2 border-t-slate-200 border-r-slate-200 border-b-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><Pill className="w-5 h-5 text-purple-500" /> Recommended Supplements & Natural Sources</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {aiAnalysis.supplements.map((supp, i) => (
              <div key={i} className="p-4 bg-purple-50 rounded-xl border-2 border-purple-200">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-slate-800">{supp.category}</h3>
                </div>
                <p className="text-sm text-slate-700 mb-2"><strong>Why:</strong> {supp.reason}</p>
                <p className="text-sm text-slate-700 mb-2"><strong>Natural Sources:</strong> {supp.naturalSources}</p>
                <p className="text-xs text-slate-600 italic">💡 {supp.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {aiAnalysis?.dietPlan && (
        <div className="bg-white rounded-2xl border-l-4 border-green-500 border-t-2 border-r-2 border-b-2 border-t-slate-200 border-r-slate-200 border-b-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><UtensilsCrossed className="w-5 h-5 text-green-500" /> Personalized Diet Plan</h2>
          <p className="text-slate-700 mb-6 font-medium">{aiAnalysis.dietPlan.overview}</p>
          
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {aiAnalysis.dietPlan.breakfast?.length > 0 && (
              <div className="p-4 bg-orange-50 rounded-xl border-2 border-orange-200">
                <h3 className="font-bold text-orange-700 mb-3">🌅 Breakfast</h3>
                {aiAnalysis.dietPlan.breakfast.map((meal, i) => (
                  <div key={i} className="mb-3 pb-3 border-b border-orange-200 last:border-0">
                    <p className="font-medium text-slate-800">{meal.meal}</p>
                    <p className="text-xs text-slate-600">Nutrients: {meal.nutrients?.join(', ')}</p>
                    <p className="text-xs text-orange-600 italic">💡 {meal.tip}</p>
                  </div>
                ))}
              </div>
            )}
            
            {aiAnalysis.dietPlan.lunch?.length > 0 && (
              <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                <h3 className="font-bold text-blue-700 mb-3">🍽️ Lunch</h3>
                {aiAnalysis.dietPlan.lunch.map((meal, i) => (
                  <div key={i} className="mb-3 pb-3 border-b border-blue-200 last:border-0">
                    <p className="font-medium text-slate-800">{meal.meal}</p>
                    <p className="text-xs text-slate-600">Nutrients: {meal.nutrients?.join(', ')}</p>
                    <p className="text-xs text-blue-600 italic">💡 {meal.tip}</p>
                  </div>
                ))}
              </div>
            )}
            
            {aiAnalysis.dietPlan.dinner?.length > 0 && (
              <div className="p-4 bg-indigo-50 rounded-xl border-2 border-indigo-200">
                <h3 className="font-bold text-indigo-700 mb-3">🌙 Dinner</h3>
                {aiAnalysis.dietPlan.dinner.map((meal, i) => (
                  <div key={i} className="mb-3 pb-3 border-b border-indigo-200 last:border-0">
                    <p className="font-medium text-slate-800">{meal.meal}</p>
                    <p className="text-xs text-slate-600">Nutrients: {meal.nutrients?.join(', ')}</p>
                    <p className="text-xs text-indigo-600 italic">💡 {meal.tip}</p>
                  </div>
                ))}
              </div>
            )}
            
            {aiAnalysis.dietPlan.snacks?.length > 0 && (
              <div className="p-4 bg-pink-50 rounded-xl border-2 border-pink-200">
                <h3 className="font-bold text-pink-700 mb-3">🥜 Snacks</h3>
                {aiAnalysis.dietPlan.snacks.map((meal, i) => (
                  <div key={i} className="mb-3 pb-3 border-b border-pink-200 last:border-0">
                    <p className="font-medium text-slate-800">{meal.meal}</p>
                    <p className="text-xs text-slate-600">Nutrients: {meal.nutrients?.join(', ')}</p>
                    <p className="text-xs text-pink-600 italic">💡 {meal.tip}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            {aiAnalysis.dietPlan.foodsToIncrease?.length > 0 && (
              <div className="p-4 bg-emerald-50 rounded-xl border-2 border-emerald-200">
                <h3 className="font-bold text-emerald-700 mb-2">✅ Foods to Increase</h3>
                <ul className="space-y-1">
                  {aiAnalysis.dietPlan.foodsToIncrease.map((food, i) => (
                    <li key={i} className="text-sm text-slate-700">• {food}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {aiAnalysis.dietPlan.foodsToLimit?.length > 0 && (
              <div className="p-4 bg-red-50 rounded-xl border-2 border-red-200">
                <h3 className="font-bold text-red-700 mb-2">⚠️ Foods to Limit</h3>
                <ul className="space-y-1">
                  {aiAnalysis.dietPlan.foodsToLimit.map((food, i) => (
                    <li key={i} className="text-sm text-slate-700">• {food}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {aiAnalysis.dietPlan.hydration && (
            <div className="p-4 bg-cyan-50 rounded-xl border-2 border-cyan-200 mb-4">
              <h3 className="font-bold text-cyan-700 mb-2">💧 Hydration</h3>
              <p className="text-sm text-slate-700">{aiAnalysis.dietPlan.hydration}</p>
            </div>
          )}

          {aiAnalysis.dietPlan.tips?.length > 0 && (
            <div className="p-4 bg-yellow-50 rounded-xl border-2 border-yellow-200">
              <h3 className="font-bold text-yellow-700 mb-2">💡 Tips</h3>
              <ul className="space-y-1">
                {aiAnalysis.dietPlan.tips.map((tip, i) => (
                  <li key={i} className="text-sm text-slate-700">• {tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {aiAnalysis?.recommendations && (
        <div className="bg-white rounded-2xl border-l-4 border-red-500 border-t-2 border-r-2 border-b-2 border-t-slate-200 border-r-slate-200 border-b-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><Heart className="w-5 h-5 text-red-500" /> Health Recommendations</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {aiAnalysis.recommendations.lifestyle?.length > 0 && (
              <div className="p-4 bg-red-50 rounded-xl border-2 border-red-200">
                <h3 className="font-bold text-red-700 mb-3">🏃 Lifestyle Changes</h3>
                <ul className="space-y-2">
                  {aiAnalysis.recommendations.lifestyle.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-slate-700">
                      <span className="text-red-500 font-bold mt-0.5">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {aiAnalysis.recommendations.tests?.length > 0 && (
              <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                <h3 className="font-bold text-blue-700 mb-3">🔬 Follow-up Tests</h3>
                <ul className="space-y-2">
                  {aiAnalysis.recommendations.tests.map((test, i) => (
                    <li key={i} className="flex items-start gap-2 text-slate-700">
                      <span className="text-blue-500 font-bold mt-0.5">•</span>
                      {test}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
        <p className="text-sm text-blue-700"><strong>Disclaimer:</strong> This AI analysis is for informational wellness support only and should not replace professional medical advice. Always consult with a healthcare provider for medical decisions.</p>
      </div>
    </div>
  );
}
