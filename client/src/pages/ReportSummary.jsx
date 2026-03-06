import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { healthService } from '../services/api';
import { ArrowLeft, Download, Share2, AlertTriangle, CheckCircle, TrendingDown, Apple, Pill, Heart, Activity, X, UtensilsCrossed, Filter, Languages } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import VitalDetailsPopup from '../components/VitalDetailsPopup';
import GenericSkeleton from '../components/skeletons/GenericSkeleton';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function ReportSummary() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [showMetricModal, setShowMetricModal] = useState(false);
  const [metricFilter, setMetricFilter] = useState('all');
  const [isHindi, setIsHindi] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [hindiCache, setHindiCache] = useState({});

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
        ...(aiAnalysis.riskFactors || []),
        aiAnalysis.dietPlan?.overview,
        ...(aiAnalysis.dietPlan?.tips || []),
        ...(aiAnalysis.dietPlan?.foodsToIncrease || []),
        ...(aiAnalysis.dietPlan?.foodsToLimit || []),
        ...(aiAnalysis.recommendations?.immediate || []),
        ...(aiAnalysis.recommendations?.shortTerm || []),
        ...(aiAnalysis.recommendations?.longTerm || []),
        ...(aiAnalysis.recommendations?.lifestyle || []),
        aiAnalysis.doctorConsultation?.reason,
        ...Object.values(aiAnalysis.metrics || {}).flatMap(m => [
          m.whatItDoes,
          m.lowHighImpact,
          ...(m.topFoods || []),
          ...(m.symptoms || [])
        ])
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
        toast.success('Report translated to Hindi!');
      }
    } catch (error) {
      console.error('Translation error:', error);
      toast.error('Translation failed. Please try again.');
    } finally {
      setTranslating(false);
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

  const handleMetricClick = (metricName, metricData) => {
    setSelectedMetric({
      name: metricName,
      ...metricData
    });
    setShowMetricModal(true);
  };

  const closeMetricModal = () => {
    setShowMetricModal(false);
    setSelectedMetric(null);
  };

  const handleDownload = async () => {
    const reportElement = document.getElementById('report-content');
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
        backgroundColor: '#ffffff'
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

      pdf.save(`Health_Report_${report.reportType}_${id.substring(0, 8)}.pdf`);
      toast.success('Report downloaded successfully!', { id: toastId });
    } catch (error) {
      console.error('PDF Generation Error:', error);
      toast.error('Failed to generate PDF. Falling back to print...', { id: toastId });
      window.print();
    }
  };

  if (loading) return <GenericSkeleton />;
  if (!report) return <div className="text-center py-12 text-slate-400">Report not found</div>;

  const { aiAnalysis } = report;
  const healthScore = aiAnalysis?.healthScore || 0;

  return (
    <div id="report-content" className="max-w-6xl mx-auto space-y-6 animate-fade-in p-4 bg-white">
      <div className="flex items-center justify-between no-pdf">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-[#2FC8B9] font-black uppercase text-[10px] tracking-widest transition-all">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-orange-600 rounded-2xl p-8 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            {/* Patient Name */}
            {(report.patientName || aiAnalysis?.patientName) && (
              <div className="mb-3">
                <p className="text-sm text-white/60 uppercase tracking-wide">Patient Name</p>
                <p className="text-xl font-semibold">{report.patientName || aiAnalysis?.patientName}</p>
              </div>
            )}
            <h1 className="text-3xl font-bold mb-2">{report.reportType} Analysis</h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-white/70">
              <p>Analyzed on {new Date(report.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              {(report.reportDate || aiAnalysis?.reportDate) && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <p>Report Date: {new Date(report.reportDate || aiAnalysis?.reportDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </>
              )}
            </div>
          </div>
          <div className="text-center">
            <div className="text-5xl font-bold mb-2">{healthScore}</div>
            <div className="text-sm text-white/70">Health Score</div>
          </div>
          <div className="no-pdf flex flex-col gap-2">
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all flex items-center gap-2 text-sm font-medium border border-white/20"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
            <button
              onClick={translateReport}
              disabled={translating}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all flex items-center gap-2 text-sm font-medium border border-white/20 disabled:opacity-50"
            >
              <Languages className="w-4 h-4" />
              {translating ? 'Translating...' : isHindi ? 'English' : 'हिंदी'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      {aiAnalysis?.summary && (
        <div className="bg-white rounded-2xl border-2 border-blue-200 p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="w-6 h-6 text-cyan-500" /> {isHindi ? 'रिपोर्ट सारांश' : 'Report Summary'}
          </h2>
          <p className="text-slate-700 leading-relaxed text-lg whitespace-pre-wrap">{t(aiAnalysis.summary)}</p>
        </div>
      )}

      {/* Key Findings */}
      {aiAnalysis?.keyFindings?.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Heart className="w-6 h-6 text-red-500" /> {isHindi ? 'मुख्य निष्कर्ष' : 'Key Findings'}
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

      {/* All Metrics */}
      {aiAnalysis?.metrics && Object.keys(aiAnalysis.metrics).length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 md:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Activity className="w-5 h-5 md:w-6 md:h-6 text-cyan-500" /> {isHindi ? 'स्वास्थ्य मेट्रिक्स' : 'Health Metrics'}
            </h2>
            {/* Filter Buttons */}
            <div className="flex gap-1.5 flex-wrap">
              {[
                { id: 'all', label: isHindi ? 'सभी' : 'All', color: 'slate' },
                { id: 'normal', label: isHindi ? 'सामान्य' : 'Normal', color: 'emerald' },
                { id: 'high', label: isHindi ? 'अधिक' : 'High', color: 'red' },
                { id: 'low', label: isHindi ? 'कम' : 'Low', color: 'amber' },
                { id: 'borderline', label: isHindi ? 'सीमारेखा' : 'Borderline', color: 'orange' }
              ].map(filter => {
                const count = filter.id === 'all'
                  ? Object.keys(aiAnalysis.metrics).length
                  : Object.values(aiAnalysis.metrics).filter(m => (m.status || '').toLowerCase() === filter.id).length;
                if (filter.id !== 'all' && count === 0) return null;

                const colorClasses = {
                  slate: metricFilter === filter.id ? 'bg-slate-500 text-white border-slate-500 shadow-md' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
                  emerald: metricFilter === filter.id ? 'bg-emerald-500 text-white border-emerald-500 shadow-md' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
                  red: metricFilter === filter.id ? 'bg-red-500 text-white border-red-500 shadow-md' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
                  amber: metricFilter === filter.id ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
                  orange: metricFilter === filter.id ? 'bg-orange-500 text-white border-orange-500 shadow-md' : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
                };

                return (
                  <button
                    key={filter.id}
                    onClick={() => setMetricFilter(filter.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${colorClasses[filter.color]}`}
                  >
                    {filter.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {Object.entries(aiAnalysis.metrics)
              .filter(([, metric]) => metricFilter === 'all' || (metric.status || '').toLowerCase() === metricFilter)
              .map(([key, metric]) => (
                <button
                  key={key}
                  onClick={() => handleMetricClick(key, metric)}
                  className={`p-3 md:p-5 rounded-xl border-2 text-left transition-all hover:scale-[1.02] hover:shadow-lg cursor-pointer ${metric.status === 'normal'
                    ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300'
                    : metric.status === 'high'
                      ? 'bg-red-50 border-red-200 hover:border-red-300'
                      : 'bg-amber-50 border-amber-200 hover:border-amber-300'
                    }`}
                >
                  <p className="text-xs md:text-sm text-slate-600 font-medium mb-1 md:mb-2 truncate">{key}</p>
                  <p className="text-lg md:text-2xl font-bold text-slate-800 mb-1 md:mb-2">
                    {metric.value} <span className="text-xs md:text-sm font-normal text-slate-500">{metric.unit}</span>
                  </p>
                  <p className="text-[10px] md:text-xs text-slate-600 mb-2 md:mb-3">Normal: {metric.normalRange}</p>
                  <span
                    className={`inline-block px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-semibold ${metric.status === 'normal'
                      ? 'bg-emerald-100 text-emerald-700'
                      : metric.status === 'high'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                      }`}
                  >
                    {(metric.status || 'unknown').toUpperCase()}
                  </span>
                </button>
              ))}
          </div>
          {Object.entries(aiAnalysis.metrics).filter(([, m]) => metricFilter === 'all' || (m.status || '').toLowerCase() === metricFilter).length === 0 && (
            <p className="text-center text-slate-500 py-8">{isHindi ? 'इस फ़िल्टर के लिए कोई मेट्रिक्स नहीं मिला' : 'No metrics found for this filter'}</p>
          )}
        </div>
      )}

      {/* Deficiencies */}
      {aiAnalysis?.deficiencies?.length > 0 && (
        <div className="bg-white rounded-2xl border-l-4 border-amber-500 border-t-2 border-r-2 border-b-2 border-t-slate-200 border-r-slate-200 border-b-slate-200 p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" /> {isHindi ? 'पता चली कमियां' : 'Detected Deficiencies'}
          </h2>
          <div className="space-y-4">
            {aiAnalysis.deficiencies.map((def, i) => (
              <div
                key={i}
                className={`p-5 rounded-xl border-2 ${def.severity === 'Severe'
                  ? 'bg-red-50 border-red-200'
                  : def.severity === 'Moderate'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-yellow-50 border-yellow-200'
                  }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-bold text-slate-800">{t(def.name)}</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${def.severity === 'Severe'
                      ? 'bg-red-100 text-red-700'
                      : def.severity === 'Moderate'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-yellow-100 text-yellow-700'
                      }`}
                  >
                    {def.severity}
                  </span>
                </div>
                {def.explanation && <p className="text-slate-700 mb-3">{t(def.explanation)}</p>}
                {def.symptoms?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-slate-700 mb-2">{isHindi ? 'लक्षण:' : 'Symptoms:'}</p>
                    <div className="flex flex-wrap gap-2">
                      {def.symptoms.map((symptom, j) => (
                        <span key={j} className="text-xs bg-white px-2 py-1 rounded border border-slate-300">
                          {t(symptom)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Food Recommendations */}
      {aiAnalysis?.foodRecommendations && Object.keys(aiAnalysis.foodRecommendations).length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Apple className="w-6 h-6 text-emerald-500" /> {isHindi ? 'अनुशंसित खाद्य श्रेणियां' : 'Recommended Food Categories'}
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {Object.entries(aiAnalysis.foodRecommendations).map(([category, rec]) => (
              <div key={category} className="p-6 bg-emerald-50 rounded-xl border-2 border-emerald-200">
                <h3 className="font-bold text-emerald-700 mb-2 text-lg">{t(category)}</h3>
                {rec.explanation && <p className="text-sm text-emerald-600 mb-3">{t(rec.explanation)}</p>}
                {rec.frequency && <p className="text-xs text-emerald-700 font-medium mb-3">{isHindi ? 'आवृत्ति:' : 'Frequency:'} {t(rec.frequency)}</p>}
                {rec.foods && (
                  <div className="flex flex-wrap gap-2">
                    {rec.foods.map((food, i) => (
                      <span key={i} className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full font-medium">
                        {t(food)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Personalized Diet Plan */}
      {aiAnalysis?.dietPlan && (
        <div className="bg-white rounded-2xl border-l-4 border-green-500 border-t-2 border-r-2 border-b-2 border-t-slate-200 border-r-slate-200 border-b-slate-200 p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6 text-green-500" /> {isHindi ? 'व्यक्तिगत आहार योजना (4 विकल्प प्रति भोजन)' : 'Personalized Meal Plan (4 Options Per Meal)'}
          </h2>
          <p className="text-slate-700 mb-8 font-medium text-lg">{t(aiAnalysis.dietPlan.overview)}</p>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {aiAnalysis.dietPlan.breakfast?.length > 0 && (
              <div className="p-6 bg-orange-50 rounded-2xl border-2 border-orange-200 shadow-sm transition-all hover:shadow-md">
                <h3 className="font-bold text-orange-700 mb-4 text-xl flex items-center gap-2">🌅 {isHindi ? 'नाश्ता' : 'Breakfast'}</h3>
                <div className="space-y-4">
                  {aiAnalysis.dietPlan.breakfast.map((meal, i) => (
                    <div key={i} className="bg-white/60 p-4 rounded-xl border border-orange-100">
                      <p className="font-bold text-slate-800 text-base">{t(meal.meal)}</p>
                      {meal.nutrients && <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">{isHindi ? 'पोषक तत्व' : 'Nutrients'}: {Array.isArray(meal.nutrients) ? meal.nutrients.join(', ') : meal.nutrients}</p>}
                      {meal.tip && <p className="text-sm text-orange-600 italic mt-2">💡 {t(meal.tip)}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiAnalysis.dietPlan.lunch?.length > 0 && (
              <div className="p-6 bg-blue-50 rounded-2xl border-2 border-blue-200 shadow-sm transition-all hover:shadow-md">
                <h3 className="font-bold text-blue-700 mb-4 text-xl flex items-center gap-2">🥗 {isHindi ? 'दोपहर का भोजन' : 'Lunch'}</h3>
                <div className="space-y-4">
                  {aiAnalysis.dietPlan.lunch.map((meal, i) => (
                    <div key={i} className="bg-white/60 p-4 rounded-xl border border-blue-100">
                      <p className="font-bold text-slate-800 text-base">{t(meal.meal)}</p>
                      {meal.nutrients && <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">{isHindi ? 'पोषक तत्व' : 'Nutrients'}: {Array.isArray(meal.nutrients) ? meal.nutrients.join(', ') : meal.nutrients}</p>}
                      {meal.tip && <p className="text-sm text-blue-600 italic mt-2">💡 {t(meal.tip)}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiAnalysis.dietPlan.dinner?.length > 0 && (
              <div className="p-6 bg-indigo-50 rounded-2xl border-2 border-indigo-200 shadow-sm transition-all hover:shadow-md">
                <h3 className="font-bold text-indigo-700 mb-4 text-xl flex items-center gap-2">🌙 {isHindi ? 'रात का खाना' : 'Dinner'}</h3>
                <div className="space-y-4">
                  {aiAnalysis.dietPlan.dinner.map((meal, i) => (
                    <div key={i} className="bg-white/60 p-4 rounded-xl border border-indigo-100">
                      <p className="font-bold text-slate-800 text-base">{t(meal.meal)}</p>
                      {meal.nutrients && <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">{isHindi ? 'पोषक तत्व' : 'Nutrients'}: {Array.isArray(meal.nutrients) ? meal.nutrients.join(', ') : meal.nutrients}</p>}
                      {meal.tip && <p className="text-sm text-indigo-600 italic mt-2">💡 {t(meal.tip)}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiAnalysis.dietPlan.snacks?.length > 0 && (
              <div className="p-6 bg-pink-50 rounded-2xl border-2 border-pink-200 shadow-sm transition-all hover:shadow-md">
                <h3 className="font-bold text-pink-700 mb-4 text-xl flex items-center gap-2">🍎 {isHindi ? 'स्नैक्स' : 'Snacks'}</h3>
                <div className="space-y-4">
                  {aiAnalysis.dietPlan.snacks.map((meal, i) => (
                    <div key={i} className="bg-white/60 p-4 rounded-xl border border-pink-100">
                      <p className="font-bold text-slate-800 text-base">{t(meal.meal)}</p>
                      {meal.nutrients && <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">{isHindi ? 'पोषक तत्व' : 'Nutrients'}: {Array.isArray(meal.nutrients) ? meal.nutrients.join(', ') : meal.nutrients}</p>}
                      {meal.tip && <p className="text-sm text-pink-600 italic mt-2">💡 {t(meal.tip)}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {aiAnalysis.dietPlan.foodsToIncrease?.length > 0 && (
              <div className="p-6 bg-emerald-50 rounded-2xl border-2 border-emerald-200">
                <h3 className="font-bold text-emerald-700 mb-4 text-lg">✅ {isHindi ? 'इन खाद्य पदार्थों को बढ़ाएं' : 'Foods to Increase'}</h3>
                <div className="flex flex-wrap gap-2">
                  {aiAnalysis.dietPlan.foodsToIncrease.map((food, i) => (
                    <span key={i} className="bg-white px-3 py-1.5 rounded-lg border border-emerald-200 text-sm font-semibold text-emerald-800 shadow-sm">{t(food)}</span>
                  ))}
                </div>
              </div>
            )}

            {aiAnalysis.dietPlan.foodsToLimit?.length > 0 && (
              <div className="p-6 bg-red-50 rounded-2xl border-2 border-red-200">
                <h3 className="font-bold text-red-700 mb-4 text-lg">⚠️ {isHindi ? 'इन खाद्य पदार्थों को सीमित करें' : 'Foods to Limit'}</h3>
                <div className="flex flex-wrap gap-2">
                  {aiAnalysis.dietPlan.foodsToLimit.map((food, i) => (
                    <span key={i} className="bg-white px-3 py-1.5 rounded-lg border border-red-200 text-sm font-semibold text-red-800 shadow-sm">{t(food)}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {aiAnalysis.dietPlan.hydration && (
            <div className="p-6 bg-cyan-50 rounded-2xl border-2 border-cyan-200 mb-6">
              <h3 className="font-bold text-cyan-700 mb-2 flex items-center gap-2">💧 {isHindi ? 'जलयोजन' : 'Hydration'}</h3>
              <p className="text-slate-700 font-medium">{t(aiAnalysis.dietPlan.hydration)}</p>
            </div>
          )}

          {aiAnalysis.dietPlan.tips?.length > 0 && (
            <div className="p-6 bg-yellow-50 rounded-2xl border-2 border-yellow-200">
              <h3 className="font-bold text-yellow-700 mb-4 flex items-center gap-2">💡 {isHindi ? 'स्वास्थ्य युक्तियाँ' : 'Health Tips'}</h3>
              <ul className="space-y-3">
                {aiAnalysis.dietPlan.tips.map((tip, i) => (
                  <li key={i} className="text-slate-700 flex items-start gap-3">
                    <span className="bg-yellow-200 text-yellow-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span className="font-medium">{t(tip)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Supplement Recommendations */}
      {aiAnalysis?.supplementRecommendations && Object.keys(aiAnalysis.supplementRecommendations).length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Pill className="w-6 h-6 text-blue-600" /> {isHindi ? 'अनुशंसित सप्लीमेंट' : 'Recommended Supplements'}
          </h2>
          <div className="space-y-6">
            {Object.entries(aiAnalysis.supplementRecommendations).map(([category, supplements]) => (
              <div key={category}>
                <h3 className="font-bold text-blue-700 mb-4 text-lg">{t(category)}</h3>
                {Array.isArray(supplements) ? (
                  <div className="space-y-3">
                    {supplements.map((supp, i) => (
                      <div key={i} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-semibold text-slate-800">{t(supp.name)}</p>
                          {supp.frequency && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">{t(supp.frequency)}</span>}
                        </div>
                        {supp.dosage && <p className="text-sm text-slate-700 mb-1"><strong>{isHindi ? 'खुराक:' : 'Dosage:'}</strong> {t(supp.dosage)}</p>}
                        {supp.timing && <p className="text-sm text-slate-700 mb-1"><strong>{isHindi ? 'समय:' : 'Timing:'}</strong> {t(supp.timing)}</p>}
                        {supp.whyItHelps && <p className="text-sm text-slate-600 mb-1"><strong>{isHindi ? 'क्यों उपयोगी है:' : 'Why:'}</strong> {t(supp.whyItHelps)}</p>}
                        {supp.note && <p className="text-xs text-slate-600 italic">💡 {t(supp.note)}</p>}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {aiAnalysis?.recommendations && Object.keys(aiAnalysis.recommendations).length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Heart className="w-6 h-6 text-red-500" /> {isHindi ? 'स्वास्थ्य अनुशंसाएं' : 'Health Recommendations'}
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Immediate */}
            {aiAnalysis.recommendations.immediate?.length > 0 && (
              <div className="p-6 bg-red-50 rounded-xl border-2 border-red-200">
                <h3 className="font-bold text-red-700 mb-4 text-lg">🚨 {isHindi ? 'तत्काल कार्रवाई' : 'Immediate Actions'}</h3>
                <ul className="space-y-2">
                  {aiAnalysis.recommendations.immediate.map((action, i) => (
                    <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
                      {t(action)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Short-Term */}
            {aiAnalysis.recommendations.shortTerm?.length > 0 && (
              <div className="p-6 bg-amber-50 rounded-xl border-2 border-amber-200">
                <h3 className="font-bold text-amber-700 mb-4 text-lg">⏱️ {isHindi ? 'अल्पकालिक (2-4 सप्ताह)' : 'Short-Term (2-4 weeks)'}</h3>
                <ul className="space-y-2">
                  {aiAnalysis.recommendations.shortTerm.map((action, i) => (
                    <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 flex-shrink-0" />
                      {t(action)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Long-Term */}
            {aiAnalysis.recommendations.longTerm?.length > 0 && (
              <div className="p-6 bg-emerald-50 rounded-xl border-2 border-emerald-200">
                <h3 className="font-bold text-emerald-700 mb-4 text-lg">📅 {isHindi ? 'दीर्घकालिक (चल रहा है)' : 'Long-Term (Ongoing)'}</h3>
                <ul className="space-y-2">
                  {aiAnalysis.recommendations.longTerm.map((action, i) => (
                    <li key={i} className="text-sm text-emerald-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0" />
                      {t(action)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Diet */}
            {aiAnalysis.recommendations.diet && (
              <div className="p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
                <h3 className="font-bold text-blue-700 mb-4 text-lg">🍽️ {isHindi ? 'आहार अनुशंसाएं' : 'Diet Recommendations'}</h3>
                <p className="text-sm text-blue-700">{t(aiAnalysis.recommendations.diet)}</p>
              </div>
            )}

            {/* Lifestyle */}
            {aiAnalysis.recommendations.lifestyle?.length > 0 && (
              <div className="p-6 bg-violet-50 rounded-xl border-2 border-violet-200">
                <h3 className="font-bold text-violet-700 mb-4 text-lg">🏃 {isHindi ? 'जीवन शैली में बदलाव' : 'Lifestyle Changes'}</h3>
                <ul className="space-y-2">
                  {aiAnalysis.recommendations.lifestyle.map((action, i) => (
                    <li key={i} className="text-sm text-violet-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-violet-500 rounded-full mt-1.5 flex-shrink-0" />
                      {t(action)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Follow-Up Tests */}
            {aiAnalysis.recommendations.followUpTests?.length > 0 && (
              <div className="p-6 bg-cyan-50 rounded-xl border-2 border-cyan-200">
                <h3 className="font-bold text-cyan-700 mb-4 text-lg">🔬 {isHindi ? 'फॉलो-अप परीक्षण' : 'Follow-Up Tests'}</h3>
                <ul className="space-y-2">
                  {aiAnalysis.recommendations.followUpTests.map((test, i) => (
                    <li key={i} className="text-sm text-cyan-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full mt-1.5 flex-shrink-0" />
                      {t(test)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
        <p className="text-sm text-blue-700">
          <strong>{isHindi ? 'अस्वीकरण:' : 'Disclaimer:'}</strong> {isHindi ? 'यह AI विश्लेषण केवल सूचनात्मक कल्याण सहायता के लिए है और इसे पेशेवर चिकित्सा सलाह की जगह नहीं लेना चाहिए। चिकित्सा निर्णयों के लिए हमेशा स्वास्थ्य सेवा प्रदाता से परामर्श लें।' : 'This AI analysis is for informational wellness support only and should not replace professional medical advice. Always consult with a healthcare provider for medical decisions.'}
        </p>
      </div>

      {/* Metric Details Modal */}
      {showMetricModal && selectedMetric && (
        <VitalDetailsPopup
          vital={selectedMetric}
          onClose={closeMetricModal}
          initialLanguage={isHindi ? 'hi' : 'en'}
          t={t}
        />
      )}
    </div>
  );
}
