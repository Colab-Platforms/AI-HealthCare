import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";

const UpdatedWellnessIntelligence = ({ videoSrc = "" }) => {
  const defaultVideo = "/updated-landing/bg-video.mp4";
  const activeVideoSrc = videoSrc || defaultVideo;
  const videoRef = useRef(null);

  useEffect(() => {
    if (activeVideoSrc && videoRef.current) {
      videoRef.current.play().catch(() => { });
    }
  }, [activeVideoSrc]);

  return (
    <section className="w-full bg-[#FFFFFF] py-12 sm:py-24 lg:py-28 px-4 sm:px-12 flex items-center justify-center text-center font-landing-body border-b border-slate-200/50">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        className="max-w-7xl lg:max-w-9xl mx-auto text-[#000] text-3xl sm:text-5xl lg:text-[60px] font-medium font-landing-title text-center leading-[1.15] sm:leading-[1.18] flex flex-col gap-1 sm:gap-1.5"
      >
        {/* Line 1: Heading */}
        <div>
          This is <span className="text-[#014343] font-bold">Wellness Intelligence</span>
        </div>

        {/* Line 2: Subheading */}
        <div>
          Not another tracker. A way to finally know
        </div>

        {/* Line 3: Body text with Inline Video Container */}
        <div className="flex flex-wrap items-center justify-center gap-x-2">
          <span>what your body's</span>

          {/* Inline Video Pill Container */}
          <span
            className="inline-flex items-center justify-center align-middle w-16 sm:w-32 lg:w-32 h-10 sm:h-[54px] lg:h-[64px] rounded-full overflow-hidden shadow-md relative mx-1.5 sm:mx-2 transition-all hover:scale-105"
          >
            <video
              ref={videoRef}
              src={activeVideoSrc}
              loop
              muted
              playsInline
              autoPlay
              className="w-full h-full object-cover rounded-full"
            />
          </span>

          <span>data has been</span>
        </div>

        {/* Line 4 */}
        <div>
          telling you all along.
        </div>
      </motion.div>
    </section>
  );
};

export default UpdatedWellnessIntelligence;
