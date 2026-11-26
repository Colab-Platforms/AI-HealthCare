import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import seoConfig, { getPageSeo } from "../utils/seoConfig";
import { buildStructuredData } from "../seo/structuredData";
import { getSiteUrl } from "../seo/siteUrl";

/**
 * SEO Component for managing page metadata.
 * Use: <SEO pageName="home" />
 * Canonicals always come from the page config (www.take.health by default).
 */
export function SEO({ pageName, overrides = {} }) {
  const pageSeo = getPageSeo(pageName);
  const seo = { ...pageSeo, ...overrides };
  const siteUrl = getSiteUrl();

  const resolveOpenGraphImage = (image) => {
    if (typeof image !== "string") return null;

    const trimmedImage = image.trim();
    if (!trimmedImage) return null;

    if (trimmedImage.includes("undefined") || trimmedImage.includes("null")) {
      return null;
    }

    try {
      new URL(trimmedImage);
      return trimmedImage;
    } catch {
      if (trimmedImage.startsWith("/")) {
        return `${siteUrl}${trimmedImage}`;
      }

      return null;
    }
  };

  useEffect(() => {
    document.title = seo.title || seoConfig.base.siteName;
  }, [seo.title]);

  const openGraphImage =
    resolveOpenGraphImage(overrides?.image) ||
    resolveOpenGraphImage(seo.image) ||
    `${siteUrl}/og-home.jpg`;

  const canonical = seo.canonical || null;
  const structuredData = buildStructuredData(siteUrl);

  return (
    <Helmet>
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      {seo.keywords && <meta name="keywords" content={seo.keywords} />}

      {canonical && <link rel="canonical" href={canonical} />}

      {seo.noindex && <meta name="robots" content="noindex,nofollow" />}
      {!seo.noindex && <meta name="robots" content="index,follow" />}

      <html lang={seoConfig.base.language} />
      <meta name="author" content={seoConfig.base.author} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={seoConfig.base.siteName} />
      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />
      {canonical && <meta property="og:url" content={canonical} />}
      <meta property="og:image" content={openGraphImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="en_US" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />
      <meta name="twitter:image" content={openGraphImage} />

      {structuredData.map((node) => (
        <script key={node["@type"]} type="application/ld+json">
          {JSON.stringify(node)}
        </script>
      ))}
    </Helmet>
  );
}

export default SEO;
