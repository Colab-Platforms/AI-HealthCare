import { ArrowRightIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Environment } from "@react-three/drei";

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
      modelRef.current.rotation.y += (targetRotation - modelRef.current.rotation.y) * 0.08;
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
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] }
};

const fadeLeft = {
  initial: { opacity: 0, x: -50 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
};

const fadeRight = {
  initial: { opacity: 0, x: 50 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
};

const Demo = () => {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  // Base rotations with slower paces and different directions
  const rotate1Raw = useTransform(scrollYProgress, [0, 1], [0, 120]); 
  const rotate2Raw = useTransform(scrollYProgress, [0, 1], [-45, -135]); 

  // Apply spring physics for natural momentum and smooth stopping
  const springConfig = { damping: 25, stiffness: 60, mass: 1.2 };
  const rotate1 = useSpring(rotate1Raw, springConfig);
  const rotate2 = useSpring(rotate2Raw, springConfig);

  return (
    <section ref={containerRef} className="container mx-auto py-24 px-5">
      <motion.div {...fadeUp} className="flex justify-center text-center items-center">
        <div>
          <h2 className="text-landing-primary-hover font-landing-title text-3xl md:text-4xl">
            Guidance That Moves With You
          </h2>
          <p className="text-xl text-landing-text/80 mt-4">
            A Smarter Way to Understand and Extend Your Longevity.
          </p>
        </div>
      </motion.div>

      <div className="flex justify-center flex-col items-center mt-64 relative">
        {/* interactive */}
        <motion.div {...fadeLeft} className="absolute left-0 top-[35%] -translate-y-1/2">
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
            src="/landing/demo/border.svg" 
            alt="border" fxd5r 
          />


          <div className="absolute bottom-0 left-[22%]">
            <div className="inline-block  -mb-[70px]">
              <img 
                src="/landing/demo/man.png" 
                alt="" 
                className="opacity-0 pointer-events-none select-none block" 
              />
              <motion.div 
                initial={{ opacity: 0, y: 0 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="absolute inset-0 z-10"
              >
                <Canvas camera={{ position: [0, 0, 10], fov: 35 }} className="w-full h-full">
                  <ambientLight intensity={1.2} />
                  <directionalLight position={[10, 10, 10]} intensity={1.5} />
                  <Environment preset="city" />
                  <Suspense fallback={null}>
                    <Model scrollYProgress={scrollYProgress} />
                  </Suspense>
                </Canvas>
              </motion.div>
            </div>
            <motion.img
              style={{ rotate: rotate1 }}
              src="/landing/demo/circle.png"
              alt="circle"
              className="absolute -right-[50%] top-0 w-1/2 origin-center"
            />
            <motion.img
              style={{ rotate: rotate2 }}
              src="/landing/demo/circle.png"
              alt="circle"
              className="absolute -left-[45%] -bottom-20 w-1/3 origin-center"
            />
            <motion.img
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              src="/landing/demo/innovation.svg"
              alt="innovation"
              className="absolute -left-[70%] top-10 backdrop-blur-[2px]"
            />
            <motion.img
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.5 }}
              src="/landing/demo/sugar.png"
              alt="sugar"
              className="absolute -right-[50%] -bottom-24"
            />
          </div>

          {/* our Ai */}
          <motion.div {...fadeRight} className="absolute -right-72 top-[30%] -translate-y-1/2">
            <p className="font-landing-accent text-sm leading-5 font-semibold max-w-56">
              Our AI engine evaluates patterns across vast medical datasets to
              support accurate diagnosis, reduce errors, and enhance
              decision-making for healthcare professionals.
            </p>
            <Link
              to="/demo"
              className="inline-flex text-sm font-semibold items-center font-landing-title text-landing-primary-hover transition-colors"
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
