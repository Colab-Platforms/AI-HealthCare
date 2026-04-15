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
    <section className="bg-landing-light-bg pt-[100px] lg:pt-[230px] px-[20px] lg:ml-[20px] lg:mr-[37px]">
      <motion.div
        {...fadeUp}
        className="max-w-[1863px] mx-auto text-center flex flex-col justify-center items-center"
      >
        <div className="w-full text-center capitalize word-wrap break-word text-[18px] lg:text-[50px] leading-[1.4] text-[#000000]">
          <div className="font-landing-body font-normal">
            Taking control of your health shouldn’t feel confusing.
          </div>
          <div className="font-landing-body font-normal mt-2">
            Over
            <span className="inline-flex relative w-[54px] lg:w-[140px] h-[24px] lg:h-[60px] bg-[#104747] rounded-[40px] mx-1 lg:mx-2 -rotate-[7deg] align-middle overflow-hidden shadow-sm translate-y-[-4px] lg:translate-y-[-8px]">
              <img
                src="/landing/about/virusss.webp"
                alt="virus icon"
                className="absolute"
                style={{
                  width: '12px', height: '12px', left: '4px', top: '7px',
                  '--lg-width': '32px', '--lg-height': '32px', '--lg-left': '11.05px', '--lg-top': '18px'
                }}
              // We'll use classes for the responsive bits instead of style vars for simplicity
              />
              {/* Responsive Icon placement */}
              <div className="hidden lg:block">
                <img
                  src="/landing/about/virusss.webp"
                  alt="virus icon"
                  style={{ width: 32, height: 32, left: 11.05, top: 18, position: 'absolute' }}
                />
              </div>
              <div className="lg:hidden">
                <img
                  src="/landing/about/virusss.webp"
                  alt="virus icon"
                  style={{ width: 14, height: 14, left: 4, top: 5, position: 'absolute' }}
                />
              </div>

              <span className="font-landing-title absolute text-white font-medium"
                style={{
                  left: '20px', top: '4px', fontSize: '12px', transform: 'rotate(-3deg)',
                  '--lg-left': '52px', '--lg-top': '12px', '--lg-font-size': '32px'
                }}
              >
                70%
              </span>
              {/* Responsive text placement */}
              <div className="hidden lg:block">
                <span className="font-landing-title" style={{ left: 52, top: 12, position: 'absolute', transform: 'rotate(-3deg)', color: 'white', fontSize: 32, fontWeight: '500' }}>
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
            and <br className="hidden lg:block" /> unclear health guidance often without realizing the root cause.
          </div>
          <div className="text-[#104747] font-landing-title font-medium leading-[26.76px] lg:leading-[74.33px] mt-6 lg:mt-12">
            Take Health was built to change that.
          </div>
        </div>
      </motion.div>
    </section>
  );
};
