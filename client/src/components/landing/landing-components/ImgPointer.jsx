import React from 'react'
import { motion } from 'framer-motion'

const ImgPointer = () => {
  return (
    <section className="container mx-auto py-28 px-5">
      <div className="flex flex-col gap-10">
        <motion.img 
          src="/landing/pointer/img1.webp" 
          alt="pointer" 
          className="sticky" 
          style={{ top: '3vh' }}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} 
        />
        <motion.img 
          src="/landing/pointer/img2.webp" 
          alt="pointer" 
          className="sticky" 
          style={{ top: 'calc(3vh + 30px)' }}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} 
        />
        <motion.img 
          src="/landing/pointer/img3.webp" 
          alt="pointer" 
          className="sticky" 
          style={{ top: 'calc(3vh + 60px)' }}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} 
        />
      </div>
    </section>
  )
}

export default ImgPointer