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
        ...(aiAnalysis.dietPlan?.foodsToIncrease || []),
        ...(aiAnalysis.dietPlan?.foodsToLimit || []),
        ...(aiAnalysis.recommendations?.lifestyle || []),
        ...(aiAnalysis.deficiencies?.map(d => d.name) || []),
        ...(aiAnalysis.deficiencies?.map(d => d.explanation) || []),
        ...(aiAnalysis.deficiencies?.flatMap(d => d.symptoms) || []),
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-slate-200 border-t-black rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">Retrieving synthesis...</p>
        </div>
      </div>
    );
  }

  if (report?.status === 'processing') {
    return (
      <div className="max-w-4xl mx-auto py-20 px-6">
        <div className="bg-gradient-to-br from-slate-50 to-white rounded-[3rem] p-12 md:p-20 shadow-2xl border border-slate-100 text-center relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-emerald-50 rounded-full blur-3xl opacity-50" />
          <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-blue-50 rounded-full blur-3xl opacity-50" />
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl flex items-center justify-center mb-10 border border-slate-50">
               <Activity className="w-10 h-10 text-emerald-500 animate-pulse" />
            </div>
            
            <h1 className="text-4xl md:text-5xl font-black text-slate-800 mb-6 tracking-tight">ANALYIS IN PROGRESS</h1>
            <p className="text-slate-500 text-lg md:text-xl font-medium max-w-2xl mb-12 leading-relaxed">
              Our clinical AI is currently mapping your bio-markers. This usually takes <span className="text-emerald-600 font-bold">1-2 minutes</span>. Please relax while we synthesize your results.
            </p>

            <div className="w-full max-w-md h-2 bg-slate-100 rounded-full mb-16 overflow-hidden">
               <div className="h-full bg-slate-900 rounded-full animate-[progress_10s_ease-in-out_infinite]" />
            </div>

            <div className="grid md:grid-cols-2 gap-6 w-full">
               <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                  <Heart className="w-8 h-8 text-red-500 mb-4 mx-auto" />
                  <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-3">While you wait...</h3>
                  <p className="text-sm text-slate-500 mb-6 font-bold">Take a platform tour to see how our AI helps you master your health.</p>
                  <Link to="/dashboard" className="inline-block px-8 py-3 bg-slate-900 text-white rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all">Take a Tour</Link>
               </div>
               <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                  <Apple className="w-8 h-8 text-emerald-500 mb-4 mx-auto" />
                  <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-3">Need a Diet?</h3>
                  <p className="text-sm text-slate-500 mb-6 font-bold">Explore our personalized diet section and plan your healthy meals early.</p>
                  <Link to="/diet-plan" className="inline-block px-8 py-3 border border-slate-200 text-slate-800 rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">Go to Diet Plan</Link>
               </div>
            </div>
          </div>
        </div>
        <style>{`
           @keyframes progress {
             0% { width: 10%; }
             50% { width: 70%; }
             100% { width: 95%; }
           }
        `}</style>
      </div>
    );
  }

  if (!report) return <div className="text-center py-12 text-slate-400">Report not found</div>;

  const { aiAnalysis } = report;
  const healthScore = aiAnalysis?.healthScore || 0;

  const getHealthScoreColor = (score) => {
    return 'from-slate-900 via-slate-800 to-black';
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
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-black font-black uppercase text-[10px] tracking-widest transition-all">
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

      {/* Doctor's Analysis */}
      {(aiAnalysis?.doctorSummary || aiAnalysis?.summary) && (
        <div className="bg-white rounded-2xl border-2 border-slate-100 p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100">
              <span className="text-2xl">🩺</span>
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-slate-800">
                {isHindi ? 'डॉक्टर का विश्लेषण' : "Doctor's Analysis"}
              </h2>
              <p className="text-xs text-emerald-600 font-semibold">{isHindi ? 'एआई-संचालित नैदानिक मूल्यांकन' : 'AI-Powered Clinical Assessment'}</p>
            </div>
          </div>
          
          {aiAnalysis?.doctorSummary ? (
            <div className="bg-gradient-to-br from-emerald-50/50 to-slate-50 rounded-2xl p-6 md:p-8 border border-emerald-100/50 relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-100/30 rounded-full blur-3xl"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-emerald-100/50">
                  <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <Heart className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">{isHindi ? 'डॉक्टर की रिपोर्ट' : "Doctor's Note"}</p>
                    <p className="text-[10px] text-slate-400">Based on your lab results</p>
                  </div>
                </div>
                <p className="text-slate-700 leading-[1.9] text-base md:text-lg whitespace-pre-line">
                  {t(aiAnalysis.doctorSummary)}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {t(aiAnalysis.summary).split('\n').filter(line => line.trim()).map((line, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-black mt-2.5 flex-shrink-0" />
                  <p className="text-slate-700 leading-relaxed text-base md:text-lg">
                    {line.replace(/^[•\-\*]\s*/, '').trim()}
                  </p>
                </div>
              ))}
            </div>
          )}
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
                <CheckCircle className="w-5 h-5 text-black flex-shrink-0 mt-1" />
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
              <Activity className="w-5 h-5 md:w-6 md:h-6 text-black" /> {isHindi ? 'स्वास्थ्य मेट्रिक्स - विस्तृत विश्लेषण' : 'Health Metrics - Detailed Analysis'}
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

      {/* Generate Diet Plan CTA */}
      <div className="bg-white rounded-[2rem] border-2 border-emerald-100 p-8 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full -mr-32 -mt-32 opacity-50 transition-transform group-hover:scale-110" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100 shadow-sm">
                <Apple className="w-7 h-7 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">
                {isHindi ? 'व्यक्तिगत आहार योजना' : 'Personalized Diet Plan'}
              </h2>
            </div>
            <p className="text-slate-600 text-lg leading-relaxed max-w-2xl">
              {isHindi 
                ? 'अपनी रिपोर्ट के निष्कर्षों, फिटनेस लक्ष्यों और बीएमआई के आधार पर एक विस्तृत आहार योजना प्राप्त करें। हमारा एआई आपके लिए सही भोजन योजना बनाने के लिए सब कुछ एक साथ विश्लेषण करेगा।' 
                : "Get a comprehensive diet plan tailored to your report findings, fitness goals, and BMI. Our AI will analyze everything together to create the perfect meal plan for you."}
            </p>
          </div>
          <Link
            to="/diet-plan"
            className="inline-flex items-center justify-center gap-3 px-10 py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-emerald-200 hover:shadow-2xl hover:shadow-emerald-300 transition-all hover:-translate-y-1 active:scale-95 whitespace-nowrap"
          >
            <Sparkles className="w-5 h-5 text-emerald-300" />
            {isHindi ? 'विशेष रूप से आपके लिए व्यक्तिगत आहार योजना देखें' : 'View personalized diet plan specially for you'}
          </Link>
        </div>
      </div>


      {/* Fitness Plan */}
      {aiAnalysis?.fitnessPlan && Object.keys(aiAnalysis.fitnessPlan).length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 md:p-8 shadow-sm">
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Dumbbell className="w-5 h-5 md:w-6 md:h-6 text-black" /> {isHindi ? 'व्यक्तिगत फिटनेस योजना' : 'Personalized Fitness Plan'}
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
          t={t}
        />
      )}
    </div>
  );
}
