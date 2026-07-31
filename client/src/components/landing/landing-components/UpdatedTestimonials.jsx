import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";

const UpdatedTestimonials = () => {
  const testimonials = [
    {
      id: 1,
      name: "Priti S.",
      role: "Health Enthusiast",
      stars: 5,
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
      quote:
        "Take Health has completely transformed how I track my lab results and daily vitals. The AI analysis caught an early trend in my glucose levels before my routine checkup. Truly life-changing!",
    },
    {
      id: 2,
      name: "Rohit S.",
      role: "Active Member",
      stars: 5,
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
      quote:
        "The personalized daily recommendations and sleep recovery scores have helped me optimize my energy levels dramatically. Having my health data simplified is a game changer.",
    },
    {
      id: 3,
      name: "Sneha S.",
      role: "Longevity Advocate",
      stars: 5,
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80",
      quote:
        "Having all my medical records and lab reports explained in plain English has given me complete confidence in managing my health. Couldn't recommend Take Health enough!",
    },
    {
      id: 4,
      name: "Yogita P.",
      role: "Functional Physician",
      stars: 5,
      avatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=200&q=80",
      quote:
        "As a physician, I am thoroughly impressed by the precision of Take Health's biomarker breakdown. It gives patients clear, actionable insights they can actually follow.",
    },
    {
      id: 5,
      name: "Abhiraj P.",
      role: "Fitness Coach",
      stars: 5,
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
      quote:
        "The biological age tracking and nutrition breakdown are spot on. It's like having a top-tier longevity specialist in your pocket 24/7.",
    },
  ];

  // Continuous infinite ticker offset state
  const [offset, setOffset] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const requestRef = useRef();

  const cardWidth = 360;
  const gap = 24;
  const itemTotalWidth = cardWidth + gap;
  const totalLoopWidth = testimonials.length * itemTotalWidth;

  useEffect(() => {
    let lastTime = performance.now();

    const animate = (time) => {
      const delta = time - lastTime;
      lastTime = time;

      if (!isPaused) {
        setOffset((prev) => (prev + delta * 0.04) % totalLoopWidth);
      }
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPaused, totalLoopWidth]);

  return (
    <section className="w-full bg-[#014343] py-14 sm:py-24 px-4 sm:px-12 lg:px-20 font-landing-body text-white overflow-hidden relative">
      <div className="max-w-[1920px] mx-auto">

        {/* ─── TOP HEADER (NO MANUAL ARROW BUTTONS) ─────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 sm:mb-12 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-left"
          >
            <h2 className="text-3xl sm:text-5xl lg:text-[76px] font-medium font-landing-title text-white leading-tight">
              The Difference <br />
              You Can Feel
            </h2>
          </motion.div>
        </div>

        {/* ─── CONTINUOUS AUTOMATIC INFINITE REPETITIVE TICKER ──────────────────── */}
        <div
          className="w-full relative overflow-hidden py-4"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Scrolling Stage Track */}
          <div
            className="flex items-stretch gap-6 transition-transform duration-75 ease-linear"
            style={{
              transform: `translate3d(-${offset}px, 0px, 0px)`,
            }}
          >
            {/* Render 3 copies for seamless infinite repeating loop */}
            {[...testimonials, ...testimonials, ...testimonials].map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className="w-[300px] sm:w-[340px] lg:w-[360px] min-h-[280px] sm:min-h-[320px] lg:min-h-[360px] bg-[#FFF9ED] text-slate-900 rounded-[12px] p-6 sm:p-7 flex flex-col justify-between flex-shrink-0 shadow-lg border border-white/20 transform transition-transform duration-300 hover:-translate-y-1.5"
              >
                <div>
                  {/* Top Row: Stars + Custom SVG Quote Icon */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-1 text-[#014343]">
                      {[...Array(item.stars)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-[#014343] stroke-[#014343]" />
                      ))}
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" width="56" height="40" viewBox="0 0 71 51" fill="none">
                      <g clipPath="url(#clip0_1162_2323)">
                        <path d="M0 30.1054H15.0527L5.01725 50.1753H20.0699L30.1054 30.1054V0H0V30.1054ZM40.1399 0V30.1054H55.1926L45.1571 50.1753H60.2098L70.2453 30.1054V0H40.1399Z" fill="#014343" fillOpacity="0.18" />
                      </g>
                      <defs>
                        <clipPath id="clip0_1162_2323">
                          <rect width="70.2453" height="51" fill="white" />
                        </clipPath>
                      </defs>
                    </svg>
                  </div>

                  {/* Review Text */}
                  <p className="text-sm sm:text-base text-slate-700 font-light leading-relaxed mb-6 text-left">
                    "{item.quote}"
                  </p>
                </div>

                {/* Divider & User Info Footer */}
                <div>
                  <div className="w-full h-px bg-slate-200/80 mb-5" />
                  <div className="flex items-center gap-3.5">
                    <img
                      src={item.avatar}
                      alt={item.name}
                      className="w-11 h-11 rounded-full object-cover border-2 border-[#014343]/20 flex-shrink-0"
                    />
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-bold text-slate-900 leading-snug">
                        {item.name}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {item.role}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};

export default UpdatedTestimonials;
