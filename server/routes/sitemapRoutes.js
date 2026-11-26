const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const DEFAULT_SITE_URL = "https://www.take.health";

function siteUrl() {
  const configured = String(process.env.FRONTEND_URL || DEFAULT_SITE_URL).trim().replace(/\/+$/, "");
  if (!configured || /onrender\.com/i.test(configured) || /\/api$/i.test(configured)) {
    return DEFAULT_SITE_URL;
  }
  return configured;
}

function catalog() {
  const catalogPath = path.join(__dirname, "../../client/src/seo/public-routes.json");
  return JSON.parse(fs.readFileSync(catalogPath, "utf8"));
}

/**
 * Public sitemap. The file Google fetches is the static client/dist/sitemap.xml
 * written at build time. This route stays in sync for /api/sitemap.xml.
 * GET /api/sitemap.xml
 */
router.get("/sitemap.xml", (req, res) => {
  const origin = siteUrl();
  const pages = catalog();
  const urls = (pages.pages || []).filter((page) => page.sitemap && page.index !== false);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  urls.forEach((page) => {
    const loc = page.path === "/" ? `${origin}/` : `${origin}${page.path}`;
    xml += `  <url>
    <loc>${loc}</loc>
    <lastmod>${pages.updated}</lastmod>
    <changefreq>${page.changefreq || "monthly"}</changefreq>
    <priority>${page.priority || "0.5"}</priority>
  </url>
`;
  });

  xml += `</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(xml);
});

/**
 * Same rules as client/public/robots.txt, with the sitemap host taken from
 * FRONTEND_URL when that is a real site origin.
 * GET /api/robots.txt
 */
router.get("/robots.txt", (req, res) => {
  const robotsPath = path.join(__dirname, "../../client/public/robots.txt");
  let robots = fs.readFileSync(robotsPath, "utf8").trim();
  const origin = siteUrl();
  robots = robots.replace(/Sitemap:\s+\S+/, `Sitemap: ${origin}/sitemap.xml`);

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(`${robots}\n`);
});

module.exports = router;
