export interface FeatureFlags {
  hardSyncFinalizeEnabled: boolean;
  verifierReputationEnabled: boolean;
  missionOpenDataIngestionEnabled: boolean;
  opsConfidencePanelEnabled: boolean;
  transparencyLiveMetricsEnabled: boolean;
}

const envFlag = (key: string, defaultValue = true): boolean => {
  const raw = String(process.env[key] ?? "").trim().toLowerCase();
  if (!raw) return defaultValue;
  return ["1", "true", "yes", "on"].includes(raw);
};

export const featureFlags: FeatureFlags = {
  hardSyncFinalizeEnabled: envFlag("FF_HARD_SYNC_FINALIZE", true),
  verifierReputationEnabled: envFlag("FF_VERIFIER_REPUTATION", true),
  missionOpenDataIngestionEnabled: envFlag("FF_MISSION_OPEN_DATA", true),
  opsConfidencePanelEnabled: envFlag("FF_OPS_CONFIDENCE", true),
  transparencyLiveMetricsEnabled: envFlag("FF_TRANSPARENCY_METRICS", true),
};
