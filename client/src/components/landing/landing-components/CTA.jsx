import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
};

const fadeIn = {
  initial: { opacity: 0 },
  whileInView: { opacity: 1 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
};

const CTA = () => {
  return (
    <section>
      <motion.div {...fadeIn} className="relative mt-24 z-0">
        <img src="/landing/CTA/bg.webp" className="w-full h-full z-0" alt="" />
        <div className="absolute inset-0 bg-black/60 z-0"></div>
        <img
          src="/landing/CTA/cards.svg"
          alt=""
          className="w-full h-full absolute inset-0 -top-44 z-0"
        />
        <img
          src="/landing/CTA/bg-pop.webp"
          className="w-full h-full absolute inset-0 z-0"
          alt=""
        />

        <div className="absolute bottom-0 bg-gradient-to-t from-landing-primary to-transparent w-full h-64 z-50 flex items-end justify-center gap-5">
          <button className="bg-landing-secondary text-landing-text bg-landing-accent-bg font-landing-title text-xl py-4 px-8 rounded-full hover:bg-landing-tertiary transition-colors duration-300">
            <Link to="/get-started" className="flex items-center gap-2">
              Start testing
            </Link>
          </button>
          <button
            className="
  bg-white/10 
  backdrop-blur-md 
  border border-white/20
  text-white
  font-landing-title text-xl 
  py-4 px-8 
  rounded-full 
  hover:bg-white/20 
  transition-all duration-300
"
          >
            <Link to="/get-started" className="flex items-center gap-2">
              Know More
            </Link>
          </button>
        </div>
      </motion.div>

      <motion.div {...fadeIn} className="bg-landing-primary pt-24 z-50">
        <div className="container mx-auto flex text-center items-center px-5">
          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.05 }}
            className="w-[35%] flex flex-col gap-8"
          >
            <h3 className="text-landing-light-bg font-landing-title text-4xl text-balance">
              We Tell You What Your Body’s Been Trying To Say
            </h3>
            <p className="text-landing-light-bg w-1/2 mx-auto text-balance">
              Science-backed. Biology-driven. Personalized plans designed for
              your body’s exact needs.
            </p>
          </motion.div>
          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.12 }}
            className="w-[30%] flex justify-center"
          >
            <img src="/landing/CTA/phone.png" alt="phone" />
          </motion.div>
          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.18 }}
            className="w-[35%] flex flex-col gap-8"
          >
            <h3 className="text-landing-light-bg font-landing-title text-4xl text-balance">
              Built to Guide You Daily
            </h3>
            <p className="text-landing-light-bg w-1/2 mx-auto text-balance">
              We interpret a broad spectrum of biomarkers to identify early
              signals and support timely, personalised care.
            </p>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};

export default CTA;
