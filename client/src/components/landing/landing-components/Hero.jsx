import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
  },
};

const bgFade = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 1.5, ease: "easeInOut" } },
};

const Hero = () => {
  const videoRef = useRef(null);
  const [isVideoReady, setIsVideoReady] = useState(false);

  // ✅ Play video when ready
  useEffect(() => {
    if (!videoRef.current) return;

    const tryPlay = () => {
      const playPromise = videoRef.current.play();
      playPromise?.catch(() => {});
    };

    if (isVideoReady) {
      tryPlay();
    }

    // ✅ Fallback: ensure video attempts to play anyway
    const timeout = setTimeout(() => {
      tryPlay();
    }, 1200);

    return () => clearTimeout(timeout);
  }, [isVideoReady]);

  return (
    <motion.section
      initial="hidden"
      animate="show"
      variants={bgFade}
      className="relative z-10 h-[100dvh] flex items-center justify-center text-center pb-10 px-5 lg:px-20 overflow-hidden"
    >
      <img
        src="/landing/bg-back.jpg"
        alt="Healthy lifestyle"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
          isVideoReady ? "opacity-0" : "opacity-100"
        }`}
      />

      <video
        ref={videoRef}
        loop
        muted
        playsInline
        preload="metadata" // ✅ FIXED (was auto)
        onLoadedData={() => setIsVideoReady(true)} // ✅ more reliable than onCanPlay
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
          isVideoReady ? "opacity-100" : "opacity-0"
        }`}
      >
        <source
          src="https://cdn.shopify.com/videos/c/o/v/bf5d3425a43a49f98e4bc647c660ef7f.mp4"
          type="video/mp4"
        />
      </video>

      <div className="absolute inset-0 bg-black/40"></div>

      <motion.div
        className="relative z-10 flex flex-col items-center justify-center gap-2"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.h1
          variants={item}
          className="text-4xl md:text-6xl text-white font-landing-accent-2 text-balance"
        >
          Live Longer, Better
        </motion.h1>

        <motion.p
          variants={item}
          className="text-md md:text-xl font-light tracking-wide text-landing-light-bg mt-4 font-landing-accent max-w-4xl mx-auto capitalize mb-5 text-balance"
        >
          Access Personalized Health Insights, Anticipate Risks Early, And
          Enhance Your Longevity Through Advanced, Data-Driven Care.
        </motion.p>

        <motion.div variants={item}>
          <Link to="/register">
            <button className="px-8 py-2.5 bg-landing-primary text-white uppercase font-landing-accent rounded-full hover:bg-landing-primary-hover transition tracking-wider">
              Start For Free
            </button>
          </Link>
        </motion.div>

        
      </motion.div>

      <div className="absolute bottom-10 flex gap-2 lg:gap-10">
        <div className="flex items-center gap-0 ">
          <div>
            <img src="/landing/left_leaf.png" alt="" className="w-9 lg:w-12 h-auto" />
          </div>
          <div>
            <p className="text-white flex flex-col justify-center items-center gap-1">
              <span className="text-xl lg:text-4xl font-bold font-landing-title">20+</span>
              <span className="text-white text-center text-xs lg:text-sm lg:max-w-full max-w-20 mx-auto">Years in Life Sciences</span>
            </p>
          </div>
          <div>
            <img src="/landing/right_leaf.png" alt="" className="w-9 lg:w-12 h-auto" />
          </div>
        </div>
        <div className="flex items-center -gap-10 ">
          <div>
            <img src="/landing/left_leaf.png" alt="" className="w-9 lg:w-12 h-auto" />
          </div>
          <div>
            <p className="text-white flex flex-col justify-center items-center gap-1">
              <span className="text-base lg:text-3xl font-bold font-landing-title">NSE & BSE</span>
              <span className="text-white text-center text-xs lg:text-sm ">Listed Company</span>
            </p>
          </div>
          <div>
            <img src="/landing/right_leaf.png" alt="" className="w-9 lg:w-12 h-auto" />
          </div>
        </div>
      </div>
       

     
    </motion.section>
  );
};

export default Hero;