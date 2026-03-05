# DPAL AI Server

Backend server for the DPAL (Decentralized Public Accountability Ledger) application.

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

## Wallet & Credits System

The minting system uses a credit-based wallet:
- New users automatically get 10,000 credits
- Minting costs credits (specified in `priceCredits`)
- Credits are locked during mint, then deducted on success
- All transactions are logged in the CreditLedger
- Audit events are created for all mints

## Models

The backend uses the following MongoDB models:
- `CreditWallet` - User credit balances
- `CreditLedger` - Credit transaction history
- `MintRequest` - Mint request tracking
- `MintReceipt` - Completed mint receipts
- `NftAsset` - NFT asset data (including image binary)
- `AuditEvent` - Audit trail for all actions
- `Hero` - Hero/operative profiles
- `Wallet` - Legacy wallet model (for compatibility)
