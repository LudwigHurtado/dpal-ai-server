# Fix MONGODB_URI in Railway - Step by Step

## ✅ Git Changes Verified

**Commit:** `b9f86a1` - Successfully pushed to GitHub
- Fixed NFT routes to use correct models
- All TypeScript errors resolved
- Code builds successfully

## 🔍 Backend Variable Check

The backend code checks for MongoDB connection in this order:
1. **`MONGODB_URI`** (PRIMARY - use this)
2. `MONGO_URL` (fallback)
3. Empty string (skips connection)

**File:** `src/config/env.ts` line 10
```typescript
MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URL || "",
```

**File:** `src/config/db.ts` line 5
```typescript
if (!env.MONGODB_URI) {
  console.warn("⚠️ Skipping Mongo connection (no URI).");
  return;
}
```

## 🚨 Current Problem

If you have `MONGODB_URL` in Railway, the backend **WILL NOT** find it because:
- Backend looks for `MONGODB_URI` or `MONGO_URL`
- `MONGODB_URL` is NOT checked (different name)

## ✅ Fix Steps (Railway Dashboard)

### Step 1: Open Railway Dashboard
1. Go to https://railway.app
2. Select your project
3. Click on the **"web"** service (your backend)

### Step 2: Go to Variables Tab
1. Click **"Variables"** tab (or **"Settings"** → **"Variables"**)

### Step 3: Check Current Variables
Look for any of these:
- `MONGODB_URL` ❌ (wrong name)
- `MONGODB_URI` ✅ (correct)
- `MONGO_URL` ✅ (also works as fallback)

### Step 4: Fix the Variable Name

**Option A: If you have `MONGODB_URL`:**
1. Click on `MONGODB_URL` variable
2. **Copy the value** (the connection string)
3. **Delete** the `MONGODB_URL` variable
4. Click **"New Variable"**
5. Name: `MONGODB_URI` (exactly this)
6. Value: Paste the connection string you copied
7. Click **"Add"**

**Option B: If variable doesn't exist:**
1. Click **"New Variable"**
2. Name: `MONGODB_URI`
3. Value: Your MongoDB connection string
   - Format: `mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority`
   - Or Railway's internal MongoDB URI (if using Railway MongoDB)
4. Click **"Add"**

### Step 5: Verify
1. After adding/changing the variable, Railway will **auto-redeploy**
2. Wait for deployment to complete
3. Check **"Deployments"** → **"Logs"** tab
4. Look for: `✅ Mongo connected` (success!)
5. If you see `⚠️ Skipping Mongo connection (no URI)`, the variable is still wrong

## 🔍 How to Find Your MongoDB URI

### If using Railway MongoDB:
1. Railway Dashboard → Your Project
2. Click on **MongoDB** service (if you have one)
3. Go to **"Variables"** tab
4. Look for `MONGO_URL` or `MONGODB_URI`
5. Copy that value

### If using MongoDB Atlas:
1. Go to https://cloud.mongodb.com
2. Select your cluster
3. Click **"Connect"**
4. Choose **"Connect your application"**
5. Copy the connection string
6. Replace `<password>` with your actual password

### If using Railway's Internal MongoDB:
Railway provides an internal MongoDB URI that looks like:
```
mongodb://mongo:27017/dpal
```
or
```
mongodb://mongo.railway.internal:27017/dpal
```

## ✅ Verification Checklist

After fixing the variable:
- [ ] Variable name is exactly `MONGODB_URI` (case-sensitive)
- [ ] Variable value is a valid MongoDB connection string
- [ ] Railway has redeployed (check Deployments tab)
- [ ] Logs show `✅ Mongo connected` (not `⚠️ Skipping Mongo connection`)
- [ ] Frontend test panel can reach `/health` endpoint
- [ ] No more "Neural link failed" errors

## 🚨 Common Mistakes

1. **Wrong variable name:** `MONGODB_URL` instead of `MONGODB_URI`
2. **Typo:** `MONGODB_UR` or `MONGODB_URI_` (extra characters)
3. **Wrong service:** Added to frontend service instead of backend "web" service
4. **Missing redeploy:** Changed variable but didn't wait for redeploy

## 📝 Quick Reference

**Backend expects:** `MONGODB_URI` or `MONGO_URL`
**Railway service:** "web" (backend)
**What to look for in logs:** `✅ Mongo connected`
