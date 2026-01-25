process.on("uncaughtException", (e: any) => {
  console.error("❌ uncaughtException:", e?.stack || e?.message || e);
  process.exit(1);
});
process.on("unhandledRejection", (e: any) => {
  console.error("❌ unhandledRejection:", e?.stack || e?.message || e);
  process.exit(1);
});

import dotenv from "dotenv";
dotenv.config();

import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { connectDb } from "./config/db.js";

import aiRoutes from "./routes/ai.routes.js";
import heroRoutes from "./hero.routes.js";
import nftRoutes from "./routes/nft.routes.js";
import personaRoutes from "./routes/persona.routes.js";

import { mintRoute } from "./minting/mintRoute.js";
import { testMintRoute } from "./minting/testMintRoute.js";
import { serveAssetImageRoute } from "./minting/serveAssetImageRoute.js";

const app = express();

// Railway / proxies
app.set("trust proxy", 1);
app.disable("x-powered-by");

/**
 * Helper: allow comma-separated origins (optional)
 * Example:
 *   FRONTEND_ORIGINS="https://app.example.com,https://preview.example.com"
 */
function addOriginsFromEnv(set: Set<string>, envKey: string) {
  const raw = process.env[envKey];
  if (!raw) return;
  raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((o) => set.add(o));
}

/**
 * CORS allowlist
 */
const allowedOrigins = new Set<string>();

if (process.env.FRONTEND_ORIGIN) allowedOrigins.add(process.env.FRONTEND_ORIGIN);
if (process.env.FRONTEND_ORIGIN_2) allowedOrigins.add(process.env.FRONTEND_ORIGIN_2);
addOriginsFromEnv(allowedOrigins, "FRONTEND_ORIGINS");

// local dev
allowedOrigins.add("http://localhost:5173");
allowedOrigins.add("http://localhost:3000");

/**
 * IMPORTANT: Make /health testable from anywhere (your test panel runs in-browser)
 * Put this BEFORE restrictive CORS middleware.
 */
app.options("/health", cors({ origin: true }));
app.get(
  "/health",
  cors({ origin: true }),
  (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: "dpal-ai-server",
      version: "2026-01-25-v3",
      ts: Date.now(),
    });
  }
);

/**
 * Restrictive CORS for the API
 */
const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    // server-to-server / curl / Railway internal requests
    if (!origin) return cb(null, true);

    // exact matches (custom domains, previews you list explicitly)
    if (allowedOrigins.has(origin)) return cb(null, true);

    // allow Vercel preview/prod domains
    // (origin will look like "https://your-app.vercel.app")
    try {
      const u = new URL(origin);
      if (u.hostname.endsWith(".vercel.app")) return cb(null, true);
    } catch {
      // ignore invalid origin
    }

    return cb(new Error(`CORS blocked: ${origin}`), false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-Request-Id",
  ],
  credentials: false,
  optionsSuccessStatus: 204,
};

// Apply CORS to everything after /health
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/**
 * Body parser (single pass) + raw body capture for mint signatures
 * - keeps req.rawBody as Buffer
 */
app.use(
  express.json({
    limit: "256kb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf; // Buffer
    },
  })
);

/**
 * Routes
 */
app.use("/api/ai", aiRoutes);
app.use("/api/heroes", heroRoutes);
app.use("/api/nft", nftRoutes);
app.use("/api/persona", personaRoutes);

// Legacy/compat mint endpoints
app.post("/api/mint", (req: Request, res: Response) => void mintRoute(req, res));
app.post("/api/test/mint", (req: Request, res: Response) => void testMintRoute(req, res));
app.get("/api/assets/:tokenId.png", (req: Request, res: Response) =>
  void serveAssetImageRoute(req, res)
);

/**
 * 404 helper (so you SEE the mistake instead of silent black screen)
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({ ok: false, error: "Not Found" });
});

/**
 * Error handler (CORS + route errors)
 */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const msg = String(err?.message || err || "Unknown error");
  console.error("❌ Error:", msg);

  // If it's our CORS error, return 403 (more accurate than 500)
  const status = msg.startsWith("CORS blocked:") ? 403 : 500;
  res.status(status).json({ ok: false, error: msg });
});

/**
 * Start server with database connection
 */
async function startServer() {
  try {
    await connectDb();
    const PORT = Number(process.env.PORT) || 8080;

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ DPAL server running on port ${PORT}`);
      console.log(`   /health -> ready`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
