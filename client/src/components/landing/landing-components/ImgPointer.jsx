import { motion } from "framer-motion";
import { useState } from "react";

const ImgPointer = () => {
  const [isMobImage1Available, setIsMobImage1Available] = useState(true);
  const [isMobImage2Available, setIsMobImage2Available] = useState(true);
  const [isMobImage3Available, setIsMobImage3Available] = useState(true);

  return (
    <section className="container mx-auto py-28 px-5 lg:px-20">
      <div className="flex flex-col gap-10">
        {isMobImage1Available && (
          <motion.img
            src="/landing/pointer/img1-mob.webp"
            alt="pointer"
            className="sticky lg:hidden"
            style={{ top: "3vh" }}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            onError={() => setIsMobImage1Available(false)}
          />
        )}
        <motion.img
          src="/landing/pointer/img1.webp"
          alt="pointer"
          className="sticky hidden lg:block"
          style={{ top: "3vh" }}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.img
          src="/landing/pointer/img2.webp"
          alt="pointer"
          className="sticky hidden lg:block"
          style={{ top: "calc(3vh + 30px)" }}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
        {isMobImage2Available && (
          <motion.img
            src="/landing/pointer/img2-mob.webp"
            alt="pointer"
            className="sticky lg:hidden"
            style={{ top: "calc(3vh + 30px)" }}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            onError={() => setIsMobImage2Available(false)}
          />
        )}
        <motion.img
          src="/landing/pointer/img3.webp"
          alt="pointer"
          className="sticky hidden lg:block"
          style={{ top: "calc(3vh + 60px)" }}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
        {isMobImage3Available && (
          <motion.img
            src="/landing/pointer/img3-mob.webp"
            alt="pointer"
            className="sticky lg:hidden"
            style={{ top: "calc(3vh + 60px)" }}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            onError={() => setIsMobImage3Available(false)}
          />
        )}
      </div>
    </section>
  );
};

export default ImgPointer;
