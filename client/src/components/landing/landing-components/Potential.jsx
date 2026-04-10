import PotentialItem from "./PotentialItem";
import React, { useState } from "react";
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

const Potential = () => {
  const potentialItems = [
    {
      title: "CoreGrid",
      subTitle: "All your health dimensions, mapped together",
      description:
        "Get a comprehensive view of your overall wellness by tracking and correlating multiple health metrics simultaneously in one unified grid.",
      src: "/landing/potential/core-grid.webp",
      alt: "CoreGrid",
    },
    {
      title: "HealthLens",
      subTitle: "Refined Lab Intelligence",
      description:
        "Decode complex laboratory results into easily understandable insights, highlighting core areas of focus for your long-term vitality.",
      src: "/landing/potential/health-lens.webp",
      alt: "HealthLens",
    },
    {
      title: "RiskSense",
      subTitle: "Flag abnormal health markers early",
      description:
        "Proactively identify subtle deviations in your health data to prevent potential issues before they develop into serious conditions.",
      src: "/landing/potential/risk-sense.webp",
      alt: "RiskSense",
    },
    {
      title: "DeficiencyDetection",
      subTitle: "Reveal hidden nutrient gaps",
      description:
        "Analyze your dietary and biomarker data to pinpoint exactly which essential vitamins and minerals your body might be lacking.",
      src: "/landing/potential/deficiency-detection.webp",
      alt: "DeficiencyDetection",
    },
    {
      title: "NutriPath",
      subTitle: "Plans tailored to your health profile",
      description:
        "Receive dynamically adjusted nutritional recommendations based on your unique metabolic responses, goals, and lifestyle preferences.",
      src: "/landing/potential/nutri-path.webp",
      alt: "NutriPath",
    },
    {
      title: "VitalSync",
      subTitle: "Track your steps and hydration",
      description:
        "Seamlessly integrate your daily movement and fluid intake, ensuring you meet fundamental physiological needs effortlessly.",
      src: "/landing/potential/vital-sync.webp",
      alt: "VitalSync",
    },
  ];

  // Configure perfectly calculated continuous Ferris wheel mechanics for an arc marquee
  const radius = 3750; // Increased radius for a flatter, smaller arc effect
  const numItems = 60; // Reduced density for more space between items
  const angleStep = 360 / numItems;
  const circleItems = Array.from({ length: numItems }).map(
    (_, i) => potentialItems[i % potentialItems.length],
  );

  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.section
      {...fadeIn}
      className="mx-auto py-24 overflow-hidden relative"
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
        <h2 className=" font-landing-title text-3xl md:text-4xl">
          Unlocking Human{" "}
          <span className="text-landing-primary-hover italic">Potential</span>
        </h2>
      </motion.div>

      <motion.div
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
              animation: "arc-marquee 360s linear infinite", // Significantly slowed down movement
              animationPlayState: isHovered ? "paused" : "running",
              width: "0px",
              height: "0px",
              willChange: "transform",
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
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                  >
                    <PotentialItem {...item} />
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
