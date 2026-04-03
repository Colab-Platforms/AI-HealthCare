import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { healthService } from '../services/api';
import api from '../services/api';
import {
    ArrowLeft, Share2, Download, FileText, Activity,
    CheckCircle, AlertCircle, AlertTriangle, Apple,
    Zap, Sun, Clock, XCircle, Dumbbell, Calendar, Building2, User2, UtensilsCrossed,
    Mail, Languages, Filter, Layers, Sparkles, ChevronRight, CheckCircle2, Apple as AppleIcon, Coffee, Utensils
} from 'lucide-react';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import VitalDetailsPopup from '../components/VitalDetailsPopup';
import { useData } from '../context/DataContext';
import { ImageWithFallback } from '../components/ImageWithFallback';

const dietPlanDefaults = {
  breakfast: [
    { title: "Oats & Berries", desc: "320 kcal • High Fiber", image: "https://images.unsplash.com/photo-1591535102082-a3fe217ef1bd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
    { title: "Spinach Omelette", desc: "280 kcal • Protein Rich", image: "https://images.unsplash.com/photo-1631182661308-c2c81d4e08b4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" }
  ],
  lunch: [
    { title: "Chicken & Rice", desc: "450 kcal • Balanced", image: "https://images.unsplash.com/photo-1762631934518-f75e233413ca?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
    { title: "Fish & Quinoa", desc: "410 kcal • Omega-3", image: "https://images.unsplash.com/photo-1704007573697-6a516da421ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" }
  ],
  snack: [
    { title: "Mixed Nuts", desc: "180 kcal • Healthy Fats", image: "https://images.unsplash.com/photo-1671981200629-014c03829abb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
    { title: "Fresh Fruit Bowl", desc: "120 kcal • Vitamins", image: "https://images.unsplash.com/photo-1588068403046-169c80c69938?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" }
  ],
  dinner: [
    { title: "Veggie Soup", desc: "210 kcal • Light", image: "https://images.unsplash.com/photo-1643786661490-966f1877effa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
    { title: "Chicken Salad", desc: "340 kcal • Low Carb", image: "https://images.unsplash.com/photo-1604909052743-94e838986d24?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" }
  ]
};

const healthTipsDefaults = [
  { title: "Daily Exercise", desc: "Aim for 5 days a week of mixed cardio and strength training.", image: "https://images.unsplash.com/photo-1771586791190-97ed536c54af?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
  { title: "Prioritize Sleep", desc: "Get 7-8 hours nightly to reduce inflammation and boost recovery.", image: "https://images.unsplash.com/photo-1631312113214-8f2f03a6962f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
  { title: "Manage Stress", desc: "Practice daily yoga or meditation to keep cortisol levels in check.", image: "https://images.unsplash.com/photo-1621691223255-b89d5623df3a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
  { title: "Stay Hydrated", desc: "Drink at least 8 glasses of water to maintain metabolic balance.", image: "https://images.unsplash.com/photo-1555704574-a9cfdfab06e0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" }
];

export default function ReportAnalysisMobile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addPendingAnalysis, pendingAnalysisIds, dataRefreshTrigger } = useData();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isHindi, setIsHindi] = useState(false);
    const [translating, setTranslating] = useState(false);
    const [hindiCache, setHindiCache] = useState({});
    const [metricTab, setMetricTab] = useState('All');
    const [selectedMetric, setSelectedMetric] = useState(null);
    const [showMetricModal, setShowMetricModal] = useState(false);

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

    useEffect(() => {
        const fetchReport = async () => {
            try {
                const { data } = await healthService.getReport(id);
                setReport(data.report);
                if (data.report.status === 'processing') {
                    if (!pendingAnalysisIds.includes(id)) addPendingAnalysis(id);
                }
            } catch (error) {
                toast.error('Failed to load report');
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, [id, addPendingAnalysis]);

    useEffect(() => {
        if (report?.status === 'processing' && !pendingAnalysisIds.includes(id)) {
            const fetchUpdated = async () => {
                const { data } = await healthService.getReport(id);
                setReport(data.report);
            };
            fetchUpdated();
        }
    }, [pendingAnalysisIds, id, report?.status]);

    useEffect(() => {
        if (dataRefreshTrigger > 0) {
            const fetchUpdated = async () => {
                const { data } = await healthService.getReport(id);
                setReport(data.report);
            };
            fetchUpdated();
        }
    }, [dataRefreshTrigger, id]);

    const handleShare = () => {
        const shareText = `Check out my ${report?.reportType} health report analysis! Health Score: ${report?.aiAnalysis?.healthScore}/100`;
        const shareUrl = window.location.href;
        if (navigator.share) {
            navigator.share({ title: 'Health Report Analysis', text: shareText, url: shareUrl });
        } else {
            window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`, '_blank');
        }
    };

    const handleDownload = async () => {
        const reportElement = document.getElementById('report-mobile-content');
        if (!reportElement) return;
        const toastId = toast.loading('Preparing PDF...');
        try {
            const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', windowWidth: 375 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, canvas.height * (pdfWidth / canvas.width));
            pdf.save(`Health_Report_${id.substring(0, 8)}.pdf`);
            toast.success('Report downloaded!', { id: toastId });
        } catch (error) {
            toast.error('Failed to generate PDF.', { id: toastId });
        }
    };

    const closeMetricModal = () => { setShowMetricModal(false); setSelectedMetric(null); };

    if (loading) return (
        <div className="flex items-center justify-center h-screen bg-[#F2F5EC]">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-white border-t-[#69A38D] rounded-full animate-spin mx-auto mb-4" />
                <p className="text-[#69A38D] font-black uppercase tracking-widest text-xs">Loading Synthesis...</p>
            </div>
        </div>
    );

    if (!report) return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#F2F5EC] px-6">
            <AlertTriangle className="w-16 h-16 text-[#FF8A66] mb-4" />
            <h2 className="text-xl font-bold text-[#1a1a1a] mb-2">Report Not Found</h2>
            <button onClick={() => navigate('/upload')} className="px-8 py-3 bg-[#69A38D] text-white font-bold rounded-full">Back to AI Analyzer</button>
        </div>
    );

    const { aiAnalysis } = report;
    const isProcessing = report.status === 'processing';
    const metrics = Object.entries(aiAnalysis?.metrics || {}).map(([name, data]) => ({
      name,
      value: typeof data === 'object' ? data.value : data,
      unit: typeof data === 'object' ? data.unit : '',
      status: (typeof data === 'object' ? data.status?.toUpperCase() : 'NORMAL') || 'NORMAL',
      range: typeof data === 'object' ? data.normalRange || data.range : ''
    }));

    const filteredMetrics = metrics.filter(m => {
        if (metricTab === 'All') return true;
        return m.status === metricTab.toUpperCase() || (metricTab === 'Borderline' && m.status === 'MODERATE');
    });

    const normalCount = metrics.filter(m => m.status === 'NORMAL' || m.status === 'GOOD').length;
    const borderlineCount = metrics.filter(m => m.status === 'BORDERLINE' || m.status === 'MODERATE' || m.status === 'LOW').length;
    const highCount = metrics.filter(m => m.status === 'HIGH' || m.status === 'CRITICAL' || m.status === 'ABNORMAL').length;

    return (
        <div id="report-mobile-content" className="min-h-screen bg-gradient-to-b from-[#F2F5EC] to-[#E5EBE0] dark:from-[#161719] dark:to-[#161719] pb-32 relative overflow-x-hidden">
            <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-br from-white/40 dark:from-white/5 to-transparent pointer-events-none" />
            
            {/* Header */}
            <div className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 bg-[#F2F5EC]/80 dark:bg-[#161719]/80 backdrop-blur-md z-50 border-b border-white/50">
                <button 
                  onClick={() => navigate('/upload')}
                  className="w-10 h-10 bg-white shadow-sm border border-white rounded-full flex items-center justify-center text-[#1a2138] hover:scale-105 transition-all no-pdf"
                >
                    <ArrowLeft size={20} strokeWidth={2.5} />
                </button>
                <div className="flex flex-col items-center">
                    <h1 className="text-[20px] font-black text-[#1a2138] dark:text-white tracking-tight leading-none uppercase">{isHindi ? 'रिपोर्ट विश्लेषण' : 'Clinical Synthesis'}</h1>
                    <p className="text-[10px] text-[#69A38D] font-black uppercase tracking-widest mt-1">AI-Powered Insights</p>
                </div>
                <div className="flex gap-2 no-pdf">
                    <button onClick={translateReport} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isHindi ? 'bg-[#69A38D] text-white' : 'bg-white shadow-sm text-[#69A38D]'}`}>
                        <Languages size={15} />
                    </button>
                    <button onClick={handleShare} className="w-8 h-8 bg-white shadow-sm rounded-full flex items-center justify-center text-[#1a2138]"><Share2 size={15} /></button>
                    <button onClick={handleDownload} className="w-8 h-8 bg-white shadow-sm rounded-full flex items-center justify-center text-[#1a2138]"><Download size={15} /></button>
                </div>
            </div>

            <div className="px-5 flex flex-col gap-5 relative z-10 max-w-4xl mx-auto">
                
                {/* Info Card */}
                <div className="bg-white/60 backdrop-blur-xl rounded-[40px] p-6 shadow-[0_4px_25px_rgba(0,0,0,0.04)] border border-white flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-[#E2EED2] flex items-center justify-center shadow-inner">
                                <FileText size={24} className="text-[#69A38D]" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-[#64748b] uppercase tracking-widest mb-0.5">{isHindi ? 'रिपोर्ट प्रकार' : 'Diagnostic Profile'}</span>
                                <span className="text-[18px] font-black text-[#1a2138] uppercase tracking-tight leading-none">{report.reportType}</span>
                            </div>
                        </div>
                        <div className={`flex items-center gap-1.5 px-4 py-2 ${isProcessing ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-[#69A38D]/10 text-[#69A38D] border-[#69A38D]/20'}  rounded-full border shadow-sm`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isProcessing ? 'bg-amber-500 animate-pulse' : 'bg-[#69A38D]'}`}></div>
                            <span className="text-[10px] font-black tracking-widest uppercase">{isProcessing ? 'Analyzing' : 'Complete'}</span>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 border-t border-white/50 pt-6">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black text-[#64748b] uppercase tracking-widest">{isHindi ? 'रोगी' : 'Subject'}</span>
                            <div className="flex items-center gap-2 text-[#1a2138]">
                                <User2 size={14} className="text-[#69A38D]" />
                                <span className="text-[14px] font-black uppercase tracking-tight">{report.patientName || 'Clinical Record'}</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1 text-right">
                            <span className="text-[10px] font-black text-[#64748b] uppercase tracking-widest">{isHindi ? 'तारीख' : 'Timeline'}</span>
                            <div className="flex items-center gap-2 text-[#1a2138] justify-end">
                                <Calendar size={14} className="text-[#69A38D]" />
                                <span className="text-[14px] font-black">{new Date(report.reportDate || report.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Processing or Executive Summary */}
                <div className="bg-white/60 backdrop-blur-xl rounded-[40px] p-6 shadow-[0_4px_25px_rgba(0,0,0,0.04)] border border-white">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-full bg-white shadow-sm border border-white flex items-center justify-center">
                            {isProcessing ? <Clock size={20} className="text-amber-500 animate-spin" /> : <Activity size={20} className="text-[#69A38D]" />}
                        </div>
                        <h2 className="text-[20px] font-black text-[#1a2138] uppercase tracking-tight">{isProcessing ? 'Extracting Data' : (isHindi ? 'कार्यकारी सारांश' : 'Executive Summary')}</h2>
                    </div>
                    
                    {isProcessing ? (
                        <div className="bg-white/80 rounded-[24px] p-6 border border-[#69A38D]/10">
                            <p className="text-[#64748b] font-bold leading-relaxed mb-6">Our optimization engine is reading your report values. This usually takes 1-2 minutes.</p>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-2">
                                <div className="bg-[#69A38D] h-full animate-pulse" style={{ width: '45%' }}></div>
                            </div>
                            <span className="text-[10px] font-black text-[#69A38D] uppercase tracking-widest">Processing Bio-Markers...</span>
                        </div>
                    ) : (
                        <div className="bg-white/80 rounded-[24px] p-6 border border-white shadow-inner">
                            <p className="text-[14px] text-[#2c3e50] font-bold leading-relaxed">{t(aiAnalysis?.summary)}</p>
                        </div>
                    )}
                </div>

                {/* Metrics */}
                {!isProcessing && metrics.length > 0 && (
                    <div className="flex flex-col gap-6 pt-2">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-3">
                                <h2 className="text-[22px] font-black text-[#1a2138] uppercase tracking-tight leading-none">{isHindi ? 'स्वास्थ्य मेट्रिक्स' : 'Bio-Marker Metrics'}</h2>
                                <span className="bg-white/80 px-3 py-1 rounded-full border border-white text-[10px] font-black text-slate-400 uppercase tracking-widest">{metrics.length} Total</span>
                            </div>
                            <div className="flex bg-white/60 backdrop-blur-md rounded-full p-1.5 border border-white overflow-x-auto no-scrollbar shadow-sm">
                                {['All', 'Normal', 'Borderline', 'High'].map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setMetricTab(tab)}
                                        className={`px-4 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all shrink-0 flex-1 text-center ${metricTab === tab ? 'bg-[#69A38D] text-white shadow-md' : 'text-[#64748b] hover:text-[#69A38D]'}`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { label: 'Optimal', count: normalCount, color: 'text-[#69A38D]', bg: 'bg-[#69A38D]/10', icon: CheckCircle2 },
                                { label: 'Caution', count: borderlineCount, color: 'text-[#E88F4A]', bg: 'bg-[#E88F4A]/10', icon: AlertCircle },
                                { label: 'Critical', count: highCount, color: 'text-[#5D5589]', bg: 'bg-[#5D5589]/10', icon: AlertTriangle }
                            ].map((stat, i) => (
                                <div key={i} className="bg-white/60 rounded-[30px] p-5 flex flex-col items-center border border-white gap-3 shadow-sm">
                                    <div className={`w-12 h-12 rounded-full ${stat.bg} ${stat.color} flex items-center justify-center shadow-sm`}><stat.icon size={22} strokeWidth={2.5} /></div>
                                    <div className="text-center flex flex-col">
                                        <span className="text-[24px] font-black text-[#1a2138] tracking-tighter leading-none">{stat.count}</span>
                                        <span className="text-[9px] font-black text-[#64748b] uppercase tracking-widest">{stat.label}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-3 pb-4">
                            {filteredMetrics.map((metric, idx) => {
                                const isNormal = metric.status === 'NORMAL' || metric.status === 'GOOD';
                                const isWarning = ['BORDERLINE', 'MODERATE', 'LOW'].includes(metric.status);
                                const colorClass = isNormal ? 'text-[#69A38D]' : isWarning ? 'text-[#E88F4A]' : 'text-[#5D5589]';
                                const bgClass = isNormal ? 'bg-[#69A38D]/10 border-[#69A38D]/20' : isWarning ? 'bg-[#E88F4A]/10 border-[#E88F4A]/20' : 'bg-[#5D5589]/10 border-[#5D5589]/20';
                                
                                return (
                                    <div key={idx} onClick={() => { setSelectedMetric(metric); setShowMetricModal(true); }} className="bg-white/60 rounded-[32px] p-4 shadow-sm border border-white flex flex-col min-h-[150px] cursor-pointer hover:bg-white/80 transition-all">
                                        <div className="flex items-start justify-between">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${bgClass} ${colorClass}`}>
                                                {isNormal ? <CheckCircle2 size={14} strokeWidth={2.5} /> : <AlertCircle size={14} strokeWidth={2.5} />}
                                            </div>
                                            <span className={`text-[8.5px] font-black px-2 py-1 rounded-full uppercase border ${bgClass} ${colorClass} tracking-widest`}>{metric.status}</span>
                                        </div>
                                        <div className="mt-3">
                                            <div className="text-[13px] font-black text-[#1a2138] uppercase tracking-tight leading-snug line-clamp-2">{metric.name.replace(/([A-Z])/g, ' $1').trim()}</div>
                                            <div className="text-[9px] font-bold text-[#64748b] mt-0.5">TARGET: {metric.range}</div>
                                        </div>
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

                {/* Deficiencies */}
                {!isProcessing && aiAnalysis?.deficiencies?.length > 0 && (
                    <div className="bg-white/60 backdrop-blur-xl rounded-[40px] p-6 shadow-[0_4px_25px_rgba(0,0,0,0.04)] border border-white">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center border border-red-100"><AlertTriangle size={20} className="text-[#EF4444]" /></div>
                            <h2 className="text-[20px] font-black text-[#1a2138] uppercase tracking-tight">{isHindi ? 'कमियां पाई गईं' : 'Critical Deficiencies'}</h2>
                        </div>
                        <div className="flex flex-col gap-4">
                            {aiAnalysis.deficiencies.map((def, i) => (
                                <div key={i} className="bg-white/80 rounded-[28px] p-5 border border-red-100 relative overflow-hidden">
                                     <div className="absolute top-0 left-0 w-1.5 h-full bg-[#EF4444]"></div>
                                     <div className="flex justify-between items-start mb-4 pl-2">
                                         <h3 className="text-[16px] font-black text-[#1a2138] uppercase tracking-tight">{t(def.name)}</h3>
                                         <span className="bg-red-50 text-[#EF4444] text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest border border-red-100">{def.severity || 'Caution'}</span>
                                     </div>
                                     <div className="grid grid-cols-2 gap-3 pl-2">
                                         <div className="bg-white/50 rounded-2xl p-3 border border-slate-50">
                                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Current</p>
                                             <p className="text-base font-black text-[#1a2138]">{def.currentValue || 'N/A'}</p>
                                         </div>
                                         <div className="bg-white/50 rounded-2xl p-3 border border-slate-50">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Range</p>
                                            <p className="text-base font-black text-slate-400">{def.normalRange || 'N/A'}</p>
                                         </div>
                                     </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Nutritional Protocol CTA */}
                {!isProcessing && (
                    <div className="bg-white/60 backdrop-blur-xl rounded-[40px] p-8 shadow-[0_4px_25px_rgba(0,0,0,0.04)] border border-white flex flex-col gap-6 group relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#69A38D]/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-125 transition-transform" />
                        <div className="relative z-10 flex flex-col gap-6">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-[#E2EED2] rounded-2xl flex items-center justify-center shadow-inner border border-[#69A38D]/10">
                                    <Utensils size={24} className="text-[#69A38D]" />
                                </div>
                                <h1 className="text-[20px] font-black text-[#1a2138] uppercase tracking-tight">{isHindi ? 'व्यक्तिगत आहार योजना' : 'Nutritional Protocol'}</h1>
                            </div>

                            <p className="text-[#64748b] text-[14px] leading-relaxed font-bold">
                                {isHindi 
                                    ? 'अपनी रिपोर्ट के निष्कर्षों और फिटनेस लक्ष्यों के आधार पर एक विस्तृत आहार योजना प्राप्त करें।' 
                                    : "Based on your clinical synthesis, we've prepared an optimized nutritional strategy to address your bio-marker needs."}
                            </p>

                            <button
                                onClick={() => navigate('/diet-plan?autoGenerate=true')}
                                className="w-full py-5 bg-[#69A38D] text-white rounded-[28px] font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-[#69A38D]/20 transition-all hover:bg-[#528270] active:scale-[0.98] flex items-center justify-center gap-3"
                            >
                                <Sparkles size={18} /> 
                                {isHindi ? 'व्यक्तिगत आहार योजना जनरेट करें' : 'GENERATE PERSONALIZED DIET PLAN'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Actionable Next Steps (Redesigned) */}
                {!isProcessing && (
                    <div className="bg-[#69A38D] rounded-[40px] p-8 text-white shadow-xl flex flex-col gap-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                                <Zap size={24} strokeWidth={3} fill="currentColor" />
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight">{isHindi ? 'अगले कदम' : 'Actionable Next Steps'}</h2>
                        </div>
                        <div className="flex flex-col gap-4">
                            {[
                                isHindi ? "सप्ताह में 5 दिन व्यायाम करें" : "Exercise 5 days/week — mix cardio and strength training",
                                isHindi ? "प्रतिदिन 7-8 घंटे सोएं" : "Sleep 7-8 hours daily — poor sleep raises inflammation markers",
                                isHindi ? "योग या ध्यान के माध्यम से तनाव प्रबंधन" : "Manage stress through yoga or meditation — reduces cortisol and inflammation",
                                isHindi ? "धूम्रपान से बचें और शराब सीमित करें" : "Avoid smoking and limit alcohol — both lower HDL and raise hsCRP"
                            ].map((step, idx) => (
                                <div key={idx} className="bg-white/10 rounded-[32px] p-6 flex items-center gap-6 group hover:bg-white/15 transition-all">
                                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-black shrink-0">
                                        {idx + 1}
                                    </div>
                                    <p className="text-[15px] font-bold leading-snug">{step}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="text-center px-4 pb-12">
                    <p className="text-[11px] font-bold text-slate-400 leading-relaxed uppercase tracking-widest">
                       Disclaimer: This AI analysis is for informational wellness support only and should not replace professional medical advice. Always consult with a healthcare provider.
                    </p>
                </div>
            </div>

            {showMetricModal && selectedMetric && (
                <VitalDetailsPopup
                    metric={selectedMetric}
                    onClose={closeMetricModal}
                    initialLanguage={isHindi ? 'Hindi' : 'English'}
                />
            )}
        </div>
    );
}
