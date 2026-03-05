import React from 'react';

const DashboardSkeleton = () => {
  return (
    <div className="min-h-screen bg-white p-4 sm:p-6 animate-pulse space-y-8">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between pt-8 mb-6">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-[1.5rem] bg-slate-100"></div>
          <div>
            <div className="h-8 bg-slate-100 rounded-lg w-48 mb-2"></div>
            <div className="h-3 bg-slate-100 rounded w-32"></div>
          </div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-slate-100"></div>
      </div>

      {/* Hero Skeleton */}
      <div className="w-full h-24 rounded-[2.5rem] bg-slate-100"></div>

      {/* Date Select Skeleton */}
      <div className="h-44 bg-slate-50/50 rounded-[2.5rem] border border-slate-100"></div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-40 bg-white rounded-[2.5rem] border border-slate-100 p-6 flex flex-col justify-between">
            <div className="w-12 h-12 rounded-2xl bg-slate-100"></div>
            <div className="space-y-2">
              <div className="h-3 bg-slate-100 rounded w-12"></div>
              <div className="h-8 bg-slate-100 rounded w-20"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Large Content Skeleton */}
      <div className="h-64 bg-slate-50/50 rounded-[2.5rem] border border-slate-100"></div>
    </div>
  );
};

export default DashboardSkeleton;
