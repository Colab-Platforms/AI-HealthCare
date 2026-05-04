import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Marquee from "react-fast-marquee";

const NewStats = () => {
  const [cards, setCards] = useState([
    { id: 3, key: 3, src: "/landing/new-stats/d-card3.svg" },
    { id: 2, key: 2, src: "/landing/new-stats/d-card2.svg" },
    { id: 1, key: 1, src: "/landing/new-stats/d-card1.svg" },
  ]);
  const [isMobile] = useState(() => isMobileDevice());
  const counterRef = useRef(3);

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

  useEffect(() => {
    const interval = setInterval(() => {
      setCards((prev) => {
        const newCards = [...prev];
        const backCard = newCards.pop();
        counterRef.current += 1;
        newCards.unshift({ ...backCard, key: counterRef.current });
        return newCards;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  const marqueeItems = [
    { id: 1, src: "/landing/new-stats/c1.png" },
    { id: 2, src: "/landing/new-stats/c2.png" },
    { id: 3, src: "/landing/new-stats/c3.png" },
    { id: 4, src: "/landing/new-stats/c4.png" },
    { id: 5, src: "/landing/new-stats/c5.png" },
    { id: 6, src: "/landing/new-stats/c6.png" },
    { id: 7, src: "/landing/new-stats/c7.png" },
  ];

  return (
    <section className="container mx-auto pt-24 px-5 lg:px-20 overflow-hidden">
      <div className="flex flex-col lg:flex-row justify-center items-center text-center gap-6">
        <h2 className="font-landing-title text-2xl md:text-4xl font-semibold">
          Unlock Peak Human Performance with{" "}
          <span className="text-landing-primary-hover block italic font-semibold my-2">
            PHI
          </span>
          <span className="font-landing-title italic font-normal">
            (Personal Health Intelligence)
          </span>
        </h2>
      </div>

      {/* Stats Section One  */}
      <div className="relative pt-20">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-[65%] rounded-lg ">
            <div className="relative ">
              <img
                src="/landing/new-stats/1.webp"
                alt="bg-1"
                className="w-full h-full min-h-[500px] object-[-100px] lg:object-[0] object-cover rounded-lg"
              />
              <div className="absolute top-0 left-0 w-full h-full lg:bg-black/40 bg-black/50 rounded-lg"></div>

              <div className="absolute top-0 left-0 p-10">
                <h5 className="text-white text-xl font-semibold font-landing-title text-center md:text-left">
                  Miss Nothing See Everything
                </h5>
                <p className="text-white text-base font-light max-w-xs font-landing-body mt-2 text-center md:text-left">
                  See all your stats, trends, and progress in one clear view.
                </p>
              </div>

              <div className="flex flex-col items-center justify-center absolute bottom-10 right-10 md:bottom-20 md:right-20 w-[250px] md:w-[280px] lg:w-[320px]">
                <img
                  src="/landing/new-stats/device.svg"
                  alt="device"
                  className="relative z-0 w-[160px] md:w-[160px] lg:w-[200px]"
                />
                <div className="relative w-full flex justify-center items-end h-[100px] md:h-[120px] -mt-5 md:-mt-0">
                  <AnimatePresence>
                    {cards.map((card, index) => {
                      return (
                        <motion.img
                          key={card.key}
                          src={card.src}
                          alt={`card-${card.id}`}
                          className="absolute bottom-0 backdrop-blur-xl rounded-lg w-4/5"
                          initial={{
                            opacity: 0,
                            y: 30,
                            scale: 1.1,
                            zIndex: 40,
                          }}
                          animate={{
                            opacity: 1,
                            y: index * (isMobile ? -25 : -35),
                            scale: 1 - index * 0.08,
                            zIndex: 30 - index * 10,
                          }}
                          exit={{ opacity: 0, y: -90, scale: 0.7, zIndex: 0 }}
                          transition={{
                            duration: 0.8,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                        />
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
          <div className="w-full lg:w-[35%] bg-[#f3f3f3] rounded-lg flex flex-col items-center justify-center p-10 gap-5">
            <div>
              <h5 className="text-landing-text text-xl font-semibold font-landing-title text-center">
                Move More Today.
              </h5>
              <p className="text-landing-text text-base font-light  font-landing-body mt-2 text-center max-w-xs text-balance">
                Steady, sustainable changes that actually last long term
              </p>
            </div>
            <img
              src="/landing/new-stats/2.webp"
              className="rounded-md w-2/3"
              alt=""
            />
            <img
              src="/landing/new-stats/more-card.jpg"
              className="rounded-[10px] md:rounded-md border-[1.5px] border-black/20"
              alt=""
            />
          </div>
        </div>
      </div>

      {/* Stats Section Two  */}
      <div className="relative pt-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-[35%] bg-[#f3f3f3] rounded-lg flex flex-col items-center justify-center p-10 gap-5">
            <div>
              <h5 className="text-landing-text text-xl font-semibold font-landing-title text-center">
                Stay in range. Stay in control
              </h5>
              <p className="text-landing-text text-base font-light  font-landing-body mt-2 text-center max-w-xs text-balance">
                Monitor glucose levels and stay safely within your target range.
              </p>
            </div>
            <img
              src="/landing/new-stats/4.webp"
              className="rounded-md w-5/6"
              alt=""
            />
            <img
              src="/landing/new-stats/graph.svg"
              className="rounded-md"
              alt=""
            />
          </div>

          <div className="w-full lg:w-[65%] rounded-lg">
            <div className="relative">
              <img
                src="/landing/new-stats/3.webp"
                alt="bg-3"
                className="w-full h-full object-cover min-h-[500px] object-[-210px] lg:object-[0] rounded-lg"
              />
              <div className="absolute top-0 left-0 w-full h-full lg:bg-black/40 bg-black/50 rounded-lg"></div>

              <div className="absolute top-0 left-0 p-10">
                <h5 className="text-white text-xl font-semibold font-landing-title text-center md:text-left text-balance ">
                  Your movement, your way
                </h5>
                <p className="text-white text-base font-light max-w-xs font-landing-body mt-2 text-center md:text-left text-balance ">
                  Every step, rep, and session logged and working toward your
                  goal.
                </p>
              </div>

              <div className="absolute bottom-10 md:bottom-15 left-0 w-full">
                <Marquee
                  speed={30}
                  gradient={false}
                  pauseOnHover={false}
                  autoFill={true}
                >
                  {marqueeItems.map((item) => (
                    <div
                      key={item.id}
                      className="w-20 h-20 bg-white/30 rounded-full backdrop-blur-sm flex items-center justify-center mx-2"
                    >
                      <img
                        src={item.src}
                        alt={item.id}
                        className="object-contain p-5"
                      />
                    </div>
                  ))}
                </Marquee>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section Three  */}
      <div className="relative pt-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-[65%] rounded-lg">
            <div className="relative">
              <img
                src="/landing/new-stats/5.webp"
                alt="bg-1"
                className="w-full h-full object-cover min-h-[500px]  object-[-250px] lg:object-[0] rounded-lg"
              />
              <div className="absolute top-0 left-0 w-full h-full lg:bg-black/50 bg-black/60 rounded-lg"></div>

              <div className="absolute top-0 left-0 p-8 md:p-10">
                <h5 className="text-white text-xl font-semibold font-landing-title text-center md:text-left text-balance">
                  Eat with purpose.
                </h5>
                <p className="text-white text-base font-light max-w-xs font-landing-body mt-3 text-center md:text-left text-balance lead">
                  Track meals, understand nutrients, and fuel your body right.
                </p>
                <div className="backdrop-blur-sm bg-black/50 mt-24 p-5 rounded-3xl md:w-2/3 w-full">
                  <img
                    src="/landing/new-stats/eat-content.png"
                    className=""
                    alt=""
                  />
                </div>
              </div>

              <div className="flex flex-col items-center justify-center absolute bottom-10 right-10 md:bottom-20 md:right-20 w-[240px] md:w-[280px] lg:w-[320px]"></div>
            </div>
          </div>
          <div className="w-full lg:w-[35%] bg-[#f3f3f3] rounded-lg flex flex-col items-center justify-center p-10 gap-5">
            <div>
              <h5 className="text-landing-text text-xl font-semibold font-landing-title text-center">
                Rest. Recover. Repeat.
              </h5>
              <p className="text-landing-text text-base font-light  font-landing-body mt-2 text-center max-w-xs text-balance">
                Track your sleep quality and wake up ready for the day ahead.
              </p>
            </div>
            <img
              src="/landing/new-stats/rest.png"
              className="rounded-md w-full"
              alt=""
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default NewStats;
