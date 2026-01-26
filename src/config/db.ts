import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDb() {
  if (!env.MONGODB_URI) {
    console.warn("⚠️ Skipping Mongo connection (no URI).");
    return;
  }

  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log("✅ Mongo connected");
  } catch (error: any) {
    console.error("⚠️ Mongo connection failed (server will continue without DB):", error.message);
    // Don't throw - let server start without DB for now
  }
}