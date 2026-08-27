import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, ShieldCheck, Timer, Users } from "lucide-react";
import UpdatedNavbar from "./UpdatedNavbar";

const UpdatedHero = () => {
  return (
    <div
      className="w-full relative overflow-hidden font-landing-body"
      style={{ background: "linear-gradient(180deg, #1B47B9 0%, #FFFFFF 55%)" }}
    >
      {/* ─── HERO CONTAINER ─────────────────────────────────────────────────── */}
      <div className="w-full relative flex flex-col items-center justify-start sm:justify-between text-white min-h-[1000px] sm:min-h-[1250px] lg:min-h-[1450px]">

        {/* Optimized Responsive Hero Background Image */}
        <picture className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <source media="(max-width: 639px)" srcSet="/updated-landing/Hero_Section_2.png" />
          <source media="(min-width: 640px)" srcSet="/updated-landing/Hero_Banner_3.png" />
          <img
            src="/updated-landing/Hero_Banner_3.png"
            alt="Hero Background"
            decoding="async"
            loading="eager"
            fetchpriority="high"
            className="w-full h-full object-cover object-bottom pointer-events-none"
          />
        </picture>

        {/* ─── STICKY NAVBAR ──────────────────────────────────────────────────── */}
        <UpdatedNavbar />

        {/* ─── HERO CONTENT AREA ──────────────────────────────────────────────── */}
        <div className="max-w-[1920px] w-full mx-auto px-4 sm:px-8 lg:px-16 mt-0 sm:mt-0 pt-28 sm:pt-24 lg:pt-36 pb-2 flex flex-col items-center text-center z-10">

          {/* Rating Pill Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 sm:px-5 sm:py-2 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-white text-xs sm:text-sm mb-3 sm:mb-6 shadow-sm"
          >
            <div className="flex items-center gap-0.5">
              <Star className="w-3.5 h-3.5 text-white fill-white" />
              <Star className="w-3.5 h-3.5 text-white fill-white" />
              <Star className="w-3.5 h-3.5 text-white fill-white" />
              <Star className="w-3.5 h-3.5 text-white fill-white" />
              <Star className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-medium text-white/95">4.9/5 from 1k reviews</span>
          </motion.div>

          {/* Main Hero Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-[36px] sm:text-5xl lg:text-[84px] font-semibold tracking-tight font-landing-title max-w-5xl text-white leading-[1.12] sm:leading-tight text-center mb-3 sm:mb-6 drop-shadow-sm px-2"
          >
            Everything Your <br className="hidden sm:inline" />
            Health Has to Say
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="max-w-md px-2 text-center text-[rgba(255,255,255,0.80)] text-base sm:text-xl lg:text-[28px] not-italic font-normal leading-[150%] sm:leading-[140%] font-landing-body mb-4 sm:mb-8 sm:max-w-2xl lg:max-w-4xl"
          >
            Take Health brings your lab reports, daily habits and long-term trends into one place,
            and explains what they actually mean — so you always know what to do next.
          </motion.p>

          {/* Start For Free CTA Button & No Credit Card Text */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col items-center gap-1.5 mb-4 sm:mb-8 w-full"
          >
            <Link
              to="/waitlist"
              className="w-full max-w-[280px] sm:w-auto sm:px-12 py-3.5 bg-white hover:bg-white/90 text-[#1B47B9] font-bold text-base sm:text-lg rounded-full transition-all transform hover:scale-105 active:scale-95 shadow-xl border border-white text-center inline-block"
            >
              Start for Free
            </Link>
            <span className="text-white text-xs sm:text-sm font-semibold tracking-wide">
              *No Credit Card Required
            </span>
          </motion.div>

          {/* Spacer so the Hand holding Phone graphic sits cleanly below without overlapping text */}
          <div className="w-full h-[480px] sm:h-[620px] lg:h-[780px]" />
        </div>
      </div>

      {/* ─── BOTTOM THREE CARDS / STATS BAR SECTION ─── */}
      <div
        className="w-full border-t border-slate-200/60 z-20 relative bg-[#FAF9F8] py-8 sm:py-10 px-6 sm:px-12"
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-14 lg:gap-20 text-center sm:text-left">

          {/* Card 1: 20+ Years */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="18" viewBox="0 0 10 18" fill="none">
              <path d="M0.350098 16.6846H8.92608M0.350098 0.349976H8.92608M7.70094 16.6846V13.2772C7.70087 12.844 7.57175 12.4286 7.34197 12.1224L4.63809 8.5173M4.63809 8.5173L1.9342 12.1224C1.70443 12.4286 1.57531 12.844 1.57524 13.2772V16.6846M4.63809 8.5173L1.9342 4.91224C1.70443 4.60598 1.57531 4.19057 1.57524 3.75738V0.349976M4.63809 8.5173L7.34197 4.91224C7.57175 4.60598 7.70087 4.19057 7.70094 3.75738V0.349976" stroke="black" stroke-width="0.7" stroke-linecap="round"/>
            </svg>
            <div className="flex flex-col items-center sm:items-start">
              <span className="text-2xl sm:text-3xl font-semibold font-landing-title text-slate-900 tracking-tight leading-none">
                20+ Years
              </span>
              <span className="text-xs sm:text-sm font-Founders-Grotesk font-bold tracking-wider text-slate-600 uppercase mt-1">
                IN LONGEVITY SCIENCE
              </span>
            </div>
          </div>

          {/* Card 2: NSE & BSE Listed */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="23" height="23" viewBox="0 0 23 23" fill="none">
              <path d="M11.2 2.09998L2.80005 5.59998V11.9C2.80005 15.6333 5.60005 18.6666 11.2 21C16.8 18.6666 19.6 15.6333 19.6 11.9V5.59998L11.2 2.09998Z" stroke="black" stroke-width="0.63" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M7 11.2L9.8 14L15.4 8.40002" stroke="black" stroke-width="0.77" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <div className="flex flex-col items-center sm:items-start">
              <span className="text-2xl sm:text-3xl font-semibold font-landing-title text-slate-900 tracking-tight leading-none">
                NSE & BSE
              </span>
              <span className="text-xs sm:text-sm font-Founders-Grotesk font-bold tracking-wider text-slate-600 uppercase mt-1">
                LISTED COMPANY
              </span>
            </div>
          </div>

          {/* Card 3: 5000+ Happy Users */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="23" viewBox="0 0 26 23" fill="none">
              <circle cx="12.915" cy="5.60005" r="2.485" stroke="black" stroke-width="0.63" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M5.21509 19.6C5.21509 15.8667 7.78175 14 12.9151 14C18.0484 14 20.6151 15.8667 20.6151 19.6" stroke="black" stroke-width="0.63" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="5.21499" cy="7.00002" r="1.785" stroke="black" stroke-width="0.63" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M0.314941 19.6C0.314941 16.5667 1.94827 15.05 5.21494 15.05" stroke="black" stroke-width="0.63" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="20.6151" cy="7.00002" r="1.785" stroke="black" stroke-width="0.63" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M20.615 15.05C23.8817 15.05 25.515 16.5667 25.515 19.6" stroke="black" stroke-width="0.63" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <div className="flex flex-col items-center sm:items-start">
              <span className="text-2xl sm:text-3xl font-semibold font-landing-title text-slate-900 tracking-tight leading-none">
                5000+
              </span>
              <span className="text-xs sm:text-sm font-Founders-Grotesk font-bold tracking-wider text-slate-600 uppercase mt-1">
                HAPPY USERS
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default UpdatedHero;
