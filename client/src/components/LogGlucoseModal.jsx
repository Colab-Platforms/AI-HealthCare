import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, Clock, Plus, Minus } from "lucide-react";

const LogGlucoseModal = ({ isOpen, onClose, onSave }) => {
  const [glucoseValue, setGlucoseValue] = useState(150);
  const [readingType, setReadingType] = useState("fasting");
  // Current time rounded to nearest minute in local timezone for datetime-local input
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const [readingTime, setReadingTime] = useState(
    now.toISOString().slice(0, 16),
  );
  const rulerRef = useRef(null);
  const isDragging = useRef(false);

  // Ruler slider config
  const minVal = 40;
  const maxVal = 400;
  const step = 1;

  // Scroll ruler to correct position on mount
  useEffect(() => {
    if (isOpen && rulerRef.current) {
      const tickWidth = 8; // px per unit
      const scrollPos =
        (glucoseValue - minVal) * tickWidth - rulerRef.current.clientWidth / 2;
      rulerRef.current.scrollLeft = Math.max(0, scrollPos);
    }
  }, [isOpen]);

  const handleRulerScroll = () => {
    if (!rulerRef.current) return;
    const tickWidth = 8;
    const scrollLeft = rulerRef.current.scrollLeft;
    const centerOffset = rulerRef.current.clientWidth / 2;
    const rawValue =
      Math.round((scrollLeft + centerOffset) / tickWidth) + minVal;
    if (rawValue >= minVal && rawValue <= maxVal) {
      setGlucoseValue(rawValue);
    }
  };

  const handleManualInput = (e) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val)) {
      setGlucoseValue(val);
      if (rulerRef.current && val >= minVal && val <= maxVal) {
        const tickWidth = 8;
        const scrollPos =
          (val - minVal) * tickWidth - rulerRef.current.clientWidth / 2;
        rulerRef.current.scrollLeft = Math.max(0, scrollPos);
      }
    } else {
      setGlucoseValue(""); // Allow clearing while typing
    }
  };

  const adjustValue = (delta) => {
    setGlucoseValue((prev) => {
      const next = Math.min(Math.max(prev + delta, minVal), maxVal);
      // Scroll ruler to match
      if (rulerRef.current) {
        const tickWidth = 8;
        const scrollPos =
          (next - minVal) * tickWidth - rulerRef.current.clientWidth / 2;
        rulerRef.current.scrollLeft = Math.max(0, scrollPos);
      }
      return next;
    });
  };

  const handleSave = () => {
    const reading = {
      value: glucoseValue,
      type: readingType,
      time: new Date(readingTime).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      timestamp: new Date(readingTime).toISOString(),
    };
    onSave(reading);
    onClose();
    setGlucoseValue(150);
    setReadingType("fasting");
  };

  const getValueColor = () => {
    if (glucoseValue >= 70 && glucoseValue <= 130) return "text-slate-800";
    if (glucoseValue > 130) return "text-red-600";
    return "text-yellow-600";
  };

  if (!isOpen) return null;

  const readingTypes = [
    {
      id: "fasting",
      label: "Fasting",
      description: "Reading taken after an overnight fast",
      icon: (
        <div className="w-11 h-11 bg-gray-100 rounded-full flex items-center justify-center">
          <Clock className="w-5 h-5 text-gray-500" />
        </div>
      ),
    },
    {
      id: "before-meal",
      label: "Before meal",
      description: "Reading taken within 15 minutes before a major meal",
      icon: (
        <div className="w-11 h-11 bg-gray-100 rounded-full flex items-center justify-center">
          <svg
            className="w-5 h-5 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      ),
    },
    {
      id: "after-meal",
      label: "After meal",
      description: "Reading taken 2 hours after a meal",
      icon: (
        <div className="w-11 h-11 bg-gray-100 rounded-full flex items-center justify-center">
          <svg
            className="w-5 h-5 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      ),
    },
    {
      id: "bedtime",
      label: "Bedtime",
      description: "Reading taken before going to sleep",
      icon: (
        <div className="w-11 h-11 bg-gray-100 rounded-full flex items-center justify-center">
          <svg
            className="w-5 h-5 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
        </div>
      ),
    },
  ];

  // Generate ruler ticks
  const totalTicks = maxVal - minVal;
  const ticks = [];
  for (let i = 0; i <= totalTicks; i++) {
    const val = minVal + i;
    const isMajor = val % 10 === 0;
    const isMid = val % 5 === 0 && !isMajor;
    ticks.push({ val, isMajor, isMid });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[9998] transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal - Slides up from bottom */}
      <div className="fixed inset-x-0 bottom-0 z-[9999] animate-slide-up">
        <div className="bg-white rounded-t-[3rem] shadow-2xl max-h-[92vh] overflow-y-auto pb-32">
          {/* Drag Handle */}
          <div className="flex justify-center pt-3 pb-1" onClick={onClose}>
            <div className="w-10 h-1 bg-gray-300 rounded-full cursor-pointer" />
          </div>

          <div className="px-5 pb-8 pt-4">
            <div className="bg-gray-50 rounded-2xl p-6 mb-6 text-center flex items-center justify-center">
              <input
                type="number"
                value={glucoseValue}
                onChange={handleManualInput}
                className={`w-28 text-6xl font-extrabold ${getValueColor()} tracking-tight text-center bg-transparent border-none outline-none focus:ring-0`}
              />
              <span className="text-lg text-gray-400 font-medium ml-1">
                mg/dL
              </span>
            </div>

            {/* Ruler-Style Slider */}
            <div className="mb-8 relative">
              {/* Center indicator (teal triangle) */}
              <div className="flex justify-center mb-1">
                <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-[#2FC8B9]" />
              </div>

              <div className="flex items-center gap-2">
                {/* Minus button */}
                <button
                  onClick={() => adjustValue(-5)}
                  className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors active:scale-95"
                >
                  <Minus className="w-4 h-4 text-gray-600" />
                </button>

                {/* Ruler */}
                <div
                  ref={rulerRef}
                  onScroll={handleRulerScroll}
                  className="flex-1 overflow-x-auto scrollbar-hide relative"
                  style={{
                    scrollBehavior: isDragging.current ? "auto" : "smooth",
                    WebkitOverflowScrolling: "touch",
                  }}
                  onTouchStart={() => {
                    isDragging.current = true;
                  }}
                  onTouchEnd={() => {
                    isDragging.current = false;
                  }}
                  onMouseDown={() => {
                    isDragging.current = true;
                  }}
                  onMouseUp={() => {
                    isDragging.current = false;
                  }}
                >
                  <div
                    className="flex items-end h-20"
                    style={{
                      width: `${totalTicks * 8}px`,
                      paddingLeft: "50%",
                      paddingRight: "50%",
                    }}
                  >
                    {ticks.map((tick, i) => (
                      <div
                        key={i}
                        className="flex flex-col items-center"
                        style={{ width: "8px", flexShrink: 0 }}
                      >
                        <div
                          className={`w-px ${tick.isMajor
                            ? "h-10 bg-gray-700"
                            : tick.isMid
                              ? "h-6 bg-gray-400"
                              : "h-3 bg-gray-300"
                            }`}
                        />
                        {tick.isMajor && (
                          <span className="text-[10px] text-gray-500 mt-1 font-medium">
                            {tick.val}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Plus button */}
                <button
                  onClick={() => adjustValue(5)}
                  className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors active:scale-95"
                >
                  <Plus className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            {/* When was this reading taken */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                When was this reading taken?
              </label>
              <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between border border-gray-200">
                <input
                  type="datetime-local"
                  value={readingTime}
                  onChange={(e) => setReadingTime(e.target.value)}
                  className="bg-transparent text-gray-700 text-sm font-medium w-full outline-none"
                />
              </div>
            </div>

            {/* Type of reading */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Type of reading
              </label>

              <div className="space-y-3">
                {readingTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setReadingType(type.id)}
                    className={`w-full p-4 rounded-2xl border-2 transition-all duration-200 ${readingType === type.id
                      ? "border-[#2FC8B9] bg-[#2FC8B9]/10 shadow-sm"
                      : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {type.icon}
                        <div className="text-left">
                          <div className="font-semibold text-slate-800 text-sm">
                            {type.label}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                            {type.description}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-3 transition-all ${readingType === type.id
                          ? "border-[#2FC8B9] bg-[#2FC8B9]"
                          : "border-gray-300"
                          }`}
                      >
                        {readingType === type.id && (
                          <div className="w-2.5 h-2.5 bg-white rounded-full" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              className="w-full bg-[#2FC8B9] text-white py-4 rounded-full font-bold text-base hover:bg-[#1db7a6] transition-all shadow-lg shadow-[#2FC8B9]/30 active:scale-[0.98]"
            >
              Save Reading
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.35s cubic-bezier(0.32, 0.72, 0, 1);
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  );
};

export default LogGlucoseModal;
