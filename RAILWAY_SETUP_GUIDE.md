# Railway Setup Guide - Fix Backend Not Running

## Problem
Railway is serving static frontend files instead of running the Node.js backend server. This is why all API calls fail with "Failed to fetch".

## Solution Steps

### 1. Check Railway Service Settings

Go to Railway Dashboard → `dpal-ai-server` → **Settings** → **Deploy**

**Required Settings:**
- **Root Directory**: Leave empty (or `/`)
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Builder**: `Nixpacks` (should auto-detect, but verify)

### 2. Verify Build Output

After setting the commands, check **Deployments** → Latest → **Build Logs**:

Look for:
```
✓ Compiled successfully
✓ Built dist/index.js
```

If you see errors about missing files or TypeScript errors, fix those first.

### 3. Check Runtime Logs

After deployment, check **Logs** tab:

**✅ CORRECT (Backend Running):**
```
✅ Mongo connected
✅ DPAL server running on port 8080
```

**❌ WRONG (Static Files):**
```
server running (Caddy)
handled request (static files)
```

### 4. If Still Serving Static Files

Railway might be detecting `index.html` and treating this as a static site.

**Fix Option A: Force Node.js Detection**
1. In Railway → Settings → **Deploy**
2. Set **Builder** to `Nixpacks` explicitly
3. Set **Start Command** to: `npm start`
4. Redeploy

**Fix Option B: Remove Frontend Files from Deployment**
The `.railwayignore` file should already exclude frontend files, but verify:
- `index.html` is ignored
- `components/` is ignored
- `vite.config.ts` is ignored

### 5. Environment Variables

Make sure these are set in Railway → **Variables**:
- `MONGODB_URI` - Your MongoDB connection string
- `GEMINI_API_KEY` - Your Google Gemini API key
- `FRONTEND_ORIGIN` - `https://dpal-front-end.vercel.app` (for CORS)
- `PORT` - Railway sets this automatically, but your code should use `process.env.PORT || 8080`

### 6. Verify Backend is Running

Once deployed correctly, test:
```bash
curl https://dpal-ai-server-production.up.railway.app/health
```

Should return:
```json
{"ok": true, "service": "dpal-ai-server"}
```

NOT HTML!

## Current Status

Based on the logs, Railway is currently:
- ❌ Serving static files (Caddy web server)
- ❌ Not running Node.js backend
- ❌ All API endpoints return HTML instead of JSON

After fixing Railway settings, the backend should:
- ✅ Run `npm start` which executes `node dist/index.js`
- ✅ Start Express server on port 8080
- ✅ Respond to `/health` with JSON
- ✅ Handle API requests properly
