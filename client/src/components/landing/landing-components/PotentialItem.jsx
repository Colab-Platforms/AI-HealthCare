import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

const PotentialItem = ({ src, alt, title, subTitle, description }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className="relative w-72 h-80 md:w-72 md:h-96 cursor-pointer group flex-shrink-0"
      style={{ perspective: "1000px" }}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div
        className="w-full h-full relative"
        style={{ transformStyle: "preserve-3d" }}
        initial={false}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{
          duration: 0.6,
          type: "spring",
          stiffness: 260,
          damping: 20,
        }}
      >
        {/* Front Side */}
        <div
          className="absolute inset-0 bg-landing-secondary rounded-2xl overflow-hidden shadow-lg border border-white/10"
          style={{ backfaceVisibility: "hidden" }}
        >
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-6 flex flex-col justify-end items-center text-center text-white pb-8">
            <h3 className="font-landing-title text-2xl font-semibold mt-4">
              {title}
            </h3>
            <p className="mt-2 text-sm text-gray-300 mb-4 text-balance">
              {subTitle}
            </p>
            <div className="w-8 h-8 rounded-full border border-white/30 flex items-center justify-center bg-black/40 backdrop-blur-sm group-hover:bg-white/20 transition-colors">
              <ArrowUpRight size={16} className="text-white" />
            </div>
          </div>
        </div>

        {/* Back Side */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#1c2c28] to-[#0a1110] rounded-2xl overflow-hidden p-6 flex flex-col justify-center items-center text-center text-white border border-white/20 shadow-xl"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <h3 className="font-landing-title text-2xl font-semibold mb-3 text-[#4d867c]">
            {title}
          </h3>
          <div className="w-12 h-1 bg-[#4d867c]/50 rounded mb-4"></div>
          <p className="text-sm md:text-base text-gray-300 leading-relaxed font-light">
            {description}
          </p>
          <div className="mt-6 text-xs text-gray-500 uppercase tracking-widest border border-gray-700 rounded-full px-4 py-1">
            Tap to flip
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PotentialItem;
