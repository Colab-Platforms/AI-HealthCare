import PotentialItem from "./PotentialItem";
import React, { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

function isIOSSafari() {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const touchPoints = navigator.maxTouchPoints || 0;

  const isIOS =
    /iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && touchPoints > 1);
  const isSafari =
    /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS|Android/.test(ua);

  return isIOS && isSafari;
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
  const [isIOS] = useState(() => isIOSSafari());
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

  const radius = isIOS ? 1300 : 3750;
  const numItems = isIOS ? 24 : 65;
  const angleStep = 360 / numItems;
  const circleItems = Array.from({ length: numItems }).map(
    (_, i) => potentialItems[i % potentialItems.length],
  );

  const [isHovered, setIsHovered] = useState(false);
  const isInView = useInView(sectionRef, { margin: "200px 0px" });
  const shouldAnimate = isInView && !isHovered;

  return (
    <motion.section
      {...fadeIn}
      className="mx-auto pb-0 lg:pb-24 overflow-hidden relative"
    >
      <style>
        {`
          @keyframes arc-marquee {
            from { transform: rotate(0deg); }
            to { transform: rotate(-360deg); }
          }
        `}
      </style>

      <motion.div
        {...fadeUp}
        className="flex justify-center text-center items-center relative z-10 pb-8"
      >
        <h2 className=" font-landing-title text-2xl md:text-4xl">
          Unlocking Human{" "}
          <span className="text-landing-primary-hover italic">Potential</span>
        </h2>
      </motion.div>

      <motion.div
        ref={sectionRef}
        {...fadeIn}
        className="relative w-full h-[450px] md:h-[550px] mt-10 pointer-events-none"
      >
        {/* The structural Wheel Anchor offset below the screen */}
        <div
          className="absolute left-1/2"
          style={{
            top: `${radius + 40}px`,
            width: "0px",
            height: "0px",
          }}
        >
          {/* The CSS rotating arm ensuring infinite smooth animation */}
          <div
            style={{
              animation: `arc-marquee ${isIOS ? 520 : 360}s linear infinite`,
              animationPlayState: shouldAnimate ? "running" : "paused",
              width: "0px",
              height: "0px",
              willChange: shouldAnimate ? "transform" : "auto",
            }}
          >
            {circleItems.map((item, index) => {
              const angle = index * angleStep;
              return (
                <div
                  key={index}
                  className="absolute"
                  style={{
                    left: "0px",
                    top: `-${radius}px`,
                    // The anchor is exactly rotated from the center base
                    transformOrigin: `0 ${radius}px`,
                    transform: `rotate(${angle}deg)`,
                  }}
                >
                  {/* Wrapper to center the item precisely on the geometric arm, preventing overlap offset */}
                  <div
                    className="relative -translate-x-1/2 pointer-events-auto"
                    onMouseEnter={isIOS ? undefined : () => setIsHovered(true)}
                    onMouseLeave={isIOS ? undefined : () => setIsHovered(false)}
                  >
                    {isIOS ? (
                      <div className="relative w-56 h-72 rounded-2xl overflow-hidden shadow-md border border-white/10">
                        <img
                          src={item.src}
                          alt={item.alt}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent p-4 flex flex-col justify-end text-center text-white">
                          <h3 className="font-landing-title text-lg font-semibold">
                            {item.title}
                          </h3>
                          <p className="mt-1 text-xs text-white/80">
                            {item.subTitle}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <PotentialItem {...item} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Seamless fading gradients for screen edges aligned to white background */}
        {/* <div className="absolute left-0 top-0 w-20 md:w-56 h-full bg-gradient-to-r from-white to-transparent pointer-events-none z-20"></div>
        <div className="absolute right-0 top-0 w-20 md:w-56 h-full bg-gradient-to-l from-white to-transparent pointer-events-none z-20"></div> */}
      </motion.div>
    </motion.section>
  );
};

export default Potential;
