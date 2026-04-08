import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { healthService } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, X, Loader2, CheckCircle, Shield, AlertTriangle,
  ChevronDown, Trash2, Info, Lock, Eye, Calendar, History, BarChart2,
  Activity, Zap, Sparkles, ChevronRight, Check, TrendingUp, TrendingDown,
  Search, Clock, ArrowLeft, FileUp, CheckCircle2, AlertCircle, Languages, Share2, Download, User, Coffee, Utensils, UtensilsCrossed, Apple
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { useData } from '../context/DataContext';
import toast from 'react-hot-toast';
import { ImageWithFallback } from '../components/ImageWithFallback';

const reportTypes = [
  { value: 'Blood Test', label: 'Blood Test', icon: '🩸' },
  { value: 'X-Ray', label: 'X-Ray', icon: '🦴' },
  { value: 'MRI', label: 'MRI', icon: '🧠' },
  { value: 'CT Scan', label: 'CT Scan', icon: '💿' },
  { value: 'ECG', label: 'ECG', icon: '❤️' },
  { value: 'Ultrasound', label: 'Ultrasound', icon: '🌊' },
  { value: 'General Checkup', label: 'General Checkup', icon: '📋' },
  { value: 'Other', label: 'Other', icon: '📁' }
];

const dietPlanDefaults = {
  breakfast: [
    { title: "Oats & Berries", desc: "320 kcal • High Fiber", image: "https://images.unsplash.com/photo-1591535102082-a3fe217ef1bd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
    { title: "Spinach Omelette", desc: "280 kcal • Protein Rich", image: "https://images.unsplash.com/photo-1631182661308-c2c81d4e08b4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" }
  ],
  lunch: [
    { title: "Chicken & Rice", desc: "450 kcal • Balanced", image: "https://images.unsplash.com/photo-1762631934518-f75e233413ca?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
    { title: "Fish & Quinoa", desc: "410 kcal • Omega-3", image: "https://images.unsplash.com/photo-1704007573697-6a516da421ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" }
  ]
};

const healthTips = [
  { title: "Daily Exercise", desc: "Aim for 5 days a week of mixed cardio and strength training.", image: "https://images.unsplash.com/photo-1771586791190-97ed536c54af?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
  { title: "Prioritize Sleep", desc: "Get 7-8 hours nightly to reduce inflammation and boost recovery.", image: "https://images.unsplash.com/photo-1631312113214-8f2f03a6962f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
  { title: "Manage Stress", desc: "Practice daily yoga or meditation to keep cortisol levels in check.", image: "https://images.unsplash.com/photo-1621691223255-b89d5623df3a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
  { title: "Stay Hydrated", desc: "Drink at least 8 glasses of water to maintain metabolic balance.", image: "https://images.unsplash.com/photo-1555704574-a9cfdfab06e0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" }
];

export default function UploadReport() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [allReports, setAllReports] = useState([]);
  const [selectedReports, setSelectedReports] = useState([]);
  const [viewingReportId, setViewingReportId] = useState(null);
  const [comparisonData, setComparisonData] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('All');
  const [aiComparison, setAiComparison] = useState(null);
  const [loadingReports, setLoadingReports] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingReportId, setProcessingReportId] = useState(null);
  
  const { invalidateCache, addPendingAnalysis, dataRefreshTrigger, pendingAnalysisIds } = useData();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchAllReports();
  }, []);

  const fetchAllReports = async () => {
    try {
      setLoadingReports(true);
      const { data } = await healthService.getReports();
      setAllReports(data || []);

      if (data && data.length > 0) {
        const processing = data.find(r => r.status === 'processing');
        if (processing) {
          setIsProcessing(true);
          setProcessingReportId(processing._id);
        } else {
          setIsProcessing(false);
          setProcessingReportId(null);
        }
      }

      if (data && data.length >= 2) {
        setSelectedReports([data[0]._id, data[1]._id]);
      } else if (data && data.length === 1) {
        setSelectedReports([data[0]._id]);
      }
    } catch (error) {
      console.error('Failed to fetch reports', error);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    fetchAllReports();
  }, [dataRefreshTrigger]);

  useEffect(() => {
    if (pendingAnalysisIds.length > 0) {
      if (!isProcessing) setIsProcessing(true);
      if (!processingReportId) setProcessingReportId(pendingAnalysisIds[0]);
    } else if (isProcessing && !pendingAnalysisIds.some(id => allReports.find(r => r._id === id && r.status === 'processing'))) {
      setIsProcessing(false);
      setProcessingReportId(null);
      fetchAllReports();
    }
  }, [pendingAnalysisIds, processingReportId, allReports, isProcessing]);

  useEffect(() => {
    if (allReports.length > 0) {
      const processing = allReports.find(r => r.status === 'processing');
      if (processing && !pendingAnalysisIds.includes(processing._id)) {
        addPendingAnalysis(processing._id);
      }
    }
  }, [allReports, pendingAnalysisIds, addPendingAnalysis]);

  useEffect(() => {
    if (selectedReports.length === 2) {
      const report1 = allReports.find(r => r._id === selectedReports[0]);
      const report2 = allReports.find(r => r._id === selectedReports[1]);

      if (report1 && report2) {
        buildComparisonData(report1, report2);
      }
    }
  }, [selectedReports, allReports]);

  const buildComparisonData = (recentReport, pastReport) => {
    const recentMetrics = recentReport.aiAnalysis?.metrics || {};
    const pastMetrics = pastReport.aiAnalysis?.metrics || {};

    const allMetricKeys = [...new Set([...Object.keys(recentMetrics), ...Object.keys(pastMetrics)])];

    const chartData = allMetricKeys.map(key => {
      const recentVal = typeof recentMetrics[key] === 'object' ? parseFloat(recentMetrics[key]?.value) : parseFloat(recentMetrics[key]);
      const pastVal = typeof pastMetrics[key] === 'object' ? parseFloat(pastMetrics[key]?.value) : parseFloat(pastMetrics[key]);
      return {
        metric: key,
        'Recent Report': isNaN(recentVal) ? null : recentVal,
        'Past Report': isNaN(pastVal) ? null : pastVal
      };
    }).filter(d => d['Recent Report'] !== null || d['Past Report'] !== null);

    setComparisonData(chartData);

    const improvements = [];
    const needsAttention = [];
    chartData.forEach(d => {
      if (d['Recent Report'] !== null && d['Past Report'] !== null) {
        const diff = d['Recent Report'] - d['Past Report'];
        if (diff < 0) {
          improvements.push(`${d.metric} improved from ${d['Past Report']} to ${d['Recent Report']}`);
        } else if (diff > 0) {
          needsAttention.push(`${d.metric} increased from ${d['Past Report']} to ${d['Recent Report']}`);
        }
      }
    });

    const recentScore = recentReport.aiAnalysis?.healthScore;
    const pastScore = pastReport.aiAnalysis?.healthScore;
    const recentDefs = (recentReport.aiAnalysis?.deficiencies || []).map(d => d.name).filter(Boolean);
    const pastDefs = (pastReport.aiAnalysis?.deficiencies || []).map(d => d.name).filter(Boolean);
    const resolvedDefs = pastDefs.filter(d => !recentDefs.includes(d));
    const newDefs = recentDefs.filter(d => !pastDefs.includes(d));

    setAiComparison({ improvements, needsAttention, recentScore, pastScore, resolvedDefs, newDefs });
  };

  const onDrop = useCallback((acceptedFiles, fileRejections) => {
    if (fileRejections.length > 0) {
      toast.error('Invalid file selection. Max size 4MB.');
    }

    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      reportType: 'Blood Test',
      name: file.name,
      size: file.size
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg'] },
    maxSize: 4 * 1024 * 1024
  });

  const handleSubmit = async (e) => {
    if (files.length === 0) return;
    const fileToUpload = files[0];
    
    setLoading(true);
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) { clearInterval(progressInterval); return 90; }
        return prev + 5;
      });
    }, 300);

    try {
      let finalFile = fileToUpload.file;
      const formData = new FormData();
      formData.append('report', finalFile);
      formData.append('reportType', fileToUpload.reportType);

      const { data } = await healthService.uploadReport(formData);
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (data.backgroundProcessing) {
        addPendingAnalysis(data.report._id);
        toast.success('Report uploaded! Initiating Clinical AI...');
        setTimeout(() => {
          navigate(`/reports/${data.report._id}`);
        }, 1000);
      } else {
        toast.success('Report analyzed successfully!');
        navigate(`/reports/${data.report._id}`);
      }

      invalidateCache(['diet_plan', 'dashboard', 'reports']);
      setFiles([]);
      fetchAllReports();
    } catch (error) {
      clearInterval(progressInterval);
      toast.error(error.response?.data?.message || 'Failed to analyze report');
      setUploadProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReport = async (reportId, e) => {
    e.preventDefault(); e.stopPropagation();
    if (!window.confirm('Delete this report?')) return;
    try {
      await healthService.deleteReport(reportId);
      setAllReports(prev => prev.filter(r => r._id !== reportId));
      setSelectedReports(prev => prev.filter(id => id !== reportId));
      toast.success('Report deleted');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const toggleReportSelection = (id) => {
    if (selectedReports.includes(id)) {
      setSelectedReports(selectedReports.filter(r => r !== id));
    } else {
      if (selectedReports.length < 2) {
        setSelectedReports([...selectedReports, id]);
      } else {
        setSelectedReports([selectedReports[1], id]);
      }
    }
  };

  const viewingReport = allReports.find(r => r._id === selectedReports[0]);


  return (
    <div className="w-full h-full bg-gradient-to-b from-[#F2F5EC] to-[#E5EBE0] dark:from-[#161719] dark:to-[#161719] relative overflow-y-auto flex flex-col animate-in fade-in duration-500 min-h-screen pb-32">
      <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-br from-white/40 dark:from-white/5 to-transparent pointer-events-none" />
      
      <div className="px-[21.96px] pt-4 flex flex-col gap-8 max-w-5xl mx-auto relative z-10">
        {/* Header Section as per design */}
        <div className="flex flex-col gap-2">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#69A38D]/10 flex items-center justify-center border border-[#69A38D]/20">
                 <Activity size={18} className="text-[#69A38D]" />
              </div>
              <h2 className="font-['Poppins'] font-semibold text-[18px] leading-[22.88px] tracking-[-0.46px] text-[#1a1a1a]">
                Smart Lab Insights
              </h2>
           </div>
           <p className="font-['Poppins'] font-medium text-[13.73px] leading-[22.31px] text-[#64748b] max-w-[330.35px]">
             Upload your medical reports and let our AI translate complex jargon into actionable health insights and visualize your progress over time.
           </p>
        </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 flex flex-col gap-8">
              
              {/* Upload Card */}
              <div 
                {...getRootProps()}
                className={`bg-white/60 backdrop-blur-xl rounded-[29.28px] p-10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border-[0.92px] border-dashed transition-all flex flex-col items-center justify-center w-full max-w-[335.84px] min-h-[301.29px] text-center group mx-auto lg:mx-0 ${
                  isDragActive ? 'border-[#69A38D] bg-white/80' : 'border-[#69A38D]/20 hover:border-[#69A38D]/40'
                }`}
              >
                <input {...getInputProps()} />
                
                {loading ? (
                  <div className="flex flex-col items-center gap-6">
                    <div className="w-20 h-20 rounded-full border-4 border-slate-100 border-t-[#69A38D] animate-spin" />
                    <div className="flex flex-col gap-2">
                      <h3 className="text-xl font-bold text-[#1a2138]">Analyzing Report...</h3>
                      <p className="text-[#69A38D] font-black uppercase tracking-widest text-xs">{uploadProgress}% Complete</p>
                    </div>
                  </div>
                ) : files.length > 0 ? (
                  <div className="w-full flex flex-col gap-6" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between p-6 bg-white/80 rounded-3xl border border-[#69A38D]/10">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-[#E2EED2] flex items-center justify-center text-[#69A38D]">
                          <FileText size={28} />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-[#1a2138]">{files[0].name}</p>
                          <p className="text-xs font-bold text-[#64748b]">{(files[0].size/1024/1024).toFixed(2)} MB • {files[0].reportType}</p>
                        </div>
                      </div>
                      <button onClick={() => setFiles([])} className="p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100"><Trash2 size={20} /></button>
                    </div>
                    <button onClick={handleSubmit} className="w-full py-5 bg-[#69A38D] text-white font-black rounded-3xl shadow-lg hover:bg-[#528270] transition-all flex items-center justify-center gap-3 active:scale-95">
                      <Zap size={20} fill="currentColor" /> ANALYZE NOW
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center mb-6 shadow-sm border border-white group-hover:scale-110 transition-transform duration-500">
                      <FileUp size={40} className="text-[#69A38D]" />
                    </div>
                    <h3 className="text-2xl font-black text-[#1a2138] mb-2 uppercase tracking-tight">Upload Lab Report</h3>
                    <p className="text-[#64748b] font-bold mb-8 max-w-sm">Drag & drop or tap to select PDF or image</p>
                    <button className="bg-[#69A38D] text-white px-10 py-4 rounded-2xl font-black text-sm tracking-widest uppercase shadow-md pointer-events-none">Select File</button>
                  </>
                )}
              </div>

              {/* Comparison Section */}
              <div className="bg-white/60 backdrop-blur-xl rounded-[40px] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-white flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#1a2138]/5 flex items-center justify-center shrink-0">
                      <BarChart2 size={22} className="text-[#1a2138]" />
                    </div>
                    <div>
                      <h3 className="text-[19px] font-black text-[#1a2138] tracking-tight uppercase">Comparative Analytics</h3>
                      <p className="text-[13px] text-[#64748b] font-bold">Trend mapping between two labs</p>
                    </div>
                  </div>
                </div>

                {selectedReports.length === 2 && comparisonData.length > 0 ? (
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-4 justify-center">
                      <span className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-slate-300"></div> Past</span>
                      <span className="text-slate-300 font-bold">vs</span>
                      <span className="flex items-center gap-2 text-xs font-black text-[#69A38D] uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-[#69A38D]"></div> Recent</span>
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={comparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis dataKey="metric" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <Line type="monotone" dataKey="Past Report" stroke="#CBD5E1" strokeWidth={4} dot={{ r: 4, fill: '#CBD5E1' }} />
                          <Line type="monotone" dataKey="Recent Report" stroke="#69A38D" strokeWidth={4} dot={{ r: 4, fill: '#69A38D' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 gap-4 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                    <Activity size={32} className="text-slate-300" />
                    <p className="text-slate-400 font-bold text-center">Select two reports from history <br />to visualize comparative trends</p>
                  </div>
                )}
              </div>
            </div>

            {/* History Column */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="bg-white/60 backdrop-blur-xl rounded-[40px] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-white flex flex-col">
                <div className="flex items-center gap-3 mb-6 px-1">
                  <div className="w-10 h-10 rounded-full bg-[#1a2138]/5 flex items-center justify-center">
                    <History size={18} className="text-[#1a2138]" />
                  </div>
                  <h3 className="text-lg font-black text-[#1a2138] uppercase tracking-tight">Recent Archives</h3>
                </div>

                <div className="flex flex-col gap-3">
                  {loadingReports ? (
                    <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-[#69A38D]" /></div>
                  ) : allReports.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 font-bold">No records found</div>
                  ) : (
                    allReports.map(report => {
                      const isSelected = selectedReports.includes(report._id);
                      return (
                        <div 
                          key={report._id}
                          onClick={() => toggleReportSelection(report._id)}
                          className={`p-4 rounded-[28px] border-2 transition-all cursor-pointer group flex items-center justify-between ${
                            isSelected ? 'bg-white border-[#69A38D] shadow-md' : 'bg-white/40 border-transparent hover:bg-white/80'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isSelected ? 'bg-[#69A38D] text-white' : 'bg-white text-slate-400 shadow-sm'}`}>
                              {isSelected ? <Check size={18} strokeWidth={3} /> : <FileText size={18} />}
                            </div>
                            <div className="min-w-0">
                               <h4 className="text-[14px] font-black text-[#1a2138] truncate uppercase tracking-tight leading-none mb-1">{report.reportType}</h4>
                               <p className="text-[11px] font-bold text-slate-400">{new Date(report.reportDate || report.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <button 
                              onClick={e => { e.stopPropagation(); navigate(`/reports/${report._id}`); }}
                              className="text-[9px] font-black text-[#69A38D] uppercase tracking-widest hover:underline"
                            >
                              Explore
                            </button>
                            <button 
                              onClick={e => handleDeleteReport(report._id, e)}
                              className="p-1.5 bg-red-50 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
