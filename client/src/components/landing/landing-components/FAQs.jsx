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
      question: "How does Take.Health work?",
      answer:
        "It’s a health tracking platform that brings together your food, activity, sleep, and lab reports in one place. Using AI, it connects these dots to show you what’s affecting your health and what you can do about it.",
    },
    {
      question: "Can I trust this with my health data?",
      answer:
        "We take data privacy seriously. Your information is encrypted and stored securely. You control what you share, and we don’t sell your personal health data to third parties.",
    },
    {
      question:
        "What makes these insights feel personal, not one-size-fits-all?",
      answer:
        "The app learns your patterns over time. It doesn’t just give generic advice—it connects your specific food choices, activity levels, sleep quality, and lab results to show you what’s actually moving the needle for *your* body.",
    },
    {
      question: "Will I finally understand what my reports mean?",
      answer:
        "Yes. The AI analyser breaks down complex medical terms into simple, actionable insights. It tells you what each marker means, whether it’s in the healthy range, and what lifestyle changes could help improve it.",
    },
    {
      question: "Do I need medical knowledge to use this?",
      answer:
        "Not at all. The app is designed for everyday people, not doctors. It translates medical data into plain language and gives you clear, practical steps you can follow.",
    },
    {
      question: "Is the app free to use?",
      answer:
        "You can start with the free version, which includes basic tracking and insights. For advanced features like AI lab analysis and personalized health plans, we offer a premium subscription.",
    },
  ];

  return (
    <motion.section
      {...fadeUp}
      className="container mx-auto py-24 px-5 flex flex-col lg:flex-row justify-between items-center gap-10"
    >
      <motion.div
        {...fadeLeft}
        className="w-full lg:w-1/2 flex flex-col justify-between py-2 lg:py-8"
      >
        <div>
          <h2 className=" font-landing-title text-3xl md:text-4xl/[3rem] text-balance mb-2">
            What it does. How it helps. <br />
            <span className="text-landing-primary-hover italic">
              Why it matters.
            </span>
          </h2>
        </div>
      </motion.div>

      <motion.div
        {...fadeRight}
        className="w-full lg:w-1/2 flex flex-col py-2 lg:py-8 mt-10 lg:mt-0"
      >
        <div className="w-full">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              className={`border-t border-[#e5e5e5] py-5 md:py-6 ${
                index === faqs.length - 1 ? "border-b" : ""
              }`}
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
                className="w-full flex items-center justify-between text-left focus:outline-none"
              >
                <h3 className="text-base md:text-lg text-gray-800 font-medium pr-8">
                  {faq.question}
                </h3>
                <span className="text-gray-500 shrink-0">
                  {openIndex === index ? (
                    <Minus className="w-5 h-5 stroke-[1.5]" />
                  ) : (
                    <Plus className="w-5 h-5 stroke-[1.5]" />
                  )}
                </span>
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  openIndex === index
                    ? "max-h-96 opacity-100 mt-4"
                    : "max-h-0 opacity-0"
                }`}
              >
                <p className="text-gray-600 text-sm md:text-base leading-relaxed">
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
