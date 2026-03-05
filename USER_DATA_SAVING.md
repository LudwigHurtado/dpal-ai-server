# User Data Saving - What Gets Saved Where

## ✅ Store Purchases - FULLY WORKING

### What Gets Saved:

1. **To Hero Inventory** (`hero.inventory`):
   ```typescript
   {
     sku: "item-001",
     name: "Item Name",
     description: "Item description",
     icon: "⚡",
     quantity: 1
   }
   ```
   - ✅ Saved to database
   - ✅ Frontend updates hero state

2. **To Unlocked Items** (`hero.unlockedItemSkus`):
   ```typescript
   ["item-001", "item-002", ...]
   ```
   - ✅ Saved to database
   - ✅ Frontend updates hero state

3. **Wallet Balance** (`wallet.balance`):
   - ✅ Credits deducted from wallet
   - ✅ Saved to database
   - ✅ Frontend updates hero.heroCredits

4. **Ledger Entry**:
   - ✅ Transaction logged in LedgerEntry
   - ✅ Type: "STORE_PURCHASE"

### Flow:
```
User buys item
  ↓
POST /api/store/purchase-item
  ↓
Backend: Deduct credits, add to hero.inventory, add to hero.unlockedItemSkus
  ↓
Backend: Save hero and wallet to database
  ↓
Backend: Return { ok, hero, wallet }
  ↓
Frontend: Update hero state with new inventory and credits
  ↓
✅ Item saved to user's account!
```

---

## ✅ NFT Minting - NOW FIXED!

### What Gets Saved:

1. **To NftAsset Collection**:
   ```typescript
   {
     tokenId: "DPAL-1234567890-1234",
     createdByUserId: "user-123",  // ✅ Links to user
     collectionId: "GENESIS_01",
     status: "MINTED",
     imageData: Buffer,
     imageUri: "/api/assets/DPAL-1234567890-1234.png"
   }
   ```
   - ✅ Saved to database
   - ✅ Linked to user via `createdByUserId`

2. **To Hero's Collection** (`hero.equippedNftIds`):
   ```typescript
   ["DPAL-1234567890-1234", "DPAL-9876543210-5678", ...]
   ```
   - ✅ **NOW FIXED** - Added to hero.equippedNftIds in database
   - ✅ **NOW FIXED** - Frontend updates hero state

3. **To MintReceipt**:
   ```typescript
   {
     userId: "user-123",
     tokenId: "DPAL-1234567890-1234",
     txHash: "0x...",
     priceCredits: 500
   }
   ```
   - ✅ Saved to database
   - ✅ Links NFT to user

4. **Wallet Balance** (`wallet.balance`):
   - ✅ Credits deducted from wallet
   - ✅ Saved to database
   - ✅ Frontend updates hero.heroCredits

5. **Ledger Entry**:
   - ✅ Transaction logged in CreditLedger
   - ✅ Type: "CREDIT_SPEND"

### Flow:
```
User mints NFT
  ↓
POST /api/nft/mint
  ↓
Backend: Check wallet, generate image, create NftAsset
  ↓
Backend: Create MintReceipt (links NFT to user)
  ↓
Backend: Add tokenId to hero.equippedNftIds ✅ NEW!
  ↓
Backend: Return { ok, tokenId, imageUrl, ... }
  ↓
Frontend: Add tokenId to hero.equippedNftIds ✅ NEW!
  ↓
✅ NFT saved to user's account and collection!
```

---

## 📊 What's Saved Where

### Store Purchases:
| Data | Database Collection | Hero Field | Frontend State |
|------|-------------------|------------|----------------|
| Item | `Hero.inventory[]` | ✅ `inventory` | ✅ Updated |
| Unlock | `Hero.unlockedItemSkus[]` | ✅ `unlockedItemSkus` | ✅ Updated |
| Credits | `Wallet.balance` | ✅ `heroCredits` | ✅ Updated |
| Transaction | `LedgerEntry` | - | - |

### NFT Minting:
| Data | Database Collection | Hero Field | Frontend State |
|------|-------------------|------------|----------------|
| NFT Asset | `NftAsset` | - | - |
| NFT Link | `Hero.equippedNftIds[]` | ✅ `equippedNftIds` | ✅ Updated |
| Receipt | `MintReceipt` | - | - |
| Credits | `CreditWallet.balance` | ✅ `heroCredits` | ✅ Updated |
| Transaction | `CreditLedger` | - | - |

---

## ✅ Summary

### Store Purchases: ✅ **YES - FULLY WORKING**
- ✅ Items saved to `hero.inventory`
- ✅ Items added to `hero.unlockedItemSkus`
- ✅ Credits deducted from wallet
- ✅ Frontend updates hero state
- ✅ **Everything persists in database**

### NFT Minting: ✅ **YES - NOW FIXED!**
- ✅ NFT saved to `NftAsset` collection
- ✅ NFT linked to user via `createdByUserId`
- ✅ **NOW:** TokenId added to `hero.equippedNftIds` ✅
- ✅ Receipt created in `MintReceipt`
- ✅ Credits deducted from wallet
- ✅ Frontend updates hero state
- ✅ **Everything persists in database**

---

## 🎯 What I Just Fixed

### Fix 1: Add NFT to Hero's Collection (Backend)
**File:** `src/routes/nft.routes.ts`

**Added:**
```typescript
// After minting NFT, add to hero's collection
await Hero.findOneAndUpdate(
  { heroId: userId },
  { 
    $addToSet: { equippedNftIds: tokenId },  // ✅ Add tokenId to collection
    $setOnInsert: { heroId: userId }
  },
  { upsert: true, session }
);
```

### Fix 2: Update Frontend Hero State (Frontend)
**File:** `App.tsx`

**Added:**
```typescript
// After minting, add NFT to hero's collection
setHero(prev => ({
  ...prev,
  heroCredits: (prev.heroCredits || 0) - (result.priceCredits || 500),
  equippedNftIds: prev.equippedNftIds 
    ? [...prev.equippedNftIds, result.tokenId]  // ✅ Add tokenId
    : [result.tokenId]
}));
```

---

## ✅ Final Answer

**YES! Both minting and store purchases save to the user's account:**

1. **Store Purchases:**
   - ✅ Items saved to `hero.inventory`
   - ✅ Items unlocked in `hero.unlockedItemSkus`
   - ✅ Credits deducted
   - ✅ **Everything persists**

2. **NFT Minting:**
   - ✅ NFT saved to `NftAsset` collection
   - ✅ NFT added to `hero.equippedNftIds` ✅ **FIXED!**
   - ✅ Credits deducted
   - ✅ **Everything persists**

**All user data is saved to the database and linked to their account!** 🎯
