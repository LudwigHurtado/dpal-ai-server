import { Router, type Request, type Response } from "express";

const router = Router();

router.post("/score", async (req: Request, res: Response) => {
  const {
    baseTrust = 50,
    evidenceIntegrity = 50,
    timeliness = 50,
    historicalAccuracy = 50,
    peerConsensus = 50,
  } = req.body || {};

  const weighted =
    Number(baseTrust) * 0.15 +
    Number(evidenceIntegrity) * 0.35 +
    Number(timeliness) * 0.1 +
    Number(historicalAccuracy) * 0.25 +
    Number(peerConsensus) * 0.15;

  const trustScore = Math.max(0, Math.min(100, Number(weighted.toFixed(2))));
  const confidence = Math.max(0, Math.min(100, Number((trustScore * 0.9 + Number(evidenceIntegrity) * 0.1).toFixed(2))));

  return res.json({
    ok: true,
    trustScore,
    confidence,
    weights: {
      baseTrust: 0.15,
      evidenceIntegrity: 0.35,
      timeliness: 0.1,
      historicalAccuracy: 0.25,
      peerConsensus: 0.15,
    },
    label: trustScore >= 85 ? "High" : trustScore >= 65 ? "Medium" : "Low",
  });
});

export default router;
