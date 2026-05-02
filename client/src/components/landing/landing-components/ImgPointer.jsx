import { motion } from "framer-motion";

const ImgPointer = () => {
  return (
    <section className="container mx-auto py-28 px-5 lg:px-36">
      <div className="flex flex-col gap-10">
        {/* 1 */}
        <div
          className="sticky"
          style={{ top: "3vh" }}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="w-full relative">
            <motion.img
              loading="lazy"
              decoding="async"
              src="/landing/pointer/1.webp"
              alt="pointer"
              className="w-full md:rounded-[40px] rounded-[25px]  hidden lg:block"
            />
            <motion.img
              loading="lazy"
              decoding="async"
              src="/landing/pointer/1-mob.webp"
              alt="pointer"
              className="w-full md:rounded-[40px] rounded-[25px] block lg:hidden"
            />

            <div className="w-full h-full bg-black/40 absolute top-0 left-0 right-0 bottom-0 z-5 rounded-[40px]"></div>

            <h3 className="text-center md:text-right absolute left-0 right-0 mx-auto top-8 lg:top-12 lg:right-16 text-3xl lg:text-5xl font-landing-title font-semibold text-white">
              Measure <br /> What Counts
            </h3>

            <div className="absolute bottom-10 flex gap-2 lg:gap-5 items-center justify-center w-full">
              <img
                src="/landing/pointer/1.1.svg"
                alt=""
                className="w-[28%] lg:w-1/6 backdrop-blur-sm"
              />
              <img
                src="/landing/pointer/1.2.svg"
                alt=""
                className="w-[28%] lg:w-1/6 backdrop-blur-sm"
              />
              <img
                src="/landing/pointer/1.3.svg"
                alt=""
                className="w-[28%] lg:w-1/6 backdrop-blur-sm"
              />
            </div>
          </div>
        </div>

        {/* 2 */}
        <div
          className="sticky"
          style={{ top: "3vh" }}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="w-full relative">
            <motion.img
              loading="lazy"
              decoding="async"
              src="/landing/pointer/2.webp"
              alt="pointer"
              className="w-full md:rounded-[40px] rounded-[25px] hidden lg:block"
            />
            <motion.img
              loading="lazy"
              decoding="async"
              src="/landing/pointer/2-mob.webp"
              alt="pointer"
              className="w-full md:rounded-[40px] rounded-[25px] block lg:hidden"
            />

            <h3 className="text-center md:text-right absolute left-0 right-0 mx-auto top-8 lg:top-12 lg:right-16 text-3xl lg:text-5xl font-landing-title font-semibold text-white">
              Optimize <br /> Your Sleep
            </h3>

            <div className="absolute bottom-10 flex gap-2 lg:gap-5 items-center justify-center w-full">
              <img
                src="/landing/pointer/2-arrow.svg"
                className="absolute w-1/5 -bottom-5 right-[25%] lg:block hidden"
              />
              <img
                src="/landing/pointer/2-arrow-mob.svg"
                className="absolute w-1/4 bottom-10 right-[24%] lg:hidden block"
              />
            </div>

            <div className="text-center absolute top-[30%] lg:right-[25%] max-sm:left-0 right-0 mx-auto text-landing-light-bg">
              <h4 className="text-2xl lg:text-3xl font-medium">
                Sleep performance <br /> <span>93%</span>
              </h4>
            </div>
            <div className="text-right absolute top-[45%] right-[8%] lg:right-[12%] text-landing-light-bg">
              <h4 className="lg:text-2xl font-medium">
                Sleep Needed <br />{" "}
                <span className="text-2xl lg:text-3xl">8:45</span>
              </h4>
            </div>
            <div className="text-right absolute bottom-[15%] lg:bottom-[10%] right-[5%] lg:right-[12%] text-landing-light-bg">
              <h4 className="lg:text-2xl font-medium">
                Hours of Sleep <br />{" "}
                <span className="text-2xl lg:text-3xl">8:17</span>
              </h4>
            </div>
          </div>
        </div>

        {/* 3 */}
        <div
          className="sticky"
          style={{ top: "3vh" }}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="w-full relative">
            <motion.img
              loading="lazy"
              decoding="async"
              src="/landing/pointer/3.webp"
              alt="pointer"
              className="w-full md:rounded-[40px] rounded-[25px] hidden lg:block"
            />
            <motion.img
              loading="lazy"
              decoding="async"
              src="/landing/pointer/3-mob.webp"
              alt="pointer"
              className="w-full md:rounded-[40px] rounded-[25px] block lg:hidden"
            />

            <h3 className="text-center md:text-right absolute left-0 right-0 mx-auto top-8 lg:top-12 lg:right-16 text-3xl lg:text-5xl font-landing-title font-semibold text-white">
              Live <br /> Intentionally
            </h3>

            <div className="absolute bottom-10 left-5 right-10 md:left-10 flex flex-col gap-2 lg:gap-5 items-start justify-center ">
              <div className="backdrop-blur-md md:backdrop-blur-sm bg-white/30 rounded-l-[40px] rouned-t-[40px] ronded-r-[40px] rounded-tr-[40px] px-5 py-5 md:px-10  text-white max-w-sm">
                <p className="text-lg lg:text-2xl">
                  You still need <strong>819 steps</strong> to complete your
                  day. <br /> <strong>Do it now!!</strong>
                </p>
              </div>

              <p className="text-3xl lg:text-5xl font-medium text-white px-4 md:px-8 tracking-wider">
                +1,121 <br /> Steps Taken
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ImgPointer;
