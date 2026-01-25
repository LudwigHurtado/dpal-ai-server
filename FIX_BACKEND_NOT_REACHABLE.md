# Backend Not Reachable - Troubleshooting Guide

## Current Status:
- ✅ Server is running (logs show "✅ DPAL server running on port 8080")
- ❌ Backend not reachable from frontend ("Failed to fetch")
- ❌ MongoDB connection failing ("⚠️ Skipping Mongo connection (no URI)")

## Issues to Fix:

### 1. Fix MongoDB Connection First
The backend is running but can't connect to MongoDB. This needs to be fixed first.

**Steps:**
1. Go to Railway → "web" service → Variables
2. Make sure variable is named: `MONGODB_URI` (not `MONGODB_URL`)
3. Value: `mongodb://mongo:jDjZtwKQugOKYAPYZHfWTNjpfVLPBUMX@mongodb.railway.internal:27017`
4. Apply changes and restart service

### 2. Verify Railway URL
The URL you're using: `https://dpal-ai-server-production.up.railway.app`

**Check if this is correct:**
1. Go to Railway → "web" service → Settings
2. Look for "Domains" or "Public URL"
3. The URL should be something like:
   - `https://web-production-xxxx.up.railway.app`
   - OR a custom domain you set up

**If the URL is different:**
- Update `VITE_API_BASE` in your frontend environment variables
- Or update the BackendTestPanel default URL

### 3. Check Service Status
1. Go to Railway → "web" service → Deployments
2. Check if latest deployment is "Active" (green)
3. If it shows "Failed" or "Building", wait for it to complete

### 4. Check Service is Public
1. Go to Railway → "web" service → Settings
2. Look for "Public" or "Private" setting
3. Make sure it's set to "Public" (if available)

### 5. Test Health Endpoint Directly
Try opening this URL in your browser:
```
https://dpal-ai-server-production.up.railway.app/health
```

**Expected response:**
```json
{
  "ok": true,
  "service": "dpal-ai-server",
  "version": "2026-01-24-v2",
  "ts": 1234567890
}
```

**If you get:**
- ❌ "Failed to fetch" or connection error → URL is wrong or service is down
- ❌ 404 Not Found → Route not configured
- ❌ 502 Bad Gateway → Service is starting/restarting
- ✅ JSON response → Backend is working!

### 6. Check Railway Logs
1. Go to Railway → "web" service → Deploy Logs
2. Look for:
   - `✅ DPAL server running on port 8080` (good)
   - `✅ Mongo connected` (should appear after fixing MONGODB_URI)
   - Any error messages

### 7. Common Issues:

**Issue: Wrong URL**
- Railway auto-generates URLs like: `web-production-xxxx.up.railway.app`
- Your URL might be: `dpal-ai-server-production.up.railway.app`
- Check Railway Settings → Domains to find the correct URL

**Issue: Service Not Started**
- Check Deployments tab - should show "Active"
- If "Building" or "Failed", wait or fix the issue

**Issue: Port Not Exposed**
- Railway should auto-expose port 8080
- Check Settings → Port (should be 8080 or auto)

**Issue: CORS Blocking**
- Once backend is reachable, CORS might block requests
- Make sure `FRONTEND_ORIGIN` is set to your Vercel URL

## Step-by-Step Fix:

1. **Fix MONGODB_URI variable name** (critical)
2. **Verify Railway URL** in Settings → Domains
3. **Test `/health` endpoint** in browser
4. **Update frontend `VITE_API_BASE`** if URL is different
5. **Restart service** after fixing variables
6. **Check logs** for `✅ Mongo connected`

## After Fixing:

Once you see:
- ✅ `✅ Mongo connected` in logs
- ✅ `/health` endpoint returns JSON
- ✅ BackendTestPanel shows "Backend is reachable"

Then hero minting and storage will work!
