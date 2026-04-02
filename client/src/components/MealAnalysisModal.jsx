import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Zap, CheckCircle2, Lightbulb, FlaskConical, Utensils, Plus } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';

export function MealAnalysisModal({ meal, onClose, onAdd }) {
  if (!meal) return null;

  return (
    <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-white rounded-t-[3rem] md:rounded-[3rem] shadow-[0_32px_120px_rgba(0,0,0,0.15)] overflow-hidden h-[95vh] md:max-h-[90vh] flex flex-col"
      >
        {/* Visual Image Header */}
        <div className="p-5 md:p-10 relative overflow-hidden shrink-0 min-h-[220px] md:min-h-[280px] flex flex-col justify-between">
          <div className="absolute inset-0 z-0 bg-slate-800">
            <ImageWithFallback 
              src={meal.image || meal.imageUrl}
              query={meal.foodItem?.name || meal.foodName || meal.foodItems?.[0]?.name || meal.title || "Healthy Plate"}
              alt="Analyzed Food"
              className="w-full h-full object-cover opacity-90"
            />
          </div>
          <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/95 via-black/50 to-black/30 backdrop-blur-[2px]" />
          
          <div className="relative z-10 w-full flex justify-between items-start mb-6">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-xl">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex gap-2">
               {onAdd && (
                 <button onClick={onAdd} className="w-10 h-10 md:w-12 md:h-12 bg-emerald-500 hover:bg-emerald-600 backdrop-blur-md rounded-full flex items-center justify-center transition-all border border-emerald-400 shadow-xl">
                   <Plus className="w-5 h-5 text-white" />
                 </button>
               )}
               <button onClick={onClose} className="w-10 h-10 md:w-12 md:h-12 bg-white/10 hover:bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center transition-all border border-white/20 shadow-xl">
                 <X className="w-5 h-5 text-white" />
               </button>
            </div>
          </div>

          <div className="relative z-10 w-full mt-auto">
            <h4 className="text-[9px] md:text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-2 px-0.5 drop-shadow-md">
              Intelligence Analysis
            </h4>
            <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase leading-none mb-4 max-w-[95%] text-white drop-shadow-lg">
              {meal.foodItems?.[0]?.name || meal.foodItem?.name || meal.foodName || meal.title || 'Analyzed Meal'}
            </h2>
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <span className="text-[8px] md:text-[10px] font-black bg-white/20 backdrop-blur-md border border-white/20 px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-white tracking-[0.1em] uppercase shadow-lg">
                {meal.foodItem?.quantity || meal.quantity || '1 serving'}
              </span>
              <span className="text-[8px] md:text-[10px] font-black bg-white/20 backdrop-blur-md border border-white/20 px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-white tracking-[0.1em] uppercase flex items-center gap-1.5 md:gap-2 shadow-lg">
                <Zap className="w-3 h-3 text-amber-300" />
                Score: {meal.healthScore || (meal.healthScore10 ? meal.healthScore10 * 10 : 0) || 50}/100
              </span>
            </div>
          </div>
        </div>

        <div className="p-10 space-y-10 overflow-y-auto scrollbar-hide flex-1">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Calories', value: meal.foodItem?.nutrition?.calories || meal.totalNutrition?.calories || meal.nutrition?.calories || meal.calories || 0, unit: 'kcal' },
              { label: 'Protein', value: meal.foodItem?.nutrition?.protein || meal.totalNutrition?.protein || meal.nutrition?.protein || meal.protein || 0, unit: 'g' },
              { label: 'Carbs', value: meal.foodItem?.nutrition?.carbs || meal.totalNutrition?.carbs || meal.nutrition?.carbs || meal.carbs || 0, unit: 'g' },
              { label: 'Fats', value: meal.foodItem?.nutrition?.fats || meal.totalNutrition?.fats || meal.nutrition?.fats || meal.fats || 0, unit: 'g' }
            ].map((m) => (
              <div key={m.label} className="bg-white p-5 rounded-[2rem] text-center border-2 border-slate-900 flex flex-col justify-center shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.label}</p>
                <p className="text-2xl font-black text-[#064e3b] tracking-tighter leading-none">{m.value}<span className="text-[10px] ml-0.5 text-slate-400 font-bold uppercase">{m.unit}</span></p>
              </div>
            ))}
          </div>

          <div>
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2.5">
               <Lightbulb className="w-4 h-4 text-slate-900" /> Health Summary
             </h4>
             <p className="text-sm text-slate-600 font-medium leading-relaxed bg-slate-50 p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-slate-100 italic relative">
               {meal.analysis || meal.healthBenefitsSummary || "Detailed nutritional analysis successfully processed by our AI."}
             </p>
          </div>

          <div>
            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2.5">
              <Zap className="w-4 h-4" /> Enhancement Tips
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {(meal.enhancementTips || []).slice(0, 4).map((tip, i) => (
                 <div key={i} className="flex flex-col gap-2 p-5 bg-black text-white rounded-[2rem] shadow-xl border border-white/10 transition-all hover:scale-[1.02]">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <p className="text-[10px] font-black uppercase tracking-tight">{typeof tip === 'string' ? tip : tip.name || 'Optimization'}</p>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
