import { Router, Request, Response } from "express";
import { purchaseStoreItem, purchaseIapPack } from "../services/store.service.js";

const router = Router();

router.post("/purchase-item", async (req: Request, res: Response) => {
  try {
    const { heroId, item } = req.body;

    if (!heroId || typeof heroId !== "string") {
      return res.status(400).json({ error: "heroId is required" });
    }

    if (!item || !item.sku || !item.name || typeof item.price !== "number") {
      return res.status(400).json({ error: "Invalid item data" });
    }

    const result = await purchaseStoreItem(heroId, {
      sku: item.sku,
      name: item.name,
      description: item.description || "",
      icon: item.icon || "",
      price: item.price,
    });

    res.json({ ok: true, ...result });
  } catch (error: any) {
    console.error("Store purchase error:", error);
    res.status(400).json({ error: error.message || "Purchase failed" });
  }
});

router.post("/purchase-iap", async (req: Request, res: Response) => {
  try {
    const { heroId, pack } = req.body;

    if (!heroId || typeof heroId !== "string") {
      return res.status(400).json({ error: "heroId is required" });
    }

    if (!pack || !pack.sku || typeof pack.price !== "number" || typeof pack.hcAmount !== "number") {
      return res.status(400).json({ error: "Invalid pack data" });
    }

    const result = await purchaseIapPack(heroId, pack);
    res.json({ ok: true, ...result });
  } catch (error: any) {
    console.error("IAP purchase error:", error);
    res.status(400).json({ error: error.message || "Purchase failed" });
  }
});

export default router;