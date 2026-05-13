import React from "react";

const Features = () => {
  const cardStyle =
    "bg-[#f8faf2] border-[1px] border-[#a4dec8] rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-8";
  return (
    <section className="container mx-auto py-24 px-5 lg:px-20 overflow-hidden flex flex-col items-center">
      <div className="max-w-2xl">
        <h2 className="text-landing-text font-landing-title font-semibold text-2xl md:text-4xl text-center max-w-md mx-auto">
          Everything You Need to Manage
          <span className="text-landing-primary-hover font-semibold">
            {" "}
            Diabetes
          </span>
        </h2>
        <p className="lg:text-lg text-landing-text/80 mt-4 text-balance text-center">
          Backed by medical understanding and behavioural science, helping you
          make better decisions everyday.
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-4 md:gap-8 mt-16 mx-auto w-full">
        {/* Card 1: Smart Glucose Tracking — col 1, row 1 */}
        <div className={`${cardStyle} md:col-start-1 md:row-start-1`}>
          <div className="flex items-center gap-2">
            <div className="p-3 md:p-4 bg-white rounded-full">
              <img src="/diabetes/features/1.2.svg" alt="" />
            </div>
            <div>
              <h4 className="text-landing-text font-semibold text-lg md:text-2xl">
                Smart Glucose Tracking
              </h4>
              <p className="text-landing-text font-medium text-sm md:text-md">
                See trends, not just numbers
              </p>
            </div>
          </div>
          <img src="/diabetes/features/1.1.svg" alt="" />
        </div>

        {/* Center image — col 2, spans both rows */}
        <div className="rounded-2xl overflow-hidden md:col-start-2 md:row-start-1 md:row-span-2">
          <img
            src="/diabetes/features/0.jpg"
            alt="Feature visual"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Card 3: Diet & Nutrition Plans — col 3, row 1 */}
        <div className={`${cardStyle} md:col-start-3 md:row-start-1`}>
          <div className="flex items-center gap-2">
            <div className="p-3 md:p-4 bg-white rounded-full">
              <img src="/diabetes/features/3.2.svg" alt="" />
            </div>
            <div>
              <h4 className="text-landing-text font-semibold text-lg md:text-2xl">
                Diet & Nutrition Plans
              </h4>
              <p className="text-landing-text font-medium text-sm md:text-md">
                Know what affects your sugar
              </p>
            </div>
          </div>
          <img src="/diabetes/features/3.1.png" alt="" />
        </div>

        {/* Card 2: Daily Guidance — col 1, row 2 */}
        <div className={`${cardStyle} md:col-start-1 md:row-start-2`}>
          <div className="flex items-center gap-2">
            <div className="p-3 md:p-4 bg-white rounded-full">
              <img src="/diabetes/features/2.2.svg" alt="" />
            </div>
            <div>
              <h4 className="text-landing-text font-semibold text-lg md:text-2xl">
                Daily Guidance
              </h4>
              <p className="text-landing-text font-medium text-sm md:text-md">
                Simple steps, every day
              </p>
            </div>
          </div>
          <img src="/diabetes/features/2.1.svg" alt="" />
        </div>

        {/* Card 4: Reminders & Consistency — col 3, row 2 */}
        <div className={`${cardStyle} md:col-start-3 md:row-start-2`}>
          <div className="flex items-center gap-2">
            <div className="p-3 md:p-4 bg-white rounded-full">
              <img src="/diabetes/features/4.2.svg" alt="" />
            </div>
            <div>
              <h4 className="text-landing-text font-semibold text-lg md:text-2xl">
                Reminders & Consistency
              </h4>
              <p className="text-landing-text font-medium text-sm md:text-md">
                Stay on track without effort
              </p>
            </div>
          </div>
          <img src="/diabetes/features/4.1.svg" alt="" />
        </div>
      </div>
    </section>
  );
};

export default Features;
