import React, { useCallback, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import TestimonialItem from "./TestimonialItem";
import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
};

const fadeLeft = {
  initial: { opacity: 0, x: -32 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
};

const fadeRight = {
  initial: { opacity: 0, x: 32 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
};

const testimonials = [
  {
    name: "Parshvi R.",
    role: "Verified Member",
    img: "/landing/testimonial/testimonial1.webp",
    feedback:
      "This doesn’t feel like a typical health app… more like someone is guiding me daily. It tells me what to do instead of just showing numbers.",
  },
  {
    name: "Karan Deshmukh",
    role: "Verified Member",
    img: "/landing/testimonial/testimonial2.webp",
    feedback:
      "This app feels like having a personal health advisor in your pocket. It tells you what your body actually needs.",
  },
  {
    name: "Aditya Mehta",
    role: "Verified Member",
    img: "/landing/testimonial/testimonial3.webp",
    feedback:
      "I like how the platform connects food, activity, sleep, and lab reports in one place.",
  },
  {
    name: "Kavya Nair",
    role: "Verified Member",
    img: "/landing/testimonial/testimonial4.webp",
    feedback:
      "I never paid attention to nutrition before. This app made it easy to understand calories, macros, and even micronutrients.",
  },
  {
    name: "Dr. Shreya Mehra",
    role: "Verified Member",
    img: "/landing/testimonial/testimonial5.webp",
    feedback:
      "The AI lab report analyser is extremely useful. It explains what each parameter means and what I should do next.",
  },
];

const Testimonials = () => {
  const autoplay = useRef(
    Autoplay({
      delay: 3500,
      stopOnInteraction: false,
      stopOnMouseEnter: true,
    }),
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
      align: "start",
      skipSnaps: false,
      dragFree: false,
    },
    [autoplay.current],
  );

  const scrollPrev = useCallback(() => {
    if (!emblaApi) return;
    if (emblaApi.canScrollPrev()) {
      emblaApi.scrollPrev();
    } else {
      emblaApi.scrollTo(testimonials.length - 1);
    }
    autoplay.current.reset();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (!emblaApi) return;
    if (emblaApi.canScrollNext()) {
      emblaApi.scrollNext();
    } else {
      emblaApi.scrollTo(0);
    }
    autoplay.current.reset();
  }, [emblaApi]);

  return (
    <motion.section
      {...fadeUp}
      className="container mx-auto pt-24 px-5 flex flex-col lg:flex-row justify-between gap-10"
    >
      <motion.div
        {...fadeLeft}
        className="w-full lg:w-1/2 flex flex-col justify-between py-2 lg:py-8"
      >
        <div>
          <h2 className=" font-landing-title text-3xl md:text-4xl/[3rem] text-balance mb-2">
            You trust what ranks high. It’s time your{" "}
            <span className="text-landing-primary-hover italic">health</span>{" "}
            did too
          </h2>
          <p>See how others are making small changes that actually stick</p>
        </div>

        <div className="mt-14">
          <hr />
          <div className="flex items-center mt-5 gap-5">
            <img src="/landing/testimonial/testimonial.webp" alt="" />
            <div>
              <h5>2,000+ Active Members</h5>
              <img src="/landing/testimonial/star.svg" alt="" />
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div {...fadeRight} className="w-full lg:w-1/2 flex justify-end">
        <div className="w-full max-w-xl">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex -ml-4">
              {testimonials.map((testimonial, index) => (
                <motion.div
                  key={`${testimonial.name}-${index}`}
                  className="pl-4 flex-[0_0_100%] min-w-0"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.55, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
                >
                  <TestimonialItem {...testimonial} />
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center">
            <div
              className="flex items-center gap-2"
              aria-label="testimonial slider controls"
            >
              <button
                type="button"
                onClick={scrollPrev}
                className="h-10 w-10 rounded-full border border-[#d9d9d9] bg-white text-[#013F3F] text-xl leading-none transition-colors hover:bg-[#f4f7f7]"
                aria-label="Previous testimonial"
              >
                &#8592;
              </button>
              <button
                type="button"
                onClick={scrollNext}
                className="h-10 w-10 rounded-full border border-[#d9d9d9] bg-white text-[#013F3F] text-xl leading-none transition-colors hover:bg-[#f4f7f7]"
                aria-label="Next testimonial"
              >
                &#8594;
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.section>
  );
};

export default Testimonials;
