import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Trash2, CheckCircle2, Loader2, Flame, AlertTriangle } from 'lucide-react';

const num = (v) => Math.round(Number(v) || 0);

let tempIdCounter = 0;
const nextTempId = () => `tmp_${Date.now()}_${tempIdCounter++}`;

function toEditableDishes(dishes) {
  return (dishes || []).map((d) => ({
    tempId: nextTempId(),
    name: d.name || '',
    quantity: d.quantity || '',
    healthScore: d.healthScore,
    ingredients: (d.ingredients || []).map((i) => ({
      tempId: nextTempId(),
      name: i.name || '',
      quantity: i.quantity || '',
      nutrition: i.nutrition || {}
    })),
    nutrition: d.nutrition || {}
  }));
}

function stripTempIds(dishes) {
  return dishes.map(({ tempId, ingredients, ...dish }) => ({
    ...dish,
    ingredients: ingredients.map(({ tempId: _t, ...ing }) => ing)
  }));
}

export function MealEditReviewModal({ meal, onClose, onConfirm, isSubmitting }) {
  const originalDishes = useMemo(() => meal?.dishes || [], [meal]);
  const [editedDishes, setEditedDishes] = useState(() => toEditableDishes(originalDishes));

  const [isEditMode, setIsEditMode] = useState(false);

  const mealTotals = useMemo(() => {
    return editedDishes.reduce(
      (acc, d) => ({
        calories: acc.calories + (Number(d.nutrition?.calories) || 0),
        protein: acc.protein + (Number(d.nutrition?.protein) || 0),
        carbs: acc.carbs + (Number(d.nutrition?.carbs) || 0),
        fats: acc.fats + (Number(d.nutrition?.fats) || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
  }, [editedDishes]);

  if (!meal) return null;

  const updateDish = (dishTempId, patch) => {
    setEditedDishes((prev) =>
      prev.map((d) => (d.tempId === dishTempId ? { ...d, ...patch } : d))
    );
  };

  const updateIngredient = (dishTempId, ingTempId, patch) => {
    setEditedDishes((prev) =>
      prev.map((d) =>
        d.tempId !== dishTempId
          ? d
          : {
              ...d,
              ingredients: d.ingredients.map((i) =>
                i.tempId === ingTempId ? { ...i, ...patch } : i
              )
            }
      )
    );
  };

  const addIngredient = (dishTempId) => {
    setEditedDishes((prev) =>
      prev.map((d) =>
        d.tempId !== dishTempId
          ? d
          : {
              ...d,
              ingredients: [
                ...d.ingredients,
                { tempId: nextTempId(), name: '', quantity: '', nutrition: {} }
              ]
            }
      )
    );
  };

  const removeIngredient = (dishTempId, ingTempId) => {
    setEditedDishes((prev) =>
      prev.map((d) =>
        d.tempId !== dishTempId
          ? d
          : { ...d, ingredients: d.ingredients.filter((i) => i.tempId !== ingTempId) }
      )
    );
  };

  const removeDish = (dishTempId) => {
    setEditedDishes((prev) => prev.filter((d) => d.tempId !== dishTempId));
  };

  const handleConfirmClick = () => {
    const finalDishes = stripTempIds(editedDishes).filter((d) => d.name.trim());
    if (finalDishes.length === 0) return;

    onConfirm({
      dishes: finalDishes,
      isEdited: isEditMode,
      quickCheckId: meal._id || null,
      imageUrl: meal.imageUrl || null,
      imageUrls: meal.imageUrls || []
    });
  };

  const fieldClass = (extra = '') =>
    `${extra} ${
      isEditMode
        ? 'bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#69A38D]/30 focus:border-[#69A38D]'
        : 'bg-transparent border-transparent text-slate-500 cursor-default'
    }`;

  return (
    <div className="fixed inset-0 z-[1001] flex items-end md:items-center justify-center p-0 md:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, y: 80, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 80, scale: 0.97 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative w-full max-w-md bg-[#f7f8f4] rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-[0_-10px_60px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col max-h-[92vh] md:max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Review Your Meal</h2>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
              Check the box below to fix anything that's wrong
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 bg-white hover:bg-slate-50 rounded-full flex items-center justify-center transition-all border border-slate-200 shadow-sm shrink-0 ml-3"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Meal Summary */}
        <div className="px-6 pb-4 shrink-0">
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {editedDishes.length} {editedDishes.length === 1 ? 'Dish' : 'Dishes'} Detected
              </p>
              <div className="flex items-center gap-1 text-emerald-600">
                <Flame className="w-3.5 h-3.5" />
                <span className="text-[11px] font-black">{num(mealTotals.calories)} kcal</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'KCAL', value: mealTotals.calories, unit: '' },
                { label: 'PROTEIN', value: mealTotals.protein, unit: 'g' },
                { label: 'CARBS', value: mealTotals.carbs, unit: 'g' },
                { label: 'FATS', value: mealTotals.fats, unit: 'g' },
              ].map((m) => (
                <div key={m.label} className="text-center">
                  <p className="text-base font-black text-slate-900 leading-none">
                    {num(m.value)}
                    {m.unit && <span className="text-[9px] font-bold text-slate-400 ml-0.5">{m.unit}</span>}
                  </p>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{m.label}</p>
                </div>
              ))}
            </div>
            {(meal.healthBenefitsSummary || meal.analysis) && (
              <p className="text-[12px] text-slate-600 font-medium leading-relaxed mt-4 pt-3 border-t border-slate-100">
                {meal.healthBenefitsSummary || meal.analysis}
              </p>
            )}
          </div>
        </div>

        {/* Warnings — condition/allergy-specific flags from the AI analysis */}
        {Array.isArray(meal.warnings) && meal.warnings.length > 0 && (
          <div className="px-6 pb-4 shrink-0">
            <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-[11px] font-black text-red-700 uppercase tracking-widest mb-1.5">
                    Watch Out
                  </p>
                  <ul className="space-y-1">
                    {meal.warnings.map((w, i) => (
                      <li key={i} className="text-[12px] text-red-700 font-medium leading-relaxed">
                        • {typeof w === 'string' ? w : w.message || w.text || JSON.stringify(w)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit toggle */}
        <div className="px-6 pb-4 shrink-0">
          <label className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.04)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isEditMode}
              onChange={(e) => setIsEditMode(e.target.checked)}
              className="w-5 h-5 rounded-md accent-[#69A38D] cursor-pointer"
            />
            <div className="flex-1">
              <p className="text-[13px] font-black text-slate-900">
                {isEditMode ? 'Editing meal details' : 'Something wrong? Edit this meal'}
              </p>
              <p className="text-[10px] font-semibold text-slate-400">
                {isEditMode
                  ? 'Dish names, portions and ingredients are now editable'
                  : 'Leave unchecked to log exactly as detected'}
              </p>
            </div>
          </label>
        </div>

        {/* Scrollable dish list */}
        <div className="overflow-y-auto flex-1 scrollbar-hide px-6 pb-4 space-y-4">
          {editedDishes.length === 0 && (
            <p className="text-center text-sm text-slate-400 font-medium py-10">
              No dishes left — add at least one before logging.
            </p>
          )}

          {editedDishes.map((dish) => (
            <div
              key={dish.tempId}
              className="bg-white rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-slate-100/80"
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="flex-1 space-y-2 min-w-0">
                  <input
                    type="text"
                    value={dish.name}
                    onChange={(e) => updateDish(dish.tempId, { name: e.target.value })}
                    readOnly={!isEditMode}
                    placeholder="Dish name"
                    className={fieldClass(
                      'w-full border rounded-xl px-3 py-2 text-sm font-black text-slate-900 truncate'
                    )}
                  />
                  <input
                    type="text"
                    value={dish.quantity}
                    onChange={(e) => updateDish(dish.tempId, { quantity: e.target.value })}
                    readOnly={!isEditMode}
                    placeholder="Portion (e.g. 1 bowl, 250g)"
                    className={fieldClass(
                      'w-full border rounded-xl px-3 py-2 text-[10px] font-black text-emerald-600 uppercase tracking-wider'
                    )}
                  />
                </div>

                {isEditMode && (
                  <button
                    onClick={() => removeDish(dish.tempId)}
                    className="w-8 h-8 rounded-full bg-red-50 border border-red-100 text-red-400 hover:bg-red-100 flex items-center justify-center transition-all shrink-0"
                    title="Remove this dish"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Dish nutrition */}
              <div className="flex items-center gap-3 px-1 mt-1">
                <span className="text-[10px] font-black text-slate-500">{num(dish.nutrition?.calories)} kcal</span>
                <span className="text-[10px] font-bold text-slate-400">P {num(dish.nutrition?.protein)}g</span>
                <span className="text-[10px] font-bold text-slate-400">C {num(dish.nutrition?.carbs)}g</span>
                <span className="text-[10px] font-bold text-slate-400">F {num(dish.nutrition?.fats)}g</span>
                {isEditMode && (
                  <span className="text-[9px] font-bold text-amber-500 ml-auto">Recalculated on confirm</span>
                )}
              </div>

              {/* Ingredients */}
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                {dish.ingredients.map((ing) => (
                  <div key={ing.tempId} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={ing.name}
                      onChange={(e) => updateIngredient(dish.tempId, ing.tempId, { name: e.target.value })}
                      readOnly={!isEditMode}
                      placeholder="Ingredient"
                      className={fieldClass(
                        'flex-1 min-w-0 border rounded-lg px-3 py-2 text-[12px] font-semibold text-slate-700'
                      )}
                    />
                    <input
                      type="text"
                      value={ing.quantity}
                      onChange={(e) => updateIngredient(dish.tempId, ing.tempId, { quantity: e.target.value })}
                      readOnly={!isEditMode}
                      placeholder="Qty"
                      className={fieldClass(
                        'w-20 shrink-0 border rounded-lg px-2.5 py-2 text-[12px] font-semibold text-slate-700 text-center'
                      )}
                    />
                    {!isEditMode && (
                      <span className="w-14 shrink-0 text-right text-[10px] font-bold text-slate-400">
                        {num(ing.nutrition?.calories)} kcal
                      </span>
                    )}
                    {isEditMode && (
                      <button
                        onClick={() => removeIngredient(dish.tempId, ing.tempId)}
                        className="w-7 h-7 shrink-0 rounded-full text-slate-300 hover:text-red-400 hover:bg-red-50 flex items-center justify-center transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                {isEditMode && (
                  <button
                    onClick={() => addIngredient(dish.tempId)}
                    className="w-full mt-1 py-2 rounded-lg border border-dashed border-slate-200 text-[10px] font-black text-slate-400 hover:text-[#5B9A80] hover:border-[#69A38D] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Plus className="w-3 h-3" /> Add Ingredient
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Confirm */}
        <div className="px-6 pb-6 pt-2 shrink-0 bg-gradient-to-t from-[#f7f8f4] via-[#f7f8f4] to-transparent">
          <button
            onClick={handleConfirmClick}
            disabled={isSubmitting || editedDishes.length === 0}
            className="w-full py-4 bg-[#69A38D] hover:bg-[#5B9A80] text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {isSubmitting ? 'Logging...' : 'Confirm & Log Meal'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
