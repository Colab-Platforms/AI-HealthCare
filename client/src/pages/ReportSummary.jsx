import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { healthService } from '../services/api';
import { ArrowLeft, Download, Share2, AlertTriangle, CheckCircle, TrendingDown, Apple, Pill, Heart, Activity, X } from 'lucide-react';
import toast from 'react-hot-toast';
import VitalDetailsPopup from '../components/VitalDetailsPopup';
import GenericSkeleton from '../components/skeletons/GenericSkeleton';

export default function ReportSummary() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [showMetricModal, setShowMetricModal] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const { data } = await healthService.getReport(id);
        setReport(data.report);
      } catch (error) {
        toast.error('Failed to load report');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [id]);

  const handleMetricClick = (metricName, metricData) => {
    // Ensure we have all required data
    const metricInfo = {
      name: metricName,
      value: metricData.value,
      unit: metricData.unit || '',
      normalRange: metricData.normalRange || 'N/A',
      status: metricData.status || 'normal',
      description: metricData.description || '',
      recommendations: metricData.recommendations || [],
      foodsToConsume: metricData.foodsToConsume || [],
      foodsToAvoid: metricData.foodsToAvoid || [],
      symptoms: metricData.symptoms || [],
      severity: metricData.severity || ''
    };
    setSelectedMetric(metricInfo);
    setShowMetricModal(true);
  };

  const closeMetricModal = () => {
    setShowMetricModal(false);
    setSelectedMetric(null);
  };

  if (loading) return <GenericSkeleton />;
  if (!report) return <div className="text-center py-12 text-slate-400">Report not found</div>;

  const { aiAnalysis } = report;
  const healthScore = aiAnalysis?.healthScore || 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in p-4">
      <div className="flex items-center justify-between">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <Link to={`/reports/${id}`} className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 font-medium transition-colors">
          Back to Report Details →
        </Link>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl p-8 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            {/* Patient Name */}
            {(report.patientName || aiAnalysis?.patientName) && (
              <div className="mb-3">
                <p className="text-sm text-white/60 uppercase tracking-wide">Patient Name</p>
                <p className="text-xl font-semibold">{report.patientName || aiAnalysis?.patientName}</p>
              </div>
            )}
            <h1 className="text-3xl font-bold mb-2">{report.reportType} Analysis</h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-white/70">
              <p>Analyzed on {new Date(report.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              {(report.reportDate || aiAnalysis?.reportDate) && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <p>Report Date: {new Date(report.reportDate || aiAnalysis?.reportDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </>
              )}
            </div>
          </div>
          <div className="text-center">
            <div className="text-5xl font-bold mb-2">{healthScore}</div>
            <div className="text-sm text-white/70">Health Score</div>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      {aiAnalysis?.summary && (
        <div className="bg-white rounded-2xl border-2 border-blue-200 p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="w-6 h-6 text-cyan-500" /> Report Summary
          </h2>
          <p className="text-slate-700 leading-relaxed text-lg">{aiAnalysis.summary}</p>
        </div>
      )}

      {/* Key Findings */}
      {aiAnalysis?.keyFindings?.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Heart className="w-6 h-6 text-red-500" /> Key Findings
          </h2>
          <div className="space-y-3">
            {aiAnalysis.keyFindings.map((finding, i) => (
              <div key={i} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-1" />
                <p className="text-slate-700 text-base">{finding}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Metrics */}
      {aiAnalysis?.metrics && Object.keys(aiAnalysis.metrics).length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Activity className="w-6 h-6 text-cyan-500" /> All Health Metrics
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(aiAnalysis.metrics).map(([key, metric]) => (
              <button
                key={key}
                onClick={() => handleMetricClick(key, metric)}
                className={`p-5 rounded-xl border-2 text-left transition-all hover:scale-105 hover:shadow-lg cursor-pointer ${
                  metric.status === 'normal'
                    ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300'
                    : metric.status === 'high'
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
                      : metric.status === 'high'
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
      )}

      {/* Deficiencies */}
      {aiAnalysis?.deficiencies?.length > 0 && (
        <div className="bg-white rounded-2xl border-l-4 border-amber-500 border-t-2 border-r-2 border-b-2 border-t-slate-200 border-r-slate-200 border-b-slate-200 p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" /> Detected Deficiencies
          </h2>
          <div className="space-y-4">
            {aiAnalysis.deficiencies.map((def, i) => (
              <div
                key={i}
                className={`p-5 rounded-xl border-2 ${
                  def.severity === 'Severe'
                    ? 'bg-red-50 border-red-200'
                    : def.severity === 'Moderate'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-bold text-slate-800">{def.name}</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      def.severity === 'Severe'
                        ? 'bg-red-100 text-red-700'
                        : def.severity === 'Moderate'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {def.severity}
                  </span>
                </div>
                {def.explanation && <p className="text-slate-700 mb-3">{def.explanation}</p>}
                {def.symptoms?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-slate-700 mb-2">Symptoms:</p>
                    <div className="flex flex-wrap gap-2">
                      {def.symptoms.map((symptom, j) => (
                        <span key={j} className="text-xs bg-white px-2 py-1 rounded border border-slate-300">
                          {symptom}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {def.currentValue && (
                  <p className="text-sm text-slate-600">
                    <strong>Current:</strong> {def.currentValue} | <strong>Normal:</strong> {def.normalRange}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Food Recommendations */}
      {aiAnalysis?.foodRecommendations && Object.keys(aiAnalysis.foodRecommendations).length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Apple className="w-6 h-6 text-emerald-500" /> Recommended Foods
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {Object.entries(aiAnalysis.foodRecommendations).map(([category, rec]) => (
              <div key={category} className="p-6 bg-emerald-50 rounded-xl border-2 border-emerald-200">
                <h3 className="font-bold text-emerald-700 mb-2 text-lg">{category}</h3>
                {rec.explanation && <p className="text-sm text-emerald-600 mb-3">{rec.explanation}</p>}
                {rec.frequency && <p className="text-xs text-emerald-700 font-medium mb-3">Frequency: {rec.frequency}</p>}
                {rec.foods && (
                  <div className="flex flex-wrap gap-2">
                    {rec.foods.map((food, i) => (
                      <span key={i} className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full font-medium">
                        {food}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supplement Recommendations */}
      {aiAnalysis?.supplementRecommendations && Object.keys(aiAnalysis.supplementRecommendations).length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Pill className="w-6 h-6 text-blue-600" /> Recommended Supplements
          </h2>
          <div className="space-y-6">
            {Object.entries(aiAnalysis.supplementRecommendations).map(([category, supplements]) => (
              <div key={category}>
                <h3 className="font-bold text-blue-700 mb-4 text-lg">{category}</h3>
                {Array.isArray(supplements) ? (
                  <div className="space-y-3">
                    {supplements.map((supp, i) => (
                      <div key={i} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-semibold text-slate-800">{supp.name}</p>
                          {supp.frequency && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">{supp.frequency}</span>}
                        </div>
                        {supp.dosage && <p className="text-sm text-slate-700 mb-1"><strong>Dosage:</strong> {supp.dosage}</p>}
                        {supp.timing && <p className="text-sm text-slate-700 mb-1"><strong>Timing:</strong> {supp.timing}</p>}
                        {supp.whyItHelps && <p className="text-sm text-slate-600 mb-1"><strong>Why:</strong> {supp.whyItHelps}</p>}
                        {supp.note && <p className="text-xs text-slate-600 italic">💡 {supp.note}</p>}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {aiAnalysis?.recommendations && Object.keys(aiAnalysis.recommendations).length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Heart className="w-6 h-6 text-red-500" /> Health Recommendations
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Immediate */}
            {aiAnalysis.recommendations.immediate?.length > 0 && (
              <div className="p-6 bg-red-50 rounded-xl border-2 border-red-200">
                <h3 className="font-bold text-red-700 mb-4 text-lg">🚨 Immediate Actions</h3>
                <ul className="space-y-2">
                  {aiAnalysis.recommendations.immediate.map((action, i) => (
                    <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Short-Term */}
            {aiAnalysis.recommendations.shortTerm?.length > 0 && (
              <div className="p-6 bg-amber-50 rounded-xl border-2 border-amber-200">
                <h3 className="font-bold text-amber-700 mb-4 text-lg">⏱️ Short-Term (2-4 weeks)</h3>
                <ul className="space-y-2">
                  {aiAnalysis.recommendations.shortTerm.map((action, i) => (
                    <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 flex-shrink-0" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Long-Term */}
            {aiAnalysis.recommendations.longTerm?.length > 0 && (
              <div className="p-6 bg-emerald-50 rounded-xl border-2 border-emerald-200">
                <h3 className="font-bold text-emerald-700 mb-4 text-lg">📅 Long-Term (Ongoing)</h3>
                <ul className="space-y-2">
                  {aiAnalysis.recommendations.longTerm.map((action, i) => (
                    <li key={i} className="text-sm text-emerald-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Diet */}
            {aiAnalysis.recommendations.diet && (
              <div className="p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
                <h3 className="font-bold text-blue-700 mb-4 text-lg">🍽️ Diet Recommendations</h3>
                <p className="text-sm text-blue-700">{aiAnalysis.recommendations.diet}</p>
              </div>
            )}

            {/* Lifestyle */}
            {aiAnalysis.recommendations.lifestyle?.length > 0 && (
              <div className="p-6 bg-violet-50 rounded-xl border-2 border-violet-200">
                <h3 className="font-bold text-violet-700 mb-4 text-lg">🏃 Lifestyle Changes</h3>
                <ul className="space-y-2">
                  {aiAnalysis.recommendations.lifestyle.map((action, i) => (
                    <li key={i} className="text-sm text-violet-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-violet-500 rounded-full mt-1.5 flex-shrink-0" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Follow-Up Tests */}
            {aiAnalysis.recommendations.followUpTests?.length > 0 && (
              <div className="p-6 bg-cyan-50 rounded-xl border-2 border-cyan-200">
                <h3 className="font-bold text-cyan-700 mb-4 text-lg">🔬 Follow-Up Tests</h3>
                <ul className="space-y-2">
                  {aiAnalysis.recommendations.followUpTests.map((test, i) => (
                    <li key={i} className="text-sm text-cyan-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full mt-1.5 flex-shrink-0" />
                      {test}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
        <p className="text-sm text-blue-700">
          <strong>Disclaimer:</strong> This AI analysis is for informational wellness support only and should not replace professional medical advice. Always consult with a healthcare provider for medical decisions.
        </p>
      </div>

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
