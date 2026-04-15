import React from "react";
import { motion } from "framer-motion";

const fadeIn = {
  initial: { opacity: 0 },
  whileInView: { opacity: 1 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1] },
};

const fadeUp = {
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
};

const SingleStep = ({ number, img, title, description, points, index = 0 }) => {
  return (
    <motion.section
      {...fadeIn}
      transition={{ ...fadeIn.transition, delay: Math.min(index * 0.05, 0.2) }}
      className="container mx-auto px-5 lg:px-20 overflow-hidden flex flex-col lg:flex-row items-center lg:justify-between gap-10 lg:h-screen lg:sticky top-0 bg-[#faf9f8] pb-10 lg:pb-0"
    >
      <motion.div
        {...fadeUp}
        transition={{ ...fadeUp.transition, delay: 0.05 }}
        className="lg:w-1/2"
      >
        <img src={img} alt={title} />
      </motion.div>
      <motion.div
        {...fadeUp}
        transition={{ ...fadeUp.transition, delay: 0.12 }}
        className="lg:w-1/2 flex flex-col items-start gap-4"
      >
        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.16 }}
          className="text-xs lg:text-sm font-medium text-white bg-landing-primary-hover py-1 px-3 rounded-sm"
        >
          {number}
        </motion.div>
        <motion.h3
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.2 }}
          className="text-2xl lg:text-4xl font-medium text-gray-800"
        >
          {title}
        </motion.h3>
        <motion.p
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.24 }}
          className="font-medium text-balance text-sm lg:text-base"
        >
          {description}
        </motion.p>
        <ul className="flex flex-col gap-2 leg-gap-1">
          {points.map((point, index) => (
            <motion.li
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.28 + index * 0.06 }}
              key={index}
              className="flex items-center gap-2 font-medium text-sm lg:text-base"
            >
              <img src="/how-works/check.svg" alt="" />
              <span>{point}</span>
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </motion.section>
  );
};

export default SingleStep;
