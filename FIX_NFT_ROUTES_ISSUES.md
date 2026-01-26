# Issues in New NFT Routes Code

## Problems Found:

### 1. ❌ Missing `uuid` Package
- Code imports `uuid` but it's not in package.json
- **Fix:** Install `uuid` and `@types/uuid`

### 2. ❌ Model Mismatch: Wallet uses `heroId`, code uses `userId`
- Wallet model expects `heroId` (line 5)
- Code uses `userId` (line 74)
- **Fix:** Use `heroId` instead of `userId`, OR use CreditWallet which uses `userId`

### 3. ❌ Model Mismatch: LedgerEntry uses `heroId`, code uses `userId`
- LedgerEntry expects `heroId` (line 5)
- Code uses `userId` (line 106)
- **Fix:** Use `heroId` instead of `userId`, OR use CreditLedger which uses `userId`

### 4. ❌ AuditEvent Schema Mismatch
- AuditEvent expects: `actorUserId`, `action`, `entityType`, `entityId`, `hash`
- Code uses: `userId`, `eventType`, `eventSource`, `details`, `refId`, `timestamp`
- **Fix:** Use correct field names OR update AuditEvent schema

### 5. ❌ `generatePersonaImagePng` doesn't accept `traits`
- Function signature: `{ description: string, archetype: string }`
- Code passes: `{ description, archetype, traits }` ← `traits` not accepted
- **Fix:** Remove `traits` from call

### 6. ❌ Wallet Schema Mismatch
- Wallet has `locked` as Number (line 18)
- Code treats it as Boolean (line 85: `if (wallet.locked)`)
- Code sets `lockReason` which doesn't exist in schema
- **Fix:** Use CreditWallet OR update Wallet schema

## Recommended Fix:

**Option 1: Use Existing CreditWallet/CreditLedger (EASIEST)**
- These already use `userId`
- Already have proper locking mechanism
- Match the existing mint.service.ts pattern

**Option 2: Fix Wallet/LedgerEntry to use userId**
- Update schemas to use `userId` instead of `heroId`
- Add missing fields (`lockReason`, etc.)
- Update AuditEvent schema to match code

**Option 3: Revert to executeMintFlow**
- Use the existing `executeMintFlow` from mint.service.ts
- It's already tested and working (when MongoDB is connected)

## The "Not Found" Error:

The error "Neural link failed: Transient neural disruption: Not Found" means:
- API endpoint returned 404
- OR MongoDB connection failed (causing route to not work)
- Check Railway logs for actual error
