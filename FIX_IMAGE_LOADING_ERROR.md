# Fix: NFT Images Not Loading (ERR_SSL_UNRECOGNIZED_NAME_ALERT)

## Problem
NFT images are failing to load with error: `net::ERR_SSL_UNRECOGNIZED_NAME_ALERT`
- Images are trying to load from: `api.dpal.net/v1/assets/...`
- Should load from: `https://web-production-a27b.up.railway.app/api/assets/...`

## Root Cause
The `VITE_API_BASE` environment variable in Vercel is set incorrectly (or to a non-existent domain).

## Solution

### Step 1: Check Current Vercel Environment Variables
1. Go to [Vercel Dashboard](https://vercel.com)
2. Select your project: `dpal-front-end` (or your frontend project name)
3. Go to **Settings** → **Environment Variables**
4. Look for `VITE_API_BASE`

### Step 2: Fix VITE_API_BASE
**If `VITE_API_BASE` exists but is wrong:**
1. Click **Edit** on `VITE_API_BASE`
2. Change the value to: `https://web-production-a27b.up.railway.app`
3. Make sure it's set for **Production**, **Preview**, and **Development**
4. Click **Save**

**If `VITE_API_BASE` doesn't exist:**
1. Click **Add New**
2. Name: `VITE_API_BASE`
3. Value: `https://web-production-a27b.up.railway.app`
4. Select all environments (Production, Preview, Development)
5. Click **Save**

### Step 3: Redeploy
1. After saving, Vercel should automatically trigger a redeploy
2. If not, go to **Deployments** tab and click **Redeploy** on the latest deployment
3. Wait for deployment to complete (1-2 minutes)

### Step 4: Hard Refresh Browser
1. Open your app: `dpal-front-end.vercel.app`
2. Press `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac) to hard refresh
3. Go to Asset Archive and check if images load

### Step 5: Verify (Optional)
1. Open Browser DevTools (F12)
2. Go to **Console** tab
3. Look for logs like:
   ```
   🖼️ NftCard: Image URL resolution: {
     original: "/api/assets/DPAL-...",
     apiBase: "https://web-production-a27b.up.railway.app",
     resolved: "https://web-production-a27b.up.railway.app/api/assets/DPAL-..."
   }
   ```
4. Go to **Network** tab → Filter by **Img**
5. Check that image requests go to `web-production-a27b.up.railway.app` (not `api.dpal.net`)

## Expected Result
- ✅ Images load from: `https://web-production-a27b.up.railway.app/api/assets/DPAL-*.png`
- ✅ No SSL errors in Network tab
- ✅ NFT cards display images correctly

## If Still Not Working
1. Check Railway backend is running:
   ```powershell
   Invoke-WebRequest -Uri "https://web-production-a27b.up.railway.app/health" -UseBasicParsing
   ```
2. Test image endpoint directly:
   ```powershell
   Invoke-WebRequest -Uri "https://web-production-a27b.up.railway.app/api/assets/DPAL-1769527702858-dd12cf3cd8cb1066.png" -UseBasicParsing
   ```
3. Check Vercel deployment logs for any build errors
4. Verify `VITE_API_BASE` is set correctly in Vercel (no typos, no trailing slash)
