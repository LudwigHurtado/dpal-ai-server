import mongoose, { Schema } from "mongoose";

export interface INftAsset extends mongoose.Document {
  tokenId: string;
  collectionId: string;
  chain: string;
  metadataUri: string;
  imageUri: string;
  attributes: Array<{ trait_type: string; value: any }>;
  createdByUserId: string;
  status: "DRAFT" | "MINTED" | "BURNED";
  imageData?: Buffer;
  createdAt: Date;
  updatedAt: Date;
}

const NftAssetSchema = new Schema<INftAsset>(
  {
    tokenId: { type: String, required: true, unique: true, index: true },
    collectionId: { type: String, required: true, index: true },
    chain: { type: String, required: true },
    metadataUri: { type: String, required: true },
    imageUri: { type: String, required: true },
    attributes: [{ trait_type: String, value: Schema.Types.Mixed }],
    createdByUserId: { type: String, required: true, index: true },
    status: { type: String, default: "MINTED", enum: ["DRAFT", "MINTED", "BURNED"] },
    imageData: { type: Schema.Types.Buffer },
  },
  { timestamps: true }
);

NftAssetSchema.index({ createdByUserId: 1, createdAt: -1 });
NftAssetSchema.index({ collectionId: 1, status: 1 });

// Prevent model overwrite in dev / nodemon reloads
export const NftAsset = mongoose.models.NftAsset || mongoose.model<INftAsset>("NftAsset", NftAssetSchema);
