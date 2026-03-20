import { X, Brain, Sparkles, Zap, ShieldCheck, Info, AlertTriangle, ChevronRight, Activity } from 'lucide-react';

export default function MealInsightPopup({ meal, onClose }) {
    if (!meal) return null;

    const healthScore = Math.round(meal.healthScore10 * 10 || meal.healthScore || 0);

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-black';
        if (score >= 60) return 'text-slate-600';
        return 'text-slate-800';
    };

    const getScoreBg = (score) => {
        if (score >= 80) return 'bg-slate-50 border-slate-100';
        if (score >= 60) return 'bg-white border-slate-50';
        return 'bg-slate-50 border-slate-100';
    };

    const nutrition = meal.totalNutrition || (meal.foodItems?.[0]?.nutrition) || {};

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div
                className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 max-h-[95vh] border border-slate-100"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with Score */}
                <div className={`p-8 ${getScoreBg(healthScore).split(' ')[0]} border-b border-slate-100 relative shrink-0`}>
                    <div className="flex items-center justify-between mb-6">
                        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                            <Brain className="w-6 h-6 text-black" />
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
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">AI Nutrition Insight</p>
                            <h2 className="text-2xl font-black text-slate-800 leading-tight">
                                {meal.foodItems?.[0]?.name || 'Logged Meal'}
                            </h2>
                            <p className="text-xs font-bold text-slate-500 mt-1">Logged on {new Date(meal.timestamp).toLocaleDateString()} at {new Date(meal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <div className="text-right">
                            <div className={`text-4xl font-black ${getScoreColor(healthScore)}`}>
                                {healthScore}<span className="text-xs text-slate-400 ml-0.5">/100</span>
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Health Score</p>
                        </div>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">

                    {/* Macronutrients Grid */}
                    <div className="grid grid-cols-4 gap-3">
                        {[
                            { label: "CALORIES", value: Math.round(nutrition.calories || 0), unit: "kcal", color: "text-black" },
                            { label: "PROTEIN", value: Math.round(nutrition.protein || 0), unit: "g", color: "text-black" },
                            { label: "CARBS", value: Math.round(nutrition.carbs || 0), unit: "g", color: "text-black" },
                            { label: "FATS", value: Math.round(nutrition.fats || 0), unit: "g", color: "text-black" },
                        ].map((stat) => (
                            <div key={stat.label} className="bg-slate-50 rounded-2xl p-3 border border-slate-100/50 text-center">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1.5">{stat.label}</p>
                                <p className={`text-lg font-black ${stat.color} leading-none`}>{stat.value}<span className="text-[9px] text-slate-400 ml-0.5 font-bold">{stat.unit}</span></p>
                            </div>
                        ))}
                    </div>

                    {/* Health Benefits Summary */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center border border-slate-800">
                                <ShieldCheck className="w-4 h-4 text-white" />
                            </div>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Medical Analysis</h3>
                        </div>
                        <p className="text-sm font-bold text-slate-600 leading-relaxed bg-slate-50 p-5 rounded-3xl border border-slate-100 bg-gradient-to-br from-white to-slate-50 shadow-sm transition-all hover:shadow-md">
                            {meal.healthBenefitsSummary || meal.aiAnalysis || "This meal provides essential nutrients balanced for your health goals."}
                        </p>
                    </div>

                    {/* Warnings (If any) */}
                    {meal.warnings && meal.warnings.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
                                    <AlertTriangle className="w-4 h-4 text-black" />
                                </div>
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Health Warnings</h3>
                            </div>
                            <div className="space-y-2">
                                {meal.warnings.map((warning, idx) => (
                                    <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-start gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-black mt-1.5 shrink-0" />
                                        <p className="text-xs font-bold text-slate-700">{warning}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Micronutrients Progress */}
                    {meal.micronutrients && meal.micronutrients.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100">
                                    <Activity className="w-4 h-4 text-black" />
                                </div>
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Micronutrients</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {meal.micronutrients.map((micro, idx) => (
                                    <div key={idx} className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm group hover:border-black transition-all">
                                        <div className="flex justify-between items-center mb-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{micro.name}</p>
                                            <span className="text-[10px] font-black text-white bg-black px-1.5 py-0.5 rounded-md">{micro.percentage || 0}%</span>
                                        </div>
                                        <p className="text-lg font-black text-slate-800 mb-2">{micro.value || '--'}</p>
                                        <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                                            <div
                                                className="h-full bg-black transition-all duration-1000"
                                                style={{ width: `${micro.percentage || 0}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Alternatives */}
                    {meal.alternatives && meal.alternatives.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center border border-slate-800">
                                    <Sparkles className="w-4 h-4 text-white" />
                                </div>
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Healthier Alternatives</h3>
                            </div>
                            <div className="space-y-3">
                                {meal.alternatives.map((alt, idx) => (
                                    <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-4 transition-all hover:bg-emerald-50/30 group">
                                        <div className="flex justify-between items-center mb-1">
                                            <h4 className="font-black text-slate-800 text-sm">{alt.name}</h4>
                                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-all" />
                                        </div>
                                        <p className="text-xs text-slate-500 font-bold leading-relaxed">{alt.description}</p>
                                        {alt.nutrition && (
                                            <div className="mt-3 flex gap-3">
                                                <span className="text-[10px] font-black text-white bg-black px-2 py-1 rounded-lg">
                                                    {alt.nutrition.calories} kcal
                                                </span>
                                                <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                                                    P: {alt.nutrition.protein}g
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Enhancement Tips */}
                    {meal.enhancementTips && meal.enhancementTips.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100">
                                    <Zap className="w-4 h-4 text-black" />
                                </div>
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Upgrade this Meal</h3>
                            </div>
                            <div className="space-y-2">
                                {meal.enhancementTips.map((tip, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-4 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-md transition-all">
                                        <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-black/10">
                                            <Zap className="w-5 h-5 fill-white" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-800 leading-none mb-1">
                                                {typeof tip === 'object' ? tip.name || tip.tip : tip}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{typeof tip === 'object' ? tip.benefit || 'Better Nutrition' : 'Better Nutrition'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 text-center border-t border-slate-100 shrink-0">
                    <div className="inline-flex items-center gap-2">
                        <div className="p-1 bg-white rounded-md border border-slate-200">
                            <Info className="w-3 h-3 text-black" />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Analyzed by HealthCare AI System</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
