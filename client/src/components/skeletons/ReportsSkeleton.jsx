import React from 'react';

const ReportsSkeleton = () => {
  return (
    <div className="min-h-screen bg-white p-6 pb-24 animate-pulse space-y-8">
      {/* Header Skeleton */}
      <div className="h-44 bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8">
        <div className="h-4 bg-slate-200 rounded w-24 mb-4"></div>
        <div className="h-8 bg-slate-200 rounded w-64 mb-4"></div>
        <div className="h-4 bg-slate-200 rounded w-48"></div>
      </div>

      {/* Stats Skeleton */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-white rounded-[2rem] border border-slate-100"></div>
        ))}
      </div>

      {/* Filter Skeleton */}
      <div className="flex gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-10 w-24 bg-slate-50 rounded-2xl border border-slate-100"></div>
        ))}
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-64 bg-white rounded-[2rem] border border-slate-100 p-6 flex flex-col justify-between">
            <div className="flex gap-4">
              <div className="w-16 h-16 rounded-[1.25rem] bg-slate-100"></div>
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-slate-100 rounded w-16"></div>
                <div className="h-6 bg-slate-100 rounded w-32"></div>
                <div className="h-3 bg-slate-100 rounded w-20"></div>
              </div>
            </div>
            <div className="h-12 bg-slate-50 rounded-2xl"></div>
            <div className="h-12 bg-slate-100 rounded-2xl"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportsSkeleton;
