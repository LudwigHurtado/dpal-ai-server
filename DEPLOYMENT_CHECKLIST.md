# 🚀 Deployment Checklist - Fix MongoDB Connection

## ✅ Pre-Deployment Verification

### 1. Code Status
- [x] Git commit pushed: `b9f86a1`
- [x] TypeScript builds successfully (`npm run build`)
- [x] All model imports fixed (CreditWallet, CreditLedger, AuditEvent)
- [x] NFT routes use correct schema

### 2. Backend Configuration
- [x] `src/config/env.ts` checks `MONGODB_URI` or `MONGO_URL`
- [x] `src/config/db.ts` handles missing URI gracefully
- [x] `src/index.ts` calls `connectDb()` on startup

## 🔧 Railway Configuration Steps

### Step 1: Access Railway Dashboard
1. Go to https://railway.app
2. Log in to your account
3. Select your **DPAL project**
4. Click on the **"web"** service (this is your backend)

### Step 2: Navigate to Variables
1. Click the **"Variables"** tab (or **Settings** → **Variables**)
2. You should see a list of environment variables

### Step 3: Check Current MongoDB Variable
Look for one of these:
- `MONGODB_URI` ✅ (correct - keep it)
- `MONGO_URL` ✅ (also works - keep it)
- `MONGODB_URL` ❌ (wrong name - needs fixing)

### Step 4: Fix if Needed

**If you see `MONGODB_URL` (wrong name):**
1. Click on the `MONGODB_URL` variable to view it
2. **COPY the entire value** (the connection string)
3. Click **"Delete"** or the trash icon to remove `MONGODB_URL`
4. Click **"+ New Variable"** or **"Add Variable"**
5. **Name:** `MONGODB_URI` (exactly, case-sensitive)
6. **Value:** Paste the connection string you copied
7. Click **"Add"** or **"Save"**

**If you don't see any MongoDB variable:**
1. Click **"+ New Variable"** or **"Add Variable"**
2. **Name:** `MONGODB_URI`
3. **Value:** Your MongoDB connection string
   - If using Railway MongoDB: Check the MongoDB service's variables
   - If using MongoDB Atlas: Get from Atlas dashboard
   - Format: `mongodb+srv://user:pass@cluster.mongodb.net/dbname?retryWrites=true&w=majority`
4. Click **"Add"** or **"Save"**

### Step 5: Verify Other Required Variables
While you're in Variables, make sure you have:
- [ ] `MONGODB_URI` (or `MONGO_URL`) ✅
- [ ] `GEMINI_API_KEY` (for AI image generation)
- [ ] `FRONTEND_ORIGIN` (your Vercel frontend URL)
- [ ] `NODE_ENV` = `production` (optional but recommended)

### Step 6: Wait for Auto-Redeploy
- Railway automatically redeploys when you change variables
- Watch the **"Deployments"** tab for a new deployment
- Wait for it to complete (usually 1-2 minutes)

### Step 7: Check Deployment Logs
1. Go to **"Deployments"** tab
2. Click on the **latest deployment**
3. Click **"View Logs"** or open the **"Logs"** tab
4. Look for these messages:

**✅ SUCCESS:**
```
✅ Mongo connected
✅ DPAL server running on port 8080
   /health -> ready
```

**❌ FAILURE:**
```
⚠️ Skipping Mongo connection (no URI).
```
(This means the variable name is still wrong)

**❌ OTHER ERRORS:**
- `MongooseServerSelectionError` → MongoDB URI is invalid or unreachable
- `Authentication failed` → Wrong username/password in URI
- `ECONNREFUSED` → MongoDB server is down or wrong host

### Step 8: Test the Backend
1. Open your frontend (Vercel)
2. Use the **BackendTestPanel** component
3. Test the `/health` endpoint
4. Should return: `{ ok: true, service: "dpal-ai-server", version: "2026-01-25-v3" }`

## 🎯 Success Indicators

After fixing `MONGODB_URI`, you should see:

1. **Railway Logs:**
   - `✅ Mongo connected` (not the warning)

2. **Frontend Test Panel:**
   - `/health` returns `200 OK`
   - No "Failed to fetch" errors
   - No "Neural link failed" errors

3. **API Endpoints Work:**
   - `POST /api/nft/mint` - Can mint NFTs
   - `POST /api/persona/generate-image` - Can generate images
   - `GET /api/heroes/:heroId` - Can fetch hero data

## 🚨 Troubleshooting

### Problem: Still seeing "⚠️ Skipping Mongo connection"
**Solution:** 
- Double-check variable name is exactly `MONGODB_URI` (case-sensitive)
- Make sure you're editing the **"web"** service, not frontend
- Wait for redeploy to complete

### Problem: "MongooseServerSelectionError"
**Solution:**
- Verify MongoDB URI is correct
- Check if MongoDB service is running (if using Railway MongoDB)
- Test connection string in MongoDB Compass or similar tool

### Problem: "Authentication failed"
**Solution:**
- Verify username and password in connection string
- Make sure special characters are URL-encoded
- Check if MongoDB user has proper permissions

### Problem: Deployment stuck or failed
**Solution:**
- Check Railway status page
- Try manually triggering a redeploy
- Check build logs for TypeScript errors

## 📝 Quick Reference

**Variable Name:** `MONGODB_URI` (or `MONGO_URL`)
**Railway Service:** "web" (backend)
**Success Message:** `✅ Mongo connected`
**Failure Message:** `⚠️ Skipping Mongo connection (no URI).`

---

**Once MongoDB is connected, your NFT minting and persona generation should work!** 🎉
