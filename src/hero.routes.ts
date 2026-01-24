import { Router } from "express";
import { Hero } from "../models/Hero.js";
import { ensureWallet } from "./services/ledger.service.js";

const router = Router();

router.get("/:heroId", async (req, res, next) => {
  try {
    const { heroId } = req.params;

    let hero = await Hero.findOne({ heroId });
    if (!hero) hero = await Hero.create({ heroId });

    await ensureWallet(heroId);

    res.json({ ok: true, hero });
  } catch (e) {
    next(e);
  }
});

router.put("/:heroId", async (req, res, next) => {
  try {
    const { heroId } = req.params;

    const allowed = new Set([
      "displayName",
      "tagline",
      "bio",
      "avatarUrl",
      "homeCity",
      "homeRegion",
      "homeCountry",
      "homeLat",
      "homeLng",
      "preferredCategories",
      "level",
      "xp",
      "reputation",
      "equippedNftIds"
    ]);

    const patch: Record<string, any> = {};
    for (const [k, v] of Object.entries(req.body || {})) {
      if (allowed.has(k)) patch[k] = v;
    }

    const hero = await Hero.findOneAndUpdate(
      { heroId },
      { $set: patch, $setOnInsert: { heroId } },
      { new: true, upsert: true }
    );

    await ensureWallet(heroId);

    res.json({ ok: true, hero });
  } catch (e) {
    next(e);
  }
});

export default router;
