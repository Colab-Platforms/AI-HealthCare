import React from 'react';
import { motion } from 'framer-motion';

const PageLoader = () => {
  return (
    <div className="min-h-screen w-full bg-[#F9FCF3] flex flex-col items-center justify-center">
      <motion.div
        className="w-12 h-12 border-4 border-landing-primary/30 border-t-landing-primary rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
};

export default PageLoader;
