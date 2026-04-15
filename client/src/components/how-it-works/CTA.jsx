import React from "react";
import { Link } from "react-router-dom";

const CTA = () => {
  return (
    <section className="container mx-auto py-24 px-5 lg:px-20 overflow-hidden flex flex-col lg:flex-row justify-between items-center">
      <div className="lg:w-1/2">
        <img src="/how-works/cta.webp" alt="" />
      </div>
      <div className="lg:w-1/2 pt-8 lg:pt-0">
        <h2 className=" text-2xl md:text-4xl/[3.2rem] text-balance">
          Better health starts with knowing. And knowing starts here.{" "}
          <span className="font-landing-title text-landing-primary-hover italic">
            Take Health
          </span>
        </h2>
        <p className="lg:text-lg text-landing-text/80 mt-4 text-balance">
          Seamlessly experience clarity, precision, and control over your
          evolving health.
        </p>
        <Link to="/register">
          <button className="px-6 py-2 mt-5 bg-landing-primary text-white uppercase font-landing-accent rounded-md hover:bg-landing-primary-hover transition">
            GET STARTED
          </button>
        </Link>
      </div>
    </section>
  );
};

export default CTA;
