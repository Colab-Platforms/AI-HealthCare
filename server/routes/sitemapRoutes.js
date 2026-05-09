const express = require("express");

const router = express.Router();

/**
 * Pages configuration for sitemap generation
 * Can be expanded by reading from database or environment
 */
const sitemapPages = [
  // Public pages (indexable)
  {
    url: "/",
    changefreq: "weekly",
    priority: 1.0,
  },
  {
    url: "/how-it-works",
    changefreq: "monthly",
    priority: 0.9,
  },
  {
    url: "/about",
    changefreq: "monthly",
    priority: 0.9,
  },
  {
    url: "/login",
    changefreq: "yearly",
    priority: 0.8,
  },
  {
    url: "/register",
    changefreq: "yearly",
    priority: 0.8,
  },
  {
    url: "/privacy-policy",
    changefreq: "yearly",
    priority: 0.6,
  },
  {
    url: "/terms-and-conditions",
    changefreq: "yearly",
    priority: 0.6,
  },
  {
    url: "/food-safety",
    changefreq: "monthly",
    priority: 0.7,
  },
];

/**
 * Generate XML sitemap
 * GET /api/sitemap.xml
 */
router.get("/sitemap.xml", (req, res) => {
  const baseUrl = process.env.FRONTEND_URL || "https://take.health";

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0">
`;

  // Add each page to the sitemap
  sitemapPages.forEach((page) => {
    const lastmod = new Date().toISOString().split("T")[0]; // Today's date in YYYY-MM-DD format

    xml += `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
  });

  xml += `</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=604800"); // Cache for 7 days
  res.send(xml);
});

/**
 * Generate robots.txt
 * GET /api/robots.txt
 */
router.get("/robots.txt", (req, res) => {
  const baseUrl = process.env.FRONTEND_URL || "https://take.health";

  const robots = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /dashboard
Disallow: /profile
Disallow: /login
Disallow: /register
Disallow: /forgot-password
Disallow: /*.json
Disallow: /uploads/
Disallow: /api/
Crawl-delay: 1

User-agent: Googlebot
Allow: /
Disallow: /admin
Disallow: /dashboard
Disallow: /profile
Disallow: /login
Disallow: /register
Disallow: /forgot-password
Crawl-delay: 0

User-agent: Bingbot
Allow: /
Disallow: /admin
Disallow: /dashboard
Disallow: /profile
Disallow: /login
Disallow: /register
Disallow: /forgot-password
Crawl-delay: 1

User-agent: Googlebot-Image
Allow: /
Disallow: /admin
Disallow: /dashboard
Disallow: /profile

User-agent: ia_archiver
Disallow: /

Sitemap: ${baseUrl}/sitemap.xml
`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=604800"); // Cache for 7 days
  res.send(robots);
});

module.exports = router;
