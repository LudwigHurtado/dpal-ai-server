# DPAL Backend Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
cd c:\DPAL\dpal-ai-server
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

Required variables:
- `MONGODB_URI` - Your MongoDB connection string
- `GEMINI_API_KEY` - Your Google Gemini API key

### 3. Run the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

The server will start on port 8080 (or the PORT specified in .env).

## What Was Fixed

### ✅ Backend Package Configuration
- Fixed `package.json` to include proper backend dependencies (express, mongoose, cors, dotenv)
- Removed frontend dependencies (React, Vite)
- Added proper build scripts

### ✅ Database Models Created
All required models are now in `src/models/`:
- `CreditWallet.ts` - User credit balances
- `CreditLedger.ts` - Credit transaction history
- `MintRequest.ts` - Mint request tracking
- `MintReceipt.ts` - Completed mint receipts
- `NftAsset.ts` - NFT asset data with image storage
- `AuditEvent.ts` - Audit trail

### ✅ Full Mint Flow Implemented
- `src/services/mint.service.ts` - Complete minting service with:
  - Wallet balance checking
  - Credit locking during mint
  - Transaction management (rollback on failure)
  - Credit ledger entries
  - Audit event logging
  - Idempotency handling

### ✅ API Routes Updated
- `POST /api/nft/mint` - Full mint flow with validation and error handling
- `POST /api/nft/generate-image` - Image preview generation
- `GET /api/nft/receipts` - Receipt retrieval
- `GET /api/assets/:tokenId.png` - Asset image serving

### ✅ Error Handling
- Proper HTTP status codes (400, 402, 409, 500, 502)
- Specific error messages for different failure scenarios
- Validation for all input parameters

### ✅ Configuration
- TypeScript config fixed for Node.js backend
- Environment variable standardization (GEMINI_API_KEY)
- CORS configuration for frontend origins

## Testing the API

### Health Check
```bash
curl http://localhost:8080/health
```

### Mint an NFT
```bash
curl -X POST http://localhost:8080/api/nft/mint \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "prompt": "A futuristic accountability artifact",
    "theme": "artifact",
    "category": "general",
    "priceCredits": 100,
    "idempotencyKey": "test-mint-001"
  }'
```

## Frontend Integration

The frontend is already configured to use:
- Default API base: `https://dpal-ai-server-production.up.railway.app`
- Environment variable: `VITE_API_BASE` (optional override)

Make sure your frontend's `VITE_API_BASE` points to your backend URL, or it will use the default Railway URL.

## Troubleshooting

### MongoDB Connection Issues
- Verify `MONGODB_URI` is correct
- Check MongoDB is accessible from your network
- Ensure MongoDB user has proper permissions

### Gemini API Issues
- Verify `GEMINI_API_KEY` is set and valid
- Check API quota/limits
- Verify model names are correct (gemini-3-flash-preview, gemini-3-pro-image-preview)

### Port Already in Use
- Change `PORT` in `.env` to a different port
- Or kill the process using port 8080

## Next Steps

1. Set up MongoDB database
2. Configure environment variables
3. Test the health endpoint
4. Test minting flow
5. Deploy to Railway or your hosting platform
