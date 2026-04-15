import React, { lazy, Suspense } from 'react'
import Navbar from '../components/landing/landing-components/Navbar'
import AboutHero from '../components/landing/about-components/AboutHero'
import { AboutParagraph } from '../components/landing/about-components/AboutParagraph'
import WhatDoesTakeHealth from '../components/landing/about-components/WhatDoesTakeHealth'
import Footer from '../components/landing/landing-components/Footer'


const AboutUs = () => {
    return (
        <section className='bg-landing-light-bg text-landing-text font-landing-body'>
            <Navbar />
            <AboutHero />
            <Suspense fallback={<div className="h-20" />}>
                <AboutParagraph />
                <WhatDoesTakeHealth />
                {/* <WhatWeDoSection /> */}
                {/* <RedefinedSection /> */}
                {/* <CardsSection /> */}
                <Footer />
            </Suspense>
        </section>
    )
}


export default AboutUs