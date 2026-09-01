import React from "react";
import SEO from "../hooks/useSEO";
import UpdatedNavbar from "../components/landing/landing-components/UpdatedNavbar";
import UpdatedFooter from "../components/landing/landing-components/UpdatedFooter";
import PdfViewer from "../components/PdfViewer";

const TermsAndCondition = () => {
  const pdfUrl =
    "https://res.cloudinary.com/dvgg1i1ck/image/upload/v1787557576/Terrms_and_Conditions_take.health_updated_24.08.26_hifch6.pdf";

  return (
    <div className="bg-landing-light-bg text-landing-text font-landing-body">
      <SEO pageName="termsAndConditions" />
      <UpdatedNavbar />
      <div className="">
        <div className="h-[350px] bg-landing-primary relative z-10 flex items-center justify-center text-center">
          <div className="container px-5 lg:px-20 mx-auto relative z-10 text-white mt-14">
            <h1 className="text-3xl lg:text-6xl text-white font-landing-accent-2 text-balance">
              Terms and conditions
            </h1>
            <p className="text-sm lg:text-base text-white mt-4">
              Please read our terms and conditions carefully before using our
              services.
            </p>
          </div>
        </div>

        {/* Renders every page as canvas, same code path on desktop, Android
            and iOS — no iframe, no OS-native PDF viewer, no leaving the page. */}
        <div className="container mx-auto px-5 lg:px-20 mt-10">
          <PdfViewer url={pdfUrl} title="the Terms and Conditions" />
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

export default TermsAndCondition;
