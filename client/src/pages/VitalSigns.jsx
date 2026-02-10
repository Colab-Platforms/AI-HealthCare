import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { healthService } from '../services/api';
import { Activity, ArrowLeft, Upload, FileText, ChevronDown } from 'lucide-react';
import HealthLoader from '../components/HealthLoader';
import VitalDetailsPopup from '../components/VitalDetailsPopup';

export default function VitalSigns() {
  const [reports, setReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [showMetricModal, setShowMetricModal] = useState(false);

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

      {/* Vital Signs Grid */}
      {hasMetrics ? (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Health Metrics</h2>
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
