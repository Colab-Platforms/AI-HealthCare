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

  useEffect(() => {
    if (!isVideoReady || !videoRef.current) return;

    const playPromise = videoRef.current.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        // Ignore autoplay restriction failures; user interaction will allow playback later.
      });
    }
  }, [isVideoReady]);

  return (
    <motion.section
      initial="hidden"
      animate="show"
      variants={bgFade}
      className="relative z-10 h-screen flex items-center justify-center text-center pb-10 px-5 lg:px-20 overflow-hidden"
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
        preload="auto"
        onCanPlay={() => setIsVideoReady(true)}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
          isVideoReady ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* <source
          src="https://cdn.shopify.com/videos/c/o/v/d38ee290fc044331a38705af3a0bbe92.webm"
          type="video/webm"
        /> */}
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
          A Thoughtfully Designed Health App
        </motion.h1>
        <motion.p
          variants={item}
          className="text-md md:text-xl font-light tracking-wide text-landing-light-bg mt-4 font-landing-accent max-w-4xl mx-auto capitalize mb-5 text-balance"
        >
          Everything you need to understand and improve your health,
          track your progress, monitor key metrics, and get clear insights
          without the overwhelm.
        </motion.p>
        <motion.div variants={item}>
          <Link to="/register">
            <button className="px-8 py-2.5 bg-landing-primary text-white uppercase font-landing-accent rounded-full hover:bg-landing-primary-hover transition tracking-wider">
              Start Tracking
            </button>
          </Link>
        </motion.div>
      </motion.div>
    </motion.section>
  );
};

export default Hero;
