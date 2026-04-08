import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3
    }
  }
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
}

const bgFade = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 1.5, ease: 'easeInOut' } }
}

const Hero = () => {
  return (
    <motion.section 
      initial="hidden" 
      animate="show" 
      variants={bgFade}
      className='relative bg-hero bg-cover h-screen bg-top-center flex items-center justify-center text-center pb-10'
    >
        <div className="absolute inset-0 bg-black/30"></div>
        <motion.div 
          className='relative z-10'
          variants={container}
          initial="hidden"
          animate="show"
        >
            <motion.h1 variants={item} className='text-4xl md:text-6xl text-white font-landing-accent-2'>Your Health, Understood Ahead of Time</motion.h1>
            <motion.p variants={item} className='text-2xl font-light text-landing-light-bg mt-4 font-landing-accent max-w-4xl mx-auto capitalize mb-5 text-balance'>Access personalized health insights, anticipate risks early, and enhance your longevity through advanced, data-driven care.</motion.p>
            <motion.div variants={item}>
              <Link to="/get-started">
                  <button className="px-6 py-2 bg-landing-primary text-white uppercase font-landing-accent rounded-full hover:bg-landing-primary-hover transition">Track For Free</button>
              </Link>
            </motion.div>
        </motion.div>
    </motion.section>
  )
}

export default Hero