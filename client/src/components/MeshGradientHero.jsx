import { MeshGradient } from "@paper-design/shaders-react";
import { useEffect, useState } from "react";

export default function MeshGradientHero({ children, className = "" }) {
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const update = () =>
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Healthcare-themed colors (cyan, blue, green tones)
  const colors = [
    "#72b9bb", // Cyan
    "#b5d9d9", // Light cyan
    "#8cc5b8", // Teal
    "#dbf4a4", // Light green
    "#ffd1bd", // Peach
    "#ffebe0", // Light peach
  ];

  return (
    <section className={`relative w-full overflow-hidden ${className}`}>
      {/* Mesh Gradient Background - Only in this section */}
      <div className="absolute inset-0 w-full h-full">
        {mounted && (
          <>
            <MeshGradient
              width={dimensions.width}
              height={dimensions.height}
              colors={colors}
              distortion={0.8}
              swirl={0.6}
              grainMixer={0}
              grainOverlay={0}
              speed={0.42}
              offsetX={0.08}
            />
            {/* Subtle overlay for better text readability */}
            <div className="absolute inset-0 pointer-events-none bg-white/10" />
          </>
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 w-full">
        {children}
      </div>
    </section>
  );
}
