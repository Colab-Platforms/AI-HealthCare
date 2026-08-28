// .env MUST be loaded before any local module is required. Modules such as
// config/env and config/db read process.env at import time, so requiring them
// first made every .env-supplied value (NODE_ENV included) invisible to them.
const path = require("path");
const dotenv = require("dotenv");

dotenv.config(); // Works for local dev (CWD = server/)
dotenv.config({ path: path.join(__dirname, ".env") }); // Works for Railway (CWD = repo root)

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const fs = require("fs");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const compression = require("compression");
const { isProduction } = require("./config/env");
const connectDB = require("./config/db");

// Create uploads dir (skip on Vercel - uses memory/cloudinary)
if (!process.env.VERCEL) {
  const uploadsDir = path.join(__dirname, "uploads");
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (error) {
    console.error("Error creating uploads directory:", error);
  }
}

const app = express();

// App runs behind Vercel/Cloudflare — trust the first proxy hop so
// express-rate-limit (and req.ip generally) sees the real client IP
// from X-Forwarded-For instead of the proxy's IP for every request.
app.set("trust proxy", 1);

// Improved Database Middleware
app.use(async (req, res, next) => {
  const skipPaths = ["/api/health-check", "/api/ping", "/api/debug-connection"];
  // Skip DB lookup for the docs routes — they're pure file reads.
  if (
    req.path.startsWith("/api-docs") ||
    skipPaths.some((p) => req.path === p || req.originalUrl === p)
  )
    return next();

  try {
    if (mongoose.connection.readyState !== 1) {
      if (!process.env.MONGODB_URI)
        throw new Error("MONGODB_URI is not defined");
      await connectDB();
    }
    next();
  } catch (error) {
    console.error("[DB Middleware] Critical Failure:", error.message);
    res.status(503).json({
      message: "Database connection failed. Please try again in a few seconds.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Service Unavailable",
      hint: "The server is currently establishing database links.",
      timestamp: new Date().toISOString(),
    });
  }
});

// Security headers (XSS, clickjacking, MIME sniffing, etc.)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // allow Cloudinary images
  contentSecurityPolicy: false, // frontend handles its own CSP
}));

// Gzip all responses (cuts payload size ~70%)
app.use(compression());

// Strip $ and . from req.body/query/params — blocks MongoDB operator injection
app.use(mongoSanitize());


const ALLOWED_ORIGINS = [
  ...(process.env.ALLOWED_ORIGINS || "").split(","),
  process.env.CLIENT_URL || "",
]
  .map((s) => s.trim())
  .filter(Boolean);

const hostnameOf = (value) => {
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).hostname;
  } catch {
    return null;
  }
};

function isAllowedOrigin(origin) {
  const host = hostnameOf(origin);
  if (!host) return false;

  return ALLOWED_ORIGINS.some((entry) => {
    if (entry.startsWith("*.")) {
      const base = entry.slice(2).toLowerCase();
      return host === base || host.toLowerCase().endsWith(`.${base}`);
    }
    const entryHost = hostnameOf(entry);
    return !!entryHost && entryHost.toLowerCase() === host.toLowerCase();
  });
}

const isLocalOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin);

let warnedOpenCors = false;

app.use(
  cors({
    origin: function (origin, callback) {
      // No Origin header: same-origin, mobile apps, curl, server-to-server.
      if (!origin) return callback(null, true);

      if (!isProduction && isLocalOrigin(origin)) return callback(null, true);

      if (ALLOWED_ORIGINS.length === 0) {
        if (isProduction) {
          // Fail closed in production: an empty allow-list must never mean
          // "accept everything" for a credentialed CORS config.
          console.error(
            "[CORS] ALLOWED_ORIGINS is not set in production — rejecting all cross-origin requests.",
          );
          return callback(new Error("Not allowed by CORS"));
        }
        if (!warnedOpenCors) {
          warnedOpenCors = true;
          console.warn(
            "⚠️  [CORS] ALLOWED_ORIGINS is not set — every origin is accepted (dev only). " +
              "Set it (comma-separated) to restrict access.",
          );
        }
        return callback(null, true);
      }

      if (isAllowedOrigin(origin)) return callback(null, true);

      console.warn(`[CORS] Rejected origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
// Capture exact raw bytes for webhook signature verification (QStash, etc.) —
// re-serializing req.body with JSON.stringify can produce a different string
// than what was actually sent (e.g. empty body becomes "{}"), breaking signatures.
const captureRawBody = (req, res, buf) => { req.rawBody = buf.toString("utf8"); };

// A 50mb limit applied to *every* endpoint means a handful of concurrent large
// bodies can exhaust a 512MB instance. Only the food-analysis endpoints legitimately
// receive big payloads (base64-encoded photos, which inflate ~33% over the raw
// image), so they get headroom and everything else is capped. These are mounted
// first — whichever json parser runs first owns the body.
const IMAGE_JSON_ROUTES = [
  "/api/nutrition/analyze-food",
  "/api/nutrition/quick-check",
  "/nutrition/analyze-food", // Vercel mounts routes without the /api prefix too
  "/nutrition/quick-check",
];
app.use(IMAGE_JSON_ROUTES, express.json({ limit: "15mb", verify: captureRawBody }));

app.use(express.json({ limit: "2mb", verify: captureRawBody }));
app.use(express.urlencoded({ limit: "2mb", extended: true }));

if (!process.env.VERCEL) {
  const uploadsDir = path.join(__dirname, "uploads");
  app.use("/uploads", express.static(uploadsDir));
}

// 📘 Swagger / OpenAPI docs (interactive UI + raw JSON/YAML)
try {
  const { mountSwagger } = require("./config/swagger");
  mountSwagger(app);
} catch (err) {
  console.error("[Server] Failed to mount Swagger UI:", err.message);
}

// Debug endpoint for diagnostic purposes — not for production traffic:
// it leaks DB host/name and a user document to anyone who can reach it.
app.get("/api/debug-connection", async (req, res) => {
  if (process.env.NODE_ENV === "production" && process.env.DEBUG_HTTP !== "true") {
    return res.status(404).end();
  }

  const results = {
    timestamp: new Date().toISOString(),
    steps: [],
  };

  try {
    const startConnect = Date.now();
    await connectDB();
    results.steps.push({
      step: "connect",
      success: true,
      durationMs: Date.now() - startConnect,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      dbName: mongoose.connection.name,
    });
  } catch (err) {
    results.steps.push({
      step: "connect",
      success: false,
      error: err.message,
    });
    return res.status(503).json(results);
  }

  // Raw DB query
  try {
    const startQuery = Date.now();
    const userCount = await mongoose.connection.db
      .collection("users")
      .countDocuments();
    results.steps.push({
      step: "query_test",
      success: true,
      durationMs: Date.now() - startQuery,
      userCount,
    });
  } catch (err) {
    results.steps.push({
      step: "query_test",
      success: false,
      error: err.message,
    });
  }

  // Mongoose Model query (This failed previously)
  try {
    const startModel = Date.now();
    const User = require("./models/User");
    const user = await User.findOne({})
      .select("email name")
      .lean()
      .maxTimeMS(10000);
    results.steps.push({
      step: "model_query",
      success: true,
      durationMs: Date.now() - startModel,
      foundUser: !!user,
    });
  } catch (err) {
    results.steps.push({
      step: "model_query",
      success: false,
      error: err.message,
    });
  }

  results.overall = results.steps.every((s) => s.success !== false)
    ? "ALL_PASSED"
    : "SOME_FAILED";
  res.json(results);
});

// Health check endpoint
app.get("/api/health-check", async (req, res) => {
  let dbConnected = mongoose.connection.readyState === 1;
  let connectionError = null;

  if (!dbConnected) {
    try {
      await connectDB();
      dbConnected = mongoose.connection.readyState === 1;
    } catch (error) {
      connectionError = error.message;
    }
  }

  const payload = {
    status: "ok",
    message: "TakeHealth API",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    dbConnected,
    dbState: mongoose.connection.readyState,
    connectionError,
  };

  // Config-presence info is useful for debugging deploys but tells an
  // unauthenticated caller which secrets are configured — dev-only.
  if (process.env.NODE_ENV !== "production" || process.env.DEBUG_HTTP === "true") {
    payload.envVars = {
      MONGODB_URI: process.env.MONGODB_URI ? "SET" : "NOT SET",
      JWT_SECRET: process.env.JWT_SECRET ? "SET" : "NOT SET",
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? "SET" : "NOT SET",
      CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME
        ? "SET"
        : "NOT SET",
    };
  }

  res.json(payload);
});

// Friendly redirects → interactive docs
app.get(["/", "/docs"], (req, res) => res.redirect("/api-docs"));

// 🛠️ Global Request Logger (For Debugging 404s)
// Off in production: this fired on every request, and stdout on a hosted
// platform is a pipe that applies backpressure once it's busy — so a debug aid
// turns into per-request latency. Set DEBUG_HTTP=true to switch it back on.
if (!isProduction || process.env.DEBUG_HTTP === "true") {
  app.use((req, res, next) => {
    console.log(
      `[Incoming Request] ${req.method} ${req.path} | Host: ${req.headers.host}`,
    );
    next();
  });
}

// 🔍 Direct Debug Routes (Bypass all routers/auth)
app.get("/api/ping", (req, res) =>
  res.json({ status: "pong", domain: req.headers.host }),
);
// 🛡️ Admin Deep-Trace — dev-only request logging. The old diagnostic-ping
// shortcut here used to answer /api/admin/ping-internal with no auth check,
// bypassing the protect+authorize gate in adminRoutes.js entirely. Removed;
// ping-internal is now only served by the authenticated route in that router.
app.use("/api/admin", (req, res, next) => {
  if (!isProduction || process.env.DEBUG_HTTP === "true") {
    console.log(
      `[Admin Trace Stage 1] Request: ${req.method} ${req.originalUrl}`,
    );
  }
  next();
});

try {
  // 🛡️ ADMIN ROUTER
  try {
    const adminRouter = require("./routes/adminRoutes");
    app.use("/api/admin", adminRouter);
    console.log("[Server] ✅ Admin Router mounted at /api/admin");

    // Support Railway/Vercel fallbacks
    app.use("/admin", adminRouter);
  } catch (adminErr) {
    console.error(
      "[Server] ❌ CRITICAL FAIL: adminRouter loading error:",
      adminErr.message,
    );
    console.error(adminErr.stack);
  }

  const routes = [
    { path: "/api/auth", module: "./routes/authRoutes" },
    { path: "/api/health", module: "./routes/healthRoutes" },
    { path: "/api/metrics", module: "./routes/metricRoutes" },
    { path: "/api/doctors", module: "./routes/doctorRoutes" },
    { path: "/api/wearables", module: "./routes/wearableRoutes" },
    { path: "/api/wearable", module: "./routes/wearableRoutes" },
    { path: "/api/nutrition", module: "./routes/nutritionRoutes" },
    { path: "/api/exercise", module: "./routes/exerciseRoutes" },
    {
      path: "/api/diet-recommendations",
      module: "./routes/dietRecommendationRoutes",
    },
    { path: "/api/users", module: "./routes/userRoutes" },
    { path: "/api/gamification", module: "./routes/gamificationRoutes" },
    { path: "/api/notifications", module: "./routes/notificationRoutes" },
    { path: "/api/notification-preferences", module: "./routes/notificationPreferenceRoutes" },
    { path: "/api/chat", module: "./routes/chatHistoryRoutes" },
    { path: "/api/translate", module: "./routes/translateRoutes" },
    { path: "/api/food-safety", module: "./routes/foodSafetyRoutes" },
    { path: "/api/documents", module: "./routes/documentRoutes" },
    { path: "/api/privacy",   module: "./routes/privacyRoutes" },
    { path: "/api/activity", module: "./routes/activityRoutes" },
    { path: "/api/insights", module: "./routes/insightRoutes" },
    { path: "/api/support", module: "./routes/supportRoutes" },
    { path: "/api/waitlist", module: "./routes/waitlistRoutes" },
    { path: "/api/subscription", module: "./routes/subscriptionRoutes" },
    { path: "/", module: "./routes/fastrrRoutes" }, // Fastrr scaffolding: /shiprocket/*, /api/checkout/start, /api/fastrr/webhook
    { path: "/api", module: "./routes/sitemapRoutes" }, // SEO: sitemap & robots
    { path: "/api", module: "./routes/chatRoutes" }, // 🔚 Generic catch-all goes last
  ];

  routes.forEach((route) => {
    try {
      const router = require(route.module);
      app.use(route.path, router);
      console.log(`[Server] Mounted: ${route.path}`);

      // Support direct access on Vercel (fallback if /api is stripped)
      if (process.env.VERCEL && route.path.startsWith("/api/")) {
        const fallbackPath = route.path.replace("/api", "");
        if (fallbackPath && fallbackPath !== "/") {
          app.use(fallbackPath, router);
          console.log(`[Server] Mounted Vercel fallback: ${fallbackPath}`);
        }
      }
    } catch (err) {
      console.error(`Error loading route ${route.path}:`, err.message);
    }
  });
} catch (error) {
  console.error("Critical error in route registration:", error);
}

app.use((err, req, res, next) => {
  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    console.error(
      `[Server Error Handler]: Unexpected field "${err.field}" on ${req.method} ${req.originalUrl}`,
    );
  } else {
    console.error("[Server Error Handler]:", err.message);
  }
  const status = err.status || err.statusCode || 500;

  // 4xx messages describe what the caller did wrong and are safe (and useful)
  // to return. 5xx messages are internal — driver errors, stack-derived text,
  // connection strings — and used to be sent to the client verbatim.
  const safeMessage = status < 500
    ? err.message || "Request could not be processed"
    : "Something went wrong. Please try again.";

  res.status(status).json({
    message: isProduction ? safeMessage : err.message || "Something went wrong!",
    path: req.originalUrl,
    error: isProduction ? undefined : err.stack,
  });
});

// 🕵️ 404 FALLBACK TRAP
app.use((req, res) => {
  console.warn(
    `[404 NOT FOUND] ${req.method} ${req.originalUrl} | Host: ${req.headers.host} | UserAgent: ${req.headers["user-agent"]}`,
  );
  res.status(404).json({
    message: "Route not found in TakeHealth API",
    requestedPath: req.originalUrl,
    hint: "Check if the path starts with /api",
  });
});

// Pre-warm database connection at module load
connectDB().catch((err) => {
  console.error("Initial DB connection failed:", err.message);
});

// Initialize services (only if not on Vercel)
if (!process.env.VERCEL) {
  require("./services/reminderService");
  require("./services/healthScoreCronService");
  try {
    require("./services/notificationService");
  } catch (e) {
    console.error("Notification service error:", e);
  }

  const cron = require("node-cron");

  // Food Safety Sync — midnight daily
  const { syncFoodSafetyDatabase } = require("./services/foodSafetyService");
  cron.schedule("0 0 * * *", async () => {
    console.log("⏰ Running scheduled Food Safety Sync...");
    await syncFoodSafetyDatabase();
  });

  // DPDPA Account Deletion — midnight daily
  const { runDeletionCron } = require('./controllers/privacyController');
  cron.schedule('0 0 * * *', async () => {
    console.log('🗑️ Running DPDPA deletion cron...');
    await runDeletionCron();
  });

  // Subscription Lifecycle — expiry downgrade + past_due grace period, midnight daily
  const { runSubscriptionLifecycleCron, runRenewalReminderCron } = require('./services/subscriptionLifecycleService');
  cron.schedule('0 0 * * *', async () => {
    console.log('💳 Running subscription lifecycle cron...');
    await runSubscriptionLifecycleCron();
  });

  // Manual-renewal reminder — one-time-payment flow has no auto-renew, so remind users
  // a few days before currentPeriodEnd. Runs at 9 AM daily.
  cron.schedule('0 9 * * *', async () => {
    console.log('📧 Running subscription renewal reminder cron...');
    await runRenewalReminderCron();
  });

  // Follow-up Nudges — every night at 10 PM
  const { runNudgeCron } = require("./services/nudgeService");
  cron.schedule("0 22 * * *", async () => {
    console.log("🔔 Starting Follow-up Nudge cron...");
    await runNudgeCron();
  });

  // Daily Insights — 11:59 PM IST, the last moment of the day being analysed.
  // Writes tomorrow-dated rows so the user opens the app to a fresh "yesterday
  // you did X, today try Y" pair. Explicitly pinned to Asia/Kolkata: the host
  // runs on UTC, where 11:59 PM would land at 5:29 AM IST and analyse the
  // wrong day. See services/dailyInsightService.js.
  const { runDailyInsightCron } = require("./services/dailyInsightService");
  cron.schedule("59 23 * * *", async () => {
    console.log("💡 Running Daily Insight generation cron...");
    await runDailyInsightCron();
  }, { timezone: "Asia/Kolkata" });

  // Streak Loss Warning — every night at 8 PM
  cron.schedule("0 20 * * *", async () => {
    console.log("🔥 Running streak loss warning cron...");
    await runStreakWarningCron();
  });

  async function runStreakWarningCron() {
    try {
      const GamificationLog = require("./models/GamificationLog");
      const User = require("./models/User");
      const { sendToUser } = require("./services/fcmService");
      const gamificationService = require("./services/gamificationService");

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find users who logged something yesterday (have a streak) but NOT today
      const activeUserIds = await GamificationLog.distinct("user", {
        createdAt: { $gte: new Date(today.getTime() - 24 * 60 * 60 * 1000), $lt: today }
      });

      if (!activeUserIds.length) return;

      // Filter: logged today already = no warning needed
      const loggedTodayIds = await GamificationLog.distinct("user", {
        createdAt: { $gte: today }
      });
      const loggedTodaySet = new Set(loggedTodayIds.map(id => id.toString()));

      const toWarn = activeUserIds.filter(id => !loggedTodaySet.has(id.toString()));

      // Process in bounded-concurrency batches rather than one user at a time.
      // The previous loop awaited a streak query, an FCM send AND a fixed 100ms
      // sleep per user in sequence — so the run took at least 100ms × users,
      // several minutes once the user base grew, all while holding a Mongo
      // connection. Batching keeps FCM from being hammered without serialising
      // the whole job.
      const BATCH = 20;
      let warned = 0;

      for (let i = 0; i < toWarn.length; i += BATCH) {
        const batch = toWarn.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(async (userId) => {
          try {
            const streak = await gamificationService.getCurrentStreak(userId);
            if (streak < 3) return 0; // Only warn if streak worth saving (3+ days)

            await sendToUser(userId, {
              title: "🔥 Don't break your streak!",
              body: `You have a ${streak}-day streak! Log any activity today before midnight to keep it alive.`,
              data: { type: "streak_warning", screen: "dashboard" }
            });
            return 1;
          } catch (err) {
            console.error(`Streak warning failed for user ${userId}:`, err.message);
            return 0;
          }
        }));
        warned += results.reduce((a, b) => a + b, 0);
      }

      console.log(`✅ Streak warnings sent to ${warned} users`);
    } catch (err) {
      console.error("❌ Streak warning cron error:", err.message);
    }
  }

  // Optional: Run on startup to ensure fresh data
  // syncFoodSafetyDatabase();
}

// Export app for Vercel or start local server
if (process.env.VERCEL) {
  module.exports = app;
} else {
  const PORT = process.env.PORT || 5001;
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`📘 Interactive API docs: http://localhost:${PORT}/api-docs`);
    if (process.env.RAILWAY_ENVIRONMENT_ID) {
      console.log(
        `🚂 Railway deployment detected: ${process.env.RAILWAY_PUBLIC_DOMAIN || "Ready"}`,
      );
    }
    if (process.env.RENDER) {
      console.log(
        `🚀 Render deployment detected: ${process.env.RENDER_EXTERNAL_URL || "Ready"}`,
      );
    }
  });
}
