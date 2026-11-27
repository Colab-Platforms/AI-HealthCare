import { getSiteUrl } from "./siteUrl.js";

const APP_STORE_URL = "https://apps.apple.com/in/app/take-health/id6809424667";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.takehealth.app";
const SHOP_URL = "https://shop.take.health";

const DESCRIPTION =
  "TAKE.Health brings lab reports, daily habits and long-term trends into one place and explains what they mean. It is operated by TAKE Solutions Limited, listed on the NSE and BSE.";

export function buildStructuredData(siteUrl = getSiteUrl()) {
  const origin = siteUrl.replace(/\/+$/, "");
  const orgId = `${origin}/#organization`;

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": orgId,
    name: "TAKE.Health",
    legalName: "TAKE Solutions Limited",
    url: `${origin}/`,
    logo: `${origin}/assets/logos/logo-full.png`,
    description: DESCRIPTION,
    email: "support@takelimited.com",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Chennai",
      addressRegion: "Tamil Nadu",
      addressCountry: "IN",
    },
    sameAs: [SHOP_URL, APP_STORE_URL, PLAY_STORE_URL],
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    name: "TAKE.Health",
    url: `${origin}/`,
    description: DESCRIPTION,
    publisher: { "@id": orgId },
  };

  const mobileApplication = {
    "@context": "https://schema.org",
    "@type": "MobileApplication",
    name: "TAKE.Health",
    operatingSystem: "Android, iOS",
    applicationCategory: "HealthApplication",
    url: `${origin}/`,
    downloadUrl: [APP_STORE_URL, PLAY_STORE_URL],
    publisher: { "@id": orgId },
  };

  const webApplication = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "TAKE.Health",
    applicationCategory: "HealthApplication",
    url: `${origin}/`,
    browserRequirements: "Requires a modern browser.",
    publisher: { "@id": orgId },
  };

  return [organization, website, mobileApplication, webApplication];
}
