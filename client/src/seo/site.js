import catalog from "./public-routes.json";
import { getSiteUrl } from "./siteUrl";
import { isSpaPath as matchSpaPath, normalizePath, pageByPath } from "./matchPath";

export { getSiteUrl, normalizePath };

export function getCatalog() {
  return catalog;
}

export function isSpaPath(pathname) {
  return matchSpaPath(pathname, catalog);
}

export function getPublicPage(pathname) {
  return pageByPath(pathname, catalog);
}

export function getPublicPageByName(pageName) {
  return (catalog.pages || []).find((page) => page.pageName === pageName) || null;
}

export function absoluteUrl(pathname, siteUrl = getSiteUrl()) {
  const origin = siteUrl.replace(/\/+$/, "");
  const path = normalizePath(pathname);
  return path === "/" ? `${origin}/` : `${origin}${path}`;
}
