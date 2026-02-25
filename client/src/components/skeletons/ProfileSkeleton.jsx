import React from 'react';

const ProfileSkeleton = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-pink-900 to-slate-900 p-4 sm:p-6 animate-pulse">
      {/* Profile Header */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full"></div>
          <div className="flex-1">
            <div className="h-6 bg-slate-700/50 rounded w-40 mb-2"></div>
            <div className="h-4 bg-slate-700/50 rounded w-56"></div>
          </div>
        </div>
      </div>

      {/* Profile Sections */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
            <div className="h-6 bg-slate-700/50 rounded w-32 mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex items-center justify-between">
                  <div className="h-4 bg-slate-700/50 rounded w-24"></div>
                  <div className="h-4 bg-slate-700/50 rounded w-32"></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProfileSkeleton;
