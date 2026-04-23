import React, { useState } from 'react';

const faqData = [
    {
        question: "What is Take Health and how does it work?",
        answer: "Take Health analyzes your health reports using AI and turns them into clear insights you can understand and act on."
    },
    {
        question: "How does Take Health analyze my health reports?",
        answer: "It reads your reports, identifies key markers, and simplifies everything into easy, actionable insights."
    },
    {
        question: "Can I track my health progress over time?",
        answer: "Yes, you can compare reports and see how your health changes over time in one place."
    },
    {
        question: "How is this different from a doctor’s consultation?",
        answer: "Take Health helps you understand your reports better, so you can make informed decisions alongside medical advice."
    },
    {
        question: "Is Take Health really free to use?",
        answer: "Yes, it’s currently free to use and accessible to everyone."
    },
    {
        question: "What makes Take Health different from other health apps?",
        answer: "It focuses on understanding your reports deeply and turning them into clear, personalised guidance not just tracking data."
    }
];

export default function Faq() {
    const [openIndex, setOpenIndex] = useState(null);

    const toggleFaq = (index) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <section className="relative w-full flex justify-center items-center px-4 pb-16 md:px-10 lg:px-20">
            <div className="relative w-full h-[500px] md:h-[600px] lg:h-[800px] overflow-hidden shadow-2xl" style={{ borderRadius: '40px' }}>
                <img loading="lazy" decoding="async"
                    src="/landing/about/frame_1000001190.webp"
                    alt="FAQ"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                />

                {/* <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent h-1/2"></div> */}

                <div className="absolute top-[10%] inset-x-0 flex flex-col items-center px-6 lg:px-20 z-10 w-full h-full overflow-y-auto pb-8">

                    <div className="inline-block text-center">
                        <h2 className="text-white text-[20px] md:text-4xl lg:text-4xl font-landing-title tracking-wide leading-tight mb-6 md:mb-16 lg:mb-20 px-4">
                            Got questions? We've got you.
                        </h2>

                        <div className="w-full flex flex-col text-left px-8 md:px-12 lg:px-24">
                            <div className="w-full h-[0.1px] bg-white"></div>

                            {faqData.map((faq, index) => (
                                <div key={index} className="w-full flex flex-col">
                                    <button
                                        onClick={() => toggleFaq(index)}
                                        className="w-full flex justify-between items-center py-3 md:py-5 transition-colors duration-300 focus:outline-none gap-4"
                                    >
                                        <span className="text-white text-[10px] md:text-[15px] lg:text-[18px] font-landing-body tracking-wider text-left">{faq.question}</span>
                                        <span className="text-white text-2xl md:text-4xl font-light">
                                            {openIndex === index ? '−' : '+'}
                                        </span>
                                    </button>

                                    <div
                                        className={`overflow-hidden transition-all duration-500 ease-in-out ${openIndex === index ? 'max-h-56 opacity-100 pb-6' : 'max-h-0 opacity-0'}`}
                                    >
                                        <p className="text-white/80 text-sm md:text-base pr-10 font-landing-body tracking-wide leading-relaxed">
                                            {faq.answer}
                                        </p>
                                    </div>

                                    <div className="w-full h-[0.1px] bg-white"></div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
