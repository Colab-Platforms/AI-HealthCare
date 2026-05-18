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
      question: "How is this different from regular diet plans?",
      answer:
        "It’s personalized to your body, lifestyle, and goals not a one-size-fits-all plan.",
    },
    {
      question: "Will this work for my body type?",
      answer:
        "Yes, the plan adapts to your unique body composition and health needs.",
    },
    {
      question: "Do I need to follow strict restrictions?",
      answer:
        "No, we focus on sustainable habits instead of extreme restrictions.",
    },
    {
      question: "How soon will I see results?",
      answer:
        "Most people start noticing positive changes within a few weeks of consistency.",
    },
    {
      question: "Is it beginner-friendly?",
      answer:
        "Absolutely, it’s designed to be simple and easy to follow from day one.",
    },
    {
      question: "How is this different from weight loss apps?",
      answer:
        "You get real expert guidance and personalized support not just calorie tracking.",
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
