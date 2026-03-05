# Fix: VITE_API_BASE Set But Not Working

## Problem
You've set `VITE_API_BASE` correctly in Vercel, but images are still loading from `api.dpal.net` instead of your Railway backend.

## Why This Happens
**Vite environment variables are baked into the JavaScript bundle at BUILD TIME.** Just setting the env var in Vercel doesn't update existing deployments - you need to **trigger a new build**.

## Solution Steps

### Step 1: Verify VITE_API_BASE in Vercel
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Confirm `VITE_API_BASE` = `https://web-production-a27b.up.railway.app`
3. Make sure it's checked for **Production**, **Preview**, AND **Development**
4. If you see a warning icon, click it to see what's wrong

### Step 2: Force a New Deployment
**Option A: Redeploy Latest (Recommended)**
1. Go to **Deployments** tab in Vercel
2. Find the latest deployment
3. Click the **three dots (⋯)** menu
4. Click **Redeploy**
5. Wait for deployment to complete (2-3 minutes)

**Option B: Push a New Commit**
1. Make a small change to any file (add a comment, space, etc.)
2. Commit and push:
   ```bash
   git commit --allow-empty -m "Trigger Vercel rebuild for env vars"
   git push origin main
   ```
3. Wait for Vercel to build and deploy

**Option C: Delete and Re-add the Env Var**
1. In Vercel → Settings → Environment Variables
2. **Delete** `VITE_API_BASE`
3. **Add it again** with the same value: `https://web-production-a27b.up.railway.app`
4. This will trigger a new deployment automatically

### Step 3: Clear Browser Cache
After the new deployment:
1. Open your app in an **Incognito/Private window** (to bypass cache)
2. Or hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
3. Or clear browser cache completely

### Step 4: Verify It's Working
1. Open Browser DevTools (F12)
2. Go to **Console** tab
3. Navigate to Asset Archive
4. Look for logs like:
   ```
   🖼️ NftCard Image URL Debug: {
     envVar: "https://web-production-a27b.up.railway.app",
     apiBase: "https://web-production-a27b.up.railway.app",
     resolvedUrl: "https://web-production-a27b.up.railway.app/api/assets/..."
   }
   ```
5. If you see `envVar: "(NOT SET - using fallback)"`, the env var isn't being read
6. Go to **Network** tab → Filter by **Img**
7. Check that requests go to `web-production-a27b.up.railway.app` (not `api.dpal.net`)

## Common Issues

### Issue 1: Env Var Not Set for All Environments
**Symptom:** Works in preview but not production
**Fix:** Make sure `VITE_API_BASE` is checked for **Production**, **Preview**, AND **Development**

### Issue 2: Typo in Env Var Name
**Symptom:** Console shows `envVar: "(NOT SET - using fallback)"`
**Fix:** Double-check the name is exactly `VITE_API_BASE` (case-sensitive, with underscore)

### Issue 3: Trailing Slash
**Symptom:** URLs have double slashes like `https://...//api/assets/...`
**Fix:** Remove trailing slash from `VITE_API_BASE` value (should be `https://web-production-a27b.up.railway.app` not `https://web-production-a27b.up.railway.app/`)

### Issue 4: Old Build Still Cached
**Symptom:** Still seeing old URLs after redeploy
**Fix:** 
- Clear browser cache completely
- Try incognito window
- Check Vercel deployment logs to confirm new build completed

## Quick Test
After redeploying, run this in browser console:
```javascript
console.log('VITE_API_BASE:', import.meta.env.VITE_API_BASE);
```
Should show: `https://web-production-a27b.up.railway.app`

If it shows `undefined`, the env var isn't being read at build time.

## Still Not Working?
1. Check Vercel build logs for any errors
2. Verify the deployment actually rebuilt (check deployment timestamp)
3. Try deleting and re-adding the env var
4. Check if there are multiple `VITE_API_BASE` entries (delete duplicates)
5. Contact Vercel support if the env var still isn't being picked up
