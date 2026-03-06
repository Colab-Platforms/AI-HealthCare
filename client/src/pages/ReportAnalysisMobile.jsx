import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { healthService } from '../services/api';
import api from '../services/api';
import {
    ArrowLeft, Share2, Download, FileText, Activity,
    CheckCircle, AlertCircle, AlertTriangle, Apple,
    Zap, Sun, Clock, XCircle, Dumbbell, Calendar, Building2, User2, UtensilsCrossed,
    Mail, Languages, Filter
} from 'lucide-react';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import VitalDetailsPopup from '../components/VitalDetailsPopup';

export default function ReportAnalysisMobile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
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
        <div className="flex items-center justify-center h-screen bg-slate-50">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-500 font-medium">Analyzing Report...</p>
            </div>
        </div>
    );

    if (!report) return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 px-6">
            <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">Report Not Found</h2>
            <p className="text-slate-500 text-center mb-6">We couldn't find the report you're looking for.</p>
            <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg"
            >
                Back to Dashboard
            </button>
        </div>
    );

    const { aiAnalysis } = report;
    const metrics = aiAnalysis?.metrics || {};
    const metricsList = Object.entries(metrics);

    const metricCounts = {
        good: metricsList.filter(([_, m]) => m.status === 'normal').length,
        moderate: metricsList.filter(([_, m]) => m.status === 'borderline' || m.status === 'moderate').length,
        low: metricsList.filter(([_, m]) => m.status === 'low' || m.status === 'high').length
    };

    const getStatusColor = (status) => {
        if (status === 'normal' || status === 'good') return 'emerald';
        if (status === 'borderline' || status === 'moderate') return 'amber';
        return 'red';
    };

    const handleShare = () => {
        const shareText = `Check out my ${report.reportType} health report analysis! Health Score: ${aiAnalysis?.healthScore}/100`;
        const shareUrl = window.location.href;

        if (navigator.share) {
            navigator.share({
                title: 'Health Report Analysis',
                text: shareText,
                url: shareUrl
            }).catch(() => {
                window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`, '_blank');
            });
        } else {
            window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`, '_blank');
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
        const reportElement = document.getElementById('report-mobile-content');
        if (!reportElement) {
            toast.error('Could not find report content');
            return;
        }

        const toastId = toast.loading('Preparing PDF...');

        try {
            // Temporarily hide elements that shouldn't be in the PDF
            const actionButtons = reportElement.querySelectorAll('.no-pdf');
            actionButtons.forEach(btn => btn.style.display = 'none');

            const canvas = await html2canvas(reportElement, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                windowWidth: 375 // Use mobile width
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

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight * ratio);
            heightLeft -= pdfHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight * ratio;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight * ratio);
                heightLeft -= pdfHeight;
            }

            pdf.save(`Health_Report_${id.substring(0, 8)}.pdf`);
            toast.success('Report downloaded!', { id: toastId });
        } catch (error) {
            console.error('PDF Generation Error:', error);
            toast.error('Failed to generate PDF. Opening print...', { id: toastId });
            window.print();
        }
    };

    return (
        <div id="report-mobile-content" className="min-h-screen pb-20 font-sans bg-slate-50">
            {/* Navbar */}
            {/* Redundant back button removed as it's in the header */}

            <div className="px-6 mb-8 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-black text-[#0F172A] tracking-tight truncate whitespace-nowrap">{isHindi ? 'रिपोर्ट विश्लेषण' : 'Report Analysis'}</h1>
                    <p className="text-slate-500 font-medium mt-0.5 text-xs">{isHindi ? 'AI-संचालित स्वास्थ्य अंतर्दृष्टि' : 'AI-Powered Health Insights'}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0 no-pdf">
                    <button
                        onClick={translateReport}
                        disabled={translating}
                        className={`p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 ${isHindi ? 'text-blue-600 border-blue-200 bg-blue-50' : 'text-slate-600'} transition-all flex items-center gap-1.5`}
                        title="Translate to Hindi"
                    >
                        <Languages className="w-5 h-5" />
                        {translating ? <span className="text-[10px] font-bold">...</span> : isHindi ? <span className="text-[10px] font-bold">EN</span> : <span className="text-[10px] font-bold">HI</span>}
                    </button>
                    <button
                        onClick={handleShare}
                        className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 text-[#25D366] hover:bg-emerald-50 transition-colors"
                        title="Share on WhatsApp"
                    >
                        <Share2 className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleDownload}
                        className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-600 hover:bg-slate-50 transition-colors"
                        title="Download PDF"
                    >
                        <Download className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {showMetricModal && selectedMetric && (
                <VitalDetailsPopup
                    metric={selectedMetric}
                    onClose={closeMetricModal}
                    initialLanguage={isHindi ? 'Hindi' : 'English'}
                />
            )}

            {/* Main Content */}
            <div className="px-4 space-y-6">
                {/* Lab Report Card */}
                <div className="card card-gradient p-8 text-slate-900 shadow-2xl relative overflow-hidden ring-1 ring-white/50">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/20 rounded-full blur-3xl -mr-20 -mt-20"></div>

                    <div className="flex items-center gap-3 mb-6 relative z-10">
                        <div className="w-10 h-10 bg-white/40 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/50 shadow-inner">
                            <FileText className="w-5 h-5 text-purple-700" />
                        </div>
                        <span className="text-[10px] font-black tracking-[0.25em] text-slate-800 uppercase">Lab Report</span>
                    </div>

                    <h2 className="text-2xl font-black mb-4 flex items-center gap-2 overflow-hidden relative z-10">
                        <span className="truncate whitespace-nowrap">{report.reportType}</span>
                        <span className="text-sm font-bold opacity-60 shrink-0">({new Date(report.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})</span>
                    </h2>

                    <div className="space-y-4 relative z-10">
                        <div className="flex items-center gap-3 text-slate-700">
                            <Calendar className="w-4 h-4 opacity-60" />
                            <span className="text-sm font-bold">
                                {new Date(report.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-700 overflow-hidden">
                            <User2 className="w-4 h-4 opacity-60 shrink-0" />
                            <span className="text-sm font-bold truncate whitespace-nowrap">
                                {report.patientName || 'Patient Name'}
                                {report.patientAge ? ` • ${report.patientAge}Y` : ''}
                                {report.patientGender ? ` • ${report.patientGender}` : ''}
                            </span>
                        </div>
                    </div>

                    <div className="absolute top-6 right-6 bg-white/40 backdrop-blur-md border border-white/60 rounded-xl px-3 py-1.5 text-center shadow-lg z-10">
                        <div className="flex items-center justify-center gap-1.5">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-800">Analyzed</span>
                        </div>
                    </div>

                    <div className="absolute bottom-[-20px] right-8 opacity-5">
                        <FileText className="w-32 h-32" />
                    </div>
                </div>

                {/* Executive Summary */}
                {aiAnalysis?.summary && (
                    <div className="card p-8 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                                <Activity className="w-5 h-5 text-purple-600" />
                            </div>
                            <h3 className="text-lg font-black text-[#0F172A] tracking-tight uppercase">{isHindi ? 'कार्यकारी सारांश' : 'Executive Summary'}</h3>
                        </div>

                        <p className="text-slate-600 leading-relaxed font-bold text-sm mb-6">
                            {t(aiAnalysis.summary)}
                        </p>

                        <div className="bg-purple-50/50 rounded-3xl p-6 border border-purple-100">
                            <h4 className="text-purple-700 font-black text-[10px] uppercase tracking-wider mb-2">{isHindi ? 'मुख्य अंतर्दृष्टि' : 'Key Insight'}</h4>
                            <p className="text-purple-900 text-xs leading-relaxed font-bold">
                                {t(aiAnalysis.keyFindings?.[0] || "Your health markers are generally within range, but some areas require focus.")}
                            </p>
                        </div>
                    </div>
                )}

                {/* Health Metrics Header */}
                <div className="mt-8">
                    <div className="flex items-center justify-between mb-6 px-2">
                        <h3 className="text-lg font-black text-[#0F172A] tracking-tight uppercase">{isHindi ? 'स्वास्थ्य मेट्रिक्स' : 'Health Metrics'}</h3>
                        <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                            {[
                                { id: 'all', label: isHindi ? 'सभी' : 'All', color: 'slate' },
                                { id: 'normal', label: isHindi ? 'सामान्य' : 'Normal', color: 'emerald' },
                                { id: 'borderline', label: isHindi ? 'सीमारेखा' : 'Borderline', color: 'amber' },
                                { id: 'abnormal', label: isHindi ? 'असामान्य' : 'High/Low', color: 'red' }
                            ].map(filter => (
                                <button
                                    key={filter.id}
                                    onClick={() => setMetricFilter(filter.id)}
                                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border-2 transition-all whitespace-nowrap ${metricFilter === filter.id
                                        ? `bg-${filter.color}-500 text-white border-${filter.color}-500 shadow-md`
                                        : `bg-white text-${filter.color}-600 border-${filter.color}-100`
                                        }`}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Metrics Summary Boxes */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-white rounded-3xl p-4 text-center border border-slate-100 shadow-sm">
                            <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                <CheckCircle className="w-5 h-5 text-emerald-500" />
                            </div>
                            <p className="text-2xl font-black text-slate-800 mb-1">{metricCounts.good}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isHindi ? 'अच्छा' : 'Good'}</p>
                        </div>
                        <div className="bg-white rounded-3xl p-4 text-center border border-slate-100 shadow-sm">
                            <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                <AlertCircle className="w-5 h-5 text-amber-500" />
                            </div>
                            <p className="text-2xl font-black text-slate-800 mb-1">{metricCounts.moderate}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isHindi ? 'मध्यम' : 'Moderate'}</p>
                        </div>
                        <div className="bg-white rounded-3xl p-4 text-center border border-slate-100 shadow-sm">
                            <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                            </div>
                            <p className="text-2xl font-black text-slate-800 mb-1">{metricCounts.low}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isHindi ? 'कम' : 'Low'}</p>
                        </div>
                    </div>

                    {/* Individual Metric Cards - 2 per row grid */}
                    <div className="grid grid-cols-2 gap-3">
                        {metricsList
                            .filter(([_, m]) => {
                                if (metricFilter === 'all') return true;
                                if (metricFilter === 'normal') return m.status === 'normal';
                                if (metricFilter === 'borderline') return m.status === 'borderline' || m.status === 'moderate';
                                if (metricFilter === 'abnormal') return m.status === 'high' || m.status === 'low';
                                return true;
                            })
                            .map(([key, metric]) => {
                                const color = getStatusColor(metric.status);
                                return (
                                    <button
                                        key={key}
                                        onClick={() => handleMetricClick(key, metric)}
                                        className={`card p-4 border-2 border-${color}-100 relative overflow-hidden flex flex-col justify-between text-left transition-all active:scale-95`}
                                    >
                                        <div className={`absolute top-0 right-0 w-16 h-16 bg-${color}-500/5 rounded-full -mr-8 -mt-8`}></div>

                                        <div className="relative z-1 mb-2">
                                            <h4 className="text-[11px] font-black text-slate-800 leading-tight">
                                                {key.replace(/([A-Z])/g, ' $1').trim()}
                                            </h4>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                {metric.normalRange} {metric.unit}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between mt-auto relative z-1">
                                            <div className="flex items-baseline gap-1">
                                                <span className={`text-xl font-black text-${color}-600`}>{metric.value}</span>
                                                <span className="text-slate-400 font-bold text-[8px] uppercase">{metric.unit}</span>
                                            </div>
                                            <div className={`px-1.5 py-0.5 bg-${color}-100/80 text-${color}-700 rounded-full border border-${color}-200`}>
                                                <span className="text-[7px] font-black uppercase tracking-tighter">{metric.status}</span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                    </div>
                </div>

                {/* Deficiencies Section */}
                {aiAnalysis?.deficiencies?.length > 0 && (
                    <div className="mt-12 bg-[#FFF8F8] rounded-[2.5rem] p-8 border border-red-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-8">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                            <h3 className="text-lg font-black text-[#0F172A] tracking-tight uppercase">Deficiencies Detected</h3>
                        </div>

                        <div className="space-y-6">
                            {aiAnalysis.deficiencies.map((def, i) => (
                                <div key={i} className="bg-white rounded-3xl p-6 shadow-md border-2 border-red-50 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>
                                    <div className="flex justify-between items-start mb-4">
                                        <h4 className="font-black text-[#0F172A] text-lg">{t(def.name)}</h4>
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${def.severity === 'severe' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                                            }`}>
                                            {def.severity || 'Moderate'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{isHindi ? 'वर्तमान स्तर' : 'Current Level'}</p>
                                            <p className="text-base font-black text-slate-800">{def.currentValue || 'N/A'}</p>
                                        </div>
                                        <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{isHindi ? 'सामान्य सीमा' : 'Normal Range'}</p>
                                            <p className="text-base font-black text-slate-600">{def.normalRange || 'N/A'}</p>
                                        </div>
                                    </div>

                                    {def.symptoms?.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{isHindi ? 'इन लक्षणों की जांच करें' : 'Check for these symptoms'}</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {def.symptoms.map((symp, si) => (
                                                    <span key={si} className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg border border-blue-100">
                                                        {t(symp)}
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

                {/* Diet Plan Section */}
                {aiAnalysis?.dietPlan && (
                    <div className="mt-12 bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-3 mb-4">
                            <Apple className="w-6 h-6 text-emerald-500" />
                            <h3 className="text-lg font-black text-[#0F172A] tracking-tight uppercase">{isHindi ? 'व्यक्तिगत आहार योजना' : 'Personalized Diet Plan'}</h3>
                        </div>

                        <p className="text-slate-500 font-medium text-sm leading-relaxed mb-8">
                            {isHindi ? 'आपकी कमियों और फिटनेस लक्ष्यों के आधार पर, हमने प्राकृतिक खाद्य स्रोतों के माध्यम से इष्टतम स्तरों को बहाल करने में मदद करने के लिए एक पोषण योजना तैयार की है।' : 'Based on your deficiencies and fitness goals, we\'ve curated a nutrition plan to help restore optimal levels through natural food sources.'}
                        </p>

                        <div className="space-y-6">
                            {/* Category-wise Diet */}
                            {[
                                { label: isHindi ? 'नाश्ता अनुशंसाएं' : 'Breakfast Recommendatons', items: aiAnalysis.dietPlan.breakfast?.slice(0, 4) || [], color: 'blue' },
                                { label: isHindi ? 'दोपहर के भोजन के विकल्प' : 'Lunch Options', items: aiAnalysis.dietPlan.lunch?.slice(0, 4) || [], color: 'emerald' },
                                { label: isHindi ? 'रात के खाने के सुझाव' : 'Dinner Suggestions', items: aiAnalysis.dietPlan.dinner?.slice(0, 4) || [], color: 'purple' },
                                { label: isHindi ? 'स्वस्थ स्नैक्स' : 'Healthy Snacks', items: aiAnalysis.dietPlan.snacks?.slice(0, 4) || [], color: 'amber' }
                            ].map((group, idx) => (
                                group.items.length > 0 && (
                                    <div key={idx} className="bg-slate-50 rounded-3xl p-6 border border-slate-200/50">
                                        <div className="flex items-center gap-2 mb-4">
                                            <UtensilsCrossed className={`w-4 h-4 text-${group.color}-500`} />
                                            <h4 className="font-extrabold text-slate-800 text-[10px] uppercase tracking-tight">{group.label}</h4>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {group.items.map((item, i) => (
                                                <div key={i} className="px-4 py-2 bg-white rounded-2xl text-[10px] font-bold text-slate-800 border border-slate-200/60 shadow-sm leading-tight">
                                                    {t(item.meal || item)}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            ))}
                        </div>
                    </div>
                )}

                {/* Health Tips Section */}
                {(aiAnalysis?.recommendations?.lifestyle?.length > 0 || aiAnalysis?.dietPlan?.tips?.length > 0) && (
                    <div className="mt-12 bg-[#F0FDF4] rounded-[2.5rem] p-8 border border-emerald-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-8">
                            <Activity className="w-6 h-6 text-emerald-600" />
                            <h3 className="text-lg font-black text-[#0F172A] tracking-tight uppercase">Personalized Health Tips</h3>
                        </div>

                        <div className="space-y-4">
                            {(aiAnalysis.recommendations?.lifestyle || aiAnalysis.dietPlan?.tips || []).map((tip, idx) => (
                                <div key={idx} className="bg-white rounded-3xl p-6 flex gap-4 shadow-sm border border-slate-100 group relative overflow-hidden">
                                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-purple-400 to-orange-600"></div>
                                    <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center shrink-0">
                                        <Zap className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-[8px] uppercase tracking-[0.15em] text-slate-400 mb-1">{isHindi ? 'अनुशंसा' : 'Recommendation'} {idx + 1}</h4>
                                        <p className="text-xs text-slate-700 leading-relaxed font-bold">{t(tip)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer Disclaimer */}
                <div className="mt-12 px-8 pb-8 text-center">
                    <p className="text-slate-400 text-xs leading-relaxed font-medium">
                        Disclaimer: This AI analysis is for informational wellness support only and should not replace professional medical advice. Always consult with a healthcare provider.
                    </p>
                </div>
            </div>

            {showMetricModal && selectedMetric && (
                <VitalDetailsPopup
                    vital={selectedMetric}
                    onClose={closeMetricModal}
                    initialLanguage={isHindi ? 'hi' : 'en'}
                    t={t}
                />
            )}
        </div >
    );
}
