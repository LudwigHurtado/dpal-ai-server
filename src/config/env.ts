import dotenv from "dotenv";
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 8080),
  MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URL || "",
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || "",
  FRONTEND_ORIGIN_2: process.env.FRONTEND_ORIGIN_2 || "",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
};

export function validateEnv(): void {
  const warnings: string[] = [];
  if (!env.MONGODB_URI) warnings.push("  ⚠️  MONGODB_URI is not set — database will not connect");
  if (!env.GEMINI_API_KEY) warnings.push("  ⚠️  GEMINI_API_KEY is not set — AI features will return placeholders");
  if (!env.FRONTEND_ORIGIN) warnings.push("  ⚠️  FRONTEND_ORIGIN is not set — CORS open to all *.vercel.app");
  console.log("🔧 Environment check:");
  console.log(`   NODE_ENV        : ${env.NODE_ENV}`);
  console.log(`   PORT            : ${env.PORT}`);
  console.log(`   MONGODB_URI     : ${env.MONGODB_URI ? "✅ set" : "❌ missing"}`);
  console.log(`   GEMINI_API_KEY  : ${env.GEMINI_API_KEY ? "✅ set" : "❌ missing"}`);
  console.log(`   FRONTEND_ORIGIN : ${env.FRONTEND_ORIGIN || "(not set — open CORS)"}`);
  if (warnings.length > 0) { console.warn("\n⚠️  Startup warnings:"); warnings.forEach((w) => console.warn(w)); console.warn(""); }
  else console.log("✅ All critical environment variables are set\n");
}
