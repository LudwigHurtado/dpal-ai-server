import mongoose from "mongoose";
import { env } from "./env.js";

let connectionAttempted = false;
let connectionState: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';

/**
 * Check if MongoDB is currently connected
 */
export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1; // 1 = connected
}

/**
 * Get MongoDB connection state
 */
export function getDbState(): string {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState as keyof typeof states] || 'unknown';
}

/**
 * Connect to MongoDB with retry logic
 */
export async function connectDb(): Promise<boolean> {
  // If already connected, return true
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  // If no URI, log warning and return false
  if (!env.MONGODB_URI) {
    console.warn("⚠️ Skipping Mongo connection (no MONGODB_URI set).");
    console.warn("   Set MONGODB_URI in Railway environment variables.");
    connectionState = 'error';
    return false;
  }

  // If already attempting connection, wait a bit
  if (connectionAttempted && mongoose.connection.readyState === 2) {
    console.log("⏳ MongoDB connection in progress...");
    return false;
  }

  connectionAttempted = true;
  connectionState = 'connecting';
  mongoose.set("strictQuery", true);

  try {
    // Set connection options for better reliability
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // 10 seconds
      socketTimeoutMS: 45000, // 45 seconds
      connectTimeoutMS: 10000, // 10 seconds
    });
    
    connectionState = 'connected';
    console.log("✅ Mongo connected successfully");
    console.log(`   Database: ${mongoose.connection.db?.databaseName || 'unknown'}`);
    console.log(`   Host: ${mongoose.connection.host || 'unknown'}`);
    return true;
  } catch (error: any) {
    connectionState = 'error';
    console.error("❌ Mongo connection failed:", error.message);
    console.error("   Check MONGODB_URI in Railway environment variables");
    console.error("   Ensure MongoDB service is running and accessible");
    // Don't throw - let server start without DB for now
    return false;
  }
}

// Listen to connection events
mongoose.connection.on('connected', () => {
  connectionState = 'connected';
  console.log('✅ MongoDB connection established');
});

mongoose.connection.on('error', (err) => {
  connectionState = 'error';
  console.error('❌ MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  connectionState = 'disconnected';
  console.warn('⚠️ MongoDB disconnected');
});