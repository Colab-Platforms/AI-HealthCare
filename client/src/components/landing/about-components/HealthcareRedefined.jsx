import React from "react";
import { motion } from "framer-motion";

const cards = [
    {
        id: 1,
        title: "Find it before you feel it",
        img: "landing/about/frame_1000001191.webp",
    },
    {
        id: 2,
        title: "You can't fix what,you can't see.",
        img: "landing/about/frame_1000001192.webp",
    },
    {
        id: 3,
        title: "Insights that lead somewhere.",
        img: "landing/about/frame_1000001193.webp",
    },
];

const fadeUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
};


export default function HealthcareRedefined() {
    return (
        <div className="w-full min-h-screen bg-gray-50 px-4 py-10 md:px-10 lg:px-20">

            <div className="w-full flex justify-center items-center pb-10 md:pb-6">
                <motion.button {...fadeUp} transition={{ delay: 0.4 }} className="bg-[#0F4747] text-white text-[24px] font-semibold font-landing-body flex items-center justify-center transition-all duration-300" style={{ width: '188px', height: '58px', borderRadius: '40px' }}>Our Vision</motion.button>
            </div>
            {/* Heading */}
            <div className="text-center max-w-8xl mx-auto mb-10">
                <h1 className="text-4xl md:text-6xl font-semibold">
                    <span className="font-landing-title italic text-teal-600">Healthcare</span>,<span className="font-landing-title"> redefined around you</span>
                </h1>
                <p className="text-gray-600 mt-4 text-md md:text-3xl  font-landing-body font-normal">
                    Your health isn’t something that should be checked once in a while.
                    We’re building a way for it to <br /> be understood and supported every day
                    simply and effortlessly.
                </p>
            </div>

            {/* Cards */}
            <div className="flex flex-col md:flex-col lg:flex-row gap-6 px-7">
                {cards.map((card) => (
                    <div
                        key={card.id}
                        className="w-full lg:flex-1 h-[528px] md:h-[528px] lg:h-[604px] rounded-2xl overflow-hidden relative group"
                    >
                        {/* Image */}
                        <img
                            src={card.img}
                            alt="card"
                            className="w-full h-full object-cover"
                        />

                        {/* Overlay */}
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition" />

                        {/* Text */}
                        <div className="absolute inset-0 flex items-end justify-center text-white text-center px-4">
                            <p className="text-sm md:text-[30px] h-28 flex flex-col justify-center font-landing-body leading-tight">
                                {card.title.split(",").map((line, i) => (
                                    <span key={i} className="block mt-2 first:mt-0">
                                        {line}
                                    </span>
                                ))}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}