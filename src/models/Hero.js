import mongoose from "mongoose";

const { Schema } = mongoose;

const HeroSchema = new Schema(
  {
    heroId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    // Profile
    displayName: { type: String, default: "" },
    tagline: { type: String, default: "" },
    bio: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },

    // Location / Preferences
    homeCity: { type: String, default: "" },
    homeRegion: { type: String, default: "" },
    homeCountry: { type: String, default: "" },
    homeLat: { type: Number, default: null },
    homeLng: { type: Number, default: null },
    preferredCategories: { type: [String], default: [] },

    // Progression
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    reputation: { type: Number, default: 0 },

    // Equipment / Vault Summary
    equippedNftIds: { type: [String], default: [] }
  },
  { timestamps: true }
);

// Prevent model overwrite in dev / nodemon reloads
export const Hero = mongoose.models.Hero || mongoose.model("Hero", HeroSchema);
