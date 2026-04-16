import React from "react";
import { motion } from "framer-motion";

const AboutHero = () => {
   return (
      <section className="relative w-full h-[375px] lg:h-screen overflow-hidden">
         {/* Background Image */}
         <img
            src="/landing/about/aboutHero.webp"
            alt="Person meditating in nature"
            className="absolute inset-0 w-full h-full object-cover lg:object-cover"
         />
         <div className="absolute inset-0 bg-black/10"></div>

      </section>
   );
};

export default AboutHero;
