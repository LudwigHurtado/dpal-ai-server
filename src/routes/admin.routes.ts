import { Router, type Request, type Response } from "express";

const router = Router();

/**
 * NOTE: These are ADMIN skeleton endpoints for the DPAL HQ dashboard.
 * They currently return mock data only and should be wired to real
 * database queries and domain services over time.
 *
 * Base path when mounted: /api/admin
 */

router.get("/metrics/overview", (_req: Request, res: Response) => {
  const now = Date.now();

  res.json({
    ok: true,
    ts: now,
    metrics: {
      totalActiveUsers: 12482,
      newUsersToday: 132,
      activeProviders: 43,
      dailyTransactions: 982,
      dailyVolumeUsd: 45230,
      openQcIssues: 7,
      systemUptimePct: 99.98,
      criticalAlerts: 1,
    },
    deltas: {
      users7d: +8.3,
      providers7d: +3.1,
      volume7d: +12.7,
      qcIssues7d: -14.2,
    },
  });
});

router.get("/activity", (_req: Request, res: Response) => {
  const now = Date.now();

  res.json({
    ok: true,
    ts: now,
    items: [
      {
        id: "evt_1",
        type: "user.created",
        actorType: "user",
        actorId: "user_123",
        summary: "New user registered",
        createdAt: new Date(now - 2 * 60 * 1000).toISOString(),
        severity: "info",
      },
      {
        id: "evt_2",
        type: "transaction.processed",
        actorType: "provider",
        actorId: "prov_42",
        summary: "Transaction of $120.00 processed",
        createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
        severity: "success",
      },
      {
        id: "evt_3",
        type: "qc.flagged",
        actorType: "system",
        actorId: "qc_engine",
        summary: "Report flagged for manual review",
        createdAt: new Date(now - 10 * 60 * 1000).toISOString(),
        severity: "warning",
      },
    ],
  });
});

router.get("/qc/cases", (_req: Request, res: Response) => {
  const now = Date.now();

  res.json({
    ok: true,
    ts: now,
    cases: [
      {
        id: "qc_001",
        status: "Pending",
        type: "fraud",
        entityType: "user",
        entityId: "user_123",
        reason: "Multiple failed KYC attempts",
        createdAt: new Date(now - 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now - 30 * 60 * 1000).toISOString(),
      },
      {
        id: "qc_002",
        status: "Under Investigation",
        type: "content",
        entityType: "provider",
        entityId: "prov_42",
        reason: "High dispute rate in last 24h",
        createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now - 45 * 60 * 1000).toISOString(),
      },
    ],
  });
});

router.get("/alerts", (_req: Request, res: Response) => {
  const now = Date.now();

  res.json({
    ok: true,
    ts: now,
    alerts: [
      {
        id: "alert_crit_1",
        level: "critical",
        source: "system-health",
        title: "Elevated error rate in EU region",
        createdAt: new Date(now - 15 * 60 * 1000).toISOString(),
      },
      {
        id: "alert_warn_1",
        level: "warning",
        source: "security",
        title: "Unusual login pattern detected",
        createdAt: new Date(now - 25 * 60 * 1000).toISOString(),
      },
    ],
  });
});

router.get("/system/health", (_req: Request, res: Response) => {
  const now = Date.now();

  res.json({
    ok: true,
    ts: now,
    api: {
      status: "healthy",
      latencyMsP95: 180,
      errorRate1m: 0.1,
    },
    database: {
      status: "healthy",
      connections: 32,
      queriesPerSecond: 140,
    },
    queues: {
      status: "healthy",
      itemsPending: 12,
    },
    security: {
      status: "watch",
      recentIncidents: 1,
    },
  });
});

export default router;

