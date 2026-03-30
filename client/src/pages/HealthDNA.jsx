import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Activity, ShieldCheck, Zap, AlertTriangle, Sparkles, ChevronRight, Dna, FileText, ArrowLeft, RefreshCw, Moon, Droplets, Flame, Footprints } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import GenericSkeleton from '../components/skeletons/GenericSkeleton';
import toast from 'react-hot-toast';
import { useData } from '../context/DataContext';

const OrganCard = ({ organ, score, status, detail }) => {
  const getScoreColor = (s) => {
    if (s >= 80) return 'text-emerald-500 bg-emerald-50';
    if (s >= 60) return 'text-amber-500 bg-amber-50';
    return 'text-rose-500 bg-rose-50';
  };

  const colors = getScoreColor(score);

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white rounded-[1.2rem] md:rounded-[2rem] p-3 md:p-6 border border-slate-100 shadow-sm hover:shadow-xl transition-all"
    >
      <div className="flex justify-between items-start mb-2 md:mb-4">
        <div className={`p-2 md:p-3 rounded-lg md:rounded-2xl ${colors}`}>
          <Heart className="w-4 h-4 md:w-6 md:h-6" />
        </div>
        <div className="text-right">
          <span className="text-lg md:text-2xl font-black text-black leading-none">{score}</span>
          <span className="text-[8px] md:text-[10px] font-bold text-slate-400 block uppercase mt-0.5">Score</span>
        </div>
      </div>
      <h4 className="text-sm md:text-lg font-bold text-slate-900 mb-0.5 md:mb-1">{organ}</h4>
      <div className={`inline-block px-2 md:px-3 py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-2 md:mb-3 ${colors}`}>
        {status}
      </div>
      <p className="text-xs md:text-sm text-slate-500 leading-relaxed text-justify md:text-left">{detail}</p>
    </motion.div>
  );
};

const RiskItem = ({ hazard, riskLevel, trend, prevention }) => (
  <div className="flex gap-2.5 md:gap-4 p-3 md:p-5 bg-slate-50 rounded-[1.2rem] md:rounded-[2rem] border border-slate-100">
    <div className={`w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-2xl flex items-center justify-center shrink-0 ${
      riskLevel === 'Low' ? 'bg-emerald-100 text-emerald-600' : 
      riskLevel === 'Moderate' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'
    }`}>
      <AlertTriangle className="w-4 h-4 md:w-6 md:h-6" />
    </div>
    <div>
      <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1 flex-wrap">
        <h5 className="font-bold text-xs md:text-base text-slate-900 leading-none">{hazard}</h5>
        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">• {trend}</span>
      </div>
      <p className="text-[10px] md:text-xs text-slate-500 mb-1.5 md:mb-2 leading-relaxed line-clamp-2 md:line-clamp-none">{prevention}</p>
      <div className={`inline-block px-2 py-0.5 md:px-2.5 md:py-1 rounded-md md:rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-wider ${
        riskLevel === 'Low' ? 'bg-emerald-500 text-white' : 
        riskLevel === 'Moderate' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'
      }`}>
        {riskLevel} Risk
      </div>
    </div>
  </div>
);

export default function HealthDNA() {
  const { dashboardData, nutritionData } = useData();
  const [dna, setDna] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchDNA = async (force = false) => {
    setLoading(true);
    try {
      const { data } = await api.get('/health/health-dna');
      setDna(data);
    } catch (err) {
      toast.error('Failed to analyze Health Profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDNA();
  }, []);

  if (loading) return <GenericSkeleton />;
  if (!dna) return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-white">
      <Dna className="w-16 h-16 text-slate-200 mb-4 animate-pulse" />
      <h2 className="text-xl font-bold text-slate-800 mb-2">Generating your Health Profile...</h2>
      <p className="text-slate-400 text-center max-w-xs mb-8">This takes about 30 seconds as our AI aggregates all your past reports.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FBF8] pb-24 font-sans overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-100/30 rounded-full blur-[120px] -mr-72 -mt-72" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cyan-100/20 rounded-full blur-[100px] -ml-40 -mb-40" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 hover:bg-slate-50 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-slate-900" />
          </button>
          <div className="flex items-center gap-2 px-4 md:px-6 py-1.5 md:py-2 bg-slate-900 text-white rounded-full shadow-lg shadow-black/10">
            <Dna className="w-3 h-3 md:w-4 md:h-4" />
            <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] whitespace-nowrap">Complete Health Profile</span>
          </div>
          <button 
            onClick={() => fetchDNA(true)}
            className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 hover:rotate-180 transition-all duration-500"
          >
            <RefreshCw className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Side: Personality & Story */}
          <div className="lg:col-span-2 space-y-8">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-8 shadow-xl border border-slate-100 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -mr-32 -mt-32" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4 md:mb-6">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-900 rounded-xl md:rounded-2xl flex items-center justify-center shadow-md shadow-black/10 shrink-0">
                    <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-none mb-0.5 md:mb-1">
                      Health Archetype
                    </h1>
                    <p className="text-[10px] md:text-xs font-bold text-emerald-600 uppercase tracking-widest leading-none">
                      "{dna.personality?.motto}"
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3 md:space-y-4 mt-6">
                  {(() => {
                    const combined = `${dna.personality?.description || ''} ${dna.healthStory || ''}`;
                    const sentences = combined.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
                    
                    return sentences.slice(0, 6).map((sentence, idx) => (
                      <div key={idx} className="flex items-start gap-3 bg-slate-50/80 p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-100/60 hover:bg-white hover:shadow-md transition-all group">
                        <div className="mt-0.5 w-5 h-5 md:w-6 md:h-6 bg-emerald-100/50 text-emerald-600 rounded-full flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                          <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="text-xs md:text-sm text-slate-700 leading-relaxed font-medium">
                          {sentence}.
                        </p>
                      </div>
                    ));
                  })()}
                </div>

                <div className="mt-5 md:mt-6 flex justify-end">
                  <div className="px-3 py-1.5 bg-white rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-100 shadow-sm text-slate-400">
                    Analyzed from {dna.aggregatedMetricsCount || 'global'} variables
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Organ Health Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {dna.organHealth?.map((organ, i) => (
                <OrganCard key={i} {...organ} />
              ))}
            </div>
          </div>

          {/* Right Side: Risks & Nutrition */}
          <div className="space-y-8">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Focus Risks</h3>
                <ShieldCheck className="w-6 h-6 text-slate-300" />
              </div>
              <div className="space-y-4">
                {dna.riskAssessment?.map((risk, i) => (
                  <RiskItem key={i} {...risk} />
                ))}
                {(!dna.riskAssessment || dna.riskAssessment.length === 0) && (
                  <div className="p-8 bg-emerald-50/30 rounded-3xl border border-emerald-100 text-center">
                    <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                    <p className="text-sm font-bold text-emerald-800">No immediate hazards detected based on your data.</p>
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-slate-900 rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8 shadow-2xl text-white relative overflow-hidden"
            >
              <div className="absolute bottom-0 right-0 w-48 h-48 bg-emerald-400/10 rounded-full blur-3xl -mb-24 -mr-24" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 md:gap-3 mb-4 md:mb-6">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-white/10 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />
                  </div>
                  <h3 className="text-lg md:text-xl font-black uppercase tracking-tight">Active Lifestyle</h3>
                </div>

                {(() => {
                  let feedback = [];
                  const sleep = dashboardData?.sleepInfo?.duration || "7h 0m";
                  const water = nutritionData?.waterIntake || dashboardData?.dailyProgress?.waterIntake || 0;
                  const steps = dashboardData?.wearableData?.steps || 0;

                  let sleepHours = 7;
                  const sleepMatch = sleep.match(/(\d+)h/);
                  if(sleepMatch) sleepHours = parseInt(sleepMatch[1]);

                  if(sleepHours < 6) feedback.push("Low sleep duration.");
                  else if(sleepHours >= 7) feedback.push("Great sleep schedule.");
                  else feedback.push("Fair sleep, aim for more.");

                  if(water < 4) feedback.push("You are under-hydrated; drink more glasses of water.");
                  else if(water < 8) feedback.push("Moderate water intake; keep sipping.");
                  else feedback.push("Excellent hydration.");

                  if(steps < 3000) feedback.push("Activity is low today; try a short walk.");
                  else if(steps >= 8000) feedback.push("Highly active! Fantastic job pushing those steps.");
                  else feedback.push("You have moderate activity levels.");

                  return (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mb-5 text-sm md:text-base leading-relaxed text-emerald-50">
                      <span className="font-bold text-emerald-400 mr-2">Overview:</span> 
                      {feedback.join(" ")}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 gap-3 md:gap-4 mb-3 md:mb-4">
                  <div className="p-3 md:p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                    <Moon className="w-5 h-5 md:w-6 md:h-6 text-indigo-400 mb-2" />
                    <span className="text-lg md:text-2xl font-black text-white leading-none mb-1">{dashboardData?.sleepInfo?.duration || '7h 20m'}</span>
                    <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sleep</span>
                  </div>
                  
                  <div className="p-3 md:p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                    <Droplets className="w-5 h-5 md:w-6 md:h-6 text-blue-400 mb-2" />
                    <span className="text-lg md:text-2xl font-black text-white leading-none mb-1">{nutritionData?.waterIntake || dashboardData?.dailyProgress?.waterIntake || 0}/8</span>
                    <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Glasses</span>
                  </div>

                  <div className="p-3 md:p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                    <Footprints className="w-5 h-5 md:w-6 md:h-6 text-emerald-400 mb-2" />
                    <span className="text-lg md:text-2xl font-black text-white leading-none mb-1">{dashboardData?.wearableData?.steps || 0}</span>
                    <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Steps</span>
                  </div>

                  <div className="p-3 md:p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                    <Flame className="w-5 h-5 md:w-6 md:h-6 text-orange-400 mb-2" />
                    <span className="text-lg md:text-2xl font-black text-white leading-none mb-1">{dashboardData?.wearableData?.caloriesBurned || 0}</span>
                    <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Burned (Kcal)</span>
                  </div>
                </div>

                <div className="p-4 md:p-5 bg-white text-slate-900 rounded-[1.5rem] shadow-lg flex items-center justify-between">
                  <div>
                    <p className="text-[9px] md:text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">Calories Consumed</p>
                    <p className="text-xl md:text-2xl font-black leading-none">{nutritionData?.totalCalories || dashboardData?.nutritionSummary?.totalCalories || 0} <span className="text-sm font-bold text-slate-400">kcal</span></p>
                  </div>
                  <Zap className="w-6 h-6 md:w-8 md:h-8 text-emerald-500 opacity-20" />
                </div>
              </div>
            </motion.div>

            <div className="p-8 bg-[#EFF6FF] rounded-[2.5rem] border border-blue-100 flex items-center justify-between group cursor-pointer hover:bg-white hover:border-blue-400 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Export Medical DNA</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Generate PDF Card</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-colors" />
            </div>
          </div>
        </div>

        <div className="mt-12 text-center p-8 bg-white/50 border border-slate-100 rounded-[2rem] max-w-4xl mx-auto backdrop-blur-sm">
           <p className="text-[10px] md:text-xs text-slate-400 font-medium leading-relaxed max-w-2xl mx-auto italic">
            Disclaimer: The Health Profile is an AI-generated analysis based on your available data points. It is provided for personal wellness awareness only and should not replace professional medical consultation. Your scores adjust as you upload more reports.
           </p>
        </div>
      </div>
    </div>
  );
}
