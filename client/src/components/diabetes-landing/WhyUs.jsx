import { useState, useEffect, useRef, useCallback } from "react";

const DURATION = 5000;

const WhyUs = () => {
  const data = [
    {
      id: 0,
      title: "Real-Time Insights",
      description:
        "At Take Health, we simplify diabetes management through intelligent tracking, personalized insights, and actionable plans.",
      image: "/diabetes/why/1.webp",
    },
    {
      id: 1,
      title: "Simple & Clear Guidance",
      description:
        "No confusing medical terms. Just easy-to-follow advice you can actually use. We tell you exactly what to eat, what to avoid, and what small steps can improve your health daily.",
      image: "/diabetes/why/2.webp",
    },
    {
      id: 2,
      title: "All-in-One Platform",
      description:
        "Everything you need in one place no switching between apps. Track reports, monitor sugar levels, follow plans, and get insights all in a single, seamless experience.",
      image: "/diabetes/why/3.webp",
    },
    {
      id: 3,
      title: "Lifestyle-Focused Approach",
      description:
        "We focus on long-term habits, not quick fixes. From diet and activity to sleep and stress, we help you build a balanced lifestyle that keeps your diabetes under control.",
      image: "/diabetes/why/4.webp",
    },
  ];

  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef(null);
  const rafRef = useRef(null);
  const activeIndexRef = useRef(activeIndex);

  activeIndexRef.current = activeIndex;

  const startCycle = useCallback(
    (index) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setActiveIndex(index);
      setProgress(0);
      startTimeRef.current = performance.now();

      const tick = (now) => {
        const elapsed = now - startTimeRef.current;
        const pct = Math.min((elapsed / DURATION) * 100, 100);
        setProgress(pct);

        if (pct < 100) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          const next = (index + 1) % data.length;
          startCycle(next);
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [data.length],
  );

  useEffect(() => {
    startCycle(0);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleClick = (index) => {
    startCycle(index);
  };

  return (
    <section className="container mx-auto pb-10 md:pt-24 px-5 lg:px-20 overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-12">
      {/* Left — title + list */}
      <div className="flex-1 max-w-lg">
        <h2 className="text-landing-text font-landing-title font-semibold text-2xl md:text-4xl">
          Why Choose{" "}
          <span className="text-landing-primary-hover italic">Take Health</span>{" "}
          for Diabetes Reversal
        </h2>

        <ul className="mt-8 space-y-0">
          {data.map((item, i) => {
            const isActive = i === activeIndex;
            return (
              <li key={item.id}>
                <button
                  onClick={() => handleClick(i)}
                  className={`w-full text-left flex items-center gap-4 py-4 transition-colors duration-300 ${
                    isActive
                      ? "text-landing-text"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {/* checkmark */}
                  <img
                    src="/diabetes/why/right.svg"
                    alt=""
                    className={`w-5 h-5 flex-shrink-0 transition-opacity duration-300 ${
                      isActive ? "opacity-100" : "opacity-40"
                    }`}
                  />
                  <span
                    className={`font-landing-body transition-all duration-300 ${
                      isActive ? "text-lg font-semibold" : "text-lg font-medium"
                    }`}
                  >
                    {item.title}
                  </span>
                </button>

                {/* Progress bar — always visible as track, fills when active */}
                <div className="w-full h-[2px] bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-landing-primary-hover rounded-full transition-none"
                    style={{
                      width: isActive ? `${progress}%` : "0%",
                      transition: isActive ? "none" : "width 0.3s ease",
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Right — image */}
      <div className="relative flex-shrink-0 w-full lg:w-auto">
        <div className="relative overflow-hidden rounded-2xl w-full lg:w-[420px]">
          {data.map((item, i) => (
            <img
              key={item.id}
              src={item.image}
              alt={item.title}
              className={`w-full object-cover rounded-2xl transition-opacity duration-700 ${
                i === activeIndex
                  ? "opacity-100 relative"
                  : "opacity-0 absolute inset-0"
              }`}
            />
          ))}

          {/* Caption overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 rounded-b-2xl">
            <p className="text-black font-medium p-3 rounded-xl bg-white/60 backdrop-blur-sm text-sm md:text-base">
              {data[activeIndex].description}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyUs;
