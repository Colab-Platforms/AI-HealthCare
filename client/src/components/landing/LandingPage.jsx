import React, { lazy, Suspense } from 'react'
import Navbar from './landing-components/Navbar'
import Hero from './landing-components/Hero'

const CTA = lazy(() => import('./landing-components/CTA'))
const Demo = lazy(() => import('./landing-components/Demo'))
const FAQs = lazy(() => import('./landing-components/FAQs'))
const Footer = lazy(() => import('./landing-components/Footer'))
const ImgPointer = lazy(() => import('./landing-components/ImgPointer'))
const Potential = lazy(() => import('./landing-components/Potential'))
const Stats = lazy(() => import('./landing-components/Stats'))
const Testimonials = lazy(() => import('./landing-components/Testimonials'))

const LandingPage = () => {
  return (
    <section className='bg-landing-light-bg text-landing-text font-landing-body'>
      <Navbar />
      <Hero />
      <Suspense fallback={<div className="h-20" />}>
        <Stats />
        <Demo />
        <ImgPointer />
        <Potential />
        <CTA />
        <Testimonials />
        <FAQs />
        <Footer />
      </Suspense>
    </section>
  )
}

export default LandingPage