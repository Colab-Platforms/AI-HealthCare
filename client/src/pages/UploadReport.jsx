import { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { healthService } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, X, Loader2, CheckCircle, Shield, AlertTriangle,
  ChevronDown, Trash2, Info, Lock, Eye, Calendar, History, BarChart2,
  Activity, Zap, Sparkles, ChevronRight, Check, TrendingUp, TrendingDown, Search
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
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
      // Auto-select latest 2 for comparison
      if (data && data.length >= 2) {
        setSelectedReports([data[0]._id, data[1]._id]);
      }
    } catch (error) {
      console.error('Failed to fetch reports', error);
    } finally {
      setLoadingReports(false);
    }
  };

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
    maxSize: 10 * 1024 * 1024
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

    if (fileToUpload.file.type === 'application/pdf' && fileToUpload.file.size > 4.5 * 1024 * 1024) {
      toast.error('PDF file is too large (Max 4.5MB). Please compress it.');
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
      toast.success('Report analyzed successfully!');
      setTimeout(() => navigate(`/reports/${data.report._id}`), 500);
    } catch (error) {
      clearInterval(progressInterval);
      const errorMsg = error.response?.status === 413
        ? 'File too large (Max 4.5MB).'
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
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-8 relative font-sans">
      <div className="text-left mb-4 md:mb-8 max-w-3xl">
        <h1 className="text-3xl md:text-5xl font-light tracking-tight text-[#1a1a1a] mb-2 md:mb-4">AI Lab Analyzer</h1>
        <p className="text-[#666666] text-sm md:text-lg leading-relaxed">Upload your medical reports and let our AI translate complex jargon into actionable health insights.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Upload & Comparison */}
        <div className="lg:col-span-2 flex flex-col gap-8">

          {/* Upload Card */}
          <AnimatePresence mode="wait">
            {!loading ? (
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
                    <p className="text-[#666666] text-xs md:text-sm mb-4 md:mb-6 max-w-md">PDF or image. Max size: 10MB.</p>
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
                <div className="space-y-6 md:space-y-10 py-2 md:py-6">
                  <div className="flex flex-col items-center text-center space-y-3 md:space-y-4">
                    <div className="relative">
                      <div className="w-16 h-16 md:w-24 md:h-24 rounded-full border-2 md:border-4 border-slate-100 border-t-[#A795C7] animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <FileText className="w-8 h-8 text-[#A795C7] animate-pulse" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-[#1a1a1a]">Analyzing Report</h3>
                      <p className="text-[#666666] font-medium">Extracting health markers and findings...</p>
                    </div>
                  </div>
                  <div className="space-y-3">
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
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-slate-200 rounded-[24px] bg-[#F5F5F7]/30">
                <Activity className="w-8 h-8 text-[#a0a0a0] mb-3" />
                <p className="text-[#666666] font-medium">Select exactly 2 reports from your history<br />to view a detailed visual comparison.</p>
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
                      <div className="flex justify-between items-center mt-3 pl-10">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${report.status === 'completed' ? 'bg-[#F0FDF4] text-[#16A34A]' : 'bg-[#FFF8F5] text-[#FF8A66]'
                          }`}>
                          {report.status || 'Pending'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/reports/${report._id}`);
                          }}
                          className="text-[10px] font-bold text-[#A795C7] uppercase tracking-widest hover:underline flex items-center"
                        >
                          View <ChevronRight className="w-3 h-3" />
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
