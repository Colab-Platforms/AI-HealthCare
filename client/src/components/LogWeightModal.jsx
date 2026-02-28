import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, Plus, Minus } from "lucide-react";

const LogWeightModal = ({ isOpen, onClose, onSave }) => {
  const [weightValue, setWeightValue] = useState(70.0);

  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const [readingTime, setReadingTime] = useState(
    now.toISOString().slice(0, 16),
  );

  const rulerRef = useRef(null);
  const isDragging = useRef(false);

  // Ruler config, values multiplied by 10 to deal with 0.1 increments
  const minVal = 200; // 20.0 kg
  const maxVal = 2500; // 250.0 kg

  useEffect(() => {
    if (isOpen && rulerRef.current) {
      const tickWidth = 8;
      const scrollPos =
        (weightValue * 10 - minVal) * tickWidth -
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
      setWeightValue(rawValue / 10);
    }
  };

  const handleManualInput = (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      setWeightValue(val);
      if (rulerRef.current && val * 10 >= minVal && val * 10 <= maxVal) {
        const tickWidth = 8;
        const scrollPos =
          (val * 10 - minVal) * tickWidth - rulerRef.current.clientWidth / 2;
        rulerRef.current.scrollLeft = Math.max(0, scrollPos);
      }
    } else {
      setWeightValue("");
    }
  };

  const adjustValue = (delta) => {
    setWeightValue((prev) => {
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
      value: weightValue,
      type: "weight",
      time: new Date(readingTime).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      timestamp: new Date(readingTime).toISOString(),
    };
    onSave(reading);
    onClose();
  };

  if (!isOpen) return null;

  const totalTicks = maxVal - minVal;
  const ticks = [];
  // For performance and layout, only render every 1st tick, label every 10th
  for (let i = 0; i <= totalTicks; i++) {
    const val = minVal + i;
    const isMajor = val % 50 === 0; // every 5 kg
    const isMid = val % 10 === 0 && !isMajor; // every 1 kg
    // Only push if it's a whole number, rendering 0.1 ticks is too many DOM nodes for a 2000 range?
    // Wait, totalTicks is 2300! That's 2300 DOM elements.
    // Instead of rendering every 0.1, we could just render every 1 unit and divide tickWidth by 10 for scroll handling.
    // But since this is a quick replication, let's keep it simple. Actually, rendering 2300 nodes might lag.
    // Let's only render whole numbers as ticks, but allow scrolling at the 0.1 level.
  }

  // Revised tick generation for width:
  // Render only whole numbers (every 1 kg -> multiply by 10)
  for (let i = 0; i <= (maxVal - minVal) / 10; i++) {
    const val = minVal / 10 + i;
    const isMajor = val % 5 === 0;
    const isMid = val % 1 === 0 && !isMajor;
    ticks.push({ val: val, isMajor, isMid });
  }

  // Adjust scroll handler for new tick mapping (each tick is 1kg, so 10 units)
  // tickWidth = 80px per 1 kg (8px per 0.1 kg)

  const optimizedTickWidth = 80;

  const handleOptimizedRulerScroll = () => {
    if (!rulerRef.current) return;
    const scrollLeft = rulerRef.current.scrollLeft;
    const centerOffset = rulerRef.current.clientWidth / 2;
    // 80px = 1kg, so 8px = 0.1kg
    const rawValue =
      Math.round((scrollLeft + centerOffset) / (optimizedTickWidth / 10)) +
      minVal;
    if (rawValue >= minVal && rawValue <= maxVal) {
      setWeightValue(rawValue / 10);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-[9998] transition-opacity duration-300"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 bottom-0 z-[9999] animate-slide-up">
        <div className="bg-white rounded-t-[3rem] shadow-2xl max-h-[92vh] overflow-y-auto pb-32">
          <div className="flex justify-center pt-3 pb-1" onClick={onClose}>
            <div className="w-10 h-1 bg-gray-300 rounded-full cursor-pointer" />
          </div>

          <div className="px-5 pb-8 pt-4">
            <div className="bg-gray-50 rounded-2xl p-6 mb-6 text-center flex items-center justify-center">
              <input
                type="number"
                step="0.1"
                value={weightValue}
                onChange={handleManualInput}
                className={`w-36 text-6xl font-extrabold text-slate-800 tracking-tight text-center bg-transparent border-none outline-none focus:ring-0`}
              />
              <span className="text-lg text-gray-400 font-medium ml-1">kg</span>
            </div>

            <div className="mb-8 relative">
              <div className="flex justify-center mb-1">
                <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-[#2FC8B9]" />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => adjustValue(-10)} // -1.0 kg
                  className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors active:scale-95"
                >
                  <Minus className="w-4 h-4 text-gray-600" />
                </button>

                <div
                  ref={rulerRef}
                  onScroll={handleOptimizedRulerScroll}
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
                      width: `${ticks.length * optimizedTickWidth}px`,
                      paddingLeft: "50%",
                      paddingRight: "50%",
                    }}
                  >
                    {ticks.map((tick, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-end"
                        style={{
                          width: `${optimizedTickWidth}px`,
                          flexShrink: 0,
                        }}
                      >
                        <div className="flex flex-col items-center flex-1">
                          <div
                            className={`w-px ${tick.isMajor ? "h-10 bg-gray-700" : "h-6 bg-gray-400"}`}
                          />
                          {tick.isMajor && (
                            <span className="text-[10px] text-gray-500 mt-1 font-medium">
                              {tick.val}
                            </span>
                          )}
                        </div>
                        {/* Subticks for visuals within default 80px space (if needed, but optional) */}
                        <div className="w-px h-3 bg-gray-300" />
                        <div className="w-px h-3 bg-gray-300" />
                        <div className="w-px h-3 bg-gray-300" />
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => adjustValue(10)} // +1.0 kg
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
              className="w-full bg-[#2FC8B9] text-white py-4 rounded-full font-bold text-base hover:bg-[#1db7a6] transition-all shadow-lg shadow-[#2FC8B9]/30 active:scale-[0.98]"
            >
              Save Reading
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
export default LogWeightModal;
