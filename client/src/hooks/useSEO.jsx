import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import seoConfig, { getPageSeo } from "../utils/seoConfig";

/**
 * SEO Component for managing page metadata
 * Use: <SEO pageName="home" />
 */
export function SEO({ pageName, overrides = {} }) {
  const location = useLocation();

  const pageSeo = getPageSeo(pageName);
  const seo = { ...pageSeo, ...overrides };

  // Update document title for accessibility
  useEffect(() => {
    document.title = seo.title || seoConfig.base.siteName;
  }, [seo.title]);

  const openGraphImage =
    overrides?.image || seo.image || `${seoConfig.base.baseURL}/og-default.jpg`;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      {seo.keywords && <meta name="keywords" content={seo.keywords} />}

      {/* Canonical URL */}
      <link
        rel="canonical"
        href={seo.canonical || `${seoConfig.base.baseURL}${location.pathname}`}
      />

      {/* Robots Meta */}
      {seo.noindex && <meta name="robots" content="noindex,nofollow" />}
      {!seo.noindex && <meta name="robots" content="index,follow" />}

      {/* Language & Author */}
      <html lang={seoConfig.base.language} />
      <meta name="author" content={seoConfig.base.author} />

      {/* Open Graph - Social Media Sharing */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={seoConfig.base.siteName} />
      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />
      <meta
        property="og:url"
        content={
          seo.canonical || `${seoConfig.base.baseURL}${location.pathname}`
        }
      />
      <meta property="og:image" content={openGraphImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="en_US" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />
      <meta name="twitter:image" content={openGraphImage} />

      {/* Additional Meta Tags */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta httpEquiv="x-ua-compatible" content="ie=edge" />
      <meta name="theme-color" content="#2E7D32" />

      {/* Structured Data - Organization */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: seoConfig.base.siteName,
          url: seoConfig.base.baseURL,
          logo: `${seoConfig.base.baseURL}/logo.png`,
          description: seoConfig.base.description,
          contactPoint: {
            "@type": "ContactPoint",
            email: seoConfig.base.email,
            telephone: seoConfig.base.phone,
            contactType: "Customer Service",
          },
          sameAs: [
            "https://www.facebook.com/takehealth",
            "https://www.twitter.com/takehealth",
            "https://www.instagram.com/takehealth",
            "https://www.linkedin.com/company/takehealth",
          ],
        })}
      </script>

      {/* Structured Data - Website */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: seoConfig.base.siteName,
          url: seoConfig.base.baseURL,
          description: seoConfig.base.description,
          searchAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${seoConfig.base.baseURL}/search?q={search_term_string}`,
            },
          },
        })}
      </script>
    </Helmet>
  );
}

export default SEO;
