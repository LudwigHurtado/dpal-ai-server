import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import aiRoutes from "./routes/ai.routes";

const app = express();

/**
 * Middleware
 */
app.use(cors());
app.use(express.json());

/**
 * Health check
 * Use this to verify server + env variables
 */
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    port: process.env.PORT || 8080,
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY)
  });
});

/**
 * AI routes
 */
app.use("/api/ai", aiRoutes);

/**
 * Server start
 */
const PORT = Number(process.env.PORT) || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AI server running on port ${PORT}`);
});
