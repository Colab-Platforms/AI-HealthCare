/**
 * After `vite build`, write unique HTML for each public route, a noindex
 * SPA shell for signed-in routes, a real 404 page, sitemap.xml and robots.txt.
 *
 * Crawlers that do not run JavaScript see the title, description, canonical,
 * H1 and copy. The built React bundle still mounts into #root for people.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getSiteUrl } from "../src/seo/siteUrl.js";
import { buildStructuredData } from "../src/seo/structuredData.js";
import { isSpaPath, normalizePath, pageByPath } from "../src/seo/matchPath.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(scriptDir, "..");
const distDir = path.join(clientDir, "dist");
const catalog = JSON.parse(
  fs.readFileSync(path.join(clientDir, "src/seo/public-routes.json"), "utf8"),
);

const siteUrl = getSiteUrl();

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function pageUrl(page) {
  const pathName = page.canonicalPath || page.path;
  const origin = siteUrl.replace(/\/+$/, "");
  return pathName === "/" ? `${origin}/` : `${origin}${pathName}`;
}

function navHtml() {
  const links = [
    ["/", "Home"],
    ["/about", "About"],
    ["/how-it-works", "How it works"],
    ["/creator", "Creator club"],
    ["/privacy-policy", "Privacy policy"],
    ["/terms-and-conditions", "Terms"],
    ["/support", "Support"],
    ["/delete-account", "Delete account"],
    ["https://shop.take.health/", "Shop"],
  ];
  const items = links
    .map(([href, label]) => {
      const absolute = href.startsWith("http") ? href : pageUrl({ path: href });
      return `<a href="${esc(absolute)}">${esc(label)}</a>`;
    })
    .join(" ");
  return `<nav aria-label="On this site">${items}</nav>`;
}

function bodyHtml(page) {
  const paragraphs = (page.copy || []).map((paragraph) => `<p>${esc(paragraph)}</p>`).join("\n");
  const stores =
    page.path === "/"
      ? `<p><a href="https://apps.apple.com/in/app/take-health/id6809424667">Download on the App Store</a> · <a href="https://play.google.com/store/apps/details?id=com.takehealth.app">Get it on Google Play</a></p>`
      : "";
  return `<main style="max-width:42rem;margin:2rem auto;padding:0 1.25rem;font-family:Georgia,serif;line-height:1.5;color:#14221f">
<h1>${esc(page.h1)}</h1>
${paragraphs}
${stores}
${navHtml()}
</main>`;
}

function jsonLdTags() {
  return buildStructuredData(siteUrl)
    .map(
      (node) =>
        `<script type="application/ld+json" data-rh="true">${JSON.stringify(node).replace(/</g, "\\u003c")}</script>`,
    )
    .join("\n");
}

function headTags(page) {
  const canonical = pageUrl(page);
  const robots = page.index === false ? "noindex,nofollow" : "index,follow";
  const image = `${siteUrl.replace(/\/+$/, "")}/og-home.jpg`;
  const preload =
    page.path === "/"
      ? `<link rel="preload" as="image" href="/updated-landing/hero-mobile.webp" type="image/webp" media="(max-width: 639px)" fetchpriority="high" />
<link rel="preload" as="image" href="/updated-landing/hero-desktop.webp" type="image/webp" media="(min-width: 640px)" fetchpriority="high" />`
      : "";
  return `${preload}
<title data-rh="true">${esc(page.title)}</title>
<meta data-rh="true" name="description" content="${esc(page.description)}" />
<link data-rh="true" rel="canonical" href="${esc(canonical)}" />
<meta data-rh="true" name="robots" content="${robots}" />
<meta data-rh="true" property="og:type" content="website" />
<meta data-rh="true" property="og:site_name" content="TAKE.Health" />
<meta data-rh="true" property="og:title" content="${esc(page.title)}" />
<meta data-rh="true" property="og:description" content="${esc(page.description)}" />
<meta data-rh="true" property="og:url" content="${esc(canonical)}" />
<meta data-rh="true" property="og:image" content="${esc(image)}" />
<meta data-rh="true" property="og:image:width" content="1200" />
<meta data-rh="true" property="og:image:height" content="630" />
<meta data-rh="true" name="twitter:card" content="summary_large_image" />
<meta data-rh="true" name="twitter:title" content="${esc(page.title)}" />
<meta data-rh="true" name="twitter:description" content="${esc(page.description)}" />
<meta data-rh="true" name="twitter:image" content="${esc(image)}" />
${jsonLdTags()}`;
}

function stripManagedHead(html) {
  return html
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<meta[^>]+data-rh=["']true["'][^>]*>/gi, "")
    .replace(/<link[^>]+data-rh=["']true["'][^>]*>/gi, "")
    .replace(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<link[^>]+rel=["']preload["'][^>]+as=["']image["'][^>]*>/gi, "");
}

function applyDocument(shell, { title, head, body }) {
  let html = stripManagedHead(shell);
  html = html.replace("</head>", `${head}\n</head>`);
  if (!html.includes("<title")) {
    html = html.replace("</head>", `<title>${esc(title)}</title>\n</head>`);
  }
  html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  return html;
}

function writeFile(relativePath, contents) {
  const target = path.join(distDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function sitemapXml() {
  const urls = catalog.pages.filter((page) => page.sitemap && page.index !== false);
  const body = urls
    .map((page) => {
      const loc = pageUrl({ path: page.path });
      return `  <url>
    <loc>${loc}</loc>
    <lastmod>${catalog.updated}</lastmod>
    <changefreq>${page.changefreq || "monthly"}</changefreq>
    <priority>${page.priority || "0.5"}</priority>
  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

function robotsTxt() {
  const source = fs.readFileSync(path.join(clientDir, "public/robots.txt"), "utf8").trim();
  const origin = siteUrl.replace(/\/+$/, "");
  if (/Sitemap:\s+\S+/.test(source)) {
    return `${source.replace(/Sitemap:\s+\S+/, `Sitemap: ${origin}/sitemap.xml`)}\n`;
  }
  return `${source}\nSitemap: ${origin}/sitemap.xml\n`;
}

function build() {
  const shellPath = path.join(distDir, "index.html");
  if (!fs.existsSync(shellPath)) {
    throw new Error("dist/index.html is missing. Run vite build first.");
  }
  const shell = fs.readFileSync(shellPath, "utf8");
  if (!shell.includes('id="root"')) {
    throw new Error("Built index.html has no #root.");
  }

  const spa = applyDocument(shell, {
    title: "TAKE.Health",
    head: `<title data-rh="true">TAKE.Health</title>
<meta data-rh="true" name="robots" content="noindex,nofollow" />`,
    body: "",
  });
  writeFile("spa.html", spa);

  const notFound = applyDocument(shell, {
    title: "Page Not Found | TAKE.Health",
    head: `<title data-rh="true">Page Not Found | TAKE.Health</title>
<meta data-rh="true" name="description" content="This page is not on TAKE.Health." />
<meta data-rh="true" name="robots" content="noindex,nofollow" />`,
    body: `<main style="max-width:42rem;margin:2rem auto;padding:0 1.25rem;font-family:Georgia,serif;line-height:1.5;color:#14221f">
<h1>Page not found</h1>
<p>That address is not a page on TAKE.Health.</p>
<p><a href="${esc(siteUrl.replace(/\/+$/, "") + "/")}">Go to the homepage</a></p>
</main>`,
  });
  writeFile("404.html", notFound);

  for (const page of catalog.pages) {
    const html = applyDocument(shell, {
      title: page.title,
      head: headTags(page),
      body: bodyHtml(page),
    });
    const relative = page.path === "/" ? "index.html" : `${page.path.replace(/^\//, "")}/index.html`;
    writeFile(relative, html);
  }

  writeFile("sitemap.xml", sitemapXml());
  writeFile("robots.txt", robotsTxt());
  verify();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readDist(relativePath) {
  return fs.readFileSync(path.join(distDir, relativePath), "utf8");
}

function verify() {
  const titles = new Set();
  for (const page of catalog.pages) {
    const relative = page.path === "/" ? "index.html" : `${page.path.replace(/^\//, "")}/index.html`;
    const html = readDist(relative);
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
    assert(title === page.title, `${page.path} title was ${title}`);
    assert(!titles.has(title) || page.canonicalPath, `${page.path} title is not unique`);
    if (!page.canonicalPath) titles.add(title);
    assert(html.includes(`name="description" content="${esc(page.description)}"`), `${page.path} description`);
    assert(html.includes(`<h1>${esc(page.h1)}</h1>`), `${page.path} h1`);
    assert(html.includes(esc(page.copy[0].slice(0, 40))), `${page.path} copy`);
    const canonical = pageUrl(page);
    const canonicals = html.match(/rel="canonical"[^>]*>/g) || [];
    assert(canonicals.length === 1, `${page.path} canonical count ${canonicals.length}`);
    assert(html.includes(`href="${canonical}"`), `${page.path} canonical ${canonical}`);
    assert(!/onrender\.com/i.test(html), `${page.path} mentions the API host`);
    assert(!html.includes("https://take.health"), `${page.path} uses the apex host`);
    if (page.index === false) assert(html.includes("noindex"), `${page.path} should be noindex`);
    else assert(html.includes("index,follow"), `${page.path} should be indexable`);
  }

  const home = readDist("index.html");
  assert(home.includes("hero-mobile.webp"), "home preloads the mobile hero");
  assert(!home.includes("hero-bg.png"), "home must not preload the unused hero");
  assert(!home.includes("Hero-Section-mobileview.png"), "home must not preload the unused mobile hero");
  assert(!home.includes("/landing/slide1.webp"), "home must not preload slide1");
  assert((home.match(/application\/ld\+json/g) || []).length === 4, "home JSON-LD count");

  const notFound = readDist("404.html");
  assert(notFound.includes("<h1>Page not found</h1>"), "404 h1");
  assert(notFound.includes("noindex"), "404 noindex");
  assert(!/rel="canonical"/i.test(notFound), "404 must not canonicalise");

  const spa = readDist("spa.html");
  assert(spa.includes("noindex"), "spa shell noindex");
  assert(!/rel="canonical"/i.test(spa), "spa shell must not canonicalise");
  assert(spa.includes("<div id=\"root\"></div>"), "spa shell keeps the mount node");

  const sitemap = readDist("sitemap.xml");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert(new Set(locs).size === locs.length, "sitemap has duplicate locs");
  assert(locs.every((loc) => loc.startsWith("https://www.take.health")), "sitemap host");
  assert(!locs.some((loc) => /\/login|\/register/.test(loc)), "sitemap lists a private auth route");
  assert(locs.includes("https://www.take.health/"), "sitemap home");
  assert(locs.includes("https://www.take.health/about"), "sitemap about");
  assert(sitemap.includes(`<lastmod>${catalog.updated}</lastmod>`), "sitemap lastmod");
  assert(!sitemap.includes("2024-05-09"), "stale lastmod");

  const robots = readDist("robots.txt");
  assert(robots.includes("Sitemap: https://www.take.health/sitemap.xml"), "robots sitemap");
  assert(robots.includes("Disallow: /login"), "robots login");
  assert(robots.includes("Disallow: /register"), "robots register");
  assert(!/GPTBot|ClaudeBot|Google-Extended/.test(robots), "robots must not add AI-crawler blocks");

  const llms = readDist("llms.txt");
  assert(llms.includes("https://www.take.health"), "llms host");
  assert(/Apple Watch and WHOOP connect directly/.test(llms), "llms wearables");
  const banned = ["NMN", "Aayush", "Health Score", "AI Coach", "every wearable", "5000+", "4.9/5"];
  for (const word of banned) {
    assert(!llms.toLowerCase().includes(word.toLowerCase()), `llms.txt contains ${word}`);
  }

  const vercel = JSON.parse(fs.readFileSync(path.resolve(clientDir, "../vercel.json"), "utf8"));
  const rewrites = vercel.rewrites || [];
  assert(!rewrites.some((rule) => rule.source === "/((?!assets/).*)"), "catch-all rewrite still present");
  assert(!rewrites.some((rule) => rule.source === "/sitemap.xml"), "sitemap should be the static file");
  const destinations = new Set(rewrites.filter((rule) => rule.destination === "/spa.html").map((rule) => rule.source));
  for (const source of catalog.spa.exact) assert(destinations.has(source), `missing SPA rewrite ${source}`);
  for (const prefix of catalog.spa.prefixes) {
    assert(destinations.has(`${prefix}/:path*`), `missing SPA rewrite ${prefix}/:path*`);
  }
  for (const pattern of catalog.spa.patterns) {
    assert(destinations.has(pattern.source), `missing SPA rewrite ${pattern.source}`);
  }
  assert((vercel.redirects || []).some((rule) => rule.source === "/register" && rule.destination === "/waitlist"), "register redirect");

  const og = fs.readFileSync(path.join(distDir, "og-home.jpg"));
  assert(og[0] === 0xff && og[1] === 0xd8, "og-home.jpg is not a JPEG");
  assert(og.length > 5000 && og.length < 200000, `og-home.jpg size ${og.length}`);

  assert(fs.existsSync(path.join(distDir, "updated-landing/hero-mobile.webp")), "mobile hero");
  assert(fs.existsSync(path.join(distDir, "updated-landing/hero-desktop.webp")), "desktop hero");
  assert(!fs.existsSync(path.join(distDir, "updated-landing/Hero_Section_2.png")), "old mobile hero still shipped");
  assert(!fs.existsSync(path.join(distDir, "updated-landing/hero-bg.png")), "unused hero preload still shipped");

  assert(isSpaPath("/dashboard", catalog), "dashboard is an app route");
  assert(isSpaPath("/reports/abc", catalog), "report detail is an app route");
  assert(isSpaPath("/admin/users", catalog), "admin is an app route");
  assert(!isSpaPath("/about", catalog), "about is not an app route");
  assert(!isSpaPath("/this-page-should-not-exist-xyz123", catalog), "unknown path");
  assert(pageByPath("/about", catalog)?.h1, "about catalog");
  assert(normalizePath("/about/") === "/about", "trailing slash");

  console.log(`Prerendered ${catalog.pages.length} public routes at ${siteUrl}`);
}

build();
