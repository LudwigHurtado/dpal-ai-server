# Force Railway to Deploy Latest Code

## Problem
Railway is serving an old deployment from last week, not your latest backend code.

## Solution: Force Fresh Deployment

### Option 1: Trigger New Deployment via Git Push (Recommended)

1. **Make sure your latest code is committed:**
```bash
cd c:\DPAL\dpal-ai-server
git status
git add .
git commit -m "Force Railway redeploy with latest backend code"
git push
```

2. **Railway should auto-deploy** when it detects the new commit.

3. **If it doesn't auto-deploy:**
   - Go to Railway → `dpal-ai-server` → **Deployments**
   - Click **"Redeploy"** on the latest deployment
   - Or click **"Deploy"** button to trigger a new deployment

### Option 2: Check Source Connection

Railway might be connected to the wrong branch or not auto-deploying:

1. **Go to Railway Dashboard** → `dpal-ai-server` → **Settings** → **Source**
2. **Verify:**
   - ✅ Connected to correct GitHub repo
   - ✅ Connected to correct branch (usually `main` or `master`)
   - ✅ Auto-deploy is enabled (should be on by default)

3. **If wrong branch:**
   - Disconnect and reconnect the GitHub repo
   - Select the correct branch during connection

### Option 3: Manual Redeploy

1. **Go to Railway** → `dpal-ai-server` → **Deployments**
2. **Click "Redeploy"** on the latest deployment
3. **Or create new deployment:**
   - Click **"Deploy"** button
   - Select **"Deploy Latest Commit"**

### Option 4: Check Deployment History

1. **Go to Railway** → `dpal-ai-server` → **Deployments**
2. **Check the commit hash** of the active deployment
3. **Compare with your latest commit:**
```bash
cd c:\DPAL\dpal-ai-server
git log -1 --oneline
```
4. **If they don't match**, Railway is using an old commit

## Verify Latest Code is Deployed

After redeploying, check:

1. **Build Logs** should show your latest commit hash
2. **Runtime Logs** should show your latest code running
3. **Test `/health` endpoint:**
   - Visit: `https://dpal-ai-server-production.up.railway.app/health`
   - Should return JSON (not HTML from old static build)

## If Still Showing Old Version

1. **Clear Railway cache:**
   - Go to Settings → **Deploy**
   - Try changing Start Command temporarily, then change it back
   - This forces a fresh build

2. **Check for multiple deployments:**
   - Railway might have multiple deployments
   - Make sure the "Active" deployment is the latest one

3. **Disconnect and reconnect GitHub:**
   - Settings → **Source** → Disconnect
   - Reconnect and select correct branch
   - This forces Railway to re-sync with GitHub

## Quick Checklist

- [ ] Latest code is pushed to GitHub
- [ ] Railway is connected to correct branch
- [ ] Auto-deploy is enabled
- [ ] Latest deployment shows your latest commit hash
- [ ] Build logs show latest code being built
- [ ] `/health` returns JSON (not old HTML)
