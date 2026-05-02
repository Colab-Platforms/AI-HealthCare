import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpLeft, ArrowUpRight } from "lucide-react";

const preserve3d = {
  transformStyle: "preserve-3d",
  WebkitTransformStyle: "preserve-3d",
};

const backfaceHidden = {
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
};

const PotentialItem = ({ src, alt, title, subTitle, description, onFlip }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleClick = () => {
    const next = !isFlipped;
    setIsFlipped(next);
    onFlip?.(next);
  };

  return (
    <div
      className="relative w-72 h-96 md:w-72 md:h-96 cursor-pointer group flex-shrink-0"
      style={{ perspective: "1000px", WebkitPerspective: "1000px" }}
      onClick={handleClick}
    >
      <motion.div
        className="w-full h-full relative"
        style={preserve3d}
        initial={false}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{
          duration: 0.6,
          type: "spring",
          stiffness: 260,
          damping: 20,
        }}
      >
        {/* ── Front Side ─────────────────────────────────────────────────── */}
        <div
          className="absolute inset-0 bg-landing-secondary rounded-2xl overflow-hidden shadow-lg border border-white/10"
          style={backfaceHidden}
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
            <div className="w-10 h-10 rounded-full  flex items-center justify-center bg-white/20 backdrop-blur-sm group-hover:bg-white/30 transition-colors">
              <ArrowUpLeft size={16} className="text-white" />
            </div>
          </div>
        </div>

        {/* ── Back Side ──────────────────────────────────────────────────── */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden p-6 flex flex-col justify-center items-start text-white border border-white/20 shadow-xl"
          style={{
            ...backfaceHidden,
            transform: "rotateY(180deg)",
            WebkitTransform: "rotateY(180deg)",
          }}
        >
          <h3 className="font-landing-title text-xl font-semibold mb-3 text-[#4d867c]">
            {title}
          </h3>
          <p className="text-base font-medium text-gray-800 mb-4 text-balance">
            {subTitle}
          </p>
          <p className="text-sm text-gray-800 leading-relaxed font-light">
            {description}
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default PotentialItem;
