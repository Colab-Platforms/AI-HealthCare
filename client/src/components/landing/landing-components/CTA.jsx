import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import Marquee from "react-fast-marquee";
import { useMemo, useRef } from "react";

function isMobileDevice() {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
  ) {
    const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const hasNoHover = window.matchMedia("(hover: none)").matches;
    if (isCoarsePointer || hasNoHover) {
      return true;
    }
  }

  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const touchPoints = navigator.maxTouchPoints || 0;

  const isTouchTablet = platform === "MacIntel" && touchPoints > 1;
  const hasTouchOnlyInput = touchPoints > 0;
  const isMobileUA =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
      ua,
    );

  return isTouchTablet || hasTouchOnlyInput || isMobileUA;
}

const fadeUp = {
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
};

const fadeIn = {
  initial: { opacity: 0 },
  whileInView: { opacity: 1 },
  viewport: { once: true },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
};

const cards = [
  "/landing/CTA/card1.svg",
  "/landing/CTA/card2.svg",
  "/landing/CTA/card3.svg",
  "/landing/CTA/card4.svg",
  "/landing/CTA/card5.svg",
  "/landing/CTA/card6.svg",
  "/landing/CTA/card7.svg",
  "/landing/CTA/card8.svg",
];

const CTA = () => {
  const isMobile = isMobileDevice();
  const marqueeRef = useRef(null);
  const isMarqueeInView = useInView(marqueeRef, { margin: "180px 0px" });
  const marqueeCards = useMemo(
    () => (isMobile ? [...cards, ...cards] : cards),
    [isMobile],
  );

  return (
    <section>
      <motion.div {...fadeIn} className="relative mt-24 z-0 overflow-hidden">
        <img
          loading="lazy"
          decoding="async"
          src="/landing/CTA/bg.webp"
          className="w-full h-[400px] lg:h-full object-cover lg:w-full z-0"
          alt=""
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 bg-black/60 z-0"></div>

        <div
          ref={marqueeRef}
          className="absolute inset-x-0 top-14 lg:top-44 z-0 pointer-events-none [perspective:1300px]"
        >
          <div className="[transform:rotateX(10deg)_rotateY(15deg)] overflow-hidden w-[150%]">
            {isMobile ? (
              <>
                <style>
                  {`
                    @keyframes cta-marquee-scroll {
                      from { transform: translate3d(0, 0, 0); }
                      to { transform: translate3d(-50%, 0, 0); }
                    }
                  `}
                </style>
                <div className="overflow-hidden w-full">
                  <div
                    className="flex items-start gap-2 sm:gap-3"
                    style={{
                      width: "max-content",
                      alignItems: "flex-start",
                      animation: isMarqueeInView
                        ? "cta-marquee-scroll 28s linear infinite"
                        : "none",
                    }}
                  >
                    {[...cards, ...cards].map((card, index) => (
                      <img
                        key={`${card}-${index}`}
                        src={card}
                        alt={`card-${index + 1}`}
                        className="block w-28 lg:w-60 align-top"
                        loading="lazy"
                        decoding="async"
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <Marquee
                autoFill={!isMobile}
                speed={25}
                gradient={false}
                pauseOnHover={false}
                play={isMarqueeInView}
              >
                {marqueeCards.map((card, index) => (
                  <img
                    loading="lazy"
                    decoding="async"
                    key={`${card}-${index}`}
                    src={card}
                    alt={`card-${index + 1}`}
                    className="w-28 lg:w-60"
                  />
                ))}
              </Marquee>
            )}
          </div>
        </div>

        <img
          loading="lazy"
          decoding="async"
          src="/landing/CTA/bg-pop.webp"
          className="w-full h-[400px] lg:h-full object-cover lg:w-full absolute inset-0 z-60"
          alt=""
          width={1920}
          height={1080}
        />

        <div className="absolute -bottom-0 lg:-bottom-0 bg-gradient-to-t from-landing-primary to-transparent w-full h-24 lg:h-64 z-50 flex items-end justify-center gap-5">
          <button
            className="
          bg-landing-secondary 
          text-landing-text bg-landing-accent-bg font-landing-title lg:text-lg py-2 px-6 rounded-full hover:bg-landing-tertiary transition-colors duration-300 hidden md:flex"
          >
            <Link to="/register" className="flex items-center gap-2">
              Start testing
            </Link>
          </button>
          <button
            className="
              bg-white/10 
              backdrop-blur-md 
              border border-white/20
              text-white
              font-landing-title 
              lg:text-lg  
              py-2 px-6 
              rounded-full 
              hover:bg-white/20 
              transition-all duration-300 hidden md:flex
            "
          >
            <Link to="/register" className="flex items-center gap-2">
              Know More
            </Link>
          </button>
        </div>
      </motion.div>

      <motion.div {...fadeIn} className="bg-landing-primary pt-5 lg:pt-14 z-50">
        <div className="container mx-auto lg:flex text-center items-center px-5 lg:px-20 overflow-hidden">
          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.05 }}
            className="w-full lg:w-[35%] flex flex-col gap-8"
          >
            <h3 className="text-landing-light-bg font-landing-title text-2xl md:text-4xl text-balance">
              We Tell You What Your Body’s Been Trying To Say
            </h3>
            <p className="text-landing-light-bg lg:w-2/3 mx-auto text-balance">
              Science-backed. Biology-driven. Personalized plans designed for
              your body’s exact needs.
            </p>
          </motion.div>
          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.12 }}
            className="w-3/4 mx-auto lg:w-[30%] flex justify-center pt-2 md:pt-0 pb-6 md:pb-0 relative"
          >
            <img
              loading="lazy"
              decoding="async"
              src="/landing/CTA/phone.webp"
              alt="phone"
              width={300}
              height={600}
              className="w-56 md:w-4/5"
            />

            <div className="absolute bottom-5 left-0 w-full h-14 bg-gradient-to-t from-landing-primary to-transparent block md:hidden"></div>
          </motion.div>
          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.18 }}
            className="hidden w-full lg:w-[35%] lg:flex flex-col gap-8"
          >
            <h3 className="text-landing-light-bg font-landing-title text-4xl text-balance">
              Built to Guide You Daily
            </h3>
            <p className="text-landing-light-bg w-2/3 mx-auto text-balance">
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
