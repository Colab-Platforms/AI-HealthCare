import React from 'react';

const ProfileSkeleton = () => {
  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-24 relative overflow-hidden">
      {/* Header Background Skeleton */}
      <div className="absolute top-0 left-0 right-0 h-48 md:h-64 bg-black/5 animate-shimmer" />

      <div className="w-full max-w-5xl mx-auto space-y-6 pt-12 md:pt-24 relative z-10">
        {/* Profile Card Skeleton */}
        <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 shadow-xl border border-slate-100 flex flex-col md:flex-row items-center gap-6 md:gap-10">
          <div className="w-32 h-32 md:w-32 md:h-32 rounded-full animate-shimmer border-4 border-white shadow-lg"></div>
          <div className="flex-1 text-center md:text-left space-y-4 w-full">
            <div className="h-10 bg-slate-100 animate-shimmer rounded-xl w-64 mx-auto md:mx-0"></div>
            <div className="h-4 bg-slate-100 animate-shimmer rounded-full w-48 mx-auto md:mx-0"></div>
            <div className="flex flex-wrap justify-center md:justify-start gap-3 pt-4">
              {[1, 2, 3].map(i => <div key={i} className="h-8 w-24 bg-slate-100 animate-shimmer rounded-full"></div>)}
            </div>
          </div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
             <div className="h-48 bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm flex items-center gap-6">
                <div className="w-24 h-24 rounded-full animate-shimmer shrink-0"></div>
                <div className="space-y-4 flex-1">
                   <div className="h-6 w-48 animate-shimmer rounded-lg"></div>
                   <div className="h-4 w-full animate-shimmer rounded-full"></div>
                </div>
             </div>
             <div className="space-y-4">
                {[1, 2].map(i => (
                   <div key={i} className="h-24 bg-white rounded-[2rem] border border-slate-100 animate-shimmer"></div>
                ))}
             </div>
          </div>
          <div className="lg:col-span-1 space-y-6">
             <div className="h-80 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm animate-shimmer"></div>
             <div className="h-64 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm animate-shimmer"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSkeleton;
