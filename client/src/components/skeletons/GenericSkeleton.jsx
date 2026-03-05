import React from 'react';

const GenericSkeleton = () => {
  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 animate-pulse space-y-6 pt-8">
      {/* Header */}
      <div className="mb-8">
        <div className="h-8 bg-slate-200 rounded-lg w-48 mb-3"></div>
        <div className="h-4 bg-slate-200 rounded w-64"></div>
      </div>

      {/* Content Cards */}
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-[2rem] p-6 sm:p-8 border border-slate-100 shadow-sm">
            <div className="h-6 bg-slate-200 rounded w-40 mb-6"></div>
            <div className="space-y-4">
              <div className="h-4 bg-slate-100 rounded w-full"></div>
              <div className="h-4 bg-slate-100 rounded w-5/6"></div>
              <div className="h-4 bg-slate-100 rounded w-4/6"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GenericSkeleton;
