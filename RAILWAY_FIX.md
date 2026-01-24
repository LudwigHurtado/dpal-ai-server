# Railway Configuration Fix

## Problem
Railway is serving frontend static files instead of running the backend server. The logs show:
- All requests return HTML (frontend index.html)
- 405 errors on POST requests
- `/health` returns HTML instead of JSON

## Solution

### 1. Check Railway Service Settings

In Railway dashboard → `dpal-ai-server` → **Settings** → **Deploy**:

**Verify these settings:**
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start` (or `node dist/index.js`)
- **Root Directory**: Leave empty (or set to `/`)

### 2. Check if Build is Working

In Railway → **Deployments** → Click on latest deployment → **Build Logs**:

Look for:
- `npm install` completing successfully
- `npm run build` (TypeScript compilation)
- `tsc` output showing compiled files in `dist/`

### 3. Check Runtime Logs

In Railway → **Logs** tab:

Look for:
- `✅ DPAL server running on port 8080` (or whatever PORT is set)
- `✅ Mongo connected` (if MONGODB_URI is set)
- Any error messages

### 4. If Still Serving Static Files

The issue might be that Railway detected `index.html` and is serving it as a static site.

**Fix:**
1. In Railway → Settings → **Deploy**
2. Make sure **Start Command** is: `npm start`
3. Make sure **Build Command** is: `npm install && npm run build`
4. **Redeploy** the service

### 5. Alternative: Use Nixpacks Explicitly

If Railway auto-detection is wrong, you can force it:

1. In Railway → Settings → **Deploy**
2. Set **Builder**: `Nixpacks`
3. Set **Build Command**: `npm install && npm run build`
4. Set **Start Command**: `npm start`

## What to Check in Railway Dashboard

1. **Service Status**: Should be "Online" (not "Initializing")
2. **Deployments**: Latest deployment should show "Active"
3. **Logs**: Should show backend server starting, not Caddy serving files
4. **Variables**: All environment variables set correctly

## Expected Logs (When Working)

```
✅ Mongo connected
✅ DPAL server running on port 8080
```

NOT:
```
server running (Caddy)
handled request (static files)
```
