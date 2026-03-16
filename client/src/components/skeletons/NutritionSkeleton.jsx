import React from 'react';

const NutritionSkeleton = () => {
  return (
    <div className="min-h-screen bg-transparent p-4 md:px-6 lg:px-16 pt-8 space-y-12">
      {/* Date Toggle Skeleton */}
      <div className="flex flex-col gap-4 mb-4 md:mb-8 mt-4">
        <div className="h-10 w-48 animate-shimmer rounded-full"></div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 w-32 shrink-0 animate-shimmer rounded-full"></div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Summary Skeleton */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-sm flex flex-col items-center">
            <div className="w-48 h-48 animate-shimmer rounded-full mb-8"></div>
            <div className="w-full space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-4 w-full animate-shimmer rounded-full"></div>
              ))}
            </div>
          </div>
          <div className="h-64 animate-shimmer rounded-[3rem]"></div>
        </div>

        {/* Right: Meal Logs Skeleton */}
        <div className="lg:col-span-8 space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 animate-shimmer rounded-2xl"></div>
                <div className="space-y-3">
                  <div className="h-5 w-32 animate-shimmer rounded-lg"></div>
                  <div className="h-3 w-48 animate-shimmer rounded-lg"></div>
                </div>
              </div>
              <div className="w-12 h-12 animate-shimmer rounded-full"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NutritionSkeleton;
