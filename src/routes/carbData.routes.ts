import { Router } from "express";
import { getCarbDataHealth, importCarbData, searchCarbData } from "../controllers/carbData.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

router.get("/health", getCarbDataHealth);
router.get("/search", searchCarbData);
router.post("/import", authMiddleware, requireRole("admin"), importCarbData);

export default router;

