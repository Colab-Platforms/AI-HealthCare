import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const fadeIn = {
  initial: { opacity: 0 },
  whileInView: { opacity: 1 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
};

const fadeUp = {
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
};

const CTA = () => {
  return (
    <motion.section
      {...fadeIn}
      className="container mx-auto py-24 px-5 lg:px-20 overflow-hidden flex flex-col lg:flex-row justify-between items-center"
    >
      <motion.div
        {...fadeUp}
        transition={{ ...fadeUp.transition, delay: 0.05 }}
        className="lg:w-1/2"
      >
        <img src="/how-works/cta.webp" alt="" />
      </motion.div>
      <motion.div
        {...fadeUp}
        transition={{ ...fadeUp.transition, delay: 0.12 }}
        className="lg:w-1/2 pt-8 lg:pt-0"
      >
        <motion.h2
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.18 }}
          className=" text-2xl md:text-4xl/[3.2rem] text-balance"
        >
          Better health starts with knowing. And knowing starts here.{" "}
          <span className="font-landing-title text-landing-primary-hover italic">
            Take Health
          </span>
        </motion.h2>
        <motion.p
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.24 }}
          className="lg:text-lg text-landing-text/80 mt-4 text-balance"
        >
          Seamlessly experience clarity, precision, and control over your
          evolving health.
        </motion.p>
        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.3 }}
        >
          <Link to="/register">
            <button className="px-6 py-2 mt-5 bg-landing-primary text-white uppercase font-landing-accent rounded-md hover:bg-landing-primary-hover transition">
              GET STARTED
            </button>
          </Link>
        </motion.div>
      </motion.div>
    </motion.section>
  );
};

export default CTA;
