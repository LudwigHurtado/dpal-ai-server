import dotenv from "dotenv";
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 8080),

  // Mongo - checks MONGODB_URI first, falls back to MONGO_URL, then empty string
  // db.ts will handle empty string gracefully with a warning
  MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URL || "",

  // Frontend allowed origins (optional)
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || "",
  FRONTEND_ORIGIN_2: process.env.FRONTEND_ORIGIN_2 || "",

  // Optional API keys
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
};