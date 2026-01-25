import express from "express";
import { corsMw } from "./middleware/cors.js";
import { errorMw } from "./middleware/error.js";

import heroRoutes from "./hero.routes.js";
import walletRoutes from "./routes/wallet.routes.js";
// ledgerRoutes removed - file is empty and not used

export function createApp() {
  const app = express();

  app.use(corsMw);
  app.options("*", corsMw);

  app.use(express.json({ limit: "256kb" }));

  app.get("/health", (_req, res) => res.json({ ok: true, service: "dpal-backend", ts: Date.now() }));

  app.use("/api/heroes", heroRoutes);
  app.use("/api/wallet", walletRoutes);
  // app.use("/api/ledger", ledgerRoutes); // Commented out - ledger routes not implemented



  app.use(errorMw);
  return app;
}
