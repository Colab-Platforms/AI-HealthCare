import React from "react";
import SingleStep from "./SingleStep";

const Steps = () => {
  const stepsData = [
    {
      number: "Step 1",
      img: "/how-works/step1.webp",
      title: "Drop Your Reports",
      description:
        "A refined journey from health records to intelligent insights and personalized wellness strategies.",
      points: [
        "Securely upload your diagnostic reports and lab results.",
        "Seamless and secure.",
        "Built for clarity.",
      ],
    },
    {
      number: "Step 2",
      img: "/how-works/step2.webp",
      title: "We Analyze It for You",
      description:
        "Everything you need to stay informed and in control of your well-being.",
      points: [
        "Reads key markers.",
        "Turns complex info into clear, bite-sized insights.",
        "Know what’s going on with your health instantly.",
      ],
    },
    {
      number: "Step 3",
      img: "/how-works/step3.webp",
      title: "Tailored Wellness Recommendations",
      description:
        "Turn your medical reports into something you can actually understand and act on.",
      points: [
        "Tailored lifestyle guidance.",
        "Focused on longevity.",
        "Elevated everyday health.",
      ],
    },
    {
      number: "Step 4",
      img: "/how-works/step4.webp",
      title: "Health Progress Insights",
      description:
        "Turn your medical reports into something you can actually understand and act on.",
      points: [
        "Compare past and present reports in one place.",
        "Identify improvements or early warning signs.",
        "Stay ahead of your health with real insights.",
      ],
    },
  ];

  return (
    <section className=" pt-24">
      <div className="container mx-auto px-5 lg:px-20 flex justify-center text-center items-center relative z-10 pb-8 lg:pb-0 text-balance">
        <h2 className=" font-landing-title text-2xl md:text-4xl capitalize">
          take control with{" "}
          <span className="text-landing-primary-hover italic">Take Health</span>
        </h2>
      </div>
      <div>
        {stepsData.map((step, index) => (
          <SingleStep key={index} {...step} />
        ))}
      </div>
    </section>
  );
};

export default Steps;
