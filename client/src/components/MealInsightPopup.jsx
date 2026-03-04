import { X, Brain, Sparkles, Zap, ShieldCheck, Info } from 'lucide-react';

export default function MealInsightPopup({ meal, onClose }) {
    if (!meal) return null;

    const healthScore = Math.round(meal.healthScore10 * 10 || meal.healthScore || 0);

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-emerald-500';
        if (score >= 60) return 'text-amber-500';
        return 'text-rose-500';
    };

    const getScoreBg = (score) => {
        if (score >= 80) return 'bg-emerald-50 border-emerald-100';
        if (score >= 60) return 'bg-amber-50 border-amber-100';
        return 'bg-rose-50 border-rose-100';
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div
                className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 max-h-[90vh] border border-slate-100"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with Score */}
                <div className={`p-8 ${getScoreBg(healthScore).split(' ')[0]} border-b border-slate-100 relative`}>
                    <div className="flex items-center justify-between mb-6">
                        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                            <Brain className="w-6 h-6 text-[#2FC8B9]" />
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-sm transition-all active:scale-95"
                        >
                            <X className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>

                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Meal Insight</p>
                            <h2 className="text-2xl font-black text-slate-800 leading-tight">
                                {meal.foodItems?.[0]?.name || 'Logged Meal'}
                            </h2>
                        </div>
                        <div className="text-right">
                            <div className={`text-3xl font-black ${getScoreColor(healthScore)}`}>
                                {healthScore}<span className="text-xs text-slate-400 ml-0.5">/100</span>
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Health Score</p>
                        </div>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">

                    {/* Health Benefits */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-100">
                                <ShieldCheck className="w-4 h-4 text-blue-500" />
                            </div>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Health Benefits</h3>
                        </div>
                        <p className="text-sm font-bold text-slate-600 leading-relaxed bg-slate-50 p-5 rounded-3xl border border-slate-100">
                            {meal.healthBenefitsSummary || "This meal provides essential nutrients balanced for your health goals."}
                        </p>
                    </div>

                    {/* Micronutrients Grid */}
                    {meal.micronutrients && meal.micronutrients.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-purple-50 rounded-xl flex items-center justify-center border border-purple-100">
                                    <Zap className="w-4 h-4 text-purple-500" />
                                </div>
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Micronutrients</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {meal.micronutrients.map((micro, idx) => (
                                    <div key={idx} className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{typeof micro === 'object' ? micro.name : micro}</p>
                                        <p className="text-sm font-black text-slate-800">{typeof micro === 'object' ? micro.value : '--'}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Enhancement Tips */}
                    {meal.enhancementTips && meal.enhancementTips.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-100">
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                </div>
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">How to make it Healthier</h3>
                            </div>
                            <div className="space-y-2">
                                {meal.enhancementTips.map((tip, idx) => (
                                    <div key={idx} className="flex items-start gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                        <div className="w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                                            {idx + 1}
                                        </div>
                                        <p className="text-xs font-bold text-emerald-900 leading-normal">
                                            {typeof tip === 'object' ? tip.name || tip.tip : tip}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 text-center border-t border-slate-100">
                    <div className="inline-flex items-center gap-2">
                        <Info className="w-3 h-3 text-slate-400" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">AI Powered Nutrition Analysis</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
