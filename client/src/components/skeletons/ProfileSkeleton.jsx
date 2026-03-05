import React from 'react';

const ProfileSkeleton = () => {
  return (
    <div className="min-h-screen bg-slate-50 p-4 animate-pulse pb-24">
      {/* Blue Header Background Skeleton */}
      <div className="absolute top-0 left-0 right-0 h-48 md:h-64 bg-slate-200" />

      <div className="w-full max-w-5xl mx-auto space-y-6 pt-12 md:pt-24 relative z-10">
        {/* Profile Card Skeleton */}
        <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 shadow-xl border border-slate-100 flex flex-col md:flex-row items-center gap-6 md:gap-10">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-[2rem] bg-slate-100 border-4 border-white shadow-lg"></div>
          <div className="flex-1 text-center md:text-left space-y-4 w-full">
            <div className="h-8 bg-slate-100 rounded-lg w-48 mx-auto md:mx-0"></div>
            <div className="h-4 bg-slate-100 rounded w-64 mx-auto md:mx-0"></div>
            <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-2">
              {[1, 2, 3].map(i => <div key={i} className="h-8 w-24 bg-slate-100 rounded-lg"></div>)}
            </div>
          </div>
        </div>

        {/* BMI & Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 h-80 bg-white rounded-[2.5rem] border border-slate-100 p-6"></div>
          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-36 bg-white rounded-[2rem] border border-slate-100 p-5">
                <div className="h-10 w-10 bg-slate-100 rounded-xl mb-4"></div>
                <div className="h-6 w-20 bg-slate-100 rounded mb-2"></div>
                <div className="h-4 w-16 bg-slate-100 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSkeleton;
