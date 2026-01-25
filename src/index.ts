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

// Minting
import { jsonWithRawBody } from "./minting/rawBodyMiddleware.js";
import { mintRoute } from "./minting/mintRoute.js";

// Test mint and asset serving
import { testMintRoute } from "./minting/testMintRoute.js";
import { serveAssetImageRoute } from "./minting/serveAssetImageRoute.js";

const app = express();

/**
 * CORS - allow Vercel previews + optional explicit origins
 */
const allowedOrigins = new Set<string>();
if (process.env.FRONTEND_ORIGIN) allowedOrigins.add(process.env.FRONTEND_ORIGIN);
if (process.env.FRONTEND_ORIGIN_2) allowedOrigins.add(process.env.FRONTEND_ORIGIN_2);

// optional local dev
allowedOrigins.add("http://localhost:5173");
allowedOrigins.add("http://localhost:3000");

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      if (origin.endsWith(".vercel.app")) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`), false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    optionsSuccessStatus: 204,
  })
);
app.options("*", cors());

/**
 * Middleware
 * rawBody capture first (for mint signatures)
 */
app.use(jsonWithRawBody("256kb"));

/**
 * Normal JSON parsing after raw-body capture
 */
app.use(express.json({ limit: "256kb" }));

/**
 * Health check (stable + non-sensitive)
 */
app.get("/health", (_req: Request, res: Response) => {
  res.json({ 
    ok: true, 
    service: "dpal-ai-server", 
    version: "2026-01-24-v2",
    ts: Date.now() 
  });
});

/**
 * AI routes
 */
app.use("/api/ai", aiRoutes);

/**
 * Hero routes (for profile management)
 */
app.use("/api/heroes", heroRoutes);

/**
 * NFT routes
 */
app.use("/api/nft", nftRoutes);

/**
 * Persona routes
 */
app.use("/api/persona", personaRoutes);

/**
 * Mint routes (legacy/compatibility)
 */
app.post("/api/mint", (req: Request, res: Response) => void mintRoute(req, res));
app.post("/api/test/mint", (req: Request, res: Response) => void testMintRoute(req, res));
app.get("/api/assets/:tokenId.png", (req: Request, res: Response) => void serveAssetImageRoute(req, res));

/**
 * Error handler (helps diagnose CORS + route errors)
 */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ ok: false, error: String(err?.message || err) });
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
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();