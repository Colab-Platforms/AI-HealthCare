import React from "react";
import SEO from "../hooks/useSEO";
import UpdatedNavbar from "../components/landing/landing-components/UpdatedNavbar";
import UpdatedFooter from "../components/landing/landing-components/UpdatedFooter";
import PdfViewer from "../components/PdfViewer";

const PrivacyPolicy = () => {
  const pdfUrl =
    "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/take_health_privacy_policy.pdf?v=1776407816";

  return (
    <div className="bg-landing-light-bg text-landing-text font-landing-body">
      <SEO pageName="privacyPolicy" />
      <UpdatedNavbar />
      <div className="">
        <div className="h-[350px] bg-landing-primary relative z-10 flex items-center justify-center text-center">
          <div className="container px-5 lg:px-20 mx-auto relative z-10 text-white mt-14">
            <h1 className="text-3xl lg:text-6xl text-white font-landing-accent-2 text-balance">
              Privacy Policy
            </h1>
            <p className="text-sm lg:text-base text-white mt-4">
              Your privacy is important to us. Please read our privacy policy
              carefully.
            </p>
          </div>
        </div>

        {/* Renders every page as canvas, same code path on desktop, Android
            and iOS — no iframe, no OS-native PDF viewer, no leaving the page. */}
        <div className="container mx-auto px-5 lg:px-20 mt-10">
          <PdfViewer url={pdfUrl} title="the Privacy Policy" />
        </div>

        <div className="container mx-auto px-5 lg:px-20 mt-4 flex w-full flex-wrap gap-3 mb-10">
          <a
            href={pdfUrl}
            download
            className="rounded-lg bg-slate-200 px-4 py-2.5 font-semibold text-slate-900 no-underline transition hover:bg-slate-300"
          >
            Download PDF
          </a>
        </div>
      </div>
      <UpdatedFooter />
    </div>
  );
};

export default PrivacyPolicy;
