import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { healthService } from '../services/api';
import api from '../services/api';
import {
    ArrowLeft, Share2, Download, FileText, Activity,
    CheckCircle, AlertCircle, AlertTriangle, Apple,
    Zap, Sun, Clock, XCircle, Dumbbell, Calendar, Building2, User2, UtensilsCrossed,
    Mail, Languages, Filter, Layers, Sparkles
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

    const glassCard = "bg-white/80 backdrop-blur-2xl border border-white/50 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)]";

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
            } catch (error) {
                toast.error('Failed to load report');
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, [id]);

    if (loading) return (
        <div className="flex items-center justify-center h-screen bg-white">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-[#F5F5F7] border-t-[#A795C7] rounded-full animate-spin mx-auto mb-4" />
                <p className="text-[#888888] font-medium">Loading Report...</p>
            </div>
        </div>
    );

    if (!report) return (
        <div className="flex flex-col items-center justify-center h-screen bg-white px-6">
            <AlertTriangle className="w-16 h-16 text-[#FF8A66] mb-4" />
            <h2 className="text-xl font-bold text-[#1a1a1a] mb-2">Report Not Found</h2>
            <p className="text-[#666666] text-center mb-6">We couldn't find the report you're looking for.</p>
            <button
                onClick={() => navigate('/upload')}
                className="px-8 py-3 bg-[#1a1a1a] text-white font-bold rounded-full"
            >
                Back to AI Analyzer
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

    const getStatusStyle = (status) => {
        if (status === 'normal' || status === 'good') return { text: 'text-[#16A34A]', bg: 'bg-[#F0FDF4]', border: 'border-[#BBF7D0]', dot: 'bg-[#16A34A]' };
        if (status === 'borderline' || status === 'moderate') return { text: 'text-[#FF8A66]', bg: 'bg-[#FFF8F5]', border: 'border-[#FFE8E0]', dot: 'bg-[#FF8A66]' };
        return { text: 'text-[#EF4444]', bg: 'bg-[#FFF0F0]', border: 'border-[#FFC9C9]', dot: 'bg-[#EF4444]' };
    };

    const handleShare = () => {
        const shareText = `Check out my ${report.reportType} health report analysis! Health Score: ${aiAnalysis?.healthScore}/100`;
        const shareUrl = window.location.href;
        if (navigator.share) {
            navigator.share({ title: 'Health Report Analysis', text: shareText, url: shareUrl }).catch(() => {
                window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`, '_blank');
            });
        } else {
            window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`, '_blank');
        }
    };

    const handleMetricClick = (metricName, metricData) => {
        setSelectedMetric({ name: metricName, ...metricData });
        setShowMetricModal(true);
    };

    const closeMetricModal = () => {
        setShowMetricModal(false);
        setSelectedMetric(null);
    };

    const handleDownload = async () => {
        const reportElement = document.getElementById('report-mobile-content');
        if (!reportElement) { toast.error('Could not find report content'); return; }
        const toastId = toast.loading('Preparing PDF...');
        try {
            const actionButtons = reportElement.querySelectorAll('.no-pdf');
            actionButtons.forEach(btn => btn.style.display = 'none');
            const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', windowWidth: 375 });
            actionButtons.forEach(btn => btn.style.display = '');
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const ratio = pdfWidth / canvas.width;
            let heightLeft = canvas.height * ratio;
            let position = 0;
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvas.height * ratio);
            heightLeft -= pdfHeight;
            while (heightLeft >= 0) {
                position = heightLeft - canvas.height * ratio;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, canvas.height * ratio);
                heightLeft -= pdfHeight;
            }
            pdf.save(`Health_Report_${id.substring(0, 8)}.pdf`);
            toast.success('Report downloaded!', { id: toastId });
        } catch (error) {
            toast.error('Failed to generate PDF.', { id: toastId });
            window.print();
        }
    };

    const reportType = (report.reportType || '').toUpperCase().trim();
    const isMRI = reportType === 'MRI' || 
                 reportType.includes('MRI') || 
                 !!aiAnalysis?.mriData || 
                 aiAnalysis?.summary?.toLowerCase().includes('mri');

    return (
        <div id="report-mobile-content" className="min-h-screen pb-20 font-sans bg-white">
            <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">

                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <button
                            onClick={() => navigate('/upload')}
                            className="w-10 h-10 bg-[#F5F5F7] rounded-full flex items-center justify-center text-[#1a1a1a] hover:bg-slate-200 transition-all flex-shrink-0 no-pdf"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="min-w-0">
                            <h1 className="text-2xl md:text-4xl font-light tracking-tight text-[#1a1a1a] truncate">{isHindi ? 'रिपोर्ट विश्लेषण' : 'Report Analysis'}</h1>
                            <p className="text-[#888888] text-sm font-medium">{isHindi ? 'AI-संचालित स्वास्थ्य अंतर्दृष्टि' : 'AI-Powered Health Insights'}</p>
                        </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 no-pdf">
                        <button
                            onClick={translateReport}
                            disabled={translating}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isHindi ? 'bg-[#A795C7] text-white' : 'bg-[#F5F5F7] text-[#666666] hover:bg-slate-200'}`}
                            title="Translate"
                        >
                            <Languages className="w-4 h-4" />
                        </button>
                        <button onClick={handleShare} className="w-10 h-10 bg-[#F5F5F7] rounded-full flex items-center justify-center text-[#666666] hover:bg-slate-200 transition-all" title="Share">
                            <Share2 className="w-4 h-4" />
                        </button>
                        <button onClick={handleDownload} className="w-10 h-10 bg-[#F5F5F7] rounded-full flex items-center justify-center text-[#666666] hover:bg-slate-200 transition-all" title="Download">
                            <Download className="w-4 h-4" />
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

                {/* Lab Report Card */}
                <div className={`${glassCard} p-6 md:p-8 relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-40 h-40 bg-[#A795C7]/10 rounded-full blur-3xl -mr-16 -mt-16"></div>

                    <div className="flex items-center gap-3 mb-5 relative z-10">
                        <div className="w-10 h-10 bg-[#F5F5F7] rounded-full flex items-center justify-center">
                            <FileText className="w-5 h-5 text-[#A795C7]" />
                        </div>
                        <span className="text-[10px] font-bold tracking-widest text-[#888888] uppercase">Lab Report</span>
                    </div>

                    <h2 className="text-2xl font-bold text-[#1a1a1a] mb-4 relative z-10">
                        {report.reportType}
                        <span className="text-sm font-medium text-[#a0a0a0] ml-2">({new Date(report.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})</span>
                    </h2>

                    <div className="space-y-3 relative z-10">
                        <div className="flex items-center gap-3 text-[#666666]">
                            <Calendar className="w-4 h-4 text-[#a0a0a0]" />
                            <span className="text-sm font-medium">{new Date(report.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[#666666]">
                            <User2 className="w-4 h-4 text-[#a0a0a0]" />
                            <span className="text-sm font-medium truncate">
                                {report.patientName || 'Patient Name'}
                                {report.patientAge ? ` • ${report.patientAge}Y` : ''}
                                {report.patientGender ? ` • ${report.patientGender}` : ''}
                            </span>
                        </div>
                    </div>

                    <div className="absolute top-6 right-6 bg-[#F0FDF4] border border-[#BBF7D0] rounded-full px-3 py-1.5 z-10">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-[#16A34A] rounded-full animate-pulse"></span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#16A34A]">Analyzed</span>
                        </div>
                    </div>
                </div>

                {/* Executive Summary */}
                {(aiAnalysis?.summary || aiAnalysis?.summaryPoints) && (
                    <div className={`${glassCard} p-6 md:p-8`}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-[#F5F5F7] rounded-full flex items-center justify-center">
                                <Activity className="w-5 h-5 text-[#A795C7]" />
                            </div>
                            <h3 className="text-lg font-bold text-[#1a1a1a]">{isHindi ? 'कार्यकारी सारांश' : 'Executive Summary'}</h3>
                        </div>

                        {aiAnalysis.summary && (
                            <div className="space-y-4 mb-6">
                            {t(aiAnalysis.summary).split('\n').filter(line => line.trim()).map((line, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#A795C7] mt-1.5 flex-shrink-0" />
                                    <p className="text-[#666666] leading-relaxed text-sm">
                                        {line.replace(/^[•\-\*]\s*/, '').trim()}
                                    </p>
                                </div>
                            ))}
                        </div>
                        )}

                        {isMRI && aiAnalysis?.radiologistReport?.patientFriendlySummary && (
                            <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-3xl mb-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <Sparkles className="w-4 h-4 text-indigo-500" />
                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Plain English Analysis</span>
                                </div>
                                <p className="text-sm text-indigo-900 font-semibold leading-relaxed italic">
                                    "{t(aiAnalysis.radiologistReport.patientFriendlySummary)}"
                                </p>
                            </div>
                        )}

                        {aiAnalysis.summaryPoints && aiAnalysis.summaryPoints.length > 0 && (
                            <div className="space-y-3 mb-6">
                                {aiAnalysis.summaryPoints.map((point, idx) => (
                                    <div key={idx} className="flex gap-3 bg-[#F5F5F7]/50 p-4 rounded-2xl border border-white/50">
                                        <div className="w-6 h-6 bg-[#A795C7]/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                            <div className="w-2 h-2 bg-[#A795C7] rounded-full" />
                                        </div>
                                        <p className="text-xs text-[#666666] font-medium leading-relaxed">{t(point)}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="bg-gradient-to-br from-[#A795C7]/10 to-[#9583BC]/5 rounded-2xl p-5 border border-[#A795C7]/20">
                            <div className="flex items-center gap-2 mb-2">
                                <Zap className="w-4 h-4 text-[#A795C7]" />
                                <h4 className="text-[#A795C7] font-bold text-[10px] uppercase tracking-widest">{isHindi ? 'मुख्य अंतर्दृष्टि' : 'Key Insight'}</h4>
                            </div>
                            <p className="text-[#1a1a1a] text-sm leading-relaxed font-medium">
                                {t(aiAnalysis.keyFindings?.[0] || "Your health markers are generally within range, but some areas require focus.")}
                            </p>
                        </div>
                    </div>
                )}

                {/* MRI Findings Section */}
                {isMRI && (
                    <div className={`${glassCard} p-6 md:p-8 space-y-8`}>
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center">
                                    <Layers className="w-5 h-5 text-indigo-500" />
                                </div>
                                <h3 className="text-lg font-bold text-[#1a1a1a]">Detailed MRI Findings</h3>
                            </div>
                            
                            <div className="space-y-2">
                                {(aiAnalysis?.radiologistReport?.impressions || aiAnalysis?.keyFindings || []).map((imp, idx) => (
                                    <div key={idx} className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-indigo-500 shadow-sm shrink-0">
                                            <CheckCircle className="w-4 h-4" />
                                        </div>
                                        <p className="text-sm text-slate-700 font-bold leading-snug">{t(imp)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {aiAnalysis?.radiologistReport?.findings && (
                            <div className="pt-6 border-t border-slate-100">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Clinical Observations</h4>
                                <div className="p-5 bg-slate-900 rounded-3xl">
                                    <p className="text-[13px] text-slate-300 leading-relaxed font-mono italic">
                                        {t(aiAnalysis.radiologistReport.findings)}
                                    </p>
                                </div>
                            </div>
                        )}
                        
                        {aiAnalysis?.mriData?.series && (
                            <div className="pt-6 border-t border-slate-100">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Study Sequences</h4>
                                <div className="flex flex-wrap gap-2">
                                    {aiAnalysis.mriData.series.map((s, idx) => (
                                        <div key={idx} className="px-3 py-1.5 bg-slate-100 rounded-full text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                            {s.name} • {s.count} Slices
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Health Metrics */}
                {!isMRI && (
                    <div>
                    <div className="flex items-center justify-between mb-6 px-2">
                        <h3 className="text-lg font-bold text-[#1a1a1a]">{isHindi ? 'स्वास्थ्य मेट्रिक्स' : 'Health Metrics'}</h3>
                        <div className="flex gap-1.5 overflow-x-auto pb-1">
                            {[
                                { id: 'all', label: isHindi ? 'सभी' : 'All' },
                                { id: 'normal', label: isHindi ? 'सामान्य' : 'Normal' },
                                { id: 'borderline', label: isHindi ? 'सीमारेखा' : 'Borderline' },
                                { id: 'abnormal', label: isHindi ? 'असामान्य' : 'High/Low' }
                            ].map(filter => (
                                <button
                                    key={filter.id}
                                    onClick={() => setMetricFilter(filter.id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${metricFilter === filter.id
                                        ? 'bg-[#1a1a1a] text-white'
                                        : 'bg-[#F5F5F7] text-[#888888] hover:text-[#1a1a1a]'
                                        }`}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Metric Summary */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className={`${glassCard} p-4 text-center`}>
                            <div className="w-10 h-10 bg-[#F0FDF4] rounded-full flex items-center justify-center mx-auto mb-3">
                                <CheckCircle className="w-5 h-5 text-[#16A34A]" />
                            </div>
                            <p className="text-2xl font-bold text-[#1a1a1a] mb-1">{metricCounts.good}</p>
                            <p className="text-[10px] font-bold text-[#888888] uppercase tracking-widest">{isHindi ? 'अच्छा' : 'Good'}</p>
                        </div>
                        <div className={`${glassCard} p-4 text-center`}>
                            <div className="w-10 h-10 bg-[#FFF8F5] rounded-full flex items-center justify-center mx-auto mb-3">
                                <AlertCircle className="w-5 h-5 text-[#FF8A66]" />
                            </div>
                            <p className="text-2xl font-bold text-[#1a1a1a] mb-1">{metricCounts.moderate}</p>
                            <p className="text-[10px] font-bold text-[#888888] uppercase tracking-widest">{isHindi ? 'मध्यम' : 'Moderate'}</p>
                        </div>
                        <div className={`${glassCard} p-4 text-center`}>
                            <div className="w-10 h-10 bg-[#FFF0F0] rounded-full flex items-center justify-center mx-auto mb-3">
                                <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
                            </div>
                            <p className="text-2xl font-bold text-[#1a1a1a] mb-1">{metricCounts.low}</p>
                            <p className="text-[10px] font-bold text-[#888888] uppercase tracking-widest">{isHindi ? 'कम' : 'Low'}</p>
                        </div>
                    </div>

                    {/* Individual Metric Cards */}
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
                                const style = getStatusStyle(metric.status);
                                return (
                                    <button
                                        key={key}
                                        onClick={() => handleMetricClick(key, metric)}
                                        className={`${glassCard} p-4 text-left transition-all hover:shadow-md active:scale-95 flex flex-col justify-between`}
                                    >
                                        <div className="mb-3">
                                            <h4 className="text-[11px] font-bold text-[#1a1a1a] leading-tight">
                                                {key.replace(/([A-Z])/g, ' $1').trim()}
                                            </h4>
                                            <p className="text-[9px] font-medium text-[#a0a0a0] uppercase tracking-wider mt-1">
                                                {metric.normalRange} {metric.unit}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between mt-auto">
                                            <div className="flex items-baseline gap-1">
                                                <span className={`text-xl font-bold ${style.text}`}>{metric.value}</span>
                                                <span className="text-[#a0a0a0] font-medium text-[8px] uppercase">{metric.unit}</span>
                                            </div>
                                            <span className={`px-2 py-0.5 ${style.bg} ${style.text} rounded-full text-[8px] font-bold uppercase tracking-wider border ${style.border}`}>
                                                {metric.status}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                    </div>
                    </div>
                )}

                {/* Deficiencies */}
                {!isMRI && aiAnalysis?.deficiencies?.length > 0 && (
                    <div className={`${glassCard} p-6 md:p-8`}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-[#FFF0F0] rounded-full flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
                            </div>
                            <h3 className="text-lg font-bold text-[#1a1a1a]">{isHindi ? 'कमियां पाई गईं' : 'Deficiencies Detected'}</h3>
                        </div>

                        <div className="space-y-4">
                            {aiAnalysis.deficiencies.map((def, i) => (
                                <div key={i} className="bg-[#F5F5F7]/50 rounded-2xl p-5 border border-white/50 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-[#FF8A66]"></div>
                                    <div className="flex justify-between items-start mb-4 pl-3">
                                        <h4 className="font-bold text-[#1a1a1a] text-base">{t(def.name)}</h4>
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${def.severity === 'severe' ? 'bg-[#FFF0F0] text-[#EF4444]' : 'bg-[#FFF8F5] text-[#FF8A66]'
                                            }`}>
                                            {def.severity || 'Moderate'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-4 pl-3">
                                        <div className="bg-white rounded-xl p-3 border border-slate-100">
                                            <p className="text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1">{isHindi ? 'वर्तमान स्तर' : 'Current Level'}</p>
                                            <p className="text-base font-bold text-[#1a1a1a]">{def.currentValue || 'N/A'}</p>
                                        </div>
                                        <div className="bg-white rounded-xl p-3 border border-slate-100">
                                            <p className="text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-1">{isHindi ? 'सामान्य सीमा' : 'Normal Range'}</p>
                                            <p className="text-base font-bold text-[#666666]">{def.normalRange || 'N/A'}</p>
                                        </div>
                                    </div>

                                    {def.symptoms?.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-slate-100 pl-3">
                                            <p className="text-[10px] font-bold text-[#a0a0a0] uppercase tracking-wider mb-2">{isHindi ? 'इन लक्षणों की जांच करें' : 'Check for these symptoms'}</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {def.symptoms.map((symp, si) => (
                                                    <span key={si} className="px-2.5 py-1 bg-[#A795C7]/10 text-[#A795C7] text-[10px] font-bold rounded-full border border-[#A795C7]/20">
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

                {/* Generate Diet Plan CTA */}
                <div className={`${glassCard} p-8 bg-gradient-to-br from-[#F0FDF4] to-[#DCFCE7] border border-emerald-100 relative overflow-hidden group`}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-200/20 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-125 transition-transform" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md border border-emerald-50">
                                <Apple className="w-7 h-7 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-[#1a1a1a]">{isHindi ? 'व्यक्तिगत आहार योजना' : 'Personalized Diet Plan'}</h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <Sparkles className="w-3 h-3 text-emerald-600" />
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">AI Curation Tool</span>
                                </div>
                            </div>
                        </div>

                        <p className="text-[#666666] text-sm leading-relaxed mb-8 font-medium">
                            {isHindi 
                                ? 'अपनी रिपोर्ट के निष्कर्षों, फिटनेस लक्ष्यों और बीएमआई के आधार पर एक विस्तृत आहार योजना प्राप्त करें।' 
                                : "Get a comprehensive diet plan tailored to your report findings, fitness goals, and BMI analysis."}
                        </p>

                        <button
                            onClick={() => navigate('/diet-plan')}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[1.25rem] font-bold text-sm uppercase tracking-widest shadow-lg shadow-emerald-100 hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                        >
                            <UtensilsCrossed className="w-4 h-4" />
                            {isHindi ? 'विशेष रूप से आपके लिए व्यक्तिगत आहार योजना देखें' : 'View personalized diet plan specially for you'}
                        </button>
                    </div>
                </div>


                {/* Health Tips */}
                {(aiAnalysis?.recommendations?.lifestyle?.length > 0 || aiAnalysis?.dietPlan?.tips?.length > 0) && (
                    <div className={`${glassCard} p-6 md:p-8 bg-gradient-to-br from-[#A795C7] to-[#715c99] border-none`}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                <Zap className="w-5 h-5 text-white" />
                            </div>
                            <h3 className="text-lg font-bold text-white">{isHindi ? 'स्वास्थ्य सुझाव' : 'Personalized Health Tips'}</h3>
                        </div>

                        <div className="space-y-3">
                            {(aiAnalysis.recommendations?.lifestyle || aiAnalysis.dietPlan?.tips || []).map((tip, idx) => (
                                <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 flex gap-3 border border-white/10">
                                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                                        <span className="text-white text-xs font-bold">{idx + 1}</span>
                                    </div>
                                    <p className="text-sm text-white/90 leading-relaxed font-medium">{t(tip)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center px-4 pb-8">
                    <p className="text-[#a0a0a0] text-xs leading-relaxed font-medium">
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
        </div>
    );
}
