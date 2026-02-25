import React from 'react';

const ChatSkeleton = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-pink-900 to-slate-900 flex flex-col animate-pulse">
      {/* Header */}
      <div className="bg-slate-800/50 border-b border-slate-700/50 p-4">
        <div className="h-6 bg-slate-700/50 rounded w-48 mx-auto"></div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* User Message */}
        <div className="flex justify-end">
          <div className="bg-purple-600/30 rounded-2xl p-4 max-w-[80%]">
            <div className="h-4 bg-slate-700/50 rounded w-48 mb-2"></div>
            <div className="h-4 bg-slate-700/50 rounded w-32"></div>
          </div>
        </div>

        {/* AI Message */}
        <div className="flex justify-start">
          <div className="bg-slate-800/50 rounded-2xl p-4 max-w-[80%]">
            <div className="h-4 bg-slate-700/50 rounded w-64 mb-2"></div>
            <div className="h-4 bg-slate-700/50 rounded w-56 mb-2"></div>
            <div className="h-4 bg-slate-700/50 rounded w-48"></div>
          </div>
        </div>

        {/* User Message */}
        <div className="flex justify-end">
          <div className="bg-purple-600/30 rounded-2xl p-4 max-w-[80%]">
            <div className="h-4 bg-slate-700/50 rounded w-40"></div>
          </div>
        </div>

        {/* AI Message */}
        <div className="flex justify-start">
          <div className="bg-slate-800/50 rounded-2xl p-4 max-w-[80%]">
            <div className="h-4 bg-slate-700/50 rounded w-72 mb-2"></div>
            <div className="h-4 bg-slate-700/50 rounded w-64"></div>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-slate-800/50 border-t border-slate-700/50 p-4">
        <div className="h-12 bg-slate-700/50 rounded-full"></div>
      </div>
    </div>
  );
};

export default ChatSkeleton;
