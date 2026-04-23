import { Link } from "react-router-dom";
import { ArrowRightIcon } from "lucide-react";
import { motion } from "framer-motion";

const fadeUpObj = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
};

const fadeLeftObj = {
  initial: { opacity: 0, x: -40 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
};

const fadeRightObj = {
  initial: { opacity: 0, x: 40 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
};

const Stats = () => {
  return (
    <section className="container mx-auto py-24 px-5 lg:px-20 overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:justify-between items-center text-center lg:text-left gap-5">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="font-landing-title text-2xl md:text-4xl">
            Precision Intelligence for{" "}
            <span className="text-landing-primary-hover">
              Peak Human Performance.
            </span>
          </h2>
          <p className="lg:text-lg text-landing-text/80 mt-4 text-balance">
            Begin with what you do each day, and let it shape a clearer path to
            better health.{" "}
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link to="/register">
            <button className="px-6 py-2 border-landing-primary-hover border-2 uppercase font-landing-accent rounded-full hover:bg-landing-primary-hover transition flex items-center hover:text-white">
              View all features
              <ArrowRightIcon className="w-4 h-4 ml-2" />
            </button>
          </Link>
        </motion.div>
      </div>

      <div>
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-4 lg:gap-6 mt-16 auto-rows-auto 
          lg:auto-rows-[300px]"
        >
          {/* A */}
          <motion.div
            {...fadeLeftObj}
            className="lg:col-span-2 bg-[#f8f6f0] rounded-3xl flex flex-col justify-between overflow-hidden relative group h-[350px] md:h-[320px] lg:h-auto lg:row-span-2"
          >
            <div className="flex lg:flex-col gap-2 px-8 pt-8 md:px-5 md:pt-5 lg:px-8 lg:pt-8 items-start">
              <img
                src="/landing/stats/a.svg"
                alt="Brain icon"
                className="w-5 h-5 lg:w-8 lg:h-8 mt-1.5"
              />

              <div className="">
                <h3 className="text-lg lg:text-2xl font-semibold text-slate-800">
                  Insightful Lab Intelligence
                </h3>
                <p className="text-slate-500 leading-relaxed max-w-sm text-xs lg:text-base mt-2">
                  We interpret a broad spectrum of biomarkers to identify early
                  signals and support timely, personalised care.
                </p>
              </div>
            </div>

            <div className=" relative h-40 md:h-32 lg:h-64 w-full flex items-end justify-end">
              <img src="/landing/stats/A.png" alt="Lab Data" className="" />
            </div>

            <img
              src="/landing/stats/a-blur.webp"
              alt=""
              className="absolute top-0 right-0"
            />
          </motion.div>

          {/* B */}
          <motion.div
            {...fadeUpObj}
            className="rounded-3xl relative overflow-hidden group h-[500px] md:h-[320px] lg:h-auto lg:row-span-2"
          >
            <img
              src="/landing/stats/B.jpg"
              alt="Running"
              width={600}
              height={800}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>

            <div className="absolute top-6 left-6 md:top-4 md:left-4 md:gap-3 lg:top-6 lg:left-6 lg:gap-4 flex gap-4 text-white">
              <div className="flex flex-col items-center lg:gap-1">
                <img
                  src="/landing/stats/b-shoes.svg"
                  alt="Steps"
                  className="w-6 h-6"
                />
                <span className="font-semibold text-lg md:text-base lg:text-lg">
                  6000
                </span>
                <span className="text-xs text-white/80">Steps</span>
              </div>
              <div className="flex flex-col items-center lg:gap-1">
                <img
                  src="/landing/stats/b-run.svg"
                  alt="Activity"
                  className="w-6 h-6"
                />
                <span className="font-semibold text-lg md:text-base lg:text-lg">
                  2h 3m
                </span>
              </div>
            </div>

            <div className="absolute bottom-6 left-6 right-6 md:bottom-4 md:left-4 md:right-4 lg:bottom-6 lg:left-6 lg:right-6 text-white flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/landing/stats/b-wave.svg"
                  alt="Activity Wave"
                  className="w-8 h-8"
                />
                <h3 className="text-lg md:text-base lg:text-2xl font-semibold">
                  Move Better
                </h3>
              </div>
              <p className=" text-white/80 leading-relaxed max-w-sm text-xs lg:text-base">
                Keep your body engaged with daily activity guidance.
              </p>
            </div>
          </motion.div>

          {/* C */}
          <motion.div
            {...fadeRightObj}
            className="bg-[#d5e6df] rounded-3xl p-6 md:p-4 lg:p-6 relative overflow-hidden flex flex-col justify-between group h-[280px] md:h-[260px] lg:h-auto"
          >
            <img
              src="/landing/stats/c-shape-top-right.svg"
              alt="Shape"
              className="absolute top-0 right-0 w-32 opacity-50"
            />
            <div className="flex flex-col gap-3 z-10 w-full">
              <img
                src="/landing/stats/c-moon.svg"
                alt="Moon icon"
                className="w-8 h-8"
              />
              <h3 className="text-lg lg:text-2xl font-semibold text-slate-800">
                Sleep Better, Recover Smarter
              </h3>
              <p className="text-slate-500 leading-relaxed text-pretty max-w-48 md:max-w-full lg:max-w-48 text-sm lg:text-base">
                Gain clarity into your rest quality and take simple steps to
                improve recovery over time.
              </p>
            </div>
            <div className="absolute bottom-0 right-0 z-10">
              <img
                src="/landing/stats/c-sleep.svg"
                alt="Sleeping person"
                className="w-32 object-contain"
              />
            </div>
          </motion.div>

          {/* D */}
          <motion.div
            {...fadeRightObj}
            className="bg-white border border-[#efebe7] shadow-sm rounded-3xl p-6 md:p-4 lg:p-6 flex flex-col justify-center gap-4 group"
          >
            <img
              src="/landing/stats/d-pill.svg"
              alt="Pill icon"
              className="w-10 h-10"
            />
            <h3 className="text-lg lg:text-2xl font-semibold text-slate-800">
              Targeted Supplement Recommendations
            </h3>
            <p className="text-slate-500 leading-relaxed text-sm lg:text-base">
              Identify what your body needs and receive precise supplement
              guidance tailored to your health profile.
            </p>
          </motion.div>

          {/* E */}
          <motion.div
            {...fadeLeftObj}
            className="lg:col-span-2 bg-landing-primary-hover text-white rounded-3xl flex justify-between relative overflow-hidden group"
          >
            <div className="flex flex-col lg:flex-row">
              <div className="p-8 md:p-6 lg:p-8 flex flex-col gap-2 justify-center">
                <div className="flex items-center gap-2 bg-white/10 w-max px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider">
                  <img
                    src="/landing/stats/e.svg"
                    alt="Sparkles icon"
                    className="w-4 h-4"
                  />
                  PERSONALIZED
                </div>
                <h3 className="text-lg lg:text-2xl font-semibold">
                  Personalized Metabolism Care
                </h3>
                <p className="text-white/80 leading-relaxed max-w-xs text-balance text-sm lg:text-base">
                  Monitor your glucose patterns, receive personalised nutrition
                  guidance, and maintain stable, balanced health.
                </p>
              </div>

              <div className="flex justify-end md:items-end">
                <img
                  src="/landing/stats/E.png"
                  alt="Metabolism Data"
                  className="md:max-w-[220px] lg:max-w-none"
                />
              </div>
            </div>
          </motion.div>

          {/* F */}
          <motion.div
            {...fadeUpObj}
            className="lg:col-span-2 rounded-3xl relative overflow-hidden flex items-end p-8 md:p-6 lg:p-8 group h-[350px] md:h-[320px] lg:h-auto"
          >
            <img
              src="/landing/stats/f.jpg"
              alt="Salad"
              width={800}
              height={600}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>

            <div className="relative z-10 w-full md:w-3/4 lg:w-2/3 flex flex-col gap-3">
              <img
                src="/landing/stats/f.svg"
                alt="Apple icon"
                className="w-10 h-10"
              />

              <h3 className="text-2xl font-semibold text-white">
                Nutrition Analysis
              </h3>
              <p className="text-white/80 leading-relaxed text-balance">
                Elevate your eating habits with thoughtful, personalised
                recommendations.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Stats;
