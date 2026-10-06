import React from "react";
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
              className="flex flex-wrap items-center justify-center gap-3 sm:gap-5"
            >
              <a
                href="https://apps.apple.com/in/app/take-health/id6809424667"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Download on the App Store"
                className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5 sm:py-3 bg-white hover:bg-white/90 text-black rounded-xl transition-all transform hover:scale-105 active:scale-95 shadow-2xl"
              >
                <img src="/updated-landing/Apple.svg" alt="" className="h-6 sm:h-8 w-auto" />
                <span className="flex flex-col items-start leading-tight text-left">
                  <span className="text-[9px] sm:text-xs font-medium">Download on the</span>
                  <span className="text-base sm:text-xl font-semibold">App Store</span>
                </span>
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=com.takehealth.app"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Get it on Google Play"
                className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5 sm:py-3 bg-white hover:bg-white/90 text-black rounded-xl transition-all transform hover:scale-105 active:scale-95 shadow-2xl"
              >
                <img src="/updated-landing/Playstore.svg" alt="" className="h-6 sm:h-8 w-auto" />
                <span className="flex flex-col items-start leading-tight text-left">
                  <span className="text-[9px] sm:text-xs font-medium">GET IT ON</span>
                  <span className="text-base sm:text-xl font-semibold">Google Play</span>
                </span>
              </a>
            </motion.div>

          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default UpdatedFullPictureCTA;
