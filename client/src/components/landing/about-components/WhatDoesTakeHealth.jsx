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
        <section className="pt-[100px] lg:pt-[205px] px-5 lg:px-0 lg:ml-[72px] lg:mr-[54px]">
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

                <div className="w-1/2 relative min-h-[1152px] z-10">
                    <div className="flex justify-between items-start w-full max-w-[832px] absolute px-10" style={{ top: '206px', left: '0px' }}>
                        <div className="relative flex flex-col items-center justify-center shrink-0" style={{ width: '216.51px', height: '216.51px' }}>
                            <img src="/landing/about/Ellipse 195.png" alt="circle" className="absolute inset-0 w-full h-full object-contain" />
                            <div className="relative z-10 flex flex-col items-center text-center">
                                <span className="text-white text-[40px] font-landing-body font-normal leading-tight">90%</span>
                                <span className="text-white text-[18px] font-landing-body font-normal leading-tight mt-1">of health data is <br /> never fully used</span>
                            </div>
                        </div>
                        <div className="relative flex flex-col items-center justify-center shrink-0" style={{ width: '216.51px', height: '216.51px' }}>
                            <img src="/landing/about/Ellipse 195.png" alt="circle" className="absolute inset-0 w-full h-full object-contain" />
                            <div className="relative z-10 flex flex-col items-center text-center">
                                <span className="text-white text-[40px] font-landing-body font-normal leading-tight whitespace-nowrap">1 in 3</span>
                                <span className="text-white text-[18px] font-landing-body font-normal leading-tight mt-1">people don’t understand <br /> their reports</span>
                            </div>
                        </div>
                        <div className="relative flex flex-col items-center justify-center shrink-0" style={{ width: '216.51px', height: '216.51px' }}>
                            <img src="/landing/about/Ellipse 195.png" alt="circle" className="absolute inset-0 w-full h-full object-contain" />
                            <div className="relative z-10 flex flex-col items-center text-center">
                                <span className="text-white text-[40px] font-landing-body font-normal leading-tight">50%</span>
                                <span className="text-white text-[18px] font-landing-body font-normal leading-tight mt-1">of health depends <br /> on lifestyle</span>
                            </div>
                        </div>
                    </div>

                    <div className="absolute flex flex-col items-center text-center gap-12" style={{ top: '540px', left: '28px', width: '788px' }}>
                        <motion.h2 {...fadeUp} className="text-white text-[60px] leading-tight font-landing-title">
                            What Does <span className="italic font-normal">Take Health</span> Do?
                        </motion.h2>
                        <motion.p {...fadeUp} transition={{ delay: 0.2 }} className="text-white text-[30px] font-medium font-landing-body leading-snug tracking-tight">
                            Your health data, transformed into clear, science-backed insights personalized to help you <br /> take control and build a longer, healthier life.
                        </motion.p>
                        <motion.button {...fadeUp} transition={{ delay: 0.4 }} className="bg-[#C2D5CD] hover:bg-white text-black text-[24px] font-semibold font-landing-body flex items-center justify-center transition-all duration-300" style={{ width: '188px', height: '58px', borderRadius: '40px' }}>
                            Start Testing
                        </motion.button>
                    </div>
                </div>

                <div className="w-1/2 relative min-h-full">
                    <img src="/landing/about/Longevity.webp" alt="Longevity" className="absolute inset-0 w-full h-full object-cover" style={{ borderTopRightRadius: '64px', borderBottomRightRadius: '64px' }} />
                    <div className="absolute inset-x-0 bottom-20 px-20 text-center">
                        <h2 className="text-white text-[85px] leading-tight font-landing-title italic">Longevity Starts <br /> Here</h2>
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
                        height: '350px'
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
                    <div className="flex justify-between items-center w-full px-4 relative z-10" style={{ top: '60px' }}>
                        {/* 90% */}
                        <div className="relative flex flex-col items-center justify-center" style={{ width: '93.76px', height: '93.76px' }}>
                            <img src="/landing/about/Ellipse 195.png" alt="circle" className="absolute inset-0 w-full h-full object-contain" />
                            <div className="z-10 text-center flex flex-col items-center pt-1">
                                <span className="text-white text-[14px] font-landing-body leading-none">90%</span>
                                <span className="text-white text-[7.5px] font-landing-body leading-tight mt-0.5">of health data is <br /> never fully used</span>
                            </div>
                        </div>
                        {/* 1 in 3 */}
                        <div className="relative flex flex-col items-center justify-center" style={{ width: '93.76px', height: '93.76px' }}>
                            <img src="/landing/about/Ellipse 195.png" alt="circle" className="absolute inset-0 w-full h-full object-contain" />
                            <div className="z-10 text-center flex flex-col items-center pt-1">
                                <span className="text-white text-[14px] font-landing-body leading-none">1 in 3</span>
                                <span className="text-white text-[7.5px] font-landing-body leading-tight mt-0.5">people don’t understand <br /> their reports</span>
                            </div>
                        </div>
                        {/* 50% */}
                        <div className="relative flex flex-col items-center justify-center" style={{ width: '93.76px', height: '93.76px' }}>
                            <img src="/landing/about/Ellipse 195.png" alt="circle" className="absolute inset-0 w-full h-full object-contain" />
                            <div className="z-10 text-center flex flex-col items-center pt-1">
                                <span className="text-white text-[14px] font-landing-body leading-none">50%</span>
                                <span className="text-white text-[7.5px] font-landing-body leading-tight mt-0.5">of health depends <br /> on lifestyle</span>
                            </div>
                        </div>
                    </div>

                    {/* Content Section (Mobile) */}
                    <div
                        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center text-center gap-4 w-[320px] z-10 top-[180px]"

                    >
                        <h2 className="text-white text-[14px] font-landing-title leading-tight">
                            What Does <span className="italic font-normal">Take Health</span> Do?
                        </h2>
                        <p className="text-white text-[10px] font-landing-body font-medium leading-[1.6] max-w-[280px]">
                            Your health data, transformed into clear, science-backed insights personalized to help you <br /> take control and build a longer, healthier life.
                        </p>
                        <button className="bg-[#C2D5CD] rounded-[16px] text-black text-[10px] font-bold flex items-center justify-center" style={{ width: '69px', height: '23px', marginTop: '10px' }}>
                            Start Testing
                        </button>
                    </div>
                </div>

                {/* Lower Part (Image - Reduced height for mobile) */}
                <div
                    className="relative w-full h-[400px] overflow-hidden"
                    style={{ borderRadius: '12px' }}
                >
                    <img src="/landing/about/Longevity.webp" alt="Longevity" className="absolute inset-0 w-full h-90% object-cover" />
                    <div className="absolute inset-0 bg-black/5" />
                    <div className="absolute inset-x-0 bottom-6 px-6 text-center">
                        <h2 className="text-white text-[32px] leading-tight font-landing-title italic">Longevity Starts <br /> Here</h2>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default WhatDoesTakeHealth;
