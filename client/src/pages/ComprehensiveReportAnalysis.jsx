import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { healthService } from '../services/api';
import { ArrowLeft, AlertTriangle, CheckCircle, TrendingDown, Apple, Dumbbell, Heart, Activity, Info, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ComprehensiveReportAnalysis() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedMetric, setExpandedMetric] = useState(null);

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

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Analyzing your report...</p>
      </div>
    </div>
  );

  if (!report) return <div className="text-center py-12 text-slate-400">Report not found</div>;

  const { aiAnalysis } = report;
  const healthScore = aiAnalysis?.healthScore || 0;

  const getHealthScoreColor = (score) => {
    if (score >= 80) return 'from-emerald-500 to-green-600';
    if (score >= 60) return 'from-amber-500 to-orange-600';
    return 'from-red-500 to-rose-600';
  };

  const getMetricStatusColor = (status) => {
    if (status === 'normal') return 'bg-emerald-50 border-emerald-200';
    if (status === 'high') return 'bg-red-50 border-red-200';
    return 'bg-amber-50 border-amber-200';
  };

  const getStatusBadgeColor = (status) => {
    if (status === 'normal') return 'bg-emerald-100 text-emerald-700';
    if (status === 'high') return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 pb-12">
      {/* Back Button */}
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 font-medium transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      {/* Header with Health Score */}
      <div className={`bg-gradient-to-r ${getHealthScoreColor(healthScore)} rounded-3xl p-8 text-white shadow-lg`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold mb-2">Health Report Analysis</h1>
            <p className="text-white/80 text-lg">
              {new Date(report.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="text-center">
            <div className="text-6xl font-bold mb-2">{healthScore}</div>
            <div className="text-sm text-white/80 font-medium">Health Score</div>
            <div className="text-xs text-white/70 mt-1">
              {healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : 'Needs Attention'}
            </div>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      {aiAnalysis?.summary && (
        <div className="bg-white rounded-2xl border-2 border-blue-200 p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-500" /> Report Summary
          </h2>
          <p className="text-slate-700 leading-relaxed text-lg whitespace-pre-wrap">{aiAnalysis.summary}</p>
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

      {/* Detailed Metrics */}
      {aiAnalysis?.metrics && Object.keys(aiAnalysis.metrics).length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Activity className="w-6 h-6 text-cyan-500" /> Health Metrics - Detailed Analysis
          </h2>
          <div className="space-y-4">
            {Object.entries(aiAnalysis.metrics).map(([key, metric]) => (
              <div
                key={key}
                className={`border-2 rounded-xl overflow-hidden transition-all ${getMetricStatusColor(metric.status)}`}
              >
                <button
                  onClick={() => setExpandedMetric(expandedMetric === key ? null : key)}
                  className="w-full p-6 flex items-center justify-between hover:bg-black/5 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 text-left">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">{key}</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        Current: <span className="font-bold">{metric.value} {metric.unit}</span> | 
                        Normal: <span className="font-bold">{metric.normalRange}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusBadgeColor(metric.status)}`}>
                      {metric.status.toUpperCase()}
                    </span>
                    {expandedMetric === key ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </button>

                {expandedMetric === key && (
                  <div className="border-t-2 border-current/20 p-6 space-y-4 bg-black/2">
                    {metric.whatIsIt && (
                      <div>
                        <h4 className="font-bold text-slate-800 mb-2">What is {key}?</h4>
                        <p className="text-slate-700">{metric.whatIsIt}</p>
                      </div>
                    )}

                    {metric.whyAbnormal && (
                      <div>
                        <h4 className="font-bold text-slate-800 mb-2">Why is it {metric.status.toUpperCase()}?</h4>
                        <p className="text-slate-700">{metric.whyAbnormal}</p>
                      </div>
                    )}

                    {metric.consequences && (
                      <div>
                        <h4 className="font-bold text-slate-800 mb-2">What happens if not corrected?</h4>
                        <p className="text-slate-700">{metric.consequences}</p>
                      </div>
                    )}

                    {metric.howToFix && (
                      <div>
                        <h4 className="font-bold text-slate-800 mb-2">How to normalize?</h4>
                        <p className="text-slate-700">{metric.howToFix}</p>
                      </div>
                    )}

                    {metric.normalizeTime && (
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-700"><strong>Expected time to normalize:</strong> {metric.normalizeTime}</p>
                      </div>
                    )}

                    {metric.foods?.length > 0 && (
                      <div>
                        <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                          <Apple className="w-4 h-4 text-emerald-500" /> Foods to Consume
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {metric.foods.map((food, i) => (
                            <span key={i} className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium">
                              {food}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {metric.foodsToAvoid?.length > 0 && (
                      <div>
                        <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500" /> Foods to Avoid
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {metric.foodsToAvoid.map((food, i) => (
                            <span key={i} className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
                              {food}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {metric.supplements?.length > 0 && (
                      <div>
                        <h4 className="font-bold text-slate-800 mb-2">Recommended Supplements</h4>
                        <div className="space-y-2">
                          {metric.supplements.map((supp, i) => (
                            <div key={i} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <p className="font-medium text-slate-800">{supp}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {metric.lifestyle?.length > 0 && (
                      <div>
                        <h4 className="font-bold text-slate-800 mb-2">Lifestyle Changes</h4>
                        <ul className="space-y-2">
                          {metric.lifestyle.map((change, i) => (
                            <li key={i} className="flex items-start gap-2 text-slate-700">
                              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-2 flex-shrink-0" />
                              {change}
                            </li>
                          ))}
                        </ul>
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
        <div className="bg-white rounded-2xl border-l-4 border-amber-500 border-t-2 border-r-2 border-b-2 border-t-slate-200 border-r-slate-200 border-b-slate-200 p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" /> Health Deficiencies
          </h2>
          <div className="space-y-4">
            {aiAnalysis.deficiencies.map((def, i) => (
              <div
                key={i}
                className={`p-6 rounded-xl border-2 ${
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
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
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

      {/* Diet Plan */}
      {aiAnalysis?.dietPlan && Object.keys(aiAnalysis.dietPlan).length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Apple className="w-6 h-6 text-emerald-500" /> Personalized Diet Plan
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {aiAnalysis.dietPlan.breakfast?.length > 0 && (
              <div className="p-6 bg-orange-50 rounded-xl border-2 border-orange-200">
                <h3 className="font-bold text-orange-700 mb-3 text-lg">🌅 Breakfast</h3>
                <ul className="space-y-2">
                  {aiAnalysis.dietPlan.breakfast.map((item, i) => (
                    <li key={i} className="text-sm text-orange-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-orange-500 rounded-full mt-1.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiAnalysis.dietPlan.lunch?.length > 0 && (
              <div className="p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
                <h3 className="font-bold text-blue-700 mb-3 text-lg">☀️ Lunch</h3>
                <ul className="space-y-2">
                  {aiAnalysis.dietPlan.lunch.map((item, i) => (
                    <li key={i} className="text-sm text-blue-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiAnalysis.dietPlan.dinner?.length > 0 && (
              <div className="p-6 bg-purple-50 rounded-xl border-2 border-purple-200">
                <h3 className="font-bold text-purple-700 mb-3 text-lg">🌙 Dinner</h3>
                <ul className="space-y-2">
                  {aiAnalysis.dietPlan.dinner.map((item, i) => (
                    <li key={i} className="text-sm text-purple-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiAnalysis.dietPlan.snacks?.length > 0 && (
              <div className="p-6 bg-green-50 rounded-xl border-2 border-green-200">
                <h3 className="font-bold text-green-700 mb-3 text-lg">🍎 Healthy Snacks</h3>
                <ul className="space-y-2">
                  {aiAnalysis.dietPlan.snacks.map((item, i) => (
                    <li key={i} className="text-sm text-green-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiAnalysis.dietPlan.hydration && (
              <div className="p-6 bg-cyan-50 rounded-xl border-2 border-cyan-200">
                <h3 className="font-bold text-cyan-700 mb-3 text-lg">💧 Hydration</h3>
                <p className="text-sm text-cyan-700">{aiAnalysis.dietPlan.hydration}</p>
              </div>
            )}

            {aiAnalysis.dietPlan.mealTiming && (
              <div className="p-6 bg-indigo-50 rounded-xl border-2 border-indigo-200">
                <h3 className="font-bold text-indigo-700 mb-3 text-lg">⏰ Meal Timing</h3>
                <p className="text-sm text-indigo-700">{aiAnalysis.dietPlan.mealTiming}</p>
              </div>
            )}
          </div>

          {aiAnalysis.dietPlan.foodsToAvoid?.length > 0 && (
            <div className="mt-6 p-6 bg-red-50 rounded-xl border-2 border-red-200">
              <h3 className="font-bold text-red-700 mb-3 text-lg">❌ Foods to Avoid</h3>
              <div className="flex flex-wrap gap-2">
                {aiAnalysis.dietPlan.foodsToAvoid.map((food, i) => (
                  <span key={i} className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
                    {food}
                  </span>
                ))}
              </div>
            </div>
          )}

          {aiAnalysis.dietPlan.notes && (
            <div className="mt-6 p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
              <h3 className="font-bold text-blue-700 mb-2">📝 Special Notes</h3>
              <p className="text-sm text-blue-700">{aiAnalysis.dietPlan.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Fitness Plan */}
      {aiAnalysis?.fitnessPlan && Object.keys(aiAnalysis.fitnessPlan).length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Dumbbell className="w-6 h-6 text-blue-600" /> Personalized Fitness Plan
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {aiAnalysis.fitnessPlan.cardio && (
              <div className="p-6 bg-red-50 rounded-xl border-2 border-red-200">
                <h3 className="font-bold text-red-700 mb-3 text-lg">❤️ Cardio</h3>
                <p className="text-sm text-red-700">{aiAnalysis.fitnessPlan.cardio}</p>
              </div>
            )}

            {aiAnalysis.fitnessPlan.strength && (
              <div className="p-6 bg-orange-50 rounded-xl border-2 border-orange-200">
                <h3 className="font-bold text-orange-700 mb-3 text-lg">💪 Strength Training</h3>
                <p className="text-sm text-orange-700">{aiAnalysis.fitnessPlan.strength}</p>
              </div>
            )}

            {aiAnalysis.fitnessPlan.flexibility && (
              <div className="p-6 bg-purple-50 rounded-xl border-2 border-purple-200">
                <h3 className="font-bold text-purple-700 mb-3 text-lg">🧘 Flexibility & Yoga</h3>
                <p className="text-sm text-purple-700">{aiAnalysis.fitnessPlan.flexibility}</p>
              </div>
            )}

            {aiAnalysis.fitnessPlan.frequency && (
              <div className="p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
                <h3 className="font-bold text-blue-700 mb-3 text-lg">📅 Frequency</h3>
                <p className="text-sm text-blue-700">{aiAnalysis.fitnessPlan.frequency}</p>
              </div>
            )}

            {aiAnalysis.fitnessPlan.duration && (
              <div className="p-6 bg-green-50 rounded-xl border-2 border-green-200">
                <h3 className="font-bold text-green-700 mb-3 text-lg">⏱️ Duration</h3>
                <p className="text-sm text-green-700">{aiAnalysis.fitnessPlan.duration}</p>
              </div>
            )}

            {aiAnalysis.fitnessPlan.intensity && (
              <div className="p-6 bg-yellow-50 rounded-xl border-2 border-yellow-200">
                <h3 className="font-bold text-yellow-700 mb-3 text-lg">🔥 Intensity</h3>
                <p className="text-sm text-yellow-700">{aiAnalysis.fitnessPlan.intensity}</p>
              </div>
            )}
          </div>

          {aiAnalysis.fitnessPlan.precautions && (
            <div className="mt-6 p-6 bg-red-50 rounded-xl border-2 border-red-200">
              <h3 className="font-bold text-red-700 mb-3 text-lg">⚠️ Precautions</h3>
              <p className="text-sm text-red-700">{aiAnalysis.fitnessPlan.precautions}</p>
            </div>
          )}

          {aiAnalysis.fitnessPlan.progressionPlan && (
            <div className="mt-6 p-6 bg-emerald-50 rounded-xl border-2 border-emerald-200">
              <h3 className="font-bold text-emerald-700 mb-3 text-lg">📈 Progression Plan</h3>
              <p className="text-sm text-emerald-700">{aiAnalysis.fitnessPlan.progressionPlan}</p>
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
        <p className="text-sm text-blue-700">
          <strong>Disclaimer:</strong> This AI analysis is for informational wellness support only and should not replace professional medical advice. Always consult with a healthcare provider for medical decisions.
        </p>
      </div>
    </div>
  );
}
