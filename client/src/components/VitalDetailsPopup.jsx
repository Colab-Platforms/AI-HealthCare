import { useState } from 'react';
import { X, TrendingUp, TrendingDown, AlertCircle, CheckCircle, Info } from 'lucide-react';

/**
 * Vital Details Popup Component
 * Shows normal ranges, user's data, recommendations, and visual indicator
 * Similar to WebShark Health app
 */
export default function VitalDetailsPopup({ vital, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!vital) return null;

  // Extract vital information
  const {
    name,
    value,
    unit,
    normalRange,
    status,
    description,
    recommendations,
    foodsToConsume,
    foodsToAvoid,
    symptoms,
    severity
  } = vital;

  // Parse normal range (e.g., "70-100" or "4.5-5.5")
  const parseRange = (range) => {
    if (!range) return { min: 0, max: 100 };
    const parts = range.split('-').map(p => parseFloat(p.trim()));
    return { min: parts[0], max: parts[1] };
  };

  const range = parseRange(normalRange);
  const numValue = parseFloat(value);

  // Calculate percentage position in range
  const getPercentage = () => {
    if (numValue < range.min) return 0;
    if (numValue > range.max) return 100;
    return ((numValue - range.min) / (range.max - range.min)) * 100;
  };

  // Determine status color and icon
  const getStatusColor = () => {
    if (status === 'normal') return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100' };
    if (status === 'borderline') return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100' };
    return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100' };
  };

  const colors = getStatusColor();
  const percentage = getPercentage();

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={(e) => {
        // Close modal if clicking on backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={`${colors.bg} border-b-2 ${colors.border} p-6 flex items-center justify-between sticky top-0 z-10`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${colors.badge} flex items-center justify-center`}>
              {status === 'normal' && <CheckCircle className={`w-6 h-6 ${colors.text}`} />}
              {status === 'borderline' && <AlertCircle className={`w-6 h-6 ${colors.text}`} />}
              {status === 'high' && <TrendingUp className={`w-6 h-6 ${colors.text}`} />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{name}</h2>
              <p className={`text-sm ${colors.text} font-medium capitalize`}>{status}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current Value & Range */}
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-xs text-slate-600 font-medium mb-1">Your Value</p>
                <p className="text-2xl font-bold text-slate-800">
                  {value} <span className="text-sm text-slate-500">{unit}</span>
                </p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <p className="text-xs text-blue-600 font-medium mb-1">Normal Range</p>
                <p className="text-2xl font-bold text-blue-700">{normalRange}</p>
              </div>
              <div className={`${colors.bg} rounded-xl p-4 border-2 ${colors.border}`}>
                <p className={`text-xs ${colors.text} font-medium mb-1`}>Status</p>
                <p className={`text-2xl font-bold ${colors.text} capitalize`}>{status}</p>
              </div>
            </div>

            {/* Visual Range Indicator (Like WebShark) */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-800">Range Indicator</p>
              <div className="relative h-12 bg-gradient-to-r from-red-200 via-amber-200 to-emerald-200 rounded-xl overflow-hidden border-2 border-slate-200">
                {/* Normal range highlight */}
                <div
                  className="absolute top-0 bottom-0 bg-white/40 border-l-2 border-r-2 border-blue-500"
                  style={{
                    left: `${(range.min / (range.max * 1.2)) * 100}%`,
                    right: `${100 - (range.max / (range.max * 1.2)) * 100}%`
                  }}
                />
                {/* User's value indicator */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-1 h-full bg-slate-800 border-2 border-white shadow-lg"
                  style={{ left: `${percentage}%` }}
                >
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-0 w-8 h-8 bg-slate-800 rounded-full border-4 border-white shadow-lg" />
                </div>
              </div>
              <div className="flex justify-between text-xs text-slate-600 font-medium">
                <span>Low</span>
                <span>Normal</span>
                <span>High</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-slate-200">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'recommendations', label: 'What to Do' },
              { id: 'foods', label: 'Foods & Diet' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-cyan-500 text-cyan-600'
                    : 'border-transparent text-slate-600 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="space-y-4">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {description && (
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-sm text-blue-900 leading-relaxed">{description}</p>
                  </div>
                )}

                {/* Status Explanation */}
                <div className={`p-4 rounded-xl border-2 ${colors.border} ${colors.bg}`}>
                  <h3 className={`font-semibold ${colors.text} mb-2 flex items-center gap-2`}>
                    <Info className="w-4 h-4" />
                    What This Means
                  </h3>
                  <p className={`text-sm ${colors.text}`}>
                    {status === 'normal' && 'Your value is within the normal range. Keep maintaining your current lifestyle and habits.'}
                    {status === 'borderline' && 'Your value is slightly outside the normal range. Consider making lifestyle adjustments and monitor regularly.'}
                    {status === 'high' && 'Your value is significantly outside the normal range. Consult with a healthcare provider and make necessary changes.'}
                  </p>
                </div>

                {/* Symptoms */}
                {symptoms && symptoms.length > 0 && (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Associated Symptoms
                    </h3>
                    <ul className="space-y-2">
                      {symptoms.map((symptom, idx) => (
                        <li key={idx} className="text-sm text-amber-800 flex items-start gap-2">
                          <span className="w-1.5 h-1.5 bg-amber-600 rounded-full mt-1.5 flex-shrink-0" />
                          {symptom}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Recommendations Tab */}
            {activeTab === 'recommendations' && (
              <div className="space-y-4">
                {recommendations && recommendations.length > 0 ? (
                  <div className="space-y-3">
                    {recommendations.map((rec, idx) => (
                      <div key={idx} className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                        <p className="text-sm text-emerald-900 leading-relaxed">{rec}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-sm text-slate-600">No specific recommendations available.</p>
                  </div>
                )}

                {/* General Tips */}
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <h3 className="font-semibold text-blue-900 mb-3">General Tips</h3>
                  <ul className="space-y-2 text-sm text-blue-800">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 flex-shrink-0" />
                      Monitor this value regularly
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 flex-shrink-0" />
                      Maintain a healthy lifestyle
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 flex-shrink-0" />
                      Consult a healthcare provider if concerned
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* Foods & Diet Tab */}
            {activeTab === 'foods' && (
              <div className="space-y-4">
                {foodsToConsume && foodsToConsume.length > 0 && (
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <h3 className="font-semibold text-emerald-900 mb-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Foods to Consume
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {foodsToConsume.map((food, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium"
                        >
                          {food}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {foodsToAvoid && foodsToAvoid.length > 0 && (
                  <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                    <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Foods to Avoid
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {foodsToAvoid.map((food, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-medium"
                        >
                          {food}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {!foodsToConsume && !foodsToAvoid && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-sm text-slate-600">No specific dietary recommendations available.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Severity Badge */}
          {severity && (
            <div className={`p-4 rounded-xl border-2 ${
              severity === 'severe' ? 'bg-red-50 border-red-200' :
              severity === 'moderate' ? 'bg-amber-50 border-amber-200' :
              'bg-yellow-50 border-yellow-200'
            }`}>
              <p className={`text-sm font-medium ${
                severity === 'severe' ? 'text-red-700' :
                severity === 'moderate' ? 'text-amber-700' :
                'text-yellow-700'
              }`}>
                <strong>Severity:</strong> {severity.charAt(0).toUpperCase() + severity.slice(1)}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-6 bg-slate-50">
          <p className="text-xs text-slate-600 text-center">
            This information is for educational purposes only. Always consult with a healthcare provider for medical advice.
          </p>
        </div>
      </div>
    </div>
  );
}
