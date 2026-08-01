import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";

const UpdatedBetterWellness = ({ cardImages = {} }) => {
  const cards = [
    {
      id: "health_intelligence",
      title: "Health Intelligence",
      subtitle: "Lab Report Analysis • Medical Records • Health Alerts",
      fallbackImg: "/updated-landing/rotating-card-1.png",
      backImg: "/updated-landing/1.png",
    },
    {
      id: "nutrition_intelligence",
      title: "Nutrition Intelligence",
      subtitle: "Meal Analysis • Calories & Macros • Food Logging",
      fallbackImg: "/updated-landing/rotating-card-2.png",
      backImg: "/updated-landing/2.png",
    },
    {
      id: "sleep_recovery",
      title: "Sleep & Recovery",
      subtitle: "Sleep Tracking • Recovery Score • Sleep Trends",
      fallbackImg: "/updated-landing/rotating-card-3.jpg",
      backImg: "/updated-landing/3.png",
    },
    {
      id: "daily_wellness",
      title: "Daily Wellness",
      subtitle: "Steps • Exercise • Wellness Score",
      fallbackImg: "/updated-landing/rotating-card-4.png",
      backImg: "/updated-landing/4.png",
    },
    {
      id: "personalized_guidance",
      title: "Personalized Guidance",
      subtitle: "Daily Insights • Supplement Guidance • Goal Tracking",
      fallbackImg: "/updated-landing/rotating-card-5.png",
      backImg: "/updated-landing/5.png",
    },
  ];

  const [offset, setOffset] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [flippedCards, setFlippedCards] = useState({});
  const requestRef = useRef();

  const toggleFlip = (cardId) => {
    setFlippedCards((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const cardWidth = isMobile ? 310 : 460;
  const gap = isMobile ? 16 : 36;
  const itemTotalWidth = cardWidth + gap;
  const totalLoopWidth = cards.length * itemTotalWidth;

  const hasFlippedCard = Object.values(flippedCards).some(Boolean);

  const IDLE_SPEED = 0.2;
  const speedRef = useRef(isMobile ? 0 : IDLE_SPEED);
  const targetSpeedRef = useRef(isMobile ? 0 : IDLE_SPEED);
  const scrollTimeoutRef = useRef(null);
  const dragStateRef = useRef({ isDragging: false, startX: 0, startOffset: 0, lastX: 0, lastTime: 0, velocity: 0 });

  // Fast, instant scroll-driven rotation (scroll down = fast counter-clockwise, scroll up = fast clockwise)
  useEffect(() => {
    let lastScrollY = typeof window !== "undefined" ? window.scrollY : 0;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDiff = currentScrollY - lastScrollY;
      lastScrollY = currentScrollY;

      if (Math.abs(scrollDiff) > 0.5) {
        // Direct instant rotation push proportional to scroll speed
        setOffset((prev) => {
          const next = prev + scrollDiff * 1.2;
          return ((next % totalLoopWidth) + totalLoopWidth) % totalLoopWidth;
        });

        // Set momentum direction and speed
        targetSpeedRef.current = scrollDiff > 0 ? 3.5 : -3.5;

        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
          targetSpeedRef.current = isMobile ? 0 : IDLE_SPEED;
        }, 100);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [totalLoopWidth, isMobile]);

  useEffect(() => {
    let lastTime = performance.now();

    const animate = (time) => {
      const delta = Math.min(time - lastTime, 32);
      lastTime = time;

      // Snappy lerp (0.2) for instant responsiveness
      speedRef.current += (targetSpeedRef.current - speedRef.current) * 0.2;

      if (!isPaused && !hasFlippedCard) {
        setOffset((prev) => {
          const next = prev + delta * 0.06 * speedRef.current;
          return ((next % totalLoopWidth) + totalLoopWidth) % totalLoopWidth;
        });
      }
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPaused, hasFlippedCard, totalLoopWidth]);

  // Manual horizontal drag/swipe for mobile — page vertical scroll still drives rotation,
  // but idle auto-rotation is disabled so the strip only moves on scroll or direct touch drag.
  const pendingDragXRef = useRef(null);
  const dragRafRef = useRef(null);

  const applyPendingDrag = () => {
    dragRafRef.current = null;
    if (pendingDragXRef.current === null) return;
    const dx = pendingDragXRef.current - dragStateRef.current.startX;
    setOffset(() => {
      const next = dragStateRef.current.startOffset - dx;
      return ((next % totalLoopWidth) + totalLoopWidth) % totalLoopWidth;
    });
  };

  const handleDragStart = (e) => {
    if (!isMobile) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    dragStateRef.current = {
      isDragging: true,
      startX: x,
      startOffset: offset,
      lastX: x,
      lastTime: performance.now(),
      velocity: 0,
    };
    pendingDragXRef.current = null;
    if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
    targetSpeedRef.current = 0;
    speedRef.current = 0;
  };

  const handleDragMove = (e) => {
    if (!isMobile || !dragStateRef.current.isDragging) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const now = performance.now();
    const dt = now - dragStateRef.current.lastTime;
    if (dt > 0) {
      // Exponential moving average smooths out noisy per-event deltas so a fast
      // flick produces a stable velocity reading instead of whatever the last
      // (possibly tiny) touchmove happened to measure.
      const instVelocity = (dragStateRef.current.lastX - x) / dt;
      dragStateRef.current.velocity =
        dragStateRef.current.velocity * 0.7 + instVelocity * 0.3;
    }
    dragStateRef.current.lastX = x;
    dragStateRef.current.lastTime = now;

    // Throttle the actual React state update to once per animation frame —
    // touchmove can fire faster than the display refresh rate, and re-rendering
    // every card on every single event is what made this feel laggy.
    pendingDragXRef.current = x;
    if (dragRafRef.current === null) {
      dragRafRef.current = requestAnimationFrame(applyPendingDrag);
    }
  };

  const handleDragEnd = () => {
    if (!isMobile || !dragStateRef.current.isDragging) return;
    dragStateRef.current.isDragging = false;

    if (dragRafRef.current) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
      applyPendingDrag();
    }

    // Convert drag release velocity (px/ms) into the loop's speed unit so momentum feels continuous.
    const flingSpeed = dragStateRef.current.velocity / 0.06;
    const clamped = Math.max(-14, Math.min(14, flingSpeed));
    speedRef.current = clamped;
    targetSpeedRef.current = clamped;

    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      targetSpeedRef.current = 0;
    }, 300);
  };

  const calculateArcTransform = (relativeX) => {
    const maxRange = 1000;
    const normalized = Math.max(-1, Math.min(1, relativeX / maxRange));
    const yDip = Math.pow(normalized, 2) * 90;
    const rotation = normalized * 16;
    const opacity = 1 - Math.pow(Math.abs(normalized), 3) * 0.6;

    return { y: yDip, rotate: rotation, opacity: opacity };
  };

  return (
    <section className="w-full bg-[#FAF9F8] py-12 sm:py-28 px-4 sm:px-8 font-landing-body overflow-hidden border-b border-slate-200/50">
      <div className="max-w-[1920px] mx-auto">
        <div className="max-w-5xl mb-6 sm:mb-14 text-left px-2 sm:px-8 lg:px-12">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-3xl sm:text-5xl lg:text-[84px] font-medium font-landing-title text-[#000] leading-[1.1] sm:leading-[1.12] mb-3 sm:mb-4"
          >
            Everything You Need <br />
            For Better <span className="text-[#014343]">Wellness</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-sm sm:text-xl lg:text-3xl font-normal leading-snug sm:leading-normal max-w-4xl "
          >
            From AI-powered lab analysis and medical records to nutrition, sleep, activity,
            and personalized coaching, Take Health brings every part of your wellness journey
            together in one intelligent platform
          </motion.p>
        </div>

        <div
          className="w-full py-4 sm:py-16 relative min-h-[500px] sm:min-h-[710px] lg:min-h-[760px] flex items-center justify-center overflow-hidden"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-48 bg-gradient-to-r from-[#FAF9F8] via-[#FAF9F8]/90 to-transparent z-30 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-48 bg-gradient-to-l from-[#FAF9F8] via-[#FAF9F8]/90 to-transparent z-30 pointer-events-none" />

          <div
            className="relative w-full h-[460px] sm:h-[630px] lg:h-[680px] flex items-center justify-center"
            style={{ touchAction: isMobile ? "pan-y" : "auto" }}
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
            onTouchCancel={handleDragEnd}
          >
            {[-1, 0, 1].map((copyIndex) =>
              cards.map((card, cardIndex) => {
                const globalIndex = copyIndex * cards.length + cardIndex;
                const baseX = globalIndex * itemTotalWidth - offset;
                const relativeX = baseX;
                const arc = calculateArcTransform(relativeX);
                const imageSrc = cardImages[card.id] || card.fallbackImg;
                const isFlipped = !!flippedCards[card.id];

                if (Math.abs(relativeX) > 1300) return null;

                return (
                  <div
                    key={`${copyIndex}-${card.id}`}
                    className="absolute w-[310px] sm:w-[420px] lg:w-[460px] h-[430px] sm:h-[570px] lg:h-[620px] origin-bottom [perspective:1200px]"
                    style={{
                      transform: `translate3d(${relativeX}px, ${arc.y}px, 0px) rotate(${arc.rotate}deg)`,
                      opacity: arc.opacity,
                      zIndex: isFlipped ? 200 : Math.round(100 - Math.abs(arc.rotate) * 2),
                      willChange: isFlipped ? "transform" : "auto",
                    }}
                    onMouseEnter={() => {
                      setOffset((prev) => Math.round(prev));
                      setFlippedCards((prev) => ({ ...prev, [card.id]: true }));
                    }}
                    onMouseLeave={() => setFlippedCards((prev) => ({ ...prev, [card.id]: false }))}
                  >
                    {/* 3D Rotating Container */}
                    <div
                      className="relative w-full h-full rounded-[28px] shadow-2xl transition-transform duration-700 [transform-style:preserve-3d]"
                      style={{
                        transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                        willChange: isFlipped ? "transform" : "auto",
                      }}
                    >
                      {/* FRONT FACE */}
                      <div
                        className={`absolute inset-0 w-full h-full rounded-[28px] overflow-hidden transition-opacity duration-300 ${isFlipped ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"
                          }`}
                        style={{
                          backfaceVisibility: "hidden",
                          WebkitBackfaceVisibility: "hidden",
                        }}
                      >
                        <img
                          src={imageSrc}
                          alt={card.title}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent opacity-90 transition-opacity" />
                        <div className="absolute bottom-0 left-0 right-0 p-7 sm:p-9 flex flex-col items-center text-center z-10 text-white">
                          <h3 className="text-2xl sm:text-3xl font-medium tracking-tight font-landing-title mb-1.5 drop-shadow-md">
                            {card.title}
                          </h3>
                          <p className="text-xs sm:text-sm text-white/90 font-medium mb-6 tracking-wide max-w-[90%]">
                            {card.subtitle}
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFlip(card.id);
                            }}
                            className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white transition-all duration-300 hover:scale-110 hover:bg-white hover:text-[#014343] shadow-lg cursor-pointer"
                            aria-label="Flip Card"
                          >
                            <Plus className="w-6 h-6" />
                          </button>
                        </div>
                      </div>

                      {/* BACK FACE */}
                      <div
                        className={`absolute inset-0 w-full h-full rounded-[28px] border border-slate-200/80 shadow-2xl overflow-hidden bg-white transition-opacity duration-300 ${isFlipped ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                          }`}
                        style={{
                          backfaceVisibility: "hidden",
                          WebkitBackfaceVisibility: "hidden",
                          transform: "rotateY(180deg)",
                        }}
                      >
                        <img
                          src={card.backImg}
                          alt={card.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>

                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default UpdatedBetterWellness;
