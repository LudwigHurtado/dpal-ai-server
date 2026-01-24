import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDb() {
  if (!env.MONGODB_URI) {
    console.warn("⚠️ Skipping Mongo connection (no URI).");
    return;
  }

  mongoose.set("strictQuery", true);

  await mongoose.connect(env.MONGODB_URI);
  console.log("✅ Mongo connected");
}
