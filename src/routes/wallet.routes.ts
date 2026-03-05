import { Router } from "express";
import { getWallet, earn, spend, transfer } from "../services/ledger.service.js";

const router = Router();

router.get("/:heroId", async (req, res, next) => {
  try {
    const { heroId } = req.params;
    const wallet = await getWallet(heroId);
    res.json({ ok: true, wallet });
  } catch (e) {
    next(e);
  }
});

router.post("/earn", async (req, res, next) => {
  try {
    const { heroId, amount, memo, refId } = req.body || {};
    const wallet = await earn(String(heroId), Number(amount), String(memo || ""), String(refId || ""));
    res.json({ ok: true, wallet });
  } catch (e) {
    next(e);
  }
});

router.post("/spend", async (req, res, next) => {
  try {
    const { heroId, amount, memo, refId, type } = req.body || {};
    const wallet = await spend(
      String(heroId),
      Number(amount),
      String(memo || ""),
      String(refId || ""),
      String(type || "SPEND")
    );
    res.json({ ok: true, wallet });
  } catch (e) {
    next(e);
  }
});

router.post("/transfer", async (req, res, next) => {
  try {
    const { fromHeroId, toHeroId, amount, memo, refId } = req.body || {};
    const result = await transfer(
      String(fromHeroId),
      String(toHeroId),
      Number(amount),
      String(memo || ""),
      String(refId || "")
    );
    res.json({ ok: true, ...result });
  } catch (e) {
    next(e);
  }
});

export default router;
