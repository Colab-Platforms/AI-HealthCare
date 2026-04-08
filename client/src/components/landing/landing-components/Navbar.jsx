import { Link } from "react-router-dom"
import { motion } from "framer-motion"

const Navbar = () => {
  return (
    <motion.nav 
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="w-full py-6 flex items-center justify-between container px-5 mx-auto bg-transparent h-24 overflow-hidden -mb-24 relative z-10"
    >
      <div>
        <img src="/landing/logo.svg" alt="AI HealthCare" />
      </div>
      <div>
        <ul className="flex items-center gap-8">
          <Link to="/features" className="text-landing-light-bg hover:text-white uppercase font-landing-accent cursor-pointer transition">Features</Link>
          <Link to="/experience" className="text-landing-light-bg hover:text-white uppercase font-landing-accent cursor-pointer transition">Experience</Link>
          <Link to="/testimonials" className="text-landing-light-bg hover:text-white uppercase font-landing-accent cursor-pointer transition">Testimonials</Link>
          <Link to="/faq" className="text-landing-light-bg hover:text-white uppercase font-landing-accent cursor-pointer transition">FAQ</Link>
        </ul>
      </div>
      <div>
        <Link to="/login" className="text-landing-light-bg hover:text-white uppercase font-landing-accent cursor-pointer transition mr-4">Log in</Link>
        <Link to="/get-started">
          <button className="px-6 py-2 bg-landing-primary text-white font-landing-accent rounded-full hover:bg-landing-primary/90 transition">Get App</button>
        </Link>
      </div>
    </motion.nav>
  )
}

export default Navbar