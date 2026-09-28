import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import SEO from "../hooks/useSEO";
import UpdatedNavbar from "../components/landing/landing-components/UpdatedNavbar";
import UpdatedFooter from "../components/landing/landing-components/UpdatedFooter";

const MANUFACTURERS = [
  {
    product: "Liposomal Berberine HCl",
    name: "Rhett Healthcare PVT.LTD",
    address:
      "Plot No S-15/1 & 15/2, TSIIC Biotech Park Phase – III, Karakapatla, District - Siddipet, Telangana - 502281",
    fssai: "13622999000067",
  },
];

const ManufacturerDetails = () => {
  const [openIndex, setOpenIndex] = useState(0);

  const toggle = (index) => {
    setOpenIndex((prev) => (prev === index ? -1 : index));
  };

  return (
    <div className="min-h-screen bg-landing-light-bg text-landing-text font-landing-body">
      <SEO pageName="manufacturerDetails" />
      <UpdatedNavbar />

      <div className="h-[220px] lg:h-[280px] bg-[#1B47B9] relative z-10 flex items-center justify-center text-center">
        <div className="container px-5 lg:px-20 mx-auto relative z-10 text-white mt-14">
          <h1 className="text-3xl lg:text-5xl text-white font-landing-accent-2 text-balance">
            Manufacturer Details
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-5 lg:px-20 py-10">
        {MANUFACTURERS.map((manufacturer, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={manufacturer.product}
              className="rounded-lg border border-slate-200 bg-white mb-4 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggle(index)}
                className="w-full flex items-center justify-between gap-4 bg-[#1B47B9] px-5 py-4 text-left text-white"
              >
                <div>
                  <div className="text-sm font-semibold uppercase tracking-wide">
                    Manufacturer Details
                  </div>
                  <div className="text-xl font-landing-accent-2">
                    {manufacturer.product}
                  </div>
                </div>
                <ChevronDown
                  className={`h-5 w-5 flex-shrink-0 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-5 py-5 text-slate-700 leading-relaxed">
                  <p className="font-semibold text-landing-text">
                    {manufacturer.name}
                  </p>
                  <p className="mt-1">{manufacturer.address}</p>
                  <p className="mt-2">
                    <span className="font-semibold">FSSAI Lic. No:</span>{" "}
                    {manufacturer.fssai}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <UpdatedFooter />
    </div>
  );
};

export default ManufacturerDetails;
