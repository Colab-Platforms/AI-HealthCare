import React from "react";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
};

export const AboutParagraph = () => {
  return (
    <section className="container mx-auto px-5 md:px-16 lg:px-32 mt-32">
      <motion.div
        {...fadeUp}
        className="max-w-[1863px] mx-auto text-center flex flex-col justify-center items-center"
      >
        <div className="w-full text-center capitalize word-wrap break-word text-xl md:text-2xl lg:text-4xl leading-[1.4] text-[#000000]">
          <div className="font-landing-body font-normal">
            Taking control of your health shouldn’t feel confusing.
          </div>
          <div className="font-landing-body font-normal mt-2">
            Over
            <span className="inline-flex conatiner mx-auto relative w-[54px] lg:w-[130px] h-[24px] lg:h-[50px] bg-[#104747] flex justify-center items-center rounded-[40px] mx-2 lg:mx-2 -rotate-[7deg] align-middle overflow-hidden shadow-sm translate-y-[-4px] lg:translate-y-[-8px]">
              <div className="">
                <img
                  src="/landing/about/virusss.webp"
                  alt="virus icon"
                  className="w-4 h-4 lg:w-10 lg:h-10"
                // style={{ width: 32, height: 32, left: 11.05, top: 10, position: 'absolute' }}
                />
              </div>
              <div className="">
                <span className="font-landing-body text-sm lg:text-4xl text-center w-5 h-5 lg:w-10 lg:h-10 text-white">
                  70%
                </span>
              </div>
            </span>
            of people struggle with hidden
            <span className="relative inline-block px-1 mx-1">
              deficiencies
              <svg
                className="absolute -inset-x-2 lg:-inset-x-6 -inset-y-1 lg:-inset-y-3 w-[calc(100%+16px)] lg:w-[calc(100%+48px)] h-[calc(100%+8px)] lg:h-[calc(100%+24px)] text-[#000000] pointer-events-none"
                viewBox="0 0 240 80"
                preserveAspectRatio="none"
              >
                <ellipse
                  cx="120"
                  cy="40"
                  rx="100"
                  ry="30"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  transform="rotate(-3, 120, 40)"
                />
              </svg>
            </span>
            and unclear health guidance often without realizing the root cause.
          </div>
          <div className="text-[#104747] font-landing-title font-medium leading-[26.76px] lg:leading-[74.33px] mt-6 lg:mt-12">
            Take Health was built to change that.
          </div>
        </div>
      </motion.div>
    </section>
  );
};
