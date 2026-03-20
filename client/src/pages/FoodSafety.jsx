import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, AlertTriangle, ShieldCheck, Beaker, 
  Info, ArrowRight, RefreshCw, CheckCircle2, 
  History, FlaskConical, ChevronRight
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const FoodSafety = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [safetyRecords, setSafetyRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const detailsRef = useRef(null);

  useEffect(() => {
    if (selectedItem && detailsRef.current) {
      detailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedItem]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const res = await api.get('food-safety/all');
      const data = res.data.data || [];
      setSafetyRecords(data);
      setActiveAlerts(data.filter(r => r.isAlertActive));
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to load safety data');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      fetchInitialData();
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`food-safety/search?query=${searchQuery}`);
      const data = res.data.data || [];
      setSafetyRecords(data);
      if (data.length > 0) {
        setSelectedItem(data[0]);
      } else {
        setSelectedItem(null);
      }
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pt-24 pb-20 px-4 md:px-12 lg:px-24">
      {/* Search Header */}
      <div className="max-w-4xl mx-auto text-center mb-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 bg-slate-100 text-slate-800 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest mb-6"
        >
          <ShieldCheck className="w-4 h-4" /> Official Adulteration Check
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-8 tracking-tight">
          Is Your Food Safe?
        </h1>
        
        <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto group">
          <input 
            type="text"
            placeholder="Search e.g. 'Milk', 'Paneer', 'Honey'..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl py-6 pl-14 pr-32 focus:outline-none focus:border-slate-900 transition-all text-sm font-bold text-slate-900"
          />
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
          <button 
            type="submit"
            className="absolute right-3 top-3 bottom-3 bg-slate-900 text-white px-8 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
          >
            Verify
          </button>
        </form>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left: Alerts & Quick List */}
        <div className="lg:col-span-4 space-y-8">
          <div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" /> Recent Alerts
            </h3>
            <div className="space-y-3">
              {activeAlerts.length > 0 ? (
                activeAlerts.slice(0, 3).map((alert) => (
                  <button 
                    key={alert._id}
                    onClick={() => setSelectedItem(alert)}
                    className={`w-full text-left p-5 rounded-3xl border transition-all ${selectedItem?._id === alert._id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                  >
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">Active Alert</p>
                    <h4 className="text-sm font-bold truncate uppercase">{alert.foodName}</h4>
                  </button>
                ))
              ) : (
                <div className="p-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                  <p className="text-[10px] font-black text-slate-400 uppercase">No active alerts</p>
                </div>
              )}
            </div>
          </div>

          <div>
             <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" /> Verified Items
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {safetyRecords.filter(r => !r.isAlertActive).slice(0, 4).map(r => (
                <button 
                  key={r._id}
                  onClick={() => setSelectedItem(r)}
                  className={`p-4 rounded-2xl border text-[10px] font-bold uppercase transition-all ${selectedItem?._id === r._id ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 border-slate-100 hover:bg-white'}`}
                >
                  {r.foodName}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Detailed View */}
        <div className="lg:col-span-8" ref={detailsRef}>
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div 
                key="loader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full min-h-[500px] bg-white rounded-[3rem] p-8 md:p-12 border border-slate-100 flex flex-col"
              >
                <div className="h-10 w-64 animate-shimmer rounded-xl mb-8"></div>
                <div className="flex-1 space-y-8">
                  <div className="h-32 w-full animate-shimmer rounded-[2rem]"></div>
                  <div className="space-y-4">
                     {[1, 2, 3].map(i => (
                       <div key={i} className="h-4 w-full animate-shimmer rounded-full"></div>
                     ))}
                  </div>
                  <div className="h-48 w-full animate-shimmer rounded-[2rem]"></div>
                </div>
              </motion.div>
            ) : selectedItem ? (
              <motion.div 
                key={selectedItem._id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 p-8 md:p-12 overflow-hidden relative"
              >
                <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12">
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tight mb-4">{selectedItem.foodName}</h2>
                    <div className="flex flex-wrap gap-2">
                      {selectedItem.adulterants?.map((a, i) => (
                        <span key={i} className="px-4 py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-full text-[10px] font-black uppercase tracking-widest">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Safety Score</p>
                    <div className={`text-5xl font-black ${selectedItem.safetyScore > 70 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {selectedItem.safetyScore}<span className="text-lg opacity-40">/100</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                   <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Info className="w-4 h-4 text-slate-400" /> Health Risks
                      </h4>
                      <ul className="space-y-4">
                        {selectedItem.healthRisks?.map((risk, i) => (
                          <li key={i} className="flex gap-3 text-sm font-medium text-slate-600 leading-relaxed">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 mt-2" />
                            {risk}
                          </li>
                        ))}
                      </ul>
                   </div>

                   <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                      <h4 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Beaker className="w-4 h-4 text-slate-400" /> Home Purity Test
                      </h4>
                      <div className="space-y-6">
                        {selectedItem.homeTests?.map((test, i) => (
                          <div key={i} className="flex gap-4">
                            <div className="w-8 h-8 rounded-2xl bg-white/10 flex items-center justify-center text-xs font-black shrink-0">{i + 1}</div>
                            <p className="text-sm font-medium leading-relaxed text-slate-200">{test}</p>
                          </div>
                        ))}
                      </div>
                   </div>
                </div>

                <div className="flex items-center justify-between pt-8 border-t border-slate-50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Last Verified: {new Date(selectedItem.lastUpdated).toLocaleDateString('en-IN')}
                  </p>
                  <div className="flex items-center gap-4">
                    <RefreshCw className="w-4 h-4 text-slate-200" />
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full min-h-[600px] flex flex-col items-center justify-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-100 text-center p-12"
              >
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-8">
                  <Search className="w-10 h-10 text-slate-200" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 uppercase mb-4 tracking-tight">Search to Verify Safety</h3>
                <p className="text-slate-400 text-sm font-medium max-w-sm mx-auto leading-relaxed">
                  Enter any food item above to scan official records and learn home testing methods.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default FoodSafety;
