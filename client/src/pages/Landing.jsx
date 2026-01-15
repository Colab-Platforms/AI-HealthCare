import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, Upload, Brain, Users, Shield, Zap, ChevronRight, Sparkles,
  Heart, TrendingUp, Apple, Pill, Star, ArrowRight, CheckCircle, Play,
  BarChart3, Menu, X, Clock, Award, Globe, Smartphone, Database, Lock,
  ArrowLeft, Quote, ChevronDown
} from 'lucide-react';

// Header Component
function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-slate-900 text-xl">HealthAI</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">How it works</a>
            <a href="#pricing" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Pricing</a>
            <a href="#testimonials" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Reviews</a>
            <a href="#faq" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">FAQ</a>
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Log in
            </Link>
            <Link to="/register" className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-5 py-2 text-sm font-medium transition-colors">
              Get started
            </Link>
          </div>

          {/* Mobile menu button */}
          <button 
            className="md:hidden p-2" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-200">
            <nav className="flex flex-col gap-4">
              <a href="#features" className="text-sm text-slate-600 hover:text-slate-900">Features</a>
              <a href="#how-it-works" className="text-sm text-slate-600 hover:text-slate-900">How it works</a>
              <a href="#pricing" className="text-sm text-slate-600 hover:text-slate-900">Pricing</a>
              <a href="#testimonials" className="text-sm text-slate-600 hover:text-slate-900">Reviews</a>
              <a href="#faq" className="text-sm text-slate-600 hover:text-slate-900">FAQ</a>
              <div className="flex flex-col gap-2 pt-4">
                <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 py-2">
                  Log in
                </Link>
                <Link to="/register" className="bg-blue-600 text-white rounded-full py-2 px-4 text-sm font-medium text-center">
                  Get started
                </Link>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

// Hero Component
function Hero() {
  const avatars = [
    "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face",
  ];

  return (
    <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-32 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">


          {/* Headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-slate-900 leading-tight tracking-tight mb-6">
            AI-powered health insights for <span className="text-blue-600">smarter, proactive</span> healthcare
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Join 10,000+ people who've transformed their health with personalized AI analysis, 
            nutrition plans, and expert doctor connections—all from your medical reports.
          </p>



          {/* Social Proof */}
          <div className="flex items-center justify-center gap-6 mt-12">
            <div className="flex -space-x-3">
              {avatars.map((src, index) => (
                <div key={index} className="w-10 h-10 rounded-full border-2 border-white bg-slate-100 overflow-hidden">
                  <img
                    src={src}
                    alt={`User ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">4.9/5</span> from 1,000+ reviews
              </p>
            </div>
          </div>
        </div>

        {/* Hero Image */}
        <div className="mt-16 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-transparent z-10"></div>
          <div className="bg-white rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl shadow-blue-600/10 border border-slate-200">
            <img 
              src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Banner-ai-diagnostic.jpg?v=1768294903" 
              alt="AI Health Dashboard" 
              className="w-full h-auto object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// Features Component
function Features() {
  const features = [
    {
      icon: Heart,
      title: "Personalized Health Analysis",
      description: "AI-powered analysis of your medical reports to identify health patterns, deficiencies, and risks.",
    },
    {
      icon: Shield,
      title: "Preventive Care Insights",
      description: "Get proactive recommendations to prevent health issues before they become serious problems.",
    },
    {
      icon: Clock,
      title: "24/7 Health Monitoring",
      description: "Track your health metrics continuously with smart alerts and personalized recommendations.",
    },
    {
      icon: Smartphone,
      title: "Health Tracking App",
      description: "Monitor your vitals, medications, and wellness goals in one beautiful, easy-to-use dashboard.",
    },
    {
      icon: Users,
      title: "Expert Doctor Network",
      description: "Connect with verified healthcare professionals recommended based on your specific health needs.",
    },
    {
      icon: Brain,
      title: "AI Health Assistant",
      description: "Get instant answers to health questions and personalized guidance from our AI health assistant.",
    },
  ];

  return (
    <section id="features" className="py-20 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            <span className="text-sm uppercase tracking-wider text-slate-500 font-medium">Features</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6">
            Everything you need for better health, in one platform
          </h2>
          <p className="text-lg text-slate-600">
            We've reimagined healthcare to be proactive, not reactive. Here's how HealthAI keeps you thriving.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-8 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-600/5 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-6 group-hover:bg-blue-100 transition-colors">
                <feature.icon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">{feature.title}</h3>
              <p className="text-slate-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// How It Works Component
function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Upload your health reports",
      description: "Simply upload your medical reports, lab results, or health documents. Our AI supports all formats including PDFs and images.",
      image: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/reportupload.jpg?v=1768295339",
    },
    {
      number: "02",
      title: "Get AI-powered analysis",
      description: "Our advanced AI analyzes your health data and creates a comprehensive health profile with personalized insights and recommendations.",
      image: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/report-analysis.jpg?v=1768295338",
    },
    {
      number: "03",
      title: "Take action on insights",
      description: "Follow personalized nutrition plans, connect with recommended doctors, and track your health improvements over time.",
      image: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Banner-ai-diagnostic.jpg?v=1768294903",
    },
  ];

  return (
    <section id="how-it-works" className="py-20 md:py-32 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            <span className="text-sm uppercase tracking-wider text-slate-500 font-medium">How it works</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6">
            Three simple steps to better health
          </h2>
        </div>

        {/* Steps */}
        <div className="space-y-20">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`flex flex-col ${
                index % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row"
              } items-center gap-12 lg:gap-20`}
            >
              {/* Content */}
              <div className="flex-1 text-center lg:text-left">
                <span className="text-6xl md:text-8xl font-bold text-blue-100">{step.number}</span>
                <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mt-4 mb-4">{step.title}</h3>
                <p className="text-lg text-slate-600 leading-relaxed mb-6">{step.description}</p>
                <a
                  href="#"
                  className="inline-flex items-center text-blue-600 font-medium hover:gap-3 gap-2 transition-all"
                >
                  Learn more <ArrowRight className="w-4 h-4" />
                </a>
              </div>

              {/* Image */}
              <div className="flex-1">
                <div className="bg-white rounded-2xl overflow-hidden shadow-xl border border-slate-200">
                  <img 
                    src={step.image} 
                    alt={step.title} 
                    className="w-full h-auto object-cover"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Pricing Component
function Pricing() {
  const plans = [
    {
      name: "Basic",
      price: "0",
      period: "forever",
      description: "Perfect for getting started with AI health insights.",
      features: [
        "Upload up to 3 reports per month",
        "Basic AI health analysis",
        "Health score tracking",
        "Mobile app access",
        "Email support",
      ],
      popular: false,
    },
    {
      name: "Pro",
      price: "29",
      period: "per month",
      description: "Comprehensive health insights for serious health optimization.",
      features: [
        "Unlimited report uploads",
        "Advanced AI analysis",
        "Personalized nutrition plans",
        "Doctor recommendations",
        "Priority support",
        "Health trend analysis",
        "Supplement recommendations",
      ],
      popular: true,
    },
    {
      name: "Family",
      price: "49",
      period: "per month",
      description: "Complete health management for your entire family.",
      features: [
        "Everything in Pro",
        "Up to 5 family members",
        "Family health dashboard",
        "Shared health insights",
        "Family doctor network",
        "Emergency health alerts",
      ],
      popular: false,
    },
  ];

  return (
    <section id="pricing" className="py-20 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            <span className="text-sm uppercase tracking-wider text-slate-500 font-medium">Pricing</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-slate-600">
            No hidden fees. No surprises. Just powerful AI health insights at an affordable price.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative p-8 rounded-2xl border ${
                plan.popular
                  ? "bg-blue-600 text-white border-blue-600 shadow-2xl shadow-blue-600/25 scale-105"
                  : "bg-white border-slate-200"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-slate-900 text-white text-sm font-medium px-4 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}
              <h3 className={`text-xl font-semibold mb-2 ${plan.popular ? "text-white" : "text-slate-900"}`}>
                {plan.name}
              </h3>
              <p className={`text-sm mb-6 ${plan.popular ? "text-blue-100" : "text-slate-600"}`}>
                {plan.description}
              </p>
              <div className="mb-8">
                <span className={`text-5xl font-bold ${plan.popular ? "text-white" : "text-slate-900"}`}>
                  ${plan.price}
                </span>
                <span className={`text-sm ml-2 ${plan.popular ? "text-blue-100" : "text-slate-600"}`}>
                  {plan.period}
                </span>
              </div>
              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle
                      className={`w-5 h-5 shrink-0 mt-0.5 ${
                        plan.popular ? "text-white" : "text-blue-600"
                      }`}
                    />
                    <span className={`text-sm ${plan.popular ? "text-blue-50" : "text-slate-600"}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className={`w-full rounded-full py-4 px-6 text-center font-medium transition-colors block ${
                  plan.popular
                    ? "bg-white text-blue-600 hover:bg-blue-50"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Testimonials Component
function Testimonials() {
  const [current, setCurrent] = useState(0);
  
  const testimonials = [
    {
      stars: 5,
      quote: "HealthAI identified my vitamin D deficiency that my doctor missed. The personalized nutrition plan has completely transformed my energy levels and overall health. I feel like I have a personal health advisor in my pocket.",
      author: "Sarah Johnson",
      role: "Marketing Manager",
      location: "San Francisco",
      image: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
    },
    {
      stars: 5,
      quote: "As a busy professional, I never had time to properly analyze my health reports. HealthAI does it instantly and gives me actionable insights. The doctor recommendations were spot-on and saved me months of searching.",
      author: "Michael Chen",
      role: "Software Engineer",
      location: "Seattle",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    },
    {
      stars: 5,
      quote: "The AI analysis caught early signs of metabolic issues that could have become serious. The preventive care recommendations and supplement guidance have been life-changing. This is the future of healthcare.",
      author: "Emily Rodriguez",
      role: "Fitness Instructor",
      location: "Austin",
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    },
  ];

  const next = () => setCurrent((prev) => (prev + 1) % testimonials.length);
  const prev = () => setCurrent((prev) => (prev - 1 + testimonials.length) % testimonials.length);

  return (
    <section id="testimonials" className="py-20 md:py-32 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            <span className="text-sm uppercase tracking-wider text-slate-500 font-medium">Testimonials</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6">
            Hear from our users
          </h2>
          <p className="text-lg text-slate-600">
            Join thousands who've transformed their health with AI-powered insights.
          </p>
        </div>

        {/* Testimonial Card */}
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-white rounded-3xl p-8 md:p-12 shadow-xl border border-slate-200">
            {/* Quote Icon */}
            <Quote className="absolute top-8 right-8 w-16 h-16 text-blue-100" />

            {/* Stars */}
            <div className="flex gap-1 mb-6">
              {[...Array(testimonials[current].stars)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
              ))}
            </div>

            {/* Quote */}
            <blockquote className="text-xl md:text-2xl text-slate-900 leading-relaxed mb-8">
              "{testimonials[current].quote}"
            </blockquote>

            {/* Author */}
            <div className="flex items-center gap-4">
              <img
                src={testimonials[current].image}
                alt={testimonials[current].author}
                className="w-14 h-14 rounded-full object-cover border-2 border-slate-200"
              />
              <div>
                <p className="font-semibold text-slate-900">{testimonials[current].author}</p>
                <p className="text-sm text-slate-600">
                  {testimonials[current].role} · {testimonials[current].location}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={prev}
              className="w-12 h-12 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-900" />
            </button>
            <div className="flex gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    i === current ? "bg-blue-600" : "bg-slate-300 hover:bg-slate-400"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={next}
              className="w-12 h-12 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center transition-colors"
            >
              <ArrowRight className="w-5 h-5 text-slate-900" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// FAQ Component
function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  const faqs = [
    {
      question: "What types of health reports can I upload?",
      answer: "HealthAI supports all common medical report formats including blood tests, lab results, imaging reports, and general health checkups. You can upload PDFs, images, or even photos of paper reports. Our AI can extract and analyze data from virtually any medical document.",
    },
    {
      question: "How accurate is the AI analysis?",
      answer: "Our AI has been trained on millions of medical records and achieves 98% accuracy in data extraction and analysis. However, our insights are meant to supplement, not replace, professional medical advice. We always recommend consulting with healthcare professionals for serious health concerns.",
    },
    {
      question: "Is my health data secure and private?",
      answer: "Absolutely. We use bank-level encryption to protect your data and are fully HIPAA compliant. Your health information is never shared with third parties without your explicit consent. You have complete control over your data and can delete it at any time.",
    },
    {
      question: "Can I connect with real doctors through the platform?",
      answer: "Yes! Based on your AI analysis, we recommend verified healthcare professionals who specialize in your specific health needs. Our network includes thousands of doctors, specialists, and healthcare providers who understand our AI insights.",
    },
    {
      question: "What if I don't have any medical reports?",
      answer: "No problem! You can start by taking our comprehensive health assessment, or we can help you understand what tests to request from your doctor. We also provide guidance on essential health screenings based on your age, gender, and health goals.",
    },
    {
      question: "Can I cancel my subscription anytime?",
      answer: "Yes, you can cancel your subscription at any time with no penalties or fees. If you cancel mid-cycle, you'll continue to have access to all features until the end of your billing period. We also offer a 30-day money-back guarantee for new subscribers.",
    },
  ];

  return (
    <section id="faq" className="py-20 md:py-32 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            <span className="text-sm uppercase tracking-wider text-slate-500 font-medium">FAQ</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6">Got questions?</h2>
          <p className="text-lg text-slate-600">
            We've got answers. If you can't find what you're looking for, chat with our team.
          </p>
        </div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-6 text-left"
              >
                <span className="text-lg font-medium text-slate-900 pr-4">{faq.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-500 shrink-0 transition-transform duration-200 ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  openIndex === index ? "max-h-96" : "max-h-0"
                }`}
              >
                <p className="px-6 pb-6 text-slate-600 leading-relaxed">{faq.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// CTA Component
function CTA() {
  return (
    <section className="py-20 md:py-32 bg-blue-600">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
          Ready to transform your health with AI?
        </h2>
        <p className="text-lg text-blue-100 mb-10 max-w-2xl mx-auto">
          Join 10,000+ people who've made the switch to proactive, AI-powered healthcare. 
          Your future self will thank you.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/register"
            className="bg-white text-blue-600 hover:bg-blue-50 rounded-full px-8 py-4 text-base font-medium transition-all inline-flex items-center gap-2"
          >
            Start your free analysis
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            to="/login"
            className="rounded-full px-8 py-4 text-base font-medium border border-blue-400 text-white hover:bg-blue-700 bg-transparent transition-all"
          >
            Talk to our team
          </Link>
        </div>
        <p className="text-sm text-blue-200 mt-6">Free forever plan · No credit card required · Cancel anytime</p>
      </div>
    </section>
  );
}

// Footer Component
function Footer() {
  return (
    <footer className="bg-slate-900 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-xl">HealthAI</span>
            </div>
            <p className="text-slate-400 text-sm mb-4">AI-powered health insights for better living.</p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Features</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Mobile App</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">API</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">About</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Blog</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Careers</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Press</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold mb-4">Resources</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Help Center</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Health Guides</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Find a Doctor</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Partner with Us</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">HIPAA Compliance</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-400">© 2024 HealthAI. All rights reserved.</p>
          <p className="text-sm text-slate-400">Made with ❤️ for better health</p>
        </div>
      </div>
    </footer>
  );
}

// Main Landing Page Component
export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <Testimonials />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}