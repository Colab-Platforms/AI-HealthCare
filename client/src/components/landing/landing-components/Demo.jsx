import { ArrowRightIcon } from "lucide-react";
import { Link } from "react-router-dom";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useInView,
} from "framer-motion";
import { useRef, Suspense, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Environment } from "@react-three/drei";

function supportsWebGL() {
  if (typeof document === "undefined") return false;

  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

function Model({ scrollYProgress }) {
  const { scene } = useGLTF("/landing/demo/man-comp.glb");
  const modelRef = useRef();

  useFrame(() => {
    if (modelRef.current) {
      const scroll = scrollYProgress.get();
      // If the model looks to the side at 0 radians, we offset it by -90 degrees to face the camera
      const baseRotation = -Math.PI / 2;
      let targetRotation = baseRotation; // Face front

      if (scroll < 0.4) {
        // 0 to 0.4 : rotate from side to front
        targetRotation = baseRotation + ((0.4 - scroll) / 0.4) * (Math.PI / 2);
      } else if (scroll > 0.6) {
        // 0.6 to 1 : rotate from front to other side
        targetRotation = baseRotation - ((scroll - 0.6) / 0.4) * (Math.PI / 2);
      }

      // Smooth interpolation with easing
      modelRef.current.rotation.y +=
        (targetRotation - modelRef.current.rotation.y) * 0.08;
    }
  });

  return (
    <primitive
      ref={modelRef}
      object={scene}
      scale={6.5}
      position={[0, -3.5, 0]}
    />
  );
}

useGLTF.preload("/landing/demo/man-comp.glb");

const fadeUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
};

const fadeLeft = {
  initial: { opacity: 0, x: -50 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
};

const fadeRight = {
  initial: { opacity: 0, x: 50 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
};

const Demo = () => {
  const containerRef = useRef(null);
  const [hasWebGL] = useState(() => supportsWebGL());
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280,
  );

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const deviceType =
    viewportWidth < 768
      ? "mobile"
      : viewportWidth < 1024
        ? "tablet"
        : "desktop";
  const borderImageSrc =
    deviceType === "desktop"
      ? "/landing/demo/border.svg"
      : "/landing/demo/border-mob.svg";

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const isInView = useInView(containerRef, { margin: "400px 0px" });

  // Base rotations with slower paces and different directions
  const rotate1Raw = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const rotate2Raw = useTransform(scrollYProgress, [0, 1], [-45, -135]);

  // Apply spring physics for natural momentum and smooth stopping
  const springConfig = { damping: 25, stiffness: 60, mass: 1.2 };
  const rotate1 = useSpring(rotate1Raw, springConfig);
  const rotate2 = useSpring(rotate2Raw, springConfig);

  return (
    <section
      ref={containerRef}
      className="container mx-auto pb-24 lg:py-24 px-5 lg:px-20 overflow-hidden"
    >
      <motion.div
        {...fadeUp}
        className="flex justify-center text-center items-center"
      >
        <div>
          <h2 className="text-landing-primary-hover font-landing-title text-2xl md:text-4xl text-balance">
            Guidance That Moves With You
          </h2>
          <p className="lg:text-lg text-landing-text/80 mt-4 text-balance">
            A Smarter Way to Understand and Extend Your Longevity.
          </p>
        </div>
      </motion.div>

      <div className="flex justify-center flex-col items-center mt-36 lg:mt-64 relative">
        {/* interactive */}
        <motion.div
          {...fadeLeft}
          className="absolute left-0 top-[35%] -translate-y-1/2 hidden lg:block"
        >
          <h3 className="font-landing-title text-xl font-semibold max-w-10">
            Interactive Tool (Symptom Checker)
          </h3>
          <img
            src="/landing/demo/wave.png"
            alt="wave"
            className="w-10 h-10 mt-3"
          />
        </motion.div>

        <div className="relative">
          {/* border */}
          <motion.img
            initial={{ opacity: 0, scale: 1 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1 }}
            src={borderImageSrc}
            alt="border"
            fxd5r
          />

          <div className="absolute bottom-0 lg:left-[22%]">
            <div className="inline-block -mb-[70px]">
              <img
                src="/landing/demo/man.png"
                alt="demo preview"
                className={
                  hasWebGL
                    ? "opacity-0 pointer-events-none select-none block"
                    : "block"
                }
              />
              {hasWebGL ? (
                <motion.div
                  initial={{ opacity: 0, y: 0 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="absolute inset-0 z-10"
                >
                  <Canvas
                    frameloop={isInView ? "always" : "never"}
                    camera={{ position: [0, 0, 10], fov: 35 }}
                    className="w-full h-full"
                    dpr={[1, 1.5]}
                    gl={{
                      powerPreference: "high-performance",
                      antialias: false,
                    }}
                  >
                    <ambientLight intensity={1.2} />
                    <directionalLight position={[10, 10, 10]} intensity={1.5} />
                    <Environment preset="city" resolution={256} />
                    <Suspense fallback={null}>
                      <Model scrollYProgress={scrollYProgress} />
                    </Suspense>
                  </Canvas>
                </motion.div>
              ) : null}
            </div>
            <motion.img
              style={{ rotate: rotate1, willChange: "transform" }}
              src="/landing/demo/circle.png"
              alt="circle"
              className="absolute -right-[16%] -top-10 lg:-right-[50%] lg:top-0 w-2/5 origin-center"
            />
            <motion.img
              style={{ rotate: rotate2, willChange: "transform" }}
              src="/landing/demo/circle.png"
              alt="circle"
              className="absolute -left-[12%] -bottom-10 lg:-left-[45%] lg:-bottom-14 w-1/4 origin-center z-50"
            />
            <motion.img
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              src="/landing/demo/innovation.svg"
              alt="innovation"
              className="absolute lg:-left-[70%] md:-left-80 md:top-0 lg:top-10 backdrop-blur-[2px] lg:block"
            />
            <motion.img
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.5 }}
              src="/landing/demo/sugar.png"
              alt="sugar"
              className="absolute -right-[50%] -bottom-24 hidden lg:block"
            />
          </div>

          {/* our Ai */}
          <motion.div
            {...fadeRight}
            className="absolute -right-44 top-[22%] -translate-y-1/2 hidden lg:block"
          >
            <p className="font-landing-accent text-xs leading-5 font-semibold max-w-36 mb-1">
              Our AI engine evaluates patterns across vast medical datasets to
              support accurate diagnosis, reduce errors, and enhance
              decision-making for healthcare professionals.
            </p>
            <Link
              to="/demo"
              className="inline-flex text-xs font-semibold items-center font-landing-title text-landing-primary-hover transition-colors"
            >
              Learn More
              <ArrowRightIcon className="ml-2 h-4 w-4" />
            </Link>
          </motion.div>
        </div>

        {/* demo button */}
        <motion.button
          {...fadeUp}
          className="mt-16 px-6 py-4 bg-landing-primary-hover border-2 uppercase font-landing-accent rounded-full hover:bg-landing-primary transition flex items-center hover:text-white"
        >
          <Link
            to="/demo"
            className="flex text-sm items-center font-landing-title text-white"
          >
            Try Demo
            <ArrowRightIcon className="ml-2 h-4 w-4" />
          </Link>
        </motion.button>
      </div>
    </section>
  );
};

export default Demo;
