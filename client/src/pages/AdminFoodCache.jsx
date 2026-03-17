import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Filter, Edit, Trash2, ChevronLeft,
  ChevronRight, RefreshCw, Star, Info, Upload, FileDown,
  AlertTriangle, X, Save, CheckCircle2, Flame, Droplet, Wheat, Activity, Heart, List, HelpCircle
} from 'lucide-react';
import { adminService } from '../services/api';
import toast from 'react-hot-toast';

export default function AdminFoodCache() {
  const [foods, setFoods] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedFood, setSelectedFood] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkData, setBulkData] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    foodName: '',
    searchDescription: '',
    quantity: '100g',
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
    healthScore: 70,
    analysis: '',
    healthBenefitsSummary: '',
    isHealthy: true,
    micronutrients: [],
    benefits: [],
    enhancementTips: [],
    warnings: [],
    alternatives: []
  });

  const fetchFoods = async () => {
    setLoading(true);
    try {
      const { data } = await adminService.getFoodCache({ search, page, limit: 15 });
      setFoods(data.foods || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      toast.error('Failed to load food database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchFoods();
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [page, search]);

  const handleOpenModal = (food = null) => {
    if (food) {
      setFormData({
        foodName: food.foodName || '',
        searchDescription: food.searchDescription || '',
        quantity: food.quantity || '100g',
        calories: food.calories || food.nutrition?.calories || 0,
        protein: food.protein || food.nutrition?.protein || 0,
        carbs: food.carbs || food.nutrition?.carbs || 0,
        fats: food.fats || food.nutrition?.fats || 0,
        fiber: food.nutrition?.fiber || 0,
        sugar: food.nutrition?.sugar || 0,
        sodium: food.nutrition?.sodium || 0,
        healthScore: food.healthScore || 70,
        analysis: food.analysis || '',
        healthBenefitsSummary: food.healthBenefitsSummary || '',
        isHealthy: food.isHealthy ?? true,
        micronutrients: food.micronutrients || [],
        benefits: food.benefits || [],
        enhancementTips: food.enhancementTips || [],
        warnings: food.warnings || [],
        alternatives: food.alternatives || []
      });
      setSelectedFood(food);
      setIsEditing(true);
    } else {
      setFormData({
        foodName: '',
        searchDescription: '',
        quantity: '100g',
        calories: 0,
        protein: 0,
        carbs: 0,
        fats: 0,
        fiber: 0,
        sugar: 0,
        sodium: 0,
        healthScore: 70,
        analysis: '',
        healthBenefitsSummary: '',
        isHealthy: true,
        micronutrients: [],
        benefits: [],
        enhancementTips: [],
        warnings: [],
        alternatives: []
      });
      setSelectedFood(null);
      setIsEditing(false);
    }
    setShowModal(true);
  };

  const addItem = (field, item) => {
    setFormData(prev => ({ ...prev, [field]: [...prev[field], item] }));
  };

  const removeItem = (field, index) => {
    setFormData(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
  };

  const updateArrayItem = (field, index, value) => {
    const newArr = [...formData[field]];
    newArr[index] = value;
    setFormData(prev => ({ ...prev, [field]: newArr }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        nutrition: {
          calories: formData.calories,
          protein: formData.protein,
          carbs: formData.carbs,
          fats: formData.fats,
          fiber: formData.fiber,
          sugar: formData.sugar,
          sodium: formData.sodium
        }
      };

      if (isEditing) {
        await adminService.updateFoodCache(selectedFood._id, payload);
        toast.success('Food database updated');
      } else {
        await adminService.createFoodCache(payload);
        toast.success('Food added to database');
      }
      setShowModal(false);
      fetchFoods();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this entry from the database?')) return;
    try {
      await adminService.deleteFoodCache(id);
      toast.success('Entry removed');
      fetchFoods();
    } catch (err) {
      toast.error('Deletion failed');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('⚠️ WARNING: This will permanently delete EVERY food model in the Global Database. This action cannot be undone. Are you absolutely sure?')) return;
    
    // Final verification for such a destructive action
    const confirmText = window.prompt('Type "DELETE ALL" to confirm:');
    if (confirmText !== 'DELETE ALL') {
      toast.error('Clear action cancelled');
      return;
    }

    try {
      const response = await adminService.clearFoodCache();
      toast.success(response.data.message || 'Database cleared');
      fetchFoods();
    } catch (err) {
      toast.error('Failed to clear database');
    }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(bulkData);
      const foodsArray = Array.isArray(parsed) ? parsed : (parsed.foods || []);
      
      if (foodsArray.length === 0) {
        toast.error('No valid food items found in JSON');
        return;
      }

      await adminService.bulkCreateFoodCache({ foods: foodsArray });
      toast.success(`Successfully imported ${foodsArray.length} items`);
      setShowBulkModal(false);
      setBulkData('');
      fetchFoods();
    } catch (err) {
      toast.error('Invalid JSON format or upload failed');
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        foodName: "Sample Food",
        searchDescription: "sample",
        quantity: "100g",
        calories: 150,
        protein: 10,
        carbs: 20,
        fats: 5,
        healthScore: 85,
        analysis: "High protein, healthy choice.",
        healthBenefitsSummary: "Good for energy.",
        isHealthy: true,
        benefits: [{ name: "Energy", benefit: "Boosts metabolism" }],
        micronutrients: [{ name: "Vitamin C", value: "20mg", percentage: 30 }],
        warnings: ["Contains nuts"],
        enhancementTips: [{ name: "Add lemon", benefit: "Better absorption" }],
        alternatives: [{ name: "Quinoa", description: "Better grain option" }]
      }
    ];
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(template, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "food_db_template.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Food DB</h1>
          <p className="text-slate-500 text-sm">{total} verified food models in database</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleClearAll}
            className="bg-red-50 hover:bg-red-100 text-red-600 px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all border border-red-100"
          >
            <Trash2 className="w-4 h-4" /> Clear All
          </button>
          <button 
            onClick={() => setShowBulkModal(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all"
          >
            <Upload className="w-4 h-4" /> Bulk Upload
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-100"
          >
            <Plus className="w-4 h-4" /> Add Food Model
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          type="text"
          placeholder="Search by food name or search key..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-sm focus:border-blue-500 outline-none shadow-sm transition-all"
        />
      </div>

      {/* Tabular Registry */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center h-[400px]">
             <div className="w-8 h-8 border-3 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50">
                <tr className="border-b border-slate-50">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Display Food Name</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Search Key</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Calories</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Protein</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Carbs</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Fats</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Profile</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {foods.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-20 text-center text-slate-400 text-sm font-medium">No results found in database</td>
                  </tr>
                ) : (
                  foods.map((food) => (
                    <tr key={food._id} className="hover:bg-slate-50/50 transition-all group">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800 text-sm">{food.foodName}</p>
                        <p className={`text-[10px] font-black uppercase tracking-tighter ${food.isHealthy ? 'text-emerald-500' : 'text-orange-400'}`}>
                          {food.isHealthy ? 'Healthy • IQ ' + (food.healthScore || 0) : 'Caution • IQ ' + (food.healthScore || 0)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-lg italic">"{food.searchDescription}"</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-bold text-slate-700">{food.calories}</span>
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-bold text-emerald-600">{food.protein}g</td>
                      <td className="px-6 py-4 text-center text-sm font-bold text-blue-600">{food.carbs}g</td>
                      <td className="px-6 py-4 text-center text-sm font-bold text-orange-600">{food.fats}g</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1 opacity-70">
                          {food.benefits?.length > 0 && <Heart className="w-3.5 h-3.5 text-emerald-500" title="Has Benefits" />}
                          {food.micronutrients?.length > 0 && <Activity className="w-3.5 h-3.5 text-blue-500" title="Has Micronutrients" />}
                          {food.warnings?.length > 0 && <AlertTriangle className="w-3.5 h-3.5 text-orange-500" title="Has Warnings" />}
                          {(!food.benefits?.length && !food.micronutrients?.length && !food.warnings?.length) && <span className="text-[10px] text-slate-400 italic">Basic</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleOpenModal(food)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(food._id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-slate-50 flex items-center justify-between text-xs">
          <p className="text-slate-400 font-medium">Page {page} of {pages}</p>
          <div className="flex gap-2">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg disabled:opacity-30 transition-all"
            >
              Previous
            </button>
            <button 
              disabled={page === pages} 
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg disabled:opacity-30 transition-all"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Editor Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
               <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-white shrink-0">
                  <h2 className="text-xl font-bold text-slate-800">{isEditing ? 'Edit Food DB Entry' : 'Manual Food Add (AI Card Emulation)'}</h2>
                  <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-6 h-6" /></button>
               </div>
               
               <form onSubmit={handleSubmit} className="p-8 overflow-y-auto space-y-10 no-scrollbar">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Info className="w-4 h-4" /> Core Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Food Display Name</label>
                        <input required value={formData.foodName} onChange={(e) => setFormData({...formData, foodName: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-blue-500" placeholder="e.g. Masala Dosa" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Search Trigger Key</label>
                        <input required value={formData.searchDescription} onChange={(e) => setFormData({...formData, searchDescription: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-blue-500" placeholder="Exact text user searches" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Quantity Context</label>
                        <input required value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-blue-500" placeholder="e.g. 1 plate (200g)" />
                      </div>
                    </div>
                  </div>

                  {/* Nutrition Registry */}
                  <div className="space-y-4 pt-4 border-t border-slate-50">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Flame className="w-4 h-4" /> Nutrition Registry</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: 'Calories', field: 'calories', unit: 'kcal' },
                        { label: 'Protein', field: 'protein', unit: 'g' },
                        { label: 'Carbs', field: 'carbs', unit: 'g' },
                        { label: 'Fats', field: 'fats', unit: 'g' },
                        { label: 'Fiber', field: 'fiber', unit: 'g' },
                        { label: 'Sugar', field: 'sugar', unit: 'g' },
                        { label: 'Sodium', field: 'sodium', unit: 'mg' },
                        { label: 'IQ Score', field: 'healthScore', unit: '%' }
                      ].map(macro => (
                        <div key={macro.field} className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">{macro.label} ({macro.unit})</label>
                          <input type="number" step="0.1" value={formData[macro.field]} onChange={(e) => setFormData({...formData, [macro.field]: parseFloat(e.target.value)})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Health Analysis Speech */}
                  <div className="space-y-4 pt-4 border-t border-slate-50">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Zap className="w-4 h-4" /> AI Analysis Narrative</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Primary Analysis Card Body</label>
                        <textarea rows="4" value={formData.analysis} onChange={(e) => setFormData({...formData, analysis: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-blue-500 resize-none no-scrollbar" placeholder="Deep health insight for the user..." />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Health Benefits summary</label>
                        <textarea rows="4" value={formData.healthBenefitsSummary} onChange={(e) => setFormData({...formData, healthBenefitsSummary: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-blue-500 resize-none no-scrollbar" placeholder="Brief summary of why this is good/bad..." />
                      </div>
                    </div>
                  </div>

                  {/* Arrays: Benefits, Micronutrients, Warnings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-4 border-t border-slate-50">
                    {/* Benefits Array */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                         <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Heart className="w-4 h-4" /> Key Benefits</h3>
                         <button type="button" onClick={() => addItem('benefits', { name: '', benefit: '' })} className="p-1 px-2 text-[10px] font-bold bg-emerald-50 text-emerald-600 rounded-lg">+ Add</button>
                      </div>
                      <div className="space-y-3">
                        {formData.benefits.map((item, idx) => (
                          <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 relative">
                            <button type="button" onClick={() => removeItem('benefits', idx)} className="absolute top-2 right-2 text-rose-400"><X className="w-4 h-4" /></button>
                            <input className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold" placeholder="Benefit Title (e.g. Muscle Growth)" value={item.name} onChange={(e) => {
                              const newB = [...formData.benefits];
                              newB[idx].name = e.target.value;
                              setFormData({...formData, benefits: newB});
                            }} />
                            <textarea className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none no-scrollbar" placeholder="Short description..." value={item.benefit} onChange={(e) => {
                               const newB = [...formData.benefits];
                               newB[idx].benefit = e.target.value;
                               setFormData({...formData, benefits: newB});
                            }} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Micronutrients Array */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                         <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Activity className="w-4 h-4" /> Micronutrients</h3>
                         <button type="button" onClick={() => addItem('micronutrients', { name: '', value: '', percentage: 0 })} className="p-1 px-2 text-[10px] font-bold bg-blue-50 text-blue-600 rounded-lg">+ Add</button>
                      </div>
                      <div className="space-y-2">
                         {formData.micronutrients.map((item, idx) => (
                           <div key={idx} className="flex gap-2 items-center">
                             <input className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold" placeholder="Nutrient" value={item.name} onChange={(e) => {
                               const newM = [...formData.micronutrients];
                               newM[idx].name = e.target.value;
                               setFormData({...formData, micronutrients: newM});
                             }} />
                             <input className="w-20 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs" placeholder="Value" value={item.value} onChange={(e) => {
                               const newM = [...formData.micronutrients];
                               newM[idx].value = e.target.value;
                               setFormData({...formData, micronutrients: newM});
                             }} />
                             <input type="number" className="w-16 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs" placeholder="%" value={item.percentage} onChange={(e) => {
                               const newM = [...formData.micronutrients];
                               newM[idx].percentage = parseFloat(e.target.value);
                               setFormData({...formData, micronutrients: newM});
                             }} />
                             <button type="button" onClick={() => removeItem('micronutrients', idx)} className="text-rose-400"><X className="w-4 h-4" /></button>
                           </div>
                         ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-4 border-t border-slate-50">
                    {/* Warnings */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                         <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Vital Warnings</h3>
                         <button type="button" onClick={() => addItem('warnings', '')} className="p-1 px-2 text-[10px] font-bold bg-orange-50 text-orange-600 rounded-lg">+ Add</button>
                      </div>
                      <div className="space-y-2">
                        {formData.warnings.map((item, idx) => (
                          <div key={idx} className="flex gap-2">
                            <input className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-medium" value={item} onChange={(e) => updateArrayItem('warnings', idx, e.target.value)} />
                            <button type="button" onClick={() => removeItem('warnings', idx)} className="text-rose-400"><X className="w-4 h-4" /></button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Enhancement Tips */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                         <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><HelpCircle className="w-4 h-4" /> Healthy Tips</h3>
                         <button type="button" onClick={() => addItem('enhancementTips', { name: '', benefit: '' })} className="p-1 px-2 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-lg">+ Add</button>
                      </div>
                      <div className="space-y-2">
                        {formData.enhancementTips.map((item, idx) => (
                          <div key={idx} className="flex gap-2">
                            <input className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs" placeholder="Tip" value={item.name} onChange={(e) => {
                              const newT = [...formData.enhancementTips];
                              newT[idx].name = e.target.value;
                              setFormData({...formData, enhancementTips: newT});
                            }} />
                            <button type="button" onClick={() => removeItem('enhancementTips', idx)} className="text-rose-400"><X className="w-4 h-4" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Alternatives */}
                    <div className="col-span-1 md:col-span-2 space-y-4">
                      <div className="flex items-center justify-between">
                         <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><List className="w-4 h-4" /> Healthy Alternatives</h3>
                         <button type="button" onClick={() => addItem('alternatives', { name: '', description: '' })} className="p-1 px-2 text-[10px] font-bold bg-purple-50 text-purple-600 rounded-lg">+ Add</button>
                      </div>
                      <div className="space-y-3">
                        {formData.alternatives.map((item, idx) => (
                          <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 relative">
                            <button type="button" onClick={() => removeItem('alternatives', idx)} className="absolute top-2 right-2 text-rose-400"><X className="w-4 h-4" /></button>
                            <input className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold" placeholder="Alternative Name (e.g. Quinoa)" value={item.name} onChange={(e) => {
                              const newA = [...formData.alternatives];
                              newA[idx].name = e.target.value;
                              setFormData({...formData, alternatives: newA});
                            }} />
                            <textarea className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none no-scrollbar" placeholder="Why is this a better choice?..." value={item.description} onChange={(e) => {
                               const newA = [...formData.alternatives];
                               newA[idx].description = e.target.value;
                               setFormData({...formData, alternatives: newA});
                            }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Healthy Toggle */}
                  <div className="pt-6 border-t border-slate-50 flex items-center gap-4">
                     <button type="button" onClick={() => setFormData({...formData, isHealthy: !formData.isHealthy})} className={`flex-1 py-4 px-6 rounded-2xl text-xs font-bold border transition-all flex items-center justify-center gap-3 ${formData.isHealthy ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                        {formData.isHealthy ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                        Platform Health Verdict: {formData.isHealthy ? 'Healthy Choice' : 'Consume with Caution'}
                     </button>
                  </div>

                  <div className="flex gap-4 pt-4 font-bold text-sm shrink-0">
                    <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all">Cancel DB Operation</button>
                    <button type="submit" className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2">
                      <Save className="w-5 h-5" /> Commit to Food Database
                    </button>
                  </div>
               </form>
            </motion.div>
          </div>
        )}
</AnimatePresence>

      {/* Bulk Upload Modal */}
      <AnimatePresence>
        {showBulkModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBulkModal(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
               <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-white shrink-0">
                  <h2 className="text-xl font-bold text-slate-800">Bulk Import Food Models</h2>
                  <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-6 h-6" /></button>
               </div>
               
               <form onSubmit={handleBulkSubmit} className="p-8 space-y-6 overflow-y-auto no-scrollbar">
                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-start gap-4">
                    <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-blue-700 leading-relaxed">
                      <p className="font-bold mb-1">JSON Bulk Instructions:</p>
                      <p>Upload a JSON array of food objects. Each object should follow the standard Food Model schema used in manual addition.</p>
                      <button type="button" onClick={downloadTemplate} className="mt-2 flex items-center gap-1.5 font-bold underline hover:text-blue-900 transition-colors">
                        <FileDown className="w-3.5 h-3.5" /> Download Template JSON
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Paste JSON Data</label>
                    <textarea 
                      required
                      rows="12"
                      value={bulkData}
                      onChange={(e) => setBulkData(e.target.value)}
                      placeholder='[ { "foodName": "Apple", ... }, { "foodName": "Banana", ... } ]'
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-mono outline-none focus:border-blue-500 transition-all resize-none no-scrollbar"
                    />
                  </div>

                  <div className="flex gap-4 pt-2">
                    <button type="button" onClick={() => setShowBulkModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all">Cancel</button>
                    <button type="submit" className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2">
                      <Save className="w-5 h-5" /> Start Bulk Induction
                    </button>
                  </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
