# 🔍 Debug Image URLs - Step by Step

## The Problem
Images are still loading from `api.dpal.net/v1/assets/...` instead of your Railway backend, even after fixes.

## Root Cause
**Your browser is using a CACHED JavaScript bundle** from before the fixes were deployed.

## Solution: Force Fresh Bundle

### Step 1: Clear Browser Cache Completely

**Chrome/Edge:**
1. Press `Ctrl + Shift + Delete`
2. Select **"Cached images and files"**
3. Time range: **"All time"**
4. Click **"Clear data"**

**OR use Incognito:**
- Press `Ctrl + Shift + N` (new incognito window)
- Navigate to your app
- This bypasses all cache

### Step 2: Hard Refresh
After clearing cache:
- Press `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
- This forces the browser to reload ALL files

### Step 3: Check Vercel Deployment
1. Go to Vercel Dashboard
2. Check **Deployments** tab
3. Make sure the latest commit (`04ce6ec`) is deployed
4. If not, click **"Redeploy"**

### Step 4: Check Console Logs
Open DevTools Console (`F12`) and look for:

**✅ Good signs:**
```
🔧 NftCard: Computing image URL
✅ NFT image loaded successfully
```

**❌ Bad signs:**
```
🚨 BLOCKED bad URL, using corrected
🚨 FINAL BLOCK: finalImageUrl still has bad URL
```

### Step 5: Check Network Tab
1. Open DevTools → **Network** tab
2. Filter by **"Img"**
3. Look for image requests
4. **They should go to:** `web-production-a27b.up.railway.app/api/assets/...`
5. **NOT:** `api.dpal.net/v1/assets/...`

## If Still Not Working

### Check localStorage
1. Open DevTools → **Application** tab → **Local Storage**
2. Find your domain
3. Look for `dpal-reports` key
4. Check if any `imageUrl` values contain `api.dpal.net`
5. If yes, **delete the `dpal-reports` key** and refresh

### Check VITE_API_BASE
1. In Console, type:
```javascript
console.log('VITE_API_BASE:', import.meta.env.VITE_API_BASE);
```
2. Should show: `https://web-production-a27b.up.railway.app`
3. If `undefined`, **VITE_API_BASE is not set in Vercel**

### Verify Backend is Serving Images
Test directly:
```powershell
Invoke-WebRequest -Uri "https://web-production-a27b.up.railway.app/api/assets/DPAL-1769527702858-dd12cf3cd8cb1066.png" -UseBasicParsing
```

If this returns an image, backend is working. The issue is frontend cache.

## What the Fix Does

The new code has **3 layers of protection**:

1. **Layer 1:** Extracts tokenId and rebuilds URL immediately
2. **Layer 2:** Blocks any `api.dpal.net` URLs in `resolvedImageUrl`
3. **Layer 3:** Final safety check before rendering `<img>` tag

Plus extensive console logging to show exactly what's happening.

## Next Steps

1. ✅ Clear browser cache
2. ✅ Hard refresh (`Ctrl + Shift + R`)
3. ✅ Check Vercel deployment
4. ✅ Check console logs
5. ✅ Check Network tab
6. ✅ Test backend directly

If images STILL don't load after all this, the issue is likely:
- Vercel hasn't rebuilt with latest code
- Browser is still using cached bundle
- `VITE_API_BASE` not set in Vercel
