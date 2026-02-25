import React from 'react';

const ReportsSkeleton = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-pink-900 to-slate-900 p-4 sm:p-6 animate-pulse">
      {/* Header */}
      <div className="mb-6">
        <div className="h-8 bg-slate-700/50 rounded w-48 mb-2"></div>
        <div className="h-4 bg-slate-700/50 rounded w-64"></div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="h-5 bg-slate-700/50 rounded w-32 mb-2"></div>
                <div className="h-4 bg-slate-700/50 rounded w-24"></div>
              </div>
              <div className="w-10 h-10 bg-slate-700/50 rounded-lg"></div>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-slate-700/50 rounded w-full"></div>
              <div className="h-3 bg-slate-700/50 rounded w-3/4"></div>
            </div>
            <div className="mt-4 h-9 bg-slate-700/50 rounded-lg"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportsSkeleton;
