# Fix MongoDB Connection Issue

## Current Status
- ✅ Backend is running
- ❌ MongoDB is NOT connected

## Step 1: Wait for Auto-Restart

Railway automatically restarts your service when you add/change environment variables. This can take **1-2 minutes**.

**Wait 2 minutes, then test again:**
```powershell
Invoke-WebRequest -Uri "https://web-production-a27b.up.railway.app/health" -UseBasicParsing | Select-Object -ExpandProperty Content
```

## Step 2: Check Railway Logs

1. Go to Railway → **web** service → **Deploy Logs** tab
2. Look for:
   - ✅ `✅ Mongo connected successfully` → Connection working!
   - ❌ `⚠️ Skipping Mongo connection (no MONGODB_URI set)` → Variable not set
   - ❌ `❌ Mongo connection failed: ...` → Connection error

## Step 3: Verify MONGODB_URI

1. Go to Railway → **web** service → **Variables** tab
2. Check if `MONGODB_URI` exists
3. Click the eye icon 👁️ to reveal the value
4. Verify it matches the connection string from MongoDB service

**Expected format:**
```
mongodb://mongo:password@mongodb.railway.internal:27017
```
or
```
mongodb://mongo:password@switchback.proxy.rlwy.net:27017
```

## Step 4: Manual Restart (If Needed)

If waiting doesn't work:

1. Go to Railway → **web** service → **Deployments** tab
2. Click **"Redeploy"** or **"Deploy"** button
3. Wait for deployment to complete (2-3 minutes)
4. Test health endpoint again

## Step 5: Check MongoDB Service

1. Go to Railway → **MongoDB** service
2. Check if it's **"Online"** (should be green)
3. If it's offline, restart the MongoDB service

## Common Issues

### Issue: Variable Not Found
**Error in logs:** `⚠️ Skipping Mongo connection (no MONGODB_URI set)`

**Fix:**
- Go to **web** service → **Variables** tab
- Add `MONGODB_URI` with the connection string from MongoDB service

### Issue: Connection Timeout
**Error in logs:** `❌ Mongo connection failed: connection timeout`

**Fix:**
- Verify MongoDB service is **Online**
- Check if connection string uses `mongodb.railway.internal` (internal) or public URL
- Try using the internal URL: `mongodb.railway.internal:27017`

### Issue: Authentication Failed
**Error in logs:** `❌ Mongo connection failed: authentication failed`

**Fix:**
- Verify username/password in connection string
- Copy the exact `MONGO_URL` from MongoDB service Variables
- Use that value for `MONGODB_URI`

## Test After Fix

Once you've made changes, wait 1-2 minutes, then test:

```powershell
Invoke-WebRequest -Uri "https://web-production-a27b.up.railway.app/health" -UseBasicParsing | Select-Object -ExpandProperty Content
```

**Expected success:**
```json
{"ok":true,"service":"dpal-ai-server","version":"2026-01-25-v3","ts":1769473682665,"database":{"connected":true,"state":"connected","ready":true}}
```

## Quick Checklist

- [ ] Wait 2 minutes after setting `MONGODB_URI`
- [ ] Check Railway logs for connection messages
- [ ] Verify `MONGODB_URI` is set correctly
- [ ] Verify MongoDB service is Online
- [ ] Test health endpoint again
- [ ] If still failing, manually restart web service
