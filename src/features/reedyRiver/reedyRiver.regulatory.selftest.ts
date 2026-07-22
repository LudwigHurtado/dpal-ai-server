import assert from "node:assert/strict";
import { REEDY_RIVER_TMDL_REFERENCE, findReedyRiverTmdlStation } from "./reedyRiver.regulatory.js";

const reference = REEDY_RIVER_TMDL_REFERENCE;
assert.equal(reference.dataClass, "regulatory_reference");
assert.equal(reference.currentComplianceStatus, "not_computed");
assert.equal(reference.monitoringEntries.length, 19);
assert.equal(reference.calculationPoints.length, 4);
assert.deepEqual(reference.monitoringEntries.map((entry) => entry.order), Array.from({ length: 19 }, (_, i) => i + 1));
assert.deepEqual(reference.calculationPoints.map((point) => point.overallPercentReduction), [84, 81, 85, 23]);
assert.equal(reference.waterQualityStandard.geometricMean.value, 126);
assert.equal(reference.waterQualityStandard.singleSample.value, 349);
assert.equal(findReedyRiverTmdlStation("RS-20501")?.entryId, "RS-19501/RS-20501");
assert.equal(findReedyRiverTmdlStation("S-863")?.entryId, "RS-17381/S-863");
assert.equal(findReedyRiverTmdlStation("not-a-station"), undefined);
function collectKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, out);
    return out;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    out.add(key.toLowerCase());
    collectKeys(child, out);
  }
  return out;
}
const keys = collectKeys(reference);
assert.equal(keys.has("latitude"), false);
assert.equal(keys.has("longitude"), false);
assert.equal(keys.has("lat"), false);
assert.equal(keys.has("lng"), false);
assert.equal(reference.currentComplianceStatus, "not_computed");
console.log("✅ reedyRiver.regulatory.selftest passed");
