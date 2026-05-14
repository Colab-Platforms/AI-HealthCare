import React from "react";

const Features = () => {
  return (
    <section className="container mx-auto py-24 px-5 lg:px-20 overflow-hidden flex flex-col items-center">
      <div className="max-w-2xl">
        <h2 className="text-landing-text font-landing-title font-semibold text-2xl md:text-4xl text-center max-w-md mx-auto">
          One system. Your body.
          <span className="text-landing-primary-hover font-semibold block">
            {" "}
            Fully understood.
          </span>
        </h2>
        <p className="text-base lg:text-lg text-landing-text/80 mt-4 text-balance text-center">
          From food to movement to metabolism everything comes together in one
          clear view.
        </p>
      </div>

      {/* Features Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-[3fr_1fr_1fr] md:grid-rows-2 gap-3 md:gap-4 mt-16 mx-auto w-full">
        {/* Card 1 — Large left, spans both rows */}
        <div className="group relative rounded-2xl overflow-hidden md:row-span-2 aspect-square md:aspect-auto">
          <img
            src="/weight-loss/features/1.jpg"
            alt="AI-driven insights"
            className="w-full h-full object-cover object-left absolute inset-0 transition-transform duration-500 ease-in-out group-hover:scale-105"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          {/* Content */}
          <div className="absolute bottom-0 left-0 p-5 md:p-6">
            <div className="mb-3">
              <img
                src="/weight-loss/features/1.1.svg"
                alt=""
                className="w-10 h-10 brightness-0 invert"
              />
            </div>
            <p className="text-white font-semibold text-base md:text-xl lg:text-2xl leading-snug max-w-[200px] md:max-w-xs">
              AI-driven insights tailored to your journey
            </p>
          </div>
        </div>

        {/* Card 2 — Top center, Faster progress */}
        <div className="group relative rounded-2xl overflow-hidden aspect-square">
          <img
            src="/weight-loss/features/2.jpg"
            alt="Faster progress"
            className="w-full h-full object-cover absolute inset-0 transition-transform duration-500 ease-in-out group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 p-4 md:p-5">
            <div className="mb-2">
              <img
                src="/weight-loss/features/2.1.svg"
                alt=""
                className="w-8 h-8 brightness-0 invert"
              />
            </div>
            <p className="text-white font-semibold text-base md:text-lg leading-snug max-w-[200px] md:max-w-xs">
              Faster progress with smart AI guidance
            </p>
          </div>
        </div>

        {/* Card 3 — Top right, Workout */}
        <div className="group relative rounded-2xl overflow-hidden md:row-span-2 aspect-square md:aspect-auto">
          <img
            src="/weight-loss/features/4.jpg"
            alt="Personalized workout"
            className="w-full h-full object-cover absolute inset-0 transition-transform duration-500 ease-in-out group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-0 left-0 p-4 md:p-5">
            <div className="mb-2">
              <img
                src="/weight-loss/features/4.1.svg"
                alt=""
                className="w-8 h-8 brightness-0 invert"
              />
            </div>
            <p className="text-white font-semibold text-base md:text-lg leading-snug max-w-[200px] md:max-w-xs">
              Personalized workout recommendations
            </p>
          </div>
        </div>

        {/* Card 4 — Bottom center, Diet Plan */}
        <div className="group relative rounded-2xl overflow-hidden aspect-square">
          <img
            src="/weight-loss/features/3.jpg"
            alt="Personalized diet plan"
            className="w-full h-full object-cover absolute inset-0 transition-transform duration-500 ease-in-out group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 p-4 md:p-5">
            <div className="mb-2">
              <img
                src="/weight-loss/features/3.1.svg"
                alt=""
                className="w-8 h-8 brightness-0 invert"
              />
            </div>
            <p className="text-white font-semibold text-base md:text-lg leading-snug max-w-[200px] md:max-w-xs">
              Personalized Diet Plan &amp; weight tracking
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;
