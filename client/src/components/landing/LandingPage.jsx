import CTA from './landing-components/CTA'
import Demo from './landing-components/Demo'
import FAQs from './landing-components/FAQs'
import Footer from './landing-components/Footer'
import Hero from './landing-components/Hero'
import ImgPointer from './landing-components/ImgPointer'
import Navbar from './landing-components/Navbar'
import Potential from './landing-components/Potential'
import Stats from './landing-components/Stats'
import Testimonials from './landing-components/Testimonials'

const LandingPage = () => {
  return (
    <section className='bg-landing-light-bg text-landing-text font-landing-body'>
      <Navbar />
      <Hero />
      <Stats />
      <Demo />
      <ImgPointer />
      <Potential />
      <CTA />
      <Testimonials />
      <FAQs />
      <Footer />
    </section>
  )
}

export default LandingPage