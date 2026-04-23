import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

const NewHero = () => {
  const slides = [
    {
      id: 1,
      title: "A Thoughtfully Designed Health App",
      description:
        "Stop wondering what your numbers mean. Upload your report to receive a simplified analysis of your health status.",
      image: "/landing/slide1.webp",
      backgroundColor: "#ecf2e5",
      backgroundAccent:
        "radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0) 40%), radial-gradient(circle at 80% 25%, rgba(118, 179, 157, 0.18), rgba(118, 179, 157, 0) 34%)",
      buttonText: "know your health",
      buttonLink: "/register",
    },
    {
      id: 2,
      title: "Sugar Tracking, Simplified",
      description:
        "Understand exactly how your diet affects your body. Clear, intuitive reporting designed to make managing your levels feel effortless and natural.",
      image: "/landing/slide3.webp",
      backgroundColor: "#b6dbf350",
      backgroundAccent:
        "radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0) 40%), radial-gradient(circle at 80% 25%, rgba(118, 179, 157, 0.18), rgba(118, 179, 157, 0) 34%)",
      buttonText: "start tracking",
      buttonLink: "/register",
    },
    {
      id: 3,
      title: "Strategic Fitness Intelligence",
      description:
        "Real weight loss happens in the details. We track your steps, miles, and habits to ensure your hard work actually shows results.",
      image: "/landing/slide2.webp",
      backgroundColor: "#f9f1e9",
      backgroundAccent:
        "radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0) 40%), radial-gradient(circle at 80% 25%, rgba(118, 179, 157, 0.18), rgba(118, 179, 157, 0) 34%)",
      buttonText: "Start My Transformation",
      buttonLink: "/register",
    },
    {
      id: 4,
      title: "Turn Reports into Results",
      description:
        "Upload any medical report and our AI translates complex labs into a clear, actionable executive summary of your status.",
      image: "/landing/slide4.webp",
      backgroundColor: "#f9f1e9",
      backgroundAccent:
        "radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0) 40%), radial-gradient(circle at 80% 25%, rgba(118, 179, 157, 0.18), rgba(118, 179, 157, 0) 34%)",
      buttonText: "Get Started",
      buttonLink: "/register",
    },
  ];

  const [activeSlide, setActiveSlide] = useState(0);
  const [isAutoPlayEnabled, setIsAutoPlayEnabled] = useState(true);
  const [transitionDirection, setTransitionDirection] = useState(1);

  const changeSlide = (nextIndex, direction) => {
    setTransitionDirection(direction);
    setActiveSlide(nextIndex);
  };

  const handleNext = () => {
    changeSlide((activeSlide + 1) % slides.length, 1);
  };

  const handlePrev = () => {
    changeSlide((activeSlide - 1 + slides.length) % slides.length, -1);
  };

  const handleDragEnd = (_, info) => {
    const swipeThreshold = 80;
    const swipeVelocity = 500;
    const swipeOffset = info.offset.x;
    const swipeSpeed = info.velocity.x;

    if (swipeOffset < -swipeThreshold || swipeSpeed < -swipeVelocity) {
      handleNext();
      return;
    }

    if (swipeOffset > swipeThreshold || swipeSpeed > swipeVelocity) {
      handlePrev();
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateAutoPlayState = () => {
      setIsAutoPlayEnabled(!mediaQuery.matches);
    };

    updateAutoPlayState();
    mediaQuery.addEventListener("change", updateAutoPlayState);

    return () => {
      mediaQuery.removeEventListener("change", updateAutoPlayState);
    };
  }, []);

  useEffect(() => {
    if (!isAutoPlayEnabled || slides.length <= 1) return;

    const timeoutId = window.setTimeout(() => {
      setTransitionDirection(1);
      setActiveSlide((currentSlide) => (currentSlide + 1) % slides.length);
    }, 6000);

    return () => window.clearTimeout(timeoutId);
  }, [activeSlide, isAutoPlayEnabled, slides.length]);

  const currentSlide = slides[activeSlide];
  const titleWords = currentSlide.title.split(" ");

  return (
    <section
      className="relative overflow-hidden select-none"
      style={{ backgroundColor: currentSlide.backgroundColor }}
    >
      <motion.div
        key={currentSlide.id}
        className="absolute inset-0"
        style={{ backgroundImage: currentSlide.backgroundAccent }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.7, ease: "easeInOut" }}
      />
      <motion.div
        className="container relative mx-auto flex min-h-screen flex-col items-center justify-center gap-10 px-5 pt-36 lg:flex-row lg:justify-between lg:px-20 lg:pt-20"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ touchAction: "pan-y" }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide.id}
            className="w-full max-w-2xl text-center lg:text-left"
            initial={{ opacity: 0, x: transitionDirection > 0 ? -28 : 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: transitionDirection > 0 ? 28 : -28 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.h1
              className="mx-auto mb-4 text-4xl lg:text-6xl text-landing-primary font-landing-accent-2 text-balance sm:max-w-none md:mb-6 lg:mx-0"
              initial="hidden"
              animate="show"
              variants={{
                hidden: { opacity: 1 },
                show: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.03,
                    delayChildren: 0.12,
                  },
                },
              }}
            >
              {titleWords.map((word, wordIndex) => (
                <motion.span
                  key={`${currentSlide.id}-${wordIndex}`}
                  className="inline-flex whitespace-nowrap mr-[0.22em] last:mr-0"
                >
                  {word.split("").map((character, characterIndex) => (
                    <motion.span
                      key={`${currentSlide.id}-${wordIndex}-${characterIndex}`}
                      className="inline-block"
                      variants={{
                        hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
                        show: {
                          opacity: 1,
                          y: 0,
                          filter: "blur(0px)",
                          transition: {
                            duration: 0.45,
                            ease: [0.16, 1, 0.3, 1],
                          },
                        },
                      }}
                    >
                      {character}
                    </motion.span>
                  ))}
                </motion.span>
              ))}
            </motion.h1>

            <motion.p
              className="mx-auto mb-4 mt-4 max-w-xs text-md lg:text-lg font-light capitalize text-landing-text text-balance font-landing-accent md:mb-6 lg:mx-0 lg:max-w-4xl"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.55,
                delay: 0.18,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {currentSlide.description}
            </motion.p>

            <motion.div
              className="flex justify-center lg:justify-start"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.55,
                delay: 0.28,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <Link
                to={currentSlide.buttonLink}
                className="px-8 py-3 bg-landing-primary text-white uppercase font-black tracking-widest rounded-full hover:bg-landing-primary-hover transition text-sm inline-flex shadow-[0_15px_30px_rgba(62,118,97,0.3)] active:scale-95"
              >
                {currentSlide.buttonText}
              </Link>
            </motion.div>
          </motion.div>
        </AnimatePresence>

        <div className="w-full relative flex items-center justify-end">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide.image}
              className="flex w-full items-center justify-center lg:justify-end"
              initial={{
                opacity: 0,
                x: transitionDirection > 0 ? 30 : -30,
                scale: 0.96,
              }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{
                opacity: 0,
                x: transitionDirection > 0 ? -16 : 16,
                scale: 0.97,
              }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.img
                src={currentSlide.image}
                alt="AI HealthCare"
                width={800}
                height={800}
                className="mx-auto w-full select-none sm:max-w-sm md:max-w-md lg:mx-0 lg:w-full lg:max-w-none"
                initial={{ y: 10 }}
                animate={{ y: [0, -6, 0] }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                draggable="false"
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Navigation Arrows */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-between px-5 lg:px-20">
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Previous slide"
          className="pointer-events-auto inline-flex items-center justify-center text-lg font-semibold leading-none text-landing-primary transition hover:opacity-70 lg:h-11 lg:w-11 lg:rounded-full lg:border lg:border-landing-primary/15 lg:bg-white/50 lg:text-base lg:backdrop-blur-sm lg:hover:bg-white/80"
        >
          <span className="lg:hidden">&lt;</span>
          <ChevronLeft className="hidden h-5 w-5 lg:block" />
        </button>

        <button
          type="button"
          onClick={handleNext}
          aria-label="Next slide"
          className="pointer-events-auto inline-flex items-center justify-center text-lg font-semibold leading-none text-landing-primary transition hover:opacity-70 lg:h-11 lg:w-11 lg:rounded-full lg:border lg:border-landing-primary/15 lg:bg-white/50 lg:text-base lg:backdrop-blur-sm lg:hover:bg-white/80"
        >
          <span className="lg:hidden">&gt;</span>
          <ChevronRight className="hidden h-5 w-5 lg:block" />
        </button>
      </div>
    </section>
  );
};

export default NewHero;
