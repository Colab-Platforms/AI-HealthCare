import PotentialItem from "./PotentialItem";
import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

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
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
};

const Potential = () => {
  const [isMobile] = useState(() => isMobileDevice());
  const sectionRef = useRef(null);
  const potentialItems = [
    {
      title: "CoreGrid",
      subTitle: "All your health dimensions, mapped together",
      description:
        "Connect and visualize your body’s key health signals in one unified system, revealing how everything works together",
      src: "/landing/potential/core-grid.webp",
      alt: "CoreGrid",
    },
    {
      title: "HealthLens",
      subTitle: "Refined Lab Intelligence",
      description:
        "Build a clear understanding of your health through connected biomarkers and intelligent analysis, translating complex data into meaningful insights.",
      src: "/landing/potential/health-lens.webp",
      alt: "HealthLens",
    },
    {
      title: "RiskSense",
      subTitle: "Flag abnormal health markers early",
      description:
        "Identify early deviations in key health markers using predictive intelligence, enabling timely awareness and proactive health decisions.",
      src: "/landing/potential/risk-sense.webp",
      alt: "RiskSense",
    },
    {
      title: "DeficiencyDetection",
      subTitle: "Reveal hidden nutrient gaps",
      description:
        "Uncover underlying nutritional gaps through data-driven analysis of your reports, helping restore balance and support optimal function.",
      src: "/landing/potential/deficiency-detection.webp",
      alt: "DeficiencyDetection",
    },
    {
      title: "NutriPath",
      subTitle: "Plans tailored to your health profile",
      description:
        "Personalized nutrition strategies derived from your biological data, designed to align with your body’s needs and long-term health goals.",
      src: "/landing/potential/nutri-path.webp",
      alt: "NutriPath",
    },
    {
      title: "VitalSync",
      subTitle: "Track your steps and hydration",
      description:
        "Continuously track and interpret changes across your reports, revealing patterns and trends that shape your overall health trajectory.",
      src: "/landing/potential/vital-sync.webp",
      alt: "VitalSync",
    },
  ];

  const radius = isMobile ? 1300 : 3750;

  const ITEM_SPACING_DEG = isMobile ? 22 : 5.5;
  const BUFFER_DEG = 25;

  const halfVW = isMobile ? 220 : 560;
  const visibleHalfAngle =
    (Math.asin(Math.min(halfVW / radius, 1)) * 180) / Math.PI;

  const contentCycleDeg = potentialItems.length * ITEM_SPACING_DEG;

  const rightEdge = visibleHalfAngle + BUFFER_DEG;
  const leftEdge = -(visibleHalfAngle + BUFFER_DEG);

  const totalSpanNeeded = rightEdge + contentCycleDeg - leftEdge;
  const rawNumItems = Math.ceil(totalSpanNeeded / ITEM_SPACING_DEG) + 1;

  const numItems =
    Math.ceil(rawNumItems / potentialItems.length) * potentialItems.length;

  const arcStartAngle = rightEdge + contentCycleDeg;

  const circleItems = Array.from({ length: numItems }).map((_, i) => ({
    ...potentialItems[i % potentialItems.length],
    angleDeg: arcStartAngle - i * ITEM_SPACING_DEG,
  }));
  // Direct duration: smaller = faster. Mobile: 45s (midway), Desktop: 30s
  const animDuration = isMobile ? 45 : 30;

  const [isHovered, setIsHovered] = useState(false);
  const flippedCount = useRef(0);
  const isInView = useInView(sectionRef, { margin: "200px 0px" });
  const shouldAnimate = isInView && !isHovered;

  const handleFlip = (isNowFlipped) => {
    flippedCount.current += isNowFlipped ? 1 : -1;
    setIsHovered(flippedCount.current > 0);
  };

  return (
    <motion.section
      {...fadeIn}
      className="mx-auto pb-0 lg:pb-20 overflow-hidden relative"
    >
      <style>
        {`
          @keyframes arc-marquee {
            from { transform: rotate(0deg); }
            to   { transform: rotate(-${contentCycleDeg}deg); }
          }
        `}
      </style>

      <motion.div
        {...fadeUp}
        className="flex justify-center text-center items-center relative z-10 pb-6"
      >
        <h2 className="font-landing-title text-2xl md:text-4xl font-semibold">
          <span className="text-landing-primary-hover block italic font-semibold my-2">
            PHI
          </span>
          Track. Adapt. Win.
        </h2>
      </motion.div>

      <motion.div
        ref={sectionRef}
        {...fadeIn}
        className="relative w-full h-[450px] md:h-[550px] mt-10 mb-48 md:mb-0 pointer-events-none"
      >
        <div
          className="absolute left-1/2"
          style={{
            top: `${radius + 40}px`,
            width: "0px",
            height: "0px",
          }}
        >
          <div
            style={{
              animation: `arc-marquee ${animDuration}s linear infinite`,
              animationPlayState: shouldAnimate ? "running" : "paused",
              width: "0px",
              height: "0px",
              willChange: shouldAnimate ? "transform" : "auto",
            }}
          >
            {circleItems.map((item, index) => {
              const angle = item.angleDeg;
              return (
                <div
                  key={index}
                  className="absolute"
                  style={{
                    left: "0px",
                    top: `-${radius}px`,
                    transformOrigin: `0 ${radius}px`,
                    transform: `rotate(${angle}deg)`,
                  }}
                >
                  <div
                    className="relative -translate-x-1/2 pointer-events-auto"
                    onMouseEnter={
                      isMobile ? undefined : () => setIsHovered(true)
                    }
                    onMouseLeave={
                      isMobile ? undefined : () => setIsHovered(false)
                    }
                  >
                    <PotentialItem
                      {...item}
                      onFlip={isMobile ? handleFlip : undefined}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-center gap-5 flex-col-reverse md:flex-row md:gap-32 items-center absolute md:-bottom-20 -bottom-48 left-0 right-0 mx-auto">
          <div className="flex justify-center items-center gap-5 md:gap-10 mt-3 md:mt-0">
            <p className="text-landing-text flex flex-col justify-center items-center gap-1">
              <span className="text-xl lg:text-4xl font-bold font-landing-title">
                20+
              </span>
              <span className="text-landing-text text-center text-xs lg:text-base lg:max-w-full max-w-20 mx-auto">
                Years in Life Sciences
              </span>
            </p>
            <hr className="w-12 h-0 rotate-90 max-sm:block hidden" />

            <p className="text-landing-text flex flex-col justify-center items-center gap-1">
              <span className="text-xl lg:text-4xl font-bold font-landing-title">
                NSE & BSE
              </span>
              <span className="text-landing-text text-center text-xs lg:text-base lg:max-w-full max-w-20 mx-auto">
                Listed Company
              </span>
            </p>
          </div>
          <hr className="w-16 rotate-90 max-sm:hidden" />
          <p className="max-w-md font-semibold text-sm md:text-xl text-balance text-center mx-auto lg:mx-0 ">
            TAKE Solutions Limited is an AI-powered, company building smart
            solutions for life.
          </p>
        </div>
      </motion.div>
    </motion.section>
  );
};

export default Potential;
