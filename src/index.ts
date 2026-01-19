import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import aiRoutes from "./routes/ai.routes";

// Minting
import { jsonWithRawBody } from "./minting/rawBodyMiddleware";
import { mintRoute } from "./minting/mintRoute";

const app = express();

/**
 * Middleware
 * jsonWithRawBody MUST run before any JSON parsing so signatures verify correctly.
 */
app.use(cors());
app.use(jsonWithRawBody("256kb"));

/**
 * Health check
 * Keep it stable for Railway monitoring.
 * Do not expose secrets.
 */
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    port: process.env.PORT || 8080,
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasMongo: Boolean(process.env.MONGODB_URI),
    hasMintCap: Boolean(process.env.DPAL_MINT_SUPPLY_CAP),
    hasMintSecret: Boolean(process.env.DPAL_MINT_HMAC_SECRET),
  });
});

/**
 * AI routes
 */
app.use("/api/ai", aiRoutes);

/**
 * Mint route
 * Backend only, signed requests only, idempotent, replay resistant.
 */
app.post("/api/mint", (req, res) => {
  void mintRoute(req, res);
});

/**
 * Server start
 */
const PORT = Number(process.env.PORT) || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`DPAL server running on port ${PORT}`);
});
