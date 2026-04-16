import React from "react";
import Navbar from "../components/landing/landing-components/Navbar";
import Footer from "../components/landing/landing-components/Footer";

const PrivacyPolicy = () => {
  const pdfUrl = "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/take_health_privacy_policy.pdf?v=1776407816";

  return (
    <div className="bg-landing-light-bg text-landing-text font-landing-body">
      <Navbar />
      <div className="">
        <div className="h-[350px] bg-landing-primary relative z-10 flex items-center justify-center text-center">
          <div className="container px-5 lg:px-20 mx-auto relative z-10 text-white mt-14">
            <h1 className="text-3xl lg:text-6xl text-white font-landing-accent-2 text-balance">
              Privacy Policy
            </h1>
            <p className="text-sm lg:text-base text-white mt-4">
              Your privacy is important to us. Please read our privacy policy carefully.
            </p>
          </div>
        </div>

        <div className="container mx-auto px-5 lg:px-20 h-[calc(100vh-220px)] overflow-hidden  mt-10 ">
          <iframe
            src={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1&view=FitH`}
            title="Privacy Policy PDF"
            className="h-full w-full border-0 rounded-lg shadow-lg"
          />
        </div>

        <div className="container mx-auto px-5 lg:px-20 mt-4 flex w-full flex-wrap gap-3 mb-10">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-landing-primary-hover px-4 py-2.5 font-semibold text-white no-underline transition hover:bg-landing-primary"
          >
            Open in New Tab
          </a>
          <a
            href={pdfUrl}
            download
            className="rounded-lg bg-slate-200 px-4 py-2.5 font-semibold text-slate-900 no-underline transition hover:bg-slate-300"
          >
            Download PDF
          </a>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
