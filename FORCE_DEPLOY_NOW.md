# Force Railway to Deploy Latest Backend Code

## Problem
Railway is still serving the old static build from last week instead of your new Node.js backend.

## Solution: Force Fresh Deployment

### Step 1: Verify Railway Settings (You Already Did This ✅)
- Pre-deploy: `npm install && npm run build`
- Start Command: `npm start`
- These are correct!

### Step 2: Force New Deployment

**Option A: Manual Redeploy (Recommended)**
1. Go to Railway → `dpal-ai-server` → **Deployments**
2. Find the latest deployment (should show commit `e622afe` or newer)
3. Click **"Redeploy"** button
4. Watch the Build Logs

**Option B: Disconnect/Reconnect GitHub**
1. Railway → Settings → **Source**
2. Click **"Disconnect"** 
3. Click **"Connect GitHub"** again
4. Select your `dpal-ai-server` repo
5. Select `main` branch
6. This forces Railway to re-sync and deploy

**Option C: Wait for Auto-Deploy**
- I just pushed a new commit (`Force Railway redeploy`)
- Railway should auto-deploy if it's connected properly
- Check Deployments tab for new deployment

### Step 3: Watch Build Logs

After triggering deployment, check **Build Logs**:

**✅ CORRECT (Backend Building):**
```
npm install
npm run build
tsc (TypeScript compilation)
Creating dist/index.js
```

**❌ WRONG (Still Static):**
```
No start command found
Caddy server
Static files detected
```

### Step 4: Verify Runtime Logs

After build completes, check **Runtime Logs**:

**✅ CORRECT (Backend Running):**
```
✅ DPAL server running on port 8080
✅ Mongo connected (if MONGODB_URI is set)
```

**❌ WRONG (Still Static):**
```
server running (Caddy)
handled request (static files)
```

### Step 5: Test Health Endpoint

After deployment, test:
```
https://dpal-ai-server-production.up.railway.app/health
```

**✅ Should Return (JSON):**
```json
{
  "ok": true,
  "service": "dpal-ai-server",
  "version": "2026-01-24-v2",
  "ts": 1234567890
}
```

**❌ Wrong (HTML):**
```html
<!DOCTYPE html>
<html>...
```

## If Still Not Working

1. **Check if Railway is connected to correct branch:**
   - Settings → Source → Verify it's `main` branch

2. **Check if auto-deploy is enabled:**
   - Settings → Source → Should show "Auto-deploy: Enabled"

3. **Try deleting and recreating the service:**
   - Last resort: Delete the service and create a new one
   - Connect to GitHub repo again
   - Set build/start commands
   - Deploy fresh

## Current Status

- Latest commit: `e622afe` (just pushed)
- Railway settings: ✅ Correct
- Need: Force Railway to actually deploy this code

**Next Step:** Go to Railway → Deployments → Click "Redeploy" on latest deployment
