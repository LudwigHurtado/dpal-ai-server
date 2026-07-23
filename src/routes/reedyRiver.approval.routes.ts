import { Router, type Response } from "express";
import { z } from "zod";
import {
  requireActiveReedyRiverAccount,
  type ReedyRiverAccountRequest,
} from "../middleware/reedyRiverAccountGate.js";
import { approveReedyRiverAction } from "../services/reedyRiver.service.approval.js";

const router = Router();
const schema = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().min(12).max(2000),
});

function noStore(res: Response): void {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
}

function statusFor(message: string): number {
  if (message === "database_unavailable") return 503;
  if (message.endsWith("_not_found")) return 404;
  if (message.startsWith("invalid_")) return 409;
  if (message.includes("requires")) return 400;
  return 500;
}

router.patch(
  "/actions/:actionId/approval",
  requireActiveReedyRiverAccount({ operator: true }),
  async (req: ReedyRiverAccountRequest, res: Response) => {
    noStore(res);
    const role = String(req.reedyAccount?.role || "");
    if (!['admin', 'validator'].includes(role)) {
      return res.status(403).json({
        ok: false,
        error: "execution_approval_role_required",
        message: "Execution approval requires an active, verified admin or validator account. Moderators may triage and review but cannot authorize field execution.",
      });
    }
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "validation_error", details: parsed.error.flatten() });
    }
    try {
      const action = await approveReedyRiverAction({
        actionId: String(req.params.actionId),
        decision: parsed.data.decision,
        actorId: String(req.reedyAccount?.userId),
        actorLabel: role,
        note: parsed.data.note,
      });
      return res.json({ ok: true, action });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const status = statusFor(message);
      if (status >= 500) console.error("[Reedy River execution approval]", error);
      return res.status(status).json({
        ok: false,
        error: status >= 500 ? "execution_approval_failed" : message,
        message: status >= 500 ? "No approval or action state was changed." : undefined,
      });
    }
  },
);

export default router;
