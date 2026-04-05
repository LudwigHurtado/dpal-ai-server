import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Persisted hero identity (persona) per operative / optional wallet.
 * Mint uses the same /api/nft/mint pipeline; this record links off-chain data to tokenId.
 */
const SavedHeroPersonaSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    /** Client-generated id (e.g. persona-1739...) — stable across save/sync */
    clientPersonaId: { type: String, required: true },
    /** Optional Web3 identity for future on-chain work */
    walletAddress: { type: String, default: "", index: true, sparse: true },

    name: { type: String, default: "" },
    backstory: { type: String, default: "" },
    combatStyle: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    prompt: { type: String, default: "" },
    archetype: { type: String, default: "Sentinel" },

    isMinted: { type: Boolean, default: false },
    tokenId: { type: String, default: "" },
    metadataUri: { type: String, default: "" },
    mintedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

SavedHeroPersonaSchema.index({ userId: 1, clientPersonaId: 1 }, { unique: true });

export const SavedHeroPersona =
  mongoose.models.SavedHeroPersona ||
  mongoose.model("SavedHeroPersona", SavedHeroPersonaSchema);
