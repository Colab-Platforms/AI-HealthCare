import React from "react";

const SingleStep = ({ number, img, title, description, points }) => {
  return (
    <section className="container mx-auto px-5 lg:px-20 overflow-hidden flex flex-col lg:flex-row items-center lg:justify-between gap-10 lg:h-screen lg:sticky top-0 bg-[#faf9f8] pb-10 lg:pb-0">
      <div className="lg:w-1/2">
        <img src={img} alt={title} />
      </div>
      <div className="lg:w-1/2 flex flex-col items-start gap-4">
        <div className="text-xs lg:text-sm font-medium text-white bg-landing-primary-hover py-1 px-3 rounded-sm">
          {number}
        </div>
        <h3 className="text-2xl lg:text-4xl font-medium text-gray-800">
          {title}
        </h3>
        <p className="font-medium text-balance text-sm lg:text-base">
          {description}
        </p>
        <ul className="flex flex-col gap-2 leg-gap-1">
          {points.map((point, index) => (
            <li
              key={index}
              className="flex items-center gap-2 font-medium text-sm lg:text-base"
            >
              <img src="/how-works/check.svg" alt="" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default SingleStep;
