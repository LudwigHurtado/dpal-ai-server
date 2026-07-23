# DPAL Reedy River Live Biodiversity & Operations

This module turns the existing DPAL biodiversity capability into a production, evidence-gated Reedy River operating system. It stores only live observations, ingests university and sensor feeds, polls modern USGS hydrology data, creates immutable three-hour reporting windows, and keeps every recommendation linked to the evidence that authorized it.

## What this upgrade does

- Accepts authenticated live observations from DPAL field teams, university systems, BirdNET gateways, water sensors, camera traps, and OGC SensorThings gateways.
- Polls the modern USGS Water Data OGC `latest-continuous` endpoint for station `USGS-02164000` by default.
- Rejects payloads marked demo, simulated, mock, placeholder, synthetic, or any `dataMode` other than `live`.
- Separates `machine_candidate`, `field_observed`, `qa_pending`, `qa_passed`, `expert_confirmed`, and `rejected` records.
- Generates one idempotent report for every completed UTC-aligned three-hour window.
- Produces source-status tables, findings, project recommendations, downloadable CSV/JSON/Markdown, and a persistent action queue.
- Uses Gemini, when configured, only to write a non-authoritative operating brief from deterministic findings and actions. Gemini cannot add a species, threshold, project, finding, or action.
- Removes exact coordinates, restricted evidence URLs, observer identities, and contact fields from public responses.

## Canonical API path

The module is mounted under the existing ecology router:

```text
/api/ecology/reedy-river
```

Key endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Database, source-key, policy, station, and cadence health |
| `GET` | `/overview` | Live public-safe operating dashboard payload |
| `GET` | `/overview/private` | Authorized dashboard with assignments, history, and restricted locations |
| `GET` | `/integration` | University and sensor contract |
| `POST` | `/ingest/native` | DPAL field/lab/camera/water/activity observations |
| `POST` | `/ingest/birdnet` | BirdNET detections with original-audio evidence references |
| `POST` | `/ingest/sensorthings` | OGC SensorThings Observation batches |
| `GET` | `/observations` | Public-safe recent evidence table |
| `GET` | `/observations/:id/private` | Authorized exact location, restricted evidence, and full provenance lookup |
| `PATCH` | `/observations/:id/review` | Reviewer evidence-state transition; JWT role required |
| `POST` | `/sources/usgs/poll` | Manual modern-USGS poll; JWT role required |
| `GET` | `/reports/latest` | Latest completed three-hour report |
| `POST` | `/reports/run` | Manual idempotent report run; JWT role required |
| `GET` | `/reports/:id/export?format=markdown` | Action-plan document |
| `GET` | `/reports/:id/export?format=csv` | Table export |
| `GET` | `/actions` | Public-safe persistent next-step queue |
| `GET` | `/actions/private` | Authorized queue with assignees and transition history |
| `PATCH` | `/actions/:id/transition` | Controlled workflow transition; JWT role required |

## Required production configuration

```dotenv
# Master switch and cadence checks
REEDY_RIVER_ENABLED=true
REEDY_RIVER_SCHEDULER_CHECK_MINUTES=5
REEDY_RIVER_STALE_AFTER_MINUTES=240

# Source-specific ingest secrets. JSON is preferred.
REEDY_RIVER_INGEST_KEYS={"furman-birdnet-01":"replace-with-long-random-secret","university-sensorthings":"replace-with-another-secret","field-team":"replace-with-another-secret"}

# Require HMAC in production. Signature is HMAC-SHA256(secret, `${timestamp}.${rawBody}`).
REEDY_RIVER_REQUIRE_HMAC=true

# Modern USGS Water Data API
REEDY_RIVER_USGS_ENABLED=true
REEDY_RIVER_USGS_STATION_ID=USGS-02164000
REEDY_RIVER_USGS_PARAMETERS=00060,00065
REEDY_RIVER_USGS_POLL_MINUTES=15
USGS_API_KEY=optional-higher-rate-limit-key

# Optional AI operating brief. Deterministic analysis still runs if unavailable.
GEMINI_API_KEY=server-held-key
REEDY_RIVER_GEMINI_MODEL=gemini-2.0-flash
```

Generate every ingest secret with a cryptographically secure random generator. Do not place ingest keys in browser code, public university pages, shared spreadsheets, or device firmware that cannot be rotated. A university gateway should hold the secret server-side and forward signed batches over TLS.

## Signed ingest request

Required headers:

```text
Content-Type: application/json
X-DPAL-Source-Id: furman-birdnet-01
X-DPAL-Ingest-Key: <source-specific-secret>
X-DPAL-Timestamp: 2026-07-22T12:00:00.000Z
X-DPAL-Signature: sha256=<hex HMAC-SHA256(secret, `${timestamp}.${rawBody}`)>
```

The timestamp must be within five minutes of server time. `sourceId` in every payload must equal `X-DPAL-Source-Id`. Batches are limited to 500 observations and use deterministic idempotency keys, so retransmission does not duplicate evidence.

## Native observation contract

```json
{
  "observations": [
    {
      "idempotencyKey": "field-team-2026-07-22-site-a-plant-01",
      "dataMode": "live",
      "sourceType": "invasive_plant_survey",
      "sourceId": "field-team",
      "siteId": "controlled-site-a",
      "observedAt": "2026-07-22T12:15:00.000Z",
      "kind": "invasive_plant_observation",
      "reviewStatus": "field_observed",
      "confidence": 0.8,
      "taxon": {
        "scientificName": "Ficaria verna",
        "invasiveStatus": "suspected"
      },
      "data": {
        "phenology": "flowering",
        "estimatedPatchSquareMeters": 4.5
      },
      "evidence": [
        {
          "sha256": "<64-character-sha256>",
          "mimeType": "image/jpeg",
          "capturedAt": "2026-07-22T12:15:00.000Z",
          "restricted": true
        }
      ],
      "location": {
        "publicLabel": "Reedy River monitoring zone A",
        "precisionMeters": 10
      },
      "provenance": {
        "provider": "DPAL field program",
        "method": "documented invasive-plant survey",
        "collectedBy": "internal reviewer identity"
      }
    }
  ]
}
```

Coordinates are intentionally omitted from this documentation sample. A live submission may carry the actual authorized coordinates or may use only a controlled site identifier and public zone label. Documentation examples are never loaded into the evidence store.

## BirdNET bridge

The BirdNET endpoint accepts a server-side bridge payload containing:

- live source and site identity;
- BirdNET model/version and device provenance;
- one or more detections with observation time and confidence;
- a restricted original-audio URI and/or SHA-256 hash.

Every result enters DPAL as `machine_candidate`, even at 0.99 confidence and even when repeated. A reviewer must inspect representative original clips and record `expert_confirmed` or `rejected`. An acoustic confirmation supports a repeat survey; it does not by itself prove abundance, breeding, habitat quality, or restoration impact.

## OGC SensorThings university bridge

`POST /ingest/sensorthings` accepts a batch of OGC SensorThings Observation-shaped objects. It recognizes `@iot.id`, `phenomenonTime`, `result`, `ObservedProperty`, `Datastream`, `unitOfMeasurement`, and `parameters`. The adapter maps water, acoustic, invasive-plant, activity, and heartbeat observations into DPAL's evidence model while retaining SensorThings identifiers in provenance.

A recommended university architecture is:

```text
sensor / BirdNET edge node
  -> campus SensorThings or research database
  -> university signing gateway
  -> DPAL live ingest API
  -> immutable observation ledger
  -> deterministic three-hour evidence analysis
  -> AI operating brief (optional and non-authoritative)
  -> report tables + persistent action workflow
```

## Evidence gates and invasive-plant workflow

1. **Raw observation:** field or machine record enters the immutable evidence table.
2. **QA/review:** timestamp, location, evidence hash, method, and diagnostic quality are reviewed.
3. **Corroborated finding:** two independent field observers with evidence may justify a focused verification survey, but not treatment.
4. **Expert confirmation:** a qualified reviewer records the identification and limitations.
5. **Operational approval:** land access, reporting duty, safety, treatment method, and qualified supervision are confirmed.
6. **Field action:** boundary mapping, approved containment, disposal, and follow-up evidence are recorded.
7. **Close-out:** the action is completed only with a rationale and retained evidence; recurrence creates a new auditable action.

Suspected regulated plants must not be disturbed or treated merely because a machine or field observer proposed a name.

## Action state machine

```text
proposed -> triaged / assigned / awaiting_expert / blocked / dismissed
triaged -> assigned / in_progress / awaiting_expert / blocked / dismissed
assigned -> in_progress / awaiting_expert / blocked / dismissed
in_progress -> awaiting_expert / blocked / completed / dismissed
awaiting_expert -> triaged / assigned / in_progress / blocked / completed / dismissed
blocked -> triaged / assigned / in_progress / awaiting_expert / dismissed
completed -> terminal
dismissed -> terminal
```

Each action carries a role owner, due date, evidence IDs, approval gate, safe-to-execute flag, explicit next step, report lineage, and transition history.

## Three-hour reporting behavior

Reports are UTC-aligned. For example, at `13:22Z`, the latest completed window is `09:00Z–12:00Z`; the current `12:00Z–15:00Z` window is not reported as complete. The scheduler checks every five minutes by default and creates the latest missing report only once. Re-running a window is idempotent unless an authorized operator explicitly sets `force=true`.

If data are missing, stale, or unavailable, DPAL creates a monitoring-recovery action. It does not infer that a species is absent, water is normal, or no activity occurred.

## Deployment checklist

1. Add strong source-specific ingest secrets and enable production HMAC.
2. Add the university's source IDs only after confirming the gateway owner and rotation contact.
3. Configure `MONGODB_URI`, JWT secrets, and the optional Gemini key.
4. Register a USGS API key for higher rate limits; the public endpoint can operate without one at lower limits.
5. Deploy and verify `/health` reports `databaseConnected: true` and the expected configured source count.
6. Trigger one USGS poll and verify real station records appear with `sourceId=usgs-water-data`.
7. Send one signed live validation record from each university/sensor source.
8. Confirm public observations contain zone labels but not exact coordinates or restricted URIs; confirm `/overview/private` returns restricted fields only to an admin, moderator, or validator.
9. Wait for or manually run the first completed three-hour report.
10. Download Markdown and CSV, assign the first actions, and verify transition history.
11. Rotate any secret used during installation.

## External interfaces used

- USGS Water Data modern OGC APIs: `https://api.waterdata.usgs.gov/ogcapi/v0/`
- OGC SensorThings standard: `https://www.ogc.org/standard/sensorthings/`
- BirdNET Analyzer upstream: `https://github.com/birdnet-team/BirdNET-Analyzer`

Review source licenses and institutional data-sharing agreements before publishing raw media or sensitive species locations.
