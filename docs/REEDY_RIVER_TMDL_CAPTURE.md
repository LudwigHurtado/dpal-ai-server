# Reedy River TMDL Reference and Authenticated Citizen Capture

This production extension separates three evidence classes that must never be presented as interchangeable:

1. **Regulatory reference** — the historic stations, standards, loads, and reductions published in SCDES Technical Document 011-2023.
2. **Live hydrology context** — current USGS discharge, gage height, and other configured continuous parameters.
3. **Live field evidence** — authenticated DPAL captures, university feeds, sensors, laboratory records, and reviewed observations.

Historic TMDL values do not become a current compliance or recreation-safety result. USGS flow does not measure E. coli. A server-verified hash establishes integrity of the submitted bytes, not measurement accuracy, expert acceptance, certification, or chain anchoring.

## Regulatory reference endpoint

```text
GET /api/ecology/reedy-river/regulatory/tmdl
```

The endpoint publishes:

- the E. coli geometric-mean and single-sample standards stated in the TMDL;
- all 19 upstream-to-downstream monitoring entries;
- the four calculation points and their historic sample summaries;
- existing loads, TMDLs, margins of safety, continuous wasteload allocations, load allocations, and overall reductions;
- flow-category reduction targets;
- explicit provenance and interpretation limitations.

It intentionally publishes **no approximate latitude or longitude**. Each station has `coordinateStatus: official_metadata_not_connected` until official SCDES station metadata is connected and validated. Road-crossing descriptions are not deployment coordinates.

## Authenticated citizen-science capture

```text
POST /api/ecology/reedy-river/captures
Authorization: Bearer <DPAL access token>
Content-Type: application/json
```

The server accepts captures only from an existing DPAL user whose account is both `active` and email-verified. Suspended, pending, unknown, or unverified accounts cannot write evidence. Operators still require the existing `admin`, `moderator`, or `validator` role to change review or action states.

The browser does not submit a collector identity. The server derives a stable project-scoped pseudonym from the authenticated user ID and keeps it out of public responses.

### Integrity behavior

- The client hashes the canonical payload with sorted-key JSON and SHA-256.
- The server recomputes the payload hash.
- A mismatch returns `400 hash_mismatch`; no row is written.
- The server binds the verified payload hash to the private collector pseudonym and computes a canonical envelope hash.
- The resulting observation is stored as `qa_pending`.
- The API returns `anchored: false`, `verified: false`, and `certified: false` until separate real workflows change those states.
- No placeholder Base transaction, fake anchor queue, or simulated receipt is created.

### E. coli guard

A numeric E. coli result is accepted only when:

- `sampleType` is `laboratory_result`;
- a laboratory name is supplied; and
- at least one SHA-256 evidence reference is supplied for the laboratory evidence package.

Even then, the record remains QA-pending. The capture stores QAPP and laboratory-certification status as unasserted or pending review; it does not claim regulatory comparability.

### Example shape

```json
{
  "dataMode": "live",
  "stationId": "S-319",
  "capturedAt": "2026-07-22T18:15:00.000Z",
  "gps": { "lat": 34.0, "lng": -82.0, "accuracyM": 12 },
  "sampleType": "field_screening",
  "condition": "dry",
  "methodName": "Documented calibrated handheld-meter protocol",
  "measurements": {
    "turbidityNtu": 4.2,
    "conductivityUsPerCm": 310,
    "waterTemperatureC": 24.1
  },
  "evidence": [
    { "sha256": "<64-character SHA-256>", "mimeType": "image/jpeg" }
  ],
  "clientHash": "<SHA-256 of this payload without clientHash>"
}
```

The numeric coordinates above only illustrate the request shape and are never loaded as evidence or station metadata.

## Public capture list

```text
GET /api/ecology/reedy-river/captures?stationId=S-319&limit=25
```

This returns only public-safe records. Exact coordinates, collector pseudonyms, restricted evidence URIs, account details, and contact information are removed.

## USGS configuration

The server uses the modern USGS OGC `latest-continuous` API. The default stations are:

```dotenv
REEDY_RIVER_USGS_STATION_IDS=USGS-02164000,USGS-02164110,USGS-021650905
REEDY_RIVER_USGS_PARAMETERS=00060,00065
```

`REEDY_RIVER_USGS_STATION_ID` remains a backward-compatible single-station override. Every USGS observation is labeled `hydrology_context_only` and explicitly states that it does not measure E. coli, current TMDL compliance, or pollution-source attribution.

## Deployment acceptance checks

1. `npm run type-check` passes.
2. Regulatory self-test confirms 19 entries, four calculation points, standards, reductions, and absence of coordinates.
3. Capture self-test confirms deterministic hashing, hard mismatch rejection, QA-pending state, and the laboratory-only E. coli gate.
4. Existing ingest, analysis, and workflow self-tests pass.
5. An active verified account can submit a non-E. coli field screening record.
6. An unverified or inactive account receives `403` and no observation is created.
7. A changed payload with the old hash receives `400 hash_mismatch` and no observation is created.
8. Public capture responses contain no precise coordinates or collector identity.
9. A three-hour report counts citizen water records and creates a QA review action without calling them compliant.
