# Debugging "Neural link failed: Not Found" (404 Error)

## What This Error Means:
The frontend is getting a **404 Not Found** response when trying to call the backend API endpoint `/api/nft/mint`.

## Quick Diagnosis Steps:

### 1. ✅ Check Your Railway Backend URL

**Current hardcoded fallback:** `https://web-production-a27b.up.railway.app`

**Action:** Verify this is your actual Railway URL:
1. Go to Railway dashboard
2. Open your backend service
3. Check the "Settings" → "Domains" section
4. Copy the actual URL (should look like `https://your-service-name.up.railway.app`)

### 2. ✅ Set VITE_API_BASE Environment Variable

**In Vercel (Frontend):**
1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add: `VITE_API_BASE` = `https://your-actual-railway-url.up.railway.app`
4. Redeploy frontend

**Or locally (`.env` file in project root):**
```
VITE_API_BASE=https://your-actual-railway-url.up.railway.app
```

### 3. ✅ Verify Backend is Deployed

**Check Railway:**
1. Go to Railway dashboard
2. Check if your service shows "Deployed" status
3. Check "Deployments" tab - should have recent successful deployment
4. Check "Logs" tab - should show `✅ DPAL server running on port 8080`

### 4. ✅ Test Backend Health Endpoint

**Open in browser:**
```
https://your-railway-url.up.railway.app/health
```

**Expected response:**
```json
{
  "ok": true,
  "service": "dpal-ai-server",
  "version": "2026-01-25-v3",
  "ts": 1234567890
}
```

**If this fails:** Backend is not running or URL is wrong.

### 5. ✅ Test NFT Mint Endpoint Directly

**Using curl (or Postman):**
```bash
curl -X POST https://your-railway-url.up.railway.app/api/nft/mint \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "prompt": "Test NFT",
    "theme": "artifact",
    "category": "Environmental"
  }'
```

**Expected:** Should return JSON (even if error, should be 400/500, not 404)

**If 404:** Route is not registered or backend build failed

### 6. ✅ Check Railway Logs

**In Railway dashboard:**
1. Go to your service
2. Click "Logs" tab
3. Look for:
   - `✅ DPAL server running on port 8080` (server started)
   - `✅ Mongo connected` (database connected)
   - Any error messages

**Common issues:**
- `Error: Cannot find module '/app/dist/index.js'` → Build failed
- `MongoNetworkError` → MongoDB connection issue
- No logs → Service not running

### 7. ✅ Use BackendTestPanel

**In your frontend app:**
1. Look for "Backend Connection Test" panel (usually bottom-right)
2. Enter your Railway URL
3. Click "Run Tests"
4. Check results:
   - ✅ Backend Health Check should pass
   - ✅ NFT Generate Image API should work
   - ❌ If any fail, check the error details

## Common Fixes:

### Fix 1: Update API Base URL
If your Railway URL is different, update:
- **Vercel:** Set `VITE_API_BASE` environment variable
- **Local:** Create `.env` file with `VITE_API_BASE=your-url`

### Fix 2: Redeploy Backend
If routes aren't working:
1. Commit and push your code
2. Railway will auto-deploy
3. Wait for deployment to complete
4. Check logs for errors

### Fix 3: Check Route Registration
Verify `src/index.ts` has:
```typescript
app.use("/api/nft", nftRoutes);
```

### Fix 4: Check MongoDB Connection
If backend starts but endpoints fail:
1. Set `MONGODB_URI` in Railway environment variables
2. Redeploy backend
3. Check logs for `✅ Mongo connected`

## Error Message Now Shows URL

I've updated the error handling to show the exact URL being called. When you see the error, it will now include:
```
HTTP 404: Not Found (URL: https://web-production-a27b.up.railway.app/api/nft/mint)
```

This helps you verify:
- ✅ Is the URL correct?
- ✅ Is the endpoint path correct?
- ✅ Is the backend reachable?

## Next Steps:

1. **Check Railway URL** - Verify it matches your actual deployment
2. **Set VITE_API_BASE** - In Vercel or `.env` file
3. **Test /health endpoint** - Verify backend is running
4. **Check Railway logs** - Look for deployment/build errors
5. **Use BackendTestPanel** - Run automated tests
