import { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { healthService } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, X, Loader2, CheckCircle, Shield, AlertTriangle,
  ChevronDown, Trash2, Info, Lock, Eye, Calendar, History, BarChart2,
  Activity, Zap, Sparkles, ChevronRight, Check, TrendingUp, TrendingDown, Search, Clock
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { useData } from '../context/DataContext';
import toast from 'react-hot-toast';

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

  const glassCard = "bg-white rounded-[24px] shadow-sm relative overflow-hidden";

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchAllReports();
  }, []);

  const fetchAllReports = async () => {
    try {
      setLoadingReports(true);
      const { data } = await healthService.getReports();
      setAllReports(data || []);

      // Check for processing report
      if (data && data.length > 0) {
        const processing = data.find(r => r.status === 'processing');
        if (processing) {
          setIsProcessing(true);
          setProcessingReportId(processing._id);
          navigate(`/reports/${processing._id}`); // Auto-redirect to the dedicated status screen as requested
        } else {
          setIsProcessing(false);
          setProcessingReportId(null);
        }
      }

      // Auto-select latest 2 for comparison or latest 1 for analysis
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

  // Refresh reports when dataRefreshTrigger changes (from global polling)
  useEffect(() => {
    fetchAllReports();
  }, [dataRefreshTrigger]);

  // Synchronize local processing state with global pending analyses
  useEffect(() => {
    if (pendingAnalysisIds.length > 0) {
      if (!isProcessing) setIsProcessing(true);
      if (!processingReportId) setProcessingReportId(pendingAnalysisIds[0]);
    } else if (isProcessing && !pendingAnalysisIds.some(id => allReports.find(r => r._id === id && r.status === 'processing'))) {
      // Only set to false if No reports are in pending state globally
      setIsProcessing(false);
      setProcessingReportId(null);
      fetchAllReports();
    }
  }, [pendingAnalysisIds, processingReportId, allReports, isProcessing]);

  const handleDeleteReport = async (reportId, e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!window.confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      return;
    }

    try {
      await healthService.deleteReport(reportId);
      setAllReports(prev => prev.filter(r => r._id !== reportId));
      setSelectedReports(prev => prev.filter(id => id !== reportId));
      toast.success('Report deleted successfully');
    } catch (error) {
      toast.error('Failed to delete report');
    }
  };

  // Register initial processing reports in global poll
  useEffect(() => {
    if (allReports.length > 0) {
      const processing = allReports.find(r => r.status === 'processing');
      if (processing && !pendingAnalysisIds.includes(processing._id)) {
        addPendingAnalysis(processing._id);
      }
    }
  }, [allReports, pendingAnalysisIds, addPendingAnalysis]);

  // Build comparison data when selectedReports change
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

    // Build rich AI comparison insight
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

    // Health scores
    const recentScore = recentReport.aiAnalysis?.healthScore;
    const pastScore = pastReport.aiAnalysis?.healthScore;

    // Deficiency analysis
    const recentDefs = (recentReport.aiAnalysis?.deficiencies || []).map(d => d.name).filter(Boolean);
    const pastDefs = (pastReport.aiAnalysis?.deficiencies || []).map(d => d.name).filter(Boolean);
    const resolvedDefs = pastDefs.filter(d => !recentDefs.includes(d));
    const newDefs = recentDefs.filter(d => !pastDefs.includes(d));

    setAiComparison({ improvements, needsAttention, recentScore, pastScore, resolvedDefs, newDefs });
  };

  const filteredComparisonData = selectedMetric === 'All'
    ? comparisonData
    : comparisonData.filter(d => d.metric === selectedMetric);

  const onDrop = useCallback((acceptedFiles) => {
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

  const updateFileType = (id, reportType) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, reportType } : f));
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    const fileToUpload = files[0];

    if (fileToUpload.file.type === 'application/pdf' && fileToUpload.file.size > 4 * 1024 * 1024) {
      toast.error('PDF file is too large (Max 4MB). Please compress it.');
      return;
    }

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

      if (finalFile.type.startsWith('image/') && finalFile.size > 1 * 1024 * 1024) {
        const compressImage = (file, quality = 0.8) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
              const img = new Image();
              img.src = event.target.result;
              img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width, height = img.height;
                const MAX_DIM = 1600;
                if (width > height) { if (width > MAX_DIM) { height *= MAX_DIM / width; width = MAX_DIM; } }
                else { if (height > MAX_DIM) { width *= MAX_DIM / height; height = MAX_DIM; } }
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                  resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                }, 'image/jpeg', quality);
              };
            };
          });
        };

        toast.loading('Optimizing image...', { id: 'compressing' });
        finalFile = await compressImage(finalFile, 0.6);
        if (finalFile.size > 3.5 * 1024 * 1024) {
          finalFile = await compressImage(fileToUpload.file, 0.4);
        }
        toast.dismiss('compressing');
      }

      const formData = new FormData();
      formData.append('report', finalFile);
      formData.append('reportType', fileToUpload.reportType);

      const { data } = await healthService.uploadReport(formData);
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (data.backgroundProcessing) {
        addPendingAnalysis(data.report._id);
        toast.success('Report uploaded! Analysis in progress...');
      } else {
        toast.success('Report analyzed successfully!');
      }

      invalidateCache(['diet_plan', 'dashboard']);
      setTimeout(() => navigate(`/reports/${data.report._id}`), 500);
    } catch (error) {
      clearInterval(progressInterval);
      const errorMsg = error.response?.status === 413
        ? 'File too large (Max 4MB).'
        : (error.response?.data?.message || 'Failed to analyze report');
      toast.error(errorMsg);
      setUploadProgress(0);
    } finally {
      setLoading(false);
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

  const viewingReport = allReports.find(r => r._id === viewingReportId);

  return (
    <div className="px-4 md:px-8 pt-0 md:pt-4 max-w-[1400px] mx-auto space-y-6 relative font-sans bg-transparent">
      <div className="pt-2" />
      
      {/* Active Analysis Banner or Full Page Processing UI */}
      {isProcessing ? null : allReports.find(r => r.status === 'processing') && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-amber-50 border border-amber-100 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
              <Clock className="w-6 h-6 text-amber-500 animate-spin" />
            </div>
            <div>
              <h4 className="text-amber-900 font-bold">Analysis in Progress</h4>
              <p className="text-amber-700 text-sm">We are still analyzing your recently uploaded report. It will be ready in a moment.</p>
            </div>
          </div>
          <button 
            onClick={() => navigate(`/reports/${allReports.find(r => r.status === 'processing')._id}`)}
            className="w-full md:w-auto px-6 py-2.5 bg-amber-500 text-white font-bold rounded-xl shadow-lg border-b-4 border-amber-700 active:border-b-0 active:translate-y-1 transition-all"
          >
            Check Status
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Upload & Comparison */}
        <div className="lg:col-span-2 flex flex-col gap-8">

          {/* Upload Card or Processing UI */}
          <AnimatePresence mode="wait">
            {loadingReports ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`${glassCard} p-10 flex items-center justify-center min-h-[300px]`}
              >
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-10 h-10 text-[#A795C7] animate-spin" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading context...</p>
                </div>
              </motion.div>
            ) : isProcessing ? (
              <motion.div
                key="processing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`${glassCard} p-8 md:p-12 text-center overflow-hidden relative shadow-2xl border-2 border-amber-100`}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50/50 rounded-full blur-3xl -mr-16 -mt-16" />
                
                <div className="relative z-10 flex flex-col items-center">
                  <div className="relative mb-8">
                    <div className="w-20 h-20 md:w-28 md:h-28 rounded-3xl bg-amber-50 flex items-center justify-center ring-8 ring-amber-50/10">
                      <Clock className="w-10 h-10 md:w-12 md:h-12 text-amber-500 animate-spin" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 md:w-10 md:h-10 bg-white rounded-2xl shadow-md border border-amber-100 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-amber-500 animate-pulse" />
                    </div>
                  </div>

                  <h3 className="text-2xl md:text-3xl font-black text-[#1a1a1a] mb-3">Analysis in Process</h3>
                  <p className="text-[#92400e] text-sm md:text-base font-semibold leading-relaxed mb-8 max-w-sm">
                    We are extracting medical insights from your report. This usually takes 1-2 minutes.
                  </p>

                  <div className="w-full max-w-md bg-amber-50 border border-amber-100 rounded-3xl p-5 mb-8">
                    <div className="w-full bg-white h-2.5 rounded-full overflow-hidden mb-3 border border-amber-100/50 shadow-inner">
                      <motion.div 
                        initial={{ width: "0%" }}
                        animate={{ width: "85%" }}
                        transition={{ duration: 60, ease: "linear" }}
                        className="bg-gradient-to-r from-amber-400 to-amber-600 h-full"
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-[#92400e]">
                      <span>Deep Analysis</span>
                      <span>85% (Optimistic)</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                    <Link 
                      to="/dashboard"
                      className="flex-1 py-4 bg-white border-2 border-amber-200 text-[#92400e] font-black rounded-2xl hover:bg-amber-50 transition-all uppercase tracking-widest text-xs shadow-sm"
                    >
                      Explore Platform
                    </Link>
                    <Link 
                      to={`/reports/${processingReportId}`}
                      className="flex-1 py-4 bg-amber-500 text-white font-black rounded-2xl hover:bg-amber-600 transition-all uppercase tracking-widest text-xs shadow-lg shadow-amber-200"
                    >
                      Check Details
                    </Link>
                  </div>
                </div>
              </motion.div>
            ) : !loading ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`${glassCard} p-6 md:p-10 min-h-[200px] md:min-h-[280px] flex flex-col`}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#F5F5F7]/50 pointer-events-none" />

                {files.length === 0 ? (
                  <div
                    {...getRootProps()}
                    className={`relative z-10 group flex-1 border-2 md:border-4 border-dashed rounded-3xl md:rounded-[2rem] p-6 md:p-10 text-center cursor-pointer transition-all duration-500 flex flex-col items-center justify-center ${isDragActive
                      ? 'border-[#A795C7] bg-[#F8F6FA] scale-[1.01]'
                      : 'border-slate-100 hover:border-[#A795C7]/50 bg-slate-50/50'
                      }`}
                  >
                    <input {...getInputProps()} />
                    <div className="w-12 h-12 md:w-20 md:h-20 bg-[#F8F6FA] text-[#A795C7] border border-slate-100/50 rounded-full flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 transition-transform duration-300">
                      <Upload className="w-5 h-5 md:w-8 md:h-8" />
                    </div>
                    <h3 className="font-medium text-lg md:text-2xl text-[#1a1a1a] mb-1 md:mb-3">Upload Lab Report</h3>
                    <p className="text-[#666666] text-xs md:text-sm mb-4 md:mb-6 max-w-md">PDF or image. Max size: 4MB.</p>
                    <button className="px-8 py-3.5 bg-[#A795C7] text-white font-medium rounded-full hover:bg-[#9583B5] transition-all">
                      Select File
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6 relative z-10">
                    <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                      {files.map((file) => (
                        <div key={file.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div className="w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center flex-shrink-0">
                              <FileText className="w-6 h-6 text-[#A795C7]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-slate-800 truncate text-base">{file.name}</p>
                              <p className="text-xs font-bold text-slate-400 uppercase">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                          <div className="w-full sm:w-auto flex items-center gap-2">
                            <div className="relative flex-1 sm:w-48">
                              <select
                                value={file.reportType}
                                onChange={(e) => updateFileType(file.id, e.target.value)}
                                className="w-full appearance-none bg-white text-slate-800 text-sm font-bold pl-4 pr-10 py-3 rounded-xl border border-slate-200 focus:border-[#A795C7] focus:outline-none cursor-pointer"
                              >
                                {reportTypes.map((type) => (
                                  <option key={type.value} value={type.value}>{type.icon} {type.label}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                            <button onClick={() => removeFile(file.id)} className="p-3 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl transition-all flex-shrink-0">
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-4">
                      <button onClick={() => setFiles([])} className="px-6 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all">
                        Cancel
                      </button>
                      <button onClick={handleSubmit} className="flex-1 py-4 bg-[#A795C7] text-white font-bold rounded-2xl hover:bg-[#9583B5] transition-all shadow-lg flex items-center justify-center gap-3 uppercase tracking-widest text-sm">
                        <CheckCircle className="w-5 h-5" /> Analyze Report
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${glassCard} p-10`}
              >
                <div className="space-y-6 md:space-y-10 py-2 md:py-6 relative z-10 bg-white">
                  <div className="flex flex-col items-center text-center space-y-3 md:space-y-4">
                    <div className="relative mb-4">
                      <div className="w-16 h-16 md:w-24 md:h-24 rounded-full border-2 md:border-4 border-slate-100 border-t-[#A795C7] animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <FileText className="w-8 h-8 text-[#A795C7] animate-pulse" />
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <h3 className="text-2xl font-bold text-[#1a1a1a] mb-2">Analyzing Report</h3>
                      <p className="text-[#A795C7] font-black uppercase tracking-widest text-sm mb-4">Hang tight, extracting insights...</p>
                      <p className="text-red-400 font-bold text-[10px] uppercase tracking-widest text-center max-w-sm mx-auto leading-relaxed border border-red-100 bg-red-50 p-3 rounded-2xl">
                        Please do not click the back button or refresh the page
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 mt-8">
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#A795C7] to-[#9583BC] transition-all duration-500" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                      <span>Processing Data</span>
                      <span>{uploadProgress}%</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Comparison Graph */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${glassCard} p-6 lg:p-8 flex flex-col`}
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#F5F5F7] flex items-center justify-center border border-white shadow-sm">
                  <BarChart2 className="w-5 h-5 text-[#1a1a1a]" />
                </div>
                <div>
                  <h3 className="text-xl font-medium text-[#1a1a1a]">Report Comparison</h3>
                  <p className="text-sm text-[#666666]">Select 2 reports from history to compare</p>
                </div>
              </div>
              {comparisonData.length > 0 && (
                <div className="relative">
                  <select
                    value={selectedMetric}
                    onChange={(e) => setSelectedMetric(e.target.value)}
                    className="appearance-none bg-[#F5F5F7] border border-white shadow-sm text-sm font-bold text-[#1a1a1a] px-4 py-2 pr-10 rounded-full cursor-pointer focus:outline-none"
                  >
                    <option value="All">All Metrics</option>
                    {comparisonData.map(d => (
                      <option key={d.metric} value={d.metric}>{d.metric}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              )}
            </div>

            {selectedReports.length === 2 && filteredComparisonData.length > 0 ? (
              <>
                <div className="flex items-center gap-2 mb-4 justify-center">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[#d8cceb]">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#d8cceb]"></div> Past Report
                  </span>
                  <span className="text-[#a0a0a0] mx-2">vs</span>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[#A795C7]">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#A795C7]"></div> Recent Report
                  </span>
                </div>
                <div className="h-[250px] md:h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filteredComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="metric" axisLine={false} tickLine={false} tick={{ fill: '#666666', fontSize: 11, fontWeight: 500 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a0a0a0', fontSize: 12 }} />
                      <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 8px 30px rgba(0,0,0,0.04)', fontWeight: 500 }} />
                      <Line name="Past Report" type="monotone" dataKey="Past Report" stroke="#d8cceb" strokeWidth={3} dot={{ r: 5, fill: '#d8cceb', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} connectNulls />
                      <Line name="Recent Report" type="monotone" dataKey="Recent Report" stroke="#A795C7" strokeWidth={3} dot={{ r: 5, fill: '#A795C7', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* AI Comparison Analysis */}
                {aiComparison && (aiComparison.improvements.length > 0 || aiComparison.needsAttention.length > 0) && (
                  <div className="mt-8 grid md:grid-cols-2 gap-4">
                    {aiComparison.improvements.length > 0 && (
                      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[20px] p-5">
                        <h4 className="font-bold text-[#1a1a1a] flex items-center gap-2 mb-3 text-sm">
                          <CheckCircle className="w-4 h-4 text-[#16A34A]" /> Improved
                        </h4>
                        <ul className="space-y-2">
                          {aiComparison.improvements.map((item, i) => (
                            <li key={i} className="text-xs text-[#666666] flex gap-2">
                              <span className="text-[#16A34A] mt-0.5">↓</span> {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {aiComparison.needsAttention.length > 0 && (
                      <div className="bg-[#FFF8F5] border border-[#FFE8E0] rounded-[20px] p-5">
                        <h4 className="font-bold text-[#1a1a1a] flex items-center gap-2 mb-3 text-sm">
                          <AlertTriangle className="w-4 h-4 text-[#FF8A66]" /> Needs Attention
                        </h4>
                        <ul className="space-y-2">
                          {aiComparison.needsAttention.map((item, i) => (
                            <li key={i} className="text-xs text-[#666666] flex gap-2">
                              <span className="text-[#FF8A66] mt-0.5">↑</span> {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : selectedReports.length === 1 && allReports.find(r => r._id === selectedReports[0])?.aiAnalysis ? (
              <div className="space-y-6">
                {(() => {
                  const report = allReports.find(r => r._id === selectedReports[0]);
                  const analysis = report.aiAnalysis;
                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center">
                              <Sparkles className="w-5 h-5 text-emerald-500" />
                            </div>
                            <h4 className="font-bold text-[#1a1a1a]">Analysis Summary</h4>
                          </div>
                          <p className="text-sm text-[#666666] leading-relaxed line-clamp-6">
                            {analysis.summary || 'Summary not available.'}
                          </p>
                          <div className="pt-4">
                            <Link 
                              to={`/reports/${report._id}`}
                              className="inline-flex items-center gap-2 text-sm font-bold text-[#A795C7] hover:underline"
                            >
                              Explore Full Report <ChevronRight className="w-4 h-4" />
                            </Link>
                          </div>
                        </div>

                        <div className="bg-[#F8F8FC] rounded-[32px] p-6 text-center flex flex-col items-center justify-center border border-slate-100 shadow-inner">
                          <span className="text-[10px] font-black text-[#A795C7] uppercase tracking-widest mb-4">Overall Vitality</span>
                          <div className="relative w-32 h-32 flex items-center justify-center mb-4">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                              <circle cx="50" cy="50" r="45" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                              <circle 
                                cx="50" cy="50" r="45" fill="none" stroke="#A795C7" strokeWidth="8"
                                strokeDasharray={283}
                                strokeDashoffset={283 - (283 * (analysis.healthScore || 0)) / 100}
                                strokeLinecap="round"
                              />
                            </svg>
                            <span className="absolute text-3xl font-black text-[#1a1a1a]">{analysis.healthScore || '--'}</span>
                          </div>
                          <p className="text-[10px] font-bold text-[#a0a0a0]">HEALTH SCORE / 100</p>
                        </div>
                      </div>

                      <div className="pt-8 border-t border-slate-100">
                        <h4 className="text-xs font-black text-[#a0a0a0] uppercase tracking-widest mb-4">Top Biological Markers</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {Object.entries(analysis.metrics || {}).slice(0, 4).map(([name, data]) => (
                            <div key={name} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                              <span className="text-xs font-bold text-slate-700 truncate mr-2">{name.replace(/([A-Z])/g, ' $1').trim()}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-[#1a1a1a]">
                                  {typeof data === 'object' ? data.value : data} 
                                  <span className="text-[9px] text-slate-400 ml-0.5">{typeof data === 'object' ? data.unit : ''}</span>
                                </span>
                                <div className={`w-2 h-2 rounded-full ${
                                  (data.status === 'normal' || data.status === 'good') ? 'bg-emerald-500' : 
                                  (data.status === 'borderline' || data.status === 'moderate') ? 'bg-amber-500' : 'bg-red-500'
                                }`} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-slate-200 rounded-[24px] bg-[#F5F5F7]/30">
                <Activity className="w-8 h-8 text-[#a0a0a0] mb-3" />
                <p className="text-[#666666] font-medium">Select a report from history to view insights,<br />or select 2 reports to view a detailed comparison.</p>
              </div>
            )}
          </motion.div>

          {/* AI Analysis Section */}
          {selectedReports.length === 2 && aiComparison && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-full bg-[#F5F5F7] flex items-center justify-center border border-white shadow-sm">
                  <Sparkles className="w-5 h-5 text-[#A795C7]" />
                </div>
                <h3 className="text-lg font-medium text-[#1a1a1a]">AI Analysis</h3>
              </div>

              <div className="space-y-3">
                {/* Health Score Card */}
                {aiComparison.recentScore != null && (
                  <div className={`${glassCard} p-5 flex items-center gap-4 hover:shadow-md transition-all`}>
                    <div className="w-12 h-12 bg-[#F5F5F7] rounded-full flex items-center justify-center shrink-0">
                      <BarChart2 className="w-5 h-5 text-[#A795C7]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-[#A795C7] uppercase tracking-widest mb-1">Analysis 📊</p>
                      <p className="text-sm text-[#1a1a1a] font-medium leading-relaxed">
                        Your health score {aiComparison.pastScore != null
                          ? (aiComparison.recentScore > aiComparison.pastScore
                            ? `improved from ${aiComparison.pastScore} to ${aiComparison.recentScore}.`
                            : aiComparison.recentScore < aiComparison.pastScore
                              ? `decreased from ${aiComparison.pastScore} to ${aiComparison.recentScore}.`
                              : `remains stable at ${aiComparison.recentScore}.`)
                          : `is ${aiComparison.recentScore}/100.`}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#a0a0a0] shrink-0" />
                  </div>
                )}

                {/* Improvements */}
                {aiComparison.improvements.length > 0 && (
                  <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[24px] p-5 flex items-start gap-4 hover:shadow-md transition-all">
                    <div className="w-12 h-12 bg-[#DCFCE7] rounded-full flex items-center justify-center shrink-0">
                      <TrendingUp className="w-5 h-5 text-[#16A34A]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-[#16A34A] uppercase tracking-widest mb-1">Improvement ✅</p>
                      <p className="text-sm text-[#1a1a1a] font-medium leading-relaxed">
                        {aiComparison.improvements.length} biomarker(s) improved: {aiComparison.improvements.map(item => item.split(' improved')[0]).join(', ')}.
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#a0a0a0] shrink-0 mt-1" />
                  </div>
                )}

                {/* Needs Attention */}
                {aiComparison.needsAttention.length > 0 && (
                  <div className="bg-[#FFF8F5] border border-[#FFE8E0] rounded-[24px] p-5 flex items-start gap-4 hover:shadow-md transition-all">
                    <div className="w-12 h-12 bg-[#FFEDD5] rounded-full flex items-center justify-center shrink-0">
                      <TrendingDown className="w-5 h-5 text-[#FF8A66]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-[#FF8A66] uppercase tracking-widest mb-1">Attention ⚠️</p>
                      <p className="text-sm text-[#1a1a1a] font-medium leading-relaxed">
                        {aiComparison.needsAttention.length} biomarker(s) need attention: {aiComparison.needsAttention.map(item => item.split(' increased')[0]).join(', ')}.
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#a0a0a0] shrink-0 mt-1" />
                  </div>
                )}

                {/* Resolved Deficiencies */}
                {aiComparison.resolvedDefs?.length > 0 && (
                  <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[24px] p-5 flex items-start gap-4 hover:shadow-md transition-all">
                    <div className="w-12 h-12 bg-[#DCFCE7] rounded-full flex items-center justify-center shrink-0">
                      <TrendingUp className="w-5 h-5 text-[#16A34A]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-[#16A34A] uppercase tracking-widest mb-1">Improvement 🎉</p>
                      <p className="text-sm text-[#1a1a1a] font-medium leading-relaxed">
                        Resolved deficiencies: {aiComparison.resolvedDefs.join(', ')}. Great progress!
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#a0a0a0] shrink-0 mt-1" />
                  </div>
                )}

                {/* New Concerns */}
                {aiComparison.newDefs?.length > 0 && (
                  <div className="bg-[#FFF8F5] border border-[#FFE8E0] rounded-[24px] p-5 flex items-start gap-4 hover:shadow-md transition-all">
                    <div className="w-12 h-12 bg-[#FFEDD5] rounded-full flex items-center justify-center shrink-0">
                      <Search className="w-5 h-5 text-[#FF8A66]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-[#FF8A66] uppercase tracking-widest mb-1">Attention 🔍</p>
                      <p className="text-sm text-[#1a1a1a] font-medium leading-relaxed">
                        New concerns detected: {aiComparison.newDefs.join(', ')}. Consider dietary adjustments.
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#a0a0a0] shrink-0 mt-1" />
                  </div>
                )}

                {/* No changes */}
                {aiComparison.improvements.length === 0 && aiComparison.needsAttention.length === 0 && !aiComparison.recentScore && (
                  <div className={`${glassCard} p-5 flex items-center gap-4`}>
                    <div className="w-12 h-12 bg-[#F5F5F7] rounded-full flex items-center justify-center shrink-0">
                      <Activity className="w-5 h-5 text-[#888888]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-[#888888] uppercase tracking-widest mb-1">Analysis</p>
                      <p className="text-sm text-[#666666] font-medium">Both reports have similar metrics. Maintain your current health habits.</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Column: Report History */}
        <div className="lg:col-span-1">
          <div className={`${glassCard} flex flex-col h-full max-h-[850px]`}>
            <div className="p-6 border-b border-slate-100/50 flex items-center gap-3 shrink-0">
              <History className="w-5 h-5 text-[#A795C7]" />
              <h3 className="text-xl font-medium text-[#1a1a1a]">Report History</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: 'none' }}>
              {loadingReports ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[#A795C7]" />
                </div>
              ) : allReports.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-[#888888]">No reports uploaded yet.</p>
                </div>
              ) : (
                allReports.map((report) => {
                  const isSelected = selectedReports.includes(report._id);
                  return (
                    <motion.div
                      key={report._id}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => toggleReportSelection(report._id)}
                      className={`p-4 rounded-[20px] cursor-pointer border transition-all duration-200 ${isSelected
                        ? 'bg-white border-[#A795C7] shadow-sm'
                        : 'bg-[#F8F8FC] border-transparent hover:bg-white hover:border-slate-200 shadow-sm'
                        }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-[#A795C7] text-white' : 'bg-white text-[#666666] shadow-sm'}`}>
                            {isSelected ? <Check className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                          </div>
                          <div>
                            <h4 className={`text-sm font-bold truncate pr-2 ${isSelected ? 'text-[#A795C7]' : 'text-[#1a1a1a]'}`}>
                              {report.reportType || 'Lab Report'}
                            </h4>
                            <p className="text-xs text-[#888888] font-medium">
                              {new Date(report.reportDate || report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      </div>
                        <div className="flex items-center gap-1.5 mt-3 pl-10 h-7 overflow-hidden">
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${report.status === 'completed' ? 'bg-[#F0FDF4] text-[#16A34A]' : 'bg-[#FFF8F5] text-[#FF8A66]'
                            }`}>
                            {report.status || 'Pending'}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/reports/${report._id}`);
                            }}
                            className="text-[8px] font-bold text-[#A795C7] uppercase tracking-widest hover:underline flex items-center pr-2"
                          >
                            View
                          </button>
                          <button
                            onClick={(e) => handleDeleteReport(report._id, e)}
                            className="bg-red-50 text-red-400 p-1.5 rounded-lg hover:bg-red-500 hover:text-white transition-all ml-auto opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                            title="Delete Report"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            <div className="p-6 border-t border-slate-100/50 shrink-0 bg-white">
              <p className="text-xs text-[#666666] text-center mb-4 font-medium">
                Comparing {selectedReports.length} of 2 allowed reports
              </p>
              <Link
                to="/reports"
                className="w-full py-3.5 flex items-center justify-center gap-2 text-sm font-medium rounded-full transition-all bg-[#F5F5F7] text-[#666666] hover:bg-[#A795C7] hover:text-white border border-slate-100"
              >
                <Eye className="w-4 h-4" /> View All Reports
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-[#F8F6FA] rounded-2xl md:rounded-3xl p-4 md:p-6 border border-[#E8E0F5] flex gap-3 md:gap-4">
        <Info className="w-5 h-5 md:w-6 md:h-6 text-[#A795C7] flex-shrink-0" />
        <p className="text-xs md:text-sm text-[#666666] leading-relaxed font-medium">
          Our AI analysis provides deep insights but is for educational purposes only. Always consult with a healthcare professional before making medical decisions.
        </p>
      </div>
    </div>
  );
}
