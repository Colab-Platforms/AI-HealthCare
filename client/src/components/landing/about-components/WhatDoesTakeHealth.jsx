import React from "react";
import { motion } from "framer-motion";

const fadeUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
};

const WhatDoesTakeHealth = () => {
    return (
        <section className="container mx-auto mt-28 px-4 sm:px-8">
            {/* Desktop View */}
            <div className="hidden lg:flex max-w-[1863px] mx-auto overflow-hidden relative"
                style={{
                    background: 'linear-gradient(180deg, #086262 0%, #0F4747 51%)',
                    borderRadius: '50px',
                    minHeight: '1152px'
                }}
            >
                {/* Background Decorative Shapes */}
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0 opacity-40">
                    <div
                        style={{
                            width: '350px',
                            height: '350px',
                            position: 'absolute',
                            top: '-112px',
                            left: '-112px',
                            backgroundColor: '#90AEAA',
                            WebkitMaskImage: 'url(/landing/about/polygonGroup.webp)',
                            maskImage: 'url(/landing/about/polygonGroup.webp)',
                            WebkitMaskSize: 'contain',
                            maskSize: 'contain',
                            WebkitMaskRepeat: 'no-repeat',
                            maskRepeat: 'no-repeat'
                        }}
                    />
                </div>

                <div className="w-full flex items-stretch">
                    {/* Left Column */}
                    <div className="w-1/2 relative z-10 flex flex-col items-center py-20 px-6 xl:px-20">
                        {/* Stats Row */}
                        <div className="w-full max-w-[632px] flex justify-center items-center gap-4 mt-32">
                            <div className="relative flex flex-col items-center justify-center shrink-0 w-[120px] xl:w-[168px] h-[120px] xl:h-[168px]">
                                <img loading="lazy" decoding="async" src="/landing/about/Ellipse 195.png" alt="circle" className="absolute inset-0 w-full h-full object-contain" />
                                <div className="relative z-10 flex flex-col items-center text-center">
                                    <span className="text-white text-xl xl:text-[40px] font-landing-body font-normal leading-tight">90%</span>
                                    <span className="text-white text-[8px] xl:text-[12px] font-landing-body font-normal leading-tight mt-1">of health data is <br /> never fully used</span>
                                </div>
                            </div>
                            <div className="relative flex flex-col items-center justify-center shrink-0 w-[120px] xl:w-[168px] h-[120px] xl:h-[168px]">
                                <img loading="lazy" decoding="async" src="/landing/about/Ellipse 195.png" alt="circle" className="absolute inset-0 w-full h-full object-contain" />
                                <div className="relative z-10 flex flex-col items-center text-center">
                                    <span className="text-white text-xl xl:text-[40px] font-landing-body font-normal leading-tight whitespace-nowrap">1 in 3</span>
                                    <span className="text-white text-[8px] xl:text-[12px] font-landing-body font-normal leading-tight mt-1">people don't understand <br /> their reports</span>
                                </div>
                            </div>
                            <div className="relative flex flex-col items-center justify-center shrink-0 w-[120px] xl:w-[168px] h-[120px] xl:h-[168px]">
                                <img loading="lazy" decoding="async" src="/landing/about/Ellipse 195.png" alt="circle" className="absolute inset-0 w-full h-full object-contain" />
                                <div className="relative z-10 flex flex-col items-center text-center">
                                    <span className="text-white text-xl xl:text-[40px] font-landing-body font-normal leading-tight">50%</span>
                                    <span className="text-white text-[8px] xl:text-[12px] font-landing-body font-normal leading-tight mt-1">of health depends <br /> on lifestyle</span>
                                </div>
                            </div>
                        </div>

                        {/* Content Section */}
                        <div className="mt-40 xl:mt-60 flex flex-col items-center text-center gap-8 xl:gap-12 max-w-[600px]">
                            <motion.h2 {...fadeUp} className="text-white text-3xl xl:text-4xl font-landing-title">
                                What Does <span className="italic font-normal">Take Health</span> Do?
                            </motion.h2>
                            <motion.p {...fadeUp} transition={{ delay: 0.2 }} className="text-white text-lg xl:text-2xl font-medium font-landing-body leading-snug tracking-tight">
                                Your health data, transformed into clear, science-backed insights personalized to help you take control and build a longer, healthier life.
                            </motion.p>
                            <motion.button {...fadeUp} transition={{ delay: 0.4 }} className="bg-[#C2D5CD] hover:bg-white text-black text-lg xl:text-[24px] font-semibold font-landing-body flex items-center justify-center transition-all duration-300 w-[160px] xl:w-[188px] h-[48px] xl:h-[58px]" style={{ borderRadius: '40px' }}>
                                Start Testing
                            </motion.button>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="w-1/2 relative">
                        <img loading="lazy" decoding="async" src="/landing/about/Longevity.webp" alt="Longevity" className="absolute inset-0 w-full h-full object-cover" style={{ borderTopRightRadius: '48px', borderBottomRightRadius: '48px' }} />
                        <div className="absolute inset-x-0 bottom-20 px-10 xl:px-20 text-center">
                            <h2 className="text-white text-4xl xl:text-6xl leading-tight font-landing-title italic">Longevity Starts <br /> Here</h2>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile View (Two Parts) */}
            <div className="lg:hidden flex flex-col gap-6">
                {/* Upper Part (Stats + Content) */}
                <div
                    className="relative w-full overflow-hidden"
                    style={{
                        background: 'linear-gradient(180deg, #086262 0%, #0F4747 51%)',
                        borderRadius: '12px',
                        minHeight: '400px'
                    }}
                >
                    {/* Background Decorative Shapes (Mobile) */}
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0 opacity-40">
                        <div
                            style={{
                                width: '140px',
                                height: '140px',
                                position: 'absolute',
                                top: '-50px',
                                left: '-50px',
                                backgroundColor: '#90AEAA',
                                WebkitMaskImage: 'url(/landing/about/polygonGroup.webp)',
                                maskImage: 'url(/landing/about/polygonGroup.webp)',
                                WebkitMaskSize: 'contain',
                                maskSize: 'contain',
                                WebkitMaskRepeat: 'no-repeat',
                                maskRepeat: 'no-repeat'
                            }}
                        />
                    </div>

                    {/* Stats Row (Mobile) */}
                    <div className="flex justify-center items-center gap-2 w-full px-4 pt-12 relative z-10">
                        {/* 90% */}
                        <div className="relative flex flex-col items-center justify-center flex-shrink-0 w-[85px] h-[85px]">
                            <img loading="lazy" decoding="async" src="/landing/about/Ellipse 195.png" alt="circle" className="absolute inset-0 w-full h-full object-contain" />
                            <div className="z-10 text-center flex flex-col items-center pt-1">
                                <span className="text-white text-[12px] font-landing-body leading-none">90%</span>
                                <span className="text-white text-[6px] font-landing-body leading-tight mt-0.5">of health data is <br /> never fully used</span>
                            </div>
                        </div>
                        {/* 1 in 3 */}
                        <div className="relative flex flex-col items-center justify-center flex-shrink-0 w-[85px] h-[85px]">
                            <img loading="lazy" decoding="async" src="/landing/about/Ellipse 195.png" alt="circle" className="absolute inset-0 w-full h-full object-contain" />
                            <div className="z-10 text-center flex flex-col items-center pt-1">
                                <span className="text-white text-[12px] font-landing-body leading-none">1 in 3</span>
                                <span className="text-white text-[6px] font-landing-body leading-tight mt-0.5">people don't understand <br /> their reports</span>
                            </div>
                        </div>
                        {/* 50% */}
                        <div className="relative flex flex-col items-center justify-center flex-shrink-0 w-[85px] h-[85px]">
                            <img loading="lazy" decoding="async" src="/landing/about/Ellipse 195.png" alt="circle" className="absolute inset-0 w-full h-full object-contain" />
                            <div className="z-10 text-center flex flex-col items-center pt-1">
                                <span className="text-white text-[12px] font-landing-body leading-none">50%</span>
                                <span className="text-white text-[6px] font-landing-body leading-tight mt-0.5">of health depends <br /> on lifestyle</span>
                            </div>
                        </div>
                    </div>

                    {/* Content Section (Mobile) */}
                    <div
                        className="flex flex-col items-center text-center gap-4 w-full px-6 z-10 py-10"
                    >
                        <h2 className="text-white text-xl font-landing-title leading-tight">
                            What Does <span className="italic font-normal">Take Health</span> Do?
                        </h2>
                        <p className="text-white text-sm font-landing-body font-medium leading-relaxed max-w-[320px]">
                            Your health data, transformed into clear, science-backed insights personalized to help you take control and build a longer, healthier life.
                        </p>
                        <button className="bg-[#C2D5CD] rounded-full text-black text-xs font-bold flex items-center justify-center w-[120px] h-[36px] mt-4">
                            Start Testing
                        </button>
                    </div>
                </div>

                {/* Lower Part (Image) */}
                <div
                    className="relative w-full h-[50vh] md:h-[60vh] overflow-hidden rounded-xl p-2"
                >
                    <img loading="lazy" decoding="async" src="/landing/about/Longevity.webp" alt="Longevity" className="absolute h-auto m-0 inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-x-0 bottom-1 px-3 text-center">
                        <p className="text-white text-4xl md:text-6xl leading-tight font-landing-title italic">Longevity Starts Here</p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default WhatDoesTakeHealth;
