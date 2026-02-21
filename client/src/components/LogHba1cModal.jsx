import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, Clock, Plus, Minus } from "lucide-react";

const LogHba1cModal = ({ isOpen, onClose, onSave }) => {
  const [hba1cValue, setHba1cValue] = useState(5.7);

  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const [readingTime, setReadingTime] = useState(
    now.toISOString().slice(0, 16),
  );

  const rulerRef = useRef(null);
  const isDragging = useRef(false);

  // Ruler config, values multiplied by 10 to deal with 0.1 increments
  const minVal = 30; // 3.0
  const maxVal = 150; // 15.0
  const step = 1;

  useEffect(() => {
    if (isOpen && rulerRef.current) {
      const tickWidth = 8;
      const scrollPos =
        (hba1cValue * 10 - minVal) * tickWidth -
        rulerRef.current.clientWidth / 2;
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
      setHba1cValue(rawValue / 10);
    }
  };

  const handleManualInput = (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      setHba1cValue(val);
      if (rulerRef.current && val * 10 >= minVal && val * 10 <= maxVal) {
        const tickWidth = 8;
        const scrollPos =
          (val * 10 - minVal) * tickWidth - rulerRef.current.clientWidth / 2;
        rulerRef.current.scrollLeft = Math.max(0, scrollPos);
      }
    } else {
      setHba1cValue("");
    }
  };

  const adjustValue = (delta) => {
    setHba1cValue((prev) => {
      const nextRaw = Math.min(Math.max(prev * 10 + delta, minVal), maxVal);
      const next = nextRaw / 10;
      if (rulerRef.current) {
        const tickWidth = 8;
        const scrollPos =
          (nextRaw - minVal) * tickWidth - rulerRef.current.clientWidth / 2;
        rulerRef.current.scrollLeft = Math.max(0, scrollPos);
      }
      return next;
    });
  };

  const handleSave = () => {
    const reading = {
      value: hba1cValue,
      type: "hba1c",
      time: new Date(readingTime).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      timestamp: new Date(readingTime).toISOString(),
    };
    onSave(reading);
    onClose();
  };

  const getValueColor = () => {
    if (hba1cValue >= 4.0 && hba1cValue <= 5.6) return "text-emerald-600";
    if (hba1cValue >= 5.7 && hba1cValue <= 6.4) return "text-yellow-600";
    return "text-red-600";
  };

  if (!isOpen) return null;

  const totalTicks = maxVal - minVal;
  const ticks = [];
  for (let i = 0; i <= totalTicks; i++) {
    const val = minVal + i;
    const isMajor = val % 10 === 0;
    const isMid = val % 5 === 0 && !isMajor;
    ticks.push({ val: val / 10, isMajor, isMid });
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up">
        <div className="bg-white rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto pb-4">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          <div className="sticky top-0 bg-white px-5 py-3 flex items-center gap-3 z-10">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700" />
            </button>
            <h2 className="text-lg font-bold text-slate-800">Log HbA1c</h2>
          </div>

          <div className="px-5 pb-8">
            <div className="bg-gray-50 rounded-2xl p-6 mb-6 text-center flex items-center justify-center">
              <input
                type="number"
                step="0.1"
                value={hba1cValue}
                onChange={handleManualInput}
                className={`w-32 text-6xl font-extrabold ${getValueColor()} tracking-tight text-center bg-transparent border-none outline-none focus:ring-0`}
              />
              <span className="text-lg text-gray-400 font-medium ml-1">%</span>
            </div>

            <div className="mb-8 relative">
              <div className="flex justify-center mb-1">
                <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-blue-500" />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => adjustValue(-1)}
                  className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors active:scale-95"
                >
                  <Minus className="w-4 h-4 text-gray-600" />
                </button>

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
                          className={`w-px ${tick.isMajor ? "h-10 bg-gray-700" : tick.isMid ? "h-6 bg-gray-400" : "h-3 bg-gray-300"}`}
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

                <button
                  onClick={() => adjustValue(1)}
                  className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors active:scale-95"
                >
                  <Plus className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

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

            <button
              onClick={handleSave}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 rounded-full font-bold text-base hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-[0.98]"
            >
              Save Reading
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
export default LogHba1cModal;
