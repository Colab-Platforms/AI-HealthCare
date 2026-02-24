import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { healthService } from '../services/api';
import {
    ArrowLeft, Share2, Download, FileText, Activity,
    CheckCircle, AlertCircle, AlertTriangle, Apple,
    Zap, Sun, Clock, XCircle, Dumbbell, Calendar, Building2, User2, UtensilsCrossed,
    Mail
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReportAnalysisMobile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);

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

    const handleEmailShare = () => {
        const subject = `Health Report Analysis: ${report.reportType}`;
        const body = `Hi,\n\nI've analyzed my ${report.reportType} report.\n\nSummary: ${aiAnalysis?.summary}\n\nHealth Score: ${aiAnalysis?.healthScore}/100\n\nView details: ${window.location.href}`;
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    const handleDownload = () => {
        window.print();
    };

    return (
        <div className="min-h-screen pb-20 font-sans">
            {/* Navbar */}
            <div className="px-6 pt-8 pb-4 flex items-center justify-between sticky top-0 backdrop-blur-md z-10">
                <Link to="/dashboard" className="flex items-center gap-2 text-purple-600 font-bold text-xs tracking-[0.1em]">
                    <ArrowLeft className="w-4 h-4" /> BACK TO REPORTS
                </Link>
            </div>

            <div className="px-6 mb-8 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-black text-[#0F172A] tracking-tight truncate whitespace-nowrap">Report Analysis</h1>
                    <p className="text-slate-500 font-medium mt-0.5 text-xs">AI-Powered Health Insights</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                    <button
                        onClick={handleShare}
                        className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 text-[#25D366] hover:bg-emerald-50 transition-colors"
                        title="Share on WhatsApp"
                    >
                        <Share2 className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleEmailShare}
                        className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Share via Email"
                    >
                        <Mail className="w-5 h-5" />
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
                            <h3 className="text-lg font-black text-[#0F172A] tracking-tight uppercase">Executive Summary</h3>
                        </div>

                        <p className="text-slate-600 leading-relaxed font-bold text-sm mb-6">
                            {aiAnalysis.summary}
                        </p>

                        <div className="bg-purple-50/50 rounded-3xl p-6 border border-purple-100">
                            <h4 className="text-purple-700 font-black text-[10px] uppercase tracking-wider mb-2">Key Insight</h4>
                            <p className="text-purple-900 text-xs leading-relaxed font-bold">
                                {aiAnalysis.keyFindings?.[0] || "Your health markers are generally within range, but some areas require focus."}
                            </p>
                        </div>
                    </div>
                )}

                {/* Health Metrics Header */}
                <div className="mt-8">
                    <h3 className="text-lg font-black text-[#0F172A] tracking-tight uppercase mb-6 px-4">Health Metrics</h3>

                    {/* Metrics Summary Boxes */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-white rounded-3xl p-4 text-center border border-slate-100 shadow-sm">
                            <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                <CheckCircle className="w-5 h-5 text-emerald-500" />
                            </div>
                            <p className="text-2xl font-black text-slate-800 mb-1">{metricCounts.good}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Good</p>
                        </div>
                        <div className="bg-white rounded-3xl p-4 text-center border border-slate-100 shadow-sm">
                            <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                <AlertCircle className="w-5 h-5 text-amber-500" />
                            </div>
                            <p className="text-2xl font-black text-slate-800 mb-1">{metricCounts.moderate}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Moderate</p>
                        </div>
                        <div className="bg-white rounded-3xl p-4 text-center border border-slate-100 shadow-sm">
                            <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                            </div>
                            <p className="text-2xl font-black text-slate-800 mb-1">{metricCounts.low}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Low</p>
                        </div>
                    </div>

                    {/* Individual Metric Cards */}
                    <div className="space-y-4">
                        {metricsList.map(([key, metric]) => {
                            const color = getStatusColor(metric.status);
                            return (
                                <div
                                    key={key}
                                    className={`card p-6 border-2 border-${color}-100 relative overflow-hidden`}
                                >
                                    <div className={`absolute top-0 right-0 w-24 h-24 bg-${color}-500/5 rounded-full -mr-12 -mt-12`}></div>

                                    <div className="flex justify-between items-start mb-4 relative z-1">
                                        <div>
                                            <h4 className="text-base font-black text-slate-800 flex items-center gap-2">
                                                {key.replace(/([A-Z])/g, ' $1')}
                                                {metric.status !== 'normal' && <AlertTriangle className={`w-4 h-4 text-${color}-500`} />}
                                                {metric.status === 'normal' && <CheckCircle className={`w-4 h-4 text-emerald-500`} />}
                                            </h4>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                Range: {metric.normalRange} {metric.unit}
                                            </p>
                                        </div>
                                        <div className={`px-2.5 py-1 bg-${color}-100/80 text-${color}-700 rounded-full flex items-center gap-1 border border-${color}-200`}>
                                            <span className="text-[9px] font-black uppercase tracking-widest">{metric.status}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-baseline gap-2 relative z-1">
                                        <span className={`text-3xl font-black text-${color}-600`}>{metric.value}</span>
                                        <span className="text-slate-400 font-bold text-xs tracking-tight uppercase">{metric.unit}</span>
                                    </div>
                                </div>
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
                                        <h4 className="font-black text-[#0F172A] text-lg">{def.name}</h4>
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${def.severity === 'severe' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                                            }`}>
                                            {def.severity || 'Moderate'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Current Level</p>
                                            <p className="text-base font-black text-slate-800">{def.currentValue || 'N/A'}</p>
                                        </div>
                                        <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Normal Range</p>
                                            <p className="text-base font-black text-slate-600">{def.normalRange || 'N/A'}</p>
                                        </div>
                                    </div>

                                    {def.symptoms?.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Check for these symptoms</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {def.symptoms.map((symp, si) => (
                                                    <span key={si} className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg border border-blue-100">
                                                        {symp}
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
                            <h3 className="text-lg font-black text-[#0F172A] tracking-tight uppercase">Personalized Diet Plan</h3>
                        </div>

                        <p className="text-slate-500 font-medium text-sm leading-relaxed mb-8">
                            Based on your deficiencies and fitness goals, we've curated a nutrition plan to help restore optimal levels through natural food sources.
                        </p>

                        <div className="space-y-6">
                            {/* Category-wise Diet */}
                            {[
                                { label: 'Breakfast Recommendatons', items: aiAnalysis.dietPlan.breakfast?.slice(0, 4) || [], color: 'blue' },
                                { label: 'Lunch Options', items: aiAnalysis.dietPlan.lunch?.slice(0, 4) || [], color: 'emerald' },
                                { label: 'Dinner Suggestions', items: aiAnalysis.dietPlan.dinner?.slice(0, 4) || [], color: 'purple' },
                                { label: 'Healthy Snacks', items: aiAnalysis.dietPlan.snacks?.slice(0, 4) || [], color: 'amber' }
                            ].map((group, idx) => (
                                group.items.length > 0 && (
                                    <div key={idx} className="bg-slate-50 rounded-3xl p-6 border border-slate-200/50">
                                        <div className="flex items-center gap-2 mb-4">
                                            <UtensilsCrossed className={`w-4 h-4 text-${group.color}-500`} />
                                            <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight">{group.label}</h4>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {group.items.map((item, i) => (
                                                <div key={i} className="px-4 py-2 bg-white rounded-2xl text-xs font-bold text-slate-800 border border-slate-200/60 shadow-sm">
                                                    {item.meal || item}
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
                                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-400 to-blue-600"></div>
                                    <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center shrink-0">
                                        <Zap className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-xs uppercase tracking-[0.15em] text-slate-400 mb-1">Recommendation {idx + 1}</h4>
                                        <p className="text-sm text-slate-700 leading-relaxed font-bold">{tip}</p>
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
        </div>
    );
}
