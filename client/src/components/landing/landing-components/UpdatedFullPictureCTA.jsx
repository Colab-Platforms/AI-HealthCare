import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const UpdatedFullPictureCTA = ({ bgImage = "" }) => {
  const defaultBg = "/updated-landing/image.png";
  const imageSource = bgImage || defaultBg;

  return (
    <section className="w-full bg-[#FAF9F8] py-8 sm:py-16 lg:py-20 px-4 sm:px-8 lg:px-12 font-landing-body border-b border-slate-200/50">
      <div className="max-w-[1800px] mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full rounded-[28px] sm:rounded-[36px] lg:rounded-[44px] overflow-hidden min-h-[460px] sm:min-h-[580px] lg:min-h-[660px] flex items-center justify-center text-center shadow-2xl p-6 sm:p-12 border border-slate-200/60"
        >
          {/* Background Image */}
          <img
            src={imageSource}
            alt="Start Seeing The Full Picture"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />

          {/* Dark Overlay gradient for contrast & readability */}
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[0.5px]" />

          {/* Centered Content Container */}
          <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center justify-center text-white px-4">

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-3xl sm:text-5xl lg:text-[68px] font-medium font-landing-title text-center text-white leading-tight mb-4 drop-shadow-xl tracking-tight"
            >
              Start Seeing The Full Picture.
            </motion.h2>

            {/* Subtitle / Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base sm:text-xl text-white font-medium mb-8 max-w-xl drop-shadow-md"
            >
              Grounded in your biology. Built around you.
            </motion.p>

            {/* Two Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 mb-6"
            >
              {/* Primary Button */}
              <Link
                to="/register"
                className="px-8 py-3.5 bg-white text-slate-900 font-bold text-sm sm:text-base rounded-full hover:bg-slate-100 transition-all transform hover:scale-105 active:scale-95 shadow-2xl"
              >
                Start For Free
              </Link>

              {/* Secondary Button */}
              <a
                href="https://github.com/patilabhiraj/take-health-download/releases/download/v1.0.0/Take.Health.apk"
                className="px-8 py-3.5 bg-black/40 hover:bg-black/60 text-white font-semibold text-sm sm:text-base rounded-full border border-white/40 backdrop-blur-md transition-all transform hover:scale-105 active:scale-95 shadow-2xl"
              >
                Download Android APK
              </a>
            </motion.div>

            {/* Small Green Description Note */}
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-xs sm:text-sm font-bold text-emerald-400 tracking-wide drop-shadow-md"
            >
              Coming soon on Play Store & App Store
            </motion.p>

          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default UpdatedFullPictureCTA;
