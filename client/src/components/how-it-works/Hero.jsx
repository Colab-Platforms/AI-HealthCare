import React from "react";
import { motion } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
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
  show: { opacity: 1, transition: { duration: 1.2, ease: "easeInOut" } },
};

const Hero = () => {
  return (
    <motion.section
      initial="hidden"
      animate="show"
      variants={bgFade}
      className="relative z-10 h-screen flex items-center justify-center text-center  overflow-hidden"
    >
      <motion.div
        variants={bgFade}
        className="w-full h-full overflow-hidden absolute inset-0"
      >
        <img
          src="/how-works/hero.webp"
          alt=""
          className="object-cover object-top w-full h-screen"
        />
      </motion.div>

      <motion.div
        className="container px-5 lg:px-20 mx-auto relative z-10 text-white pb-72"
        variants={container}
      >
        <motion.h1
          variants={item}
          className="text-3xl lg:text-6xl text-white font-landing-accent-2 text-balance"
        >
          Uncover Hidden Health Risks
        </motion.h1>
        <motion.p
          variants={item}
          className="text-xl lg:text-3xl font-extralight text-landing-light-bg mt-1 font-landing-accent max-w-4xl mx-auto capitalize mb-5 text-balance"
        >
          1,000+ Health Markers Analyzed.
        </motion.p>
      </motion.div>
    </motion.section>
  );
};

export default Hero;
