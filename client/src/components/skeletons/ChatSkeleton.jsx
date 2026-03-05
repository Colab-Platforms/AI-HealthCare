import React from 'react';

const ChatSkeleton = () => {
  return (
    <div className="min-h-[80vh] bg-slate-50 flex flex-col animate-pulse rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-[1.25rem] bg-slate-100"></div>
          <div>
            <div className="h-6 bg-slate-100 rounded-md w-48 mb-2"></div>
            <div className="h-3 bg-slate-100 rounded w-32"></div>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 p-6 space-y-6">
        {/* AI Message */}
        <div className="flex justify-start gap-4">
          <div className="w-10 h-10 rounded-[1.25rem] bg-slate-200 flex-shrink-0"></div>
          <div className="bg-white rounded-[2rem] rounded-tl-sm p-6 border border-slate-100 max-w-[80%] space-y-3">
            <div className="h-4 bg-slate-100 rounded w-64"></div>
            <div className="h-4 bg-slate-100 rounded w-56"></div>
            <div className="h-4 bg-slate-100 rounded w-48"></div>
          </div>
        </div>

        {/* User Message */}
        <div className="flex justify-end gap-4">
          <div className="bg-slate-200 rounded-[2rem] rounded-tr-sm p-6 max-w-[80%] space-y-3">
            <div className="h-4 bg-white/60 rounded w-48"></div>
            <div className="h-4 bg-white/60 rounded w-32"></div>
          </div>
          <div className="w-10 h-10 rounded-[1.25rem] bg-slate-200 flex-shrink-0"></div>
        </div>

        {/* AI Message Short */}
        <div className="flex justify-start gap-4">
          <div className="w-10 h-10 rounded-[1.25rem] bg-slate-200 flex-shrink-0"></div>
          <div className="bg-white rounded-[2rem] rounded-tl-sm p-6 border border-slate-100 max-w-[80%] space-y-3">
            <div className="h-4 bg-slate-100 rounded w-72"></div>
            <div className="h-4 bg-slate-100 rounded w-40"></div>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-slate-100 p-6">
        <div className="h-16 bg-slate-50 rounded-[2rem] border border-slate-100"></div>
      </div>
    </div>
  );
};

export default ChatSkeleton;
