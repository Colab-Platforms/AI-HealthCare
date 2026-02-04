import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { FileText, Activity, Apple, Heart, AlertTriangle, ArrowLeft, Sparkles, Droplets, ChevronDown, ChevronUp, Dumbbell } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReportDetailsEnhanced() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedMetrics, setExpandedMetrics] = useState({});

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        setReport(null);
        setExpandedMetrics({});
        const { data } = await api.get(`/health/reports/${id}`);
        setReport(data.report);
      } catch (error) {
        toast.error('Failed to load report');
        console.error('Error fetching report:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
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

  // Debug log
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
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl p-6 text-white relative overflow-hidden">
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
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-500" /> Report Content
            </h2>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 max-h-96 overflow-y-auto">
              <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">{report.extractedText}</p>
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

  console.log('✅ Rendering main report with AI analysis');
  
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Back Button */}
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 font-medium transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      {/* Header Card */}
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl p-6 text-white relative overflow-hidden">
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
                Analyzed on {new Date(report.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="text-center p-4 bg-white/10 backdrop-blur-sm rounded-xl">
            <p className="text-4xl font-bold">{healthScore}</p>
            <p className="text-sm text-white/70">Health Score</p>
          </div>
        </div>
      </div>

      {/* Summary - 5-6 lines */}
      {aiAnalysis?.summary && (
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl border-2 border-blue-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-500" /> Report Summary
          </h2>
          <p className="text-slate-700 leading-relaxed text-base">{aiAnalysis.summary}</p>
        </div>
      )}

      {/* Key Findings & Risk Factors */}
      <div className="grid md:grid-cols-2 gap-6">
        {aiAnalysis?.keyFindings?.length > 0 && (
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-blue-500" /> Key Findings
            </h2>
            <ul className="space-y-2">
              {aiAnalysis.keyFindings.map((finding, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                  {finding}
                </li>
              ))}
            </ul>
          </div>
        )}
        {aiAnalysis?.riskFactors?.length > 0 && (
          <div className="bg-white rounded-2xl border-l-4 border-amber-500 border-t-2 border-r-2 border-b-2 border-t-slate-200 border-r-slate-200 border-b-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Risk Factors
            </h2>
            <ul className="space-y-2">
              {aiAnalysis.riskFactors.map((risk, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="w-2 h-2 bg-amber-500 rounded-full mt-2 flex-shrink-0" />
                  {risk}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Health Metrics - Expandable Cards */}
      {aiAnalysis?.metrics && Object.keys(aiAnalysis.metrics).length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-500" /> Health Metrics
          </h2>
          <div className="space-y-3">
            {Object.entries(aiAnalysis.metrics).map(([key, metric]) => (
              <div
                key={key}
                className={`rounded-xl border-2 overflow-hidden transition-all ${
                  metric.status === 'normal'
                    ? 'bg-emerald-50 border-emerald-200'
                    : metric.status === 'borderline'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <button
                  onClick={() => toggleMetricExpand(key)}
                  className="w-full p-4 flex items-center justify-between hover:opacity-80 transition-opacity"
                >
                  <div className="flex items-center gap-4 flex-1 text-left">
                    <div>
                      <p className="text-sm text-slate-600 capitalize font-medium">
                        {key.replace(/([A-Z])/g, ' $1')}
                      </p>
                      <p className="text-2xl font-bold text-slate-800 mt-1">
                        {metric.value} <span className="text-sm font-normal text-slate-500">{metric.unit}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        metric.status === 'normal'
                          ? 'bg-emerald-100 text-emerald-700'
                          : metric.status === 'borderline'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {metric.status.toUpperCase()}
                    </span>
                    {expandedMetrics[key] ? (
                      <ChevronUp className="w-5 h-5 text-slate-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-600" />
                    )}
                  </div>
                </button>

                {/* Expanded Details */}
                {expandedMetrics[key] && (
                  <div className="border-t-2 border-inherit p-4 space-y-4 bg-white/50">
                    <div>
                      <p className="text-sm font-semibold text-slate-700 mb-1">Normal Range</p>
                      <p className="text-slate-600">{metric.normalRange}</p>
                    </div>
                    {metric.description && (
                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-1">What is it?</p>
                        <p className="text-slate-600 text-sm">{metric.description}</p>
                      </div>
                    )}
                    {metric.whyAbnormal && (
                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-1">Why is it abnormal?</p>
                        <p className="text-slate-600 text-sm">{metric.whyAbnormal}</p>
                      </div>
                    )}
                    {metric.consequences && (
                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-1">Potential Consequences</p>
                        <p className="text-slate-600 text-sm">{metric.consequences}</p>
                      </div>
                    )}
                    {metric.recommendations && (
                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-2">How to Fix</p>
                        <ul className="space-y-1">
                          {Array.isArray(metric.recommendations) ? (
                            metric.recommendations.map((rec, i) => (
                              <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-1.5 flex-shrink-0" />
                                {rec}
                              </li>
                            ))
                          ) : (
                            <li className="text-sm text-slate-600">{metric.recommendations}</li>
                          )}
                        </ul>
                      </div>
                    )}
                    {metric.foodsToConsume && (
                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-2">Foods to Consume</p>
                        <div className="flex flex-wrap gap-2">
                          {Array.isArray(metric.foodsToConsume) ? (
                            metric.foodsToConsume.map((food, i) => (
                              <span key={i} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                                {food}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-slate-600">{metric.foodsToConsume}</span>
                          )}
                        </div>
                      </div>
                    )}
                    {metric.supplements && (
                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-2">Supplements</p>
                        <div className="flex flex-wrap gap-2">
                          {Array.isArray(metric.supplements) ? (
                            metric.supplements.map((supp, i) => (
                              <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                {supp}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-slate-600">{metric.supplements}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deficiencies */}
      {aiAnalysis?.deficiencies?.length > 0 && (
        <div className="bg-white rounded-2xl border-l-4 border-amber-500 border-t-2 border-r-2 border-b-2 border-t-slate-200 border-r-slate-200 border-b-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Droplets className="w-5 h-5 text-amber-500" /> Detected Deficiencies
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {aiAnalysis.deficiencies.map((def, i) => (
              <div
                key={i}
                className={`p-4 rounded-xl border-2 ${
                  def.severity === 'severe'
                    ? 'bg-red-50 border-red-200'
                    : def.severity === 'moderate'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800">{def.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      def.severity === 'severe'
                        ? 'bg-red-100 text-red-700'
                        : def.severity === 'moderate'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {def.severity}
                  </span>
                </div>
                <p className="text-sm text-slate-700 font-medium">Current: {def.currentValue}</p>
                <p className="text-sm text-slate-600">Normal: {def.normalRange}</p>
                {def.symptoms?.length > 0 && (
                  <p className="text-xs text-slate-600 mt-2">Symptoms: {def.symptoms.join(', ')}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diet Plan */}
      {aiAnalysis?.dietPlan && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Apple className="w-5 h-5 text-emerald-500" /> Personalized Diet Plan
          </h2>
          {aiAnalysis.dietPlan.overview && (
            <p className="text-slate-700 mb-6 text-sm">{aiAnalysis.dietPlan.overview}</p>
          )}

          {/* Meal Plan */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { key: 'breakfast', label: 'Breakfast', icon: '🌅', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
              { key: 'lunch', label: 'Lunch', icon: '☀️', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
              { key: 'dinner', label: 'Dinner', icon: '🌙', bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' },
              { key: 'snacks', label: 'Snacks', icon: '🍎', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' }
            ].map(({ key, label, icon, bg, border, text }) =>
              aiAnalysis.dietPlan[key]?.length > 0 && (
                <div key={key} className={`p-4 rounded-xl ${bg} border-2 ${border}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">{icon}</span>
                    <span className={`font-bold ${text}`}>{label}</span>
                  </div>
                  {aiAnalysis.dietPlan[key].map((meal, i) => (
                    <div key={i} className="mb-2">
                      <p className={`text-sm ${text} font-medium`}>{meal.meal || meal}</p>
                      {meal.tip && <p className="text-xs text-slate-600 italic">{meal.tip}</p>}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Foods to Increase/Limit */}
          {(aiAnalysis.dietPlan.foodsToIncrease?.length > 0 || aiAnalysis.dietPlan.foodsToLimit?.length > 0) && (
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              {aiAnalysis.dietPlan.foodsToIncrease?.length > 0 && (
                <div className="p-4 bg-emerald-50 rounded-xl border-2 border-emerald-200">
                  <h3 className="font-bold text-emerald-700 mb-3">✅ Foods to Increase</h3>
                  <div className="flex flex-wrap gap-2">
                    {aiAnalysis.dietPlan.foodsToIncrease.map((food, i) => (
                      <span key={i} className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">
                        {food}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {aiAnalysis.dietPlan.foodsToLimit?.length > 0 && (
                <div className="p-4 bg-red-50 rounded-xl border-2 border-red-200">
                  <h3 className="font-bold text-red-700 mb-3">⚠️ Foods to Limit</h3>
                  <div className="flex flex-wrap gap-2">
                    {aiAnalysis.dietPlan.foodsToLimit.map((food, i) => (
                      <span key={i} className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full font-medium">
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
            <div className="p-4 bg-slate-50 border-2 border-slate-200 rounded-xl">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" /> Diet Tips
              </h3>
              <ul className="space-y-2">
                {aiAnalysis.dietPlan.tips.map((tip, i) => (
                  <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full mt-2" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Fitness Plan */}
      {aiAnalysis?.fitnessPlan && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-blue-600" /> Fitness Plan
          </h2>
          {aiAnalysis.fitnessPlan.overview && (
            <p className="text-slate-700 mb-6 text-sm">{aiAnalysis.fitnessPlan.overview}</p>
          )}

          {/* Exercise Recommendations */}
          {aiAnalysis.fitnessPlan.exercises?.length > 0 && (
            <div className="space-y-3">
              {aiAnalysis.fitnessPlan.exercises.map((exercise, i) => (
                <div key={i} className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                  <p className="font-bold text-blue-700 mb-2">{exercise.name}</p>
                  {exercise.duration && <p className="text-sm text-blue-600">Duration: {exercise.duration}</p>}
                  {exercise.frequency && <p className="text-sm text-blue-600">Frequency: {exercise.frequency}</p>}
                  {exercise.description && <p className="text-sm text-slate-700 mt-2">{exercise.description}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Fitness Tips */}
          {aiAnalysis.fitnessPlan.tips?.length > 0 && (
            <div className="p-4 bg-slate-50 border-2 border-slate-200 rounded-xl mt-4">
              <h3 className="font-bold text-slate-800 mb-3">Fitness Tips</h3>
              <ul className="space-y-2">
                {aiAnalysis.fitnessPlan.tips.map((tip, i) => (
                  <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {aiAnalysis?.recommendations && Object.keys(aiAnalysis.recommendations).length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" /> Health Recommendations
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {aiAnalysis.recommendations.immediate && Array.isArray(aiAnalysis.recommendations.immediate) && aiAnalysis.recommendations.immediate.length > 0 && (
              <div className="p-5 bg-red-50 rounded-xl border-2 border-red-200">
                <h3 className="font-bold text-red-700 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Immediate Actions
                </h3>
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

            {aiAnalysis.recommendations.shortTerm && Array.isArray(aiAnalysis.recommendations.shortTerm) && aiAnalysis.recommendations.shortTerm.length > 0 && (
              <div className="p-5 bg-amber-50 rounded-xl border-2 border-amber-200">
                <h3 className="font-bold text-amber-700 mb-3">Short-Term (2-4 weeks)</h3>
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

            {aiAnalysis.recommendations.longTerm && Array.isArray(aiAnalysis.recommendations.longTerm) && aiAnalysis.recommendations.longTerm.length > 0 && (
              <div className="p-5 bg-emerald-50 rounded-xl border-2 border-emerald-200">
                <h3 className="font-bold text-emerald-700 mb-3">Long-Term (Ongoing)</h3>
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
          </div>
        </div>
      )}
    </div>
    );
}
