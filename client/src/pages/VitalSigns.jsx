import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { healthService } from '../services/api';
import { Activity, ArrowLeft, Upload, FileText, ChevronDown, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import HealthLoader from '../components/HealthLoader';
import VitalDetailsPopup from '../components/VitalDetailsPopup';

export default function VitalSigns() {
  const [reports, setReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [showMetricModal, setShowMetricModal] = useState(false);
  const [selectedVitalForGraph, setSelectedVitalForGraph] = useState(null);

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    if (selectedReportId) {
      const report = reports.find(r => r._id === selectedReportId);
      setSelectedReport(report);
    }
  }, [selectedReportId, reports]);

  const fetchReports = async () => {
    try {
      const { data } = await healthService.getReports();
      setReports(data);
      
      // Auto-select the latest report
      if (data.length > 0) {
        setSelectedReportId(data[0]._id);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMetricClick = (metricName, metricData) => {
    if (!metricData || typeof metricData !== 'object') {
      return;
    }

    const metricInfo = {
      name: metricName || 'Unknown Metric',
      value: metricData.value !== undefined ? metricData.value : 'N/A',
      unit: metricData.unit || '',
      normalRange: metricData.normalRange || 'N/A',
      status: metricData.status || 'normal',
      description: metricData.description || `Details for ${metricName}`,
      recommendations: Array.isArray(metricData.recommendations) ? metricData.recommendations : [],
      foodsToConsume: Array.isArray(metricData.foodsToConsume) ? metricData.foodsToConsume : [],
      foodsToAvoid: Array.isArray(metricData.foodsToAvoid) ? metricData.foodsToAvoid : [],
      symptoms: Array.isArray(metricData.symptoms) ? metricData.symptoms : [],
      severity: metricData.severity || ''
    };
    
    setSelectedMetric(metricInfo);
    setShowMetricModal(true);
  };

  const closeMetricModal = () => {
    setShowMetricModal(false);
    setSelectedMetric(null);
  };

  // Get all unique metrics across all reports
  const getAllMetrics = () => {
    const metricsSet = new Set();
    reports.forEach(report => {
      if (report.aiAnalysis?.metrics) {
        Object.keys(report.aiAnalysis.metrics).forEach(key => metricsSet.add(key));
      }
    });
    return Array.from(metricsSet).sort();
  };

  // Get chart data for selected vital across all reports
  const getVitalChartData = (vitalKey) => {
    if (!vitalKey) return [];
    
    return reports
      .filter(r => r.aiAnalysis?.metrics?.[vitalKey])
      .reverse() // Oldest first
      .map(r => ({
        date: new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }),
        value: r.aiAnalysis.metrics[vitalKey].value,
        unit: r.aiAnalysis.metrics[vitalKey].unit,
        status: r.aiAnalysis.metrics[vitalKey].status,
        normalRange: r.aiAnalysis.metrics[vitalKey].normalRange,
        fullDate: new Date(r.createdAt)
      }));
  };

  // Calculate trend
  const calculateTrend = (chartData) => {
    if (chartData.length < 2) return { direction: 'stable', change: 0, percentChange: 0 };
    
    const latest = chartData[chartData.length - 1].value;
    const previous = chartData[chartData.length - 2].value;
    const change = latest - previous;
    const percentChange = ((change / previous) * 100).toFixed(1);
    
    let direction = 'stable';
    if (change > 0) direction = 'up';
    else if (change < 0) direction = 'down';
    
    return { direction, change: change.toFixed(2), percentChange };
  };

  // Interpret vital trend - is it good or bad?
  const interpretVitalTrend = (vitalName, chartData) => {
    if (chartData.length < 2) {
      return {
        message: 'Not enough data to analyze trend. Upload more reports to track progress.',
        color: 'text-slate-600',
        bgColor: 'bg-slate-50',
        icon: 'info'
      };
    }

    const trend = calculateTrend(chartData);
    const latest = chartData[chartData.length - 1];
    const isNormal = latest.status === 'normal';
    
    // Metrics where LOWER is better
    const lowerIsBetter = [
      'Cholesterol', 'LDL', 'Triglycerides', 'Blood Sugar', 'Glucose', 
      'HbA1c', 'Blood Pressure', 'Systolic', 'Diastolic', 'Weight', 'BMI'
    ];
    
    // Metrics where HIGHER is better
    const higherIsBetter = [
      'HDL', 'Hemoglobin', 'RBC', 'Vitamin D', 'Vitamin B12', 'Iron', 'Calcium'
    ];
    
    const isLowerBetter = lowerIsBetter.some(m => vitalName.toLowerCase().includes(m.toLowerCase()));
    const isHigherBetter = higherIsBetter.some(m => vitalName.toLowerCase().includes(m.toLowerCase()));
    
    // Determine if trend is good or bad
    let isGoodTrend = false;
    let message = '';
    
    if (trend.direction === 'stable') {
      if (isNormal) {
        message = `✅ Your ${vitalName} is stable and within normal range. Great job maintaining your health!`;
        isGoodTrend = true;
      } else {
        message = `⚠️ Your ${vitalName} remains outside normal range. Consider consulting your doctor for guidance.`;
        isGoodTrend = false;
      }
    } else if (trend.direction === 'up') {
      if (isHigherBetter) {
        message = `📈 Your ${vitalName} is increasing (${trend.change} ${latest.unit}). This is a positive trend! Keep up the good work.`;
        isGoodTrend = true;
      } else if (isLowerBetter) {
        message = `⚠️ Your ${vitalName} is rising (${trend.change} ${latest.unit}). Consider lifestyle changes to bring it down.`;
        isGoodTrend = false;
      } else {
        message = `📊 Your ${vitalName} increased by ${trend.change} ${latest.unit}. ${isNormal ? 'Still within normal range.' : 'Monitor this closely.'}`;
        isGoodTrend = isNormal;
      }
    } else { // down
      if (isLowerBetter) {
        message = `📉 Your ${vitalName} is decreasing (${trend.change} ${latest.unit}). Excellent progress! Keep it up.`;
        isGoodTrend = true;
      } else if (isHigherBetter) {
        message = `⚠️ Your ${vitalName} is dropping (${trend.change} ${latest.unit}). You may need to improve this value.`;
        isGoodTrend = false;
      } else {
        message = `📊 Your ${vitalName} decreased by ${Math.abs(trend.change)} ${latest.unit}. ${isNormal ? 'Still within normal range.' : 'Monitor this closely.'}`;
        isGoodTrend = isNormal;
      }
    }
    
    return {
      message,
      color: isGoodTrend ? 'text-green-700' : 'text-amber-700',
      bgColor: isGoodTrend ? 'bg-green-50' : 'bg-amber-50',
      borderColor: isGoodTrend ? 'border-green-200' : 'border-amber-200',
      icon: isGoodTrend ? 'good' : 'warning'
    };
  };

  if (loading) {
    return <HealthLoader message="Loading vital signs..." />;
  }

  // No reports uploaded
  if (reports.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in p-4">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-2xl border-2 border-slate-200 p-12 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Activity className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">No Vital Signs Available</h2>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            Upload your health report to view your vital signs and health metrics extracted from your reports.
          </p>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors"
          >
            <Upload className="w-5 h-5" />
            Upload Report
          </Link>
        </div>
      </div>
    );
  }

  const metrics = selectedReport?.aiAnalysis?.metrics || {};
  const hasMetrics = Object.keys(metrics).length > 0;
  const allMetrics = getAllMetrics();
  const chartData = selectedVitalForGraph ? getVitalChartData(selectedVitalForGraph) : [];
  const trend = chartData.length > 0 ? calculateTrend(chartData) : null;
  const interpretation = selectedVitalForGraph && chartData.length > 0 ? interpretVitalTrend(selectedVitalForGraph, chartData) : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in p-4 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 font-medium transition-colors mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Activity className="w-8 h-8 text-red-500" />
            Vital Signs
          </h1>
          <p className="text-slate-600 mt-2">View your health metrics from reports</p>
        </div>

        {/* Report Selector */}
        {reports.length > 1 && (
          <div className="relative">
            <select
              value={selectedReportId || ''}
              onChange={(e) => setSelectedReportId(e.target.value)}
              className="appearance-none px-4 py-3 pr-10 bg-white border-2 border-slate-200 rounded-xl text-sm font-medium text-slate-800 hover:border-cyan-400 focus:border-cyan-500 focus:outline-none cursor-pointer transition-colors"
            >
              {reports.map(report => (
                <option key={report._id} value={report._id}>
                  {report.reportType} - {new Date(report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Selected Report Info */}
      {selectedReport && (
        <div className="bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-6 h-6" />
            <h2 className="text-xl font-bold">{selectedReport.reportType}</h2>
          </div>
          <p className="text-white/80 text-sm">
            Report Date: {new Date(selectedReport.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          {selectedReport.aiAnalysis?.healthScore && (
            <div className="mt-4 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
              <span className="text-sm">Health Score:</span>
              <span className="text-2xl font-bold">{selectedReport.aiAnalysis.healthScore}</span>
            </div>
          )}
        </div>
      )}

      {/* Vital Progress Graph Section - Only show if multiple reports */}
      {reports.length > 1 && allMetrics.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Vital Progress Tracker</h2>
              <p className="text-slate-600 text-sm">Select a vital to see its progress over time</p>
            </div>
            
            {/* Vital Selector Dropdown */}
            <div className="relative min-w-[200px]">
              <select
                value={selectedVitalForGraph || ''}
                onChange={(e) => setSelectedVitalForGraph(e.target.value)}
                className="appearance-none w-full px-4 py-3 pr-10 bg-gradient-to-r from-cyan-50 to-blue-50 border-2 border-cyan-200 rounded-xl text-sm font-medium text-slate-800 hover:border-cyan-400 focus:border-cyan-500 focus:outline-none cursor-pointer transition-colors"
              >
                <option value="">Select Vital</option>
                {allMetrics.map(metric => (
                  <option key={metric} value={metric}>
                    {metric}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-600 pointer-events-none" />
            </div>
          </div>

          {/* Graph Display */}
          {selectedVitalForGraph && chartData.length > 0 ? (
            <div className="space-y-4">
              {/* Trend Summary */}
              {trend && chartData.length > 1 && (
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Current Value</p>
                    <p className="text-2xl font-bold text-slate-800">
                      {chartData[chartData.length - 1].value} <span className="text-sm font-normal text-slate-500">{chartData[chartData.length - 1].unit}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Normal: {chartData[chartData.length - 1].normalRange}</p>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm text-slate-600 mb-2">Trend</p>
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold ${
                      trend.direction === 'up' 
                        ? 'bg-blue-100 text-blue-700' 
                        : trend.direction === 'down'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {trend.direction === 'up' ? (
                        <>
                          <TrendingUp className="w-5 h-5" />
                          <span>+{trend.change}</span>
                        </>
                      ) : trend.direction === 'down' ? (
                        <>
                          <TrendingDown className="w-5 h-5" />
                          <span>{trend.change}</span>
                        </>
                      ) : (
                        <>
                          <Minus className="w-5 h-5" />
                          <span>Stable</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{Math.abs(trend.percentChange)}% change</p>
                  </div>
                </div>
              )}

              {/* Chart */}
              <div className="h-64 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="vitalGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#94a3b8" 
                      fontSize={12}
                      tickLine={false}
                    />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={12}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '2px solid #06b6d4', 
                        borderRadius: '12px',
                        padding: '12px'
                      }}
                      labelStyle={{ color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}
                      formatter={(value, name, props) => [
                        `${value} ${props.payload.unit}`,
                        selectedVitalForGraph
                      ]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#06b6d4" 
                      strokeWidth={3}
                      fill="url(#vitalGradient)"
                      dot={{ fill: '#06b6d4', strokeWidth: 2, r: 5 }}
                      activeDot={{ r: 7, fill: '#0891b2' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Data Points Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {chartData.slice(-4).reverse().map((point, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 mb-1">{point.date}</p>
                    <p className="text-lg font-bold text-slate-800">{point.value}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold ${
                      point.status === 'normal' 
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {point.status}
                    </span>
                  </div>
                ))}
              </div>

              {/* Interpretation - What does this trend mean? */}
              {interpretation && (
                <div className={`p-4 rounded-xl border-2 ${interpretation.borderColor} ${interpretation.bgColor}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {interpretation.icon === 'good' ? (
                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : interpretation.icon === 'warning' ? (
                        <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
                          <AlertCircle className="w-5 h-5 text-white" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-400 flex items-center justify-center">
                          <Activity className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className={`font-semibold mb-1 ${interpretation.color}`}>
                        Health Insight
                      </h4>
                      <p className={`text-sm ${interpretation.color} leading-relaxed`}>
                        {interpretation.message}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : selectedVitalForGraph ? (
            <div className="text-center py-12 text-slate-400">
              <Activity className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No data available for this vital across your reports</p>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <Activity className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Select a vital from the dropdown to see its progress</p>
            </div>
          )}
        </div>
      )}

      {/* Vital Signs Grid */}
      {hasMetrics ? (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Current Health Metrics</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(metrics).map(([key, metric]) => (
              <button
                key={key}
                onClick={() => handleMetricClick(key, metric)}
                className={`p-5 rounded-xl border-2 text-left transition-all hover:scale-105 hover:shadow-lg cursor-pointer ${
                  metric.status === 'normal'
                    ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300'
                    : metric.status === 'high' || metric.status === 'low'
                    ? 'bg-red-50 border-red-200 hover:border-red-300'
                    : 'bg-amber-50 border-amber-200 hover:border-amber-300'
                }`}
              >
                <p className="text-sm text-slate-600 font-medium mb-2">{key}</p>
                <p className="text-2xl font-bold text-slate-800 mb-2">
                  {metric.value} <span className="text-sm font-normal text-slate-500">{metric.unit}</span>
                </p>
                <p className="text-xs text-slate-600 mb-3">Normal: {metric.normalRange}</p>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    metric.status === 'normal'
                      ? 'bg-emerald-100 text-emerald-700'
                      : metric.status === 'high' || metric.status === 'low'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {metric.status.toUpperCase()}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-12 text-center">
          <Activity className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-800 mb-2">No Metrics Found</h3>
          <p className="text-slate-600 mb-6">
            This report doesn't contain any extracted health metrics. Try uploading a different report.
          </p>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors"
          >
            <Upload className="w-5 h-5" />
            Upload New Report
          </Link>
        </div>
      )}

      {/* Metric Details Modal */}
      {showMetricModal && selectedMetric && (
        <VitalDetailsPopup
          vital={selectedMetric}
          onClose={closeMetricModal}
        />
      )}
    </div>
  );
}
