import React from "react";

const Hero = () => {
  return (
    <section className="relative z-10 h-screen flex items-center justify-center text-center  overflow-hidden">
      <div className="w-full h-full overflow-hidden absolute inset-0">
        <img
          src="/how-works/hero.webp"
          alt=""
          className="object-cover object-top w-full h-screen"
        />
      </div>

      <div className="container px-5 lg:px-20 mx-auto relative z-10 text-white pb-72">
        <h1 className="text-3xl lg:text-6xl text-white font-landing-accent-2 text-balance">
          Uncover Hidden Health Risks
        </h1>
        <p className="text-xl lg:text-3xl font-extralight text-landing-light-bg mt-1 font-landing-accent max-w-4xl mx-auto capitalize mb-5 text-balance">
          1,000+ Health Markers Analyzed.
        </p>
      </div>
    </section>
  );
};

export default Hero;
