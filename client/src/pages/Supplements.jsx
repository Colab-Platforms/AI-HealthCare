import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { healthService } from '../services/api';
import { Pill, ArrowLeft, Upload, AlertCircle, CheckCircle, Info, ChevronDown, FileText } from 'lucide-react';
import HealthLoader from '../components/HealthLoader';

export default function Supplements() {
  const [reports, setReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [supplements, setSupplements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    if (selectedReportId) {
      const report = reports.find(r => r._id === selectedReportId);
      setSelectedReport(report);
      extractSupplementsFromReport(report);
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

  const extractSupplementsFromReport = (report) => {
    if (!report) {
      setSupplements([]);
      return;
    }

    const allSupplements = [];
    if (report.aiAnalysis?.supplementRecommendations) {
      Object.entries(report.aiAnalysis.supplementRecommendations).forEach(([category, suppList]) => {
        if (Array.isArray(suppList)) {
          suppList.forEach(supp => {
            allSupplements.push({
              ...supp,
              category,
              reportId: report._id,
              reportType: report.reportType,
              reportDate: report.createdAt
            });
          });
        }
      });
    }
    setSupplements(allSupplements);
  };

  if (loading) {
    return <HealthLoader message="Loading supplement recommendations..." />;
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
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Pill className="w-10 h-10 text-purple-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">No Supplement Recommendations Yet</h2>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            Upload your health report to get personalized supplement recommendations based on your deficiencies and health conditions.
          </p>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-500 text-white rounded-xl font-semibold hover:bg-purple-600 transition-colors"
          >
            <Upload className="w-5 h-5" />
            Upload Report
          </Link>
        </div>
      </div>
    );
  }

  // No supplements found in selected report
  if (supplements.length === 0 && selectedReport) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in p-4">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>

        {/* Report Selector */}
        {reports.length > 1 && (
          <div className="flex justify-end">
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
          </div>
        )}

        <div className="bg-white rounded-2xl border-2 border-slate-200 p-12 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">No Supplements Needed</h2>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            Great news! This report doesn't show any deficiencies that require supplements. Keep maintaining your healthy lifestyle!
          </p>
          {reports.length > 1 ? (
            <p className="text-sm text-slate-500">Try selecting a different report above to view its supplement recommendations.</p>
          ) : (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 text-white rounded-xl font-semibold hover:bg-cyan-600 transition-colors"
            >
              Back to Dashboard
            </Link>
          )}
        </div>
      </div>
    );
  }

  // Group supplements by category
  const groupedSupplements = supplements.reduce((acc, supp) => {
    if (!acc[supp.category]) {
      acc[supp.category] = [];
    }
    acc[supp.category].push(supp);
    return acc;
  }, {});

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in p-4 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 font-medium transition-colors mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Pill className="w-8 h-8 text-purple-500" />
            Supplement Recommendations
          </h1>
          <p className="text-slate-600 mt-2">Based on your selected health report</p>
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
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-6 h-6" />
            <h2 className="text-xl font-bold">{selectedReport.reportType}</h2>
          </div>
          <p className="text-white/80 text-sm">
            Report Date: {new Date(selectedReport.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          {supplements.length > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
              <Pill className="w-5 h-5" />
              <span className="text-sm">{supplements.length} Supplement{supplements.length !== 1 ? 's' : ''} Recommended</span>
            </div>
          )}
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">Important Information</p>
          <p>These recommendations are based on your selected health report. Always consult with a healthcare provider before starting any new supplements.</p>
        </div>
      </div>

      {/* Supplements by Category */}
      {Object.entries(groupedSupplements).map(([category, suppList]) => (
        <div key={category} className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-purple-700 mb-4 flex items-center gap-2">
            <Pill className="w-6 h-6" />
            {category}
          </h2>
          
          <div className="space-y-4">
            {suppList.map((supp, idx) => (
              <div key={idx} className="p-5 bg-purple-50 rounded-xl border-2 border-purple-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-800 mb-1">{supp.name}</h3>
                    <p className="text-xs text-slate-500">
                      From {supp.reportType} • {new Date(supp.reportDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  {supp.frequency && (
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                      {supp.frequency}
                    </span>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-3">
                  {supp.dosage && (
                    <div>
                      <p className="text-xs text-slate-600 font-semibold mb-1">Dosage</p>
                      <p className="text-sm text-slate-800">{supp.dosage}</p>
                    </div>
                  )}
                  {supp.timing && (
                    <div>
                      <p className="text-xs text-slate-600 font-semibold mb-1">Timing</p>
                      <p className="text-sm text-slate-800">{supp.timing}</p>
                    </div>
                  )}
                </div>

                {supp.whyItHelps && (
                  <div className="mb-3">
                    <p className="text-xs text-slate-600 font-semibold mb-1">Why It Helps</p>
                    <p className="text-sm text-slate-700">{supp.whyItHelps}</p>
                  </div>
                )}

                {supp.note && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">{supp.note}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Disclaimer */}
      <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-6">
        <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-slate-600" />
          Disclaimer
        </h3>
        <p className="text-sm text-slate-600">
          These supplement recommendations are generated based on your health reports and are for informational purposes only. 
          They should not replace professional medical advice. Always consult with a qualified healthcare provider before starting 
          any new supplements, especially if you have existing medical conditions or are taking medications.
        </p>
      </div>
    </div>
  );
}
