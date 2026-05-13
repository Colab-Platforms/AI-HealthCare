import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
};

const fadeLeft = {
  initial: { opacity: 0, x: -28 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
};

const fadeRight = {
  initial: { opacity: 0, x: 28 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
};

const FAQs = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const faqs = [
    {
      question: "What is diabetes and how can I manage it better?",
      answer:
        "Diabetes is a condition where your blood sugar levels stay higher than normal. Managing it becomes easier with the right food choices, activity, regular tracking, and understanding how your body responds every day.",
    },
    {
      question: "How does this help me control my blood sugar?",
      answer:
        "It helps you track patterns, understand your readings, and make smarter lifestyle choices that support more stable blood sugar levels over time.",
    },
    {
      question: "Will it tell me what to eat?",
      answer:
        "Yes. You’ll get simple food guidance, meal suggestions, and smarter eating recommendations based on your health goals and blood sugar needs.",
    },
    {
      question: "Is this suitable for Type 1 and Type 2 diabetes?",
      answer:
        "Yes. It can support both Type 1 and Type 2 diabetes by helping you stay informed, track progress, and build healthier daily habits.",
    },
    {
      question: "Will I understand what my readings mean?",
      answer:
        "Absolutely. Your readings are explained in a simple and easy-to-understand way, so you know what’s normal, what needs attention, and what steps to take next.",
    },
    {
      question: "Is this only for people with diabetes?",
      answer:
        "No. It’s also useful for people who want to improve their overall health, manage weight, monitor sugar levels, or reduce future health risks.",
    },
  ];

  return (
    <motion.section
      {...fadeUp}
      className="container mx-auto py-16 md:py-24 px-5 lg:px-20 flex flex-col lg:flex-row justify-between items-center gap-6 md:gap-10 overflow-hidden"
    >
      <motion.div
        {...fadeLeft}
        className="w-full lg:w-1/2 flex flex-col justify-between py-2 lg:py-8"
      >
        <div>
          <h2 className="font-semibold font-landing-title text-2xl md:text-4xl/[3rem] text-balance mb-2">
            What it does. How it helps. <br />
            <span className="text-landing-primary-hover italic">
              Why it matters.
            </span>
          </h2>
        </div>
      </motion.div>

      <motion.div
        {...fadeRight}
        className="w-full lg:w-1/2 flex flex-col py-2 lg:py-8 mt-6 md:mt-10 lg:mt-0 overflow-hidden"
      >
        <div className="w-full overflow-hidden">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              className={`border-t border-[#e5e5e5] py-4 sm:py-5 md:py-6 ${
                index === faqs.length - 1 ? "border-b" : ""
              } px-1 overflow-hidden`}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{
                duration: 0.45,
                delay: index * 0.05,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full flex items-start sm:items-center justify-between text-left focus:outline-none gap-3 group"
              >
                <h3 className="sm:text-base md:text-lg text-gray-800 font-medium break-words group-hover:text-gray-900 transition-colors flex-1">
                  {faq.question}
                </h3>
                <span className="text-gray-500 shrink-0 pt-1">
                  {openIndex === index ? (
                    <Minus className="w-4 h-4 sm:w-5 sm:h-5 stroke-[1.5]" />
                  ) : (
                    <Plus className="w-4 h-4 sm:w-5 sm:h-5 stroke-[1.5]" />
                  )}
                </span>
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  openIndex === index
                    ? "max-h-96 sm:max-h-full opacity-100 mt-3 sm:mt-4"
                    : "max-h-0 opacity-0"
                }`}
              >
                <p className="text-gray-600 text-sm sm:text-sm md:text-base leading-relaxed break-words pr-2">
                  {faq.answer}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.section>
  );
};

export default FAQs;
