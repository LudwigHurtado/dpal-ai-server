# How to Test Your Health Endpoint

## ❌ What You Did Wrong

You used: `https://your-railway-backend.railway.app/health`

This is a **placeholder URL** - you need to replace it with your **actual Railway URL**.

## ✅ Correct Steps

### Step 1: Find Your Railway URL

1. Go to **Railway Dashboard**: https://railway.app
2. Click on your **backend service** (usually named "web" or "dpal-ai-server")
3. Go to **Settings** tab (left sidebar)
4. Scroll to **"Networking"** or **"Domains"** section
5. You'll see your URL, something like:
   - `https://web-production-a27b.up.railway.app`
   - `https://dpal-ai-server-production.up.railway.app`
   - `https://your-service-name.up.railway.app`

### Step 2: Test Health Endpoint

**PowerShell:**
```powershell
# Replace YOUR-ACTUAL-URL with your Railway URL
curl https://YOUR-ACTUAL-URL.up.railway.app/health
```

**Or in Browser:**
Just open: `https://YOUR-ACTUAL-URL.up.railway.app/health`

### Step 3: Expected Response

**✅ Correct Response (JSON):**
```json
{
  "ok": true,
  "service": "dpal-ai-server",
  "version": "2026-01-25-v3",
  "ts": 1737686400000,
  "database": {
    "connected": true,
    "state": "connected",
    "ready": true
  }
}
```

**❌ If Database Not Connected:**
```json
{
  "ok": true,
  "service": "dpal-ai-server",
  "version": "2026-01-25-v3",
  "ts": 1737686400000,
  "database": {
    "connected": false,
    "state": "disconnected",
    "ready": false
  }
}
```

**❌ Wrong Responses:**
- `"OK"` (plain text) → Wrong endpoint or wrong URL
- `404 Not Found` → Route not configured or wrong URL
- `502 Bad Gateway` → Service is starting/restarting
- Connection error → Service is down or URL is wrong

## 🔍 Quick Check: Is Your Service Running?

1. Go to Railway → Your Service → **Deployments** tab
2. Check if latest deployment shows **"Active"** (green)
3. If it shows "Building" or "Failed", wait or fix the issue

## 📝 Example with Real URL

If your Railway URL is `https://web-production-a27b.up.railway.app`:

```powershell
curl https://web-production-a27b.up.railway.app/health
```

Should return JSON like:
```json
{
  "ok": true,
  "service": "dpal-ai-server",
  "database": { "connected": true }
}
```

## 🎯 Next Steps

1. **Find your actual Railway URL** (Settings → Networking)
2. **Test `/health` endpoint** with your real URL
3. **Check database status** in the response
4. **If `database.connected: false`**, set `MONGODB_URI` in Railway Variables
