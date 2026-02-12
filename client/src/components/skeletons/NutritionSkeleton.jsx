import React from 'react';

const NutritionSkeleton = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-6 animate-pulse">
      {/* Header */}
      <div className="mb-6">
        <div className="h-8 bg-slate-700/50 rounded w-48 mb-2"></div>
        <div className="h-4 bg-slate-700/50 rounded w-64"></div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="h-4 bg-slate-700/50 rounded w-20 mb-2"></div>
            <div className="h-8 bg-slate-700/50 rounded w-16 mb-1"></div>
            <div className="h-3 bg-slate-700/50 rounded w-24"></div>
          </div>
        ))}
      </div>

      {/* Meals Section */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 mb-6">
        <div className="h-6 bg-slate-700/50 rounded w-32 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-slate-700/30 rounded-lg p-4">
              <div className="h-5 bg-slate-700/50 rounded w-24 mb-2"></div>
              <div className="h-4 bg-slate-700/50 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
        <div className="h-6 bg-slate-700/50 rounded w-40 mb-4"></div>
        <div className="h-64 bg-slate-700/50 rounded"></div>
      </div>
    </div>
  );
};

export default NutritionSkeleton;
