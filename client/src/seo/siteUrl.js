/**
 * Public site origin for canonicals, Open Graph, sitemap, and JSON-LD.
 * Never use VITE_API_URL here. That variable is the API host.
 *
 * Set VITE_SITE_URL at build time (no trailing slash).
 * Safe default: https://www.take.health
 */
export const SITE_URL_DEFAULT = "https://www.take.health";

function readConfiguredSiteUrl() {
  let value = "";
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SITE_URL) {
    value = import.meta.env.VITE_SITE_URL;
  }
  if (!value && typeof process !== "undefined" && process.env && process.env.VITE_SITE_URL) {
    value = process.env.VITE_SITE_URL;
  }
  return String(value || "").trim();
}

export function getSiteUrl() {
  const configured = readConfiguredSiteUrl().replace(/\/+$/, "");
  if (!configured) return SITE_URL_DEFAULT;
  // A mistaken API origin must not become the canonical host again.
  if (/onrender\.com/i.test(configured) || /\/api$/i.test(configured)) {
    return SITE_URL_DEFAULT;
  }
  if (!/^https:\/\//i.test(configured)) return SITE_URL_DEFAULT;
  return configured;
}
