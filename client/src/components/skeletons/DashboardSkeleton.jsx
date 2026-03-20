import React from 'react';

const DashboardSkeleton = () => {
  return (
    <div className="min-h-screen bg-transparent p-4 md:px-6 lg:px-16 pt-8 space-y-12">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 md:mb-16 pt-4">
        <div className="space-y-4">
          <div className="h-12 w-64 animate-shimmer rounded-2xl"></div>
          <div className="h-4 w-48 animate-shimmer rounded-xl"></div>
        </div>
        <div className="flex gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 w-28 animate-shimmer rounded-full"></div>
          ))}
        </div>
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[520px] bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col">
            <div className="flex justify-between mb-8">
              <div className="h-6 w-32 animate-shimmer rounded-lg"></div>
              <div className="w-8 h-8 animate-shimmer rounded-full"></div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center space-y-8">
              <div className="w-48 h-24 animate-shimmer rounded-[2rem]"></div>
              <div className="w-full space-y-6 pt-8">
                {[1, 2, 3].map(j => (
                  <div key={j} className="h-4 w-full animate-shimmer rounded-full"></div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Section Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8">
        <div className="h-64 animate-shimmer rounded-[3rem]"></div>
        <div className="h-64 animate-shimmer rounded-[3rem]"></div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
