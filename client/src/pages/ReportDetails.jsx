import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { healthService } from '../services/api';
import { FileText, Activity, ArrowLeft, X, Droplets, Eye, Pill, UtensilsCrossed, Heart, TrendingUp, BarChart3 } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);  // Start with loading = true
  const [isAIGenerated, setIsAIGenerated] = useState(false);

  // Early return if no metric - CRITICAL FIX
  if (!metric) {
    console.error('MetricDetailModal: metric is undefined or null');
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 max-w-md text-center">
          <p className="text-slate-600 mb-4">Unable to load metric information</p>
          <button onClick={onClose} className="px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">
            Close
          </button>
        </div>
      </div>
    );
  }

  // Generate fallback info instantly
  const generateFallbackInfo = () => {
    const metricName = metric?.name || 'Unknown Metric';
    const metricValue = metric?.value || 'N/A';
    const metricUnit = metric?.unit || '';
    
    return {
      en: {
        name: metricName,
        whatIsIt: `${metricName} is a health metric. Your current value is ${metricValue} ${metricUnit}.`,
        whenHighTitle: 'When High',
        whenHighEffects: ['Please consult with a healthcare professional'],
        whenLowTitle: 'When Low',
        whenLowEffects: ['Please consult with a healthcare professional'],
        solutions: ['Consult with your doctor for personalized advice']
      },
      hi: {
        name: metricName,
        whatIsIt: `${metricName} एक स्वास्थ्य मेट्रिक है।`,
        whenHighTitle: 'जब अधिक हो',
        whenHighEffects: ['कृपया डॉक्टर से परामर्श लें'],
        whenLowTitle: 'जब कम हो',
        whenLowEffects: ['कृपया डॉक्टर से परामर्श लें'],
        solutions: ['व्यक्तिगत सलाह के लिए अपने डॉक्टर से परामर्श लें']
      }
    };
  };

  useEffect(() => {
    // CRITICAL: Check if metric exists before proceeding
    if (!metric || !metric.name) {
      console.error('MetricDetailModal useEffect: metric is invalid', metric);
      setMetricInfo(generateFallbackInfo());
      setLoading(false);
      return;
    }

    // DON'T show fallback immediately - let loading state show
    // setMetricInfo(generateFallbackInfo());  // REMOVED
    setLoading(true);  // Show loading spinner
    setIsAIGenerated(false);

    // Fetch AI info
    const fetchMetricInfo = async () => {
      try {
        const cacheKey = `${metric.name}-${metric.value}`;
        
        // Check global cache first
        if (metricInfoCache[cacheKey]) {
          console.log('✅ Using cached metric info for:', metric.name);
          setMetricInfo(metricInfoCache[cacheKey]);
          setIsAIGenerated(true);
          setLoading(false);
          return;
        }
        
        console.log('🔄 Fetching AI-generated metric info for:', metric.name);
        
        // Fetch AI info
        const response = await healthService.getMetricInfo({
          metricName: metric.name,
          metricValue: metric.value,
          normalRange: metric.normalRange,
          unit: metric.unit
        });

        console.log('✨ Received AI metric info:', response.data);
        
        // CRITICAL: Validate response structure
        if (!response.data || !response.data.metricInfo) {
          console.error('Invalid AI response structure:', response.data);
          // Show fallback if AI fails
          setMetricInfo(generateFallbackInfo());
          setLoading(false);
          return;
        }
        
        // Cache and update with AI info
        metricInfoCache[cacheKey] = response.data.metricInfo;
        setMetricInfo(response.data.metricInfo);
        setIsAIGenerated(true);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching metric info:', error);
        // Show fallback if error
        setMetricInfo(generateFallbackInfo());
        setLoading(false);
      }
    };

    fetchMetricInfo();
  }, [metric]);

  if (!metric || !metricInfo) return null;

  // CRITICAL FIX: Add defensive checks for metricInfo structure
  const info = metricInfo[language] || metricInfo['en'] || {
    name: metric?.name || 'Unknown Metric',
    whatIsIt: 'Information not available',
    whenHighTitle: 'When High',
    whenHighEffects: ['Please consult with a healthcare professional'],
    whenLowTitle: 'When Low',
    whenLowEffects: ['Please consult with a healthcare professional'],
    solutions: ['Consult with your doctor for personalized advice']
  };
  
  const t = translations[language];
  
  // Safety checks for metric properties
  const metricName = metric?.name || 'Unknown Metric';
  const metricValue = metric?.value || 'N/A';
  const metricUnit = metric?.unit || '';
  const metricNormalRange = metric?.normalRange || 'N/A';

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
            <p className="text-slate-600">{language === 'hi' ? 'सामान्य रेंज' : 'Normal Range'}: <span className="font-semibold text-cyan-600">{metricNormalRange} {metricUnit}</span></p>
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
                {info.whenHighEffects && Array.isArray(info.whenHighEffects) && info.whenHighEffects.map((effect, i) => (
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
                {info.whenLowEffects && Array.isArray(info.whenLowEffects) && info.whenLowEffects.map((effect, i) => (
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
                {info.solutions && Array.isArray(info.solutions) && info.solutions.map((solution, i) => (
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
  const [showComparison, setShowComparison] = useState(false);
  const [previousReport, setPreviousReport] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);

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

  const handleCompare = async () => {
    try {
      const { data } = await healthService.compareReport(id);
      if (data.comparison) {
        setComparisonData(data);
        setPreviousReport(data.previousReport);
        setShowComparison(true);
      } else {
        toast.info('No previous report found for comparison');
      }
    } catch (error) {
      toast.error('Failed to load comparison data');
    }
  };

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
            <div>
              <h1 className="text-2xl font-bold">{report.reportType} Report</h1>
              <p className="text-white/70">Analyzed on {new Date(report.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              {report.aiAnalysis?.patientName && report.aiAnalysis.patientName !== 'Patient' && (
                <p className="text-white/90 text-sm mt-2 font-semibold">
                  👤 {report.aiAnalysis.patientName}
                  {report.aiAnalysis?.patientAge && report.aiAnalysis.patientAge !== 'N/A' && ` • Age: ${report.aiAnalysis.patientAge}`}
                  {report.aiAnalysis?.patientGender && report.aiAnalysis.patientGender !== 'N/A' && ` • ${report.aiAnalysis.patientGender}`}
                </p>
              )}
              {report.aiAnalysis?.reportDate && report.aiAnalysis.reportDate !== 'N/A' && (
                <p className="text-white/70 text-sm">📅 Report Date: {report.aiAnalysis.reportDate}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="text-center p-4 bg-white/10 backdrop-blur-sm rounded-xl"><p className="text-4xl font-bold">{healthScore}</p><p className="text-sm text-white/70">Health Score</p></div>
            <button
              onClick={handleCompare}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all flex items-center gap-2 text-sm font-medium"
            >
              <BarChart3 className="w-4 h-4" />
              Compare with Previous
            </button>
          </div>
        </div>
      </div>

      {aiAnalysis?.summary && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2"><Activity className="w-5 h-5 text-cyan-500" /> Summary</h2>
          <p className="text-slate-700 leading-relaxed mb-4">{aiAnalysis.summary}</p>
          
          {/* Key Findings - Mandatory */}
          {aiAnalysis?.keyFindings && aiAnalysis.keyFindings.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-3">🔍 Key Findings</h3>
              <ul className="space-y-2">
                {aiAnalysis.keyFindings.map((finding, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-700">
                    <span className="text-blue-500 font-bold mt-0.5">•</span>
                    {finding}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {aiAnalysis?.metrics && Object.keys(aiAnalysis.metrics).length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-6">All Health Metrics</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                onClick={() => def.name && setSelectedMetric({ key: def.name.toLowerCase().replace(/\s+/g, ''), name: def.name, value: def.currentValue, normalRange: def.normalRange, unit: '' })}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md hover:scale-105 text-left ${def.severity === 'severe' ? 'bg-red-50 border-red-200 hover:border-red-300' : def.severity === 'moderate' ? 'bg-amber-50 border-amber-200 hover:border-amber-300' : 'bg-yellow-50 border-yellow-200 hover:border-yellow-300'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800">{def.name || 'Unknown Deficiency'}</span>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${def.severity === 'severe' ? 'bg-red-100 text-red-700' : def.severity === 'moderate' ? 'bg-amber-100 text-amber-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {def.severity || 'unknown'}
                    </span>
                    <Eye className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
                <p className="text-sm text-slate-700 font-medium">Current: {def.currentValue || 'N/A'}</p>
                <p className="text-sm text-slate-600">Normal: {def.normalRange || 'N/A'}</p>
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

      {showComparison && comparisonData && (
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl border-2 border-blue-200 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-blue-900 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-blue-600" />
              Report Comparison
            </h2>
            <button
              onClick={() => setShowComparison(false)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Close
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl p-4 border-2 border-blue-200">
              <p className="text-sm text-blue-600 font-semibold mb-2">Current Report</p>
              <p className="text-2xl font-bold text-blue-900">{comparisonData.currentReport?.healthScore || 0}</p>
              <p className="text-xs text-blue-600 mt-1">{new Date(comparisonData.currentReport?.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border-2 border-amber-200">
              <p className="text-sm text-amber-600 font-semibold mb-2">Previous Report</p>
              <p className="text-2xl font-bold text-amber-900">{previousReport?.healthScore || 0}</p>
              <p className="text-xs text-amber-600 mt-1">{new Date(previousReport?.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Metrics Comparison */}
          {comparisonData.currentReport?.metrics && (
            <div className="bg-white rounded-xl p-4 border-2 border-blue-200">
              <h3 className="font-bold text-blue-900 mb-4">Metrics Comparison</h3>
              <div className="space-y-3">
                {Object.entries(comparisonData.currentReport.metrics || {}).map(([key, currentMetric]) => {
                  const previousMetric = previousReport?.metrics?.[key];
                  if (!previousMetric) return null;
                  
                  const improvement = currentMetric.value - previousMetric.value;
                  const isImprovement = (currentMetric.status === 'normal' && previousMetric.status !== 'normal') || 
                                       (improvement > 0 && key.includes('HDL')) ||
                                       (improvement < 0 && !key.includes('HDL') && !key.includes('Glucose') && !key.includes('Cholesterol'));
                  
                  return (
                    <div key={key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-slate-800">{key}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <div className="text-sm">
                            <span className="text-slate-600">Previous: </span>
                            <span className="font-semibold text-amber-700">{previousMetric.value} {previousMetric.unit}</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-slate-600">Current: </span>
                            <span className="font-semibold text-blue-700">{currentMetric.value} {currentMetric.unit}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-bold ${isImprovement ? 'text-green-600' : 'text-red-600'}`}>
                          {isImprovement ? '↓' : '↑'} {Math.abs(improvement).toFixed(1)}
                        </div>
                        <p className={`text-xs font-medium ${isImprovement ? 'text-green-600' : 'text-red-600'}`}>
                          {isImprovement ? 'Improved' : 'Changed'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
        <p className="text-sm text-blue-700"><strong>Disclaimer:</strong> This AI analysis is for informational wellness support only and should not replace professional medical advice. Always consult with a healthcare provider for medical decisions.</p>
      </div>
    </div>
  );
}
