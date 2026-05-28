/**
 * SEO Configuration for all pages
 * Centralized meta information for consistency across the site
 */

const baseURL = import.meta.env.VITE_API_URL || "https://take.health";
const siteName = "take.health";
const siteDescription =
  "AI-powered healthcare platform for medical report analysis, vitamin deficiency detection, personalized diet plans, and supplement recommendations.";
const siteKeywords =
  "health, AI healthcare, medical analysis, vitamin deficiency, diet plans, supplements, health tracking, glucose monitoring";

export const seoConfig = {
  base: {
    siteName,
    baseURL,
    description: siteDescription,
    keywords: siteKeywords,
    language: "en",
    author: "take.health",
    email: "support@take.health",
    phone: "+1-800-HEALTH-1",
  },

  pages: {
    home: {
      title: "AI-Powered Healthcare Platform | take.health",
      description:
        "Medical report analysis, vitamin deficiency detection, and personalized health recommendations powered by AI.",
      keywords:
        "AI healthcare, health platform, medical analysis, health tracking, wellness",
      path: "/",
      canonical: `${baseURL}/`,
      image: `${baseURL}/og-home.jpg`,
    },

    login: {
      title: "Sign In | take.health",
      description:
        "Log in to your take.health account to access your health dashboard and reports.",
      keywords: "login, sign in, healthcare app, health dashboard",
      path: "/login",
      canonical: `${baseURL}/login`,
      noindex: true,
    },

    register: {
      title: "Create Account | take.health",
      description:
        "Join take.health and get personalized health insights powered by AI.",
      keywords: "sign up, register, create account, health platform",
      path: "/register",
      canonical: `${baseURL}/register`,
      noindex: true,
    },

    forgotPassword: {
      title: "Reset Password | take.health",
      description: "Reset your take.health account password",
      keywords: "password reset, forgot password",
      path: "/forgot-password",
      canonical: `${baseURL}/forgot-password`,
      noindex: true,
    },

    dashboard: {
      title: "Health Dashboard | take.health",
      description:
        "Monitor your health metrics, view reports, and track your wellness journey.",
      keywords: "health dashboard, health tracking, wellness, metrics",
      path: "/dashboard",
      canonical: `${baseURL}/dashboard`,
      noindex: true,
    },

    upload: {
      title: "Upload Medical Report | take.health",
      description:
        "Upload and analyze your medical reports with AI-powered insights.",
      keywords: "medical report, upload, analysis, health records",
      path: "/upload",
      canonical: `${baseURL}/upload`,
      noindex: true,
    },

    reports: {
      title: "Your Health Reports | take.health",
      description:
        "View and manage all your health reports and analysis results.",
      keywords: "health reports, medical records, analysis results",
      path: "/reports",
      canonical: `${baseURL}/reports`,
      noindex: true,
    },

    profile: {
      title: "My Profile | take.health",
      description:
        "Manage your account settings and personal health information.",
      keywords: "profile, account settings, personal information",
      path: "/profile",
      canonical: `${baseURL}/profile`,
      noindex: true,
    },

    nutrition: {
      title: "Nutrition & Diet Plans | take.health",
      description:
        "Get personalized nutrition recommendations and diet plans based on your health data.",
      keywords:
        "nutrition, diet plans, dietary recommendations, health nutrition",
      path: "/nutrition",
      canonical: `${baseURL}/nutrition`,
      noindex: true,
    },

    dietPlan: {
      title: "Personalized Diet Plans | take.health",
      description:
        "Receive customized diet plans tailored to your health goals and nutritional needs.",
      keywords: "diet plan, nutrition plan, meal planning, health diet",
      path: "/diet-plan",
      canonical: `${baseURL}/diet-plan`,
      noindex: true,
    },

    supplements: {
      title: "Supplement Recommendations | take.health",
      description:
        "Get AI-recommended supplements based on your health analysis and deficiencies.",
      keywords: "supplements, vitamin recommendations, health supplements",
      path: "/supplements",
      canonical: `${baseURL}/supplements`,
      noindex: true,
    },

    glucoseLog: {
      title: "Glucose Tracking | take.health",
      description:
        "Monitor and track your glucose levels over time with detailed analytics.",
      keywords: "glucose tracking, blood sugar, diabetes monitoring",
      path: "/glucose-log",
      canonical: `${baseURL}/glucose-log`,
      noindex: true,
    },

    vitalSigns: {
      title: "Vital Signs Monitoring | take.health",
      description:
        "Track your vital signs including heart rate, blood pressure, and temperature.",
      keywords: "vital signs, heart rate, blood pressure, health monitoring",
      path: "/vital-signs",
      canonical: `${baseURL}/vital-signs`,
      noindex: true,
    },

    stepTracker: {
      title: "Step Counter & Activity Tracking | take.health",
      description:
        "Track your daily steps and physical activity to maintain an active lifestyle.",
      keywords: "step counter, activity tracking, fitness, wellness",
      path: "/step-tracker",
      canonical: `${baseURL}/step-tracker`,
      noindex: true,
    },

    smokeTracker: {
      title: "Smoke Log & Habit Awareness | take.health",
      description:
        "Log cigarettes, spot triggers, and track your smoking patterns over time with take.health.",
      keywords:
        "smoke tracker, smoking log, habit awareness, quit smoking support, trigger tracking",
      path: "/smoke-tracker",
      canonical: `${baseURL}/smoke-tracker`,
      noindex: true,
    },

    alcoholTracker: {
      title: "Drink Log & Pattern Awareness | take.health",
      description:
        "Log drinks, tag situations, and see your weekly drinking patterns from your own data.",
      keywords:
        "alcohol tracker, drink log, pattern awareness, mindful drinking, habit tracking",
      path: "/alcohol-tracker",
      canonical: `${baseURL}/alcohol-tracker`,
      noindex: true,
    },

    aiChat: {
      title: "AI Health Assistant | take.health",
      description:
        "Chat with our AI assistant to get instant health advice and answers.",
      keywords: "AI assistant, health advice, chat, health questions",
      path: "/ai-chat",
      canonical: `${baseURL}/ai-chat`,
      noindex: true,
    },

    challenge: {
      title: "30-Day Health Challenge | take.health",
      description:
        "Join our 30-day health challenge to improve your wellness and build healthy habits.",
      keywords: "health challenge, fitness challenge, wellness goals",
      path: "/challenge",
      canonical: `${baseURL}/challenge`,
      noindex: true,
    },

    diabetes: {
      title: "Diabetes Care Management | take.health",
      description:
        "Comprehensive diabetes management tools and personalized care guidance.",
      keywords: "diabetes care, diabetes management, blood sugar management",
      path: "/diabetes",
      canonical: `${baseURL}/diabetes`,
      noindex: true,
    },

    medicalVault: {
      title: "Medical Document Vault | take.health",
      description:
        "Securely store and manage all your medical documents and health records.",
      keywords:
        "medical records, document storage, health vault, secure storage",
      path: "/medical-vault",
      canonical: `${baseURL}/medical-vault`,
      noindex: true,
    },

    foodSafety: {
      title: "Food Safety & Contamination Check | take.health",
      description:
        "Check for food adulterations and contamination issues with AI-powered analysis.",
      keywords:
        "food safety, contamination detection, food adulteration, food quality",
      path: "/food-safety",
      canonical: `${baseURL}/food-safety`,
      noindex: true,
    },

    report: {
      title: "Report Analysis | take.health",
      description: "Detailed analysis and insights from your medical report.",
      keywords:
        "report analysis, medical analysis, health insights, report details",
      path: "/reports/:id",
      canonical: `${baseURL}/reports/:id`,
      noindex: true,
    },

    reportSummary: {
      title: "Report Summary | take.health",
      description:
        "Summary view of your medical report with key findings and recommendations.",
      keywords: "report summary, health summary, findings, recommendations",
      path: "/reports/:id/summary",
      canonical: `${baseURL}/reports/:id/summary`,
      noindex: true,
    },

    completeAnalysis: {
      title: "Complete Health Analysis | take.health",
      description:
        "Comprehensive analysis of your health data and medical records.",
      keywords:
        "health analysis, complete analysis, health assessment, medical records",
      path: "/complete-analysis",
      canonical: `${baseURL}/complete-analysis`,
      noindex: true,
    },

    logVitals: {
      title: "Log Vital Signs | take.health",
      description:
        "Log and track your vital signs including heart rate, blood pressure, and temperature.",
      keywords: "vital signs, logging, heart rate, blood pressure, temperature",
      path: "/log-vitals/:metric",
      canonical: `${baseURL}/log-vitals/:metric`,
      noindex: true,
    },

    onboarding: {
      title: "Get Started | take.health",
      description: "Get onboarded and set up your take.health account.",
      keywords: "onboarding, setup, getting started, tutorial",
      path: "/onboarding",
      canonical: `${baseURL}/onboarding`,
      noindex: true,
    },

    subscription: {
      title: "Subscription Plans | take.health",
      description:
        "Choose the perfect subscription plan for your health goals.",
      keywords: "subscription, plans, pricing, membership",
      path: "/subscription",
      canonical: `${baseURL}/subscription`,
      noindex: true,
    },

    adminDashboard: {
      title: "Admin Dashboard | take.health",
      description: "Admin dashboard for managing the platform.",
      keywords: "admin, dashboard, management",
      path: "/admin",
      canonical: `${baseURL}/admin`,
      noindex: true,
    },

    adminUsers: {
      title: "Manage Users | take.health",
      description: "Manage and monitor user accounts and activity.",
      keywords: "admin, users, management, accounts",
      path: "/admin/users",
      canonical: `${baseURL}/admin/users`,
      noindex: true,
    },

    adminReports: {
      title: "Manage Reports | take.health",
      description: "View and manage all user medical reports.",
      keywords: "admin, reports, management, medical reports",
      path: "/admin/reports",
      canonical: `${baseURL}/admin/reports`,
      noindex: true,
    },

    adminFoodCache: {
      title: "Food Database | take.health",
      description:
        "Manage and update the food database for food safety analysis.",
      keywords: "admin, food database, management",
      path: "/admin/food-cache",
      canonical: `${baseURL}/admin/food-cache`,
      noindex: true,
    },

    adminSupport: {
      title: "Support Tickets | take.health",
      description: "Manage user support tickets and inquiries.",
      keywords: "admin, support, tickets, management",
      path: "/admin/support",
      canonical: `${baseURL}/admin/support`,
      noindex: true,
    },

    howItWorks: {
      title: "How take.health Works | take.health",
      description:
        "Learn how our AI-powered platform analyzes medical reports and provides health insights.",
      keywords:
        "how it works, platform explanation, AI analysis, health insights",
      path: "/how-it-works",
      canonical: `${baseURL}/how-it-works`,
    },

    about: {
      title: "About take.health | AI Healthcare Platform",
      description:
        "Learn about take.health, our mission to democratize healthcare through AI technology.",
      keywords: "about us, company, mission, healthcare innovation, AI",
      path: "/about",
      canonical: `${baseURL}/about`,
    },

    privacyPolicy: {
      title: "Privacy Policy | take.health",
      description:
        "Read our privacy policy to understand how we protect your health data.",
      keywords: "privacy policy, data protection, HIPAA compliance",
      path: "/privacy-policy",
      canonical: `${baseURL}/privacy-policy`,
    },

    termsAndConditions: {
      title: "Terms & Conditions | take.health",
      description:
        "Review the terms and conditions for using take.health platform.",
      keywords: "terms and conditions, terms of service, legal",
      path: "/terms-and-conditions",
      canonical: `${baseURL}/terms-and-conditions`,
    },

    demo: {
      title: "Demo Preview | take.health",
      description: "See a demo of take.health's features and capabilities.",
      keywords: "demo, preview, features, showcase",
      path: "/demo",
      canonical: `${baseURL}/demo`,
    },

    notFound: {
      title: "Page Not Found | take.health",
      description: "The page you're looking for could not be found.",
      keywords: "404, not found, error",
      noindex: true,
    },
  },
};

/**
 * Get page SEO config
 */
export function getPageSeo(pageName) {
  return seoConfig.pages[pageName] || seoConfig.pages.notFound;
}

/**
 * Get full URL for a page
 */
export function getPageUrl(path) {
  return `${seoConfig.base.baseURL}${path}`;
}

export default seoConfig;
