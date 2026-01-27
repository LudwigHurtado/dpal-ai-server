# Where Are Minted NFTs Stored?

## 🗄️ Storage Location: **MongoDB Database on Railway**

All minted NFTs are stored in your **MongoDB database** hosted on **Railway**.

## 📦 What Gets Stored Where

### 1. **NFT Image & Data** → `NftAsset` Collection (MongoDB)

**Location:** Railway MongoDB → `NftAsset` collection

**What's stored:**
```typescript
{
  tokenId: "DPAL-1737686400000-1234",
  collectionId: "GENESIS_01",
  chain: "DPAL_INTERNAL",
  createdByUserId: "user-123",  // ✅ Links to you
  status: "MINTED",
  imageData: Buffer,  // ✅ The actual PNG image stored as binary
  imageUri: "/api/assets/DPAL-1737686400000-1234.png",
  metadataUri: "dpal://metadata/DPAL-1737686400000-1234",
  attributes: [...],  // Traits, theme, category, etc.
  createdAt: Date,
  updatedAt: Date
}
```

**Key Point:** The **actual PNG image** is stored as binary data (`imageData: Buffer`) **inside MongoDB**. No external file storage needed!

### 2. **Mint Receipt** → `MintReceipt` Collection (MongoDB)

**Location:** Railway MongoDB → `MintReceipt` collection

**What's stored:**
```typescript
{
  userId: "user-123",  // ✅ Links to you
  tokenId: "DPAL-1737686400000-1234",
  txHash: "0x22acabb3...",  // ✅ The transaction hash you see
  priceCredits: 500,
  mintedAt: Date
}
```

This is the **proof of purchase** - links you to your NFT.

### 3. **Hero Collection** → `Hero` Collection (MongoDB)

**Location:** Railway MongoDB → `Hero` collection

**What's stored:**
```typescript
{
  heroId: "user-123",
  equippedNftIds: [
    "DPAL-1737686400000-1234",  // ✅ Your minted NFT
    "DPAL-1737686500000-5678",  // ✅ Another NFT
    ...
  ]
}
```

This is your **personal collection** - all NFTs you own.

### 4. **Audit Trail** → `AuditEvent` Collection (MongoDB)

**Location:** Railway MongoDB → `AuditEvent` collection

**What's stored:**
```typescript
{
  actorUserId: "user-123",
  action: "NFT_MINT",
  entityId: "nft-asset-id",
  hash: "0x22acabb3...",
  meta: { tokenId, prompt, priceCredits, ... }
}
```

This is the **permanent audit log** - records every mint action.

---

## 🌐 How You Access Them

### Frontend (Vercel) - "The Outside Layer"

**What you see:**
- The **ASSET_ARCHIVE** page (what you're looking at)
- NFT cards with images
- Block numbers and transaction hashes
- Your collection count

**What it does:**
- **Displays** data from the backend
- **Does NOT store** the actual NFTs
- Just shows you what's in the database

### Backend (Railway) - "The Processing Layer"

**What it does:**
- **Stores** NFTs in MongoDB
- **Serves** NFT images via `/api/assets/:tokenId.png`
- **Processes** mint requests
- **Manages** your collection

**URL:** `https://web-production-a27b.up.railway.app`

### Database (Railway MongoDB) - "The Storage Layer"

**What it stores:**
- ✅ All NFT images (as binary data)
- ✅ All NFT metadata
- ✅ All mint receipts
- ✅ All hero collections
- ✅ All audit logs

**Location:** Railway → MongoDB service

---

## 🔍 How to View Your NFTs

### Option 1: Via Frontend (What You're Seeing)

1. Go to **ASSET_ARCHIVE** page
2. See your collection displayed
3. Click on NFTs to view details

### Option 2: Via API Directly

**Get all your NFTs:**
```bash
GET https://web-production-a27b.up.railway.app/api/nft/receipts?userId=YOUR_USER_ID
```

**Get NFT image:**
```bash
GET https://web-production-a27b.up.railway.app/api/assets/DPAL-1737686400000-1234.png
```

### Option 3: Via MongoDB Directly

1. Go to Railway → **MongoDB** service
2. Connect using MongoDB client
3. Query `NftAsset` collection:
   ```javascript
   db.NftAsset.find({ createdByUserId: "YOUR_USER_ID" })
   ```

---

## 📊 Storage Architecture

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (Vercel)                                       │
│  "The Outside Layer" - What You See                     │
│  - Displays NFTs                                         │
│  - Shows collection                                       │
│  - User interface                                        │
└─────────────────────────────────────────────────────────┘
                          ↕ HTTP Requests
┌─────────────────────────────────────────────────────────┐
│  BACKEND (Railway)                                       │
│  "The Processing Layer"                                  │
│  - Receives mint requests                                │
│  - Generates images                                      │
│  - Saves to database                                     │
│  - Serves images via /api/assets/:tokenId.png           │
└─────────────────────────────────────────────────────────┘
                          ↕ Database Queries
┌─────────────────────────────────────────────────────────┐
│  MONGODB (Railway)                                       │
│  "The Storage Layer" - WHERE IT'S ACTUALLY STORED       │
│                                                          │
│  Collections:                                            │
│  - NftAsset      → NFT images & metadata                │
│  - MintReceipt   → Purchase records                      │
│  - Hero          → Your collection (equippedNftIds)     │
│  - AuditEvent    → Audit trail                           │
│  - CreditWallet  → Your credits balance                  │
│  - CreditLedger  → Transaction history                   │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 Summary

**Where NFTs are stored:**
- ✅ **MongoDB database on Railway** (actual storage)
- ✅ **NftAsset collection** (images + metadata)
- ✅ **Hero collection** (your personal collection list)
- ✅ **MintReceipt collection** (proof of ownership)

**What the frontend is:**
- ✅ **Display layer** - shows you what's in the database
- ✅ **User interface** - lets you interact with your NFTs
- ❌ **NOT storage** - doesn't store the actual NFTs

**How to access:**
- ✅ **Frontend:** ASSET_ARCHIVE page (what you're seeing)
- ✅ **API:** `/api/nft/receipts?userId=YOUR_ID`
- ✅ **Images:** `/api/assets/:tokenId.png`
- ✅ **Database:** Railway MongoDB (direct access)

---

## 🔗 Quick Links

- **Backend URL:** `https://web-production-a27b.up.railway.app`
- **Frontend URL:** `https://dpal-front-end.vercel.app`
- **MongoDB:** Railway → MongoDB service
- **Your NFTs:** Railway MongoDB → `NftAsset` collection → Filter by `createdByUserId`

**Your NFTs are safely stored in MongoDB on Railway!** 🎯
