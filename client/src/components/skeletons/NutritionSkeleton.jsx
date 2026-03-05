import React from 'react';

const NutritionSkeleton = () => {
  return (
    <div className="min-h-screen bg-white p-4 sm:p-6 animate-pulse space-y-8">
      {/* Date Picker Skeleton */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="w-10 h-10 rounded-xl bg-slate-100"></div>
        <div className="flex-1 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="w-12 h-16 rounded-xl bg-slate-100"></div>
          ))}
        </div>
        <div className="w-10 h-10 rounded-xl bg-slate-100"></div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column: Meals Skeleton */}
        <div className="flex-1 space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-100 rounded w-24"></div>
                    <div className="h-3 bg-slate-100 rounded w-32"></div>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-[1.25rem] bg-slate-100"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Progress Skeleton */}
        <div className="w-full lg:w-96 space-y-6">
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm space-y-6">
            <div className="w-48 h-48 rounded-full bg-slate-100 mx-auto"></div>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-slate-100 rounded-2xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NutritionSkeleton;
