# Fix: Railway Stuck on Old Commit - Disconnect/Reconnect

## Problem
- Railway shows commit `aa3ff79c` (from last week)
- Latest commits (`7b21726`, `e622afe`) are NOT being deployed
- Logs are empty/blank
- Wrong commit compared to Vercel

## Root Cause
Railway's GitHub connection is out of sync. It's not detecting your new commits.

## Solution: Disconnect and Reconnect GitHub

### Step 1: Disconnect GitHub
1. Go to Railway → `dpal-ai-server` → **Settings** → **Source**
2. Click **"Disconnect"** button
3. Confirm disconnection

### Step 2: Reconnect GitHub
1. In the same **Source** section, click **"Connect GitHub"**
2. Select your GitHub account
3. Find and select the `dpal-ai-server` repository
4. **IMPORTANT:** Select the `main` branch (not `master` or any other branch)
5. Click **"Connect"**

### Step 3: Verify Settings After Reconnect
After reconnecting, go to **Settings** → **Deploy**:
- **Pre-deploy Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Root Directory**: (leave empty)

### Step 4: Watch New Deployment
After reconnecting:
1. Railway should automatically trigger a new deployment
2. Go to **Deployments** tab
3. You should see a NEW deployment starting
4. The commit hash should be `7b21726` (or latest), NOT `aa3ff79c`

### Step 5: Check Build Logs
Once new deployment starts:
- Go to **Deployments** → Latest → **Build Logs**
- Should see:
  - `npm install`
  - `npm run build`
  - `tsc` (TypeScript compilation)
  - Creating `dist/index.js`

### Step 6: Check Runtime Logs
After build completes:
- Go to **Logs** tab
- Should see: `✅ DPAL server running on port 8080`
- Should NOT see: `server running (Caddy)`

## Alternative: Manual Deploy Latest Commit

If disconnect/reconnect doesn't work:

1. Railway → **Deployments**
2. Click **"Deploy"** button (top right)
3. Select **"Deploy Latest Commit"**
4. This should pick up commit `7b21726`

## Verify It's Working

After deployment completes, test:
```
https://dpal-ai-server-production.up.railway.app/health
```

Should return JSON:
```json
{
  "ok": true,
  "service": "dpal-ai-server",
  "version": "2026-01-24-v2",
  "ts": 1234567890
}
```

If it returns HTML, Railway is still serving static files.

## Current Status

- **Latest commit in GitHub**: `7b21726` (just pushed)
- **Railway active commit**: `aa3ff79c` (old, from last week)
- **Issue**: Railway not syncing with GitHub

**Action Required**: Disconnect and reconnect GitHub in Railway Settings → Source
