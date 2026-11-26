export function normalizePath(pathname) {
  if (!pathname) return "/";
  const pathOnly = String(pathname).split("?")[0].split("#")[0];
  if (pathOnly.length > 1 && pathOnly.endsWith("/")) return pathOnly.slice(0, -1);
  return pathOnly || "/";
}

export function isSpaPath(pathname, catalog) {
  const path = normalizePath(pathname);
  const spa = catalog.spa || {};
  if ((spa.exact || []).includes(path)) return true;
  if ((spa.prefixes || []).some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return true;
  }
  return (spa.patterns || []).some((pattern) => new RegExp(pattern.regex).test(path));
}

export function pageByPath(pathname, catalog) {
  const path = normalizePath(pathname);
  return (catalog.pages || []).find((page) => page.path === path) || null;
}
