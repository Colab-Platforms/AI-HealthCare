import React from 'react';

const DashboardSkeleton = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-pink-900 to-slate-900 p-4 sm:p-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="mb-6">
        <div className="h-8 bg-slate-700/50 rounded w-48 mb-2"></div>
        <div className="h-4 bg-slate-700/50 rounded w-32"></div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="h-4 bg-slate-700/50 rounded w-24 mb-3"></div>
            <div className="h-8 bg-slate-700/50 rounded w-16 mb-2"></div>
            <div className="h-3 bg-slate-700/50 rounded w-20"></div>
          </div>
        ))}
      </div>

      {/* Main Content Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Large Card */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <div className="h-6 bg-slate-700/50 rounded w-32 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-700/50 rounded"></div>
            ))}
          </div>
        </div>

        {/* Large Card */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <div className="h-6 bg-slate-700/50 rounded w-32 mb-4"></div>
          <div className="h-48 bg-slate-700/50 rounded"></div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
