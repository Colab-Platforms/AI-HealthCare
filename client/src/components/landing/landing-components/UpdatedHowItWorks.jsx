import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, FileText } from "lucide-react";

const UpdatedHowItWorks = ({ cardImages = {} }) => {
  const steps = [
    {
      number: "1",
      title: "Drop Your Reports",
      description: "Upload your health reports seamlessly and let us do the rest.",
      imageKey: "step1",
      // Default fallback UI matching screenshot Card 1
      renderGraphic: () => (
        <div className="w-full h-full relative flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          {/* Background Image 1 */}
          <img
            src="/updated-landing/hitw-bg-2.png"
            alt="Step 1 Background"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />

          {/* Frosted Glass Translucent Overlay Upload Card */}
          <div className="relative z-10 w-full max-w-[280px] sm:max-w-[340px] bg-[#2A231F]/40 backdrop-blur-2xl border border-white/20 rounded-xl p-3 sm:p-4 text-white shadow-2xl">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl border border-white/20 flex items-center justify-center text-white/90 flex-shrink-0">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 stroke-[1.5]" />
              </div>
              <div className="flex-1 overflow-hidden text-left">
                <p className="text-xs sm:text-sm font-medium text-white truncate">Medical_Report.pdf</p>
              </div>
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-emerald-400 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] sm:text-xs text-white/80 mb-1.5 font-normal">
              <span>Upload complete</span>
              <span className="font-medium text-white">100%</span>
            </div>
            <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
              <div className="w-full h-full bg-emerald-400 rounded-full" />
            </div>
          </div>
        </div>
      ),
    },
    {
      number: "2",
      title: "We Analyze It for You",
      description: "Our AI reviews your data for key health insights.",
      imageKey: "step2",
      // Default fallback UI matching screenshot Card 2
      renderGraphic: () => (
        <div className="w-full h-full bg-[#014343] relative flex items-end justify-center pt-6 sm:pt-8 px-3 sm:px-4 overflow-hidden">
          {/* Simulated Mobile Display Card */}
          <div className="w-full max-w-[230px] sm:max-w-[270px] bg-white rounded-t-2xl sm:rounded-t-[28px] p-4 sm:p-5 pb-5 shadow-2xl text-slate-900 flex flex-col gap-2.5 sm:gap-3 h-[calc(100%-12px)] text-left">
            <div className="text-[10px] sm:text-xs font-bold text-slate-400">9:41</div>
            <p className="text-xs sm:text-sm font-black text-slate-900 mb-0.5">Analysis Result</p>

            <div className="flex items-center justify-between bg-slate-50 p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs">
              <span className="font-medium text-slate-700">Vitamin D level</span>
              <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Optimal</span>
            </div>

            <div className="flex items-center justify-between bg-slate-50 p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs">
              <span className="font-medium text-slate-700">Magnesium index</span>
              <span className="font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">Deficient</span>
            </div>

            <div className="flex items-center justify-between bg-slate-50 p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs">
              <span className="font-medium text-slate-700">Glucose regulation</span>
              <span className="font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">Normal</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      number: "3",
      title: "Tailored Recommendations",
      description: "Turn your medical reports into something you can actually understand and act on.",
      imageKey: "step3",
      // Default fallback UI matching screenshot Card 3
      renderGraphic: () => (
        <div className="w-full h-full relative flex items-end justify-center p-4 sm:p-6 overflow-hidden">
          {/* Background Image 2 */}
          <img
            src="/updated-landing/hitw-bg-1.png"
            alt="Step 3 Background"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />

          {/* Glassmorphic Overlay Recommendations Card */}
          <div className="relative z-10 w-full bg-white/15 backdrop-blur-xl border border-white/25 rounded-xl sm:rounded-2xl p-4 sm:p-5 text-white shadow-xl text-left">
            <p className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest text-emerald-300 mb-2 sm:mb-3">RECOMMENDED ACTIONS</p>

            <div className="mb-2 sm:mb-3 pb-2 sm:pb-3 border-b border-white/10">
              <p className="text-xs sm:text-sm font-bold text-white leading-tight">Walk 15 mins after lunch</p>
              <p className="text-[10px] sm:text-xs text-white/70 mt-0.5">Supports Glucose Regulation</p>
            </div>

            <div>
              <p className="text-xs sm:text-sm font-bold text-white leading-tight">Magnesium glycinate</p>
              <p className="text-[10px] sm:text-xs text-white/70 mt-0.5">200mg before sleep</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      number: "4",
      title: "Health Progress Insights",
      description: "Track your health journey with smart progress tracking.",
      imageKey: "step4",
      // Default fallback UI matching screenshot Card 4
      renderGraphic: () => (
        <div className="w-full h-full bg-[#014343] relative flex items-end justify-center pt-6 sm:pt-8 px-3 sm:px-4 overflow-hidden">
          {/* Simulated Mobile Screen */}
          <div className="w-full max-w-[230px] sm:max-w-[270px] bg-white rounded-t-2xl sm:rounded-t-[28px] p-4 sm:p-5 pb-5 shadow-2xl text-slate-900 flex flex-col gap-3 h-[calc(100%-12px)] text-left">
            <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-slate-400">
              <span>9:41</span>
              <div className="w-3.5 h-1.5 bg-slate-800 rounded-sm" />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-black text-slate-900">Wellness Score</span>
              <span className="text-sm sm:text-base font-black text-sky-600">94%</span>
            </div>

            {/* Weekly Bar Chart */}
            <div className="flex items-end justify-between gap-1.5 h-20 sm:h-28 pt-2 border-t border-slate-100">
              <div className="flex flex-col items-center gap-1 flex-1">
                <div className="w-full bg-sky-300 h-8 sm:h-10 rounded-md" />
                <span className="text-[9px] text-slate-400">Mon</span>
              </div>
              <div className="flex flex-col items-center gap-1 flex-1">
                <div className="w-full bg-sky-400 h-11 sm:h-14 rounded-md" />
                <span className="text-[9px] text-slate-400"></span>
              </div>
              <div className="flex flex-col items-center gap-1 flex-1">
                <div className="w-full bg-sky-400 h-12 sm:h-16 rounded-md" />
                <span className="text-[9px] text-slate-400"></span>
              </div>
              <div className="flex flex-col items-center gap-1 flex-1">
                <div className="w-full bg-sky-300 h-9 sm:h-12 rounded-md" />
                <span className="text-[9px] text-slate-400"></span>
              </div>
              <div className="flex flex-col items-center gap-1 flex-1">
                <div className="w-full bg-sky-500 h-14 sm:h-18 rounded-md" />
                <span className="text-[9px] text-slate-400"></span>
              </div>
              <div className="flex flex-col items-center gap-1 flex-1">
                <div className="w-full bg-blue-600 h-16 sm:h-20 rounded-md" />
                <span className="text-[9px] text-slate-400">Sun</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <section className="w-full bg-[#FAF9F8] py-16 sm:py-28 px-4 sm:px-12 lg:px-20 font-landing-body border-b border-slate-200/50">
      <div className="max-w-[1920px] mx-auto flex flex-col items-center text-center">

        {/* Upper Tag Title */}
        <motion.span
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="text-xs sm:text-lg font-extrabold uppercase tracking-widest text-[#014343] mb-2"
        >
          HOW IT WORKS
        </motion.span>

        {/* Main Section Title */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-7xl lg:text-[64px] font-semibold font-landing-title text-[#000] text-center max-w-6xl leading-tight mb-3"
        >
          Turning Complexity <br className="sm:hidden" />
          Into <span className="text-[#014343]">Clarity</span>
        </motion.h2>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-sm sm:text-xl lg:text-3xl font-medium text-slate-600 max-w-5xl lg:max-w-3xl mb-8 sm:mb-16 leading-relaxed text-center px-2"
        >
          See how Take Health analyzes your data, explains what it means, and guides you toward better health.
        </motion.p>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 xl:gap-8 w-full max-w-[1700px]">
          {steps.map((step, idx) => {
            const customImg = cardImages[step.imageKey];

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, delay: 0.1 * idx }}
                className="flex flex-col text-left group"
              >
                {/* Image/Graphic Container */}
                <div className="relative w-full h-[230px] sm:h-[410px] lg:h-[440px] xl:h-[460px] rounded-2xl sm:rounded-[28px] overflow-hidden bg-slate-100 border border-slate-200/80 shadow-sm transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-1">

                  {/* Step Number Badge */}
                  <div className="absolute top-4 left-4 sm:top-5 sm:left-5 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-xs font-bold flex items-center justify-center border border-white/20">
                    {step.number}
                  </div>

                  {/* Render Custom Image if provided, else fallback graphic */}
                  {customImg ? (
                    <img
                      src={customImg}
                      alt={step.title}
                      className="w-full h-full object-cover rounded-2xl sm:rounded-[32px]"
                    />
                  ) : (
                    step.renderGraphic()
                  )}
                </div>

                {/* Card Title */}
                <h3 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-slate-900 mt-4 sm:mt-6 mb-1 sm:mb-2 font-diatype-expanded leading-snug group-hover:text-[#014343] transition-colors text-left">
                  {step.title}
                </h3>

                {/* Card Description */}
                <p className="text-xs sm:text-base lg:text-lg text-slate-600 font-normal leading-relaxed text-left">
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default UpdatedHowItWorks;
