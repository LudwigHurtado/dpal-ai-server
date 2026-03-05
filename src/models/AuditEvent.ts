import mongoose, { Schema } from "mongoose";

export interface IAuditEvent extends mongoose.Document {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  hash: string;
  ip?: string;
  userAgent?: string;
  meta?: any;
  createdAt: Date;
}

const AuditEventSchema = new Schema<IAuditEvent>(
  {
    actorUserId: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, required: true },
    hash: { type: String, required: true, index: true },
    ip: String,
    userAgent: String,
    meta: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditEventSchema.index({ actorUserId: 1, createdAt: -1 });
AuditEventSchema.index({ action: 1, createdAt: -1 });
AuditEventSchema.index({ entityType: 1, entityId: 1 });

// Prevent model overwrite in dev / nodemon reloads
export const AuditEvent =
  mongoose.models.AuditEvent || mongoose.model<IAuditEvent>("AuditEvent", AuditEventSchema);
