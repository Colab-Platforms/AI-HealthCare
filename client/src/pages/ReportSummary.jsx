import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { healthService } from '../services/api';
import { 
  ArrowLeft, Download, Share2, AlertTriangle, CheckCircle, TrendingDown, 
  Apple, Pill, Heart, Activity, X, UtensilsCrossed, Filter, Languages,
  Zap, Clock, Sparkles, ChevronRight, CheckCircle2, User2, Calendar, Coffee, Utensils
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import VitalDetailsPopup from '../components/VitalDetailsPopup';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { ImageWithFallback } from '../components/ImageWithFallback';

const dietPlanDefaults = {
  breakfast: [
    { title: "Oats & Berries", desc: "320 kcal • High Fiber", image: "https://images.unsplash.com/photo-1591535102082-a3fe217ef1bd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
    { title: "Spinach Omelette", desc: "280 kcal • Protein Rich", image: "https://images.unsplash.com/photo-1631182661308-c2c81d4e08b4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" }
  ],
  lunch: [
    { title: "Chicken & Rice", desc: "450 kcal • Balanced", image: "https://images.unsplash.com/photo-1762631934518-f75e233413ca?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
    { title: "Fish & Quinoa", desc: "410 kcal • Omega-3", image: "https://images.unsplash.com/photo-1704007573697-6a516da421ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" }
  ]
};

const healthTipsDefaults = [
  { title: "Daily Exercise", desc: "Aim for 5 days a week of mixed cardio and strength training.", image: "https://images.unsplash.com/photo-1771586791190-97ed536c54af?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
  { title: "Prioritize Sleep", desc: "Get 7-8 hours nightly to reduce inflammation and boost recovery.", image: "https://images.unsplash.com/photo-1631312113214-8f2f03a6962f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
  { title: "Manage Stress", desc: "Practice daily yoga or meditation to keep cortisol levels in check.", image: "https://images.unsplash.com/photo-1621691223255-b89d5623df3a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
  { title: "Stay Hydrated", desc: "Drink at least 8 glasses of water to maintain metabolic balance.", image: "https://images.unsplash.com/photo-1555704574-a9cfdfab06e0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" }
];

export default function ReportSummary() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [showMetricModal, setShowMetricModal] = useState(false);
  const [metricTab, setMetricTab] = useState('All');
  const [isHindi, setIsHindi] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [hindiCache, setHindiCache] = useState({});

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
      const textsToTranslate = [
        aiAnalysis.summary,
        aiAnalysis.doctorSummary,
        ...(aiAnalysis.doctorAdvice || []),
        ...(aiAnalysis.keyFindings || []),
        ...(aiAnalysis.recommendations?.lifestyle || []),
        aiAnalysis.doctorConsultation?.reason,
        ...Object.values(aiAnalysis.metrics || {}).flatMap(m => [
          m.whatItDoes,
          m.lowHighImpact,
          ...(m.topFoods || []),
          ...(m.symptoms || [])
        ])
      ].filter(Boolean);

      const batchText = textsToTranslate.join('\n---SPLIT---\n');
      const { data } = await api.post('translate', { text: batchText, targetLanguage: 'hi' });

      if (data.translatedText) {
        const translations = data.translatedText.split('---SPLIT---').map(s => s.trim());
        const cache = {};
        textsToTranslate.forEach((text, i) => { if (translations[i]) cache[text] = translations[i]; });
        setHindiCache(cache);
        setIsHindi(true);
        toast.success('Translated to Hindi!');
      }
    } catch (error) {
      toast.error('Translation failed.');
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
        toast.error('Failed to load summary');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [id]);

  const handleDownload = async () => {
    const reportElement = document.getElementById('report-summary-content');
    if (!reportElement) return;
    const toastId = toast.loading('Preparing Summary PDF...');
    try {
      const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', windowWidth: 375 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, canvas.height * (pdfWidth / canvas.width));
      pdf.save(`Summary_${report.reportType}.pdf`);
      toast.success('Summary downloaded!', { id: toastId });
    } catch (error) {
      toast.error('Failed to generate PDF.', { id: toastId });
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#F2F5EC]">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-white border-t-[#69A38D] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#69A38D] font-black uppercase tracking-widest text-[10px]">Loading Summary Synthesis...</p>
      </div>
    </div>
  );

  if (!report) return <div className="text-center py-20 bg-[#F2F5EC] min-h-screen font-black text-[#1a2138] uppercase">Analysis not found</div>;

  const { aiAnalysis } = report;
  const metrics = Object.entries(aiAnalysis?.metrics || {}).map(([name, data]) => ({
    name,
    value: typeof data === 'object' ? data.value : data,
    unit: typeof data === 'object' ? data.unit : '',
    status: (typeof data === 'object' ? data.status?.toUpperCase() : 'NORMAL') || 'NORMAL',
    range: typeof data === 'object' ? data.normalRange || data.range : ''
  }));

  const isProcessing = report.status === 'processing';

  const handleReanalyze = async () => {
    const toastId = toast.loading('Initiating Expert Recalibration...');
    try {
        await api.post(`/health/reports/${id}/reanalyze`);
        toast.success('AI Recalibration Started!', { id: toastId });
        // Refresh after a delay
        setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
        toast.error('Re-analysis initiation failed.', { id: toastId });
    }
  };

  // Processing Page (Dedicated full-screen analysis state)
  if (isProcessing) {
    return (
        <div className="min-h-screen bg-[#F2F5EC] flex flex-col pt-16 px-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-40">
                <div className="absolute top-[10%] right-[-10%] w-64 h-64 bg-[#69A38D]/20 rounded-full blur-[100px]" />
                <div className="absolute bottom-[20%] left-[-10%] w-80 h-80 bg-[#FFD1BA]/30 rounded-full blur-[120px]" />
            </div>

            <div className="flex flex-col items-center gap-8 relative z-10 text-center">
                <div className="relative">
                    <div className="w-24 h-24 rounded-[32px] bg-white shadow-2xl flex items-center justify-center border border-white relative z-20">
                        <Clock size={40} className="text-[#69A38D] animate-[spin_5s_linear_infinite]" />
                    </div>
                    <div className="absolute -inset-4 bg-[#69A38D]/10 rounded-[40px] animate-pulse z-10" />
                </div>

                <div className="flex flex-col gap-3">
                    <h2 className="text-3xl font-black text-[#1a2138] uppercase tracking-tight leading-tight">
                        Analyzing Your<br />Report...
                    </h2>
                    <p className="text-[15px] font-bold text-slate-500 leading-relaxed max-w-[280px] mx-auto">
                        Our medical AI is currently reading your bio-markers. This usually takes <span className="text-[#69A38D]">1-2 minutes</span>.
                    </p>
                </div>

                <div className="w-full max-w-[300px] h-3 bg-white rounded-full p-1 border border-white shadow-inner">
                    <div className="h-full bg-gradient-to-r from-[#69A38D] to-[#8BC34A] rounded-full animate-[progress_15s_ease-in-out_infinite]" style={{ width: '45%' }}></div>
                </div>

                {/* Platform Tour Suggestion */}
                <div className="bg-white/60 backdrop-blur-xl rounded-[40px] p-8 border border-white shadow-xl mt-8 w-full">
                    <div className="w-12 h-12 bg-[#69A38D]/10 rounded-2xl flex items-center justify-center mb-5 mx-auto">
                        <Sparkles size={24} className="text-[#69A38D]" />
                    </div>
                    <h3 className="text-lg font-black text-[#1a2138] mb-3 uppercase tracking-tight">While you wait...</h3>
                    <p className="text-sm font-bold text-slate-600 mb-8 leading-relaxed">
                        Take a quick platform tour to see how our AI can help you transform your health journey.
                    </p>
                    
                    <div className="flex flex-col gap-4">
                        <button 
                            onClick={() => navigate('/dashboard')}
                            className="w-full py-4 bg-[#1a2138] text-white rounded-[24px] font-bold text-sm tracking-widest uppercase shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
                        >
                            Take a Tour
                        </button>
                        <button 
                            onClick={() => navigate('/diet-plan')}
                            className="w-full py-4 bg-white text-[#1a2138] border border-slate-200 rounded-[24px] font-bold text-sm tracking-widest uppercase hover:bg-slate-50 active:scale-95 transition-all"
                        >
                            Explore Diet Plan
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes progress {
                    0% { width: 10%; }
                    50% { width: 65%; }
                    100% { width: 90%; }
                }
            `}</style>
        </div>
    );
  }

  const filteredMetrics = metrics.filter(m => {
    if (metricTab === 'All') return true;
    return m.status === metricTab.toUpperCase() || (metricTab === 'Borderline' && m.status === 'MODERATE');
  });

  return (
    <div id="report-summary-content" className="w-full min-h-screen bg-gradient-to-b from-[#F2F5EC] to-[#E5EBE0] dark:from-[#161719] dark:to-[#161719] pb-32 relative overflow-x-hidden animate-in fade-in duration-500">
      <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-br from-white/40 dark:from-white/5 to-transparent pointer-events-none" />
      
      {/* Dynamic Navigation Header */}
      <div className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 bg-[#F2F5EC]/80 dark:bg-[#161719]/80 backdrop-blur-md z-50 border-b border-white/50">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 bg-white shadow-sm border border-white rounded-full flex items-center justify-center text-[#1a2138] hover:scale-105 transition-all no-pdf"
          >
              <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <div className="flex flex-col items-center">
              <h1 className="text-[20px] font-black text-[#1a2138] dark:text-white tracking-tight leading-none uppercase">{isHindi ? 'संक्षिप्त सारांश' : 'Synthesis Summary'}</h1>
              <p className="text-[10px] text-[#69A38D] font-black uppercase tracking-widest mt-1">Diagnostic Abstract</p>
          </div>
          <div className="flex gap-2 no-pdf">
              <button onClick={translateReport} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isHindi ? 'bg-[#69A38D] text-white' : 'bg-white shadow-sm text-[#69A38D]'}`}>
                  <Languages size={15} />
              </button>
              <button onClick={handleShare} className="w-8 h-8 bg-white shadow-sm rounded-full flex items-center justify-center text-[#1a2138]"><Share2 size={15} /></button>
              <button onClick={handleDownload} className="w-8 h-8 bg-white shadow-sm rounded-full flex items-center justify-center text-[#1a2138]"><Download size={15} /></button>
          </div>
      </div>

      <div className="px-6 flex flex-col gap-8 max-w-4xl mx-auto relative z-10 pt-4">
          
          {/* Executive Highlight Card */}
          <div className="bg-white/60 backdrop-blur-xl rounded-[40px] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-white flex flex-col gap-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#69A38D]/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
              
              <div className="flex items-center justify-between relative z-10">
                 <div className="flex items-center gap-5">
                    <div className="w-20 h-20 rounded-[28px] bg-white shadow-lg border border-white flex flex-col items-center justify-center">
                        <span className="text-[32px] font-black text-[#1a2138] leading-none tracking-tighter">{aiAnalysis?.healthScore || 'N/A'}</span>
                        <span className="text-[8px] font-black text-[#69A38D] uppercase tracking-widest mt-1">Score</span>
                    </div>
                    <div className="flex flex-col">
                       <h2 className="text-[24px] font-black text-[#1a2138] leading-tight uppercase tracking-tight">{report.reportType}</h2>
                       <div className="flex items-center gap-3 text-slate-400 text-[11px] font-black uppercase tracking-widest mt-1">
                          <User2 size={14} className="text-[#69A38D]" />
                          <span>{report.patientName || 'Record Verified'}</span>
                       </div>
                    </div>
                 </div>
                 <div className="hidden sm:flex flex-col items-end">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Synthesis Timeline</span>
                    <span className="text-[16px] font-black text-[#1a2138]">{new Date(report.createdAt).toLocaleDateString()}</span>
                 </div>
              </div>

              <div className="flex flex-col gap-5 relative z-10">
                  <div className="flex items-center gap-3 mb-2">
                     <div className="w-10 h-10 rounded-full bg-[#69A38D]/10 flex items-center justify-center border border-[#69A38D]/20">
                        <span className="text-lg">🩺</span>
                     </div>
                     <div>
                        <h3 className="text-[14px] font-black text-[#1a2138] uppercase tracking-widest">{isHindi ? 'डॉक्टर का विश्लेषण' : "Doctor's Analysis"}</h3>
                        {!isProcessing && <p className="text-[9px] font-black text-[#69A38D] uppercase tracking-widest">AI-Powered Clinical assessment</p>}
                     </div>
                  </div>

                  {/* Doctor's Summary Card */}
                  <div className="bg-gradient-to-br from-[#f0f7f4]/80 to-white/90 rounded-[32px] p-7 border border-[#69A38D]/15 shadow-inner relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#69A38D]/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-125 transition-transform" />
                      <div className="text-[14.5px] text-[#2c3e50] font-medium leading-[1.8] whitespace-pre-line relative z-10 transition-all duration-500">
                          {t(aiAnalysis?.doctorSummary || aiAnalysis?.summary)}
                      </div>
                  </div>

                  {/* Quick Findings inside Summary for better readability */}
                  {aiAnalysis?.keyFindings?.length > 0 && (
                      <div className="bg-white/40 rounded-[28px] p-5 border border-white/60">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{isHindi ? 'मुख्य निष्कर्ष' : 'Key Findings'}</p>
                          <div className="flex flex-col gap-3">
                              {aiAnalysis.keyFindings.slice(0, 3).map((finding, idx) => (
                                  <div key={idx} className="flex items-start gap-3">
                                      <div className="w-5 h-5 rounded-full bg-[#69A38D]/10 flex items-center justify-center shrink-0 mt-0.5">
                                          <CheckCircle2 size={12} className="text-[#69A38D]" />
                                      </div>
                                      <p className="text-[13px] text-[#2c3e50] font-bold leading-snug">{t(finding)}</p>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
              </div>
          </div>

          {/* Key Findings Multi-Grid */}
          {aiAnalysis?.keyFindings?.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {aiAnalysis.keyFindings.map((finding, idx) => (
                 <div key={idx} className="bg-white/60 rounded-[32px] p-5 border border-white flex items-start gap-4 shadow-sm hover:bg-white/80 transition-all">
                    <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0 border border-slate-50"><CheckCircle2 size={20} className="text-[#69A38D]" strokeWidth={2.5} /></div>
                    <p className="text-[13px] font-bold text-[#1a2138] leading-relaxed pt-1">{t(finding)}</p>
                 </div>
               ))}
            </div>
          )}

          {/* Metrics Visualization Tabs */}
          {metrics.length > 0 && (
             <div className="flex flex-col gap-6">
                 <div className="flex items-center justify-between px-2">
                    <h2 className="text-[20px] font-black text-[#1a2138] leading-none uppercase tracking-tight">Core Bio-Markers</h2>
                    <div className="flex bg-white/60 rounded-full p-1 border border-white shadow-sm">
                       {['All', 'High'].map(tab => (
                         <button 
                           key={tab} 
                           onClick={() => setMetricTab(tab)}
                           className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${metricTab === tab ? 'bg-[#1a2138] text-white' : 'text-slate-400 hover:text-[#69A38D]'}`}
                         >
                           {tab}
                         </button>
                       ))}
                    </div>
                 </div>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {filteredMetrics.map((metric, idx) => {
                       const isNormal = metric.status === 'NORMAL' || metric.status === 'GOOD';
                       const isWarning = ['BORDERLINE', 'MODERATE', 'LOW'].includes(metric.status);
                       const colorClass = isNormal ? 'text-[#69A38D]' : isWarning ? 'text-[#E88F4A]' : 'text-[#5D5589]';
                       
                       const handleMetricClick = () => {
                           // Find the full metric data from aiAnalysis
                           const fullMetric = aiAnalysis?.metrics?.[metric.name] || {};
                           setSelectedMetric({
                               ...metric,
                               normalRange: metric.range,
                               whatIsThis: fullMetric.whatIsThis,
                               whatItDoes: fullMetric.whatItDoes,
                               lowHighImpact: fullMetric.lowHighImpact,
                               topFoods: fullMetric.topFoods,
                               symptoms: fullMetric.symptoms
                           });
                           setShowMetricModal(true);
                       };

                       return (
                         <div 
                           key={idx} 
                           onClick={handleMetricClick}
                           className="bg-white/60 rounded-[32px] p-4 border border-white shadow-sm flex flex-col gap-4 group hover:shadow-md transition-all cursor-pointer hover:bg-white active:scale-95"
                         >
                            <div className="flex items-center justify-between">
                               <span className={`text-[11px] font-black ${colorClass} uppercase tracking-widest`}>{metric.status}</span>
                               <div className="w-1.5 h-1.5 rounded-full bg-slate-200 group-hover:bg-[#69A38D] transition-colors"></div>
                            </div>
                            <h4 className="text-[13px] font-black text-[#1a2138] uppercase tracking-tight leading-snug line-clamp-2">{metric.name.replace(/([A-Z])/g, ' $1').trim()}</h4>
                            <div className="flex items-baseline gap-1 mt-auto">
                               <span className={`text-[20px] font-black tracking-tighter ${colorClass}`}>{metric.value}</span>
                               <span className="text-[9px] font-black text-slate-400 uppercase">{metric.unit}</span>
                            </div>
                         </div>
                       );
                    })}
                 </div>
             </div>
          )}

          {/* Nutritional Protocol CTA */}
          <div className="bg-white/60 backdrop-blur-xl rounded-[40px] p-8 shadow-[0_4px_25px_rgba(0,0,0,0.04)] border border-white flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#69A38D]/10 flex items-center justify-center border border-[#69A38D]/20 shadow-sm">
                <UtensilsCrossed size={24} className="text-[#69A38D]" />
              </div>
              <h2 className="text-[20px] font-black text-[#1a2138] uppercase tracking-tight">{isHindi ? 'पोषण प्रोटोकॉल' : 'Nutritional Protocol'}</h2>
            </div>
            <p className="text-[14px] text-[#2c3e50] font-bold leading-relaxed">
              {isHindi 
                ? 'अपनी क्लीनिकल रिपोर्ट के आधार पर हम आपके स्वास्थ्य के लिए एक विशेष आहार योजना तैयार करेंगे।' 
                : "Based on your clinical synthesis, we've prepared an optimized nutritional strategy to address your bio-marker needs."}
            </p>
            <Link
              to="/diet-plan?autoGenerate=true"
              className="w-full py-5 bg-[#69A38D] text-white rounded-[28px] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-[#528270] transition-all shadow-lg shadow-[#69A38D]/20 active:scale-[0.98]"
            >
              <Sparkles size={18} /> {isHindi ? 'व्यक्तिगत आहार योजना जनरेट करें' : 'GENERATE PERSONALIZED DIET PLAN'}
            </Link>
          </div>

          <div className="bg-[#69A38D] rounded-[40px] p-8 text-white shadow-xl flex flex-col gap-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Zap size={24} strokeWidth={3} fill="currentColor" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{isHindi ? 'डॉक्टर की सलाह' : "Doctor's Recommendations"}</h2>
                <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Based on your report findings</p>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              {(aiAnalysis?.doctorAdvice && aiAnalysis.doctorAdvice.length > 0 ? 
                aiAnalysis.doctorAdvice.map(advice => t(advice)) :
                [
                  isHindi ? "सप्ताह में 5 दिन व्यायाम करें" : "Exercise 5 days/week — mix cardio and strength training",
                  isHindi ? "प्रतिदिन 7-8 घंटे सोएं" : "Sleep 7-8 hours daily — poor sleep raises inflammation markers",
                  isHindi ? "योग या ध्यान के माध्यम से तनाव प्रबंधन" : "Manage stress through yoga or meditation — reduces cortisol and inflammation",
                  isHindi ? "धूम्रपान से बचें और शराब सीमित करें" : "Avoid smoking and limit alcohol — both lower HDL and raise hsCRP"
                ]
              ).map((step, idx) => (
                <div key={idx} className="bg-white/10 rounded-[32px] p-6 flex items-center gap-6 group hover:bg-white/15 transition-all">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-black shrink-0">
                    {idx + 1}
                  </div>
                  <p className="text-[15px] font-bold leading-snug">{step}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Disclaimer & Source Tracking */}
          <div className="flex flex-col items-center gap-4 pb-20 text-center px-8">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                 AI Summary is based on localized diagnostic synthesis. Results provided are for optimization support and verified bio-marker tracking. Record ID: {id.substring(0, 12)}
              </p>
              <div className="flex items-center gap-4">
                 <div className="w-2 h-2 rounded-full bg-[#69A38D]"></div>
                 <span className="text-[9px] font-black text-[#1a2138] uppercase tracking-[0.3em]">take.health AI Platform</span>
              </div>
          </div>
      </div>

      {showMetricModal && selectedMetric && (
        <VitalDetailsPopup
            vital={selectedMetric}
            onClose={() => {
                setShowMetricModal(false);
                setSelectedMetric(null);
            }}
            initialLanguage={isHindi ? 'hi' : 'en'}
            t={t}
        />
      )}
    </div>
  );
}
