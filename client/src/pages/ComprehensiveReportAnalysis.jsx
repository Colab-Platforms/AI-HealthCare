import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { healthService } from '../services/api';
import { ArrowLeft, AlertTriangle, CheckCircle, TrendingDown, Apple, Dumbbell, Heart, Activity, Info, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import api from '../services/api';
import { Download, Printer, Languages, Filter } from 'lucide-react';
import VitalDetailsPopup from '../components/VitalDetailsPopup';

export default function ComprehensiveReportAnalysis() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedMetric, setExpandedMetric] = useState(null);
  const [isHindi, setIsHindi] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [hindiCache, setHindiCache] = useState({});
  const [metricFilter, setMetricFilter] = useState('all');
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [showMetricModal, setShowMetricModal] = useState(false);

  // Simple Hindi translation helper
  const t = (text) => {
    if (!isHindi || !text) return text;
    return hindiCache[text] || text;
  };

  const translateReport = async () => {
    if (isHindi) {
      setIsHindi(false);
      return;
    }
    setTranslating(true);
    try {
      const aiAnalysis = report?.aiAnalysis;
      if (!aiAnalysis) return;

      // Collect all translatable strings
      const textsToTranslate = [
        aiAnalysis.summary,
        ...(aiAnalysis.keyFindings || []),
        aiAnalysis.dietPlan?.overview,
        ...(aiAnalysis.dietPlan?.tips || []),
        ...(aiAnalysis.dietPlan?.breakfast?.map(m => m.meal) || []),
        ...(aiAnalysis.dietPlan?.lunch?.map(m => m.meal) || []),
        ...(aiAnalysis.dietPlan?.dinner?.map(m => m.meal) || []),
        ...(aiAnalysis.dietPlan?.snacks?.map(m => m.meal) || []),
        ...(aiAnalysis.dietPlan?.foodsToIncrease || []),
        ...(aiAnalysis.dietPlan?.foodsToLimit || []),
        ...(aiAnalysis.recommendations?.lifestyle || []),
        ...(aiAnalysis.deficiencies?.map(d => d.name) || []),
        ...(aiAnalysis.deficiencies?.map(d => d.explanation) || []),
        ...(aiAnalysis.deficiencies?.flatMap(d => d.symptoms) || []),
      ].filter(Boolean);

      // Batch translate
      const batchText = textsToTranslate.join('\n---SPLIT---\n');
      const { data } = await api.post('translate', {
        text: batchText,
        targetLanguage: 'hi'
      });

      if (data.translatedText) {
        const translations = data.translatedText.split('---SPLIT---').map(s => s.trim());
        const cache = {};
        textsToTranslate.forEach((text, i) => {
          if (translations[i]) cache[text] = translations[i];
        });
        setHindiCache(cache);
        setIsHindi(true);
        toast.success('रिपोर्ट हिंदी में अनुवादित!');
      }
    } catch (error) {
      console.error('Translation error:', error);
      toast.error('Translation failed. Please try again.');
    } finally {
      setTranslating(false);
    }
  };

  const handleMetricClick = (metricName, metricData) => {
    const metricInfo = {
      name: metricName,
      value: metricData.value,
      unit: metricData.unit || '',
      normalRange: metricData.normalRange || 'N/A',
      status: metricData.status || 'normal',
      description: metricData.description || metricData.whatIsIt || '',
      recommendations: metricData.howToFix || [],
      foodsToConsume: metricData.foods || [],
      foodsToAvoid: metricData.foodsToAvoid || [],
      symptoms: metricData.symptoms || [],
      severity: metricData.severity || '',
      whyAbnormal: metricData.whyAbnormal || '',
      consequences: metricData.consequences || '',
      normalizeTime: metricData.normalizeTime || '',
      supplements: metricData.supplements || [],
      lifestyle: metricData.lifestyle || []
    };
    setSelectedMetric(metricInfo);
    setShowMetricModal(true);
  };

  const closeMetricModal = () => {
    setShowMetricModal(false);
    setSelectedMetric(null);
  };

  const handleDownload = async () => {
    const reportElement = document.getElementById('comprehensive-report-content');
    if (!reportElement) {
      toast.error('Could not find report content');
      return;
    }

    const toastId = toast.loading('Generating PDF...');

    try {
      // Temporarily hide elements that shouldn't be in the PDF
      const actionButtons = reportElement.querySelectorAll('.no-pdf');
      actionButtons.forEach(btn => btn.style.display = 'none');

      const canvas = await html2canvas(reportElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200 // Ensure desktop layout
      });

      // Restore hidden elements
      actionButtons.forEach(btn => btn.style.display = '');

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      const ratio = pdfWidth / imgWidth;
      let heightLeft = imgHeight * ratio;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight * ratio);
      heightLeft -= pdfHeight;

      // Add subsequent pages if content is longer than one page
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight * ratio;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight * ratio);
        heightLeft -= pdfHeight;
      }

      pdf.save(`Comprehensive_Analysis_${id.substring(0, 8)}.pdf`);
      toast.success('Report downloaded successfully!', { id: toastId });
    } catch (error) {
      console.error('PDF Generation Error:', error);
      toast.error('Failed to generate PDF. Falling back to print...', { id: toastId });
      window.print();
    }
  };

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

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Analyzing your report...</p>
      </div>
    </div>
  );

  if (!report) return <div className="text-center py-12 text-slate-400">Report not found</div>;

  const { aiAnalysis } = report;
  const healthScore = aiAnalysis?.healthScore || 0;

  const getHealthScoreColor = (score) => {
    if (score >= 80) return 'from-purple-500 to-orange-600';
    if (score >= 60) return 'from-purple-500 to-orange-600';
    return 'from-purple-500 to-orange-600';
  };

  const getMetricStatusColor = (status) => {
    if (status === 'normal') return 'bg-emerald-50 border-emerald-200';
    if (status === 'high') return 'bg-red-50 border-red-200';
    return 'bg-amber-50 border-amber-200';
  };

  const getStatusBadgeColor = (status) => {
    if (status === 'normal') return 'bg-emerald-100 text-emerald-700';
    if (status === 'high') return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
  };

  return (
    <div id="comprehensive-report-content" className="max-w-7xl mx-auto space-y-8 p-4 pb-12 bg-white">
      {/* Back Button */}
      <div className="flex items-center justify-between no-pdf">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" /> {isHindi ? 'डैशबोर्ड पर वापस जाएं' : 'Back to Dashboard'}
        </Link>
        <div className="flex gap-2">
          <button
            onClick={translateReport}
            disabled={translating}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all flex items-center gap-2 text-sm font-medium border border-slate-200 disabled:opacity-50"
          >
            <Languages className="w-4 h-4" />
            {translating ? 'Translating...' : isHindi ? 'English' : 'हिंदी में देखें'}
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all flex items-center gap-2 text-sm font-medium border border-slate-200"
          >
            <Download className="w-4 h-4" /> Save as PDF
          </button>
        </div>
      </div>

      {/* Header with Health Score */}
      <div className={`bg-gradient-to-r ${getHealthScoreColor(healthScore)} rounded-3xl p-8 text-white shadow-lg`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold mb-2">{isHindi ? 'पूर्ण स्वास्थ्य रिपोर्ट विश्लेषण' : 'Health Report Analysis'}</h1>
            <p className="text-white/80 text-base md:text-lg">
              {new Date(report.createdAt).toLocaleDateString(isHindi ? 'hi-IN' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl md:text-6xl font-bold mb-2">{healthScore}</div>
            <div className="text-sm text-white/80 font-medium">{isHindi ? 'स्वास्थ्य स्कोर' : 'Health Score'}</div>
            <div className="text-xs text-white/70 mt-1">
              {healthScore >= 80 ? (isHindi ? 'उत्कृष्ट' : 'Excellent') : healthScore >= 60 ? (isHindi ? 'अच्छा' : 'Good') : (isHindi ? 'ध्यान देने की आवश्यकता' : 'Needs Attention')}
            </div>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      {aiAnalysis?.summary && (
        <div className="bg-white rounded-2xl border-2 border-blue-200 p-6 md:p-8 shadow-sm">
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 md:w-6 md:h-6 text-blue-500" /> {isHindi ? 'रिपोर्ट सारांश' : 'Report Summary'}
          </h2>
          <p className="text-slate-700 leading-relaxed text-base md:text-lg whitespace-pre-wrap">{t(aiAnalysis.summary)}</p>
        </div>
      )}

      {/* Key Findings */}
      {aiAnalysis?.keyFindings?.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 md:p-8 shadow-sm">
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Heart className="w-5 h-5 md:w-6 md:h-6 text-red-500" /> {isHindi ? 'प्रमुख निष्कर्ष' : 'Key Findings'}
          </h2>
          <div className="space-y-3">
            {aiAnalysis.keyFindings.map((finding, i) => (
              <div key={i} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-1" />
                <p className="text-slate-700 text-base">{t(finding)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Metrics */}
      {aiAnalysis?.metrics && Object.keys(aiAnalysis.metrics).length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 md:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Activity className="w-5 h-5 md:w-6 md:h-6 text-cyan-500" /> {isHindi ? 'स्वास्थ्य मेट्रिक्स - विस्तृत विश्लेषण' : 'Health Metrics - Detailed Analysis'}
            </h2>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { id: 'all', label: isHindi ? 'सभी' : 'All', color: 'slate' },
                { id: 'normal', label: isHindi ? 'सामान्य' : 'Normal', color: 'emerald' },
                { id: 'high', label: isHindi ? 'अधिक' : 'High', color: 'red' },
                { id: 'low', label: isHindi ? 'कम' : 'Low', color: 'amber' }
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setMetricFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest border transition-all ${metricFilter === filter.id
                    ? `bg-slate-800 text-white border-slate-800 shadow-md`
                    : `bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100`
                    }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-1 gap-3 md:gap-4">
            {Object.entries(aiAnalysis.metrics)
              .filter(([_, m]) => {
                if (metricFilter === 'all') return true;
                return (m.status || '').toLowerCase() === metricFilter;
              })
              .map(([key, metric]) => (
                <div
                  key={key}
                  className={`border-2 rounded-xl overflow-hidden transition-all ${getMetricStatusColor(metric.status)} hover:shadow-md col-span-1 md:col-span-1`}
                >
                  <button
                    onClick={() => handleMetricClick(key, metric)}
                    className="w-full p-3 md:p-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-black/5 transition-colors gap-2"
                  >
                    <div className="flex items-center gap-4 flex-1 text-left">
                      <div>
                        <h3 className="text-sm md:text-lg font-bold text-slate-800">{key}</h3>
                        <p className="text-[10px] md:text-sm text-slate-600 mt-1">
                          {isHindi ? 'वर्तमान' : 'Current'}: <span className="font-bold">{metric.value} {metric.unit}</span> <span className="hidden md:inline">|</span>
                          <span className="block md:inline"> {isHindi ? 'सामान्य' : 'Normal'}: <span className="font-bold">{metric.normalRange}</span></span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between w-full md:w-auto gap-3">
                      <span className={`px-2 md:px-3 py-1 rounded-full text-[8px] md:text-xs font-bold ${getStatusBadgeColor(metric.status)}`}>
                        {metric.status.toUpperCase()}
                      </span>
                      <Info className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />
                    </div>
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Deficiencies */}
      {aiAnalysis?.deficiencies?.length > 0 && (
        <div className="bg-white rounded-2xl border-l-4 border-amber-500 border-t-2 border-r-2 border-b-2 border-t-slate-200 border-r-slate-200 border-b-slate-200 p-6 md:p-8 shadow-sm">
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-amber-500" /> {isHindi ? 'स्वास्थ्य कमियाँ' : 'Health Deficiencies'}
          </h2>
          <div className="space-y-4">
            {aiAnalysis.deficiencies.map((def, i) => (
              <div
                key={i}
                className={`p-4 md:p-6 rounded-xl border-2 ${def.severity === 'Severe'
                  ? 'bg-red-50 border-red-200'
                  : def.severity === 'Moderate'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-yellow-50 border-yellow-200'
                  }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-base md:text-lg font-bold text-slate-800">{t(def.name)}</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] md:text-xs font-bold ${def.severity === 'Severe'
                      ? 'bg-red-100 text-red-700'
                      : def.severity === 'Moderate'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-yellow-100 text-yellow-700'
                      }`}
                  >
                    {def.severity}
                  </span>
                </div>
                {def.explanation && <p className="text-sm md:text-base text-slate-700 mb-3">{t(def.explanation)}</p>}
                {def.symptoms?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs md:text-sm font-semibold text-slate-700 mb-2">{isHindi ? 'लक्षण:' : 'Symptoms:'}</p>
                    <div className="flex flex-wrap gap-2">
                      {def.symptoms.map((symptom, j) => (
                        <span key={j} className="text-[10px] md:text-xs bg-white px-2 py-1 rounded border border-slate-300">
                          {t(symptom)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {def.currentValue && (
                  <p className="text-[10px] md:text-sm text-slate-600">
                    <strong>{isHindi ? 'वर्तमान' : 'Current'}:</strong> {def.currentValue} | <strong>{isHindi ? 'सामान्य' : 'Normal'}:</strong> {def.normalRange}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diet Plan */}
      {aiAnalysis?.dietPlan && Object.keys(aiAnalysis.dietPlan).length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 md:p-8 shadow-sm">
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Apple className="w-5 h-5 md:w-6 md:h-6 text-emerald-500" /> {isHindi ? 'व्यक्तिगत आहार योजना' : 'Personalized Diet Plan'}
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {aiAnalysis.dietPlan.breakfast?.length > 0 && (
              <div className="p-4 md:p-6 bg-orange-50 rounded-xl border-2 border-orange-200">
                <h3 className="font-bold text-orange-700 mb-3 text-base md:text-lg">🌅 {isHindi ? 'नाश्ता' : 'Breakfast'}</h3>
                <div className="space-y-4">
                  {aiAnalysis.dietPlan.breakfast.map((item, i) => (
                    <div key={i} className="p-3 bg-white rounded-lg border border-orange-100">
                      <p className="font-semibold text-orange-800 text-sm md:text-base">{t(item.meal)}</p>
                      {item.nutrients && <p className="text-[10px] md:text-xs text-orange-600/80 mt-1">{isHindi ? 'पोषक तत्व' : 'Nutrients'}: {Array.isArray(item.nutrients) ? item.nutrients.join(', ') : t(item.nutrients)}</p>}
                      {item.tip && <p className="text-[10px] md:text-xs text-orange-500 italic mt-1">💡 {t(item.tip)}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiAnalysis.dietPlan.lunch?.length > 0 && (
              <div className="p-4 md:p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
                <h3 className="font-bold text-blue-700 mb-3 text-base md:text-lg">☀️ {isHindi ? 'दोपहर का भोजन' : 'Lunch'}</h3>
                <div className="space-y-4">
                  {aiAnalysis.dietPlan.lunch.map((item, i) => (
                    <div key={i} className="p-3 bg-white rounded-lg border border-blue-100">
                      <p className="font-semibold text-blue-800 text-sm md:text-base">{t(item.meal)}</p>
                      {item.nutrients && <p className="text-[10px] md:text-xs text-blue-600/80 mt-1">{isHindi ? 'पोषक तत्व' : 'Nutrients'}: {Array.isArray(item.nutrients) ? item.nutrients.join(', ') : t(item.nutrients)}</p>}
                      {item.tip && <p className="text-[10px] md:text-xs text-blue-500 italic mt-1">💡 {t(item.tip)}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiAnalysis.dietPlan.dinner?.length > 0 && (
              <div className="p-4 md:p-6 bg-purple-50 rounded-xl border-2 border-purple-200">
                <h3 className="font-bold text-purple-700 mb-3 text-base md:text-lg">🌙 {isHindi ? 'रात का खाना' : 'Dinner'}</h3>
                <div className="space-y-4">
                  {aiAnalysis.dietPlan.dinner.map((item, i) => (
                    <div key={i} className="p-3 bg-white rounded-lg border border-purple-100">
                      <p className="font-semibold text-purple-800 text-sm md:text-base">{t(item.meal)}</p>
                      {item.nutrients && <p className="text-[10px] md:text-xs text-purple-600/80 mt-1">{isHindi ? 'पोषक तत्व' : 'Nutrients'}: {Array.isArray(item.nutrients) ? item.nutrients.join(', ') : t(item.nutrients)}</p>}
                      {item.tip && <p className="text-[10px] md:text-xs text-purple-500 italic mt-1">💡 {t(item.tip)}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiAnalysis.dietPlan.snacks?.length > 0 && (
              <div className="p-4 md:p-6 bg-green-50 rounded-xl border-2 border-green-200">
                <h3 className="font-bold text-green-700 mb-3 text-base md:text-lg">🍏 {isHindi ? 'स्वस्थ स्नैक्स' : 'Healthy Snacks'}</h3>
                <div className="space-y-4">
                  {aiAnalysis.dietPlan.snacks.map((item, i) => (
                    <div key={i} className="p-3 bg-white rounded-lg border border-green-100">
                      <p className="font-semibold text-green-800 text-sm md:text-base">{t(item.meal)}</p>
                      {item.nutrients && <p className="text-[10px] md:text-xs text-green-600/80 mt-1">{isHindi ? 'पोषक तत्व' : 'Nutrients'}: {Array.isArray(item.nutrients) ? item.nutrients.join(', ') : t(item.nutrients)}</p>}
                      {item.tip && <p className="text-[10px] md:text-xs text-green-500 italic mt-1">💡 {t(item.tip)}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiAnalysis.dietPlan.hydration && (
              <div className="p-4 md:p-6 bg-cyan-50 rounded-xl border-2 border-cyan-200">
                <h3 className="font-bold text-cyan-700 mb-3 text-base md:text-lg">💧 {isHindi ? 'हाइड्रेशन' : 'Hydration'}</h3>
                <p className="text-sm text-cyan-700">{t(aiAnalysis.dietPlan.hydration)}</p>
              </div>
            )}

            {aiAnalysis.dietPlan.mealTiming && (
              <div className="p-4 md:p-6 bg-indigo-50 rounded-xl border-2 border-indigo-200">
                <h3 className="font-bold text-indigo-700 mb-3 text-base md:text-lg">⏰ {isHindi ? 'भोजन का समय' : 'Meal Timing'}</h3>
                <p className="text-sm text-indigo-700">{t(aiAnalysis.dietPlan.mealTiming)}</p>
              </div>
            )}
          </div>

          <div className="mt-6 p-6 bg-red-50 rounded-xl border-2 border-red-200">
            <h3 className="font-bold text-red-700 mb-3 text-lg">❌ {isHindi ? 'इन खाद्य पदार्थों से बचें' : 'Foods to Avoid'}</h3>
            <div className="flex flex-wrap gap-2">
              {aiAnalysis.dietPlan.foodsToAvoid.map((food, i) => (
                <span key={i} className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[10px] md:text-sm font-medium">
                  {t(food)}
                </span>
              ))}
            </div>
          </div>

          {aiAnalysis.dietPlan.notes && (
            <div className="mt-6 p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
              <h3 className="font-bold text-blue-700 mb-2">📝 {isHindi ? 'विशेष नोट' : 'Special Notes'}</h3>
              <p className="text-sm text-blue-700">{t(aiAnalysis.dietPlan.notes)}</p>
            </div>
          )}
        </div>
      )}

      {/* Fitness Plan */}
      {aiAnalysis?.fitnessPlan && Object.keys(aiAnalysis.fitnessPlan).length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 md:p-8 shadow-sm">
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Dumbbell className="w-5 h-5 md:w-6 md:h-6 text-blue-600" /> {isHindi ? 'व्यक्तिगत फिटनेस योजना' : 'Personalized Fitness Plan'}
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {aiAnalysis.fitnessPlan.cardio && (
              <div className="p-4 md:p-6 bg-red-50 rounded-xl border-2 border-red-200">
                <h3 className="font-bold text-red-700 mb-3 text-base md:text-lg">❤️ {isHindi ? 'कार्डियो' : 'Cardio'}</h3>
                <p className="text-sm text-red-700">{t(aiAnalysis.fitnessPlan.cardio)}</p>
              </div>
            )}

            {aiAnalysis.fitnessPlan.strength && (
              <div className="p-4 md:p-6 bg-orange-50 rounded-xl border-2 border-orange-200">
                <h3 className="font-bold text-orange-700 mb-3 text-base md:text-lg">💪 {isHindi ? 'शक्ति प्रशिक्षण' : 'Strength Training'}</h3>
                <p className="text-sm text-orange-700">{t(aiAnalysis.fitnessPlan.strength)}</p>
              </div>
            )}

            {aiAnalysis.fitnessPlan.flexibility && (
              <div className="p-6 bg-purple-50 rounded-xl border-2 border-purple-200">
                <h3 className="font-bold text-purple-700 mb-3 text-lg">🧘 Flexibility & Yoga</h3>
                <p className="text-sm text-purple-700">{t(aiAnalysis.fitnessPlan.flexibility)}</p>
              </div>
            )}

            {aiAnalysis.fitnessPlan.frequency && (
              <div className="p-4 md:p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
                <h3 className="font-bold text-blue-700 mb-3 text-base md:text-lg">📅 {isHindi ? 'आवृत्ति' : 'Frequency'}</h3>
                <p className="text-sm text-blue-700">{t(aiAnalysis.fitnessPlan.frequency)}</p>
              </div>
            )}

            {aiAnalysis.fitnessPlan.duration && (
              <div className="p-4 md:p-6 bg-green-50 rounded-xl border-2 border-green-200">
                <h3 className="font-bold text-green-700 mb-3 text-base md:text-lg">⏱️ {isHindi ? 'अवधि' : 'Duration'}</h3>
                <p className="text-sm text-green-700">{t(aiAnalysis.fitnessPlan.duration)}</p>
              </div>
            )}

            {aiAnalysis.fitnessPlan.intensity && (
              <div className="p-4 md:p-6 bg-yellow-50 rounded-xl border-2 border-yellow-200">
                <h3 className="font-bold text-yellow-700 mb-3 text-base md:text-lg">🔥 {isHindi ? 'तीव्रता' : 'Intensity'}</h3>
                <p className="text-sm text-yellow-700">{t(aiAnalysis.fitnessPlan.intensity)}</p>
              </div>
            )}
          </div>

          {aiAnalysis.fitnessPlan.precautions && (
            <div className="mt-6 p-6 bg-red-50 rounded-xl border-2 border-red-200">
              <h3 className="font-bold text-red-700 mb-3 text-lg">⚠️ {isHindi ? 'सावधानियां' : 'Precautions'}</h3>
              <p className="text-sm text-red-700">{t(aiAnalysis.fitnessPlan.precautions)}</p>
            </div>
          )}

          {aiAnalysis.fitnessPlan.progressionPlan && (
            <div className="mt-6 p-6 bg-emerald-50 rounded-xl border-2 border-emerald-200">
              <h3 className="font-bold text-emerald-700 mb-3 text-lg">📈 {isHindi ? 'प्रगति योजना' : 'Progression Plan'}</h3>
              <p className="text-sm text-emerald-700">{t(aiAnalysis.fitnessPlan.progressionPlan)}</p>
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs md:text-sm text-slate-500 text-center no-pdf">
        {isHindi ? 'अस्वीकरण: यह विश्लेषण केवल सूचनात्मक उद्देश्यों के लिए है। किसी भी चिकित्सा निर्णय लेने से पहले हमेशा एक योग्य स्वास्थ्य देखभाल पेशेवर से परामर्श लें।' : 'Disclaimer: This analysis is for informational purposes only. Always consult with a qualified healthcare professional before making any medical decisions.'}
      </p>

      {showMetricModal && selectedMetric && (
        <VitalDetailsPopup
          vital={selectedMetric}
          onClose={closeMetricModal}
          initialLanguage={isHindi ? 'hi' : 'en'}
        />
      )}
    </div>
  );
}
