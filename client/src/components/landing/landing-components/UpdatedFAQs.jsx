import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";

const UpdatedFAQs = () => {
  // All accordion items start in deactivated/collapsed state (openIndex = null)
  const [openIndex, setOpenIndex] = useState(null);

  const faqItems = [
    {
      question: "How does Take Health work?",
      answer:
        "Upload your reports, and Take Health turns them into clear, easy-to-understand insights within minutes.",
    },
    {
      question: "Can I trust this with my health data?",
      answer:
        "Yes. Your data is securely handled and kept private at all times.",
    },
    {
      question: "What makes these insights feel personal, not one-size-fits-all?",
      answer:
        "Insights are tailored to your reports, your patterns, and what your body actually needs.",
    },
    {
      question: "Will I finally understand what my reports mean?",
      answer:
        "Yes. Everything is simplified so you can clearly understand what matters.",
    },
    {
      question: "Do I need medical knowledge to use this?",
      answer:
        "No. It’s designed to be simple and understandable for everyone.",
    },
    {
      question: "Is the app free to use?",
      answer:
        "Yes. Take Health is currently free and accessible to all.",
    },
  ];

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="w-full bg-[#FAF9F8] py-14 sm:py-24 px-4 sm:px-12 lg:px-20 font-landing-body border-b border-slate-200/50">
      <div className="max-w-9xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">

        {/* ─── LEFT COLUMN: TOP-LEFT TITLE ────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="lg:col-span-5 text-left"
        >
          <h2 className="text-3xl sm:text-5xl lg:text-[68px] font-medium font-landing-title text-[#000] leading-tight">
            Frequently Asked, <br />
            Clearly{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(90deg, #1B47B9 0%, #17133A 100%)" }}
            >
              Answered
            </span>
          </h2>
        </motion.div>

        {/* ─── RIGHT COLUMN: FAQ ACCORDION LIST ────────────────────────────────── */}
        <div className="lg:col-span-7 flex flex-col w-full text-left">
          {faqItems.map((item, index) => {
            const isOpen = openIndex === index;

            return (
              <div
                key={index}
                className="border-b border-slate-200/80 transition-colors"
              >
                {/* Question Row (Clickable Header) */}
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full py-6 flex items-center justify-between gap-4 text-left group focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span className={`text-lg sm:text-3xl font-medium transition-colors duration-200 ${isOpen ? "text-[#014343]" : "text-slate-800 group-hover:text-[#014343]"
                    }`}>
                    {item.question}
                  </span>

                  {/* '+' or '−' Icon with Motion Rotation */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${isOpen ? "bg-[#014343] text-white rotate-180" : "bg-slate-100 text-slate-700 group-hover:bg-emerald-100 group-hover:text-[#014343]"
                    }`}>
                    {isOpen ? (
                      <Minus className="w-4 h-4" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </div>
                </button>

                {/* Animated Drawer Answer Content */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="pb-6 text-sm sm:text-lg lg:text-xl text-slate-600 font-normal leading-relaxed pr-6">
                        {item.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default UpdatedFAQs;
