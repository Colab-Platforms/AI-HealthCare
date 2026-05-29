/**
 * Swagger / OpenAPI loader.
 *
 * Loads `docs/swagger.yaml` from the repo root, lightly patches the `servers`
 * block at runtime so the host shown in the UI always matches the deployment
 * (local / Railway / Vercel / custom domain), and exports both the parsed
 * spec and a ready-to-mount middleware.
 */

const fs = require("fs");
const path = require("path");
const YAML = require("yamljs");
const swaggerUi = require("swagger-ui-express");

// Candidate locations for the spec, in priority order. The first existing
// file wins. This lets us keep a single canonical file in /docs while still
// supporting Vercel-style deployments where only the /server folder is shipped.
const SPEC_CANDIDATES = [
  path.resolve(__dirname, "..", "..", "docs", "swagger.yaml"),
  path.resolve(__dirname, "..", "swagger.yaml"),
  path.resolve(__dirname, "swagger.yaml"),
  path.resolve(process.cwd(), "docs", "swagger.yaml"),
  path.resolve(process.cwd(), "swagger.yaml"),
];

let SPEC_PATH = null;
for (const p of SPEC_CANDIDATES) {
  if (fs.existsSync(p)) {
    SPEC_PATH = p;
    break;
  }
}

function loadSpec() {
  if (!SPEC_PATH) {
    console.warn(
      "[Swagger] Spec not found in any candidate location. /api-docs disabled.",
      SPEC_CANDIDATES,
    );
    return null;
  }
  try {
    const spec = YAML.load(SPEC_PATH);
    console.log(`[Swagger] Spec loaded from ${SPEC_PATH}`);
    return spec;
  } catch (err) {
    console.error("[Swagger] Failed to parse swagger.yaml:", err.message);
    return null;
  }
}

const baseSpec = loadSpec();

function buildServers(req) {
  const proto =
    req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const liveBase = `${proto}://${host}/api`;

  const defaults = [
    { url: liveBase, description: "Current host" },
    { url: "http://localhost:5001/api", description: "Local dev" },
  ];

  if (process.env.PRODUCTION_API_URL) {
    defaults.push({
      url: process.env.PRODUCTION_API_URL.replace(/\/$/, ""),
      description: "Production",
    });
  }

  const seen = new Set();
  return defaults.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

const swaggerUiOptions = {
  explorer: true,
  customSiteTitle: "FitCure / take.health — API Docs",
  customCss: `
    .topbar { background: #0f172a; }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
    .swagger-ui .info .title { color: #0f172a; }
    .swagger-ui .info { margin: 24px 0; }
  `,
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: "none",
    filter: true,
    displayRequestDuration: true,
    tryItOutEnabled: true,
    defaultModelsExpandDepth: 1,
    defaultModelExpandDepth: 2,
    syntaxHighlight: { activate: true, theme: "monokai" },
  },
};

/**
 * Mount the Swagger UI + JSON / YAML routes onto an Express app.
 * Safe to call even when the spec failed to load (no-op in that case).
 *
 * Mounted routes:
 *   GET  /api-docs           → Interactive Swagger UI
 *   GET  /api-docs.json      → Raw OpenAPI JSON
 *   GET  /api-docs.yaml      → Raw OpenAPI YAML
 */
function mountSwagger(app) {
  if (!baseSpec) return;

  app.get("/api-docs.json", (req, res) => {
    const spec = { ...baseSpec, servers: buildServers(req) };
    res.json(spec);
  });

  app.get("/api-docs.yaml", (req, res) => {
    if (!SPEC_PATH) return res.status(404).end();
    res.type("text/yaml").sendFile(SPEC_PATH);
  });

  app.use(
    "/api-docs",
    (req, res, next) => {
      req.swaggerDoc = { ...baseSpec, servers: buildServers(req) };
      next();
    },
    swaggerUi.serveFiles(null, swaggerUiOptions),
    swaggerUi.setup(null, swaggerUiOptions),
  );

  console.log("[Server] Swagger UI mounted at /api-docs");
}

module.exports = { mountSwagger, baseSpec };
