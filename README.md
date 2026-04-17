# DPAL AI Server

Backend server for the DPAL (Decentralized Public Accountability Ledger) application.

**Canonical clone:** develop and deploy from this repo only (`LudwigHurtado/dpal-ai-server`). Do not maintain a second copy under another project folder; clone `C:\dpal-ai-server` (or any path) directly from GitHub.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with the following variables:
   ```
   MONGODB_URI=your_mongodb_connection_string
   GEMINI_API_KEY=your_gemini_api_key
   PORT=8080
   FRONTEND_ORIGIN=http://localhost:5173
   GEMINI_IMAGE_MODEL=gemini-3-pro-image-preview
   GEMINI_MODEL=gemini-3-flash-preview
   ```

3. Run in development mode:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   npm start
   ```

## API Endpoints

### Health Check
- `GET /health` - Server health check

### NFT Routes
- `POST /api/nft/mint` - Mint an NFT (requires wallet credits)
- `POST /api/nft/generate-image` - Generate NFT image preview
- `GET /api/nft/receipts` - Get NFT receipts (optional ?userId= filter)
- `GET /api/assets/:tokenId.png` - Serve NFT asset image

### Persona Routes
- `POST /api/persona/generate-image` - Generate persona/hero image
- `POST /api/persona/generate-details` - Generate persona details (name, backstory, etc.)

### Hero Routes
- `GET /api/heroes` - Get hero profiles
- `POST /api/heroes` - Create/update hero profile

### Saved hero identities (Mint Hero / front-end)
- `POST /api/hero-personas` - Save or update a generated persona for a user (`userId` + `persona` JSON)
- `GET /api/hero-personas?userId=` - List saved personas for that operative
- `POST /api/nft/mint` accepts optional `savedPersonaId` to link the mint to a saved record

## Wallet & Credits System

The minting system uses a credit-based wallet:
- New users automatically get 10,000 credits
- Minting costs credits (specified in `priceCredits`)
- Credits are locked during mint, then deducted on success
- All transactions are logged in the CreditLedger
- Audit events are created for all mints

## Satellite Adapters (Water Monitor)

Live satellite data is pulled via six adapters in `src/services/adapters/`. All require the Copernicus credentials below to return real data; without them they fall back to proxy/mock values.

### Required env vars

| Variable | Source |
|----------|--------|
| `COPERNICUS_CLIENT_ID` | dataspace.copernicus.eu → Settings → OAuth Clients |
| `COPERNICUS_CLIENT_SECRET` | same — shown once on creation |

### Adapter sources

| Adapter | Satellite | Data |
|---------|-----------|------|
| `smap.adapter.ts` | NASA SMAP | Soil moisture index |
| `swot.adapter.ts` | NASA / ESA SWOT | Surface water level |
| `grace.adapter.ts` | NASA GRACE-FO | Groundwater storage trend |
| `gibs.adapter.ts` | NASA GIBS / MODIS | Vegetation stress, drought risk |
| `copernicus.adapter.ts` | ESA Sentinel-2 L2A | NDVI (real when credentials set), falls back to Open-Meteo |
| `sentinel1.adapter.ts` | ESA Sentinel-1 GRD | SAR water fraction, VV backscatter, flood risk |

### Copernicus Statistical API — known gotchas

The Sentinel Hub Statistical API at `sh.dataspace.copernicus.eu/api/v1/statistics` has non-obvious requirements:

- **Resolution:** use `width`/`height` (pixel dimensions, e.g. `128`) — `resx`/`resy` are silently ignored without an explicit CRS declaration.
- **CRS:** must set `bounds.properties.crs = "http://www.opengis.net/def/crs/OGC/1.3/CRS84"` or resolution parameters are ignored.
- **Status filter:** response entries often have an empty `status` field — filter by `sampleCount > 0` only, not `status === "OK"`.
- **Sentinel-1:** do not set `orbitDirection: "BOTH"` (invalid enum) or `polarization: "DV"` (too restrictive); omit both.

### Smoke test

```bash
curl "https://web-production-a27b.up.railway.app/api/water/satellite-preview?lat=34.05&lng=-118.25" | jq '.adapters | {s1: .sentinel1.ok, s2: .copernicus.source}'
# expect: { "s1": true, "s2": "sentinel-2-live" }
```

Railway logs to verify:
- `🔑 Copernicus token refreshed` — credentials working
- `📡 Sentinel-1 SAR` — live SAR data
- `🛰️  Sentinel-2 L2A` — live NDVI

---

## Models

The backend uses the following MongoDB models:
- `CreditWallet` - User credit balances
- `CreditLedger` - Credit transaction history
- `MintRequest` - Mint request tracking
- `MintReceipt` - Completed mint receipts
- `NftAsset` - NFT asset data (including image binary)
- `AuditEvent` - Audit trail for all actions
- `Hero` - Hero/operative profiles
- `SavedHeroPersona` - Off-chain saved hero identities (linked to mint via `tokenId` when minted)
- `Wallet` - Legacy wallet model (for compatibility)
