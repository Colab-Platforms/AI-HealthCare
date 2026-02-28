import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { FileText, Activity, Apple, Heart, AlertTriangle, ArrowLeft, Sparkles, Droplets, ChevronDown, ChevronUp, Dumbbell, TrendingUp, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReportDetailsEnhanced() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [allReports, setAllReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedMetrics, setExpandedMetrics] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setReport(null);
        setExpandedMetrics({});
        
        // Fetch current report
        const { data } = await api.get(`/health/reports/${id}`);
        setReport(data.report);
        
        // Fetch all reports for comparison
        const reportsResponse = await api.get('/health/reports');
        setAllReports(reportsResponse.data || []);
      } catch (error) {
        toast.error('Failed to load report');
        console.error('Error fetching report:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading report...</p>
          <p className="text-slate-500 text-sm mt-2">Report ID: {id}</p>
        </div>
      </div>
    );
  }

  if (!report) {
    console.error('❌ Report is null after loading');
    return (
      <div className="text-center py-12 text-slate-400">
        <p>Report not found</p>
        <p className="text-sm text-slate-500 mt-2">Report ID: {id}</p>
        <Link to="/dashboard" className="text-cyan-500 hover:text-cyan-400 mt-4 inline-block">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const aiAnalysis = report?.aiAnalysis;
  const healthScore = aiAnalysis?.healthScore || 0;

  // Get reports with health scores for comparison
  const reportsWithScores = allReports
    .filter(r => r.aiAnalysis?.healthScore)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  // Calculate health trend
  const getHealthTrend = () => {
    if (reportsWithScores.length < 2) return null;
    
    const currentIndex = reportsWithScores.findIndex(r => r._id === id);
    if (currentIndex <= 0) return null;
    
    const currentScore = reportsWithScores[currentIndex].aiAnalysis.healthScore;
    const previousScore = reportsWithScores[currentIndex - 1].aiAnalysis.healthScore;
    const difference = currentScore - previousScore;
    
    return {
      difference,
      percentage: ((difference / previousScore) * 100).toFixed(1),
      isImproving: difference > 0,
      previousScore,
      currentScore
    };
  };

  const healthTrend = getHealthTrend();

  const toggleMetricExpand = (key) => {
    setExpandedMetrics(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Check if aiAnalysis exists
  if (!aiAnalysis) {
    // Show fallback for old reports with extracted text
    if (report?.extractedText) {
      return (
        <div className="max-w-5xl mx-auto space-y-6 pb-12">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>

          {/* Header Card */}
          <div className="bg-gradient-to-r from-purple-600 to-orange-600 rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>
            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <FileText className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{report.reportType} Report</h1>
                  <p className="text-white/70">
                    Uploaded on {new Date(report.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Extracted Text */}
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-600" /> Report Content
            </h2>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 max-h-96 overflow-y-auto">
              <p className="text-slate-800 whitespace-pre-wrap text-sm leading-relaxed font-medium">{report.extractedText}</p>
            </div>
          </div>

          <div className="bg-blue-50 rounded-2xl border-2 border-blue-200 p-6">
            <p className="text-blue-800">
              <strong>Note:</strong> This is an older report that was uploaded before AI analysis was available.
              The extracted text from the report is shown above. For AI-powered analysis, please upload a new report.
            </p>
          </div>
        </div>
      );
    }

    // No data at all
    return (
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <div className="text-center py-12 bg-white rounded-2xl border-2 border-slate-200 p-8">
          <p className="text-slate-600 mb-4">Report data is not available</p>
          <Link to="/dashboard" className="text-cyan-500 hover:text-cyan-400 font-medium">
            Go back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 px-4 pt-10">
      {/* Back Button */}
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-500 hover:text-purple-600 font-black text-[10px] uppercase tracking-widest transition-all group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
      </Link>

      {/* Header Card */}
      <div className="card card-gradient p-8 text-slate-900 relative overflow-hidden ring-1 ring-white/50 border-none">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        </div>
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8 z-10">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">{report.reportType} Report</h1>
              <div className="flex items-center gap-2 px-3 py-1 bg-white/40 backdrop-blur-md rounded-full border border-white/50 shadow-sm">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">Analyzed</span>
              </div>
            </div>

            <p className="text-slate-700/80 text-sm md:text-base font-bold mb-6 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Lab Report • {new Date(report.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>

            {/* Patient Details Row */}
            <div className="flex flex-wrap gap-6 p-4 bg-white/30 backdrop-blur-sm rounded-2xl border border-white/40 shadow-inner">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-black mb-1">Patient</span>
                <span className="text-sm font-black text-slate-800">{report.patientName || 'Anonymous'}</span>
              </div>
              <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-black mb-1">Age</span>
                <span className="text-sm font-black text-slate-800">{report.patientAge ? `${report.patientAge} Years` : 'N/A'}</span>
              </div>
              <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-black mb-1">Gender</span>
                <span className="text-sm font-black text-slate-800 capitalize">{report.patientGender || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-6 bg-white/40 backdrop-blur-md rounded-[2rem] border border-white/60 shadow-2xl min-w-[140px] transform hover:scale-105 transition-transform duration-300">
            {reportsWithScores.length > 1 ? (
              // Show comparison graph when multiple reports exist
              <div className="w-full">
                <div className="relative mb-4">
                  <span className="text-5xl md:text-6xl font-black text-slate-900">{healthScore}</span>
                  {healthTrend && (
                    <div className={`absolute -top-2 -right-2 flex items-center gap-1 px-2 py-1 rounded-full ${
                      healthTrend.isImproving ? 'bg-emerald-500' : 'bg-red-500'
                    } text-white text-xs font-black`}>
                      {healthTrend.isImproving ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {Math.abs(healthTrend.difference)}
                    </div>
                  )}
                </div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-600 font-black mb-4 block">Health Score</span>
                
                {/* Mini comparison graph */}
                <div className="w-full h-24 flex items-end gap-1 justify-center mb-3">
                  {reportsWithScores.slice(-5).map((r, idx) => {
                    const score = r.aiAnalysis.healthScore;
                    const height = (score / 100) * 100;
                    const isCurrentReport = r._id === id;
                    
                    return (
                      <div key={r._id} className="flex flex-col items-center gap-1 flex-1">
                        <div 
                          className={`w-full rounded-t-lg transition-all ${
                            isCurrentReport 
                              ? 'bg-gradient-to-t from-purple-600 to-orange-600 shadow-lg' 
                              : 'bg-slate-300'
                          }`}
                          style={{ height: `${height}%` }}
                        />
                        <span className="text-[8px] font-black text-slate-400">
                          {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
                
                {healthTrend && (
                  <div className={`text-center p-2 rounded-xl ${
                    healthTrend.isImproving ? 'bg-emerald-50' : 'bg-red-50'
                  }`}>
                    <p className={`text-[9px] font-black uppercase tracking-wider ${
                      healthTrend.isImproving ? 'text-emerald-700' : 'text-red-700'
                    }`}>
                      {healthTrend.isImproving ? '✓ Improving' : '⚠ Declining'}
                    </p>
                    <p className="text-[8px] text-slate-500 font-bold mt-1">
                      {healthTrend.isImproving ? '+' : ''}{healthTrend.difference} from last report
                    </p>
                  </div>
                )}
              </div>
            ) : (
              // Show single score when only one report
              <>
                <div className="relative">
                  <span className="text-5xl md:text-6xl font-black text-slate-900">{healthScore}</span>
                  <div className="absolute -top-2 -right-4 w-4 h-4 bg-emerald-400 rounded-full blur-sm opacity-50"></div>
                </div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-600 font-black mt-2">Health Score</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Summary */}
      {aiAnalysis?.summary && (
        <div className="card p-8 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-purple-500 to-orange-600"></div>
          <h2 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center shadow-inner">
              <Activity className="w-5 h-5 text-purple-600" />
            </div>
            REPORT SUMMARY
          </h2>
          <p className="text-slate-700 leading-relaxed text-base font-bold italic">
            "{aiAnalysis.summary}"
          </p>
        </div>
      )}

      {/* Health Progress Comparison - Show when multiple reports exist */}
      {reportsWithScores.length > 1 && (
        <div className="card p-8 border-none ring-1 ring-purple-100">
          <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center shadow-inner">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            HEALTH PROGRESS TRACKING
          </h2>
          
          {/* Full comparison graph */}
          <div className="bg-gradient-to-br from-slate-50 to-white rounded-3xl p-6 border-2 border-white shadow-inner mb-6">
            <div className="flex items-end justify-between gap-2 h-64">
              {reportsWithScores.map((r, idx) => {
                const score = r.aiAnalysis.healthScore;
                const height = (score / 100) * 100;
                const isCurrentReport = r._id === id;
                const prevScore = idx > 0 ? reportsWithScores[idx - 1].aiAnalysis.healthScore : null;
                const change = prevScore ? score - prevScore : 0;
                
                return (
                  <div key={r._id} className="flex-1 flex flex-col items-center gap-2 group/bar">
                    {/* Score label on hover */}
                    <div className="opacity-0 group-hover/bar:opacity-100 transition-opacity">
                      <div className={`px-3 py-1 rounded-lg text-xs font-black ${
                        isCurrentReport ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {score}
                      </div>
                      {change !== 0 && (
                        <div className={`text-[10px] font-black text-center mt-1 ${
                          change > 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {change > 0 ? '+' : ''}{change}
                        </div>
                      )}
                    </div>
                    
                    {/* Bar */}
                    <div 
                      className={`w-full rounded-t-xl transition-all duration-500 relative ${
                        isCurrentReport 
                          ? 'bg-gradient-to-t from-purple-600 to-orange-600 shadow-xl ring-2 ring-purple-300' 
                          : change > 0
                            ? 'bg-gradient-to-t from-emerald-400 to-emerald-500'
                            : change < 0
                              ? 'bg-gradient-to-t from-red-400 to-red-500'
                              : 'bg-gradient-to-t from-slate-300 to-slate-400'
                      } hover:scale-105 cursor-pointer`}
                      style={{ height: `${height}%` }}
                    >
                      {isCurrentReport && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                          <span className="text-[8px] font-black text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                            CURRENT
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Date label */}
                    <div className="text-center">
                      <p className={`text-[10px] font-black ${
                        isCurrentReport ? 'text-purple-600' : 'text-slate-500'
                      }`}>
                        {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-[8px] text-slate-400 font-bold">
                        {new Date(r.createdAt).getFullYear()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trend Analysis */}
          {healthTrend && (
            <div className={`p-6 rounded-3xl border-2 ${
              healthTrend.isImproving 
                ? 'bg-emerald-50/50 border-emerald-200' 
                : 'bg-red-50/50 border-red-200'
            }`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${
                  healthTrend.isImproving ? 'bg-emerald-100' : 'bg-red-100'
                }`}>
                  {healthTrend.isImproving ? (
                    <TrendingUp className={`w-6 h-6 ${healthTrend.isImproving ? 'text-emerald-600' : 'text-red-600'}`} />
                  ) : (
                    <TrendingDown className={`w-6 h-6 ${healthTrend.isImproving ? 'text-emerald-600' : 'text-red-600'}`} />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className={`text-lg font-black mb-2 ${
                    healthTrend.isImproving ? 'text-emerald-800' : 'text-red-800'
                  }`}>
                    {healthTrend.isImproving ? '🎉 Your Health is Improving!' : '⚠️ Health Score Declined'}
                  </h3>
                  <p className="text-slate-700 text-sm font-bold mb-4">
                    Your health score {healthTrend.isImproving ? 'increased' : 'decreased'} by{' '}
                    <span className={`font-black ${healthTrend.isImproving ? 'text-emerald-600' : 'text-red-600'}`}>
                      {Math.abs(healthTrend.difference)} points ({Math.abs(healthTrend.percentage)}%)
                    </span>{' '}
                    compared to your previous report.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/60 p-4 rounded-2xl border border-white">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Previous Score</p>
                      <p className="text-2xl font-black text-slate-700">{healthTrend.previousScore}</p>
                    </div>
                    <div className="bg-white/60 p-4 rounded-2xl border border-white">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Score</p>
                      <p className="text-2xl font-black text-slate-900">{healthTrend.currentScore}</p>
                    </div>
                  </div>
                  
                  {healthTrend.isImproving ? (
                    <div className="mt-4 p-4 bg-emerald-100/50 rounded-2xl border border-emerald-200">
                      <p className="text-xs font-bold text-emerald-800">
                        <span className="font-black">Great progress!</span> Keep following your personalized diet and fitness plan. 
                        Your consistent efforts are paying off. Continue monitoring your health metrics regularly.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 p-4 bg-red-100/50 rounded-2xl border border-red-200">
                      <p className="text-xs font-bold text-red-800">
                        <span className="font-black">Attention needed:</span> Your health score has declined. 
                        Review the recommendations below carefully and consider consulting with a healthcare professional. 
                        Focus on the immediate action items to get back on track.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Key Findings & Risk Factors */}
      <div className="grid md:grid-cols-2 gap-8">
        {aiAnalysis?.keyFindings?.length > 0 && (
          <div className="card p-8">
            <h2 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Heart className="w-5 h-5 text-blue-600" />
              </div>
              KEY FINDINGS
            </h2>
            <ul className="space-y-4">
              {aiAnalysis.keyFindings.map((finding, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-700 font-bold">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0 animate-pulse" />
                  {finding}
                </li>
              ))}
            </ul>
          </div>
        )}
        {aiAnalysis?.riskFactors?.length > 0 && (
          <div className="card p-8 ring-1 ring-amber-200">
            <h2 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              RISK FACTORS
            </h2>
            <ul className="space-y-4">
              {aiAnalysis.riskFactors.map((risk, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-700 font-bold">
                  <div className="w-2 h-2 bg-amber-500 rounded-full mt-2 flex-shrink-0" />
                  {risk}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Health Metrics - Expandable Cards */}
      {aiAnalysis?.metrics && Object.keys(aiAnalysis.metrics).length > 0 && (
        <div className="card p-8 border-none">
          <h2 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5 text-purple-600" />
            </div>
            HEALTH METRICS
          </h2>
          <div className="grid gap-4">
            {Object.entries(aiAnalysis.metrics).map(([key, metric]) => (
              <div
                key={key}
                className={`rounded-3xl border-2 overflow-hidden transition-all duration-300 ${metric.status === 'normal'
                  ? 'bg-emerald-50/30 border-emerald-100 hover:border-emerald-300'
                  : metric.status === 'borderline'
                    ? 'bg-amber-50/30 border-amber-100 hover:border-amber-300'
                    : 'bg-red-50/30 border-red-100 hover:border-red-300'
                  }`}
              >
                <button
                  onClick={() => toggleMetricExpand(key)}
                  className="w-full p-6 flex items-center justify-between hover:bg-white/40 transition-all"
                >
                  <div className="flex items-center gap-6 flex-1 text-left">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${metric.status === 'normal' ? 'bg-emerald-100 text-emerald-600' : metric.status === 'borderline' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                      <Activity className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">
                        {key.replace(/([A-Z])/g, ' $1')}
                      </p>
                      <p className="text-2xl font-black text-slate-800">
                        {metric.value} <span className="text-xs font-bold text-slate-400 ml-1">{metric.unit}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-black tracking-tighter ${metric.status === 'normal'
                        ? 'bg-emerald-500 text-white shadow-emerald-200'
                        : metric.status === 'borderline'
                          ? 'bg-amber-500 text-white shadow-amber-200'
                          : 'bg-red-500 text-white shadow-red-200'
                        } shadow-lg`}
                    >
                      {metric.status.toUpperCase()}
                    </span>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-white/50 border border-slate-200 transition-transform duration-300 ${expandedMetrics[key] ? 'rotate-180' : ''}`}>
                      <ChevronDown className="w-4 h-4 text-slate-600" />
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {expandedMetrics[key] && (
                  <div className="border-t border-inherit p-6 space-y-6 bg-white/60 backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="p-4 bg-white/40 rounded-2xl border border-white/60">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Normal Range</p>
                        <p className="text-slate-800 font-bold">{metric.normalRange}</p>
                      </div>
                      {metric.description && (
                        <div className="p-4 bg-white/40 rounded-2xl border border-white/60">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">What is it?</p>
                          <p className="text-slate-700 text-sm font-medium leading-relaxed">{metric.description}</p>
                        </div>
                      )}
                    </div>

                    {metric.whyAbnormal && (
                      <div className="p-4 bg-amber-50/40 rounded-2xl border border-amber-100">
                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-3 h-3" /> Analysis
                        </p>
                        <p className="text-slate-700 text-sm font-bold">{metric.whyAbnormal}</p>
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-6">
                      {metric.recommendations && (
                        <div className="p-4 bg-blue-50/40 rounded-2xl border border-blue-100">
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3">Recommendations</p>
                          <ul className="space-y-2">
                            {Array.isArray(metric.recommendations) ? (
                              metric.recommendations.map((rec, i) => (
                                <li key={i} className="text-xs text-slate-700 font-bold flex items-start gap-3">
                                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-1.5 shrink-0" />
                                  {rec}
                                </li>
                              ))
                            ) : (
                              <li className="text-xs text-slate-700 font-bold">{metric.recommendations}</li>
                            )}
                          </ul>
                        </div>
                      )}

                      {metric.foodsToConsume && (
                        <div className="p-4 bg-emerald-50/40 rounded-2xl border border-emerald-100">
                          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">Foods to Increase</p>
                          <div className="flex flex-wrap gap-2">
                            {Array.isArray(metric.foodsToConsume) ? (
                              metric.foodsToConsume.map((food, i) => (
                                <span key={i} className="text-[10px] bg-white/80 text-emerald-700 px-3 py-1.5 rounded-xl font-bold border border-emerald-100 shadow-sm">
                                  {food}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-700 font-bold">{metric.foodsToConsume}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deficiencies */}
      {aiAnalysis?.deficiencies?.length > 0 && (
        <div className="card p-8 ring-1 ring-red-100">
          <h2 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
              <Droplets className="w-5 h-5 text-red-600" />
            </div>
            DETECTED DEFICIENCIES
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {aiAnalysis.deficiencies.map((def, i) => (
              <div
                key={i}
                className={`group p-6 rounded-[2rem] border-2 transition-all duration-300 hover:shadow-xl ${def.severity === 'severe'
                  ? 'bg-red-50/40 border-red-100 hover:border-red-300'
                  : def.severity === 'moderate'
                    ? 'bg-amber-50/40 border-amber-100 hover:border-amber-300'
                    : 'bg-yellow-50/40 border-yellow-100 hover:border-yellow-300'
                  }`}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${def.severity === 'severe' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                      <Droplets className="w-5 h-5" />
                    </div>
                    <span className="font-black text-slate-800 tracking-tight">{def.name}</span>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${def.severity === 'severe'
                      ? 'bg-red-600 text-white shadow-red-200'
                      : 'bg-amber-500 text-white shadow-amber-200'
                      } shadow-lg`}
                  >
                    {def.severity}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-white/60 p-3 rounded-2xl border border-white">
                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Current</p>
                    <p className="text-base font-black text-slate-800">{def.currentValue}</p>
                  </div>
                  <div className="bg-white/60 p-3 rounded-2xl border border-white">
                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Normal</p>
                    <p className="text-base font-black text-slate-500">{def.normalRange}</p>
                  </div>
                </div>

                {def.symptoms?.length > 0 && (
                  <div className="pt-4 border-t border-slate-200">
                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-3">Potential Symptoms</p>
                    <div className="flex flex-wrap gap-2">
                      {def.symptoms.map((symptom, si) => (
                        <span key={si} className="text-[10px] bg-white/80 text-slate-700 px-3 py-1.5 rounded-xl font-bold border border-slate-100 shadow-sm">
                          {symptom}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diet Plan */}
      {aiAnalysis?.dietPlan && (
        <div className="card p-8">
          <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <Apple className="w-5 h-5 text-emerald-600" />
            </div>
            PERSONALIZED DIET PLAN
          </h2>
          {aiAnalysis.dietPlan.overview && (
            <p className="text-slate-700 mb-8 text-sm font-bold leading-relaxed bg-white/40 p-5 rounded-[2rem] border border-white/60 italic shadow-inner">
              "{aiAnalysis.dietPlan.overview}"
            </p>
          )}

          {/* Meal Plan */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[
              { key: 'breakfast', label: 'Breakfast', icon: '🌅', bg: 'bg-emerald-50/50', border: 'border-emerald-100', text: 'text-emerald-700' },
              { key: 'lunch', label: 'Lunch', icon: '☀️', bg: 'bg-blue-50/50', border: 'border-blue-100', text: 'text-blue-700' },
              { key: 'dinner', label: 'Dinner', icon: '🌙', bg: 'bg-purple-50/50', border: 'border-purple-100', text: 'text-purple-700' },
              { key: 'snacks', label: 'Snacks', icon: '🍎', bg: 'bg-amber-50/50', border: 'border-amber-100', text: 'text-amber-700' }
            ].map(({ key, label, icon, bg, border, text }) =>
              aiAnalysis.dietPlan[key]?.length > 0 && (
                <div key={key} className={`p-5 rounded-3xl ${bg} border-2 ${border} shadow-sm group hover:scale-[1.02] transition-transform duration-300`}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl filter drop-shadow-sm">{icon}</span>
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${text}`}>{label}</span>
                  </div>
                  <div className="space-y-3">
                    {aiAnalysis.dietPlan[key].map((meal, i) => (
                      <div key={i} className="bg-white/60 p-3 rounded-2xl border border-white/80">
                        <p className={`text-xs ${text} font-black`}>{meal.meal || meal}</p>
                        {meal.tip && <p className="text-[10px] text-slate-500 italic mt-1 font-medium">{meal.tip}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>

          {/* Foods to Increase/Limit */}
          {(aiAnalysis.dietPlan.foodsToIncrease?.length > 0 || aiAnalysis.dietPlan.foodsToLimit?.length > 0) && (
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {aiAnalysis.dietPlan.foodsToIncrease?.length > 0 && (
                <div className="p-6 bg-emerald-50/40 rounded-3xl border-2 border-emerald-100">
                  <h3 className="text-[10px] font-black tracking-widest text-emerald-700 mb-4 uppercase">✅ Foods to Increase</h3>
                  <div className="flex flex-wrap gap-2">
                    {aiAnalysis.dietPlan.foodsToIncrease.map((food, i) => (
                      <span key={i} className="text-[10px] bg-white text-emerald-700 px-4 py-2 rounded-xl font-black border border-emerald-100 shadow-sm">
                        {food}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {aiAnalysis.dietPlan.foodsToLimit?.length > 0 && (
                <div className="p-6 bg-red-50/40 rounded-3xl border-2 border-red-100">
                  <h3 className="text-[10px] font-black tracking-widest text-red-700 mb-4 uppercase">⚠️ Foods to Limit</h3>
                  <div className="flex flex-wrap gap-2">
                    {aiAnalysis.dietPlan.foodsToLimit.map((food, i) => (
                      <span key={i} className="text-[10px] bg-white text-red-700 px-4 py-2 rounded-xl font-black border border-red-100 shadow-sm">
                        {food}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Diet Tips */}
          {aiAnalysis.dietPlan.tips?.length > 0 && (
            <div className="p-6 bg-slate-50 border-none rounded-3xl shadow-inner">
              <h3 className="text-[10px] font-black text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-widest">
                <Sparkles className="w-4 h-4 text-amber-500" /> Diet Tips
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {aiAnalysis.dietPlan.tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-white/60 rounded-2xl border border-white">
                    <div className="w-6 h-6 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                      <span className="text-amber-600 text-[10px] font-black">{i + 1}</span>
                    </div>
                    <p className="text-[11px] text-slate-700 font-bold leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fitness Plan */}
      {aiAnalysis?.fitnessPlan && (
        <div className="card p-8">
          <h2 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Dumbbell className="w-5 h-5 text-blue-600" />
            </div>
            FITNESS REGIMEN
          </h2>
          {aiAnalysis.fitnessPlan.overview && (
            <p className="text-slate-700 mb-8 text-sm font-bold leading-relaxed bg-blue-50/30 p-5 rounded-[2rem] border border-blue-100 shadow-inner">
              {aiAnalysis.fitnessPlan.overview}
            </p>
          )}

          {/* Exercise Recommendations */}
          {aiAnalysis.fitnessPlan.exercises?.length > 0 && (
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {aiAnalysis.fitnessPlan.exercises.map((exercise, i) => (
                <div key={i} className="p-6 bg-white/60 rounded-3xl border border-blue-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-12 -mt-12 opacity-50 group-hover:scale-110 transition-transform"></div>
                  <p className="text-base font-black text-blue-800 mb-4 relative z-1">{exercise.name}</p>
                  <div className="flex gap-4 mb-4 relative z-1">
                    {exercise.duration && (
                      <div className="bg-blue-50 px-3 py-1 rounded-lg">
                        <span className="text-[10px] text-blue-600 font-black uppercase">{exercise.duration}</span>
                      </div>
                    )}
                    {exercise.frequency && (
                      <div className="bg-indigo-50 px-3 py-1 rounded-lg">
                        <span className="text-[10px] text-indigo-600 font-black uppercase">{exercise.frequency}</span>
                      </div>
                    )}
                  </div>
                  {exercise.description && <p className="text-[11px] text-slate-600 font-bold leading-relaxed relative z-1">{exercise.description}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Fitness Tips */}
          {aiAnalysis.fitnessPlan.tips?.length > 0 && (
            <div className="p-6 bg-slate-50 border-none rounded-3xl shadow-inner">
              <h3 className="text-[10px] font-black text-slate-800 mb-4 uppercase tracking-widest">Fitness Strategy</h3>
              <div className="space-y-3">
                {aiAnalysis.fitnessPlan.tips.map((tip, i) => (
                  <div key={i} className="bg-white/60 p-4 rounded-2xl border border-white flex gap-3 italic">
                    <span className="text-blue-500 font-black">#</span>
                    <p className="text-xs text-slate-700 font-bold">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {aiAnalysis?.recommendations && Object.keys(aiAnalysis.recommendations).length > 0 && (
        <div className="card p-8 ring-1 ring-red-100">
          <h2 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
              <Heart className="w-5 h-5 text-red-500" />
            </div>
            HEALTH RECOMMENDATIONS
          </h2>
          <div className="grid lg:grid-cols-3 gap-6">
            {aiAnalysis.recommendations.immediate && Array.isArray(aiAnalysis.recommendations.immediate) && aiAnalysis.recommendations.immediate.length > 0 && (
              <div className="p-6 bg-red-50/40 rounded-3xl border-2 border-red-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-10">
                  <AlertTriangle className="w-12 h-12 text-red-600" />
                </div>
                <h3 className="text-[10px] font-black text-red-700 mb-5 uppercase tracking-widest flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  Immediate Actions
                </h3>
                <ul className="space-y-4">
                  {aiAnalysis.recommendations.immediate.map((action, i) => (
                    <li key={i} className="text-[11px] text-slate-800 font-black flex items-start gap-3 bg-white/40 p-3 rounded-2xl border border-white">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 shrink-0" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiAnalysis.recommendations.shortTerm && Array.isArray(aiAnalysis.recommendations.shortTerm) && aiAnalysis.recommendations.shortTerm.length > 0 && (
              <div className="p-6 bg-amber-50/40 rounded-3xl border-2 border-amber-100 relative overflow-hidden">
                <h3 className="text-[10px] font-black text-amber-700 mb-5 uppercase tracking-widest">Short-Term (2-4 Weeks)</h3>
                <ul className="space-y-4">
                  {aiAnalysis.recommendations.shortTerm.map((action, i) => (
                    <li key={i} className="text-[11px] text-slate-800 font-black flex items-start gap-3 bg-white/40 p-3 rounded-2xl border border-white">
                      <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 shrink-0" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiAnalysis.recommendations.longTerm && Array.isArray(aiAnalysis.recommendations.longTerm) && aiAnalysis.recommendations.longTerm.length > 0 && (
              <div className="p-6 bg-emerald-50/40 rounded-3xl border-2 border-emerald-100 relative overflow-hidden">
                <h3 className="text-[10px] font-black text-emerald-700 mb-5 uppercase tracking-widest">Long-Term Lifestyle</h3>
                <ul className="space-y-4">
                  {aiAnalysis.recommendations.longTerm.map((action, i) => (
                    <li key={i} className="text-[11px] text-slate-800 font-black flex items-start gap-3 bg-white/40 p-3 rounded-2xl border border-white">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
